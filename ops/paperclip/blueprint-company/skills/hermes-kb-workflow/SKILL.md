---
name: hermes-kb-workflow
description: KB-first workflow for Blueprint research and enablement agents. Use repo-local `knowledge/` as durable support memory, then mirror operator-facing artifacts to Notion without replacing Paperclip or canonical truth.
---

# Hermes KB Workflow

Primary repo:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp`

Read first:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/hermes-kb-design.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/knowledge/README.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/knowledge/AGENTS.md`

## Purpose

Use the repo-local Hermes KB as the compounding markdown memory layer for research, buyer enablement, and reusable synthesis.

Do not use it as authority for:

- Paperclip issue ownership or live execution state
- rights, privacy, approvals, or commercialization decisions
- pricing or legal commitments
- capture provenance
- package manifests or hosted runtime truth

Paperclip remains execution truth. Canonical repo docs, runtime artifacts, and source systems remain product truth. Notion remains the mirrored human-facing review surface.

## Writer Workflow

When you are a Phase 1 KB writer:

1. Search `knowledge/compiled/` before creating a new page.
2. Capture raw evidence under `knowledge/raw/<source-system>/<YYYY-MM-DD>/<slug>/`.
3. Update the reusable compiled page first.
4. Write a dated report under `knowledge/reports/` only when the run produced a task-specific artifact.
5. Update `knowledge/indexes/` when new open questions, contradictions, stale pages, or cross-page relationships appear.
6. Only after the KB artifact exists, publish or mirror the operator-facing artifact into Notion or the deterministic report writer path.

Useful commands:

```bash
npm run ingest:hermes-kb -- --help
npm run ingest:hermes-kb -- raw-source --source-system web --title "Example source" --source-url https://example.com
npm run ingest:hermes-kb -- compiled-page --category market-intel --title "Example page" --owner market-intel-agent --source-system web --source-url https://example.com
npm run ingest:hermes-kb -- report --category account-research --title "Example account memo" --owner buyer-solutions-agent --source-system web --source-url https://example.com
npm run lint:hermes-kb
```

## Reader Workflow

When you are a KB reader:

- use `knowledge/compiled/` and `knowledge/reports/` for background context and reuse
- when you need Blueprint-managed Notion context, use the Blueprint automation Notion tool path first (`notion-search-pages`, `notion-fetch-page`, deterministic report writers, or other maintained plugin tools)
- verify execution state in Paperclip before acting
- verify policy, rights, pricing, provenance, package, and runtime truth in the canonical system before acting
- treat missing or stale KB pages as a repair signal, not permission to guess

## Safety Rules

- Prefer updating an existing page over creating a duplicate topic page.
- Keep raw sources close to their original form.
- Keep authority boundaries explicit in every compiled page and report.
- Do not scrape `https://www.notion.so`, call private Notion `/api/v3` routes, or depend on `token_v2` cookies from agent runs when a supported Blueprint tool or maintained API path exists.
- If a run touches a sensitive truth domain, link to the canonical system instead of summarizing it as settled KB fact.
- Do not add KB write paths for `rights-provenance-agent`, `capture-qa-agent`, `capture-codex`, or `pipeline-codex`.
