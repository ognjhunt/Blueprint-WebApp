# Page Load Performance

- Status: FAIL
- Started at: 2026-06-20T06:29:19.005Z
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
| /admin/submissions | /admin/submissions | 200 | 88.6 ms | 88.6 ms | 29 ms | 20.4 ms | 60.6, 93.4, 88.6 |
| /dashboard | /dashboard | 200 | 46.2 ms | 46.2 ms | 17 ms | 6.5 ms | 184.9, 36.5, 46.2 |
| /help/contact | /help/contact | 200 | 45.7 ms | 45.7 ms | 30.1 ms | 21.9 ms | 57.5, 45.6, 45.7 |
| /for-robot-teams | /for-robot-teams | 200 | 44.7 ms | 44.7 ms | 17.6 ms | 5.9 ms | 44.7, 84.5, 30.6 |
| /requests/:requestId/qualification | /requests/perf-request/qualification | 200 | 42.5 ms | 42.5 ms | 13.5 ms | 6 ms | 54.1, 31, 42.5 |
| /product | /product | 200 | 40.9 ms | 40.9 ms | 16.2 ms | 9.1 ms | 34.9, 44.2, 40.9 |
| /help | /help | 200 | 39.9 ms | 39.9 ms | 37 ms | 24.2 ms | 39.9, 26.4, 48.9 |
| /admin/leads | /admin/leads | 200 | 39.8 ms | 39.8 ms | 18.6 ms | 11.8 ms | 48.5, 30.1, 39.8 |
| /settings | /settings | 200 | 39.1 ms | 39.1 ms | 17.1 ms | 7.6 ms | 29.9, 51.3, 39.1 |
| /for-robot-integrators | /for-robot-integrators | 200 | 38.3 ms | 38.3 ms | 17.3 ms | 9.2 ms | 38.3, 38.6, 28.2 |
| /privacy | /privacy | 200 | 36.8 ms | 36.8 ms | 13.1 ms | 6.7 ms | 36.8, 28.9, 77.1 |
| /quality-standard | /quality-standard | 200 | 36.4 ms | 36.4 ms | 19.1 ms | 10.3 ms | 35.8, 84.7, 36.4 |

## Over Budget

- /admin/submissions via /admin/submissions: 88.6 ms
