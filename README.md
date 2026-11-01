# QRForge — Private, Offline QR Code Generator

Generate **static** QR codes entirely in your browser. No uploads, no signup, no
tracking, no expiry, no watermarks. Free forever.

## What it is

A single-page, zero-dependency web app:

- `index.html` — the UI
- `styles.css` — styling
- `app.js` — UI logic (payload builders, preview, downloads)
- `qrcode.js` — original, dependency-free QR encoder (byte mode, versions 1–20,
  EC levels L/M/Q/H, SVG export)
- `test/run-tests.js` — Node test suite (differential tests against a reference
  implementation, run at build time only — not shipped to users)

## How to use

1. Open `index.html` in any modern browser — double-click it, or serve the folder
   with any static server. It works from `file://` with no build step.
2. Pick a type (URL/Text, Wi-Fi, Contact, Email), fill in the fields.
3. The code previews live. Adjust error-correction level and colors.
4. Download **SVG** (best for print) or **PNG** (quick digital use).
5. **Scan-test with your phone before mass printing.**

## Key facts

- **Static codes.** Your text is encoded directly into the pattern. There is no
  redirect server, so codes cannot expire or be deactivated. (The destination URL
  itself can still change or break — that's true of any QR code.)
- **Private.** Everything runs locally. The page makes zero network requests.
  Wi-Fi passwords and contact details never leave the device.
- **Honest limits.** Byte-mode QR, versions 1–20. Very long payloads are rejected
  with a clear message instead of silently producing an unscannable code.
- **Print-safe defaults.** 4-module quiet zone, contrast warnings, and a
  scan-before-printing reminder.

## Tests

```sh
node test/run-tests.js
```

27 tests, including 32 full-matrix differential cases against a reference QR
library (4 EC levels × 8 payloads). All passing.

## Not included (on purpose)

No dynamic/tracked codes, no analytics, no accounts, no logo embedding, no
version 21–40 support. Those are either against the privacy premise or add
complexity without user benefit.
