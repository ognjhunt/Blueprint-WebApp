# Platform Context

<!-- SHARED_PLATFORM_CONTEXT_START -->
## Shared Platform Doctrine

### System Framing

- `BlueprintCapture` captures raw evidence packages -- now sourced from a crowdsourced capture network (phones, smart glasses) in addition to first-party captures.
- `BlueprintCapturePipeline` converts evidence plus intake into qualification artifacts, readiness decisions, and handoffs.
- `Blueprint-WebApp` is the three-sided marketplace and operating system connecting capturers, robot teams, and site operators around qualification-verified world models.
- `BlueprintValidation` performs post-qualification scene derivation, robot evaluation, adaptation, and tuning work.

This platform is a spatial data marketplace with qualification as the quality moat.

### Three-Sided Marketplace

- **Capturers** (supply side): people with phones or smart glasses who walk through indoor spaces and get paid per capture
- **Robot teams** (demand side, primary revenue): companies deploying robots that buy site-specific world models and simulation access
- **Site operators** (access grantors): facility managers who register spaces, grant capture permissions, and earn revenue share on world model sales

### Truth Hierarchy

- qualification records, readiness decisions, and supporting evidence links are authoritative
- capture-backed world models are the primary commercial product, built from crowdsourced and first-party captures
- preview simulations, world-model outputs, and world-model-trained policies are derived downstream assets; they do not rewrite qualification truth

### Product Stack

1. primary product: crowdsourced capture marketplace + qualification-verified world models
2. secondary product: simulation access / hosted sessions for robot teams
3. third product: enterprise contracts (on-demand captures, exclusive access, managed evaluation)
4. fourth product: deployment assistance, managed tuning, training data, licensing

### Downstream Training Rule

- world-model RL and world-model-based post-training are first-class downstream paths for site adaptation, checkpoint ranking, synthetic rollout generation, and bounded robot-team evaluation
- those paths sit behind qualification and do not by themselves replace stricter validation for contact-critical, safety-critical, or contractual deployment claims
- Isaac-backed, physics-backed, or otherwise stricter validation remains the higher-trust lane when reproducibility, contact fidelity, or formal signoff matters

### Data Rule

- passive site capture and walkthrough evidence are valuable context for world model construction, scene memory, preview simulation, and downstream conditioning
- strong robot adaptation gains usually require action-conditioned robot interaction data such as play, teleop logs, or task rollouts; site video alone is usually not enough for reliable policy training from scratch
- derived assets may inform routing and downstream work, but they must not mutate qualification state or source-of-truth readiness records
<!-- SHARED_PLATFORM_CONTEXT_END -->

This repo is the three-sided marketplace and operating system connecting capturers, robot teams, and site operators around qualification-verified world models.

## What This Repo Owns

`Blueprint-WebApp` is the marketplace and commercial layer around crowdsourced spatial capture and world model distribution.

Its main jobs are:

- attract and onboard capturers (supply side)
- manage the world model catalog for robot teams (demand side)
- support site operator registration and revenue share (access grantors)
- track qualification and quality state for all captures
- support admin review
- expose world models to robot teams with qualification verification
- package enterprise evaluation and deployment assistance offers
- monetize world models, simulation access, datasets, and related products

This repo should be treated as the marketplace shell around qualification-verified world models, not as the source of truth for capture evidence itself.

## Relationship To The Other Repos

### Upstream evidence

`BlueprintCapture` produces the raw evidence package -- from both the crowdsourced capture network and first-party captures.

### Qualification engine

`BlueprintCapturePipeline` converts that evidence into:

- qualification artifacts
- readiness decisions
- world model construction
- quality scores and verification badges

### This repo

This repo should ingest, route, present, and monetize those outputs through the three-sided marketplace.

## Product Context

The correct product stack is:

1. primary product: capture marketplace (capturers earn) + world model catalog (robot teams buy)
2. secondary product: simulation access / hosted sessions
3. third product: enterprise contracts (on-demand captures, exclusive access, managed work)
4. fourth product: deployment assistance / managed tuning / training data / licensing

That means the default product center in this repo should be:

- capturer onboarding and payout management
- world model catalog and qualification verification
- robot team purchase and simulation access

Not:

- qualification sold as a standalone product to site operators
- generic marketplace browsing by itself
- managed tuning as the first product motion

Enterprise and deployment features should sit on top of the marketplace, not replace it.
The app should separately track derived scene/data asset states without letting them rewrite readiness state.

Important read:

- `docs/first-principles-mvp-report.md` is the most important product-framing document in this repo.

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
- much world model catalog content in `client/src/data/siteWorlds.ts`

So the key gap is not product definition. The key gap is that pipeline outputs are not yet fully feeding the webapp's live inventory and state surfaces, and the capturer-side infrastructure (task assignment, payout management, quality scoring) is not yet built.

## Operational Model

The intended lifecycle is:

1. a capturer walks through an indoor space and uploads capture data
2. `BlueprintCapturePipeline` processes the capture, runs quality checks, and generates world model artifacts
3. this repo ingests those outputs, assigns qualification scores, and publishes to the catalog
4. robot teams browse, purchase, and simulate against world models
5. site operators earn revenue share on sales from their facilities
6. enterprise clients can request on-demand captures and managed deployment work

## Biggest Integration Gaps

The biggest missing system boundaries today are:

- capturer app infrastructure: task assignment, quality scoring, payout management
- `BlueprintCapturePipeline` to webapp bridge: automated world model publishing from pipeline outputs
- site operator registration and revenue share tracking

Agents in this repo should treat these as high-priority architecture targets.

## Practical Rule For Agents In This Repo

When making changes here, optimize for:

1. marketplace-first routing: capturers earn, robot teams buy, site operators grant access
2. clear separation between the marketplace layer, enterprise services, and managed deployment
3. representing real world model catalog items, not just static content
4. making world models actionable for robot teams with qualification verification badges

Do not treat this repo as if it is only a storefront. It is the operating system around a three-sided spatial data marketplace.
