# Blueprint WebApp Technical Notes

## Stack

- Frontend: React 18 + TypeScript + Wouter + Tailwind
- Backend: Express + TypeScript (ESM)
- Build: Vite (client) + esbuild (server)
- Auth/Data: Firebase Auth + Firestore
- Payments: Stripe

## Local Workflow

```bash
npm ci
npm run check
npm run test:coverage
npm run build
npm run dev
```

## Architecture Summary

- `client/`: app UI and client flows
- `server/`: API routes, middleware, integrations
- `server/routes/api/*`: API handlers owned by server runtime
- `scripts/`: maintenance scripts (sitemap, asset audit, thumbnail tooling)

## Current Data Model Reality

- Firestore is the source of truth for operational app data.
- No active Drizzle/Postgres runtime path is used by the app.

## Repo Hygiene Guardrails

- `npm run audit:assets` enforces:
  - no root screenshot dump files
  - no oversized non-public repo files
  - no unreferenced assets under `client/public/images` and `client/public/thumbnails`
- Generated mapping files (`image-matches.json`, `thumbnail-urls.json`) are gitignored.

## Environment

Start from `.env.example` and set required values for Firebase, Stripe, public app URL, and Google OAuth IDs.
