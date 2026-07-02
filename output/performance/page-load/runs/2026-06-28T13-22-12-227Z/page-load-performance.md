# Page Load Performance

- Status: FAIL
- Started at: 2026-06-28T13:22:12.228Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 9
- Route timeout: 10000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 108
- Routes over budget: 14

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /marketplace | /marketplace | 200 | 168.9 ms | 168.9 ms | 71 ms | 49.2 ms | 38.2, 52.1, 56.5, 60.5, 168.9, 469, 366.9, 794, 200.3 |
| /sign-in | /sign-in | 200 | 101.8 ms | 101.8 ms | 56.6 ms | 40.3 ms | 50, 101.8, 130.6, 217.7, 101.5, 43.2, 417.7, 71.9, 154.6 |
| /pilot-exchange-guide | /pilot-exchange-guide | 200 | 99.4 ms | 99.4 ms | 71.6 ms | 59.8 ms | 162.7, 39.2, 74.9, 250.2, 289.1, 171.4, 61.5, 35.4, 99.4 |
| /login | /login | 200 | 96.4 ms | 96.4 ms | 24.4 ms | 13.1 ms | 103.5, 182, 258.6, 54.7, 96.4, 28.5, 21.4, 24, 137.5 |
| /privacy | /privacy | 200 | 92.2 ms | 92.2 ms | 30.1 ms | 20.1 ms | 122.8, 111.2, 231.4, 20.4, 100.6, 76.9, 40.7, 46.9, 92.2 |
| /requests/:requestId/preview | /requests/perf-request/preview | 200 | 84.7 ms | 84.7 ms | 25.8 ms | 10 ms | 164.3, 229.1, 84.7, 103.4, 68.7, 36.6, 57, 19.7, 90.6 |
| /admin/growth-ops-scorecard | /admin/growth-ops-scorecard | 200 | 78.3 ms | 78.3 ms | 26 ms | 11.6 ms | 162.5, 214.4, 182.7, 78.3, 41.5, 25.2, 181, 23.1, 17.7 |
| /pilot-exchange | /pilot-exchange | 200 | 74.2 ms | 74.2 ms | 43.6 ms | 34.6 ms | 29.6, 253.2, 91.4, 35.9, 69.8, 74.2, 61.6, 266.4, 339.4 |
| /app/data | /app/data | 200 | 69.8 ms | 69.8 ms | 21.8 ms | 12.4 ms | 69.8, 36.4, 154.1, 115.2, 44.8, 26.1, 72.5, 30.8, 76.9 |
| /requests/:requestId | /requests/perf-request | 200 | 66 ms | 66 ms | 55.4 ms | 38.6 ms | 113.8, 55.9, 273.1, 376.1, 66, 15.8, 49.4, 114.7, 19.8 |
| /environments | /environments | 200 | 59.3 ms | 59.3 ms | 41 ms | 32.4 ms | 22.2, 24.3, 33.8, 70.1, 73.1, 40.9, 59.3, 83.6, 171.9 |
| /signup/robot-team | /signup/robot-team | 200 | 53.9 ms | 53.9 ms | 27.5 ms | 19.9 ms | 21.4, 23.9, 57.3, 86.3, 67.8, 51.1, 53.9, 71.7, 43 |

## Over Budget

- /pilot-exchange via /pilot-exchange: 74.2 ms
- /pilot-exchange-guide via /pilot-exchange-guide: 99.4 ms
- /environments via /environments: 59.3 ms
- /marketplace via /marketplace: 168.9 ms
- /sign-in via /sign-in: 101.8 ms
- /login via /login: 96.4 ms
- /signup/robot-team via /signup/robot-team: 53.9 ms
- /privacy via /privacy: 92.2 ms
- /requests/:requestId via /requests/perf-request: 66 ms
- /requests/:requestId/qualification via /requests/perf-request/qualification: 52.8 ms
- /requests/:requestId/preview via /requests/perf-request/preview: 84.7 ms
- /admin/growth-ops-scorecard via /admin/growth-ops-scorecard: 78.3 ms
- /app/data via /app/data: 69.8 ms
- /app/entitlements via /app/entitlements: 52 ms
