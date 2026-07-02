# Page Load Performance

- Status: FAIL
- Started at: 2026-06-28T13:53:09.134Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 10000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 108
- Routes over budget: 60

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /pilot-exchange | /pilot-exchange | 200 | 237.3 ms | 237.3 ms | 106.6 ms | 99.1 ms | 415.7, 237.3, 93.4 |
| /solutions | /solutions | 200 | 188.6 ms | 188.6 ms | 154.4 ms | 135.3 ms | 77.7, 188.6, 395.1 |
| /updates | /updates | 200 | 182.6 ms | 182.6 ms | 67.3 ms | 49.7 ms | 182.6, 129.7, 398.6 |
| /agents | /agents | 200 | 178.5 ms | 178.5 ms | 103.6 ms | 93.4 ms | 178.5, 133.4, 280 |
| /quality-standard | /quality-standard | 200 | 168.1 ms | 168.1 ms | 56.2 ms | 39.1 ms | 349.2, 168.1, 105.8 |
| /qualified-opportunities | /qualified-opportunities | 200 | 156.8 ms | 156.8 ms | 93.5 ms | 81.6 ms | 171.4, 136.1, 156.8 |
| /signup/site-operator | /signup/site-operator | 200 | 148.3 ms | 148.3 ms | 110.8 ms | 102.6 ms | 66.3, 148.3, 261.5 |
| /qualified-opportunities-guide | /qualified-opportunities-guide | 200 | 148.1 ms | 148.1 ms | 136.1 ms | 122.5 ms | 258.1, 136.5, 148.1 |
| /readiness | /readiness | 200 | 133.6 ms | 133.6 ms | 80.4 ms | 70.7 ms | 254.9, 56.4, 133.6 |
| /careers | /careers | 200 | 132.4 ms | 132.4 ms | 90.3 ms | 71.7 ms | 132.4, 301.1, 101.3 |
| /world-models | /world-models | 200 | 124 ms | 124 ms | 99.8 ms | 89.7 ms | 124, 112.9, 273.2 |
| /for-robot-teams | /for-robot-teams | 200 | 123 ms | 123 ms | 66.8 ms | 56.6 ms | 52.4, 123, 182.2 |

## Over Budget

- /capture-jobs via /capture-jobs: 68.2 ms
- /capturer via /capturer: 55.7 ms
- /capturers via /capturers: 50.8 ms
- /become-a-capturer via /become-a-capturer: 55.6 ms
- /for-capturers via /for-capturers: 77.7 ms
- /earn via /earn: 57.7 ms
- /sites via /sites: 96.1 ms
- /sites/:slug via /sites/sw-chi-01: 111.5 ms
- /world-models via /world-models: 124 ms
- /world-models/:slug via /world-models/sw-chi-01: 72.1 ms
- /world-models/:slug/start via /world-models/sw-chi-01/start: 84.5 ms
- /site-worlds via /site-worlds: 97.2 ms
- /site-worlds/:slug via /site-worlds/sw-chi-01: 81.7 ms
- /site-worlds/:slug/start via /site-worlds/sw-chi-01/start: 62.1 ms
- /site-worlds/:slug/workspace via /site-worlds/sw-chi-01/workspace: 83.7 ms
- /for-site-operators via /for-site-operators: 64.9 ms
- /for-robot-teams via /for-robot-teams: 123 ms
- /for-robot-integrators via /for-robot-integrators: 102.1 ms
- /product via /product: 82.9 ms
- /readiness via /readiness: 133.6 ms
- /readiness-pack via /readiness-pack: 67.7 ms
- /agents via /agents: 178.5 ms
- /sample-evaluation via /sample-evaluation: 81.2 ms
- /sample-deliverables via /sample-deliverables: 51.7 ms
- /contact via /contact: 60.8 ms
- /contact/robot-team via /contact/robot-team: 58.2 ms
- /contact/site-operator via /contact/site-operator: 56.8 ms
- /help via /help: 66.2 ms
- /help/contact via /help/contact: 60.4 ms
- /help/category/:categorySlug via /help/category/capture: 65.9 ms
- /help/article/:articleSlug via /help/article/package-access: 77.5 ms
- /exact-site-hosted-review via /exact-site-hosted-review: 84.4 ms
- /book-exact-site-review via /book-exact-site-review: 90.7 ms
- /how-it-works via /how-it-works: 114.5 ms
- /proof via /proof: 50.9 ms
- /faq via /faq: 66.7 ms
- /governance via /governance: 85.8 ms
- /about via /about: 100.4 ms
- /docs via /docs: 98.9 ms
- /updates via /updates: 182.6 ms
- /blog via /blog: 108.2 ms
- /careers via /careers: 132.4 ms
- /solutions via /solutions: 188.6 ms
- /quality-standard via /quality-standard: 168.1 ms
- /qualified-opportunities via /qualified-opportunities: 156.8 ms
- /qualified-opportunities-guide via /qualified-opportunities-guide: 148.1 ms
- /pilot-exchange via /pilot-exchange: 237.3 ms
- /pilot-exchange-guide via /pilot-exchange-guide: 71.6 ms
- /partners via /partners: 61.6 ms
- /environments via /environments: 51.8 ms
- /marketplace via /marketplace: 90.1 ms
- /portal via /portal: 71.3 ms
- /sign-in via /sign-in: 104.9 ms
- /login via /login: 109.8 ms
- /signup/business via /signup/business: 65.5 ms
- /signup/robot-team via /signup/robot-team: 59 ms
- /signup/site-operator via /signup/site-operator: 148.3 ms
- /onboarding via /onboarding: 57.1 ms
- /privacy via /privacy: 50.3 ms
- /admin/leads via /admin/leads: 50.5 ms
