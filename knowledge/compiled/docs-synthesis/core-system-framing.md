---
authority: derived
source_system: repo
source_urls:
  - 'repo:///PLATFORM_CONTEXT.md'
  - 'repo:///WORLD_MODEL_STRATEGY_CONTEXT.md'
  - 'repo:///AUTONOMOUS_ORG.md'
  - 'repo:///DEPLOYMENT.md'
  - 'repo:///AGENTS.md'
last_verified_at: "2026-04-10"
owner: blueprint-ops-lead
sensitivity: internal
source_hashes:
  PLATFORM_CONTEXT.md: "5069227c9a272d57a02d68eda25d7667ee25fde3"
  WORLD_MODEL_STRATEGY_CONTEXT.md: "15e20534964c106d1062b300505180397eb6f9b4"
  AUTONOMOUS_ORG.md: "d7c0aa339f38d4ab2a3d070094e043940874da81"
  DEPLOYMENT.md: "a46b105406f2bfc8217de512b23684dbc8d8bcd3"
  AGENTS.md: "eacfbd52566f2f474f36d010ecbd7eec4b59f063"
---

# Core System Framing — Repo-Authoritative Doc Mirror

## Summary

This page mirrors the five canonical system-framing documents that define how Blueprint operates. These documents establish the company's product doctrine, strategic posture around world models, organizational structure, deployment model, and agent working rules. Agents should read this page to understand the fundamental constraints, priorities, and contracts that must remain stable across all repos. When the source documents change, this page should be updated to match. This is a derived compilation — the original repo files are authoritative.

## Evidence

### 1. Shared Platform Doctrine (PLATFORM_CONTEXT.md)

**Defines:** The four-system architecture, product center of gravity, market structure, truth hierarchy, product stack, and default lifecycle.

**Key rules:**
- `BlueprintCapture` = capture client and supply-side evidence collection
- `BlueprintCapturePipeline` = turns captures into site-specific world-model packages and hosted-session artifacts
- `Blueprint-WebApp` = buyer, licensing, ops, and hosted-access surface
- `BlueprintValidation` = optional downstream infrastructure for benchmarking
- Platform is capture-first and world-model-product-first
- Center of gravity: broad real-world capture coverage, strong capture quality/provenance, site-specific world models and hosted access, rights/privacy/commercialization controls, buyer-facing surfaces
- Market structure is two-sided: capturers supply evidence packages, robot teams buy site-specific world models and hosted access
- Truth hierarchy: raw capture > rights/privacy/consent > world-model packages > optional trust/qualification outputs
- Qualification/readiness are optional trust layers, not the center of the company

### 2. World Model Strategy (WORLD_MODEL_STRATEGY_CONTEXT.md)

**Defines:** Strategic doctrine around world models, what must stay stable vs swappable, data priorities, build priorities, and platform moat definition.

**Key rules:**
- World models will improve rapidly; Blueprint should not build around one permanent model
- Durable moat: capture supply, rights-safe pipelines, site-specific packages, buyer surfaces, capture→package→usage flywheel
- Stable across model swaps: capture bundle structure, timestamps/poses/intrinsics/depth/metadata, consent/rights/privacy, package manifests, hosted-session contracts, buyer attachment/licensing/sync contracts, truth labeling
- Swappable: world-model checkpoints, providers, inference services, retrieval-conditioned generation strategies, refinement models, training/export adapters
- Data to preserve: walkthrough video, motion/trajectory logs, camera poses, intrinsics, depth, timestamps, device/modality metadata, site/scenario/deployment context, privacy/consent/rights metadata, retrieval/reference relationships
- Build priorities (in order): capture quality/coverage, packaging into site-specific world models, hosted access/buyer usability, rights/privacy/provenance rigor, stable contracts that survive backend swaps, optional trust/readiness outputs
- Decision rule: prefer reusable capture/packaging/product infrastructure over model-specific hacks unless the hack materially improves near-term user-visible value without increasing long-term coupling

### 3. Autonomous Org (AUTONOMOUS_ORG.md)

**Defines:** Complete organizational structure with 30+ agents, departments, triggers, inputs, outputs, human gates, and graduation paths.

**Key structure:**
- **Executive layer:** CEO (Claude), Chief of Staff (Hermes), CTO (Claude), Investor Relations, Notion Manager, Revenue Ops & Pricing
- **Engineering department:** 6 agents (3 codex/claude pairs: WebApp, Pipeline, Capture) + Beta Launch Commander + Docs Agent
- **Ops department:** Ops Lead + 11 specialist agents (Intake, Capture QA, Field Ops, Finance & Support, Buyer Solutions, Rights Provenance, Enterprise Review, Capturer Success, Catalog Management, Buyer Success)
- **Growth department:** Growth Lead + 12 specialist agents (Demand Intel, Supply Intel, City Planning, Outbound Sales, SDR, Conversion Optimization, Retention, Growth Analytics, Growth Engineering, Market Intel, Capturer Marketing)
- Key principles: Paperclip is the execution/ownership record; Notion is the workspace/knowledge surface; repo files are the definitional source of truth
- Progressive autonomy — agents graduate from supervised to autonomous based on track record
- Autoresearch-pattern loops drive continuous optimization
- Growth stays anchored to one narrow commercial wedge: Exact-Site Hosted Review
- Claude is the default executive/review lane, Codex the default implementation lane, with automatic failover between adapters

### 4. Deployment Model (DEPLOYMENT.md)

**Defines:** Build pipeline, Render deployment, environment management, CI/CD, and runtime configuration.

**Build pipeline:**
- Single build: `npm ci && npm run check && npm run test:coverage && npm run build`
- Client: Vite → `dist/public`; Server: esbuild → `dist/index.js`
- Release gate: `npm run alpha:check`; Launch preflight: `npm run alpha:preflight`; Smoke: `npm run smoke:launch`
- Start: `npm start`

**Render deployment:**
- Defined via `render.yaml`; health check at `/health/ready`
- Secrets held in Render service environment, not committed

**Critical environment groups (launch dependencies):**
1. **Firebase** — client vars (6 required, 2 optional) + Firebase Admin (server) for checkout auth, marketplace entitlements, pipeline sync, creator ledgers
2. **Stripe** — secret key, connected account, webhook secret, allowed origins
3. **Agent runtime** — at least one of OpenAI/Anthropic/ACP; optional per-lane model overrides
4. **Pipeline sync** — sync token, request review token; demo/fallback flags must be unset in prod
5. **Redis** — optional but recommended for live hosted-session state; falls back to in-process memory with Firestore async mirroring
6. **Growth ops** — PostHog/GA4 (optional), SendGrid (optional), first-party analytics mirror
7. **Voice concierge** — ElevenLabs API, optional Twilio for PSTN
8. **Autonomous automation flags** — waitlist, inbound, support triage, payout triage, preview diagnosis, experiment autorollout, autonomous research outbound, creative factory, buyer lifecycle; all must be explicitly enabled

**Runtime truth rules:**
- Firestore is the active datastore
- Public world-model pages surface pipeline-backed site worlds only; static fixtures are non-prod
- Marketplace checkout is only truthful when Firebase Admin, Stripe checkout, and Stripe webhooks are all live
- Pricing, legal, privacy, rights, and irreversible commitments remain human-gated
- Legacy manual deployment scripts are removed; deployment runs through project scripts

### 5. Agent Working Rules (AGENTS.md)

**Defines:** Repo-level mission, product rules, directory map, working constraints, and commands for agents in Blueprint-WebApp.

**Mission:** Blueprint-WebApp is the buyer, licensing, ops, and hosted-access surface for Blueprint's site-specific world-model products.

**Product rules:**
1. Keep Blueprint capture-first and world-model-product-first
2. Do not reframe as qualification-first or model-checkpoint-first
3. Do not overstate simulated or generated outputs as ground truth
4. Buyer, licensing, hosted-session, and ops flows must stay anchored to real capture provenance
5. Qualification and readiness surfaces are support layers, not the center of the product

**Repo map:**
- `client/src/pages/` — product routes and marketing pages
- `client/src/components/` — reusable UI and workflow components
- `client/src/lib/` — API, client environment, and app helpers
- `server/` — backend routes and runtime integrations
- `scripts/` — smoke checks, sitemap/prerender, launch gates
- `e2e/` — Playwright coverage

**Working rules:**
- Preserve truthful product language around hosted sessions, captures, rights, and provenance
- Prefer edits that strengthen buyer usability, ops clarity, and delivery of real-site outputs
- Avoid inventing fake supply, fake providers, or fake readiness states in production paths
- Keep changes aligned with other Blueprint repos when contracts cross repo boundaries

**Read-first chain:** PLATFORM_CONTEXT.md → WORLD_MODEL_STRATEGY_CONTEXT.md → DEPLOYMENT.md → package.json

## Implications For Blueprint

- Any agent working on any Blueprint repo MUST operate within these framing constraints
- The Hermes KB is support, not authority — the repo files and Paperclip are the sources of truth
- Product decisions should always optimize for the capture-first, world-model-product-first hierarchy
- Model backends are replaceable; the data pipeline, rights handling, and buyer surfaces are the durable moat
- Autonomous agents have defined human gates for strategy, budget, rights/privacy, commercialization, legal, policy, and irreversible decisions
- This page should be updated whenever any of the five source documents change materially

## Open Questions

- Should compiled doc-mirror pages include a change log tracking when sources were last updated and what changed?
- Are there additional repo-level framing documents in other Blueprint repos (BlueprintCapture, BlueprintCapturePipeline) that belong in this mirror?
- Should the ingest helper support an auto-sync command that compares source file hashes to the last-verified state?

## Authority Boundary

This page is a derived Hermes KB artifact. It synthesizes content from five canonical repo files. The source files are authoritative; this page is a convenience mirror for agent consumption. For work state, approvals, rights/privacy decisions, pricing/legal commitments, or capture provenance, check Paperclip, Notion, or the canonical repo files directly. If any discrepancy exists between this page and the source documents, the source documents prevail.
