# Page Load Performance

- Status: FAIL
- Started at: 2026-06-20T06:13:15.713Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 5000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 92
- Routes over budget: 25

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /terms | /terms | 200 | 145.8 ms | 145.8 ms | 39.2 ms | 28 ms | 44.6, 195.9, 145.8 |
| /faq | /faq | 200 | 113.1 ms | 113.1 ms | 35.3 ms | 24.9 ms | 44.5, 113.1, 218 |
| /for-robot-teams | /for-robot-teams | 200 | 103.7 ms | 103.7 ms | 16.1 ms | 7.3 ms | 144.8, 103.7, 47.1 |
| /login | /login | 200 | 103.7 ms | 103.7 ms | 52.5 ms | 40.7 ms | 71.9, 111.7, 103.7 |
| /how-it-works | /how-it-works | 200 | 94.5 ms | 94.5 ms | 45.1 ms | 35.9 ms | 94.5, 107.5, 71.8 |
| /product | /product | 200 | 90.3 ms | 90.3 ms | 26.8 ms | 17.3 ms | 90.3, 46.8, 100.7 |
| /capture-app | /capture-app | 200 | 87.6 ms | 87.6 ms | 59.1 ms | 9 ms | 28.5, 103, 87.6 |
| /privacy | /privacy | 200 | 80.5 ms | 80.5 ms | 15.3 ms | 6.7 ms | 199.9, 66.3, 80.5 |
| /world-models/:slug | /world-models/sw-chi-01 | 200 | 78.6 ms | 78.6 ms | 23.8 ms | 14.8 ms | 36, 86.3, 78.6 |
| /updates | /updates | 200 | 77.6 ms | 77.6 ms | 22.2 ms | 14.2 ms | 77.6, 84.4, 33.1 |
| /docs | /docs | 200 | 77.5 ms | 77.5 ms | 28.3 ms | 13.2 ms | 105.6, 76.3, 77.5 |
| /signup/site-operator | /signup/site-operator | 200 | 71.3 ms | 71.3 ms | 24.4 ms | 16.8 ms | 71.3, 35.1, 81.6 |

## Over Budget

- /capture-app via /capture-app: 87.6 ms
- /capture-app/launch-access via /capture-app/launch-access: 52.8 ms
- /sites/:slug via /sites/sw-chi-01: 63.9 ms
- /world-models/:slug via /world-models/sw-chi-01: 78.6 ms
- /for-robot-teams via /for-robot-teams: 103.7 ms
- /product via /product: 90.3 ms
- /readiness-pack via /readiness-pack: 57.1 ms
- /sample-deliverables via /sample-deliverables: 54.2 ms
- /exact-site-hosted-review via /exact-site-hosted-review: 50.3 ms
- /how-it-works via /how-it-works: 94.5 ms
- /faq via /faq: 113.1 ms
- /docs via /docs: 77.5 ms
- /updates via /updates: 77.6 ms
- /blog via /blog: 51 ms
- /qualified-opportunities via /qualified-opportunities: 53.4 ms
- /pilot-exchange via /pilot-exchange: 58.3 ms
- /pilot-exchange-guide via /pilot-exchange-guide: 57.2 ms
- /login via /login: 103.7 ms
- /signup/site-operator via /signup/site-operator: 71.3 ms
- /onboarding via /onboarding: 66.5 ms
- /privacy via /privacy: 80.5 ms
- /terms via /terms: 145.8 ms
- /requests/:requestId via /requests/perf-request: 66.6 ms
- /dashboard via /dashboard: 50.4 ms
- (404 fallback) via /__blueprint-performance-fallback__: 50.6 ms
