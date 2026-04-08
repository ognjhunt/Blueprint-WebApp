# Graphify-Style Knowledge Graph Adoption Implementation

Date: 2026-04-07

Status: Proposed implementation plan for bounded same-stack adoption

Scope: Adopt the useful parts of the external `graphify` pattern as a derived analysis and navigation layer for Blueprint repo knowledge, org docs, and research artifacts without introducing a new source of truth, a new primary service, or a new runtime dependency in production flows.

## Decision

Blueprint should adopt the structure of `graphify`, not its defaults.

Blueprint will:

- use graph generation as a repo-local and KB-local analysis layer
- use it to improve architecture navigation, doctrine comprehension, contradiction detection, and multi-source research synthesis
- keep all graph outputs derived and non-authoritative
- keep Paperclip, Firestore, Notion, and repo doctrine files as the canonical systems they already are
- keep all initial adoption local, offline-friendly, and optional for operators and agents

Blueprint will not:

- adopt a new primary graph database
- make graph outputs authoritative for work state, rights, provenance, approvals, pricing, or runtime/package truth
- allow automatic answer-memory feedback loops to write themselves back into canonical knowledge without review
- route production automation through a graph runtime
- let graph generation become a hidden architecture input that overrides repo doctrine

## Why

This plan fits the current repo doctrine:

- capture-first and world-model-product-first in `PLATFORM_CONTEXT.md`
- backend-swappable world-model strategy in `WORLD_MODEL_STRATEGY_CONTEXT.md`
- Paperclip as execution record and Notion as workspace/review surface in `AUTONOMOUS_ORG.md`
- Hermes KB as support memory, not authority, in `docs/hermes-kb-design.md`
- no-new-primary-services governance in `docs/ai-tooling-adoption-implementation-2026-04-07.md`
- bounded AI tooling rules in `docs/ai-skills-governance-2026-04-07.md`

The external repo is valuable because it contributes a practical pattern:

- deterministic structural extraction for code
- semantic extraction for docs and multimodal artifacts
- explicit confidence labels for extracted vs inferred relationships
- persistent derived graph artifacts that let agents navigate by structure instead of raw grep alone

That pattern is useful for Blueprint.

Its default posture is not.

Blueprint already has:

- a defined control plane
- explicit human gates
- lane-specific automation workers
- a markdown-native Hermes KB
- repo doctrine files
- Notion sync and review infrastructure

So the correct use of graph generation here is to strengthen repo understanding and research reuse, not to create a second company brain.

## Problem Statement

Blueprint's current knowledge and agent context is spread across:

- repo doctrine files
- repo code
- `knowledge/`
- Paperclip packages, routines, and issues
- Notion mirrors
- Firestore-backed operational records

That is the correct authority layout, but it creates three practical gaps:

1. architecture and org understanding still require too much raw-file traversal
2. cross-document contradictions, overlaps, and stale assumptions are hard to surface automatically
3. reusable research and internal operating knowledge is only partially navigable by relationship

Graphify-style graphing can help with those gaps if it remains derivative.

## Hard Constraints

- No new primary services.
- No replatforming.
- No production dependency on a graph runtime.
- No graph output may claim authority over provenance, rights, package/runtime truth, work state, approvals, pricing, or legal commitments.
- No graph-generated memory may self-promote into canonical KB pages or Notion without explicit review or existing repo-governed automation.
- Initial rollout must work with the current Blueprint stack and local development environment.

## Authority Boundary

Graph outputs are allowed to support:

- repo comprehension
- KB navigation
- doctrine and playbook synthesis
- contradiction and overlap detection
- cross-repo architecture understanding
- market and research corpus navigation

Graph outputs are not allowed to become the source of truth for:

- Paperclip issue state
- agent ownership or approvals
- Firestore operational state
- rights, privacy, or consent state
- package manifests
- hosted-session truth
- buyer entitlements
- pricing or legal commitments
- capture provenance

If a graph report discusses any of those domains, it must link back to the canonical system and explicitly state that the graph output is derivative context only.

## Blueprint-Specific Use Cases

### 1. Repo Architecture Navigation

Use graph generation to help engineering and review agents answer:

- what are the major automation lanes and how do they connect
- where do doctrine files map into code
- which modules are god nodes or bridge nodes across worker systems
- which docs and routes are tightly coupled but maintained separately

### 2. Autonomous Org Audit

Use graph generation on curated snapshots of:

- `AUTONOMOUS_ORG.md`
- `ops/paperclip/`
- `knowledge/`
- selected Notion or Paperclip exports captured under `knowledge/raw/`

This should surface:

- duplicated responsibilities
- missing role-to-code connections
- stale program files
- conflicting instructions between org docs and implementation

### 3. Hermes KB Navigation

Use graph generation to improve:

- backlinks
- contradiction review
- open-question clustering
- reusable compiled-page discovery

This is a better fit than letting the KB grow as an unstructured markdown pile.

### 4. World-Model And Market Research Corpora

Use graph generation to cluster and query:

- world-model research notes
- competitor and buyer intel
- deployment proof docs
- screenshots, diagrams, and exported notes

This is especially useful for Hermes-backed research lanes.

## Non-Goals

- Building a production GraphRAG service
- replacing Hermes KB with a graph database
- replacing vector retrieval already used for selected runtime use cases
- building a new agent memory authority
- auto-writing strategy changes back into repo doctrine
- auto-writing public-facing claims from inferred graph relationships

## Implementation Shape

Blueprint should implement this as a bounded internal subsystem with three layers.

### Layer A: Corpus Selection

Allowed initial corpora:

- `docs/`
- `knowledge/`
- `ops/paperclip/`
- selected server/client code paths tied to agent runtime and ops automation
- curated exports captured in `knowledge/raw/`

Excluded by default:

- build output
- vendored dependencies
- generated artifacts
- secrets or local env files
- live operational dumps
- raw Firestore exports unless explicitly scrubbed and approved

### Layer B: Derived Graph Output

Initial output should be local-only under a derived folder such as:

```text
derived/graphify/
  webapp-architecture/
  autonomous-org/
  hermes-kb/
  market-intel/
```

Each graph workspace may contain:

- `GRAPH_REPORT.md`
- `graph.json`
- `graph.html`
- optional `wiki/`
- optional cache

These artifacts should not be committed by default unless a specific report is intentionally checked in.

### Layer C: Reviewed Promotion Path

Only reviewed findings should be promoted back into repo truth surfaces:

- `knowledge/compiled/`
- `knowledge/reports/`
- `knowledge/indexes/`
- issue/task creation in Paperclip or Notion where follow-up is required

Graph output should suggest review work.
It should not silently mutate canonical artifacts.

## Milestones

### M0. Lock The Boundary

Owner: `blueprint-cto`

Execution owner: `webapp-codex`

Deliverable:

- this implementation document committed in `docs/`
- explicit written boundary that graph generation is derivative analysis only

Acceptance criteria:

- no-new-primary-services rule is explicit
- no-new-authority rule is explicit
- repo doctrine and KB authority boundaries are cited directly
- later work can proceed without ambiguity about what graph outputs are allowed to do

### M1. Pilot Corpus Definition

Owner: `blueprint-cto`

Execution owner: `webapp-codex`

Deliverable:

- a first-pass corpus definition for `Blueprint-WebApp`
- a checked-in ignore policy for graph generation inputs

Work:

- define allowed inputs for the first engineering pilot
- exclude generated, sensitive, and irrelevant paths
- choose one graph workspace focused on architecture and automation

Suggested pilot scope:

- `PLATFORM_CONTEXT.md`
- `WORLD_MODEL_STRATEGY_CONTEXT.md`
- `AUTONOMOUS_ORG.md`
- `docs/hermes-kb-design.md`
- `knowledge/`
- `server/utils/opsAutomationScheduler.ts`
- `server/utils/agent-graduation.ts`
- `server/agents/`
- `server/routes/admin-agent.ts`

Acceptance criteria:

- pilot corpus is small enough to run locally and large enough to produce structure
- excluded paths are explicit
- no secret-bearing or live-system state is included by default

### M2. Local Graph Pilot

Owner: `webapp-codex`

Review owner: `blueprint-cto`

Deliverable:

- one local graph build for the engineering/autonomous-org pilot corpus
- one reviewable derived report summarizing what the graph found

Work:

- run a graph build locally against the pilot corpus
- inspect god nodes, bridge nodes, community clusters, and contradiction candidates
- write a repo-native review artifact under `knowledge/reports/` or `docs/`

Acceptance criteria:

- the graph produces at least one useful architecture report
- the report identifies at least 10 high-signal relationships or structural findings
- at least 3 findings are judged non-obvious and worth follow-up
- no graph output is treated as authority without review

### M3. Hermes KB Integration

Owner: `blueprint-chief-of-staff`

Execution owner: `webapp-codex`

Review owner: `notion-manager-agent`

Deliverable:

- a KB-safe workflow for using graph findings to update `knowledge/indexes/`

Work:

- map graph findings into:
  - `knowledge/indexes/backlinks.md`
  - `knowledge/indexes/open-questions.md`
  - `knowledge/indexes/contradictions.md`
  - `knowledge/indexes/stale-pages.md`
- keep graph outputs derivative
- require human or governed-agent review before compiled KB promotion

Acceptance criteria:

- graph findings can improve KB hygiene without changing authority boundaries
- the KB remains markdown-native and lintable
- duplicate page creation is reduced
- contradiction tracking becomes more systematic

### M4. Autonomous Org Audit Pass

Owner: `blueprint-chief-of-staff`

Execution owner: `webapp-codex`

Review owners:

- `blueprint-cto`
- `ops-lead`
- `growth-lead`

Deliverable:

- a focused autonomous-org graph audit
- a follow-up action list for org/document/program alignment

Work:

- build a graph over org docs, program files, selected package files, and curated exports
- identify:
  - duplicate role responsibilities
  - missing role-to-routine links
  - stale or disconnected program files
  - gaps between docs and implemented worker lanes

Acceptance criteria:

- the audit produces a concrete backlog, not just descriptive visuals
- each finding maps to one of:
  - doc fix
  - program fix
  - code fix
  - follow-up review task
- no finding bypasses current human gates

### M5. Cross-Repo Expansion Decision

Owner: `blueprint-cto`

Deliverable:

- explicit go/no-go decision on expanding the pattern to `BlueprintCapture` and `BlueprintCapturePipeline`

Decision rule:

- expand only if the `Blueprint-WebApp` pilot produces clear value in architecture navigation, contradiction detection, or research reuse
- do not expand merely because the graph looks interesting

Acceptance criteria:

- the decision is documented
- cross-repo adoption, if approved, preserves the same authority boundaries
- no new service is required to proceed

## Work Order

1. Land this document.
2. Define and check in the first pilot corpus and ignore rules.
3. Run one local graph pilot on `Blueprint-WebApp`.
4. Write a reviewed findings artifact.
5. Convert the high-signal findings into KB index updates and Paperclip follow-up work.
6. Decide whether to expand to cross-repo or keep the pattern local.

## Owners

- Human founder: final scope and priority authority
- `blueprint-cto`: architecture boundary owner
- `webapp-codex`: implementation owner for pilot setup and repo-local integration
- `blueprint-chief-of-staff`: cross-agent routing owner for follow-up work
- `notion-manager-agent`: optional mirror/review owner where Notion visibility is needed
- `ops-lead`: reviewer for autonomous-org operational fit
- `growth-lead`: reviewer for market/research corpus applicability

## Suggested Repo Changes

These are the first repo-local changes that would make this executable:

### 1. Add A Pilot Policy File

Suggested path:

```text
docs/graphify-pilot-corpus-policy-2026-04-07.md
```

Purpose:

- define first included/excluded paths
- define what can be graphed
- define what must stay out

### 2. Add Ignore Rules

Suggested path:

```text
.graphifyignore
```

Purpose:

- exclude noise and sensitive material
- keep local graph runs focused and cheap

### 3. Add A Derived Output Convention

Suggested path:

```text
derived/README.md
```

Purpose:

- mark graph outputs as derived artifacts
- prevent accidental promotion into canonical paths

### 4. Add A Reviewed Findings Template

Suggested path:

```text
knowledge/templates/graph-audit-report.template.md
```

Purpose:

- standardize how graph findings are promoted into reviewable markdown
- require explicit authority-boundary language

## Verification Rules

This adoption is successful only if all of the following remain true:

- Paperclip remains the execution and ownership record.
- Firestore remains the operational source of truth.
- Notion remains the review and visibility surface where already defined.
- Repo doctrine files remain canonical inside the repo.
- Hermes KB remains support memory, not authority.
- Graph artifacts improve understanding without creating governance drift.

If any rollout step weakens those rules, stop and revert the graph integration approach before expanding it.

## Default Decision Rule

When choosing between:

- a graph feature that improves structure and comprehension
- a graph feature that creates a new authority surface

choose the first and reject the second.

When choosing between:

- a local derived artifact
- a new persistent service

choose the local derived artifact unless `blueprint-cto` explicitly approves the service change as a separate architecture decision.
