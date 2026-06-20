# Page Load Performance

- Status: FAIL
- Started at: 2026-06-20T05:43:48.119Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 5000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 92
- Routes over budget: 92

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /world-models/:slug/start | /world-models/sw-chi-01/start | 200 | 685.8 ms | 685.8 ms | 132.2 ms | 39.1 ms | 950.9, 685.8, 127.2 |
| /readiness | /readiness | 200 | 637.5 ms | 637.5 ms | 485 ms | 128.2 ms | 403.6, 647.3, 637.5 |
| /sample-deliverables | /sample-deliverables | 200 | 571.2 ms | 571.2 ms | 425.9 ms | 94 ms | 571.2, 904.9, 450.6 |
| /site-worlds/:slug/start | /site-worlds/sw-chi-01/start | 200 | 534.7 ms | 534.7 ms | 517.9 ms | 114.4 ms | 1258.2, 534.7, 197.8 |
| /capture-app | /capture-app | 200 | 530.3 ms | 530.3 ms | 105.1 ms | 14.4 ms | 156.2, 530.3, 612.2 |
| /sample-evaluation | /sample-evaluation | 200 | 520.3 ms | 520.3 ms | 304 ms | 112.3 ms | 139.8, 564.2, 520.3 |
| /admin/growth-ops-scorecard | /admin/growth-ops-scorecard | 200 | 488.3 ms | 488.3 ms | 251.6 ms | 25.1 ms | 570.7, 488.3, 468.8 |
| /environments | /environments | 200 | 483.6 ms | 483.6 ms | 330.7 ms | 61 ms | 177.4, 635.5, 483.6 |
| /agents | /agents | 200 | 483.1 ms | 483.1 ms | 483.1 ms | 95.2 ms | 485.9, 402.5, 483.1 |
| /pricing | /pricing | 200 | 473.1 ms | 473.1 ms | 309.5 ms | 17.8 ms | 473.1, 502.5, 298.5 |
| /docs | /docs | 200 | 462.1 ms | 462.1 ms | 144.3 ms | 15.7 ms | 494.4, 188.7, 462.1 |
| /product | /product | 200 | 445.8 ms | 445.8 ms | 354.1 ms | 78.8 ms | 318.9, 1124.6, 445.8 |

## Over Budget

- / via /: 306.1 ms
- /launch-map via /launch-map: 113.4 ms
- /capture via /capture: 113.6 ms
- /capture-app via /capture-app: 530.3 ms
- /capture-app/launch-access via /capture-app/launch-access: 228.5 ms
- /capture-jobs via /capture-jobs: 108.7 ms
- /capture-network via /capture-network: 238.8 ms
- /capturer via /capturer: 146.2 ms
- /capturers via /capturers: 133.5 ms
- /capturer-access via /capturer-access: 138.3 ms
- /become-a-capturer via /become-a-capturer: 199.4 ms
- /for-capturers via /for-capturers: 154.4 ms
- /earn via /earn: 222.2 ms
- /city/:citySlug via /city/austin: 339.1 ms
- /sites via /sites: 125 ms
- /sites/:slug via /sites/sw-chi-01: 334.2 ms
- /world-models via /world-models: 97.6 ms
- /world-models/:slug via /world-models/sw-chi-01: 323.6 ms
- /world-models/:slug/start via /world-models/sw-chi-01/start: 685.8 ms
- /world-models/:slug/workspace via /world-models/sw-chi-01/workspace: 283.3 ms
- /site-worlds via /site-worlds: 274.3 ms
- /site-worlds/:slug via /site-worlds/sw-chi-01: 274.5 ms
- /site-worlds/:slug/start via /site-worlds/sw-chi-01/start: 534.7 ms
- /site-worlds/:slug/workspace via /site-worlds/sw-chi-01/workspace: 195.3 ms
- /for-site-operators via /for-site-operators: 222.5 ms
- /for-robot-teams via /for-robot-teams: 444.8 ms
- /robot-team/eval via /robot-team/eval: 280.8 ms
- /for-robot-integrators via /for-robot-integrators: 318.4 ms
- /product via /product: 445.8 ms
- /readiness via /readiness: 637.5 ms
- /readiness-pack via /readiness-pack: 334.9 ms
- /agents via /agents: 483.1 ms
- /pricing via /pricing: 473.1 ms
- /sample-evaluation via /sample-evaluation: 520.3 ms
- /sample-deliverables via /sample-deliverables: 571.2 ms
- /case-studies via /case-studies: 293.9 ms
- /contact via /contact: 154.2 ms
- /contact/robot-team via /contact/robot-team: 73.2 ms
- /contact/site-operator via /contact/site-operator: 208.8 ms
- /help via /help: 190.7 ms
- /help/contact via /help/contact: 111 ms
- /help/category/:categorySlug via /help/category/capture: 140.9 ms
- /help/article/:articleSlug via /help/article/package-access: 218.9 ms
- /exact-site-hosted-review via /exact-site-hosted-review: 227.7 ms
- /book-exact-site-review via /book-exact-site-review: 94.3 ms
- /how-it-works via /how-it-works: 374.7 ms
- /proof via /proof: 389.4 ms
- /faq via /faq: 247.7 ms
- /governance via /governance: 141.7 ms
- /about via /about: 305.4 ms
- /docs via /docs: 462.1 ms
- /updates via /updates: 361.6 ms
- /blog via /blog: 229.8 ms
- /careers via /careers: 106.1 ms
- /solutions via /solutions: 188 ms
- /quality-standard via /quality-standard: 198 ms
- /qualified-opportunities via /qualified-opportunities: 244.9 ms
- /qualified-opportunities-guide via /qualified-opportunities-guide: 332.3 ms
- /pilot-exchange via /pilot-exchange: 352.4 ms
- /pilot-exchange-guide via /pilot-exchange-guide: 187.5 ms
- /partners via /partners: 129.4 ms
- /environments via /environments: 483.6 ms
- /marketplace via /marketplace: 161.9 ms
- /portal via /portal: 78.8 ms
- /sign-in via /sign-in: 336.9 ms
- /login via /login: 133.5 ms
- /signup via /signup: 129.5 ms
- /signup/business via /signup/business: 142.6 ms
- /signup/robot-team via /signup/robot-team: 302 ms
- /signup/site-operator via /signup/site-operator: 120.7 ms
- /signup/capturer via /signup/capturer: 80.2 ms
- /onboarding via /onboarding: 188 ms
- /forgot-password via /forgot-password: 150.6 ms
- /privacy via /privacy: 182.1 ms
- /terms via /terms: 339.5 ms
- /settings via /settings: 331.1 ms
- /requests/:requestId via /requests/perf-request: 127.6 ms
- /requests/:requestId/evidence via /requests/perf-request/evidence: 120.8 ms
- /requests/:requestId/qualification via /requests/perf-request/qualification: 287.9 ms
- /requests/:requestId/preview via /requests/perf-request/preview: 206.3 ms
- /admin/leads via /admin/leads: 260.4 ms
- /admin/leads/:requestId via /admin/leads/perf-request: 304.3 ms
- /admin/submissions via /admin/submissions: 216.3 ms
- /admin/submissions/:requestId via /admin/submissions/perf-request: 201.4 ms
- /admin/growth-ops-scorecard via /admin/growth-ops-scorecard: 488.3 ms
- /admin/company-metrics via /admin/company-metrics: 133.3 ms
- /admin/city-launch/austin via /admin/city-launch/austin: 208.8 ms
- /admin/city-launch/:citySlug via /admin/city-launch/austin: 409.6 ms
- /admin/growth-studio via /admin/growth-studio: 106.5 ms
- /dashboard via /dashboard: 247.6 ms
- /off-waitlist-signup via /off-waitlist-signup: 411.3 ms
- (404 fallback) via /__blueprint-performance-fallback__: 282.3 ms
