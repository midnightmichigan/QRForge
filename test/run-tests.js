/* qrforge — test/run-tests.js
 * Node unit/integration tests for qrcode.js (the DOM-free engine).
 * Run: node test/run-tests.js
 */
'use strict';
const QR = require('../qrcode.js');
const { execFileSync } = require('child_process');

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push(name + ' :: ' + (e && e.message ? e.message : e));
  }
}
function assert(cond, msg) { if (!cond) { throw new Error(msg || 'assertion failed'); } }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error((msg || 'not equal') + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
}
function assertDeep(a, b, msg) {
  assertEq(JSON.stringify(a), JSON.stringify(b), msg);
}
function bitsToInt(msbFirstStr) { return parseInt(msbFirstStr, 2); }

/* ---------------- GF(256) ---------------- */
test('gf: multiply by 0 and 1', () => {
  assertEq(QR._gfMul(0, 123), 0);
  assertEq(QR._gfMul(1, 87), 87);
  assertEq(QR._gfMul(87, 1), 87);
});
test('gf: every nonzero element has an inverse', () => {
  for (let a = 1; a < 256; a++) {
    let found = false;
    for (let b = 1; b < 256; b++) { if (QR._gfMul(a, b) === 1) { found = true; break; } }
    assert(found, 'no inverse for ' + a);
  }
});
test('gf: known product (0x53 * 0xCA = 0x01 in AES field; QR field differs) sanity: associativity', () => {
  const a = 0x53, b = 0xca, c = 0x37;
  assertEq(QR._gfMul(QR._gfMul(a, b), c), QR._gfMul(a, QR._gfMul(b, c)), 'not associative');
});

/* ---------------- Reed-Solomon ---------------- */
test('rs: generator polynomial known vectors', () => {
  // prod_{i=0}^{n-1} (x + a^i) in GF(256), leading coefficient first.
  // Values cross-checked against an independent Python implementation.
  assertDeep(QR._rsGeneratorPoly(7), [1, 127, 122, 154, 164, 11, 68, 117], 'gen(7)');
  assertDeep(QR._rsGeneratorPoly(10), [1, 216, 194, 159, 111, 199, 94, 95, 113, 157, 193], 'gen(10)');
  assertDeep(QR._rsGeneratorPoly(13), [1, 137, 73, 227, 17, 177, 17, 52, 13, 46, 43, 83, 132, 120], 'gen(13)');
});

test('rs: codewords satisfy the generator polynomial (syndrome zero)', () => {
  const cases = [
    { data: [1, 2, 3, 4, 5], ec: 10 },
    { data: Array.from({ length: 16 }, (_, i) => (i * 37 + 11) & 0xff), ec: 10 },
    { data: Array.from({ length: 44 }, (_, i) => (i * 91 + 7) & 0xff), ec: 26 },
    { data: [0], ec: 7 },
    { data: Array.from({ length: 100 }, () => 255), ec: 30 },
  ];
  for (const { data, ec } of cases) {
    const ecc = QR._rsEncode(data, ec);
    assertEq(ecc.length, ec, 'ec length');
    const rem = QR._rsEncode(data.concat(ecc), ec);
    assert(rem.every(v => v === 0), 'nonzero syndrome for ec=' + ec);
  }
});
test('rs: deterministic', () => {
  assertDeep(QR._rsEncode([10, 20, 30], 10), QR._rsEncode([10, 20, 30], 10));
});

/* ---------------- Format info (known 15-bit strings, MSB-first) ---------------- */
test('formatBits: known values', () => {
  const known = {
    'L0': '111011111000100',
    'L1': '111001011110011',
    'M0': '101010000010010',
    'Q0': '011010101011111',
    'H0': '001011010001001',
  };
  for (const key of Object.keys(known)) {
    const level = key[0], mask = +key[1];
    assertEq(QR._formatBits(level, mask), bitsToInt(known[key]),
      'formatBits ' + level + '/' + mask);
  }
});

/* ---------------- Version info ---------------- */
test('versionBits: version 7 known value', () => {
  assertEq(QR._versionBits(7), bitsToInt('000111110010010100'), 'version 7 bits');
});
test('versionBits: BCH self-consistency for versions 7..20', () => {
  // The 12 low bits must be the BCH remainder of the 6-bit version number.
  for (let v = 7; v <= 20; v++) {
    const V = QR._versionBits(v);
    assertEq(V >>> 12, v, 'high bits of version info for v' + v);
    let rem = v;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    assertEq(V & 0xfff, rem & 0xfff, 'BCH remainder for v' + v);
  }
});

/* ---------------- EC table self-check ---------------- */
test('ecTable: (ec+data)*blocks sums to total codewords for every version/level', () => {
  for (let v = 1; v <= 20; v++) {
    for (const lv of ['L', 'M', 'Q', 'H']) {
      const e = QR._ecTable[v][lv];
      const total = (e[0] + e[2]) * e[1] + (e[0] + e[4]) * e[3];
      assertEq(total, QR._totalCodewords[v], 'v' + v + '/' + lv);
    }
  }
});
test('byteCapacity: spot values', () => {
  assertEq(QR.byteCapacity(1, 'L'), 17);
  assertEq(QR.byteCapacity(1, 'M'), 14);
  assertEq(QR.byteCapacity(1, 'Q'), 11);
  assertEq(QR.byteCapacity(1, 'H'), 7);
  assertEq(QR.byteCapacity(10, 'M'), 213, 'v10-M byte capacity'); // 216 data cw, 16-bit count
});

/* ---------------- Version auto-selection ---------------- */
test('encode: picks smallest fitting version', () => {
  assertEq(QR.encode('A'.repeat(14), 'M').version, 1);
  assertEq(QR.encode('A'.repeat(15), 'M').version, 2);
  assertEq(QR.encode('A'.repeat(17), 'L').version, 1);
  assertEq(QR.encode('A'.repeat(18), 'L').version, 2);
  assertEq(QR.encode('x', 'H').version, 1);
});
test('encode: rejects empty and too-long input', () => {
  let threw = false;
  try { QR.encode('', 'M'); } catch (e) { threw = true; }
  assert(threw, 'empty input should throw');
  threw = false;
  try { QR.encode('A'.repeat(400), 'H'); } catch (e) { threw = true; }
  assert(threw, 'over-capacity input should throw');
  assertEq(QR.encode('A'.repeat(382), 'H').version, 20, 'max H payload fits v20');
});

/* ---------------- Structural checks ---------------- */
function finderAt(m, cx, cy) {
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      // 7x7 finder: dark outer ring (dist 3), light ring (dist 2), dark 3x3 center (dist 0-1)
      const expect = (dist === 3 || dist <= 1) ? 1 : 0;
      assertEq(m[cy + dy][cx + dx], expect, `finder (${cx},${cy}) offset ${dx},${dy}`);
    }
  }
}
test('structure: finder patterns exact at three corners (v1, v5, v10)', () => {
  for (const v of [1, 5, 10]) {
    const r = QR.encode('A'.repeat(QR.byteCapacity(v, 'M')), 'M');
    assertEq(r.version, v);
    const s = r.size, m = r.modules;
    finderAt(m, 3, 3);
    finderAt(m, s - 4, 3);
    finderAt(m, 3, s - 4);
  }
});
test('structure: timing pattern alternates', () => {
  const r = QR.encode('timing check', 'M');
  const s = r.size, m = r.modules;
  for (let i = 8; i < s - 8; i++) {
    assertEq(m[6][i], i % 2 === 0 ? 1 : 0, 'timing row col ' + i);
    assertEq(m[i][6], i % 2 === 0 ? 1 : 0, 'timing col row ' + i);
  }
});
test('structure: dark module present and always dark', () => {
  // (4v+9, 8) is a fixed dark function module in the standard.
  for (const v of [1, 7, 20]) {
    const r = QR.encode('B'.repeat(QR.byteCapacity(v, 'Q')), 'Q');
    assertEq(r.modules[4 * v + 9][8], 1, 'dark module v' + v);
  }
});
test('structure: all modules set, size correct, mask in range', () => {
  for (const lv of ['L', 'M', 'Q', 'H']) {
    const r = QR.encode('https://example.com/?a=1&b=2', lv);
    assertEq(r.size, 17 + 4 * r.version);
    assert(r.mask >= 0 && r.mask <= 7, 'mask range');
    for (const row of r.modules) for (const c of row) assert(c === 0 || c === 1, 'binary module');
  }
});
test('encode: deterministic across runs', () => {
  const a = QR.encode('determinism-123', 'Q');
  const b = QR.encode('determinism-123', 'Q');
  assertDeep(a.modules, b.modules);
  assertEq(a.mask, b.mask);
  assertEq(a.version, b.version);
});

/* ---------------- UTF-8 ---------------- */
test('utf8: multibyte characters', () => {
  assertDeep(QR._utf8Bytes('é'), [0xc3, 0xa9]);
  assertDeep(QR._utf8Bytes('😀'), [0xf0, 0x9f, 0x98, 0x80]);
  assertDeep(QR._utf8Bytes('A'), [0x41]);
});
test('encode: unicode payload round-trips through capacity', () => {
  const r = QR.encode('café ☕', 'M');
  assertEq(r.bytes.length, QR._utf8Bytes('café ☕').length);
});

/* ---------------- Payload builders ---------------- */
test('buildWifi: format and escaping', () => {
  assertEq(QR.buildWifi('MyNet', 'WPA', 'secret', false), 'WIFI:T:WPA;S:MyNet;P:secret;;');
  assertEq(QR.buildWifi('MyNet', 'nopass', '', false), 'WIFI:T:nopass;S:MyNet;;');
  assertEq(QR.buildWifi('My;Net', 'WPA', 'p:a,ss\\x', true),
    'WIFI:T:WPA;S:My\\;Net;P:p\\:a\\,ss\\\\x;H:true;;');
});
test('buildVCard: shape', () => {
  const v = QR.buildVCard({ name: 'Dakota McCall', phone: '2699537168', email: 'a@b.c' });
  assertEq(v, 'BEGIN:VCARD\nVERSION:3.0\nFN:Dakota McCall\nTEL:2699537168\nEMAIL:a@b.c\nEND:VCARD');
});
test('buildVCard: escapes separators', () => {
  const v = QR.buildVCard({ name: 'A;B,C' });
  assert(v.includes('FN:A\\;B\\,C'), 'escaped name, got: ' + v);
});
test('buildEmail: mailto with query', () => {
  assertEq(QR.buildEmail('a@b.c', 'Hi there', 'line one'),
    'mailto:a@b.c?subject=Hi%20there&body=line%20one');
  assertEq(QR.buildEmail('a@b.c'), 'mailto:a@b.c');
});

/* ---------------- SVG ---------------- */
test('toSVG: dimensions and dark-module count match', () => {
  const r = QR.encode('svg test', 'M');
  const svg = QR.toSVG(r, { scale: 10, margin: 4 });
  const total = r.size + 8;
  assert(svg.includes('width="' + total * 10 + '"'), 'width');
  assert(svg.includes('viewBox="0 0 ' + total + ' ' + total + '"'), 'viewBox');
  let dark = 0;
  for (const row of r.modules) for (const c of row) dark += c;
  const paths = (svg.match(/h1v1h-1z/g) || []).length;
  assertEq(paths, dark, 'one path rect per dark module');
});
test('toSVG: title is XML-escaped', () => {
  const r = QR.encode('x', 'M');
  const svg = QR.toSVG(r, { title: 'a<b>&"c"' });
  assert(svg.includes('<title>a&lt;b&gt;&amp;"c"</title>') || svg.includes('&quot;'), 'escaped title');
});

/* ---------------- Differential test vs reference implementation ----------------
 * Compares full module matrices against the independent Python `qrcode`
 * library (installed in /tmp/qrvenv). My encoder must agree bit-for-bit:
 * same version selection, same mask choice, same placement.
 * Skipped gracefully if the venv is unavailable. */
test('differential: full-matrix equality with reference QR library', () => {
  const PY = '/tmp/qrvenv/bin/python';
  let avail = false;
  try { execFileSync(PY, ['-c', 'import qrcode'], { stdio: 'ignore' }); avail = true; }
  catch (e) { /* skip */ }
  if (!avail) { console.log('    (skip: reference venv unavailable)'); return; }

  const cases = [];
  const payloads = [
    'HELLO',
    'https://example.com/some/path?q=1&r=2',
    'WIFI:T:WPA;S:MyNet;P:secret123;;',
    'BEGIN:VCARD\nVERSION:3.0\nFN:Test User\nTEL:123\nEND:VCARD',
    'café ☕ — unicode test',
    'A'.repeat(50),
    '0123456789'.repeat(20), // forces v2/v3
    'The quick brown fox jumps over the lazy dog. '.repeat(6),
  ];
  for (const p of payloads) for (const lv of ['L', 'M', 'Q', 'H']) cases.push({ text: p, level: lv });

  const helper = `
import json, sys, qrcode
from qrcode.constants import ERROR_CORRECT_L, ERROR_CORRECT_M, ERROR_CORRECT_Q, ERROR_CORRECT_H
from qrcode.util import QRData, MODE_8BIT_BYTE
LV = {'L': ERROR_CORRECT_L, 'M': ERROR_CORRECT_M, 'Q': ERROR_CORRECT_Q, 'H': ERROR_CORRECT_H}
out = []
for case in json.load(sys.stdin):
    qr = qrcode.QRCode(error_correction=LV[case['level']])
    # Force byte mode: qrforge is a byte-mode-only encoder; the reference
    # library would otherwise pick alphanumeric mode for [0-9A-Z ] payloads.
    qr.add_data(QRData(case['text'], mode=MODE_8BIT_BYTE))
    qr.make(fit=True)
    qr.border = 0  # get_matrix() includes the quiet-zone border unless disabled
    m = qr.get_matrix()
    out.append({'size': len(m), 'rows': [''.join('1' if c else '0' for c in row) for row in m],
                'version': qr.version})
print(json.dumps(out))
`;
  const res = execFileSync(PY, ['-c', helper],
    { input: JSON.stringify(cases), maxBuffer: 64 * 1024 * 1024 }).toString();
  const refs = JSON.parse(res);
  assertEq(refs.length, cases.length, 'reference case count');
  let mismatches = [];
  cases.forEach((c, i) => {
    const mine = QR.encode(c.text, c.level);
    const ref = refs[i];
    const mineRows = mine.modules.map(row => row.join(''));
    if (mine.version !== ref.version || mineRows.join('') !== ref.rows.join('')) {
      mismatches.push(`case ${i} (${c.level}, v${mine.version} vs ref v${ref.version}, len ${c.text.length})`);
    }
  });
  assert(mismatches.length === 0, 'matrix mismatches:\n' + mismatches.join('\n'));
});

/* ---------------- Report ---------------- */
console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
