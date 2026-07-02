# Page Load Performance

- Status: PASS
- Started at: 2026-06-28T14:21:42.621Z
- Base URL: http://127.0.0.1:5187
- Budget: 50 ms median browser document-ready timing
- Samples per route: 3
- Route timeout: 10000 ms
- Warmup timeout: 1000 ms
- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement
- Routes measured: 108
- Routes over budget: 0

## Slowest Routes

| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |
|---|---:|---:|---:|---:|---:|---:|---|
| /world-models | /world-models | 200 | 14.5 ms | 14.5 ms | 10.6 ms | 5.8 ms | 11.7, 14.5, 14.5 |
| /become-a-capturer | /become-a-capturer | 200 | 14 ms | 14 ms | 10.4 ms | 4.9 ms | 14.3, 14, 13.9 |
| /capturer | /capturer | 200 | 13.8 ms | 13.8 ms | 9.5 ms | 4.1 ms | 13.1, 14.5, 13.8 |
| /capture-jobs | /capture-jobs | 200 | 13.7 ms | 13.7 ms | 8.8 ms | 4 ms | 12, 13.7, 15 |
| /for-capturers | /for-capturers | 200 | 13.6 ms | 13.6 ms | 11.6 ms | 3.8 ms | 12.3, 16.5, 13.6 |
| /earn | /earn | 200 | 13.3 ms | 13.3 ms | 9.9 ms | 4.7 ms | 13.3, 14.3, 12.4 |
| /capturers | /capturers | 200 | 12.8 ms | 12.8 ms | 9.2 ms | 4.4 ms | 13.4, 12.8, 12 |
| /capture-network | /capture-network | 200 | 12.5 ms | 12.5 ms | 9.1 ms | 4.2 ms | 13.2, 12.5, 12.5 |
| /capturer-access | /capturer-access | 200 | 12 ms | 12 ms | 8.6 ms | 3.7 ms | 12.1, 11.9, 12 |
| /site-worlds | /site-worlds | 200 | 11.6 ms | 11.6 ms | 9.1 ms | 4.4 ms | 11.6, 11.7, 11.3 |
| /marketplace | /marketplace | 200 | 11.6 ms | 11.6 ms | 9.2 ms | 4.4 ms | 11.6, 11.4, 11.6 |
| /product | /product | 200 | 11.3 ms | 11.3 ms | 10.6 ms | 3.9 ms | 9.8, 11.3, 11.6 |
