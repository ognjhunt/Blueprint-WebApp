# Blueprint Deployment

## Build and Runtime

Blueprint uses a single build pipeline:

```bash
npm ci
npm run check
npm run test:coverage
npm run build
```

Release gate:

```bash
npm run alpha:check
```

Launch preflight:

```bash
npm run alpha:preflight
```

Live alpha smoke:

```bash
npm run smoke:launch
```

- Client build: Vite (`dist/public`)
- Server build: esbuild bundle from `server/index.ts` (`dist/index.js`)
- Runtime start command:

```bash
npm start
```

## Render Blueprint

The repo now includes [render.yaml](/Users/nijelhunt_1/workspace/Blueprint-WebApp/render.yaml) for the primary alpha deployment path.

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/health/ready`

Render should hold all secrets in the service environment, not in `render.yaml`.

## Required Environment Variables

### Firebase (client)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- Optional: `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_MEASUREMENT_ID`

Launch-critical note:
- The client no longer falls back to source-level Firebase values. These variables must be present in the runtime environment used for builds and tests.

### Firebase Admin (server)
Provide one of the following, or run on Cloud Run / Cloud Functions with an attached service account:
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_APPLICATION_CREDENTIALS`

Launch-critical note:
- Buyer checkout auth, marketplace entitlements, pipeline attachment sync, creator ledgers, and inbound request persistence all depend on Firebase Admin being live in production.

### Contact + Signup Links
- `VITE_PUBLIC_APP_URL` (canonical public origin used for generated links)
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_APP_ID`
- Optional: `VITE_GOOGLE_MAPS_API_KEY`

### Stripe (server)
- `STRIPE_SECRET_KEY`
- `STRIPE_CONNECT_ACCOUNT_ID`
- `STRIPE_WEBHOOK_SECRET`
- `CHECKOUT_ALLOWED_ORIGINS`
- Optional: `STRIPE_PUBLIC_BASE_URL`, `STRIPE_ONBOARDING_REFRESH_URL`, `STRIPE_ONBOARDING_RETURN_URL`

### OpenClaw (server)
- `OPENCLAW_BASE_URL`
- `OPENCLAW_AUTH_TOKEN`
- `OPENCLAW_DEFAULT_MODEL`
- Optional per-lane overrides:
  `OPENCLAW_WAITLIST_AUTOMATION_MODEL`,
  `OPENCLAW_INBOUND_QUALIFICATION_MODEL`,
  `OPENCLAW_POST_SIGNUP_MODEL`,
  `OPENCLAW_SUPPORT_TRIAGE_MODEL`,
  `OPENCLAW_PAYOUT_EXCEPTION_MODEL`,
  `OPENCLAW_PREVIEW_DIAGNOSIS_MODEL`,
  `OPENCLAW_OPERATOR_THREAD_MODEL`

### Internal Marketplace + Pipeline
- `PIPELINE_SYNC_TOKEN`
- `BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET`
- Optional internal-only fallback: `PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS=true`
- Optional internal demo flags: `BLUEPRINT_ENABLE_DEMO_SITE_WORLDS=1`, `BLUEPRINT_DEMO_BUNDLE_PIPELINE_ROOT=/abs/path`, `BLUEPRINT_HOSTED_DEMO_SITE_WORLD_ID=<id>`

Launch-critical note:
- Leave `PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS` unset in paid/production flows so pipeline sync fails closed when inbound request bootstrap is missing.
- Leave demo site-world flags unset in production unless you explicitly want the internal demo world exposed.

### Redis (server, recommended for live hosted sessions)
- Optional but recommended: `REDIS_URL`
- Optional: `RATE_LIMIT_REDIS_URL` if you want rate limiting isolated from session live-state storage

For Upstash, use the TLS Redis URL from the Connect panel, for example:

```bash
REDIS_URL=rediss://default:<token>@active-phoenix-39183.upstash.io:6379
```

### Error Tracking
- Optional: `VITE_SENTRY_DSN`
- Optional: `VITE_ENABLE_ERROR_TRACKING_SMOKE_TEST=true`

### Autonomous Alpha Automation

These should be enabled for the no-human-in-the-loop alpha configuration:

- `BLUEPRINT_WAITLIST_AUTOMATION_ENABLED=1`
- `BLUEPRINT_INBOUND_AUTOMATION_ENABLED=1`
- `BLUEPRINT_SUPPORT_TRIAGE_ENABLED=1`
- `BLUEPRINT_PAYOUT_TRIAGE_ENABLED=1`
- `BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED=1`

Post-signup automation also requires:

- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID`
- `POST_SIGNUP_SPREADSHEET_ID` or `SPREADSHEET_ID`
- `SLACK_WEBHOOK_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

## Notes

- Firestore is the active datastore.
- In production, public world-model pages should surface pipeline-backed site worlds only. Static fixture cards are for non-production and explicit demo mode.
- Live hosted-session state now prefers Redis when `REDIS_URL` is configured, then falls back to in-process memory, with Firestore acting as async mirroring/trail storage.
- Marketplace checkout and artifact entitlement flows are only truthful when Firebase Admin, Stripe checkout, and Stripe webhooks are all configured together.
- Marketplace search and checkout now fail toward live `marketplace_items` inventory in production instead of silently relying on static sample content.
- Legacy manual deployment scripts were removed; deployment should always run through project scripts.
- `client/public/robots.txt` must exist at build time and be served in production.
- `npm run alpha:preflight` is the launch-environment validator for Render and should pass before promoting the service.
- `npm run smoke:launch` is the live alpha smoke runner for `/health`, `/health/ready`, OpenClaw, inbound qualification, and post-signup workflows.
