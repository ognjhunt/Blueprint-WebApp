# Page Load Performance

- Status: PASS
- Started at: 2026-06-20T06:38:28.174Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 5000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 92
- Routes over budget: 0

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /site-worlds/:slug | /site-worlds/sw-chi-01 | 200 | 48.4 ms | 48.4 ms | 19.4 ms | 6.8 ms | 62.5, 48.4, 35.8 |
| /capturer | /capturer | 200 | 39.6 ms | 39.6 ms | 21.3 ms | 9.2 ms | 39.6, 31.2, 42.7 |
| /settings | /settings | 200 | 33.6 ms | 33.6 ms | 12.5 ms | 4.6 ms | 33.6, 35, 25.1 |
| /terms | /terms | 200 | 32 ms | 32 ms | 12.9 ms | 4.1 ms | 41.4, 21.1, 32 |
| /quality-standard | /quality-standard | 200 | 30.6 ms | 30.6 ms | 18.1 ms | 8.7 ms | 26.5, 45.2, 30.6 |
| /updates | /updates | 200 | 29.9 ms | 29.9 ms | 14.4 ms | 8.2 ms | 29.9, 20.8, 50.6 |
| /exact-site-hosted-review | /exact-site-hosted-review | 200 | 28.8 ms | 28.8 ms | 17 ms | 8.3 ms | 26.2, 28.8, 30.6 |
| /readiness | /readiness | 200 | 28.3 ms | 28.3 ms | 14.4 ms | 7 ms | 28.3, 25, 29.5 |
| /world-models/:slug | /world-models/sw-chi-01 | 200 | 28.2 ms | 28.2 ms | 14.1 ms | 6.3 ms | 28.2, 27.7, 30.3 |
| /site-worlds | /site-worlds | 200 | 27.9 ms | 27.9 ms | 17.5 ms | 7.5 ms | 27.9, 27.9, 24.1 |
| /solutions | /solutions | 200 | 27.9 ms | 27.9 ms | 17.2 ms | 8.5 ms | 26.1, 27.9, 28.7 |
| /privacy | /privacy | 200 | 27.8 ms | 27.8 ms | 11.9 ms | 4.6 ms | 30.3, 27.8, 26.4 |
