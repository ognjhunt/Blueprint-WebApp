# Page Load Performance

- Status: FAIL
- Started at: 2026-06-28T13:42:58.728Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 10000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 108
- Routes over budget: 57

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /app/packs/:siteId | /app/packs/perf-siteId | 200 | 250.4 ms | 250.4 ms | 152.4 ms | 106.1 ms | 145.6, 250.4, 453.4 |
| /app/policies | /app/policies | 200 | 220 ms | 220 ms | 110.5 ms | 100.9 ms | 225.5, 135.1, 220 |
| /site-worlds | /site-worlds | 200 | 210.1 ms | 210.1 ms | 89 ms | 25.2 ms | 313.8, 210.1, 168.7 |
| /world-models | /world-models | 200 | 187.1 ms | 187.1 ms | 105.9 ms | 68.6 ms | 213.7, 187.1, 115.1 |
| /for-robot-teams | /for-robot-teams | 200 | 156.9 ms | 156.9 ms | 27.5 ms | 18.2 ms | 53.6, 156.9, 248.1 |
| /robot-team/eval | /robot-team/eval | 200 | 142.6 ms | 142.6 ms | 85.5 ms | 77.3 ms | 187.7, 142.6, 45.6 |
| /earn | /earn | 200 | 141.6 ms | 141.6 ms | 109.2 ms | 90 ms | 141.6, 73.4, 199.9 |
| /app/entitlements | /app/entitlements | 200 | 125.4 ms | 125.4 ms | 52.7 ms | 44.6 ms | 125.4, 149.3, 73.2 |
| /app | /app | 200 | 115.8 ms | 115.8 ms | 38.1 ms | 28.4 ms | 115.8, 28.7, 119.6 |
| /blog | /blog | 200 | 113.3 ms | 113.3 ms | 53.1 ms | 41.5 ms | 178.9, 29.9, 113.3 |
| /capture-app | /capture-app | 200 | 108 ms | 108 ms | 55.3 ms | 39.8 ms | 86.7, 108, 112.7 |
| /help | /help | 200 | 104.9 ms | 104.9 ms | 61.9 ms | 52.2 ms | 146.4, 104.9, 52.7 |

## Over Budget

- /launch-map via /launch-map: 67.3 ms
- /capture via /capture: 81.3 ms
- /capture-app via /capture-app: 108 ms
- /capture-jobs via /capture-jobs: 51.2 ms
- /capture-network via /capture-network: 52.9 ms
- /capturer via /capturer: 69.8 ms
- /capturer-access via /capturer-access: 59.6 ms
- /for-capturers via /for-capturers: 95.5 ms
- /earn via /earn: 141.6 ms
- /city/:citySlug via /city/austin: 79.8 ms
- /sites/:slug via /sites/sw-chi-01: 53.5 ms
- /world-models via /world-models: 187.1 ms
- /world-models/:slug via /world-models/sw-chi-01: 77.9 ms
- /site-worlds via /site-worlds: 210.1 ms
- /site-worlds/:slug via /site-worlds/sw-chi-01: 89.2 ms
- /site-worlds/:slug/start via /site-worlds/sw-chi-01/start: 88.6 ms
- /site-worlds/:slug/workspace via /site-worlds/sw-chi-01/workspace: 65.2 ms
- /for-site-operators via /for-site-operators: 89.3 ms
- /for-robot-teams via /for-robot-teams: 156.9 ms
- /robot-team/eval via /robot-team/eval: 142.6 ms
- /for-robot-integrators via /for-robot-integrators: 94.9 ms
- /product via /product: 103.3 ms
- /readiness via /readiness: 64.7 ms
- /contact via /contact: 69.2 ms
- /contact/site-operator via /contact/site-operator: 84.3 ms
- /help via /help: 104.9 ms
- /help/contact via /help/contact: 79.6 ms
- /help/category/:categorySlug via /help/category/capture: 77 ms
- /help/article/:articleSlug via /help/article/package-access: 56.1 ms
- /exact-site-hosted-review via /exact-site-hosted-review: 74.7 ms
- /book-exact-site-review via /book-exact-site-review: 96.3 ms
- /how-it-works via /how-it-works: 59.1 ms
- /governance via /governance: 51.5 ms
- /about via /about: 68 ms
- /updates via /updates: 58.9 ms
- /blog via /blog: 113.3 ms
- /careers via /careers: 73.3 ms
- /solutions via /solutions: 74.8 ms
- /quality-standard via /quality-standard: 78.3 ms
- /qualified-opportunities-guide via /qualified-opportunities-guide: 57.7 ms
- /partners via /partners: 70.9 ms
- /sign-in via /sign-in: 51.1 ms
- /login via /login: 69.1 ms
- /signup via /signup: 50.3 ms
- /privacy via /privacy: 50.6 ms
- /settings via /settings: 68.7 ms
- /admin/leads via /admin/leads: 78 ms
- /admin/submissions/:requestId via /admin/submissions/perf-request: 59.9 ms
- /admin/growth-ops-scorecard via /admin/growth-ops-scorecard: 54.7 ms
- /app via /app: 115.8 ms
- /app/runs via /app/runs: 95.2 ms
- /app/packs via /app/packs: 91.8 ms
- /app/packs/:siteId via /app/packs/perf-siteId: 250.4 ms
- /app/policies via /app/policies: 220 ms
- /app/data via /app/data: 69 ms
- /app/entitlements via /app/entitlements: 125.4 ms
- (404 fallback) via /__blueprint-performance-fallback__: 54.8 ms
