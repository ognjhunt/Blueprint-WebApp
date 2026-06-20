# Page Load Performance

- Status: FAIL
- Started at: 2026-06-20T06:31:02.436Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 5000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 92
- Routes over budget: 3

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /world-models/:slug | /world-models/sw-chi-01 | 200 | 71.8 ms | 71.8 ms | 26.9 ms | 13.6 ms | 126.2, 71.8, 58.3 |
| /site-worlds/:slug/workspace | /site-worlds/sw-chi-01/workspace | 200 | 65.7 ms | 65.7 ms | 19.1 ms | 10 ms | 138.2, 65.7, 49 |
| (404 fallback) | /__blueprint-performance-fallback__ | 200 | 58.2 ms | 58.2 ms | 13.1 ms | 5.7 ms | 40.6, 103.9, 58.2 |
| /pilot-exchange | /pilot-exchange | 200 | 47.3 ms | 47.3 ms | 24.9 ms | 17.8 ms | 47.3, 33, 55.6 |
| /capture-app/launch-access | /capture-app/launch-access | 200 | 44.1 ms | 44.1 ms | 15.9 ms | 5.4 ms | 45.6, 44.1, 41.4 |
| /off-waitlist-signup | /off-waitlist-signup | 200 | 41.4 ms | 41.4 ms | 16.8 ms | 8.4 ms | 52.6, 39.7, 41.4 |
| /terms | /terms | 200 | 40.5 ms | 40.5 ms | 13.1 ms | 5.5 ms | 40.5, 42.6, 31.9 |
| /for-robot-teams | /for-robot-teams | 200 | 40 ms | 40 ms | 17 ms | 8.9 ms | 161.5, 40, 39.8 |
| /admin/growth-ops-scorecard | /admin/growth-ops-scorecard | 200 | 39.1 ms | 39.1 ms | 15.2 ms | 6.6 ms | 39.1, 35.4, 42.4 |
| /exact-site-hosted-review | /exact-site-hosted-review | 200 | 38 ms | 38 ms | 18.5 ms | 9.7 ms | 38, 41.4, 29.4 |
| /sites/:slug | /sites/sw-chi-01 | 200 | 37.9 ms | 37.9 ms | 20.6 ms | 5.4 ms | 37.9, 76.9, 29.6 |
| /site-worlds/:slug | /site-worlds/sw-chi-01 | 200 | 37.9 ms | 37.9 ms | 16.9 ms | 8.7 ms | 39.5, 37.9, 27.3 |

## Over Budget

- /world-models/:slug via /world-models/sw-chi-01: 71.8 ms
- /site-worlds/:slug/workspace via /site-worlds/sw-chi-01/workspace: 65.7 ms
- (404 fallback) via /__blueprint-performance-fallback__: 58.2 ms
