# WSPEC-05: Stripe publishable-key handling — fail fast, no test-mode fallback

- Status: Proposed
- Priority: **P1 — major** (payments correctness)
- Area: `client/src/pages/Onboarding.tsx`, `OffWaitlistSignUpFlow.tsx`, `OutboundSignUpFlow.tsx`, `client/src/hooks/useStripeCheckout.ts`

## Problem

Checkout/onboarding paths fall back to hard-coded publishable keys when
`VITE_STRIPE_PUBLISHABLE_KEY` is unset — and the fallbacks are inconsistent across the
codebase:

- `Onboarding.tsx:1141`, `OffWaitlistSignUpFlow.tsx:1539`, `OutboundSignUpFlow.tsx:1522`
  fall back to a **`pk_test_...`** key.
- `useStripeCheckout.ts:10` falls back to a **`pk_live_...`** key.

If the env var is missing in a production build, three flows initialize Stripe.js in
test mode against live-mode server sessions (checkout breaks in a confusing way, or worse,
test-mode confirmation flows against real intent state), while a fourth flow goes live —
mode-mismatched behavior that depends on which page the user entered from. Publishable
keys are not secrets, so this is a correctness/mode-integrity issue rather than a leak.

## Proposed fix

1. Single module (`client/src/lib/stripeClient.ts`) that reads
   `VITE_STRIPE_PUBLISHABLE_KEY`, **throws at startup** (and renders a clear
   payments-unavailable state) when missing or malformed — no hard-coded fallbacks
   anywhere. All four call sites import it.
2. Build-time guard: production builds (`npm run build` with `NODE_ENV=production`) fail
   if the env var is absent or starts with `pk_test_` (env expectation recorded in
   `render.required.env.example`, enforced by a prebuild script).
3. Server cross-check (cheap): expose the server's Stripe mode (test/live derived from
   `STRIPE_SECRET_KEY` prefix) on a config endpoint; client logs/blocks on mode mismatch.

## Acceptance criteria

- [ ] No `pk_test_`/`pk_live_` literals remain in the client source (lint/grep check in CI).
- [ ] Production build without the env var fails; with a `pk_test_` value it fails.
- [ ] All checkout flows share the single Stripe client module; mode mismatch client↔server is detected and blocks checkout with a clear error.
