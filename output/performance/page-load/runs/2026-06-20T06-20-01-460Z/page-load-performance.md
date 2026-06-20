# Page Load Performance

- Status: FAIL
- Started at: 2026-06-20T06:20:01.462Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 5000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 92
- Routes over budget: 23

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /sample-evaluation | /sample-evaluation | 200 | 82.7 ms | 82.7 ms | 30.5 ms | 15.7 ms | 66.7, 82.7, 104 |
| /pilot-exchange-guide | /pilot-exchange-guide | 200 | 80.2 ms | 80.2 ms | 23.2 ms | 11.3 ms | 80.2, 164.3, 40.4 |
| /site-worlds/:slug | /site-worlds/sw-chi-01 | 200 | 79.7 ms | 79.7 ms | 30.4 ms | 15.3 ms | 95.1, 54.2, 79.7 |
| /site-worlds/:slug/start | /site-worlds/sw-chi-01/start | 200 | 79.7 ms | 79.7 ms | 33.2 ms | 22.3 ms | 87.9, 58.6, 79.7 |
| /capture-app/launch-access | /capture-app/launch-access | 200 | 71 ms | 71 ms | 20.3 ms | 6 ms | 71, 70.8, 110.3 |
| /sample-deliverables | /sample-deliverables | 200 | 65.3 ms | 65.3 ms | 26 ms | 12.5 ms | 65.3, 47.2, 86.7 |
| /settings | /settings | 200 | 63.7 ms | 63.7 ms | 18 ms | 6.6 ms | 65.7, 63.7, 42.6 |
| /contact/site-operator | /contact/site-operator | 200 | 62.3 ms | 62.3 ms | 44.5 ms | 36.4 ms | 54.3, 62.5, 62.3 |
| /world-models/:slug | /world-models/sw-chi-01 | 200 | 60.7 ms | 60.7 ms | 26.1 ms | 11.8 ms | 60.7, 46.5, 68.4 |
| /pilot-exchange | /pilot-exchange | 200 | 60.7 ms | 60.7 ms | 23.3 ms | 13.7 ms | 60.7, 72.3, 40.4 |
| /world-models/:slug/start | /world-models/sw-chi-01/start | 200 | 59.7 ms | 59.7 ms | 27.1 ms | 12.7 ms | 50.1, 59.7, 66.5 |
| /site-worlds/:slug/workspace | /site-worlds/sw-chi-01/workspace | 200 | 59.3 ms | 59.3 ms | 30 ms | 15.9 ms | 48.9, 61.3, 59.3 |

## Over Budget

- / via /: 51.5 ms
- /capture-app/launch-access via /capture-app/launch-access: 71 ms
- /earn via /earn: 50.9 ms
- /world-models/:slug via /world-models/sw-chi-01: 60.7 ms
- /world-models/:slug/start via /world-models/sw-chi-01/start: 59.7 ms
- /world-models/:slug/workspace via /world-models/sw-chi-01/workspace: 52.2 ms
- /site-worlds/:slug via /site-worlds/sw-chi-01: 79.7 ms
- /site-worlds/:slug/start via /site-worlds/sw-chi-01/start: 79.7 ms
- /site-worlds/:slug/workspace via /site-worlds/sw-chi-01/workspace: 59.3 ms
- /for-robot-integrators via /for-robot-integrators: 50.7 ms
- /pricing via /pricing: 51.5 ms
- /sample-evaluation via /sample-evaluation: 82.7 ms
- /sample-deliverables via /sample-deliverables: 65.3 ms
- /case-studies via /case-studies: 52.3 ms
- /contact/site-operator via /contact/site-operator: 62.3 ms
- /faq via /faq: 50.2 ms
- /qualified-opportunities-guide via /qualified-opportunities-guide: 54.1 ms
- /pilot-exchange via /pilot-exchange: 60.7 ms
- /pilot-exchange-guide via /pilot-exchange-guide: 80.2 ms
- /privacy via /privacy: 52 ms
- /terms via /terms: 57.6 ms
- /settings via /settings: 63.7 ms
- /admin/leads/:requestId via /admin/leads/perf-request: 51.7 ms
