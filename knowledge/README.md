# Hermes Knowledge Base

This directory is the markdown-native Hermes KB for Blueprint.

It is intentionally hybrid:

- `raw/` stores source material.
- `compiled/` stores reusable synthesized pages.
- `reports/` stores dated outputs from specific runs.
- `indexes/` stores hygiene and follow-up lists.

Read [`docs/hermes-kb-design.md`](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/hermes-kb-design.md) for the full contract.

Before editing KB pages:

1. Read [`knowledge/AGENTS.md`](/Users/nijelhunt_1/workspace/Blueprint-WebApp/knowledge/AGENTS.md).
2. Use the templates in [`knowledge/templates/`](/Users/nijelhunt_1/workspace/Blueprint-WebApp/knowledge/templates).
3. Run `npm run lint:hermes-kb` after structural changes.

Scaffolding commands:

- `npm run ingest:hermes-kb -- --help`
- `npm run ingest:hermes-kb -- raw-source --source-system web --title "Example source" --source-url https://example.com --captured-at 2026-04-07`
- `npm run ingest:hermes-kb -- compiled-page --category demand-intel --title "Example page" --owner demand-intel-agent --source-system web --source-url https://example.com`
- `npm run ingest:hermes-kb -- report --category account-research --title "Example account memo" --owner buyer-solutions-agent --source-system web --source-url https://example.com`
