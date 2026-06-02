# Platform Context

> **Source of truth:** [Blueprint Knowledge](https://www.notion.so/16d80154161d80db869bcfba4fe70be3) — Platform Doctrine
> This file is the repo-authoritative mirror of Blueprint Knowledge for core system framing.
> All Blueprint agent roles and developers consuming this file should treat Notion as the canonical
> operational surface and this file as the definitional source of truth within the repo.
> When changes are made to Notion Knowledge, the Notion Manager agent is responsible for pushing
> mirror updates to this file. When changes are made here, they should be reconciled back.

<!-- SHARED_PLATFORM_CONTEXT_START -->
## Shared Platform Doctrine

### System Framing

- `BlueprintCapture` is the capture client and supply-side evidence collection tool.
- `BlueprintCapturePipeline` turns capture bundles through the bridge and GPU compatibility contracts into site-specific world-model packages, hosted-session artifacts, and optional trust / review outputs.
- `Blueprint-WebApp` is the buyer, licensing, ops, and hosted-access surface around those packages.
- `BlueprintValidation` remains optional downstream infrastructure for deeper benchmarking, robot evaluation, and specialized runtime checks.

This platform is capture-first and world-model-product-first.
The bridge materialization contract and GPU compatibility contract are downstream compatibility layers, not sources of capture truth.

### 2026-06-02 WebApp Commercial Wedge Overlay

`Blueprint-WebApp` may lead its public buyer narrative with the first PMF wedge: **a site-specific robot deployment readiness platform**.

That public wedge answers a narrow buyer question: before a costly pilot, how likely is a robot to meet the required success rate, cycle time, intervention rate, and safety threshold on the actual site/task?

This overlay does not make Blueprint qualification-first or detach the product from real capture. The readiness report is a commercial buyer workflow built on capture-grounded site packages, task scope, robot profiles, provenance, rights/privacy boundaries, hosted review, and explicit missing-proof labels. A readiness advisory can be sold confidently as a product category; a claim that a robot is ready to deploy, safety validated, or guaranteed to hit thresholds still requires request-scoped owner-system proof.

### Product Center of Gravity

The center of gravity is:

- broad real-world capture coverage
- strong capture quality and provenance
- site-specific world models and hosted access for robot teams
- rights, privacy, and commercialization controls
- buyer-facing product surfaces that make real sites easy to browse, buy, run, and manage
- public WebApp readiness reports that organize site/task thresholds and pilot decisions around those real-site packages

The center of gravity is not:

- generic marketplace browsing as the main story
- qualification/readiness as the main thing Blueprint sells
- one-off model demos disconnected from real capture
- a single permanent world-model backend
- unsupported robot-readiness verdicts, safety validation, or guaranteed threshold claims

### Market Structure

The core business engine is two-sided:

- **Capturers** supply real-site evidence packages.
- **Robot teams** buy site-specific world models, hosted access, and related outputs.

`Site operators` remain important, but they are an optional third lane for:

- access control
- rights / consent / privacy boundaries
- commercialization and revenue sharing

The platform must support lawful capture and packaging even when a site has not already gone through a pre-negotiated intake flow. Site-operator involvement is a supported workflow branch, not a universal prerequisite for all capture.

### Truth Hierarchy

- raw capture, timestamps, poses, device metadata, and provenance are authoritative
- rights / privacy / consent metadata are authoritative
- site-specific world-model packages and hosted-session artifacts are the primary sellable downstream products
- the current WebApp commercial wedge can sell readiness reports as a first buyer workflow, while those reports remain grounded in site packages and request-scoped proof
- qualification / readiness / review outputs can guide buying, commercialization, and deployment decisions, but they must not override capture truth
- downstream outputs must not rewrite capture truth or provenance truth

### Product Stack

1. primary product: capture supply and real-site coverage
2. second product: site-specific world models and hosted access
3. current WebApp wedge: site/task robot deployment readiness reports backed by those packages
4. fourth product: deeper evaluation, managed tuning, licensing, and deployment support

### Default Lifecycle

1. A capture is sourced proactively or through a buyer / site / ops request.
2. `BlueprintCapture` records and uploads a truthful evidence bundle.
3. `BlueprintCapturePipeline` materializes site-specific packages, hosted artifacts, and optional trust outputs.
4. `Blueprint-WebApp` exposes those outputs through buyer, ops, licensing, and hosted-session surfaces.
5. Optional review, deeper evaluation, or managed support follows only when commercially useful.

### Practical Rule For Agents

When changing any Blueprint repo, optimize for:

1. stronger real-site capture supply
2. better site-specific world-model outputs and hosted access
3. stable rights / privacy / provenance contracts
4. buyer and ops surfaces that make those outputs easy to sell and use
5. optional trust / readiness layers that support the product without becoming the product story

Do not assume that every capture must begin with formal site qualification.
Do not treat qualification/readiness as the universal center of the company. The WebApp readiness wedge is specific to pre-pilot robot deployment decisions and does not authorize unsupported operational verdicts.
Do not overstate world-model quality beyond what capture, privacy, and runtime artifacts support.
<!-- SHARED_PLATFORM_CONTEXT_END -->
