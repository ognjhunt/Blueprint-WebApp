# Page Load Performance

- Status: FAIL
- Started at: 2026-06-20T06:27:02.991Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 5000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 92
- Routes over budget: 2

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /world-models/:slug | /world-models/sw-chi-01 | 200 | 76.8 ms | 76.8 ms | 24.7 ms | 10.8 ms | 76.8, 119.1, 65.6 |
| /for-robot-integrators | /for-robot-integrators | 200 | 60.1 ms | 60.1 ms | 18.7 ms | 10.5 ms | 60.1, 29, 62.5 |
| /for-robot-teams | /for-robot-teams | 200 | 48.8 ms | 48.8 ms | 13.5 ms | 5.8 ms | 48.8, 23.8, 57.7 |
| /privacy | /privacy | 200 | 44.2 ms | 44.2 ms | 23 ms | 5.1 ms | 34.6, 53.6, 44.2 |
| /qualified-opportunities | /qualified-opportunities | 200 | 43.4 ms | 43.4 ms | 36.1 ms | 28.8 ms | 71.1, 36.5, 43.4 |
| /site-worlds/:slug | /site-worlds/sw-chi-01 | 200 | 42.2 ms | 42.2 ms | 18.6 ms | 9.6 ms | 42.2, 41.4, 57.3 |
| /sites/:slug | /sites/sw-chi-01 | 200 | 41 ms | 41 ms | 22.1 ms | 6.8 ms | 62.5, 41, 34.7 |
| /quality-standard | /quality-standard | 200 | 40.5 ms | 40.5 ms | 21.1 ms | 9.4 ms | 40.5, 28.2, 57 |
| /about | /about | 200 | 38.8 ms | 38.8 ms | 16.8 ms | 9.6 ms | 45.5, 38.8, 31.9 |
| /blog | /blog | 200 | 38.5 ms | 38.5 ms | 18 ms | 10.4 ms | 33.2, 38.5, 45.8 |
| /product | /product | 200 | 36.3 ms | 36.3 ms | 16.4 ms | 8.5 ms | 37.2, 36.3, 32.9 |
| /site-worlds/:slug/workspace | /site-worlds/sw-chi-01/workspace | 200 | 35.9 ms | 35.9 ms | 20.6 ms | 10.9 ms | 33.8, 35.9, 36 |

## Over Budget

- /world-models/:slug via /world-models/sw-chi-01: 76.8 ms
- /for-robot-integrators via /for-robot-integrators: 60.1 ms
