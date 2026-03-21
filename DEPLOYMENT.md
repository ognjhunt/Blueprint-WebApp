# Blueprint Deployment

## Build and Runtime

Blueprint uses a single build pipeline:

```bash
npm ci
npm run check
npm run test:coverage
npm run build
```

- Client build: Vite (`dist/public`)
- Server build: esbuild bundle from `server/index.ts` (`dist/index.js`)
- Runtime start command:

```bash
npm start
```

## Required Environment Variables

### Firebase (client)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- Optional: `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_MEASUREMENT_ID`

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

### Internal Marketplace + Pipeline
- `PIPELINE_SYNC_TOKEN`
- `BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET`
- Optional internal-only fallback: `PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS=true`

Launch-critical note:
- Leave `PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS` unset in paid/production flows so pipeline sync fails closed when inbound request bootstrap is missing.

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

## Notes

- Firestore is the active datastore.
- Live hosted-session state now prefers Redis when `REDIS_URL` is configured, then falls back to in-process memory, with Firestore acting as async mirroring/trail storage.
- Marketplace checkout and artifact entitlement flows are only truthful when Firebase Admin, Stripe checkout, and Stripe webhooks are all configured together.
- Legacy manual deployment scripts were removed; deployment should always run through project scripts.
- `client/public/robots.txt` must exist at build time and be served in production.
