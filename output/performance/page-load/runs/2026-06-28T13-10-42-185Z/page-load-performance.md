# Page Load Performance

- Status: FAIL
- Started at: 2026-06-28T13:10:42.187Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 10000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 108
- Routes over budget: 32

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /updates | /updates | 200 | 169.4 ms | 169.4 ms | 21.7 ms | 12.8 ms | 87.3, 169.4, 210 |
| /admin/company-metrics | /admin/company-metrics | 200 | 157.5 ms | 157.5 ms | 18 ms | 6.4 ms | 135.5, 182.6, 157.5 |
| /marketplace | /marketplace | 200 | 156.8 ms | 156.8 ms | 23.2 ms | 8.8 ms | 156.8, 29.8, 220.8 |
| /site-worlds | /site-worlds | 200 | 131.7 ms | 131.7 ms | 21.2 ms | 11 ms | 131.7, 29.6, 216.7 |
| /ops/spend | /ops/spend | 200 | 110.4 ms | 110.4 ms | 17.9 ms | 6.1 ms | 76.3, 110.4, 177.3 |
| /quality-standard | /quality-standard | 200 | 96.8 ms | 96.8 ms | 26.7 ms | 13.2 ms | 96.8, 119.6, 27.4 |
| /exact-site-hosted-review | /exact-site-hosted-review | 200 | 92.9 ms | 92.9 ms | 24.5 ms | 8.9 ms | 108.3, 92.9, 41.3 |
| /solutions | /solutions | 200 | 88.7 ms | 88.7 ms | 21.4 ms | 9.2 ms | 88.7, 74.9, 89.4 |
| /app/runs/:runId | /app/runs/perf-runId | 200 | 84.7 ms | 84.7 ms | 16.4 ms | 6.9 ms | 60.2, 84.7, 90 |
| /app/entitlements | /app/entitlements | 200 | 82 ms | 82 ms | 13.7 ms | 5.6 ms | 106.7, 26.7, 82 |
| /app/packs/:siteId | /app/packs/perf-siteId | 200 | 80 ms | 80 ms | 20.2 ms | 10.5 ms | 81.2, 80, 41.1 |
| /app/runs | /app/runs | 200 | 77.9 ms | 77.9 ms | 13.8 ms | 5.4 ms | 93.2, 46.6, 77.9 |

## Over Budget

- / via /: 71 ms
- /capture-app via /capture-app: 57.3 ms
- /world-models/:slug/workspace via /world-models/sw-chi-01/workspace: 61.1 ms
- /site-worlds via /site-worlds: 131.7 ms
- /site-worlds/:slug via /site-worlds/sw-chi-01: 57.5 ms
- /site-worlds/:slug/workspace via /site-worlds/sw-chi-01/workspace: 68.9 ms
- /for-robot-integrators via /for-robot-integrators: 58.9 ms
- /exact-site-hosted-review via /exact-site-hosted-review: 92.9 ms
- /how-it-works via /how-it-works: 67.9 ms
- /about via /about: 62.6 ms
- /updates via /updates: 169.4 ms
- /solutions via /solutions: 88.7 ms
- /quality-standard via /quality-standard: 96.8 ms
- /marketplace via /marketplace: 156.8 ms
- /login via /login: 75.4 ms
- /settings via /settings: 71.1 ms
- /requests/:requestId/evidence via /requests/perf-request/evidence: 54.9 ms
- /requests/:requestId/preview via /requests/perf-request/preview: 73.5 ms
- /admin/growth-ops-scorecard via /admin/growth-ops-scorecard: 60.6 ms
- /admin/company-metrics via /admin/company-metrics: 157.5 ms
- /admin/growth-studio via /admin/growth-studio: 74 ms
- /internal/design-system via /internal/design-system: 53.8 ms
- /join via /join: 55 ms
- /app via /app: 67.1 ms
- /app/runs via /app/runs: 77.9 ms
- /app/runs/:runId via /app/runs/perf-runId: 84.7 ms
- /app/packs via /app/packs: 66.4 ms
- /app/packs/:siteId via /app/packs/perf-siteId: 80 ms
- /app/data via /app/data: 70.1 ms
- /app/entitlements via /app/entitlements: 82 ms
- /ops/supply via /ops/supply: 52.5 ms
- /ops/spend via /ops/spend: 110.4 ms
