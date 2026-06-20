# Page Load Performance

- Status: FAIL
- Started at: 2026-06-20T06:09:41.955Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 5000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 92
- Routes over budget: 75

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /world-models/:slug | /world-models/sw-chi-01 | 200 | 307.3 ms | 307.3 ms | 188.1 ms | 73.9 ms | 255.7, 719.3, 307.3 |
| /onboarding | /onboarding | 200 | 249 ms | 249 ms | 199.6 ms | 22.2 ms | 249, 248.9, 427.1 |
| /capture-app/launch-access | /capture-app/launch-access | 200 | 244.5 ms | 244.5 ms | 98.4 ms | 50.9 ms | 244.5, 548.4, 166.9 |
| /requests/:requestId/preview | /requests/perf-request/preview | 200 | 172 ms | 172 ms | 98 ms | 26.1 ms | 172, 101.3, 189 |
| /privacy | /privacy | 200 | 166 ms | 166 ms | 92.1 ms | 28.1 ms | 213.8, 166, 93.9 |
| /admin/leads | /admin/leads | 200 | 156.1 ms | 156.1 ms | 94.5 ms | 11.5 ms | 156.1, 232.9, 43.2 |
| /sites | /sites | 200 | 131.5 ms | 131.5 ms | 131.3 ms | 43 ms | 131.5, 149.7, 81.4 |
| /site-worlds/:slug/start | /site-worlds/sw-chi-01/start | 200 | 129.6 ms | 129.6 ms | 78.5 ms | 20.2 ms | 88, 129.6, 175.2 |
| /become-a-capturer | /become-a-capturer | 200 | 126.9 ms | 126.9 ms | 126.7 ms | 58.1 ms | 70.5, 145.9, 126.9 |
| /world-models | /world-models | 200 | 122.9 ms | 122.9 ms | 122.8 ms | 75.9 ms | 122.9, 153.4, 71.9 |
| /capturer-access | /capturer-access | 200 | 120.7 ms | 120.7 ms | 120.5 ms | 75.5 ms | 120.7, 145.9, 61.9 |
| /capture-app | /capture-app | 200 | 115.7 ms | 115.7 ms | 95.1 ms | 17.9 ms | 110.6, 115.7, 124.4 |

## Over Budget

- / via /: 65.2 ms
- /launch-map via /launch-map: 67.8 ms
- /capture via /capture: 62.5 ms
- /capture-app via /capture-app: 115.7 ms
- /capture-app/launch-access via /capture-app/launch-access: 244.5 ms
- /capture-jobs via /capture-jobs: 109.1 ms
- /capture-network via /capture-network: 54.4 ms
- /capturer via /capturer: 60.4 ms
- /capturers via /capturers: 80.1 ms
- /capturer-access via /capturer-access: 120.7 ms
- /become-a-capturer via /become-a-capturer: 126.9 ms
- /for-capturers via /for-capturers: 82.4 ms
- /earn via /earn: 67.7 ms
- /city/:citySlug via /city/austin: 53.6 ms
- /sites via /sites: 131.5 ms
- /sites/:slug via /sites/sw-chi-01: 92.3 ms
- /world-models via /world-models: 122.9 ms
- /world-models/:slug via /world-models/sw-chi-01: 307.3 ms
- /world-models/:slug/start via /world-models/sw-chi-01/start: 107.5 ms
- /world-models/:slug/workspace via /world-models/sw-chi-01/workspace: 53 ms
- /site-worlds via /site-worlds: 53.8 ms
- /site-worlds/:slug via /site-worlds/sw-chi-01: 64.6 ms
- /site-worlds/:slug/start via /site-worlds/sw-chi-01/start: 129.6 ms
- /site-worlds/:slug/workspace via /site-worlds/sw-chi-01/workspace: 97.3 ms
- /for-robot-teams via /for-robot-teams: 90.1 ms
- /robot-team/eval via /robot-team/eval: 56.5 ms
- /for-robot-integrators via /for-robot-integrators: 62.1 ms
- /product via /product: 54.8 ms
- /readiness via /readiness: 70.8 ms
- /readiness-pack via /readiness-pack: 65 ms
- /pricing via /pricing: 66.3 ms
- /sample-evaluation via /sample-evaluation: 75.4 ms
- /sample-deliverables via /sample-deliverables: 81.4 ms
- /case-studies via /case-studies: 63.8 ms
- /contact/robot-team via /contact/robot-team: 57.6 ms
- /exact-site-hosted-review via /exact-site-hosted-review: 50.7 ms
- /how-it-works via /how-it-works: 57 ms
- /proof via /proof: 56.7 ms
- /faq via /faq: 64.8 ms
- /governance via /governance: 72.3 ms
- /about via /about: 75 ms
- /docs via /docs: 82.4 ms
- /updates via /updates: 68.1 ms
- /blog via /blog: 58.6 ms
- /careers via /careers: 86 ms
- /solutions via /solutions: 75.5 ms
- /quality-standard via /quality-standard: 56.6 ms
- /qualified-opportunities via /qualified-opportunities: 52.1 ms
- /qualified-opportunities-guide via /qualified-opportunities-guide: 64.4 ms
- /pilot-exchange via /pilot-exchange: 71.8 ms
- /pilot-exchange-guide via /pilot-exchange-guide: 63.2 ms
- /environments via /environments: 74.5 ms
- /marketplace via /marketplace: 59.6 ms
- /sign-in via /sign-in: 72.6 ms
- /login via /login: 60.8 ms
- /signup/robot-team via /signup/robot-team: 109.5 ms
- /signup/site-operator via /signup/site-operator: 87.9 ms
- /onboarding via /onboarding: 249 ms
- /forgot-password via /forgot-password: 64.9 ms
- /privacy via /privacy: 166 ms
- /terms via /terms: 97.5 ms
- /settings via /settings: 76.6 ms
- /requests/:requestId via /requests/perf-request: 54.5 ms
- /requests/:requestId/evidence via /requests/perf-request/evidence: 92.1 ms
- /requests/:requestId/qualification via /requests/perf-request/qualification: 97 ms
- /requests/:requestId/preview via /requests/perf-request/preview: 172 ms
- /admin/leads via /admin/leads: 156.1 ms
- /admin/submissions via /admin/submissions: 62.7 ms
- /admin/submissions/:requestId via /admin/submissions/perf-request: 65 ms
- /admin/company-metrics via /admin/company-metrics: 57.7 ms
- /admin/city-launch/austin via /admin/city-launch/austin: 58.6 ms
- /admin/city-launch/:citySlug via /admin/city-launch/austin: 55.9 ms
- /admin/growth-studio via /admin/growth-studio: 53.4 ms
- /off-waitlist-signup via /off-waitlist-signup: 58.8 ms
- (404 fallback) via /__blueprint-performance-fallback__: 55.7 ms
