# Page Load Performance

- Status: FAIL
- Started at: 2026-06-20T06:34:06.343Z
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
| /capture-app/launch-access | /capture-app/launch-access | 200 | 66.1 ms | 66.1 ms | 15.8 ms | 7.5 ms | 66.1, 47.5, 75.2 |
| /site-worlds/:slug | /site-worlds/sw-chi-01 | 200 | 42.3 ms | 42.3 ms | 20.3 ms | 10 ms | 42.3, 51.5, 34.8 |
| /for-robot-teams | /for-robot-teams | 200 | 41.6 ms | 41.6 ms | 20.8 ms | 7 ms | 28.9, 45.8, 41.6 |
| /blog | /blog | 200 | 40.4 ms | 40.4 ms | 23.5 ms | 16.2 ms | 54.7, 40.4, 27.1 |
| /world-models/:slug | /world-models/sw-chi-01 | 200 | 38.7 ms | 38.7 ms | 17 ms | 9.5 ms | 38.7, 40.5, 36.3 |
| /sites/:slug | /sites/sw-chi-01 | 200 | 37.6 ms | 37.6 ms | 16.9 ms | 4.8 ms | 39.8, 37.6, 36.4 |
| /product | /product | 200 | 36.9 ms | 36.9 ms | 16.5 ms | 9.5 ms | 51.1, 32.1, 36.9 |
| /terms | /terms | 200 | 36.7 ms | 36.7 ms | 21.8 ms | 6.3 ms | 33.3, 37, 36.7 |
| /robot-team/eval | /robot-team/eval | 200 | 36.4 ms | 36.4 ms | 18.9 ms | 7.7 ms | 36.4, 35.3, 42.5 |
| / | / | 200 | 35.5 ms | 35.5 ms | 12.9 ms | 6 ms | 21.3, 35.5, 40.5 |
| /admin/growth-ops-scorecard | /admin/growth-ops-scorecard | 200 | 35.1 ms | 35.1 ms | 12.2 ms | 5.4 ms | 38.2, 25.6, 35.1 |
| /for-robot-integrators | /for-robot-integrators | 200 | 33.7 ms | 33.7 ms | 15.7 ms | 8.2 ms | 33.7, 26.9, 38.3 |

## Over Budget

- /capture-app/launch-access via /capture-app/launch-access: 66.1 ms
