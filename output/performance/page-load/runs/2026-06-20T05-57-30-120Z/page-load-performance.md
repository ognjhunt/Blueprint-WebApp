# Page Load Performance

- Status: FAIL
- Started at: 2026-06-20T05:57:30.128Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 5000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 92
- Routes over budget: 88

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /case-studies | /case-studies | 200 | 304.6 ms | 304.6 ms | 178.3 ms | 56.7 ms | 622, 304.6, 90.7 |
| /contact | /contact | 200 | 281.8 ms | 281.8 ms | 281.5 ms | 94.9 ms | 103.5, 306.5, 281.8 |
| /robot-team/eval | /robot-team/eval | 200 | 275.6 ms | 275.6 ms | 190.3 ms | 51.4 ms | 340.5, 275.6, 186.5 |
| /for-robot-teams | /for-robot-teams | 200 | 221.9 ms | 221.9 ms | 92.4 ms | 24.9 ms | 221.9, 111.9, 276.2 |
| /site-worlds/:slug/start | /site-worlds/sw-chi-01/start | 200 | 205.1 ms | 205.1 ms | 138.1 ms | 14.3 ms | 353.2, 205.1, 44.9 |
| /privacy | /privacy | 200 | 171.4 ms | 171.4 ms | 117.9 ms | 49.1 ms | 188.8, 171.4, 138.1 |
| /capture-jobs | /capture-jobs | 200 | 170.8 ms | 170.8 ms | 170.7 ms | 51.1 ms | 170.8, 188.4, 95 |
| /onboarding | /onboarding | 200 | 170.2 ms | 170.2 ms | 97 ms | 16.1 ms | 170.2, 159.1, 223.2 |
| /dashboard | /dashboard | 200 | 165.4 ms | 165.4 ms | 70.1 ms | 23.1 ms | 180.7, 165.4, 54.7 |
| /blog | /blog | 200 | 165.3 ms | 165.3 ms | 116.2 ms | 30.6 ms | 222, 54.7, 165.3 |
| /signup/site-operator | /signup/site-operator | 200 | 162.8 ms | 162.8 ms | 141.4 ms | 37.4 ms | 141.7, 162.8, 278.3 |
| /requests/:requestId/evidence | /requests/perf-request/evidence | 200 | 160.3 ms | 160.3 ms | 64.9 ms | 29.1 ms | 131.3, 160.3, 213.1 |

## Over Budget

- / via /: 95.7 ms
- /launch-map via /launch-map: 142.2 ms
- /capture via /capture: 63.6 ms
- /capture-app via /capture-app: 131.5 ms
- /capture-app/launch-access via /capture-app/launch-access: 116.1 ms
- /capture-jobs via /capture-jobs: 170.8 ms
- /capture-network via /capture-network: 87.6 ms
- /capturer via /capturer: 58.3 ms
- /capturers via /capturers: 58.9 ms
- /capturer-access via /capturer-access: 122.1 ms
- /become-a-capturer via /become-a-capturer: 89.4 ms
- /for-capturers via /for-capturers: 50.9 ms
- /earn via /earn: 52.8 ms
- /city/:citySlug via /city/austin: 80.1 ms
- /sites via /sites: 71.7 ms
- /sites/:slug via /sites/sw-chi-01: 95.3 ms
- /world-models via /world-models: 137 ms
- /world-models/:slug via /world-models/sw-chi-01: 90 ms
- /world-models/:slug/start via /world-models/sw-chi-01/start: 74 ms
- /world-models/:slug/workspace via /world-models/sw-chi-01/workspace: 65.9 ms
- /site-worlds via /site-worlds: 71.4 ms
- /site-worlds/:slug via /site-worlds/sw-chi-01: 85.6 ms
- /site-worlds/:slug/start via /site-worlds/sw-chi-01/start: 205.1 ms
- /site-worlds/:slug/workspace via /site-worlds/sw-chi-01/workspace: 93.4 ms
- /for-site-operators via /for-site-operators: 108.7 ms
- /for-robot-teams via /for-robot-teams: 221.9 ms
- /robot-team/eval via /robot-team/eval: 275.6 ms
- /for-robot-integrators via /for-robot-integrators: 87.9 ms
- /product via /product: 76.6 ms
- /readiness via /readiness: 70.6 ms
- /readiness-pack via /readiness-pack: 79.3 ms
- /pricing via /pricing: 61.2 ms
- /sample-evaluation via /sample-evaluation: 100 ms
- /sample-deliverables via /sample-deliverables: 135.4 ms
- /case-studies via /case-studies: 304.6 ms
- /contact via /contact: 281.8 ms
- /contact/robot-team via /contact/robot-team: 103 ms
- /help via /help: 65.7 ms
- /help/contact via /help/contact: 90.1 ms
- /help/category/:categorySlug via /help/category/capture: 58.6 ms
- /help/article/:articleSlug via /help/article/package-access: 110 ms
- /exact-site-hosted-review via /exact-site-hosted-review: 88.9 ms
- /book-exact-site-review via /book-exact-site-review: 50.4 ms
- /how-it-works via /how-it-works: 60.6 ms
- /proof via /proof: 111 ms
- /faq via /faq: 112.2 ms
- /governance via /governance: 128.2 ms
- /about via /about: 99.9 ms
- /docs via /docs: 116.9 ms
- /updates via /updates: 113.3 ms
- /blog via /blog: 165.3 ms
- /careers via /careers: 56.1 ms
- /solutions via /solutions: 104.9 ms
- /quality-standard via /quality-standard: 80.4 ms
- /qualified-opportunities via /qualified-opportunities: 150.6 ms
- /qualified-opportunities-guide via /qualified-opportunities-guide: 97.8 ms
- /pilot-exchange via /pilot-exchange: 105.7 ms
- /pilot-exchange-guide via /pilot-exchange-guide: 97.5 ms
- /partners via /partners: 55.6 ms
- /environments via /environments: 92.9 ms
- /marketplace via /marketplace: 78.2 ms
- /portal via /portal: 89.2 ms
- /sign-in via /sign-in: 95.1 ms
- /login via /login: 69.7 ms
- /signup via /signup: 64.2 ms
- /signup/robot-team via /signup/robot-team: 89.3 ms
- /signup/site-operator via /signup/site-operator: 162.8 ms
- /signup/capturer via /signup/capturer: 61.4 ms
- /onboarding via /onboarding: 170.2 ms
- /privacy via /privacy: 171.4 ms
- /terms via /terms: 105 ms
- /settings via /settings: 76.8 ms
- /requests/:requestId via /requests/perf-request: 133.8 ms
- /requests/:requestId/evidence via /requests/perf-request/evidence: 160.3 ms
- /requests/:requestId/qualification via /requests/perf-request/qualification: 86.6 ms
- /requests/:requestId/preview via /requests/perf-request/preview: 131.2 ms
- /admin/leads via /admin/leads: 57 ms
- /admin/leads/:requestId via /admin/leads/perf-request: 140.3 ms
- /admin/submissions via /admin/submissions: 110.8 ms
- /admin/submissions/:requestId via /admin/submissions/perf-request: 154.4 ms
- /admin/growth-ops-scorecard via /admin/growth-ops-scorecard: 97.2 ms
- /admin/company-metrics via /admin/company-metrics: 128.2 ms
- /admin/city-launch/austin via /admin/city-launch/austin: 144.1 ms
- /admin/city-launch/:citySlug via /admin/city-launch/austin: 106.6 ms
- /admin/growth-studio via /admin/growth-studio: 132.7 ms
- /dashboard via /dashboard: 165.4 ms
- /off-waitlist-signup via /off-waitlist-signup: 153.3 ms
- (404 fallback) via /__blueprint-performance-fallback__: 86.1 ms
