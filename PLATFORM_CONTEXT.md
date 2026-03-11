# Platform Context

<!-- SHARED_PLATFORM_CONTEXT_START -->
## Shared Platform Doctrine

### System Framing

- `BlueprintCapture` captures raw evidence packages.
- `BlueprintCapturePipeline` converts evidence plus intake into qualification artifacts, readiness decisions, and handoffs.
- `Blueprint-WebApp` is the operating and commercial system around qualification records and derived downstream lanes.
- `BlueprintValidation` performs post-qualification scene derivation, robot evaluation, adaptation, and tuning work.

This platform is qualification-first.

### Truth Hierarchy

- qualification records, readiness decisions, and supporting evidence links are authoritative
- capture-backed scene memory is the preferred downstream substrate when deeper technical work is justified
- preview simulations, world-model outputs, and world-model-trained policies are derived downstream assets; they do not rewrite qualification truth

### Product Stack

1. primary product: site qualification / readiness pack
2. secondary product: qualified opportunity exchange for robot teams
3. third product: scene memory / preview simulation / robot eval package
4. fourth product: world-model-based adaptation, managed tuning, training data, licensing

### Downstream Training Rule

- world-model RL and world-model-based post-training are first-class downstream paths for site adaptation, checkpoint ranking, synthetic rollout generation, and bounded robot-team evaluation
- those paths sit behind qualification and do not by themselves replace stricter validation for contact-critical, safety-critical, or contractual deployment claims
- Isaac-backed, physics-backed, or otherwise stricter validation remains the higher-trust lane when reproducibility, contact fidelity, or formal signoff matters

### Data Rule

- passive site capture and walkthrough evidence are valuable context for scene memory, preview simulation, and downstream conditioning
- strong robot adaptation gains usually require action-conditioned robot interaction data such as play, teleop logs, or task rollouts; site video alone is usually not enough for reliable policy training from scratch
- derived assets may inform routing and downstream work, but they must not mutate qualification state or source-of-truth readiness records
<!-- SHARED_PLATFORM_CONTEXT_END -->

This repo is the operating system around qualification records, downstream lanes, and commercialization.

## What This Repo Owns

`Blueprint-WebApp` is the operating and commercial layer around site qualification.

Its main jobs are:

- collect site/task intake
- route requests into the correct lane
- track qualification and opportunity state
- support admin review
- expose qualified opportunities to robot teams
- package later-stage evaluation or tuning offers
- monetize scenes, datasets, evaluation, and related products

This repo should be treated as the workflow shell around qualification records, not as the source of truth for capture evidence itself.

## Relationship To The Other Repos

### Upstream evidence

`BlueprintCapture` produces the raw evidence package.

### Qualification engine

`BlueprintCapturePipeline` converts that evidence into:

- qualification artifacts
- readiness decisions
- opportunity handoffs
- later preview/evaluation artifacts when justified

### This repo

This repo should ingest, route, present, and monetize those outputs.

## Product Context

The correct product stack is:

1. primary product: site qualification / readiness pack
2. secondary product: qualified opportunity exchange for robot teams
3. third product: scene memory / preview simulation / evaluation package
4. fourth product: world-model-based adaptation / managed tuning / training data / licensing

That means the default product center in this repo should be:

- site qualification
- readiness routing
- qualified opportunity exchange

Not:

- generic marketplace browsing by itself
- sim package generation by default
- managed tuning as the first product motion

Marketplace and tuning features should sit on top of qualification, not replace it.
The app should separately track derived scene/data asset states without letting them rewrite readiness state.

Important read:

- `docs/first-principles-mvp-report.md` is the most important product-framing document in this repo.
- It explicitly argues that Blueprint should be a qualification platform first.

## What Is Real Vs Static

Real infrastructure already present in this repo:

- intake submission API
- admin request workflow
- qualification/opportunity state model
- requested lanes
- Stripe commerce plumbing
- semantic search endpoint
- license tier / exclusivity logic

Still mostly static or placeholder:

- much marketplace inventory in `client/src/data/content.ts`
- much qualified-opportunity exchange content in `client/src/data/pilotExchange.ts`

So the key gap is not product definition. The key gap is that pipeline outputs are not yet fully feeding the webapp’s live inventory and state surfaces.

## Operational Model

The intended lifecycle is:

1. a site operator or robot team submits intake
2. `BlueprintCapture` is requested or attached to collect evidence
3. `BlueprintCapturePipeline` generates qualification artifacts downstream
4. this repo ingests those outputs and updates request state
5. admin review or automation updates state
6. qualified records become handoff-ready opportunities
7. only selected opportunities move into preview simulation, deeper evaluation, validation, or tuning

## Biggest Integration Gap

The biggest missing system boundary today is:

- `BlueprintCapturePipeline` emits the right artifacts
- this repo has the right state model
- but there is not yet an obvious production bridge that writes pipeline outputs back into `inboundRequests` and the qualified-opportunity surfaces

Agents in this repo should treat that integration as a high-priority architecture target.

## Practical Rule For Agents In This Repo

When making changes here, optimize for:

1. qualification-first routing and state management
2. clear separation between qualification, downstream adaptation/evaluation, and managed tuning
3. representing real downstream records, not just static marketplace content
4. making qualified opportunities actionable for both site operators and robot teams

Do not treat this repo as if it is only a storefront. It is the operating system around the qualification record.
