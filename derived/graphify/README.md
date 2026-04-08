# Graphify Workspaces

This subtree holds local graphify-style workspaces for Blueprint pilots.

These workspaces are:

- derived
- non-authoritative
- local-first
- disposable unless a specific reviewed output is intentionally preserved

Expected workspace pattern:

```text
derived/graphify/
  webapp-architecture/
  autonomous-org/
  hermes-kb/
  market-intel/
```

Generated outputs inside these workspaces should not be committed by default.

If a graph run produces a useful finding, promote the reviewed conclusion into:

- `docs/`
- `knowledge/reports/`
- `knowledge/compiled/`
- `knowledge/indexes/`
- Paperclip or Notion follow-up work

Do not treat any graph output here as canonical repo truth.
