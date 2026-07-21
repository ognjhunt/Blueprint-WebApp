# Ship-To-Distribution Proof Loop

Date: 2026-05-31
Status: Draft-only operating spec
Owner: `growth-lead` for distribution posture, `webapp-codex` for repo-local implementation, `blueprint-cto` for proof and claim boundaries

## Purpose

Turn real shipped Blueprint proof into truthful public and internal drafts without inventing operational readiness.

This loop covers:

- website update drafts, including `/updates`, proof pages, catalog/search copy, and buyer-facing route notes
- search and discovery drafts for public page metadata, `site-content`, catalog search, and listing disclosure
- weekly community update draft packets
- monthly investor update draft packets
- internal workspace summaries and proof-bearing closeout notes

This spec does not authorize live publishing, live sends, Notion sync, Paperclip mutation, provider jobs, payment changes, rights clearance, city launch, or operational readiness claims. It defines the draft packet that later owner-specific routines may inspect.

## Doctrine

Use the repo source-of-truth hierarchy before writing distribution copy:

- Doctrine: `AGENTS.md`, `PLATFORM_CONTEXT.md`, `WORLD_MODEL_STRATEGY_CONTEXT.md`, `AUTONOMOUS_ORG.md`, `docs/architecture/public-display-ready-claims-matrix.md`.
- Product truth: current code, route behavior, package contracts, hosted-session contracts, and request state.
- Execution truth: Paperclip issue and routine state.
- Workspace visibility: Notion draft/review surfaces only after the owning routine explicitly runs.
- Operational truth: owner systems such as Stripe, Firestore, Render, Redis, provider/runtime artifacts, capture/provenance records, rights/privacy records, and city-launch artifacts.

Public Launch Ready is still the default public posture. The mapper should block only the exact unsupported fact, not weaken the whole page into pre-launch language.

## Current Surfaces

Existing surfaces this loop should compose rather than replace:

| Surface | Current repo path | Role in loop |
| --- | --- | --- |
| Public update page | `client/src/pages/Blog.tsx`, `server/routes/site-content.ts` | Website note drafts and crawlable update language. |
| Captured-site search truth | `client/src/data/siteWorlds.ts`, `server/routes/site-worlds.ts`, `server/retrieval/siteWorldSearch.ts` | Search copy, owner-system listing disclosure, request-candidate language, and no-exact-match boundaries. |
| Public claims guard | `docs/architecture/public-display-ready-claims-matrix.md`, `scripts/claims/cross-source-claims-guard.ts` | Claim classes, owner proof, and safe replacements. |
| Content asset metadata | `ops/paperclip/plugins/blueprint-automation/src/content-ops.ts` | `assetKey`, `assetType`, channels, source evidence, proof links, allowed claims, blocked claims. |
| Deterministic community writer | `ops/paperclip/plugins/blueprint-automation/src/worker.ts` (`buildCommunityUpdatesOutputProof`) | Draft package validation, KB artifact, optional Notion/Slack/SendGrid draft paths when explicitly run by Paperclip. |
| Ship broadcast issue spec | `buildShipBroadcastIssueSpec` in `content-ops.ts` | GitHub ship event to content brief conversion. |
| Operator-ready queue | `queueOperatorReadyShipBroadcasts` in `worker.ts` | Human approval queueing for fresh, complete, proof-backed ship-broadcast drafts. |
| Community routine | `ops/paperclip/blueprint-company/tasks/community-updates-weekly/TASK.md`, `.../tasks/ship-broadcast-refresh/TASK.md` | Weekly/community draft ownership and ship-broadcast refresh. |
| Investor routine | `ops/paperclip/blueprint-company/tasks/investor-relations-monthly/TASK.md`, `ops/paperclip/programs/investor-relations-agent-program.md` | Monthly investor draft ownership. |
| Internal digest | `ops/paperclip/blueprint-company/agents/workspace-digest-publisher/AGENTS.md` | Internal visibility drafts, not public promotion. |
| Outcome review | `server/utils/content-ops.ts`, `blueprint-record-content-outcome-review` | Post-distribution learning tied back to asset keys. |

## Loop

### 1. Collect Shipped Proof

Inputs may be:

- GitHub default-branch ship event, compare URL, commit messages, changed files.
- Closed Paperclip issue with closeout fields from `docs/autonomous-loop-evidence-checklist-2026-05-03.md`.
- Test, build, QA, smoke, or claim-guard reports.
- Pipeline package manifest, hosted-session artifact, or request attachment state.
- Capture record, provenance bundle, route notes, device metadata, rights/privacy record.
- Analytics, Firestore, Stripe, or campaign records for metrics.
- Content outcome reviews tied to a prior `assetKey`.

Minimum source packet:

```ts
type ShippedProofSource = {
  sourceId: string;
  sourceType:
    | "git_ship"
    | "paperclip_closeout"
    | "repo_artifact"
    | "capture_record"
    | "pipeline_package"
    | "hosted_session"
    | "rights_record"
    | "analytics_metric"
    | "payment_record"
    | "city_launch_artifact"
    | "content_outcome_review";
  ownerSystem: string;
  proofPaths: string[];
  summary: string;
  generatedAt: string;
  freshnessWindowDays?: number;
};
```

Reject a source before mapping when:

- the path is a generated summary with no underlying proof path
- the proof belongs to a different repo/system than the claim
- the source is older than its freshness window and the claim is current-tense
- the only evidence is a sample, demo flag, mock, local fixture, graph report, or AI-written summary
- the source requires live owner-system verification and that verification is absent

### 2. Map Source To Claim

The proof mapper should be deterministic. It can prepare drafts, but it must not let AI decide claim truth.

```ts
type ClaimPermission =
  | "allowed_public"
  | "allowed_internal"
  | "allowed_investor_with_context"
  | "qualified"
  | "blocked";

type ProofMappedClaim = {
  claimId: string;
  sourceIds: string[];
  claimText: string;
  permission: ClaimPermission;
  ownerProofRequired: string[];
  proofPaths: string[];
  allowedChannels: Array<
    "website" | "search" | "community_update" | "investor_update" | "internal_summary"
  >;
  requiredQualifier?: string;
  blockedClaimClass?: BlockedClaimClass;
  safeReplacement?: string;
  reviewGates: ReviewGate[];
};
```

The mapper emits only structured claims. Writers consume `ProofMappedClaim[]` and may rearrange language, but they cannot introduce new facts outside the mapped claims.

### 3. Build Draft Packet

```ts
type DraftDistributionPacket = {
  assetKey: string;
  assetType:
    | "ship_broadcast"
    | "community_update"
    | "investor_update"
    | "website_update"
    | "search_update"
    | "internal_summary";
  wedge: "Generated-World Policy Evaluation" | "Exact-Site Hosted Review" | "Policy Improvement Run" | string;
  audience: string;
  sourceEvidence: string[];
  proofLinks: string[];
  mappedClaims: ProofMappedClaim[];
  allowedClaims: string[];
  blockedClaims: string[];
  draftOutputs: DraftOutput[];
  reviewGates: ReviewGate[];
  noLiveActions: true;
};

type DraftOutput = {
  channel: "website" | "search" | "community_update" | "investor_update" | "internal_summary";
  targetPathOrSurface: string;
  headline: string;
  body: string;
  cta?: string;
};

type ReviewGate =
  | "mapper_validation"
  | "claims_guard"
  | "owner_system_proof"
  | "webapp_review"
  | "growth_lead_review"
  | "investor_review"
  | "rights_privacy_review"
  | "commercial_review"
  | "human_publish_approval";
```

The packet is the durable draft handoff. It should live in a repo artifact, a Paperclip issue body, or a local report before any optional Notion, Slack, SendGrid, or public-surface handoff runs.

### 4. Route Drafts By Channel

| Channel | Allowed output | Required extra gate |
| --- | --- | --- |
| Website update | PR or draft diff for `/updates`, proof pages, catalog copy, metadata, or route text. | `webapp_review` plus `claims_guard` for operational words. |
| Search page/update | Draft for `server/routes/site-content.ts`, sitemap/metadata, catalog aliases, or search disclosure copy. | `webapp_review`; no SEO claim can outrun package/search truth. |
| Community update | Draft packet compatible with `blueprint-generate-community-updates-report`. | `growth_lead_review` before public publish or send. |
| Investor update | Draft packet compatible with investor program structure: topline, scoreboard, shipped work, learnings, risks, asks, next month. | `investor_review`; metrics unavailable must be named, not proxied. |
| Internal summary | Workspace digest or closeout summary. | Internal-only label; cannot be reused externally without channel remap. |

### 5. Review, Approve, Learn

Review sequence:

1. Mapper validation: every claim has `sourceIds`, `ownerProofRequired`, `proofPaths`, and channel permission.
2. Claim guard: blocked classes are suppressed or replaced before a public/investor draft.
3. Owner-system gate: if the claim depends on a live system, the owning system must be checked or the claim stays blocked.
4. Channel owner review: WebApp, Growth, Investor Relations, or Workspace Digest owner checks audience fit.
5. Human approval: required before public publish, live send, sensitive investor disclosure, rights/privacy statement, pricing/commercial commitment, fundraising language, or city-live posture.
6. Outcome review: after distribution, record `assetKey`, channel, what worked, what did not, evidence source, confidence, and next recommendation.

## Source-To-Claim Mapping

| Source proof | Safe claim | Block until owner proof exists |
| --- | --- | --- |
| Merged code diff plus tests/QA | "We shipped a product surface, workflow, or route change." | User adoption, revenue effect, live availability, external customer proof. |
| Public route screenshot/QA | "The public surface is display-ready for the inspected route." | Operational Launch Ready, payment success, hosted fulfillment, rights clearance. |
| Closed Paperclip issue with evidence checklist | "The owning loop produced a proof-bearing closeout." | A live system state unless the closeout includes that owner-system proof. |
| Pipeline package manifest | "A package artifact exists for the named request/site." | Rights-cleared, hosted fulfilled, commercially available, provider-completed. |
| Capture bundle/provenance record | "The site has capture provenance with named metadata." | QA pass, rights clearance, commercial use, payout eligibility, buyer proof. |
| Rights/privacy record | "Rights posture is attached for the named use scope." | Unrestricted commercial use unless the record explicitly says so. |
| Hosted-session artifact and entitlement | "Hosted review is available for this exact request/session." | Broad hosted-session availability, guaranteed uptime, deployment success. |
| Analytics/Firestore metric | "This metric moved in this measured window." | Causal lift, traction, or conversion unless instrumentation supports it. |
| Stripe/payment record | "Payment or entitlement state is confirmed for this transaction." | Future payments, payouts, revenue claims, or marketplace readiness. |
| City-launch artifact | "City planning or activation artifact exists." | City is live, active capture coverage exists, guaranteed launch outcomes. |
| Content outcome review | "Prior asset feedback showed this pattern." | Customer adoption, market traction, or public proof unless tied to measured/public evidence. |
| Search/catalog no-exact-match semantics | "No exact scanned package is available; request capture for that site." | Saying the city/site is covered, available, or fulfilled. |

## Blocked Claim Classes

Use the same concrete classes as the claims guard and public claims matrix:

- `customer_or_traction_claim`: real customers, logos, testimonials, signed pilots, real buyer traction, revenue, conversion, or KPI claims without approved metric/customer proof.
- `rights_cleared_claim`: rights-cleared, unrestricted commercial use, consent approved, or site-operator approval without exact rights/privacy records.
- `provider_execution_claim`: provider-ready, provider completed, adapter proof, or run complete without provider artifacts and request linkage.
- `payment_or_payout_claim`: Stripe checkout success, payout success, capturer earnings, entitlement, or revenue claims without Stripe/ledger proof.
- `unsupported_hosted_session_proof`: hosted review/session/package access described as live, fulfilled, open, or available without runtime, entitlement, and package proof.
- `city_live_claim`: city live, active coverage, launched, or open for capture without city activation and supply evidence.
- `public_copy_proof_drift`: using Public Launch Ready copy as evidence for Operational Launch Ready.
- `no_change_churn`: closing a distribution run from "no diff" or generated narrative without a durable draft packet, suppression rule, or blocker.
- `stale_payment_payout_provider_doc`: using old payment, payout, or provider docs as current proof.
- `generated_output_as_ground_truth`: using AI text, generated images, graph output, local fixtures, or summary reports as capture/provenance/rights/runtime proof.

Safe replacements:

- "request access"
- "book hosted review"
- "availability confirmed per site/request"
- "rights reviewed per request"
- "provider path selected after review"
- "planned city"
- "public sample"
- "representative packet"
- "internal target"
- "instrumentation unavailable this period"

## Draft Packet Examples

### Example A: WebApp Ship Broadcast

Input:

- `sourceType`: `git_ship`
- proof paths: compare URL, changed files, test or QA output
- source evidence: `Repo: Blueprint-WebApp`, `Branch: main`, `Head commit: Improve hosted review CTA`

Mapped claims:

- Allowed public: "The hosted-review CTA and buyer path changed in the WebApp."
- Allowed community: "This makes the exact-site request path easier to inspect."
- Blocked: "Hosted reviews are now live for all buyers."
- Safe replacement: "Hosted review availability is confirmed per site/request."

Draft outputs:

- Website: `/updates` note draft with one shipped change and one proof link.
- Community: ship-broadcast draft with `assetType=ship_broadcast`.
- Investor: one "What shipped" bullet only if the change affects buyer usability; no traction claim.
- Internal: closeout line with proof paths and residual risk.

### Example B: Pipeline Package Proof

Input:

- `sourceType`: `pipeline_package`
- proof paths: package manifest, request id, package id, attached derived assets

Mapped claims:

- Allowed website/search: "A request-scoped package artifact exists for the named site."
- Qualified: "Package access can be requested after rights, privacy, entitlement, and buyer scope review."
- Blocked: "The package is commercially open" unless entitlement, rights, and access state prove it.

Draft outputs:

- Catalog/search: listing draft with proof depth and request-gated access disclosure.
- Community: only include if useful to buyers or capturers, with exact source paths.
- Investor: "Package delivery quality improved" only if the evidence supports a repeatable delivery or quality consequence.

### Example C: City Launch Artifact With Missing Live Proof

Input:

- `sourceType`: `city_launch_artifact`
- proof paths: city playbook, scorecard, activation packet
- missing: active capture supply, send ledger, reply, hosted-review start

Mapped claims:

- Allowed internal: "The city planning packet exists and names blockers."
- Qualified community: "Blueprint is collecting/requesting city signals" if the public copy is request-scoped.
- Blocked: "Austin is live", "active coverage exists", "robot teams can book live city inventory."

Draft outputs:

- Internal summary with blocker classes and next owner.
- No public city-live post.
- Investor risk/miss item if city activation is a monthly operating risk.

### Example D: Investor Monthly Update

Input:

- `sourceType`: mixed `analytics_metric`, `paperclip_closeout`, `git_ship`, `content_outcome_review`
- proof paths: metrics artifacts, closed issue ids, shipped proof paths

Mapped claims:

- Allowed investor: "This shipped, this metric is available/unavailable, this risk remains."
- Blocked: runway, projections, fundraising language, commercial commitments, rights/privacy posture changes unless approved.

Draft outputs:

- Topline with 3 to 5 real numbers or explicit non-numeric operating changes.
- Scoreboard where unavailable metrics are labeled unavailable.
- Shipped work translated into buyer demand, capturer supply, hosted-session usage, pipeline quality, rights/provenance rigor, or commercial readiness only where proof supports it.

## Deterministic Validation Rules

The mapper should fail closed when:

- any public/investor claim has no source id
- `proofPaths` is empty for an operational claim
- a claim's owner system is not the system that produced the proof
- an allowed public claim matches a blocked class without a qualifier
- a metric claim lacks window, source, and owner
- a website/search draft changes availability, rights, hosted access, provider execution, payment, payout, city-live, or customer traction language without owner proof
- a ship-broadcast draft lacks at least two source-evidence entries and durable proof links
- a SendGrid/approval queue state is treated as a sent/published state

Do not run unlisted or live-capable commands as part of this draft loop. `docs/architecture/command-safety-matrix.md` does not currently list `npm run claims:guard` as a safe command, so automation should either add a matrix entry in a separate reviewed change or use it only after the command is explicitly approved for the run. This spec itself makes no command execution mandatory.

## Handoff Shape

A completed draft packet should close with:

```text
Asset key:
Asset type:
Source ids:
Proof paths:
Allowed claims:
Blocked claims:
Draft outputs:
Review gates:
No live actions taken: true
Next owner:
Retry/resume condition:
Residual risk:
```

If the packet cannot be produced, close as blocked with the earliest missing proof class, not with a polished but unsupported draft.
