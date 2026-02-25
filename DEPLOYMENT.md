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
Provide one:
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_APPLICATION_CREDENTIALS`

### Contact + Signup Links
- `VITE_PUBLIC_APP_URL` (canonical public origin used for generated links)
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_APP_ID`
- Optional: `VITE_GOOGLE_MAPS_API_KEY`

### Stripe (server)
- `STRIPE_SECRET_KEY`
- `STRIPE_CONNECT_ACCOUNT_ID`
- Optional: `STRIPE_PUBLIC_BASE_URL`, `STRIPE_ONBOARDING_REFRESH_URL`, `STRIPE_ONBOARDING_RETURN_URL`

### Error Tracking
- Optional: `VITE_SENTRY_DSN`
- Optional: `VITE_ENABLE_ERROR_TRACKING_SMOKE_TEST=true`

## Notes

- Firestore is the active datastore.
- Legacy manual deployment scripts were removed; deployment should always run through project scripts.
- `client/public/robots.txt` must exist at build time and be served in production.
