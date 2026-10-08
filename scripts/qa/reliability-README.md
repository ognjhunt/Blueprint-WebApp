# Scoped reliability replay

The runners reuse Vitest, real route modules, Firebase emulators, and the normal Vite client. Provider dispatch and external mail remain disabled. Synthetic bytes test workflow contracts; they do not establish video perception accuracy or production durability.

```bash
RELIABILITY_OUTPUT_DIR=/absolute/private/E npx vitest run server/tests/reliability-storage-dependencies.test.ts --maxWorkers=1 --minWorkers=1
npx vitest run scripts/qa/reliability-schema.test.ts
node scripts/qa/reliability-aggregate.mjs /absolute/private/program-root
```

The aggregator reads `A`–`E` case/result exports, and optionally journey exports, from the private program root. `semanticHash` uses canonical sorted JSON of kind, family, meaningful parameters, expected transitions, source ID and split. It ignores random IDs, seeds, code versions, and repeat number. Repeated attempts are retained separately. Any failure, partial execution, or blocker cannot be hidden by a passing repeat. Infrastructure and judgment are separate denominators. Missing results remain unexecuted. Latency and known/unknown cost are reported by execution layer; simulation latency cannot establish live latency.

Cases in `reliability-storage-cases.mjs` freeze37 exact object-proof conditions. The actual registered self-capture status callback and object identity validators run with mocked authorization, object storage and in-memory Firestore. Captured generation, manifest hashes, receipt content, readback races, dependency failures, and foreign bindings are independently varied. Status reads must preserve database rows. This suite is not browser or durable-store evidence.

For real mounted handlers and a normal UI, start the repository's configured disposable Firestore and Storage emulators on8080/9199, then:

```bash
RELIABILITY_PROJECT=demo-blueprint-reliability-a RELIABILITY_APP_PORT=4181 node scripts/qa/reliability-local-app.mjs
```

Only `demo-blueprint-reliability`, `demo-blueprint-reliability-a`, and `demo-blueprint-reliability-b` are accepted; A and B use distinct projects and ports. The launcher uses NODE_ENV=test to disable local email-key fallback, strips inherited credentials, disables local dotenv bootstrapping, uses synthetic local encryption/signing material, guards application HTTP/fetch dispatch and redirects, fixes SDK emulator addresses to loopback, and fails if either emulator is absent. It mounts actual intake, self-capture, task brief, and CSRF handlers plus the actual Vite app; no API response is intercepted. The local ingress trusts loopback proxies only, matching the deployed ingress contract. Independent synthetic actors may provide simulated proxy-origin IPs; actual email/IP anti-abuse limits remain active. No workers or schedulers start. Notification intent may persist, but no inbox delivery or model assessment is claimed. Browser runners must also block external requests. Check `/api/reliability/health` for mode; it creates no records.

Journey records must distinguish boundary completion from `fullJourneyComplete`. A submitted intake, returned status, or processed notification alone cannot satisfy the full upload-to-assessment customer journey gate. Representative video evaluation, live-provider results, required-stage outputs and actual deployments require their own evidence. Automated labels remain provisional.

Dedicated intake browser suites use their own servers and are excluded from the default server sweep. They retain exact tests and must run explicitly for this program:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test --config playwright.intake.config.ts
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test --config playwright.intake-backend.config.ts
```
