# Page Load Performance

- Status: PASS
- Started at: 2026-06-28T14:18:11.394Z
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
| /become-a-capturer | /become-a-capturer | 200 | 31.1 ms | 31.1 ms | 28 ms | 11.6 ms | 31.1, 31.5, 28.2 |
| /capturer-access | /capturer-access | 200 | 30.6 ms | 30.6 ms | 30 ms | 12.6 ms | 33.4, 30.3, 30.6 |
| /updates | /updates | 200 | 30.6 ms | 30.6 ms | 26 ms | 17.5 ms | 38.4, 28.6, 30.6 |
| /city/:citySlug | /city/austin | 200 | 29.9 ms | 29.9 ms | 19 ms | 5.9 ms | 15.3, 36.6, 29.9 |
| /book-exact-site-review | /book-exact-site-review | 200 | 29.4 ms | 29.4 ms | 28 ms | 11.5 ms | 29.4, 60.6, 24.9 |
| /sites | /sites | 200 | 28.9 ms | 28.9 ms | 28.7 ms | 13.6 ms | 18.5, 28.9, 32.9 |
| /world-models | /world-models | 200 | 27.9 ms | 27.9 ms | 23.2 ms | 8.1 ms | 19, 27.9, 44.2 |
| /how-it-works | /how-it-works | 200 | 27.8 ms | 27.8 ms | 23.8 ms | 13.3 ms | 32.2, 27.8, 23.8 |
| /capturer | /capturer | 200 | 27.2 ms | 27.2 ms | 24.6 ms | 9.1 ms | 28, 24.9, 27.2 |
| /solutions | /solutions | 200 | 27.2 ms | 27.2 ms | 21.1 ms | 11 ms | 27.2, 50.7, 22.2 |
| /help/category/:categorySlug | /help/category/capture | 200 | 26 ms | 26 ms | 21 ms | 12 ms | 30.3, 26, 20.4 |
| /help/contact | /help/contact | 200 | 25.1 ms | 25.1 ms | 21.9 ms | 11.1 ms | 22.1, 25.1, 26.4 |
