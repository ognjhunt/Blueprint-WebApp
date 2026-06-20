# Page Load Performance

- Status: FAIL
- Started at: 2026-06-20T06:35:40.294Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 5000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 92
- Routes over budget: 1

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /robot-team/eval | /robot-team/eval | 200 | 75.8 ms | 75.8 ms | 16.7 ms | 8.6 ms | 27.1, 75.8, 86.6 |
| /site-worlds/:slug | /site-worlds/sw-chi-01 | 200 | 46.6 ms | 46.6 ms | 24.5 ms | 12.7 ms | 37.3, 56.6, 46.6 |
| /terms | /terms | 200 | 43.4 ms | 43.4 ms | 13.1 ms | 5.4 ms | 65.8, 43.4, 31.6 |
| /launch-map | /launch-map | 200 | 41.3 ms | 41.3 ms | 27.5 ms | 19.6 ms | 35.6, 41.3, 45.7 |
| /world-models/:slug | /world-models/sw-chi-01 | 200 | 41.1 ms | 41.1 ms | 19.4 ms | 11.7 ms | 39.4, 63.1, 41.1 |
| /product | /product | 200 | 41 ms | 41 ms | 18.9 ms | 9.4 ms | 33.4, 41, 52.8 |
| /readiness | /readiness | 200 | 35.9 ms | 35.9 ms | 19.4 ms | 10.4 ms | 35.9, 45.8, 34.2 |
| /sites/:slug | /sites/sw-chi-01 | 200 | 35.8 ms | 35.8 ms | 15.2 ms | 5.2 ms | 28.7, 44.9, 35.8 |
| /requests/:requestId/preview | /requests/perf-request/preview | 200 | 33 ms | 33 ms | 12.3 ms | 4.2 ms | 38.5, 33, 33 |
| /exact-site-hosted-review | /exact-site-hosted-review | 200 | 32.5 ms | 32.5 ms | 17.6 ms | 7.8 ms | 38.6, 32.5, 27.1 |
| /site-worlds/:slug/workspace | /site-worlds/sw-chi-01/workspace | 200 | 32.4 ms | 32.4 ms | 17.1 ms | 8.6 ms | 41.2, 32.4, 30.1 |
| /admin/growth-studio | /admin/growth-studio | 200 | 32 ms | 32 ms | 13.1 ms | 4.2 ms | 23.4, 37.5, 32 |

## Over Budget

- /robot-team/eval via /robot-team/eval: 75.8 ms
