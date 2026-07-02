# Page Load Performance

- Status: PASS
- Started at: 2026-06-28T14:18:26.615Z
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
| /product | /product | 200 | 36.2 ms | 36.2 ms | 32.2 ms | 21.8 ms | 36.2, 33.8, 39.9 |
| /for-site-operators | /for-site-operators | 200 | 34.4 ms | 34.4 ms | 26.8 ms | 12.7 ms | 27, 34.4, 39.4 |
| /for-robot-integrators | /for-robot-integrators | 200 | 34.3 ms | 34.3 ms | 23.2 ms | 7.4 ms | 23, 42.4, 34.3 |
| (404 fallback) | /__blueprint-performance-fallback__ | 200 | 34.2 ms | 34.2 ms | 22.5 ms | 13.8 ms | 34.2, 22.8, 35.7 |
| /site-worlds/:slug | /site-worlds/sw-chi-01 | 200 | 33.7 ms | 33.7 ms | 30.1 ms | 16.6 ms | 33.7, 20.3, 35 |
| /world-models | /world-models | 200 | 32.5 ms | 32.5 ms | 28.7 ms | 20.7 ms | 24.5, 32.5, 40.3 |
| /capturers | /capturers | 200 | 31.7 ms | 31.7 ms | 22.8 ms | 7.1 ms | 23, 31.7, 43.9 |
| /solutions | /solutions | 200 | 31.6 ms | 31.6 ms | 28.1 ms | 18.8 ms | 26.1, 32.2, 31.6 |
| /ops/spend | /ops/spend | 200 | 28.8 ms | 28.8 ms | 25.3 ms | 14.9 ms | 19.4, 28.8, 33.4 |
| /docs | /docs | 200 | 28.6 ms | 28.6 ms | 17.9 ms | 11.7 ms | 20.1, 60.3, 28.6 |
| /capturer | /capturer | 200 | 27 ms | 27 ms | 20 ms | 9.6 ms | 27, 24.6, 27.9 |
| /earn | /earn | 200 | 27 ms | 27 ms | 24.4 ms | 8.7 ms | 25.8, 27, 32.9 |
