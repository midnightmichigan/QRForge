/* qrforge — qrcode.js
 *
 * Original QR Code encoder written from scratch for this project.
 * Byte mode (UTF-8), versions 1-20, error correction levels L/M/Q/H.
 * DOM-free: works in browsers and in Node (UMD wrapper), zero dependencies.
 *
 * The QR Code format is an open standard (ISO/IEC 18004). This file is an
 * independent implementation of that standard's encoding algorithm —
 * no third-party QR library code was copied or adapted.
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.QRForge = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- GF(256)
  // Arithmetic in GF(2^8) with the QR-specified primitive polynomial x^8+x^4+x^3+x^2+1 (0x11D).
  var EXP_TABLE = new Array(512);
  var LOG_TABLE = new Array(256);
  (function initGf() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP_TABLE[i] = x;
      LOG_TABLE[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP_TABLE[j] = EXP_TABLE[j - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
  }

  // ------------------------------------------------------- Reed-Solomon
  function rsGeneratorPoly(degree) {
    var poly = [1];
    for (var i = 0; i < degree; i++) {
      var next = new Array(poly.length + 1);
      for (var k = 0; k < next.length; k++) next[k] = 0;
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], EXP_TABLE[i]);
      }
      poly = next;
    }
    return poly; // poly[0] is the x^degree coefficient (=1), length degree+1
  }

  // Returns `ecCount` error-correction codewords for `data` (array of bytes).
  function rsEncode(data, ecCount) {
    var gen = rsGeneratorPoly(ecCount);
    var res = new Array(ecCount);
    for (var i = 0; i < ecCount; i++) res[i] = 0;
    for (var d = 0; d < data.length; d++) {
      var factor = data[d] ^ res[0];
      for (var k = 0; k < ecCount - 1; k++) res[k] = res[k + 1];
      res[ecCount - 1] = 0;
      if (factor !== 0) {
        for (var j = 0; j < ecCount; j++) res[j] ^= gfMul(gen[j + 1], factor);
      }
    }
    return res;
  }

  // ------------------------------------------- Error-correction block table
  // Per version (1-20) and level (L/M/Q/H):
  // [ecCodewordsPerBlock, group1Blocks, group1DataCodewords, group2Blocks, group2DataCodewords]
  // Values are the published parameters of the QR Code standard.
  var EC_TABLE = {
    1:  { L: [7,1,19,0,0],   M: [10,1,16,0,0],  Q: [13,1,13,0,0],  H: [17,1,9,0,0] },
    2:  { L: [10,1,34,0,0],  M: [16,1,28,0,0],  Q: [22,1,22,0,0],  H: [28,1,16,0,0] },
    3:  { L: [15,1,55,0,0],  M: [26,1,44,0,0],  Q: [18,2,17,0,0],  H: [22,2,13,0,0] },
    4:  { L: [20,1,80,0,0],  M: [18,2,32,0,0],  Q: [26,2,24,0,0],  H: [16,4,9,0,0] },
    5:  { L: [26,1,108,0,0], M: [24,2,43,0,0],  Q: [18,2,15,2,16], H: [22,2,11,2,12] },
    6:  { L: [18,2,68,0,0],  M: [16,4,27,0,0],  Q: [24,4,19,0,0],  H: [28,4,15,0,0] },
    7:  { L: [20,2,78,0,0],  M: [18,4,31,0,0],  Q: [18,2,14,4,15], H: [26,4,13,1,14] },
    8:  { L: [24,2,97,0,0],  M: [22,2,38,2,39], Q: [22,4,18,2,19], H: [26,4,14,2,15] },
    9:  { L: [30,2,116,0,0], M: [22,3,36,2,37], Q: [20,4,16,4,17], H: [24,4,12,4,13] },
    10: { L: [18,2,68,2,69], M: [26,4,43,1,44], Q: [24,6,19,2,20], H: [28,6,15,2,16] },
    11: { L: [20,4,81,0,0],  M: [30,1,50,4,51], Q: [28,4,22,4,23], H: [24,3,12,8,13] },
    12: { L: [24,2,92,2,93], M: [22,6,36,2,37], Q: [26,4,20,6,21], H: [28,7,14,4,15] },
    13: { L: [26,4,107,0,0], M: [22,8,37,1,38], Q: [24,8,20,4,21], H: [22,12,11,4,12] },
    14: { L: [30,3,115,1,116], M: [24,4,40,5,41], Q: [20,11,16,5,17], H: [24,11,12,5,13] },
    15: { L: [22,5,87,1,88], M: [24,5,41,5,42], Q: [30,5,24,7,25], H: [24,11,12,7,13] },
    16: { L: [24,5,98,1,99], M: [28,7,45,3,46], Q: [24,15,19,2,20], H: [30,3,15,13,16] },
    17: { L: [28,1,107,5,108], M: [28,10,46,1,47], Q: [28,1,22,15,23], H: [28,2,14,17,15] },
    18: { L: [30,5,120,1,121], M: [26,9,43,4,44], Q: [28,17,22,1,23], H: [28,2,14,19,15] },
    19: { L: [28,3,113,4,114], M: [26,3,44,11,45], Q: [26,17,21,4,22], H: [26,9,13,16,14] },
    20: { L: [28,3,107,5,108], M: [26,3,41,13,42], Q: [30,15,24,5,25], H: [28,15,15,10,16] }
  };

  // Total codewords (data + EC) per version — used to self-check the table above.
  var TOTAL_CODEWORDS = {
    1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172, 7: 196, 8: 242, 9: 292,
    10: 346, 11: 404, 12: 466, 13: 532, 14: 581, 15: 655, 16: 733,
    17: 815, 18: 901, 19: 991, 20: 1085
  };

  // Alignment pattern center coordinates per version (standard values).
  var ALIGN_POS = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
    11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62],
    14: [6, 26, 46, 66], 15: [6, 26, 48, 70], 16: [6, 26, 50, 74],
    17: [6, 30, 54, 78], 18: [6, 30, 56, 82], 19: [6, 30, 58, 86],
    20: [6, 34, 62, 90]
  };

  var EC_LEVELS = ['L', 'M', 'Q', 'H'];
  // 2-bit format-info values per EC level (standard).
  var EC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  function dataCodewordsCount(version, level) {
    var e = EC_TABLE[version][level];
    return e[1] * e[2] + e[3] * e[4];
  }

  // Max UTF-8 bytes encodable in byte mode for version/level.
  function byteCapacity(version, level) {
    var countBits = version <= 9 ? 8 : 16;
    var bits = dataCodewordsCount(version, level) * 8 - 4 - countBits;
    return Math.floor(bits / 8);
  }

  // ------------------------------------------------------------- UTF-8
  function utf8Bytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var lo = str.charCodeAt(i + 1);
        if (lo >= 0xdc00 && lo <= 0xdfff) {
          var cp = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00);
          bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f),
                     0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
          i++;
        } else {
          bytes.push(0xef, 0xbf, 0xbd); // lone surrogate -> replacement char
        }
      } else {
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return bytes;
  }

  // ------------------------------------------------------- Bit buffer
  function BitBuffer() { this.bits = []; }
  BitBuffer.prototype.put = function (val, len) {
    for (var i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1);
  };
  BitBuffer.prototype.length = function () { return this.bits.length; };

  // ------------------------------------------------------- Format info
  // Returns the 15-bit format string for (level, mask), bit 14 = first-placed.
  function formatBits(level, mask) {
    var data = (EC_FORMAT_BITS[level] << 3) | mask; // 5 bits
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return (((data << 10) | rem) ^ 0x5412) & 0x7fff;
  }

  // Returns the 18-bit version string (versions 7+), bit 17 = MSB.
  function versionBits(version) {
    var rem = version;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    return ((version << 12) | rem) & 0x3ffff;
  }

  // ------------------------------------------------------- Mask patterns
  function maskCondition(mask, y, x) {
    switch (mask) {
      case 0: return (y + x) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (y + x) % 3 === 0;
      case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
      case 5: return ((y * x) % 2 + (y * x) % 3) === 0;
      case 6: return (((y * x) % 2 + (y * x) % 3) % 2) === 0;
      case 7: return (((y + x) % 2 + (y * x) % 3) % 2) === 0;
      default: throw new Error('bad mask: ' + mask);
    }
  }

  // Penalty score for a fully-masked matrix (lower is better). Standard rules 1-4.
  function maskPenalty(modules) {
    var size = modules.length;
    var penalty = 0;
    var x, y, runColor, runLen;
    // Rule 1: runs of 5+ in rows and columns.
    for (y = 0; y < size; y++) {
      runColor = -1; runLen = 0;
      for (x = 0; x < size; x++) {
        if (modules[y][x] === runColor) { runLen++; }
        else {
          if (runLen >= 5) penalty += 3 + (runLen - 5);
          runColor = modules[y][x]; runLen = 1;
        }
      }
      if (runLen >= 5) penalty += 3 + (runLen - 5);
    }
    for (x = 0; x < size; x++) {
      runColor = -1; runLen = 0;
      for (y = 0; y < size; y++) {
        if (modules[y][x] === runColor) { runLen++; }
        else {
          if (runLen >= 5) penalty += 3 + (runLen - 5);
          runColor = modules[y][x]; runLen = 1;
        }
      }
      if (runLen >= 5) penalty += 3 + (runLen - 5);
    }
    // Rule 2: 2x2 blocks of same color.
    for (y = 0; y < size - 1; y++) {
      for (x = 0; x < size - 1; x++) {
        var c = modules[y][x];
        if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) {
          penalty += 3;
        }
      }
    }
    // Rule 3: finder-like patterns 10111010000 / 00001011101 in rows and columns.
    function patAt(line, i) {
      // check 11-bit window starting at i against both patterns
      var p1 = [1,0,1,1,1,0,1,0,0,0,0];
      var p2 = [0,0,0,0,1,0,1,1,1,0,1];
      var m1 = true, m2 = true;
      for (var k = 0; k < 11; k++) {
        if (line[i + k] !== p1[k]) m1 = false;
        if (line[i + k] !== p2[k]) m2 = false;
      }
      return m1 || m2;
    }
    for (y = 0; y < size; y++) {
      for (x = 0; x + 11 <= size; x++) if (patAt(modules[y], x)) penalty += 40;
    }
    var col = new Array(size);
    for (x = 0; x < size; x++) {
      for (y = 0; y < size; y++) col[y] = modules[y][x];
      for (y = 0; y + 11 <= size; y++) if (patAt(col, y)) penalty += 40;
    }
    // Rule 4: dark-module ratio deviation from 50%.
    var dark = 0;
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) dark += modules[y][x];
    var total = size * size;
    var k = Math.floor(Math.abs(dark * 20 - total * 10) / total);
    penalty += k * 10;
    return penalty;
  }

  // ------------------------------------------------------- Matrix build
  function newMatrix(size) {
    var modules = new Array(size);
    var isFunc = new Array(size);
    for (var y = 0; y < size; y++) {
      modules[y] = new Array(size);
      isFunc[y] = new Array(size);
      for (var x = 0; x < size; x++) { modules[y][x] = 0; isFunc[y][x] = false; }
    }
    return { modules: modules, isFunc: isFunc };
  }

  function drawFunctionPatterns(version, g) {
    var size = g.modules.length;
    var modules = g.modules, isFunc = g.isFunc;
    function set(r, c, val) {
      modules[r][c] = val ? 1 : 0;
      isFunc[r][c] = true;
    }
    // Finder patterns (with separator ring) at three corners.
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var dist = Math.max(Math.abs(dx), Math.abs(dy));
          var xx = cx + dx, yy = cy + dy;
          if (0 <= xx && xx < size && 0 <= yy && yy < size) {
            set(yy, xx, dist !== 2 && dist !== 4);
          }
        }
      }
    }
    finder(3, 3);
    finder(size - 4, 3);
    finder(3, size - 4);
    // Timing patterns (skip cells already claimed by finders).
    for (var i = 0; i < size; i++) {
      if (!isFunc[6][i]) set(6, i, i % 2 === 0);
      if (!isFunc[i][6]) set(i, 6, i % 2 === 0);
    }
    // Alignment patterns.
    var pos = ALIGN_POS[version];
    for (var a = 0; a < pos.length; a++) {
      for (var b = 0; b < pos.length; b++) {
        var cx = pos[a], cy = pos[b];
        // Skip positions overlapping the finder patterns.
        if ((a === 0 && b === 0) ||
            (a === 0 && b === pos.length - 1) ||
            (a === pos.length - 1 && b === 0)) continue;
        for (var dy = -2; dy <= 2; dy++) {
          for (var dx = -2; dx <= 2; dx++) {
            set(cy + dy, cx + dx, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }
    // Dark module: fixed at (size-8, 8) = (4*version+9, 8). It is a function
    // module (never masked, never data). It stays light while masks are
    // scored and is set dark on the final matrix afterwards.
    set(size - 8, 8, false);
    // Reserve format-info areas (values are drawn after mask selection).
    // Cell layout mirrors the de-facto reference implementation bit-for-bit:
    // first copy = column 8 rows 0-5,7,8 plus row 8 cols 7,5,4,3,2,1,0;
    // second copy = column 8 rows size-7..size-1 plus row 8 cols size-1..size-8.
    // The dark module sits alone at (size-8, 8), just above the second copy's
    // vertical strip.
    function reserve(r, c) { isFunc[r][c] = true; }
    for (var k = 0; k <= 5; k++) reserve(k, 8);
    reserve(7, 8); reserve(8, 8);
    reserve(8, 7);
    for (k = 0; k <= 5; k++) reserve(8, k);
    for (k = 0; k < 7; k++) reserve(size - 7 + k, 8);
    for (k = 0; k < 8; k++) reserve(8, size - 1 - k);
    // Reserve version-info areas (versions 7+).
    if (version >= 7) {
      for (var r = 0; r < 6; r++) {
        for (var c = size - 11; c < size - 8; c++) isFunc[r][c] = true;
      }
      for (r = size - 11; r < size - 8; r++) {
        for (c = 0; c < 6; c++) isFunc[r][c] = true;
      }
    }
  }

  function drawFormatBits(g, level, mask, size) {
    var F = formatBits(level, mask);
    function bit(i) { return (F >>> i) & 1; }
    function set(r, c, v) { g.modules[r][c] = v; }
    // First copy (top-left).
    for (var i = 0; i <= 5; i++) set(i, 8, bit(i));
    set(7, 8, bit(6));
    set(8, 8, bit(7));
    set(8, 7, bit(8));
    for (i = 9; i < 15; i++) set(8, 14 - i, bit(i));
    // Second copy: column 8 rows size-7..size-1, then row 8 cols size-1..size-8.
    for (i = 0; i < 7; i++) set(size - 7 + i, 8, bit(i + 8));
    for (i = 0; i < 8; i++) set(8, size - 1 - i, bit(i));
  }

  function drawVersionBits(g, version, size) {
    if (version < 7) return;
    var V = versionBits(version);
    for (var i = 0; i < 18; i++) {
      var b = (V >>> i) & 1;
      var a = size - 11 + (i % 3);
      var c = Math.floor(i / 3);
      g.modules[c][a] = b; // top-right copy
      g.modules[a][c] = b; // bottom-left copy
    }
  }

  // ------------------------------------------------------- Data codewords
  function buildDataCodewords(bytes, version, level) {
    var countBits = version <= 9 ? 8 : 16;
    var capacity = dataCodewordsCount(version, level);
    var bb = new BitBuffer();
    bb.put(4, 4); // byte mode indicator 0100
    bb.put(bytes.length, countBits);
    for (var i = 0; i < bytes.length; i++) bb.put(bytes[i], 8);
    var capBits = capacity * 8;
    // Terminator: up to 4 zero bits.
    var term = Math.min(4, capBits - bb.length());
    for (i = 0; i < term; i++) bb.bits.push(0);
    // Pad to a byte boundary.
    while (bb.length() % 8 !== 0) bb.bits.push(0);
    // Pad bytes 0xEC, 0x11 alternating.
    var codewords = [];
    for (i = 0; i < bb.length(); i += 8) {
      var w = 0;
      for (var k = 0; k < 8; k++) w = (w << 1) | bb.bits[i + k];
      codewords.push(w);
    }
    var pad = 0xec;
    while (codewords.length < capacity) {
      codewords.push(pad);
      pad = pad === 0xec ? 0x11 : 0xec;
    }
    return codewords;
  }

  function interleaveBlocks(dataCodewords, version, level) {
    var e = EC_TABLE[version][level];
    var ecPerBlock = e[0];
    var blocks = [];
    var off = 0;
    var n;
    for (n = 0; n < e[1]; n++) { blocks.push(dataCodewords.slice(off, off + e[2])); off += e[2]; }
    for (n = 0; n < e[3]; n++) { blocks.push(dataCodewords.slice(off, off + e[4])); off += e[4]; }
    var maxData = Math.max(e[2], e[4]);
    var out = [];
    var i, b;
    for (i = 0; i < maxData; i++) {
      for (b = 0; b < blocks.length; b++) {
        if (i < blocks[b].length) out.push(blocks[b][i]);
      }
    }
    var ecBlocks = [];
    for (b = 0; b < blocks.length; b++) ecBlocks.push(rsEncode(blocks[b], ecPerBlock));
    for (i = 0; i < ecPerBlock; i++) {
      for (b = 0; b < ecBlocks.length; b++) out.push(ecBlocks[b][i]);
    }
    return out;
  }

  function placeDataBits(g, codewords) {
    var size = g.modules.length;
    var modules = g.modules, isFunc = g.isFunc;
    var bits = [];
    for (var i = 0; i < codewords.length; i++) {
      for (var k = 7; k >= 0; k--) bits.push((codewords[i] >>> k) & 1);
    }
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // skip vertical timing column
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!isFunc[y][x]) {
            // Data bits first; any leftover non-function cells are the
            // standard's remainder bits, always light (0).
            modules[y][x] = idx < bits.length ? bits[idx++] : 0;
          }
        }
      }
    }
    if (idx !== bits.length) throw new Error('qrforge: placement left ' + (bits.length - idx) + ' bits unplaced');
  }

  function applyMask(g, mask) {
    var size = g.modules.length;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        if (!g.isFunc[y][x] && maskCondition(mask, y, x)) g.modules[y][x] ^= 1;
      }
    }
  }

  // ------------------------------------------------------- Public: encode
  // text: string to encode (UTF-8, byte mode).
  // level: 'L' | 'M' | 'Q' | 'H' (default 'M').
  // Returns { text, bytes, version, level, mask, size, modules }.
  function encode(text, level) {
    level = level || 'M';
    if (EC_LEVELS.indexOf(level) < 0) throw new Error('qrforge: bad EC level ' + level);
    var bytes = utf8Bytes(String(text));
    if (bytes.length === 0) throw new Error('qrforge: nothing to encode (empty input)');
    var version = 0;
    for (var v = 1; v <= 20; v++) {
      if (bytes.length <= byteCapacity(v, level)) { version = v; break; }
    }
    if (version === 0) {
      throw new Error('qrforge: input too long (' + bytes.length +
        ' bytes; max ' + byteCapacity(20, level) + ' at EC level ' + level + ')');
    }
    var size = 17 + 4 * version;
    var dataCodewords = buildDataCodewords(bytes, version, level);
    var finalCodewords = interleaveBlocks(dataCodewords, version, level);
    var g = newMatrix(size);
    drawFunctionPatterns(version, g);
    placeDataBits(g, finalCodewords);
    // Try all 8 masks, keep the lowest-penalty one.
    var bestMask = 0, bestPenalty = Infinity, bestModules = null;
    for (var m = 0; m < 8; m++) {
      var trial = newMatrix(size);
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          trial.modules[y][x] = g.modules[y][x];
          trial.isFunc[y][x] = g.isFunc[y][x];
        }
      }
      applyMask(trial, m);
      var p = maskPenalty(trial.modules);
      if (p < bestPenalty) { bestPenalty = p; bestMask = m; bestModules = trial.modules; }
    }
    g.modules = bestModules;
    // Set the dark module dark on the final matrix (kept light during scoring).
    g.modules[size - 8][8] = 1;
    drawFormatBits(g, level, bestMask, size);
    drawVersionBits(g, version, size);
    return {
      text: String(text), bytes: bytes, version: version, level: level,
      mask: bestMask, size: size, modules: g.modules,
      dataCodewords: finalCodewords.length
    };
  }

  // ------------------------------------------------------- SVG rendering
  function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
  }
  // opts: { scale (px per module), margin (modules), dark, light, title }
  function toSVG(result, opts) {
    opts = opts || {};
    var scale = opts.scale || 8;
    // Accept fg/bg/quiet (UI wording) as well as dark/light/margin (legacy).
    var margin = opts.quiet != null ? opts.quiet : (opts.margin == null ? 4 : opts.margin);
    var dark = opts.fg || opts.dark || '#000000';
    var light = opts.bg || opts.light || '#ffffff';
    var size = result.size;
    var total = size + margin * 2;
    var path = '';
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        if (result.modules[y][x]) {
          path += 'M' + (x + margin) + ' ' + (y + margin) + 'h1v1h-1z';
        }
      }
    }
    var title = opts.title ? '<title>' + escapeXml(opts.title) + '</title>' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" ' +
      'width="' + total * scale + '" height="' + total * scale + '" ' +
      'viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges">' +
      title +
      '<rect width="' + total + '" height="' + total + '" fill="' + light + '"/>' +
      '<path d="' + path + '" fill="' + dark + '"/>' +
      '</svg>';
  }

  // ------------------------------------------------------- Payload builders
  function escapeWifiField(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;')
                    .replace(/,/g, '\\,').replace(/:/g, '\\:');
  }
  // security: 'WPA' | 'WEP' | 'nopass'
  function buildWifi(ssid, security, password, hidden) {
    var s = 'WIFI:T:' + security + ';S:' + escapeWifiField(ssid) + ';';
    if (security !== 'nopass' && password) s += 'P:' + escapeWifiField(password) + ';';
    if (hidden) s += 'H:true;';
    return s + ';';
  }

  function escapeVCard(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n')
                    .replace(/;/g, '\\;').replace(/,/g, '\\,');
  }
  function buildVCard(fields) {
    fields = fields || {};
    var lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    if (fields.name) lines.push('FN:' + escapeVCard(fields.name));
    if (fields.org) lines.push('ORG:' + escapeVCard(fields.org));
    if (fields.phone) lines.push('TEL:' + escapeVCard(fields.phone));
    if (fields.email) lines.push('EMAIL:' + escapeVCard(fields.email));
    if (fields.url) lines.push('URL:' + escapeVCard(fields.url));
    if (fields.note) lines.push('NOTE:' + escapeVCard(fields.note));
    lines.push('END:VCARD');
    return lines.join('\n');
  }

  function buildEmail(to, subject, body) {
    var s = 'mailto:' + String(to || '').trim();
    var q = [];
    if (subject) q.push('subject=' + encodeURIComponent(subject));
    if (body) q.push('body=' + encodeURIComponent(body));
    if (q.length) s += '?' + q.join('&');
    return s;
  }

  // ------------------------------------------------------- Public API
  return {
    encode: encode,
    toSVG: toSVG,
    buildWifi: buildWifi,
    buildVCard: buildVCard,
    buildEmail: buildEmail,
    byteCapacity: byteCapacity,
    EC_LEVELS: EC_LEVELS.slice(),
    MAX_VERSION: 20,
    // Internals exposed for testing (not part of the app contract).
    _gfMul: gfMul,
    _rsEncode: rsEncode,
    _rsGeneratorPoly: rsGeneratorPoly,
    _formatBits: formatBits,
    _versionBits: versionBits,
    _ecTable: EC_TABLE,
    _totalCodewords: TOTAL_CODEWORDS,
    _alignPos: ALIGN_POS,
    _utf8Bytes: utf8Bytes
  };
});
