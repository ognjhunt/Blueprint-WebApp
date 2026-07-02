# Page Load Performance

- Status: FAIL
- Started at: 2026-06-28T13:19:21.153Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 10000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 108
- Routes over budget: 3

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /admin/growth-studio | /admin/growth-studio | 200 | 71.7 ms | 71.7 ms | 18.6 ms | 9.9 ms | 29.9, 104.4, 71.7 |
| /ops/supply | /ops/supply | 200 | 56.1 ms | 56.1 ms | 24 ms | 10.5 ms | 63.1, 30.5, 56.1 |
| /app/runs/:runId | /app/runs/perf-runId | 200 | 53.2 ms | 53.2 ms | 31.8 ms | 21 ms | 41.7, 53.2, 117.2 |
| /app/packs | /app/packs | 200 | 48.6 ms | 48.6 ms | 40.2 ms | 32 ms | 81.3, 48.6, 32.2 |
| /app/runs | /app/runs | 200 | 45 ms | 45 ms | 32.4 ms | 21 ms | 101.7, 45, 35.9 |
| / | / | 200 | 43.5 ms | 43.5 ms | 38.7 ms | 30.6 ms | 13.6, 145.1, 43.5 |
| /ops/city-launch | /ops/city-launch | 200 | 36.7 ms | 36.7 ms | 32 ms | 22.2 ms | 31.4, 36.7, 87.2 |
| /internal/design-system | /internal/design-system | 200 | 36.6 ms | 36.6 ms | 22.3 ms | 8.2 ms | 28.9, 36.6, 41.6 |
| /ops | /ops | 200 | 34.4 ms | 34.4 ms | 18.9 ms | 10 ms | 22, 45.7, 34.4 |
| /off-waitlist-signup | /off-waitlist-signup | 200 | 33.3 ms | 33.3 ms | 23.1 ms | 12.7 ms | 58.3, 24.5, 33.3 |
| /capturers | /capturers | 200 | 31.2 ms | 31.2 ms | 31.1 ms | 12.8 ms | 54.6, 26.9, 31.2 |
| /requests/:requestId | /requests/perf-request | 200 | 28.3 ms | 28.3 ms | 27.1 ms | 12 ms | 43.2, 23.9, 28.3 |

## Over Budget

- /admin/growth-studio via /admin/growth-studio: 71.7 ms
- /app/runs/:runId via /app/runs/perf-runId: 53.2 ms
- /ops/supply via /ops/supply: 56.1 ms
