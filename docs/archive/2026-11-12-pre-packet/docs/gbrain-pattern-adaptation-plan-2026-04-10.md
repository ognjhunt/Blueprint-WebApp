# GBrain Pattern Adaptation Plan

Date: 2026-04-10

Status: Proposed same-stack adaptation plan for `Blueprint-WebApp`

Scope: Bring the useful patterns from `gbrain` into Blueprint's existing repo, KB, agent runtime, and Paperclip routines without adding Supabase, Postgres, or a second operational datastore.

## Decision

Blueprint should adopt the **pattern** behind `gbrain`, not the shipped `gbrain` storage/runtime stack.

Blueprint should borrow:

- brain-first lookup before external research
- compiled-truth plus append-only signal history
- stronger entity/page discipline
- routine background hygiene and contradiction cleanup
- better attachment of durable research context into agent sessions

Blueprint should not adopt:

- Supabase as a new required service
- `gbrain` as a runtime dependency of `Blueprint-WebApp`
- a second canonical ops datastore
- a generic personal-memex schema that competes with Blueprint doctrine or product truth

This plan stays consistent with:

- `AUTONOMOUS_ORG.md`
- `docs/ai-tooling-adoption-implementation-2026-04-07.md`
- `docs/ai-skills-governance-2026-04-07.md`
- `docs/hermes-kb-design.md`

## Why This Fits Blueprint

`gbrain` is strongest where Blueprint still has room to improve:

- compounding research memory across agent runs
- reusable buyer and market context
- better continuity between daily research loops and operator sessions
- stronger "read existing context first" discipline before expensive or noisy external research

Blueprint already has the right primitives:

- Paperclip as execution and ownership truth
- Notion as workspace and operator surface
- Firebase / Firestore as operational system of record
- a constrained Hermes KB under `knowledge/`
- attachable startup context in the agent runtime

The gap is not storage. The gap is **discipline and retrieval ergonomics** across these existing layers.

## Blueprint-Specific Adaptation Target

Do not build a generic personal memex.

Build a **Blueprint research brain** optimized for:

- exact-site buyer journeys
- robot-team account context
- site-operator and commercialization context
- market and competitor shifts
- demand and procurement signals
- proof-path and hosted-review patterns
- doctrine-safe product claims and objection handling

This means the primary reusable KB entities are not `people/` and `deals/` in the abstract.
They are:

- buyer dossiers
- market entities
- city and vertical demand briefs
- proof patterns
- doctrine and claims synthesis
- support and procurement playbooks

## Non-Goals

- do not move work state out of Paperclip
- do not move approvals, rights, privacy, pricing, or package truth into the KB
- do not imply product truth that is not backed by capture, runtime artifacts, or operator-approved sources
- do not add a second "brain database" beside Firestore
- do not make customer-facing product flows depend on repo-local KB files

## Target Architecture

### Authority layers

1. **Canonical operations**
   - Paperclip issues, routines, and handoffs
   - Firestore ops state
   - Notion workspace state
   - package/runtime/capture truth

2. **Durable derivative knowledge**
   - `knowledge/raw/`
   - `knowledge/compiled/`
   - `knowledge/reports/`
   - `knowledge/indexes/`

3. **Attached runtime context**
   - startup packs
   - ops documents
   - blueprint knowledge chunks
   - selected KB pages attached to a session

### Adapted gbrain loop for Blueprint

```text
Signal arrives
  -> check existing KB page first
  -> only then use external search or APIs
  -> update reusable compiled page if the finding will matter again
  -> append a dated signal entry
  -> attach the page into future startup context when it becomes operationally relevant
```

The KB remains derivative.
The compounding effect comes from agents reusing it before doing fresh research.

## Exact Doc Changes

### 1. `docs/hermes-kb-design.md`

Add these sections:

- `## Brain-First Lookup Protocol`
  - before external research on buyers, companies, competitors, cities, or objections:
    1. search existing KB pages
    2. read the current compiled page
    3. inspect contradictions and stale-page indexes when relevant
    4. only then call web search or external tools
- `## Page Archetypes`
  - define Blueprint-native compiled page kinds:
    - `buyer_dossier`
    - `market_entity`
    - `city_brief`
    - `proof_pattern`
    - `doctrine_claim`
    - `support_playbook`
- `## Compiled Truth And Signals`
  - preserve the current reusable summary style
  - add an explicit lower section for dated signals or changes
  - do not require all KB pages to become generic person/company dossiers
- `## Background Hygiene Loop`
  - nightly or daily maintenance for stale pages, contradictions, backlinks, and unresolved open questions
- `## Session Attachment Rule`
  - when a KB page directly informs a buyer, market, or support session, attach the page into startup context rather than pasting ad hoc summaries

### 2. `knowledge/AGENTS.md`

Add these rules:

- read the relevant compiled page before starting external research on the same subject
- update existing dossier pages before creating new pages
- when a report yields reusable findings, promote them into `knowledge/compiled/` in the same run or leave an explicit open question
- for subject pages, keep the top section current and the signal history append-only
- when the KB discusses canonical systems, link out instead of paraphrasing those systems as if the KB were authoritative

### 3. `knowledge/README.md`

Add a short "What this is not" section:

- not a second company database
- not a replacement for Paperclip, Firestore, or Notion
- not a generic personal CRM

Add a short "Best use" section:

- buyer preparation
- market research continuity
- support/procurement context reuse
- proof-path playbook compounding

## Exact Schema Changes

Do not replace the current frontmatter contract.
Extend it.

### 1. Extend compiled/report page frontmatter

In addition to current required fields, add optional fields for Blueprint-native reusable pages:

```yaml
page_kind: buyer_dossier
subject_key: acme-robotics
canonical_refs:
  - system: paperclip
    ref: "issue://1234"
  - system: notion
    ref: "https://www.notion.so/..."
freshness_sla_days: 14
last_signal_at: 2026-04-10
review_status: active
entity_tags:
  - robot-team
  - warehouse
  - hosted-review
```

Definitions:

- `page_kind`
  - one of the Blueprint-native archetypes above
- `subject_key`
  - stable slug or entity identifier for dedupe
- `canonical_refs`
  - pointers to the real system of record
- `freshness_sla_days`
  - target recency window for the owning agent
- `last_signal_at`
  - most recent meaningful update reflected on the page
- `review_status`
  - `active | watch | stale | blocked`
- `entity_tags`
  - lightweight routing and filtering tags

### 2. Add Blueprint-native templates

Add these files:

- `knowledge/templates/buyer-dossier.template.md`
- `knowledge/templates/market-entity.template.md`
- `knowledge/templates/city-brief.template.md`
- `knowledge/templates/proof-pattern.template.md`
- `knowledge/templates/doctrine-claim.template.md`

Recommended section shape for dossier-style pages:

- `## Summary`
- `## Current State`
- `## Evidence`
- `## Signals`
- `## Implications For Blueprint`
- `## Open Questions`
- `## Canonical Links`
- `## Authority Boundary`

Recommended section shape for pattern pages:

- `## Summary`
- `## Pattern`
- `## Evidence`
- `## Failure Modes`
- `## Implications For Blueprint`
- `## Open Questions`
- `## Authority Boundary`

### 3. Update KB tooling

#### `scripts/hermes-kb-ingest.ts`

Extend the helper to support:

- `--page-kind`
- `--subject-key`
- repeated `--canonical-ref-system` / `--canonical-ref`
- `--freshness-sla-days`
- `--review-status`
- archetype-specific template selection

#### `scripts/hermes-kb-lint.ts`

Add checks for:

- `page_kind` enum when present
- `subject_key` presence for dossier-style pages
- `canonical_refs` shape when present
- `last_signal_at` ISO date when present
- required section headings per `page_kind`

## Exact Runtime Changes

This is the highest-value implementation seam in the repo.

Today, startup context can attach:

- repo docs
- blueprints
- ops documents
- external sources
- creative contexts

It cannot explicitly attach Hermes KB pages.

That should change.

### 1. Extend startup-context types

Update:

- `server/agents/types.ts`
- `client/src/types/agent.ts`

Add:

- `knowledgePagePaths?: string[]` to `StartupContextMetadata`
- `knowledgePagePaths: string[]` to `StartupPackRecord`

### 2. Persist attached KB pages in startup packs

Update:

- `server/agents/startup-packs.ts`
- `server/routes/admin-agent.ts`

Add a persisted field:

- `knowledge_page_paths`

Update create/update schemas and normalizers so startup packs can carry selected KB pages alongside repo docs and ops docs.

### 3. Resolve attached KB pages into startup context

Update:

- `server/agents/knowledge.ts`

Add:

- KB page discovery helper over `knowledge/compiled/` and `knowledge/reports/`
- `readKnowledgePageExcerpt()` similar to existing repo-doc excerpt loading
- `knowledge_pages` in the resolved startup context payload

Behavior:

- when a session or startup pack references KB pages, include compact excerpts and metadata
- keep excerpt length bounded
- prefer compiled pages over reports for reusable context

### 4. Expose KB pages in context options

Update:

- `server/agents/knowledge.ts`
- `server/routes/admin-agent.ts`

Add to context options:

- a list of attachable KB pages
- page kind
- owner
- last verified date
- review status

### 5. Add KB page selection to admin UI

Update:

- `client/src/components/admin/AdminAgentConsole.tsx`

Add:

- multi-select for KB pages next to repo docs, blueprints, and ops documents
- support saving KB page paths into startup packs
- show attached KB pages when editing an existing startup pack

### 6. Keep runtime summaries honest

Update:

- `server/agents/runtime.ts`

Include KB page counts and labels in startup-context summaries so operators can tell when a session is running with dossier context versus raw docs only.

## Exact Task Changes

### 1. Add one rollout task now

Create:

- `ops/paperclip/blueprint-company/tasks/hermes-brain-adaptation-rollout/TASK.md`

Purpose:

- convert this plan into sequenced repo work
- keep the adaptation same-stack
- force explicit proof and follow-up issues

### 2. Update recurring research tasks to become brain-first

Edit:

- `ops/paperclip/blueprint-company/tasks/market-intel-daily/TASK.md`
- `ops/paperclip/blueprint-company/tasks/demand-intel-daily/TASK.md`

Add rules:

- read the relevant compiled KB page before external research
- update the compiled page's top section and append a dated signal section after each meaningful finding
- prefer updating an existing subject page over creating a fresh daily page

### 3. Add a nightly KB hygiene task

Create:

- `ops/paperclip/blueprint-company/tasks/hermes-kb-nightly-hygiene/TASK.md`

Assignee:

- `notion-manager-agent` is not the right owner
- use a Hermes-backed research lane, preferably `market-intel-agent` until a dedicated KB steward exists

Scope:

- stale-page review
- contradiction cleanup
- backlink refresh
- open-question triage
- promotion of reusable findings from recent reports into compiled pages

### 4. Add buyer-dossier refresh tasks

Create:

- `ops/paperclip/blueprint-company/tasks/buyer-dossier-refresh/TASK.md`

Assignee:

- `buyer-solutions-agent`

Scope:

- maintain reusable dossier pages for active exact-site buyers
- attach those pages into relevant operator sessions
- keep claims anchored to inbound requests, actual proof-path state, and operator-owned milestones

### 5. Tighten agent-level instructions

Edit:

- `ops/paperclip/blueprint-company/agents/market-intel-agent/AGENTS.md`
- `ops/paperclip/blueprint-company/agents/demand-intel-agent/AGENTS.md`
- `ops/paperclip/blueprint-company/agents/buyer-solutions-agent/AGENTS.md`

Add:

- brain-first lookup rule
- compiled-page update rule
- canonical-link rule
- no duplicate dossier rule

## Exact Rollout Sequence

### Phase 1. KB contract hardening

Files:

- `docs/hermes-kb-design.md`
- `knowledge/AGENTS.md`
- `knowledge/README.md`
- `knowledge/templates/*`
- `scripts/hermes-kb-ingest.ts`
- `scripts/hermes-kb-lint.ts`

Done when:

- KB page archetypes exist
- lint enforces the new structure
- research agents have a single documented lookup and writeback protocol

### Phase 2. Runtime attachment support

Files:

- `server/agents/types.ts`
- `client/src/types/agent.ts`
- `server/agents/startup-packs.ts`
- `server/routes/admin-agent.ts`
- `server/agents/knowledge.ts`
- `server/agents/runtime.ts`
- `client/src/components/admin/AdminAgentConsole.tsx`

Done when:

- operators can attach KB pages to startup packs and sessions
- agent sessions receive compact KB excerpts as first-class context
- no new service is introduced

### Phase 3. Research loop behavior change

Files:

- recurring Paperclip task files listed above
- agent `AGENTS.md` files for market intel, demand intel, and buyer solutions

Done when:

- daily research loops update reusable compiled pages before publishing one-off reports
- buyer-facing internal sessions can attach dossier pages
- contradiction and freshness work runs without replacing canonical systems

### Phase 4. Evaluation

Measure:

- how often research runs update an existing page versus creating duplicates
- how often operator sessions use attached KB pages
- whether outbound/research artifacts cite existing KB pages
- whether stale pages and contradictions trend down
- whether buyer/internal brief quality improves without unsupported claims

## Validation Rules

The adaptation is successful only if all are true:

- no new primary service was introduced
- no customer-facing runtime depends on the Hermes KB
- Paperclip, Notion, Firestore, and package/runtime truth remain canonical
- research continuity and operator prep improve measurably
- the KB stays truthful, derivative, and easy to prune

## First Implementation Slice

The best first slice is:

1. doc and schema hardening
2. KB-page attachment support in startup packs
3. market-intel and demand-intel brain-first task updates

Do not start with:

- a generic graph database
- a large personal-style entity taxonomy
- automated enrichment against lots of external APIs
- customer-facing product UI changes

The Blueprint version should be boring in infrastructure and sharp in workflow.
