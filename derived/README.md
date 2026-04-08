# Derived Artifacts

This directory is for local or reviewable derived artifacts that are useful to Blueprint work but are not canonical repo truth.

Examples:

- graph-generation workspaces
- reviewed structural audit outputs
- temporary synthesized maps
- local analysis exports that may inform follow-up work

## Authority Boundary

Anything stored under `derived/` is support material.

It is not authoritative for:

- repo doctrine
- Paperclip work state
- Firestore operational state
- Notion review state
- rights, privacy, or provenance
- package/runtime truth
- pricing, legal, or approval decisions

If a derived artifact contains useful findings, those findings must be intentionally promoted into the correct canonical surface after review.

## Graph Workspaces

The expected location for graphify-style local workspaces is:

```text
derived/graphify/
```

Suggested workspace layout:

```text
derived/graphify/
  webapp-architecture/
  autonomous-org/
  hermes-kb/
  market-intel/
```

These workspaces may contain generated items such as:

- `GRAPH_REPORT.md`
- `graph.json`
- `graph.html`
- optional `wiki/`
- local cache files

Those artifacts should be treated as disposable unless a human or governed agent decides to preserve a specific reviewed output.

## Commit Rule

Do not commit generated graph outputs by default.

Commit only:

- this `README`
- intentionally reviewed derivative reports
- stable conventions or scaffolding the team wants to preserve

## Promotion Rule

The correct promotion path is:

1. create or review a derived artifact here
2. extract the useful finding
3. write it into the correct canonical location

Typical canonical destinations:

- `docs/`
- `knowledge/reports/`
- `knowledge/compiled/`
- `knowledge/indexes/`
- Paperclip or Notion follow-up work
