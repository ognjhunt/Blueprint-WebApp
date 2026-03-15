# Platform Context

<!-- SHARED_PLATFORM_CONTEXT_START -->
## Shared Platform Doctrine

### System Framing

- `BlueprintCapture` is the contributor evidence-capture tool inside Blueprint's three-sided marketplace.
- `BlueprintCapturePipeline` is the authoritative qualification, provenance, and provider-routing service.
- `Blueprint-WebApp` is the three-sided marketplace and operating system connecting capturers, robot teams, and site operators around qualification records and downstream work.
- `BlueprintValidation` is optional downstream infrastructure for provider benchmarking, runtime-backed demos, and deeper robot evaluation after qualification.

This platform is qualification-first, with the marketplace organized around trusted qualification outcomes.

### Three-Sided Marketplace

- **Capturers** (supply side): people with phones or smart glasses who gather evidence packages from real spaces
- **Robot teams** (demand side, primary revenue): companies deploying robots that buy trusted qualification outcomes, previews, and later technical work
- **Site operators** (access grantors): facility managers who register spaces, grant capture permissions, and control commercialization and sharing boundaries

### Truth Hierarchy

- qualification records, readiness decisions, trust/provenance links, and supporting evidence are authoritative
- capture-backed previews, scene-memory bundles, and world-model outputs are downstream commercial products when qualification justifies them
- preview simulations, world-model outputs, and world-model-trained policies are derived downstream assets; they do not rewrite qualification truth

### Product Stack

1. primary product: qualification intake, review, and routing across the three-sided marketplace
2. secondary product: contributor capture network and provider-backed preview lane
3. third product: scene memory / hosted world models / runtime-backed evaluation
4. fourth product: deployment assistance, managed tuning, training data, licensing

### Downstream Training Rule

- world-model RL and world-model-based post-training are first-class downstream paths for site adaptation, checkpoint ranking, synthetic rollout generation, and bounded robot-team evaluation
- those paths sit behind qualification and do not by themselves replace stricter validation for contact-critical, safety-critical, or contractual deployment claims
- Isaac-backed, physics-backed, or otherwise stricter validation remains the higher-trust lane when reproducibility, contact fidelity, or formal signoff matters

### Data Rule

- passive site capture and walkthrough evidence are valuable context for qualification, scene memory, preview simulation, and downstream conditioning
- strong robot adaptation gains usually require action-conditioned robot interaction data such as play, teleop logs, or task rollouts; site video alone is usually not enough for reliable policy training from scratch
- derived assets may inform routing and downstream work, but they must not mutate qualification state or source-of-truth readiness records
<!-- SHARED_PLATFORM_CONTEXT_END -->

This repo is the three-sided marketplace and operating system connecting capturers, robot teams, and site operators around qualification records and downstream technical work.

## What This Repo Owns

`Blueprint-WebApp` is the marketplace, intake, buyer review, and ops layer around crowdsourced spatial capture and qualification-first routing.

Its main jobs are:

- collect site/task intake from robot teams and site operators
- attract and onboard capturers (supply side)
- let ops route requests into capture, review, recapture, preview, or deeper evaluation
- support site operator registration, access rules, and revenue share (access grantors)
- track qualification, trust, provenance, rights, and quality state for captures and requests
- present buyer-safe review surfaces before downstream technical work
- expose qualified downstream products to robot teams only after the record is strong enough
- monetize qualified opportunities, previews, hosted examples, evaluation, and related products

This repo should be treated as the operating system around qualification-first marketplace activity, not as the source of truth for evidence or technical evaluation itself.

## Relationship To The Other Repos

### Upstream evidence

`BlueprintCapture` produces the raw evidence package.

### Qualification engine

`BlueprintCapturePipeline` converts that evidence into:

- qualification artifacts
- readiness decisions
- trust, provenance, and rights summaries
- provider preview state
- scene/world outputs when a downstream lane is justified

### This repo

This repo should ingest, route, present, and monetize those outputs through the three-sided marketplace.

## Product Context

The correct product stack is:

1. primary product: qualification-first intake and buyer review
2. secondary product: contributor capture network and preview/world-model routing
3. third product: hosted world models, runtime demos, and deeper evaluation
4. fourth product: deployment assistance / managed tuning / training data / licensing

That means the default product center in this repo should be:

- intake submission and ops routing
- capturer onboarding and payout management
- buyer review of qualification, rights, provenance, and recapture status
- downstream purchase or escalation only after qualification

Not:

- generic marketplace browsing by itself
- runtime-only flows as the default motion
- managed tuning as the first product motion

Hosted/runtime and enterprise features should sit on top of qualification and marketplace routing, not replace them.
The app should separately track derived scene/data asset states without letting them rewrite readiness state.

Important read:

- `docs/first-principles-mvp-report.md` is the most important product-framing document in this repo.

## What Is Real Vs Static

Real infrastructure already present in this repo:

- intake submission API
- admin request workflow
- qualification/opportunity state model
- buyer review request surfaces
- requested lanes
- Stripe commerce plumbing
- semantic search endpoint
- license tier / exclusivity logic

Still mostly static or placeholder:

- much marketplace inventory in `client/src/data/content.ts`
- much world model catalog content in `client/src/data/siteWorlds.ts`

So the key gap is not product definition. The key gap is that live pipeline outputs are not yet fully feeding every buyer-facing and ops-facing surface, and some older catalog/runtime assumptions still dominate public copy and static inventory.

## Operational Model

The intended lifecycle is:

1. a robot team or site operator submits a site, task, constraints, and requested lane
2. ops requests capture or routes existing evidence into review
3. a capturer uploads evidence
4. `BlueprintCapturePipeline` processes the bundle and emits qualification, trust, rights, provenance, and optional preview state
5. this repo ingests those outputs and renders a buyer-safe review workspace
6. only then does the request move into preview, hosted world-model work, evaluation, or managed deployment follow-ons

## Biggest Integration Gaps

The biggest missing system boundaries today are:

- full live pipeline-to-webapp attachment coverage across all review surfaces
- clearer buyer and ops workflows around recapture, rights review, and preview triggers
- site operator registration and revenue share tracking
- de-emphasizing legacy catalog/runtime-first framing where qualification should be primary

Agents in this repo should treat these as high-priority architecture targets.

## Practical Rule For Agents In This Repo

When making changes here, optimize for:

1. qualification-first routing across capturers, robot teams, and site operators
2. clear separation between the marketplace/ops layer and technical downstream services
3. buyer-safe review surfaces that reflect live pipeline truth
4. downstream catalog/runtime features that are explicitly secondary to qualification

Do not treat this repo as if it is only a storefront, and do not treat it as if runtime demos are the default product. It is the operating system around a qualification-first three-sided marketplace.
