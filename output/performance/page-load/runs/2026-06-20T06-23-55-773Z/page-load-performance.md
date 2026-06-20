# Page Load Performance

- Status: FAIL
- Started at: 2026-06-20T06:23:55.775Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 5000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 92
- Routes over budget: 8

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /sample-evaluation | /sample-evaluation | 200 | 143.3 ms | 143.3 ms | 32.8 ms | 22 ms | 143.3, 175.4, 62.5 |
| /pricing | /pricing | 200 | 92 ms | 92 ms | 21.6 ms | 14.4 ms | 56.5, 115.1, 92 |
| /world-models/:slug/start | /world-models/sw-chi-01/start | 200 | 79.4 ms | 79.4 ms | 20.8 ms | 9.6 ms | 79.4, 70.5, 107.4 |
| /proof | /proof | 200 | 72.8 ms | 72.8 ms | 26.2 ms | 18.3 ms | 70.9, 72.8, 87.7 |
| /site-worlds/:slug/workspace | /site-worlds/sw-chi-01/workspace | 200 | 68.3 ms | 68.3 ms | 17.7 ms | 9.7 ms | 34, 73.1, 68.3 |
| /sample-deliverables | /sample-deliverables | 200 | 58.3 ms | 58.3 ms | 28.3 ms | 15.3 ms | 107.4, 50.8, 58.3 |
| /case-studies | /case-studies | 200 | 57 ms | 57 ms | 26.8 ms | 14.3 ms | 53.5, 57, 80 |
| /admin/city-launch/austin | /admin/city-launch/austin | 200 | 52.4 ms | 52.4 ms | 14.2 ms | 6.7 ms | 52.4, 95.1, 39.4 |
| /faq | /faq | 200 | 48.9 ms | 48.9 ms | 24.3 ms | 10.8 ms | 48.9, 55.8, 36.8 |
| /about | /about | 200 | 45.1 ms | 45.1 ms | 21.9 ms | 14.9 ms | 48.8, 45.1, 29.9 |
| /qualified-opportunities-guide | /qualified-opportunities-guide | 200 | 44.4 ms | 44.4 ms | 19.5 ms | 8.7 ms | 68.7, 30.6, 44.4 |
| /world-models/:slug/workspace | /world-models/sw-chi-01/workspace | 200 | 43.5 ms | 43.5 ms | 16.4 ms | 9.2 ms | 43.5, 55.9, 26.9 |

## Over Budget

- /world-models/:slug/start via /world-models/sw-chi-01/start: 79.4 ms
- /site-worlds/:slug/workspace via /site-worlds/sw-chi-01/workspace: 68.3 ms
- /pricing via /pricing: 92 ms
- /sample-evaluation via /sample-evaluation: 143.3 ms
- /sample-deliverables via /sample-deliverables: 58.3 ms
- /case-studies via /case-studies: 57 ms
- /proof via /proof: 72.8 ms
- /admin/city-launch/austin via /admin/city-launch/austin: 52.4 ms
