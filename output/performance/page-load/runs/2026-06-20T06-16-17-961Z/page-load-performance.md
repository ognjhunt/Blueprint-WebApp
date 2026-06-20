# Page Load Performance

- Status: FAIL
- Started at: 2026-06-20T06:16:17.965Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 5000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 92
- Routes over budget: 19

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /signup/site-operator | /signup/site-operator | 200 | 110.2 ms | 110.2 ms | 36.8 ms | 30.2 ms | 118.8, 110.2, 83.4 |
| /help | /help | 200 | 79.2 ms | 79.2 ms | 47 ms | 37.4 ms | 118.1, 62, 79.2 |
| /earn | /earn | 200 | 65.2 ms | 65.2 ms | 41.6 ms | 33.1 ms | 78.4, 33.6, 65.2 |
| /terms | /terms | 200 | 64.2 ms | 64.2 ms | 46 ms | 12.5 ms | 69.7, 64.2, 62.9 |
| /sample-deliverables | /sample-deliverables | 200 | 62 ms | 62 ms | 27.2 ms | 14.6 ms | 60.3, 66.8, 62 |
| /capture-app/launch-access | /capture-app/launch-access | 200 | 60.7 ms | 60.7 ms | 21.3 ms | 5.6 ms | 30.5, 60.7, 71 |
| /site-worlds/:slug | /site-worlds/sw-chi-01 | 200 | 60.4 ms | 60.4 ms | 26.2 ms | 11.1 ms | 65.7, 50.5, 60.4 |
| /city/:citySlug | /city/austin | 200 | 54.8 ms | 54.8 ms | 17.7 ms | 9.3 ms | 64.5, 43.9, 54.8 |
| /updates | /updates | 200 | 54.5 ms | 54.5 ms | 24.5 ms | 15.4 ms | 57.7, 54.5, 49.1 |
| /sample-evaluation | /sample-evaluation | 200 | 54 ms | 54 ms | 22 ms | 11.6 ms | 38, 54, 61.4 |
| /qualified-opportunities-guide | /qualified-opportunities-guide | 200 | 53.9 ms | 53.9 ms | 24.9 ms | 15.5 ms | 53.3, 53.9, 58.3 |
| /docs | /docs | 200 | 53.3 ms | 53.3 ms | 25.7 ms | 11.6 ms | 62.1, 53.3, 38.4 |

## Over Budget

- /capture-app/launch-access via /capture-app/launch-access: 60.7 ms
- /for-capturers via /for-capturers: 50.1 ms
- /earn via /earn: 65.2 ms
- /city/:citySlug via /city/austin: 54.8 ms
- /world-models/:slug via /world-models/sw-chi-01: 50.5 ms
- /site-worlds/:slug via /site-worlds/sw-chi-01: 60.4 ms
- /sample-evaluation via /sample-evaluation: 54 ms
- /sample-deliverables via /sample-deliverables: 62 ms
- /help via /help: 79.2 ms
- /governance via /governance: 52.9 ms
- /about via /about: 51.9 ms
- /docs via /docs: 53.3 ms
- /updates via /updates: 54.5 ms
- /qualified-opportunities-guide via /qualified-opportunities-guide: 53.9 ms
- /pilot-exchange-guide via /pilot-exchange-guide: 51.3 ms
- /signup/site-operator via /signup/site-operator: 110.2 ms
- /terms via /terms: 64.2 ms
- /admin/submissions via /admin/submissions: 50.4 ms
- /dashboard via /dashboard: 50.1 ms
