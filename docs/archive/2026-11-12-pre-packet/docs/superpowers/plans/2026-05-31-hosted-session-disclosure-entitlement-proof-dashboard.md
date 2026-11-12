# Hosted Session Disclosure And Entitlement Proof Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only hosted-session disclosure and entitlement proof dashboard that lets operators, buyers with access, and review agents see exactly what is proven, unavailable, fallback-backed, or blocked for a hosted session without mutating production Firestore, Stripe, hosted runtime, or entitlement state.

**Architecture:** Add one deterministic server-side proof reducer that converts existing hosted-session records, entitlement/payment records, runtime metadata, launch-readiness data, and package/provenance fields into a stable dashboard DTO. Expose the DTO through a protected GET route, render it in `HostedSessionWorkspace`, and attach an agent UX review gate that checks truth labels before launch.

**Tech Stack:** TypeScript, Express, existing Firebase Admin read paths, existing hosted-session live-store/read helpers, React/Vite, Vitest/Testing Library, existing Graphify architecture pilot after code edits.

---

## Evidence Read

- Root doctrine and nested guides: `AGENTS.md`, `server/AGENTS.md`, `client/src/AGENTS.md`.
- Launch and proof doctrine: `docs/architecture/public-display-ready-claims-matrix.md`, `docs/architecture/source-of-truth-map.md`, `docs/architecture/command-safety-matrix.md`.
- Architecture graph: `graphify-out/GRAPH_REPORT.md`.
- Hosted-session seams: `server/routes/site-world-sessions.ts`, `server/types/hosted-session.ts`, `client/src/types/hostedSession.ts`, `client/src/pages/HostedSessionSetup.tsx`, `client/src/pages/HostedSessionWorkspace.tsx`.
- Entitlement/payment seams: `server/routes/api/create-checkout-session.ts`, `server/routes/stripe-webhooks.ts`, `server/routes/marketplace-entitlements.ts`, `server/utils/accounting.ts`, `server/utils/robot-agent-commerce.ts`, `server/routes/agent-access.ts`.
- Runtime metadata seams: `server/utils/hosted-session-runtime.ts`, `server/utils/hosted-session-launch-readiness.ts`, `server/utils/hosted-session-orchestrator.ts`, `server/utils/hosted-session-live-store.ts`, `server/utils/hosted-session-route-helpers.ts`.

## Non-Goals And Stop Rules

- Do not create checkout sessions, run Stripe webhook simulations against production, write entitlements, provision hosted runtime sessions, start runtime jobs, or call hosted runtime mutation endpoints.
- Do not call `writeSession()`, `updateSession()`, `createRuntimeOnlySession()`, `createHostedSessionRun()`, reset/step/run/export runtime handlers, or any route that changes `hostedSessions`, `buyerOrders`, or `marketplaceEntitlements`.
- Do not infer paid entitlement from `buyerType`, admin access, session ownership, launch-readiness success, presentation manifests, or runtime availability.
- Do not convert fallback/reference-frame output into live-render proof.
- Stop if the dashboard needs an owner-system proof that is unavailable from current read-only records. Label that axis `unknown` or `unavailable` and show the owning system.

## Current Seams

- Session truth starts in `server/routes/site-world-sessions.ts` and `server/types/hosted-session.ts`. Snapshot reads should use `loadHostedSession()` and the live-store/Firestore read path, not `readFreshHostedSession()`, because fresh runtime reads can update cached session state.
- Entitlement truth starts in Stripe checkout/webhook output and Firestore `buyerOrders`/`marketplaceEntitlements`. The hosted-session route already records `commerce.entitlementId`, `commerce.orderId`, `commerce.mode`, `commerce.sku`, and `commerce.accessSource` on `HostedSessionRecord`.
- Runtime metadata truth starts in runtime registration, health, and `runtime_metadata.json` written by the orchestrator. The dashboard should first consume already-recorded `runtimeHandle`, `presentationRuntime`, `presentationLaunchState`, `latestRuntimeFailure`, `launchContext`, and `siteModel` fields.
- Package/provenance truth starts in pipeline artifacts, canonical package URIs, registration/health records, backend variants, and provenance fields surfaced through `SiteModelSummary`.
- Client truth labels already exist in `HostedSessionWorkspace`, but they are distributed across status pills, quality rows, explorer links, diagnostics, and fallback messages. The dashboard should centralize them.

## Dashboard Contract

Create shared types in the existing hosted-session type family:

- Server: add to `server/types/hosted-session.ts` or create `server/types/hosted-session-proof-dashboard.ts` and re-export from the route.
- Client: add matching types to `client/src/types/hostedSession.ts` or `client/src/types/hostedSessionProof.ts`.

Required DTO shape:

```ts
export type HostedSessionProofAxis =
  | "session"
  | "entitlement"
  | "runtime_metadata"
  | "package_provenance";

export type HostedSessionProofStatus =
  | "verified"
  | "available_readonly"
  | "allowed_not_entitlement_proof"
  | "fallback"
  | "blocked"
  | "unavailable"
  | "unknown"
  | "not_applicable";

export interface HostedSessionProofItem {
  axis: HostedSessionProofAxis;
  status: HostedSessionProofStatus;
  label: string;
  detail: string;
  ownerSystem: string;
  proofIds: string[];
  proofUris: string[];
  blockers: string[];
  fallbackLabel?: string;
  lastCheckedAt: string;
}

export interface HostedSessionProofDashboard {
  sessionId: string;
  siteWorldId: string;
  generatedAt: string;
  summaryStatus: HostedSessionProofStatus;
  items: HostedSessionProofItem[];
  review: {
    agentRole: "webapp-review";
    secondaryRole: "solutions-engineering-agent";
    requiredBeforePublicLaunchClaim: boolean;
    checklist: string[];
  };
}
```

Status precedence for `summaryStatus`:

1. `blocked` if any axis is blocked.
2. `fallback` if any buyer-visible output is fallback/reference-backed and no axis is blocked.
3. `unknown` if any required owner-system proof was not read.
4. `unavailable` if a required record is absent and no stronger status applies.
5. `allowed_not_entitlement_proof` only when access is allowed by admin/session-owner but no paid entitlement is proven.
6. `available_readonly` when the dashboard has a non-mutating record but not enough proof to call it verified.
7. `verified` only when all required axes have owner-system proof for the displayed claim.

## Axis Rules

### Session State

Owner system: WebApp hosted-session route, live store, and Firestore `hostedSessions`.

- `verified`: `HostedSessionRecord.status` is `ready` or `running`, the record has a `sessionId`, `siteWorldId`, and mode-specific availability proof.
- `available_readonly`: record exists but is `creating` or `stopped`, or mode-specific proof is incomplete.
- `blocked`: record status is `failed`, `latestRuntimeFailure` exists, or active launch state is blocked.
- `unavailable`: no session record exists for the requested session.
- Required labels:
  - `No hosted session record`
  - `Session starting`
  - `Session stopped`
  - `Session failed`
  - `Review files available`
  - `Live hosted workspace available`

### Entitlement State

Owner system: Stripe checkout/webhooks and Firestore `buyerOrders`/`marketplaceEntitlements`.

- `verified`: `commerce.entitlementId` resolves to a `marketplaceEntitlements` record with `access_state === "provisioned"` and the entitlement SKU/candidate ID matches the session/site-world candidate set.
- `available_readonly`: `commerce.orderId` or `commerce.entitlementId` exists, but the dashboard only has the session copy and has not read the owner record.
- `allowed_not_entitlement_proof`: `commerce.accessSource` or launch access indicates admin/session-owner access without paid entitlement proof.
- `fallback`: `commerce.accessSource === "agent_dry_run"` or the proof comes from dry-run commerce utilities.
- `blocked`: entitlement record is `revoked`, `manual_review_required`, mismatched to the requested site-world candidate IDs, or access check returned an entitlement blocker.
- `unavailable`: no entitlement/order reference exists and no owner-system entitlement was read.
- Required labels:
  - `Entitlement provisioned`
  - `Access allowed, not paid entitlement proof`
  - `Dry-run commerce only`
  - `Entitlement not proven`
  - `Entitlement requires manual review`
  - `Entitlement revoked`
  - `Entitlement does not match this site world`

### Runtime Metadata State

Owner system: hosted runtime registration/health, orchestrator `runtime_metadata.json`, recorded `runtimeHandle`, and WebApp live-store snapshot.

- `verified`: recorded runtime metadata has `runtime_base_url`, `site_world_id`, mode-specific runtime or presentation launch proof, and no current runtime failure.
- `available_readonly`: `runtimeHandle`, `presentationRuntime`, or `launchContext` exists, but the dashboard did not perform any live runtime probe.
- `fallback`: presentation launch is `artifact_backed`, viewer uses a reference frame, or `siteModel.fallback`/render source says fallback.
- `blocked`: `runtime_handle_missing`, runtime health blocker, `presentationLaunchState.status === "blocked"`, or `latestRuntimeFailure` exists.
- `unavailable`: no runtime handle, runtime metadata URI, registration, health, or presentation runtime exists.
- Required labels:
  - `Runtime metadata recorded`
  - `Runtime handle unavailable`
  - `Runtime readiness probe unavailable`
  - `Saved-file exploration`
  - `Reference render, not live stepped frame`
  - `Presentation UI unconfigured`
  - `Runtime failure recorded`

### Package And Provenance State

Owner system: Capture/Pipeline artifacts, package manifests, site-world registration, runtime health, and backend-variant provenance.

- `verified`: canonical package URI/version exists, registered and resolved canonical package values match or have an explicit accepted reason, and backend provenance is present for the selected backend.
- `available_readonly`: package/spec/registration/health URIs exist but provenance is partial.
- `fallback`: fallback mode is recorded or the active renderer is a fallback/reference artifact.
- `blocked`: canonical package mismatch, rights/provenance blocker, missing required canonical package URI for the selected mode, or package manifest read failure with a required claim.
- `unavailable`: no package URI, no site-world spec URI, and no provenance metadata.
- Required labels:
  - `Canonical package linked`
  - `Canonical package mismatch`
  - `No provenance metadata for active backend`
  - `Package metadata unavailable`
  - `Fallback package path`
  - `Capture provenance available`

## Proof Ownership Table

| Axis | Owner system | Repo read surface | Dashboard proof |
| --- | --- | --- | --- |
| Session lifecycle | WebApp hosted-session service, Redis/live-store, Firestore `hostedSessions` | `loadHostedSession()`, `getHostedSessionLiveStoreStatus()` | session id, status, mode, active operation, latest runtime failure |
| Entitlement/payment | Stripe, `buyerOrders`, `marketplaceEntitlements` | read-only Firestore accessor plus session `commerce` copy | entitlement id, order id, SKU/candidate match, access state, access source |
| Runtime metadata | Hosted runtime provider, orchestrator metadata, runtime registration/health | recorded `runtimeHandle`, `presentationRuntime`, `launchContext`, `siteModel`, optional existing launch-readiness payload | runtime base URL presence, metadata URI, health status, launch mode state, failure diagnostic |
| Package/provenance | Capture/Pipeline package artifacts and backend provenance | `siteModel`, backend variants, `launchContext`, artifact URIs | canonical package URI/version, spec/registration/health URIs, backend provenance, fallback flags |
| UX disclosure | `webapp-review` agent with `solutions-engineering-agent` as semantic reviewer | dashboard screenshot/report and deterministic label checklist | labels do not overclaim payment, entitlement, runtime, package, rights, or fulfillment proof |

## Implementation Tasks

### Task 1: Add Shared Dashboard Types And Pure Reducer

Files:

- Create `server/utils/hosted-session-proof-dashboard.ts`.
- Add or export types from `server/types/hosted-session.ts`.
- Add mirrored client types in `client/src/types/hostedSession.ts` or a new `client/src/types/hostedSessionProof.ts`.
- Create `server/tests/hosted-session-proof-dashboard.test.ts`.

Steps:

- [ ] Write reducer tests first for these fixture cases: fully provisioned session, admin/session-owner access without entitlement, dry-run entitlement, failed runtime, missing runtime metadata, canonical package mismatch, missing provenance.
- [ ] Implement `buildHostedSessionProofDashboard(input)` as a pure function with no Firestore, Stripe, runtime, Redis, clock, or network access beyond the passed input.
- [ ] Use explicit status precedence and never infer entitlement from admin/session-owner access.
- [ ] Include `lastCheckedAt` from the caller-provided clock value, not `new Date()` inside the reducer.

Expected pure reducer signature:

```ts
export interface HostedSessionProofDashboardInput {
  session: HostedSessionRecord | null;
  entitlement: {
    id?: string;
    orderId?: string;
    sku?: string;
    accessState?: "provisioned" | "manual_review_required" | "revoked";
    source: "firestore" | "session_copy" | "agent_dry_run" | "admin" | "session_owner" | "none";
    candidateMatched: boolean | null;
  };
  runtimeStore: {
    backend: "redis" | "memory";
    configured: boolean;
    connected: boolean;
  };
  generatedAt: string;
}
```

Verification:

```bash
npm run test -- server/tests/hosted-session-proof-dashboard.test.ts
```

### Task 2: Add Read-Only Entitlement Proof Accessor

Files:

- Create `server/utils/hosted-session-entitlement-proof.ts`.
- Add tests in `server/tests/hosted-session-entitlement-proof.test.ts`.

Steps:

- [ ] Read `marketplaceEntitlements` and, when an order id is present, `buyerOrders` by id using existing Firebase Admin read helpers.
- [ ] Match the entitlement to hosted-session candidate IDs using `hostedSessionEntitlementIds()` and `hostedRuntimeEntitlementIds()` from `server/utils/hosted-session-route-helpers.ts`.
- [ ] Return a normalized entitlement proof object with `source`, `accessState`, `candidateMatched`, `blockers`, and owner-system ids.
- [ ] Treat `agent_dry_run` as `fallback`, not paid entitlement proof.
- [ ] Treat admin/session-owner access as `allowed_not_entitlement_proof`.
- [ ] Do not write buyer orders, entitlement records, checkout sessions, or Paperclip events.

Verification:

```bash
npm run test -- server/tests/hosted-session-entitlement-proof.test.ts
```

### Task 3: Expose Protected GET Dashboard Route

Files:

- Modify `server/routes/site-world-sessions.ts`.
- Extend `server/tests/site-world-sessions.test.ts`.

Route:

```text
GET /api/site-worlds/sessions/:sessionId/proof-dashboard
```

Steps:

- [ ] Register the route before any generic `/:sessionId` handler.
- [ ] Load the session with `loadHostedSession(sessionId)`.
- [ ] Authorize with the same hosted-session access policy used by protected workspace reads. If access fails, return a coarse forbidden/entitlement-required blocker without leaking session internals.
- [ ] Build entitlement proof with the read-only accessor.
- [ ] Pass session snapshot, entitlement proof, `getHostedSessionLiveStoreStatus()`, and caller-provided `generatedAt` into the pure reducer.
- [ ] Do not call `readFreshHostedSession()` from this route.
- [ ] Add regression tests that spy or mock the route module so `writeSession()`, `updateSession()`, runtime launch helpers, checkout helpers, and entitlement mutation helpers are not invoked.

Verification:

```bash
npm run test -- server/tests/site-world-sessions.test.ts
```

### Task 4: Render The Dashboard In HostedSessionWorkspace

Files:

- Create `client/src/components/hosted-session/HostedSessionProofDashboard.tsx`.
- Modify `client/src/pages/HostedSessionWorkspace.tsx`.
- Add or update `client/tests/pages/HostedSessionWorkspace.test.tsx`.

Steps:

- [ ] Fetch the proof dashboard after the workspace has a session id and auth token.
- [ ] Render one compact row per axis with status, owner system, primary proof ids, proof links, blockers, and fallback labels.
- [ ] Place the dashboard near the existing session status and diagnostics area so fallback/reference-frame labels are visible before a buyer interprets the viewport.
- [ ] Use the exact unavailable/fallback labels from this plan.
- [ ] Keep the UI dense and operator-oriented. Do not add marketing copy, apology copy, or broad "not launched" language.
- [ ] Preserve existing `HostedSessionWorkspace` fallback copy for reference frames and artifact-backed explorer views.

Verification:

```bash
npm run test -- client/tests/pages/HostedSessionWorkspace.test.tsx
```

### Task 5: Add Agent UX Review Gate

Files:

- Create `docs/qa/hosted-session-proof-dashboard-ux-review.md`.
- Create an output convention at `output/qa/hosted-session-proof-dashboard/latest/report.md` when the review is run.

Role:

- Primary: `webapp-review`.
- Secondary semantic reviewer: `solutions-engineering-agent`.

Review checklist:

- [ ] No dashboard label says `paid`, `fulfilled`, `entitled`, `live`, `rights cleared`, `production ready`, or `operationally ready` unless the matching owner-system proof axis is `verified`.
- [ ] Admin/session-owner access is labeled as access permission, not paid entitlement proof.
- [ ] Dry-run commerce is labeled as dry-run commerce only.
- [ ] Reference frames and artifact-backed explorers are labeled before or next to the visible output.
- [ ] Runtime metadata and package/provenance are shown as separate axes.
- [ ] Blockers name the owning system and do not imply WebApp can fix provider, Stripe, rights, or package gaps without that owner-system proof.

### Task 6: Full Local Verification

Run only local, repo-safe checks with mocked owner systems:

```bash
npm run test -- server/tests/hosted-session-proof-dashboard.test.ts server/tests/hosted-session-entitlement-proof.test.ts server/tests/site-world-sessions.test.ts client/tests/pages/HostedSessionWorkspace.test.tsx
npm run check
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

Do not run live Stripe, production Firestore, hosted runtime mutation, Paperclip send, Notion write, Render deploy, or entitlement mutation commands for this dashboard.

## Acceptance Criteria

- The dashboard displays session state, entitlement state, runtime metadata state, and package/provenance state as separate rows.
- Every row has a deterministic status, proof owner, proof id/URI list, blockers, and a fallback/unavailable label when needed.
- `verified` is only used when the owner system for that axis is actually represented in the read-only proof.
- Admin/session-owner access and dry-run commerce cannot satisfy paid entitlement proof.
- Runtime metadata and package/provenance are not collapsed into generic "ready" language.
- Client tests cover fallback labels and prevent overclaiming.
- Server tests prove the new route is read-only and avoids production-like mutation helpers.
- The agent UX review role and checklist exist before public display claims rely on this dashboard.
