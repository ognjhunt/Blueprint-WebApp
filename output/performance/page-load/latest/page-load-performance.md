# Page Load Performance

- Status: PASS
- Started at: 2026-06-28T14:21:50.472Z
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
| /site-worlds/:slug/workspace | /site-worlds/sw-chi-01/workspace | 200 | 35 ms | 35 ms | 26.5 ms | 18.5 ms | 46.9, 19.8, 35 |
| /marketplace | /marketplace | 200 | 31.6 ms | 31.6 ms | 23.7 ms | 11.6 ms | 23.8, 93.1, 31.6 |
| /product | /product | 200 | 29.5 ms | 29.5 ms | 19.2 ms | 11.3 ms | 29.5, 34.2, 20.9 |
| /for-capturers | /for-capturers | 200 | 28.6 ms | 28.6 ms | 24.1 ms | 9.5 ms | 24.2, 28.6, 47 |
| /blog | /blog | 200 | 28.3 ms | 28.3 ms | 28 ms | 13.4 ms | 20.8, 41.4, 28.3 |
| /earn | /earn | 200 | 26.5 ms | 26.5 ms | 19.9 ms | 10.1 ms | 26.5, 27.8, 26.4 |
| /world-models/:slug | /world-models/sw-chi-01 | 200 | 24.4 ms | 24.4 ms | 18.7 ms | 8.3 ms | 38.5, 24.4, 17.1 |
| /capture-jobs | /capture-jobs | 200 | 23.9 ms | 23.9 ms | 17.6 ms | 6.6 ms | 26.7, 23.9, 20.3 |
| /world-models | /world-models | 200 | 23.4 ms | 23.4 ms | 19.4 ms | 9.8 ms | 21, 23.4, 24.4 |
| /capture | /capture | 200 | 23.2 ms | 23.2 ms | 16.1 ms | 7.6 ms | 25.2, 23.2, 22.3 |
| /book-exact-site-review | /book-exact-site-review | 200 | 23.2 ms | 23.2 ms | 23 ms | 9.1 ms | 23.2, 27.8, 16.9 |
| /quality-standard | /quality-standard | 200 | 23.2 ms | 23.2 ms | 21.5 ms | 8.5 ms | 21.6, 27.7, 23.2 |
