# Ad Studio Harness Design

Date: 2026-04-23

Status: Approved design for planning and implementation

Owner: `webapp-codex`

## Summary

Blueprint will add a repo-owned **Ad Studio harness** that produces **paused Meta Marketing API campaign drafts** for two separate growth lanes:

- **capturer acquisition**
- **robot-team buyer demand**

The harness is inspired by the speed and output density of AI-native ad factories, but it will not copy deceptive tactics. It will allow **synthetic illustrative scenes and characters** for early-stage creative, especially around public-facing indoor spaces, while keeping **proof-like claims evidence-gated**.

The v1 workflow is:

1. campaign request
2. governed brief
3. image execution through Codex + `gpt-image-2`
4. video execution through Seedance 2.0 via OpenRouter
5. creative QA / claims review
6. paused Meta campaign draft creation
7. review surface + outcome logging

This design stays inside the current Blueprint stack and doctrine:

- no new primary services
- Firestore remains the durable operational record
- Paperclip remains the execution and ownership record
- Codex remains the image-execution lane
- server-side video stays on the explicit provider path

## Design Decisions

### Approved decisions

- Build **both** ad lanes, but keep them structurally separate.
- Go all the way to **actual paused/draft objects** through the Meta Marketing API.
- Use **synthetic illustrative scenes and characters** for early ads, especially for public-facing indoor spaces.
- Do **not** present fabricated proof as if it were real.
- Use a new **Ad Studio harness** instead of collapsing the whole workflow into the current creative factory or creating a full new department of agents.

### Truth boundary

Allowed:

- fictional capturers
- fictional robot-team buyer scenes
- fictional public-facing indoor environments
- stylized iPhone-style or glasses-style POV
- concept UI and illustrative overlays
- labeled dramatization of workflows

Not allowed as real claims unless backed by evidence:

- actual earnings or payout outcomes
- actual customer names
- actual captured sites
- actual press or logo proof
- actual app screenshots presented as current product truth
- actual robot-team outcomes
- actual permission or rights status

The operating rule is:

- **invent the ad scene**
- **do not invent the proof**

## Why This Approach

### Why not extend the current creative factory only

The current creative factory already gives Blueprint useful ingredients:

- creative run state
- Notion Growth Studio sync
- project-bound creative records
- existing creative routing policy

But v1 needs a cleaner contract than a single factory loop can provide. The Ad Studio harness has to manage:

- two lane-specific brief types
- Codex-only image execution
- explicit video-provider execution
- proof-policy review
- Meta draft object creation
- audit-ready state for later campaign review

That is a broader product workflow than a simple extension of the current asset factory.

### Why not create a full new agent department now

A full brand department with dedicated creative director, media buyer, and reviewer agents would add coordination overhead before the loop is proved. The right v1 move is a harness with explicit steps and a few clearly owned responsibilities under the existing Growth/Paperclip structure.

## Scope

### In scope for v1

- requesting a capturer-lane or buyer-lane campaign
- storing a governed campaign brief
- generating `gpt-image-2` prompt packs and assets through the Codex lane
- generating short-form video through Seedance 2.0 on OpenRouter
- running a reviewer pass against quality and claims rules
- creating paused Meta campaign, ad set, and ad objects through the Meta Marketing API
- storing audit-ready records for prompts, assets, review decisions, and Meta responses
- showing a compact operator review surface

### Out of scope for v1

- automatic live spend activation
- automatic budget scaling or bid optimization
- fabricated proof claims
- generic B2B growth content unrelated to Blueprint's actual wedge
- replacing Firestore, Paperclip, or the existing Growth org model

## Product Positioning By Lane

### Capturer acquisition lane

The capturer lane should focus on:

- public-facing indoor spaces
- iPhone-style capture framing
- wearable/POV-inspired framing where useful
- creator workflow simplicity
- flexible, local, repeatable capture opportunity

The lane must not imply real payout proof unless real payout evidence exists and is approved for use.

### Robot-team buyer lane

The buyer lane should focus on:

- exact-site hosted review
- deployment-risk reduction
- site-specific review and package workflows
- quicker evaluation of a real environment question

The lane must not imply real customer/site outcomes unless those outcomes exist and are approved for use.

## System Architecture

### High-level flow

1. An operator or agent creates an Ad Studio campaign request.
2. The request is normalized into a governed brief with:
   - lane
   - audience
   - city or geography when applicable
   - CTA
   - spend cap
   - allowed claims
   - blocked claims
   - synthetic-scene policy
3. The lane-specific strategy step creates hooks, visual directions, copy variants, and asset requirements.
4. Image-heavy work is routed to `webapp-codex` for `gpt-image-2` execution.
5. Approved frames and motion prompts are sent to Seedance 2.0 through OpenRouter.
6. The reviewer evaluates:
   - truth boundary
   - image/video quality
   - CTA clarity
   - channel fit
   - readiness for paused Meta draft creation
7. If the run is `draft_safe`, the Meta writer creates paused campaign/ad set/ad objects.
8. The system records returned Meta ids and shows them in the review surface.
9. Human review remains required before any live activation.

### Architectural principle

The harness is **repo-owned orchestration**, not a free-form content bot. Every transition should be explicit and auditable.

## Core Components

### 1. Campaign request intake

This step creates the initial request contract and should fail closed if any required field is missing.

Required inputs:

- lane
- audience
- CTA
- budget cap
- target format or aspect ratio
- allowed claims
- blocked claims
- whether the campaign is concept-only or tied to approved evidence

### 2. Brief builder

This step is owned by the Growth side of the system and converts the request into:

- concept angle
- copy hooks
- scene ideas
- visual references
- caption direction
- claims ledger seed

It should use existing repo doctrine and lane posture instead of generic direct-response templates.

### 3. Codex image execution

This step routes the final image work to `webapp-codex` and uses Codex desktop's OAuth-backed native image execution with `gpt-image-2`.

Outputs can include:

- opening frames
- ending frames
- character variants
- scene variants
- UI or overlay plates
- thumbnail candidates

This step must not be silently replaced by a separate paid image API.

### 4. Seedance video execution

This step stays on the explicit provider path and uses Seedance 2.0 via OpenRouter for video generation from approved frame inputs and motion prompts.

Outputs can include:

- short-form video variants
- provider ids
- output URLs or stored assets
- run metadata for later replay or audit

### 5. Creative reviewer

This step is the quality and policy gate.

It decides whether the run is:

- `blocked_missing_brief_contract`
- `blocked_asset_incomplete`
- `failed_claims_review`
- `draft_safe`

The reviewer should check:

- whether the creative is visually usable
- whether the CTA is coherent
- whether the claims stay inside approved boundaries
- whether the creative implies fake proof
- whether the draft is appropriate for Meta review

### 6. Meta draft writer

This step creates actual Meta Marketing API objects:

- campaign
- ad set
- ad

All objects must be created in a paused/non-live state. The writer must then read back the created objects and persist:

- ids
- statuses
- response payload proof
- linked run id

## Data Model

The harness should use Firestore as the durable operational store, with optional Notion mirroring for review visibility.

### `ad_studio_runs`

Stores one row per campaign run.

Suggested fields:

- `runId`
- `lane`
- `status`
- `city`
- `audience`
- `cta`
- `budgetCap`
- `ownerAgent`
- `reviewerAgent`
- `metaCampaignId`
- `metaAdSetId`
- `metaAdId`
- `createdAt`
- `updatedAt`

### `creative_assets`

Stores generated asset records for a run.

Suggested fields:

- `runId`
- `assetType`
- `provider`
- `prompt`
- `storageUri`
- `thumbnailUri`
- `aspectRatio`
- `providerTaskId`
- `createdAt`

### `claims_ledger`

Stores reviewable claims policy and evidence links.

Suggested fields:

- `runId`
- `allowedClaims`
- `blockedClaims`
- `evidenceLinks`
- `syntheticLabelPolicy`
- `reviewDecision`
- `reviewNotes`
- `createdAt`
- `updatedAt`

### `meta_draft_records`

Stores Meta draft objects and API proof.

Suggested fields:

- `runId`
- `campaignId`
- `adSetId`
- `adId`
- `status`
- `targetingSummary`
- `copySummary`
- `utmPlan`
- `apiResponseProof`
- `createdAt`

## Ownership Model

### Growth Lead

Owns:

- prioritization
- budget envelope
- which lane to run
- review queue priority

### Capturer Growth Agent

Owns:

- capturer-lane brief writing
- hook strategy
- concept packaging

Does not directly execute image generation.

### Robot-Team Growth Agent

Owns:

- buyer-lane brief writing
- hook strategy
- concept packaging

Does not directly execute image generation.

### `webapp-codex`

Owns:

- `gpt-image-2` visual execution
- asset iteration
- project-bound asset wiring when required

### Video provider path

Owns:

- Seedance request execution
- provider metadata capture

This remains a server-side provider contract rather than Codex-local execution.

### Creative reviewer / QA

Owns:

- truth review
- quality review
- readiness decision

### Meta writer

Owns:

- paused draft creation
- read-back verification
- durable write of Meta ids and status

## Review Surface

The system should expose a compact review surface in the admin path so an operator can see:

- lane
- video preview
- selected image thumbnails
- captions/headlines
- claims ledger
- QA status
- blocked reason if any
- Meta campaign/ad set/ad ids
- next human action

This surface should make it obvious that the output is a **paused draft**, not a live campaign.

## Safety Gates

### Gate 1: brief safety

Block the run if required contract fields are missing.

Failure status:

- `blocked_missing_brief_contract`

### Gate 2: asset integrity

Block the run if required images, video outputs, prompts, or provider metadata are missing.

Failure status:

- `blocked_asset_incomplete`

### Gate 3: claims review

Fail the run if the creative presents fabricated proof as if it were real.

Failure status:

- `failed_claims_review`

### Gate 4: Meta draft safety

Only create Meta objects if the run is `draft_safe`. Confirm the API returned paused objects and record the result.

Success status:

- `draft_created_paused`

### Live activation boundary

Live activation is not part of v1 automation. The harness may produce an activation checklist, but the final spend/live action remains human-gated.

## Failure Modes

### Missing brief policy

If the request lacks claim boundaries or lane data, the run must block instead of letting later steps guess.

### Missing or broken assets

If images or videos fail to materialize, the run must remain incomplete and visible, not auto-advance.

### Synthetic proof drift

If generated creative starts to imply real earnings, real sites, real buyers, real screenshots, or real permission status, the reviewer must fail it.

### Meta write mismatch

If Meta object creation succeeds partially or returns unexpected status, the run should be marked blocked and keep the exact API evidence.

## Verification Plan

### Automated tests

Add contract and unit coverage for:

- brief validation
- claims ledger normalization
- status transitions
- idempotency
- Seedance request shape
- Meta paused-draft request shape
- reviewer pass/fail behavior

### Reviewer-specific tests

The reviewer should explicitly:

- pass labeled dramatizations
- pass fictional public-indoor scenes
- fail fabricated proof claims presented as real

### Smoke path

1. Run a dry or mocked capturer-lane campaign.
2. Generate prompt pack and asset records.
3. Simulate or generate Seedance output.
4. Pass the reviewer.
5. Create one paused Meta draft in a test or sandbox account.
6. Read it back and store proof.

## Acceptance Criteria

The design is successfully implemented when:

- an operator can request either lane
- the system stores a governed brief
- image work is routed through Codex `gpt-image-2`
- video work is routed through Seedance/OpenRouter
- the reviewer can fail fabricated proof drift
- the system creates paused Meta draft objects and stores their ids
- the review surface shows the draft and next human action
- no live spend is enabled automatically

## Implementation Notes

This design should reuse existing repo seams where possible:

- current creative routing policy
- current creative factory state patterns
- Firestore durability
- Notion Growth Studio mirror patterns
- Paperclip issue ownership and review routing

It should not be implemented as an isolated sidecar outside the current WebApp and Paperclip operating model.

## Recommended Next Planning Boundary

The implementation plan should likely be split into these chunks:

1. data model + Firestore records
2. brief builder + lane contracts
3. Codex image handoff contract
4. Seedance/OpenRouter video integration
5. reviewer / claims gate
6. Meta Marketing API paused draft writer
7. admin review surface
8. tests + sandbox smoke
