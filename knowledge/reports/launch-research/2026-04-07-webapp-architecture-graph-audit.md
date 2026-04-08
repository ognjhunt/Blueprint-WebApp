---
authority: draft
source_system: repo
source_urls:
  - "repo:///docs/graphify-adoption-implementation-2026-04-07.md"
  - "repo:///docs/graphify-pilot-corpus-policy-2026-04-07.md"
  - "repo:///derived/graphify/webapp-architecture/README.md"
  - "repo:///derived/graphify/webapp-architecture/corpus.manifest.txt"
  - "repo:///derived/graphify/webapp-architecture/corpus/graphify-out/GRAPH_REPORT.md"
  - "repo:///derived/graphify/webapp-architecture/corpus/graphify-out/PILOT_METADATA.json"
last_verified_at: "2026-04-07"
owner: webapp-codex
sensitivity: internal
confidence: 0.58
---

# Blueprint-WebApp Architecture Graph Audit

## Summary

Two runnable `Blueprint-WebApp` graphify-style pilot iterations were completed against the staged `webapp-architecture` corpus.

Iteration 1 included `ops/paperclip/external/`.
Iteration 2 excluded `ops/paperclip/external/` from the core pilot.

The comparison shows that excluding `ops/paperclip/external/` materially improves Blueprint-native signal:

- corpus size dropped from 661 files and about 573k words to 478 files and about 300k words
- graph size dropped from 1,696 nodes, 3,333 links, and 88 communities to 821 nodes, 1,987 links, and 56 communities
- the top communities became much more clearly centered on Blueprint-owned worker, Notion, runtime, workflow, Firestore, and knowledge modules instead of being diluted by external skill-pack clusters

Both runs are still narrower than the long-term target:

- they used graphify's deterministic AST path over staged code files
- they did not perform semantic extraction over the staged docs corpus
- they therefore surfaced code-centered structural clusters well, but still did not map doctrine markdown into code relationships in a meaningful way

The main conclusion after the second run is that Blueprint's actual autonomous-org implementation is structurally centered on:

- the Paperclip automation worker/plugin control plane
- the Notion integration and sync surface
- the agent runtime, workflow, and policy layer
- the action execution and approval path
- the startup-context and knowledge assembly layer

The other main conclusion is that excluding `ops/paperclip/external/` was the correct move for the core `webapp-architecture` pilot and should remain part of that pilot's default boundary.

## Corpus Scope

- Included paths: see [corpus.manifest.txt](/Users/nijelhunt_1/workspace/Blueprint-WebApp/derived/graphify/webapp-architecture/corpus.manifest.txt)
- Excluded paths: see [.graphifyignore](/Users/nijelhunt_1/workspace/Blueprint-WebApp/.graphifyignore) and [graphify-pilot-corpus-policy-2026-04-07.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/graphify-pilot-corpus-policy-2026-04-07.md)
- Output workspace: [derived/graphify/webapp-architecture/README.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/derived/graphify/webapp-architecture/README.md)
- Graph generation mode: staged AST pilot, `--no-viz`

Observed corpus and output metrics:

- iteration 1, before excluding `ops/paperclip/external/`:
  - corpus size: 661 files, approximately 573,239 words
  - detected files: 121 code files and 540 document files
  - graph output: 1,696 nodes, 3,333 exported links, 88 detected communities
- iteration 2, after excluding `ops/paperclip/external/`:
  - corpus size: 478 files, approximately 300,348 words
  - detected files: 79 code files and 399 document files
  - graph output: 821 nodes, 1,987 exported links, 56 detected communities
- semantic extraction: not included in either pilot iteration
- generated outputs for the latest run:
  - [GRAPH_REPORT.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/derived/graphify/webapp-architecture/corpus/graphify-out/GRAPH_REPORT.md)
  - [PILOT_METADATA.json](/Users/nijelhunt_1/workspace/Blueprint-WebApp/derived/graphify/webapp-architecture/corpus/graphify-out/PILOT_METADATA.json)

## Evidence

- In both runs, the top god nodes were concentrated in the Paperclip automation plugin and related helpers rather than in buyer-facing app routes. The highest-signal examples remained `upsertManagedIssue()`, `appendRecentEvent()`, `writeState()`, `runRoutineHealthCheck()`, and `notionClient()`. This indicates that the center of operational coupling in the current pilot corpus is the internal worker/control-plane layer, not the marketing or page layer.
- The second run produced a cleaner set of Blueprint-native top communities. The most relevant communities after excluding `ops/paperclip/external/` were:
  - `notion cluster`, centered on [notion.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/plugins/blueprint-automation/src/notion.ts)
  - `workflows cluster`, centered on [workflows.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/agents/workflows.ts)
  - `worker cluster`, centered on [worker.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/plugins/blueprint-automation/src/worker.ts)
  - `runtime cluster`, centered on [runtime.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/agents/runtime.ts) and [policies.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/agents/policies.ts)
  - `firestore cluster`, centered on [action-executor.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/agents/action-executor.ts)
  - `notion-sync cluster`, centered on [notion-sync.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/notion-sync.ts)
  - `content-ops cluster`, centered on [autonomous-growth.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/autonomous-growth.ts)
  - `knowledge cluster`, centered on [knowledge.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/agents/knowledge.ts)
- This second-run cluster pattern is stronger evidence than the first-run output that Blueprint's autonomous-organization implementation is materially embodied in:
  - plugin worker state and managed-issue handling
  - Notion writing and synchronization logic
  - agent task routing and runtime policies
  - Firestore-backed action execution and approval flows
  - startup-context and knowledge assembly
- The first run surfaced no surprising inter-file connections because the graph was diluted by broad external-code inclusion and remained AST-only. The second run did surface bridge edges, but they were still internal to [worker.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/plugins/blueprint-automation/src/worker.ts) rather than doc-to-code relationships. That is an improvement in structural cohesion, but it does not yet solve the doctrine-to-implementation mapping problem.
- The strongest before/after result is the noise reduction itself:
  - removing `ops/paperclip/external/` reduced file count by about 28 percent
  - reduced total words by about 48 percent
  - reduced graph nodes by about 52 percent
  - reduced exported links by about 40 percent
  - reduced communities by about 36 percent
  - made the highest-ranked communities dominantly Blueprint-native instead of mixed with external skill-pack clusters

## Recommended Follow-up

- Update `knowledge/indexes/backlinks.md` with: no direct KB backlink promotion yet. This first pilot did not semantically connect compiled KB pages to code strongly enough to justify durable backlink entries.
- Update `knowledge/indexes/open-questions.md` with:
  - `What is the smallest semantically extracted doctrine-plus-code corpus that can reliably map PLATFORM_CONTEXT, WORLD_MODEL_STRATEGY_CONTEXT, and AUTONOMOUS_ORG into the actual runtime and worker modules?`: it determines whether graphing can become a durable architecture aid, source systems to check next are repo doctrine and staged graph workspaces, owner `webapp-codex`
  - `Should the core webapp-architecture pilot split worker.ts into a dedicated plugin-control-plane workspace and a separate cross-system architecture workspace so the graph can isolate plugin internals from higher-level runtime structure?`: it affects how much the core pilot over-centers the plugin worker file, source systems to check next are repo and staged graph outputs, owner `blueprint-cto`
- Update `knowledge/indexes/contradictions.md` with: none yet. The current pilot did not surface a high-confidence contradiction; it surfaced a scope/noise problem instead.
- Open or update a Paperclip/Notion follow-up for:
  - keeping `ops/paperclip/external/` out of the core `webapp-architecture` pilot by default
  - deciding whether `ops/paperclip/external/` belongs in a separate graph workspace instead of the core webapp-architecture pilot
  - planning a third pilot that includes reviewed semantic extraction for doctrine markdown rather than AST-only code structure
  - deciding whether to split the next core run into:
    - plugin control-plane graph
    - cross-system architecture graph

## Linked KB Pages

- [graphify-adoption-implementation-2026-04-07.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/graphify-adoption-implementation-2026-04-07.md)
- [graphify-pilot-corpus-policy-2026-04-07.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/graphify-pilot-corpus-policy-2026-04-07.md)
- [hermes-kb-design.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/hermes-kb-design.md)

## Promotion Decision

- Safe to promote now:
  - this reviewed report
  - the conclusion that Paperclip worker/plugin code, Notion sync, agent workflows, runtime policies, and action execution are the main structural centers in the current staged corpus
  - the conclusion that the original pilot scope was too broad inside `ops/paperclip/`
  - the conclusion that excluding `ops/paperclip/external/` improves Blueprint-native signal and should remain the default for the core pilot
- Needs verification before promotion:
  - any claim that doctrine markdown is already well-mapped into implementation
  - any claim that the graph has surfaced cross-system contradictions in rights, provenance, pricing, or runtime truth
  - any inferred relationship that crosses from docs into code without semantic extraction
- Must remain derived only:
  - raw graph outputs
  - community labels generated by the pilot
  - intermediate graph queries
  - any AST-only implication about strategy or org alignment beyond the concrete module clustering above

## Authority Boundary

This report summarizes derived graph analysis runs. It is not authoritative for Paperclip work state, Firestore operational state, rights/privacy/provenance, package/runtime truth, pricing/legal commitments, or approval decisions. Any finding that touches those areas must be verified against the canonical system before action.
