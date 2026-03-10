# Platform Context

This repo is one part of a three-repo system.

## System Framing

- `BlueprintCapture` creates the evidence package.
- `BlueprintCapturePipeline` creates the qualification record and handoff.
- `Blueprint-WebApp` is the operating system around those records:
  - intake
  - routing
  - admin review
  - qualified opportunity exchange
  - later evaluation / tuning packaging
  - monetization

This platform is qualification-first.

The webapp should be treated as the operating system around qualification records, not as a standalone marketplace first.

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
- later geometry/evaluation artifacts when justified

### This repo

This repo should ingest, route, present, and monetize those outputs.

## Product Context

The correct product stack is:

1. primary product: site qualification / readiness pack
2. secondary product: qualified opportunity exchange for robot teams
3. third product: deeper evaluation / geometry / simulation package
4. fourth product: training data / managed tuning / licensing

That means the default product center in this repo should be:

- site qualification
- readiness routing
- qualified opportunity exchange

Not:

- generic marketplace browsing by itself
- sim package generation by default
- managed tuning as the first product motion

Marketplace and tuning features should sit on top of qualification, not replace it.

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
7. only selected opportunities move into deeper evaluation, geometry, validation, or tuning

## Biggest Integration Gap

The biggest missing system boundary today is:

- `BlueprintCapturePipeline` emits the right artifacts
- this repo has the right state model
- but there is not yet an obvious production bridge that writes pipeline outputs back into `inboundRequests` and the qualified-opportunity surfaces

Agents in this repo should treat that integration as a high-priority architecture target.

## Practical Rule For Agents In This Repo

When making changes here, optimize for:

1. qualification-first routing and state management
2. clear separation between qualification, deeper evaluation, and managed tuning
3. representing real downstream records, not just static marketplace content
4. making qualified opportunities actionable for both site operators and robot teams

Do not treat this repo as if it is only a storefront. It is the operating system around the qualification record.
