# Platform Context

<!-- SHARED_PLATFORM_CONTEXT_START -->
## Shared Platform Doctrine

### System Framing

- `BlueprintCapture` is the contributor evidence-capture tool inside Blueprint's three-sided marketplace.
- `BlueprintCapturePipeline` is the authoritative qualification, privacy, provenance, and downstream-routing service.
- `Blueprint-WebApp` is the marketplace and operating system that ingests pipeline outputs and exposes buyer, ops, preview, and hosted-session surfaces.
- `BlueprintValidation` remains optional downstream infrastructure for benchmarking, runtime-backed demos, and deeper robot evaluation after qualification.

This platform is qualification-first.

### Three-Sided Marketplace

- **Capturers** gather evidence packages from real sites.
- **Robot teams** are the primary buyers of trusted qualification outputs, previews, and deeper downstream work.
- **Site operators** control access, consent, rights, and commercialization boundaries for their facilities.

### Truth Hierarchy

- qualification records, readiness decisions, provenance, and rights/compliance outputs are authoritative
- privacy-safe derived media, World Labs previews, scene-memory bundles, and hosted/runtime artifacts are downstream products
- downstream products do not rewrite qualification truth

### Product Stack

1. primary product: qualification record / readiness decision / buyer-safe evidence bundle
2. secondary product: privacy-safe preview generation and marketplace routing
3. third product: scene memory / hosted runtime prep / deeper evaluation packages
4. fourth product: managed tuning, training data, licensing, and deployment support
<!-- SHARED_PLATFORM_CONTEXT_END -->

This repo is the marketplace, review, and surfacing layer around pipeline truth.

## What This Repo Owns

`Blueprint-WebApp` owns:

- request intake and marketplace workflow
- buyer and ops review surfaces for qualification outputs
- authenticated pipeline attachment ingestion
- public and admin-facing site-world surfacing
- World Labs preview inspection and admin refresh/generate controls
- hosted-session launch only when runtime artifacts exist

This repo is not the source of truth for qualification itself. It is the consumer and presentation layer for pipeline outputs.

## Pipeline Integration Today

The live backend surfaces already present here are:

- `/api/internal/pipeline/attachments` for pipeline sync
- public `/api/site-worlds` routes for pipeline-backed site-world records
- admin World Labs routes for refresh/generate workflows
- hosted-session routes for runtime-backed sessions

The pipeline sync route can:

- attach artifacts to an existing inbound request
- update qualification/opportunity state when the sync is authoritative
- create a placeholder inbound request when pipeline sync arrives before intake bootstrap

## What “Automatic Hosting” Means Here

There are two different downstream outcomes in this repo:

### 1. Public site-world / preview surfacing

This is available when:

- an inbound request reaches a live qualification/opportunity state
- pipeline artifacts are attached successfully

That path can surface:

- qualification-backed site-world cards
- World Labs preview state
- request, operation, and world manifests

### 2. Hosted runtime sessions

This is stricter.

Hosted sessions require artifacts such as:

- `scene_memory/scene_memory_manifest.json`
- `scene_memory/conditioning_bundle.json`
- `evaluation_prep/site_world_spec.json`
- `evaluation_prep/site_world_registration.json`
- `evaluation_prep/site_world_health.json`

So a World Labs preview alone is not the same thing as a launchable hosted session.

## What Is Real Vs Static

Real, code-backed behavior in this repo today:

- pipeline sync ingestion
- pipeline-backed live site-world generation from Firestore records
- World Labs preview summarization from stored artifacts
- hosted-session orchestration when runtime artifacts exist

Still mixed with static/demo data:

- static seed records in `client/src/data/siteWorlds.ts`
- demo runtime overrides for the canonical demo site
- some marketing/catalog copy that still overstates runtime-first framing

## Operational Boundary

This repo should assume:

- qualification, privacy, and provider execution happen elsewhere
- public site-world visibility depends on successful pipeline sync
- hosted session launchability depends on evaluation/runtime-prep artifacts, not preview alone

## Practical Rule For Agents In This Repo

When changing this repo, optimize for:

1. reflecting pipeline truth accurately
2. keeping preview, qualification, and hosted runtime distinct in the UI and backend
3. making placeholder and degraded states explicit instead of hidden
4. keeping public site-world visibility and hosted-session launch requirements separate
