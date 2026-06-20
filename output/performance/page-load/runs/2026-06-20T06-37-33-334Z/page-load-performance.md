# Page Load Performance

- Status: FAIL
- Started at: 2026-06-20T06:37:33.335Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 5000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 92
- Routes over budget: 14

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /for-robot-integrators | /for-robot-integrators | 200 | 94 ms | 94 ms | 19.7 ms | 12 ms | 66.5, 124.3, 94 |
| /sites/:slug | /sites/sw-chi-01 | 200 | 74.3 ms | 74.3 ms | 20.1 ms | 10.9 ms | 74.3, 45.8, 76 |
| /requests/:requestId/preview | /requests/perf-request/preview | 200 | 73.8 ms | 73.8 ms | 17.3 ms | 10.5 ms | 73.8, 84.9, 47.9 |
| /settings | /settings | 200 | 69.8 ms | 69.8 ms | 24 ms | 17.5 ms | 33.5, 80.7, 69.8 |
| /capturer-access | /capturer-access | 200 | 68.9 ms | 68.9 ms | 49.6 ms | 32.4 ms | 45.9, 143.1, 68.9 |
| /capturers | /capturers | 200 | 68.1 ms | 68.1 ms | 30.1 ms | 20.1 ms | 48.5, 122.5, 68.1 |
| /about | /about | 200 | 63.5 ms | 63.5 ms | 19.1 ms | 11.9 ms | 67.2, 63.5, 45.7 |
| /site-worlds/:slug | /site-worlds/sw-chi-01 | 200 | 62.6 ms | 62.6 ms | 27.1 ms | 13.1 ms | 318, 49.1, 62.6 |
| /requests/:requestId/qualification | /requests/perf-request/qualification | 200 | 57 ms | 57 ms | 19.7 ms | 8.5 ms | 57, 54.3, 74.9 |
| /capturer | /capturer | 200 | 55.5 ms | 55.5 ms | 38.2 ms | 29.7 ms | 179.5, 39.3, 55.5 |
| /onboarding | /onboarding | 200 | 53 ms | 53 ms | 17.1 ms | 7.4 ms | 102.4, 34, 53 |
| /world-models/:slug/workspace | /world-models/sw-chi-01/workspace | 200 | 52.9 ms | 52.9 ms | 13.1 ms | 6.1 ms | 35.5, 103, 52.9 |

## Over Budget

- /capturer via /capturer: 55.5 ms
- /capturers via /capturers: 68.1 ms
- /capturer-access via /capturer-access: 68.9 ms
- /sites/:slug via /sites/sw-chi-01: 74.3 ms
- /world-models/:slug via /world-models/sw-chi-01: 52.3 ms
- /world-models/:slug/workspace via /world-models/sw-chi-01/workspace: 52.9 ms
- /site-worlds/:slug via /site-worlds/sw-chi-01: 62.6 ms
- /for-robot-integrators via /for-robot-integrators: 94 ms
- /product via /product: 50.2 ms
- /about via /about: 63.5 ms
- /onboarding via /onboarding: 53 ms
- /settings via /settings: 69.8 ms
- /requests/:requestId/qualification via /requests/perf-request/qualification: 57 ms
- /requests/:requestId/preview via /requests/perf-request/preview: 73.8 ms
