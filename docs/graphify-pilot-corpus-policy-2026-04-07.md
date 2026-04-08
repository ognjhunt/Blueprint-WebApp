# Graphify Pilot Corpus Policy

Date: 2026-04-07

Status: Active pilot policy

Scope: First-pass corpus and run policy for graphify-style derived graph generation in `Blueprint-WebApp`.

## Purpose

This file makes the initial graph pilot executable without ambiguity.

It defines:

- what the first pilot is allowed to ingest
- what must stay out by default
- where derived graph outputs belong
- how findings may be promoted back into reviewed Blueprint artifacts

This policy must be read together with:

- `docs/graphify-adoption-implementation-2026-04-07.md`
- `docs/hermes-kb-design.md`
- `docs/ai-skills-governance-2026-04-07.md`
- `PLATFORM_CONTEXT.md`
- `WORLD_MODEL_STRATEGY_CONTEXT.md`
- `AUTONOMOUS_ORG.md`

## Core Rule

The pilot is for structure discovery, not authority creation.

Graph outputs may help agents and humans understand the repo faster.
They may not override repo doctrine, Paperclip state, Firestore state, Notion review state, rights/provenance truth, or package/runtime truth.

## Pilot Goal

The first pilot should answer these questions:

1. Which modules and docs are the structural centers of the current autonomous-org and ops-automation implementation?
2. Where do doctrine files map into code, routines, and review surfaces?
3. What contradictions, overlaps, stale assumptions, or missing links are visible once docs and implementation are graphed together?
4. Can those findings be promoted into `knowledge/indexes/` or reviewed reports without creating a second authority layer?

## Allowed Inputs

The first pilot may include:

- `PLATFORM_CONTEXT.md`
- `WORLD_MODEL_STRATEGY_CONTEXT.md`
- `AUTONOMOUS_ORG.md`
- `docs/`
- `knowledge/compiled/`
- `knowledge/indexes/`
- `knowledge/README.md`
- `knowledge/AGENTS.md`
- `ops/paperclip/`
- `server/agents/`
- `server/utils/opsAutomationScheduler.ts`
- `server/utils/agent-graduation.ts`
- `server/utils/notion-sync.ts`
- `server/utils/autonomous-growth.ts`
- `server/routes/admin-agent.ts`
- `server/routes/admin-growth.ts`
- `server/routes/paperclip-relay.ts`

These inputs were chosen because they represent:

- doctrine
- org structure
- KB structure
- automation orchestration
- graduation policy
- review and runtime surfaces

## Excluded By Default

The first pilot must exclude:

- `node_modules/`
- `dist/`
- `coverage/`
- `attached_assets/`
- `paperclip-desktop/`
- `ops/paperclip/external/`
- environment files
- secret-bearing files
- generated screenshots and large binary assets
- live operational dumps
- Firestore exports
- unreviewed `knowledge/raw/` corpora

`knowledge/raw/` is excluded by default because it can be large, noisy, sensitive, and partially processed.
Specific raw-source subtrees may be graphed later only when intentionally selected for a focused research run.

`ops/paperclip/external/` is excluded from the core `webapp-architecture` pilot because it introduces large external skill-pack and reference-code clusters that dilute Blueprint-native control-plane signal. If Blueprint wants to analyze that material later, it should live in a separate graph workspace rather than the core architecture pilot.

## Default Pilot Workspaces

The recommended first local workspaces are:

```text
derived/graphify/webapp-architecture/
derived/graphify/autonomous-org/
derived/graphify/hermes-kb/
```

Suggested usage:

- `webapp-architecture`: doctrine + selected code paths
- `autonomous-org`: org docs + `ops/paperclip/` + selected routes/utilities
- `hermes-kb`: `knowledge/compiled/`, `knowledge/indexes/`, and selected supporting docs

## Run Rules

### 1. Start narrow

Do not run the first pilot across the entire repo root.

Start with a curated subset of:

- doctrine docs
- autonomous org docs
- selected automation modules
- selected KB pages

### 2. Keep outputs local and derived

Graph outputs belong under:

- `graphify-out/` for tool-local scratch output
- `derived/graphify/` for named local workspaces

Do not write graph outputs into:

- `knowledge/compiled/`
- `knowledge/reports/`
- `knowledge/indexes/`
- `docs/`

unless a human or governed agent intentionally promotes reviewed findings there.

### 3. Promote only reviewed findings

The only approved promotion path is:

1. run graph locally
2. inspect findings
3. write a reviewed markdown report
4. decide which items belong in:
   - `knowledge/indexes/`
   - `knowledge/reports/`
   - Paperclip follow-up work
   - a new or updated repo doc

### 4. No silent memory feedback

Do not enable any workflow that automatically writes graph query answers back into the canonical KB or repo docs.

If a local tool writes query memory into a local derived folder, that content must stay derived until reviewed.

## Review Questions

Every pilot review should explicitly answer:

- Which findings are clearly extracted versus inferred?
- Which findings are operationally useful?
- Which findings are non-obvious enough to justify follow-up?
- Which findings touch authority-boundary domains and therefore must only become review tasks?
- Which findings can safely improve `knowledge/indexes/`?

## Promotion Rules

### Safe To Promote

- backlinks between KB pages
- open questions for future research
- contradiction candidates that clearly need review
- stale-page reminders
- reviewed architecture summaries that remain explicitly derivative

### Not Safe To Promote Automatically

- inferred org authority changes
- inferred policy changes
- inferred rights/provenance claims
- inferred package/runtime claims
- inferred buyer entitlement or commercialization claims
- anything that implies a live operational state change

## Pilot Success Criteria

The first pilot is successful when all of these are true:

- at least one graph workspace produces a useful `GRAPH_REPORT.md`
- at least 10 high-signal relationships or structural findings are surfaced
- at least 3 findings are judged non-obvious and actionable
- at least one reviewed artifact is promoted into repo-managed knowledge or follow-up work
- no graph artifact is treated as authority
- no new service is introduced

## Failure Conditions

Stop the pilot and narrow scope if any of these happen:

- graph outputs become too noisy to review
- the corpus includes sensitive or live operational state by accident
- inferred findings start being treated as authoritative
- the pilot creates more maintenance burden than navigation value

## Default Decision Rule

If there is a choice between:

- including more files to make the graph feel complete
- keeping the pilot narrow enough to review carefully

choose the narrow pilot.

If there is a choice between:

- promoting a finding because it looks plausible
- leaving it in a reviewed derived report until verified

leave it in the reviewed derived report until verified.
