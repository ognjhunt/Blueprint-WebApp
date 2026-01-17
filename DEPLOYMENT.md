# Deployment Instructions for Blueprint

There is an issue with the default build script in `package.json` that contains an invalid esbuild flag `--no-check`. This flag is causing deployment failures. We've provided several solutions to fix this issue.

## Firebase configuration (frontend + server)

Set the Firebase web config and Admin credentials in your deployment secrets before building:

- Copy the values from `.env.example` into your hosting/CI secrets using the exact Vite keys expected by `client/src/lib/firebase.ts`:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - Optional: `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_MEASUREMENT_ID`
- Provide Admin credentials for server routes that use `client/src/lib/firebaseAdmin.ts`:
  - `FIREBASE_SERVICE_ACCOUNT_JSON` (stringified JSON) **or**
  - `GOOGLE_APPLICATION_CREDENTIALS` (absolute path to the service account JSON in the runtime environment).

These variables must be available in the build/runtime environment (Replit secrets, hosting console, or CI) so both the Vite build and Express routes can initialize Firebase.

## Stripe configuration

Stripe checkout and onboarding routes require the secret key at runtime:

- `STRIPE_SECRET_KEY` (required; server startup fails fast if unset)
- `STRIPE_CONNECT_ACCOUNT_ID` (required for Connect features; server startup fails fast if unset)

The server validates required runtime variables at startup (`server/config/env.ts`). In production,
missing required values will halt the process with a clear error message.

## Error tracking (Sentry)

Client-side error tracking uses the Sentry browser SDK. Provide the DSN in your
deployment environment so Vite can inject it at build time:

- `VITE_SENTRY_DSN` (required to send events to Sentry)

Optional smoke test toggle:

- `VITE_ENABLE_ERROR_TRACKING_SMOKE_TEST=true` (exposes `window.runErrorTrackingSmokeTest()` for a
  one-time verification in staging/production).

### Smoke test steps

1. Deploy with `VITE_SENTRY_DSN` set (and the smoke test toggle if desired).
2. Open the deployed site in a browser.
3. In the devtools console, run:
   ```
   window.runErrorTrackingSmokeTest?.()
   ```
4. Confirm the "Sentry smoke test" event appears in the Sentry dashboard.

## Database usage (Firestore)

Blueprint stores application data in Firebase Firestore. Postgres/Drizzle schemas and migrations were removed because they were not referenced by the app runtime, and Firestore is the source of truth for these records. Ensure the Firebase Admin credentials (above) are present in production so server routes can access Firestore.

## Method 1: Pre-Deployment Script (Recommended)

This method fixes the package.json file before deployment:

1. **Run the pre-deployment script**:
   ```
   node pre-deploy.js
   ```
   This creates a backup of your package.json and modifies the build script to remove the problematic flag.

2. **Deploy your application** using Replit's deployment interface.

3. **Restore your original package.json** after deployment (optional):
   ```
   mv package.json.bak package.json
   ```

## Method 2: Manual Deployment

If Method 1 doesn't work, use the manual deployment script:

1. **Run the manual deployment script**:
   ```
   node manual-deploy.js
   ```
   
   This script bypasses package.json and correctly builds both the client and server components without the problematic flag.

2. **Deploy from the Replit interface** after the script successfully completes.

## Method 3: Fixing Deployment in Replit's Interface

If you prefer to use Replit's deployment interface directly:

1. Start the deployment process in Replit
2. When prompted for a build command, replace the default with:
   ```
   npx vite build && npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
   ```
3. Continue with the deployment process

## Troubleshooting

If you encounter deployment errors:

1. Clear the previous build by removing the `dist` directory:
   ```
   rm -rf dist
   ```

2. Try a different method from those listed above

3. Ensure all environment variables are properly set in Replit Secrets

4. If you're still facing issues, check the deployment logs for specific error messages

## Robots.txt and indexing headers (production)

Production deploys must serve `client/public/robots.txt` verbatim. The Vite build copies `client/public/*` into `dist/public/`, and the server explicitly serves `/robots.txt` from `dist/public/robots.txt`. In production, the server now fails startup if that file is missing so we never ship a hosting default like `Disallow: /`.【F:server/index.ts†L234-L257】

### Deployment checklist

1. Ensure `client/public/robots.txt` contains the intended directives (no generated defaults).
2. Confirm the build output includes the file:
   ```
   ls -l dist/public/robots.txt
   ```
3. Verify the deployed site serves the same content (no CDN/hosting override):
   ```
   curl -sS https://<your-domain>/robots.txt
   ```
4. Confirm no header-based overrides are set by the host/CDN (Cloud Run + Express do not set these by default). For any proxy/CDN you add, verify the response headers for `/` and `/robots.txt` do **not** include `X-Robots-Tag: noindex`:
   ```
   curl -sSI https://<your-domain>/ | rg -i 'x-robots-tag'
   curl -sSI https://<your-domain>/robots.txt | rg -i 'x-robots-tag'
   ```
