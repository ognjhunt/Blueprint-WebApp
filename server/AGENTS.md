# Server Agent Guide

This directory owns Express routes, server contracts, agent runtime helpers, Firestore/Firebase Admin usage, Stripe/entitlement flows, hosted-session backend behavior, and launch/GTM utilities.

Read root [`AGENTS.md`](../AGENTS.md), [`DEPLOYMENT.md`](../DEPLOYMENT.md), and [`docs/architecture/command-safety-matrix.md`](../docs/architecture/command-safety-matrix.md) before running server scripts.

Agent discovery: use this file for `server/**` details, but root `AGENTS.md` and `docs/architecture/source-of-truth-map.md` still govern product truth, Notion/Paperclip boundaries, and live-system authority.

Local conventions:

- Start route mapping in `server/routes.ts`; start app/middleware/rate-limit/CSP questions in `server/index.ts`.
- Keep external mutation behind existing auth, CSRF, policy, and human-gate checks.
- Do not infer capture, rights, privacy, entitlement, or hosted-session readiness from static fixtures.
- Treat `server/routes/site-world-sessions.ts`, `server/agents/runtime.ts`, `server/utils/cityLaunchExecutionHarness.ts`, and `server/utils/gtmSendExecutor.ts` as high-risk files.
- Preserve Firestore field names and API response shapes unless a task explicitly changes the contract.
- Do not touch env files or secrets.

Verification:

- Default: `npm run check`.
- Shared utility or route behavior: run the narrow Vitest file for the changed code.
- Broad server contract changes: `npm run test:coverage`.
- Live-send, deploy, provider, Paperclip, Notion, Firebase, or Stripe commands require explicit task authorization.
