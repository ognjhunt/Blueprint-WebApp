# Launch / Beta Readiness Audit — 2026-07-02 (WebApp)

Companion to the pipeline audit at
`BlueprintCapturePipeline/docs/specs/launch-audit-2026-07-02/`. That audit covers the
capture→package pipeline, world-model backends (OSCAR / SC3-Eval alignment, Cosmos3-Nano
adapter), data curation quality, and launch-gate integrity. This one covers the buyer,
payments, and ops surface.

Verified healthy in this audit (no action needed):

- `npm run check` (full typecheck) passes clean on a fresh install.
- Stripe webhook signature verification + idempotency (`server/routes/stripe-webhooks.ts:238-256`).
- Server-side price recomputation — client price never trusted (`create-checkout-session.ts:367-375`).
- Payout execution is human-gated (`server/lib/stripe.ts:115-130`).
- Admin routes enforce `requireAdmin`/role checks; internal routes use shared-token with `timingSafeEqual`, fail closed.
- No committed `.env` secrets; `render.required.env.example` covers the secrets the server consumes.
- Provenance/rights/consent are modeled as first-class in the buyer-app content (rights items, provenance badges, generated-media labeling).

## Specs

| Spec | Title | Priority |
|------|-------|----------|
| [WSPEC-01](WSPEC-01-storage-security-rules.md) | Deploy real Firebase Storage security rules | P0 |
| [WSPEC-02](WSPEC-02-bucket-cors-scoping.md) | Scope bucket CORS away from `*` | P1 |
| [WSPEC-03](WSPEC-03-scenes-tenant-isolation.md) | Tenant isolation on `scenes` collection | P1 |
| [WSPEC-04](WSPEC-04-robot-eval-endpoint-auth.md) | Auth + rate limits on robot-eval job-request endpoint | P1 |
| [WSPEC-05](WSPEC-05-stripe-key-handling.md) | Stripe publishable-key handling: fail fast, no test-mode fallback | P1 |
| [WSPEC-06](WSPEC-06-demo-site-worlds-purchase-guard.md) | Demo site-worlds can never be purchasable in production | P1 |
| [WSPEC-07](WSPEC-07-buyer-app-real-data.md) | Wire buyer `/app` surface to real data + entitlement gating | P0 |
| [WSPEC-08](WSPEC-08-repo-artifact-cleanup.md) | Remove committed run artifacts / junk from the repo | P2 |
| [WSPEC-09](WSPEC-09-supported-city-truth.md) | `backend_supported` must reflect real supply (Durham) | P1 |

Severity: **P0** = must fix before external beta; **P1** = must fix before paid launch /
strongly recommended before beta; **P2** = cleanup.
