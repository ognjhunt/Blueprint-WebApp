# Page Load Performance

- Status: FAIL
- Started at: 2026-06-28T13:15:02.946Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 10000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 108
- Routes over budget: 63

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /terms | /terms | 200 | 563.6 ms | 563.6 ms | 28 ms | 13.7 ms | 81.7, 8633.5, 563.6 |
| /site-worlds/:slug/workspace | /site-worlds/sw-chi-01/workspace | 200 | 528.3 ms | 528.3 ms | 59.5 ms | 49.2 ms | 316.6, 528.3, 599.1 |
| /world-models | /world-models | 200 | 459.4 ms | 459.4 ms | 42.3 ms | 32.4 ms | 435.7, 459.4, 651.6 |
| /site-worlds | /site-worlds | 200 | 443.3 ms | 443.3 ms | 42.6 ms | 32.6 ms | 443.3, 459.9, 357.2 |
| /for-robot-integrators | /for-robot-integrators | 200 | 440.4 ms | 440.4 ms | 55.7 ms | 45.3 ms | 103.1, 440.4, 631.6 |
| /product | /product | 200 | 386.6 ms | 386.6 ms | 32.8 ms | 14.6 ms | 252.2, 386.6, 899.5 |
| /app/runs/:runId | /app/runs/perf-runId | 200 | 384.3 ms | 384.3 ms | 39 ms | 29.5 ms | 454.3, 384.3, 151.6 |
| /sites | /sites | 200 | 382.6 ms | 382.6 ms | 33.8 ms | 23.5 ms | 382.6, 314.8, 506.1 |
| /app/packs/:siteId | /app/packs/perf-siteId | 200 | 311.4 ms | 311.4 ms | 37.1 ms | 27.6 ms | 246.8, 311.4, 422.6 |
| /site-worlds/:slug | /site-worlds/sw-chi-01 | 200 | 271.6 ms | 271.6 ms | 51.4 ms | 41.2 ms | 271.6, 86.5, 377.5 |
| /app/policies | /app/policies | 200 | 257.3 ms | 257.3 ms | 31.5 ms | 21.5 ms | 257.3, 388.6, 137.7 |
| /app/packs | /app/packs | 200 | 252.3 ms | 252.3 ms | 33.9 ms | 21 ms | 817.4, 216.6, 252.3 |

## Over Budget

- / via /: 128.8 ms
- /capture-app via /capture-app: 68.2 ms
- /capturer via /capturer: 76.3 ms
- /capturer-access via /capturer-access: 53 ms
- /become-a-capturer via /become-a-capturer: 71.8 ms
- /for-capturers via /for-capturers: 52.3 ms
- /earn via /earn: 50.4 ms
- /sites via /sites: 382.6 ms
- /sites/:slug via /sites/sw-chi-01: 160.9 ms
- /world-models via /world-models: 459.4 ms
- /world-models/:slug via /world-models/sw-chi-01: 143.8 ms
- /world-models/:slug/workspace via /world-models/sw-chi-01/workspace: 228.6 ms
- /site-worlds via /site-worlds: 443.3 ms
- /site-worlds/:slug via /site-worlds/sw-chi-01: 271.6 ms
- /site-worlds/:slug/start via /site-worlds/sw-chi-01/start: 97.9 ms
- /site-worlds/:slug/workspace via /site-worlds/sw-chi-01/workspace: 528.3 ms
- /for-site-operators via /for-site-operators: 99.7 ms
- /for-robot-integrators via /for-robot-integrators: 440.4 ms
- /product via /product: 386.6 ms
- /readiness via /readiness: 193.2 ms
- /readiness-pack via /readiness-pack: 213.8 ms
- /agents via /agents: 86.4 ms
- /pricing via /pricing: 61.6 ms
- /case-studies via /case-studies: 164.2 ms
- /contact via /contact: 121.6 ms
- /help via /help: 72 ms
- /help/article/:articleSlug via /help/article/package-access: 64 ms
- /exact-site-hosted-review via /exact-site-hosted-review: 116.1 ms
- /how-it-works via /how-it-works: 156.5 ms
- /about via /about: 98.9 ms
- /updates via /updates: 128.8 ms
- /blog via /blog: 135.6 ms
- /solutions via /solutions: 81.4 ms
- /quality-standard via /quality-standard: 104.7 ms
- /qualified-opportunities-guide via /qualified-opportunities-guide: 79.3 ms
- /login via /login: 53.9 ms
- /onboarding via /onboarding: 67.2 ms
- /privacy via /privacy: 60.4 ms
- /terms via /terms: 563.6 ms
- /settings via /settings: 114 ms
- /requests/:requestId via /requests/perf-request: 91.1 ms
- /requests/:requestId/evidence via /requests/perf-request/evidence: 67 ms
- /requests/:requestId/preview via /requests/perf-request/preview: 115.8 ms
- /admin/company-metrics via /admin/company-metrics: 153.8 ms
- /admin/growth-studio via /admin/growth-studio: 144 ms
- /dashboard via /dashboard: 154.8 ms
- /internal/design-system via /internal/design-system: 199.3 ms
- /off-waitlist-signup via /off-waitlist-signup: 116.6 ms
- /join via /join: 158.5 ms
- /app via /app: 216.7 ms
- /app/runs via /app/runs: 252.2 ms
- /app/runs/:runId via /app/runs/perf-runId: 384.3 ms
- /app/packs via /app/packs: 252.3 ms
- /app/packs/:siteId via /app/packs/perf-siteId: 311.4 ms
- /app/policies via /app/policies: 257.3 ms
- /app/data via /app/data: 181.2 ms
- /app/entitlements via /app/entitlements: 88 ms
- /ops via /ops: 188.1 ms
- /ops/supply via /ops/supply: 230.5 ms
- /ops/city-launch via /ops/city-launch: 122.6 ms
- /ops/evidence via /ops/evidence: 154.5 ms
- /ops/handoff via /ops/handoff: 158 ms
- /ops/spend via /ops/spend: 104.2 ms
