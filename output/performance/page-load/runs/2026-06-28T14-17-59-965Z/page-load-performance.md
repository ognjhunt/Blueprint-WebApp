# Page Load Performance

- Status: PASS
- Started at: 2026-06-28T14:17:59.966Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 10000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 108
- Routes over budget: 0

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /updates | /updates | 200 | 30.7 ms | 30.7 ms | 27 ms | 13 ms | 33.6, 26.2, 30.7 |
| /exact-site-hosted-review | /exact-site-hosted-review | 200 | 26 ms | 26 ms | 19.5 ms | 12.2 ms | 19.3, 26, 35.5 |
| /careers | /careers | 200 | 25.5 ms | 25.5 ms | 21.9 ms | 10.9 ms | 25.5, 28.5, 22.2 |
| /how-it-works | /how-it-works | 200 | 22.6 ms | 22.6 ms | 22.5 ms | 8.7 ms | 22.6, 21.8, 27.7 |
| /blog | /blog | 200 | 22.3 ms | 22.3 ms | 22 ms | 11.6 ms | 21.3, 22.3, 27.9 |
| /qualified-opportunities | /qualified-opportunities | 200 | 22.1 ms | 22.1 ms | 18.9 ms | 12.1 ms | 22.1, 29.3, 17.8 |
| /solutions | /solutions | 200 | 22 ms | 22 ms | 19.5 ms | 8.2 ms | 18.7, 22, 22.6 |
| /login | /login | 200 | 22 ms | 22 ms | 18.6 ms | 8.4 ms | 23.7, 20, 22 |
| /marketplace | /marketplace | 200 | 21.8 ms | 21.8 ms | 17.8 ms | 7.3 ms | 20.3, 21.8, 24.4 |
| /privacy | /privacy | 200 | 21.5 ms | 21.5 ms | 17.4 ms | 8.8 ms | 21.5, 16.6, 21.9 |
| /partners | /partners | 200 | 21.1 ms | 21.1 ms | 20.9 ms | 8.4 ms | 21.1, 18.3, 28.9 |
| /admin/growth-ops-scorecard | /admin/growth-ops-scorecard | 200 | 20.9 ms | 20.9 ms | 13.8 ms | 6.8 ms | 27, 16.8, 20.9 |
