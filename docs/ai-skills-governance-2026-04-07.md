# AI Skills Governance

Date: 2026-04-07

Status: Active

Scope: Shared AI-tooling and skill-governance rules for `Blueprint-WebApp` across Claude, Codex, Hermes, and Paperclip-routed agent lanes.

## Applies To

This document applies to:

- repo-level Claude-guided runs
- repo-level Codex-guided runs
- Hermes-backed Paperclip agents operating in this repo
- any other agent lane that reads repo doctrine before acting in `Blueprint-WebApp`

If a repo instruction file mentions Claude specifically because of filename convention, treat the guidance as shared unless it explicitly says otherwise.

## Core Rule

Use AI tooling as a support layer on top of Blueprint's current stack.

Do not use AI tooling to implicitly choose a new architecture for the repo.

## Current Primary Stack

The current primary stack remains:

- Vite + Express + TypeScript
- Firebase client auth + Firebase Admin / Firestore
- Stripe + Stripe Connect
- Render
- Redis
- Notion
- Paperclip
- the current AI runtime and harness paths already modeled in repo code and env

No imported skill, external guide, or AI coding pattern may override this by default.

## Approved Uses

### 1. Repo Understanding

Approved:

- reading canonical repo docs
- reading code directly
- bounded use of packed-context tools such as Repomix for narrow slices, external reference repos, or cross-repo comparison
- curated provider best-practice skills for services Blueprint already uses

Not approved:

- replacing direct reading of canonical repo docs with packed exports by default
- using external starter repos as the source of truth for this repo's architecture

### 2. Implementation Support

Approved:

- code generation that fits current repo contracts
- test generation and verification support
- architecture review against current doctrine
- debugging support
- issue-scoped implementation work

Not approved:

- architecture drift driven by generic SaaS boilerplates
- adding second-auth or second-datastore patterns because a skill suggested them

### 3. Narrow Automation Optimization

Approved:

- eval-first improvement of existing narrow lanes
- shadow runs
- prompt, policy, and task-shaping improvements backed by measured evidence

Not approved:

- replacing Paperclip issue state, human gates, or production truth sources
- promoting high-risk lanes without explicit review evidence

### 4. Growth And Distribution

Approved:

- proof-led messaging
- ship-to-distribution loops
- objection capture
- search/discovery documentation
- wedge-specific content tied to Exact-Site Hosted Review and other truthful product surfaces

Not approved:

- fake traction
- fake urgency
- invented providers, customers, sites, or readiness states
- generic trend-content loops as a substitute for buyer-proof communication

## Allowed Tool Classes

### Allowed

- repo doctrine files and repo-local instruction files
- Paperclip tools and existing repo scripts
- official best-practice skills for already-used providers such as Stripe
- repo-local Blueprint skills
- bounded debugging, review, QA, browser, and verification workflows

### Conditionally Allowed

- Repomix and similar repository packaging/export tools
- third-party skill libraries used only as references
- external marketing or workflow skill packs used only after Blueprint doctrine review
- Parallel Search MCP for the explicitly approved research and fact-check lanes in `ops/paperclip/programs/parallel-search-mcp-policy.md`

Condition:

- they must not become silent architecture inputs
- they must not alter production authority boundaries
- they must not introduce new services into the plan unless separately approved
- they must stay read-only enrichment and cannot become capture, rights, recipient, readiness, or deployment truth

### Disallowed Without Explicit CTO Approval

- greenfield boilerplate adoption into the live core repo
- new primary auth providers
- new primary operational datastores
- new primary hosting platforms
- tools that can send external messages, mutate finance state, or rewrite workspace truth without passing through current controls

## Service Introduction Rule

No skill or AI recommendation may introduce a new primary service into `Blueprint-WebApp` unless all are true:

1. `blueprint-cto` explicitly approves it
2. the change is documented as an architecture decision
3. the current implementation plan is updated
4. the change does not silently fork existing source-of-truth systems

Absent those conditions, the default answer is no.

## Notion Access Rule

For Blueprint-managed Notion state:

- prefer the local Blueprint automation Notion tools and deterministic report writers
- prefer maintained direct API or SDK paths already used by the repo when automation is running outside an agent tool context

Do not:

- scrape `https://www.notion.so` HTML from agent runs
- call private Notion `/api/v3` endpoints from agent runs
- depend on `token_v2` browser cookies as an automation credential

If a supported Notion read or write path is unavailable, the agent should leave the work blocked with that missing capability called out explicitly rather than inventing a scraper.
That rule applies even when browser tools are available: browser navigation is not an acceptable fallback for Blueprint-managed Notion state.

## Truth Boundary Rule

Agents must not invent:

- capture provenance
- rights state
- buyer readiness
- hosted-session capability
- commercial commitments
- deployment outcomes
- partner/provider status

If a skill, external template, or AI recommendation conflicts with repo truth, repo truth wins.

## Hermes-Specific Rule

Hermes memory and Hermes-authored summaries are support layers.

They are not authoritative for:

- work state
- approvals
- pricing or legal commitments
- provenance
- package/runtime truth

Hermes-backed agents operating in this repo must still anchor decisions in repo files, Paperclip state, Notion state where applicable, and the live system evidence.

Hermes-backed agents must not assume direct image-generation capability just because Codex supports it.

When a Hermes lane needs generated imagery, mockups, or asset iteration:

- Hermes owns the brief, claims guardrails, evidence pack, and review criteria
- execution should route to a Codex lane, usually `webapp-codex`
- server-side scheduled workers stay on explicit provider APIs unless a separate migration changes their execution substrate

## Codex-Specific Rule

Codex is the implementation lane, not the product-strategy override lane.

Codex should:

- implement against current contracts
- escalate when architecture or service boundaries are implicated
- avoid importing greenfield defaults from external examples
- use Codex desktop's OAuth-backed native image workflow with `gpt-image-2` by default for Codex-executed brand, marketing, and frontend image work unless the assigned issue is explicitly about the server-side provider path

## Creative Routing Rule

The current creative routing policy is documented in [docs/codex-creative-routing-2026-04-16.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/codex-creative-routing-2026-04-16.md).

Current default:

- Codex-executed image work: Codex desktop OAuth image generation on `gpt-image-2`, ideally iterated with screenshots and code context
- Hermes growth/research lanes: no direct image-generation assumption
- server-side autonomous workers: no separate image API for final asset execution; route image work to Codex
- video generation: explicit provider path. OpenRouter remains the server-side default; Higgsfield MCP is allowed as an authenticated agent-side Seedance 2.0 path for approved creative/video issues.

## Higgsfield MCP Rule

Higgsfield MCP is conditionally allowed for creative/video lanes only.

Allowed:

- `webapp-codex`, `growth-lead`, `community-updates-agent`, `robot-team-growth-agent`, and `capturer-growth-agent` may use the `higgsfield-creative-video` skill when an issue explicitly calls for video generation or video-provider testing.
- Seedance 2.0 through Higgsfield may be used instead of OpenRouter when the Higgsfield connector is authenticated and the issue records the prompt, source frame, model, output, and review gates.

Not allowed:

- using Higgsfield image tools as a replacement for Codex `gpt-image-2` final image execution
- giving every Hermes lane broad creative-generation authority
- presenting generated clips as capture proof, hosted-session evidence, buyer traction, or deployment success
- moving server-side creative workers to Higgsfield without a separate migration and verification pass

## Claude-Specific Rule

Claude-facing repo guidance is shared guidance unless a file explicitly says it is Claude-only.

Do not treat a Claude-named file as permission to diverge from Codex or Hermes on stack, truth, or governance.

## Required Read Order

Before substantial work in this repo, the preferred read order is:

1. `PLATFORM_CONTEXT.md`
2. `WORLD_MODEL_STRATEGY_CONTEXT.md`
3. `AUTONOMOUS_ORG.md`
4. `docs/ai-tooling-adoption-implementation-2026-04-07.md`
5. `docs/ai-skills-governance-2026-04-07.md`
6. repo-specific task or issue instructions

## Default Decision Rule

When deciding whether to use a tool, skill, or imported workflow:

- prefer the option that strengthens current product contracts
- prefer the option that keeps source-of-truth systems singular
- prefer the option that improves bounded execution without adding service sprawl

If the choice is between novelty and contract stability, choose contract stability.
