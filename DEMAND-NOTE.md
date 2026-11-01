# Demand note — QRForge (micro-tool #2)

Researched 2026-09-29. All figures below are third-party estimates or vendor-published
prices, cited per claim. Keyword volumes are directional, not precise.

## The complaint pattern

Across blogs, dev posts, and review sites, the same grievances repeat about "free"
QR generators:

1. **Bait-and-switch to paid dynamic codes.** The free code is dynamic (a redirect
   through the vendor's server). After a trial or plan change, the redirect dies and
   printed materials break. A Trustpilot review of get-qr.com discusses a £39.99 charge
   following a seven-day period; QRCodeStack's own FAQ confirms dynamic codes "stop
   redirecting" if you cancel.
   - https://www.trustpilot.com/review/get-qr.com
   - https://qrcodestack.com/dynamic-qr-code-generator
2. **Paywalled basics.** Watermarks, signup requirements, scan limits, customization
   paywalls, and expiring trials on features (SVG export, analytics) that cost the
   vendor nothing per use.
   - https://dev.to/progressiveprogrammer/free-qr-code-generators-are-no-more-free-186k
   - https://medium.com/@RahaLuneQRStudio/the-hidden-cost-of-free-qr-code-generators-and-why-privacy-first-tools-are-the-future-04294b4957ba
3. **Privacy.** People paste Wi-Fi passwords, vCards, and private URLs into a
   stranger's web form and hope for the best.
   - https://github.com/gamifiedstudio/qr-gamified.studio/blob/HEAD/src/content/blog/free-qr-code-generator.mdx
   - https://github.com/open-qr/openqr/blob/HEAD/README.md

## What incumbents charge (published prices, Sep 2026)

| Vendor | Entry / free tier | Paid |
|---|---|---|
| QR Code Generator (qr-code-generator.com) | 14-day trial; codes deactivated after | from ~$5/mo (2 codes), ~$15/mo mid-tier |
| QR TIGER | free: unlimited static, 3 dynamic, 500 scans/code | from $5.40/mo ($65/yr); $16/mo Advanced |
| QRCode Monkey | free unlimited static QR | dynamic/analytics via sister product from ~$5–7/mo |
| QRStuff | free: 5 static, 10 dynamic (30-day expiry) | $10/mo Lite, $25/mo Full |
| Canva | built-in QR is URL-only; no SVG export or logo on free | Pro $12.99/mo adds SVG/logo/dynamic; scan analytics gated to Business ($25/user/mo) |
| TinyPNG/Tinify (runner-up reference) | web: 20 images/session, 5 MB max; API: 500 free/mo | web Pro $39/yr; API $0.009/compression after free tier |

Sources: https://www.mobiqode.com/blog/qr-code-generator-pro-review/ ·
https://www.saasworthy.com/product/qrtiger/pricing ·
https://www.saasworthy.com/product/qr-code-monkey-tool/pricing ·
https://www.qrstuff.com/pricing ·
https://quickresponsecode.com/resources/canva-qr-code-generator/ ·
https://useqrkit.com/canva-qr-code ·
https://tinify.com/blog/tinify-api-pricing-explained

## Search interest (directional third-party estimates)

- "qr code generator": ~500k–1M monthly searches (KD 80+); "free qr code generator":
  ~135k–500k; "wifi qr code": ~30k–60k (KD ~45 — softer).
  - https://github.com/supernovae-st/novanet/blob/HEAD/docs/research/seo-qr-code-2026.md
  - https://github.com/mykpono/qr-code-agent/blob/HEAD/docs/keyword-validation-report.md
  - https://github.com/angelokarera/smarttips/blob/HEAD/TARGET_KEYWORDS_GUIDE.md
- "image compressor" (runner-up): ~50k–300k/month depending on source, KD medium–high,
  dominated by TinyPNG/Squoosh.
  - https://github.com/angelokarera/smarttips/blob/HEAD/TARGET_KEYWORDS_GUIDE.md
  - https://github.com/basfenix/selfsteeringralph/blob/HEAD/research/seo-channel-analysis.md

## Why QRForge won over the image compressor

The compressor had real demand too (TinyPNG's 5 MB/session caps frustrate users),
but strong free client-side competitors already exist (Squoosh, nosend, Slingsite,
ImgIng, Asset Melt). The QR space has free static tools (QRCode Monkey), but the
trust/privacy wedge — *offline, static-only, no upsell, no account, SVG for print* —
is a coherent, defensible position against the subscription-fatigue complaints above.

## Honest caveats

- This is a **crowded** category. QRForge's differentiation is trust and privacy, not
  novel technology. Ranking for head terms ("qr code generator", KD 80+) against
  incumbents is unrealistic without a large SEO investment.
- Realistic acquisition paths: long-tail ("wifi qr code generator", KD ~34),
  word-of-mouth among privacy-conscious users, bundling with other offline utilities.
- **Revenue is unproven.** The product is free with no monetization built in. Any
  future monetization (donations, a Pro tier with logo embedding, etc.) is speculative
  and would need its own validation. Do not promise income from this tool.
