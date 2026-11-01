# Build log — QRForge

## 2026-09-29 — research & selection
- Researched 7 micro-tool candidates via public-web searches (complaint threads,
  pricing pages, SEO estimates).
- Killed: password generator (saturated), word counter (table stakes), color
  contrast checker (well covered), tip calculator / pomodoro / unit converter
  (not deeply researched; first five gave a ranking).
- Runner-up: image compressor (TinyPNG caps are a real pain point) — killed as
  winner because Squoosh, nosend, Slingsite, ImgIng, Asset Melt already serve the
  free client-side slot well.
- Winner: offline static QR generator — subscription-fatigue + privacy complaints
  form a coherent trust wedge. See DEMAND-NOTE.md.

## 2026-09-29 — engine (qrcode.js)
- Wrote original QR encoder from the standard: byte mode (UTF-8), versions 1–20,
  EC levels L/M/Q/H, GF(256) + Reed–Solomon, 8 masks with penalty scoring, format
  + version info, SVG export, Wi-Fi/vCard/email payload helpers.
- Set up differential testing against Python's `qrcode` package (build-time oracle
  only; never shipped). 32 cases: 4 EC levels × 8 payloads.
- Bugs found and fixed via the oracle:
  - v20 EC-table entries for L and M were wrong → corrected.
  - v10-M byte capacity expectation (213) corrected in tests.
  - Reed–Solomon generator polynomial orientation was flipped
    (`next[j+1] ^= gfMul(poly[j], EXP_TABLE[i])` was backwards) — after fix,
    final codewords matched the oracle byte-for-byte.
  - **Dark module**: initially removed on a wrong theory; the reference proved
    `(4V+9, 8)` is always dark. Restored as a function module.
  - **Mask-scoring subtlety**: the reference scores candidates with the dark
    module *light* and darkens it after selection. Matched that ordering.
  - Mask-penalty rule implementations verified rule-by-rule against the oracle's
    `lost_point` (N1/N2/N3/N4 matched on the same matrix).
- Test-helper fix: generator-polynomial assertions now use deep comparison.
- Result: **27/27 tests pass**, including all 32 full-matrix differential cases
  (bit-for-bit equality with the reference library).

## 2026-09-29 — UI (index.html, styles.css, app.js)
- Tabs: URL/Text (auto-prepends https:// for bare domains), Wi-Fi
  (SSID/password/security/hidden, proper escaping), Contact (vCard 3.0), Email
  (mailto with subject/body).
- Live SVG preview, EC-level selector, foreground/background pickers with
  WCAG-style contrast warnings, fixed 4-module quiet zone.
- SVG download (print) and PNG download (canvas, client-side only).
- Copy-payload and clear/reset. Truthful capacity errors (v20 byte limits).
- Trust badges (static / no expiry / private / no signup / no upload) and a
  scan-before-printing warning.

## Verification
- `node test/run-tests.js` → 27 passed, 0 failed.
- Served locally; index.html + all assets return HTTP 200.
- Direct `file://` open confirmed working (no modules, no fetch, no build).
- Real desktop/mobile browser QA: delegated to parent/root (subagent has no
  live-browser navigation).

## Spend
$0. No money spent. No paid services used.
