# WSPEC-07: Wire the buyer `/app` surface to real data + entitlement gating

- Status: Proposed
- Priority: **P0 — launch blocker** (the paid deliverable is a static prototype)
- Area: `client/src/pages/app/*`, `client/src/components/blueprint/app/mockData.ts`, `client/src/app/routes.tsx`, server APIs

## Problem

The entire buyer product surface is a backend-free mock:

1. Every `/app` screen imports from `components/blueprint/app/mockData.ts` ("Buyer-app
   mock data — … backend-free"): `Runs.tsx:8-13`, `DataPackages.tsx:6-10`,
   `Overview.tsx:20`, `RunDetail.tsx:28`, `SiteDetail.tsx:31`, `SitePacks.tsx:8`,
   `Entitlements.tsx:8`, `Policies.tsx:6`. Static values include `RUN-2049`, budget
   `$6.5k/$15k`, and correlation `0.929` (the SC3-Eval paper's headline number, shown as
   if it were our operational metric).
2. All `/app` routes are `layout: "public"` with no auth/entitlement gate
   (`client/src/app/routes.tsx:321-327`): `/app/runs`, `/app/data`, `/app/entitlements`, etc.
3. Meanwhile the Stripe webhook writes *real* entitlements — so a paying buyer lands on a
   static prototype that never reflects their purchase, their runs, or their packages.

Mitigation already present: every page carries an "Illustrative data, not live
operational state" disclaimer (e.g. `DataPackages.tsx:29,150`, `Runs.tsx:48,201`), so
this is doctrine-compliant labeling — but it means the core buyer deliverable does not
functionally exist.

## Why this blocks beta

A beta means real buyers with real entitlements. With `/app` mocked and public: buyers
can't see what they bought (support load, churn, refunds), and the papers' credibility
numbers (0.929 r) are displayed in a context that invites misreading as our live
performance. This is the single largest gap between "site demo" and "sellable product."

## Proposed fix

Phased, aligned with the pipeline-side contracts (pipeline audit SPEC-05's
`fixture_evaluator_only` propagation):

1. **Auth + entitlement gating now:** move `/app/*` routes behind authenticated layout;
   an account with no entitlements sees an empty/onboarding state, not the mock. Keep
   the mock reachable only at an explicitly-labeled `/app/demo` (or behind the existing
   demo flag) for sales.
2. **Read APIs:** server endpoints backed by Firestore for the buyer's entitlements,
   runs, and packages (schema comes from the pipeline webapp-sync contract). Wire
   Overview/Runs/DataPackages/Entitlements to them first (list + detail).
3. **Truth labeling on live data:** carry provenance/rights/consent fields and
   `fixture_evaluator_only` / generated-media flags from pipeline sync payloads into the
   UI (the mock's provenance/rights presentation is the design target — keep it, feed it
   real values).
4. **Remove paper metrics from operational contexts:** correlation numbers cited from
   OSCAR/SC3-Eval belong on methodology/marketing pages with citation, never on run
   dashboards unless computed from our own anchored runs (pipeline SPEC-06/11 gates).
5. Empty-state honesty: where live data doesn't exist yet (e.g. correlation anchors),
   show "not yet measured" per doctrine rather than illustrative values.

## Acceptance criteria

- [ ] `/app/*` requires auth; entitlement-less accounts get an empty state; the mock exists only under an explicit demo path.
- [ ] A test purchase (Stripe test mode) results in the buyer seeing their real entitlement and its packages/runs in `/app`.
- [ ] No paper-sourced metric appears in operational UI; live metrics render only when backed by synced pipeline artifacts, with truth labels intact.
- [ ] e2e test covers login → entitlement → runs list → run detail on seeded data.
