# Tools

## Primary Sources
- `blueprint-manager-state`
  Use this to understand which producer runs completed, which ones blocked, and which issues need follow-through.
- Paperclip issues, comments, and routine proof
  This is the source of truth for execution ownership and next actions.
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/hermes-kb-design.md`
- repo KB under `/Users/nijelhunt_1/workspace/Blueprint-WebApp/knowledge/`
  Use this as the durable markdown source when reconciling mirrored research and synthesis artifacts.
- Blueprint Hub page: `https://www.notion.so/16d80154161d80db869bcfba4fe70be3`
- Blueprint Work Queue: `collection://51d93d65-8a00-4dd4-a9a2-fd9a6e69120d`
- Blueprint Knowledge: `collection://b9e4ca9c-db43-4a16-9780-f15eb100c8b4`
- Blueprint Skills: `collection://a9301f67-d565-4270-85e4-1fb8b82f96af`
- Blueprint Agents: `collection://66762c9c-b543-41d3-8f1f-95b80aed409a`
- Blueprint Agent Runs: `collection://1ddce596-3c89-46e4-afeb-34e905017d87`
- Founder OS page and the founder-facing linked views under Blueprint Hub

## Notion Manager Tools
- `notion-search-pages`
  Use this to locate Blueprint-managed pages, duplicates, and stale knowledge entries.
- `notion-fetch-page`
  Use this to inspect placement, metadata, and a short content preview before changing anything.
- `notion-upsert-knowledge`
  Use this when a knowledge artifact should be updated in place instead of appended again.
- `notion-upsert-work-queue`
  Use this when a work item should be reconciled to a stable queue page.
- `notion-update-page-metadata`
  Use this for ownership, lifecycle, execution-surface, output-location, canonical-source, freshness, and founder-visibility repairs.
- `notion-move-page`
  Use this only when the destination is clear and the page is Blueprint-managed.
- `notion-archive-page`
  Use this only for safe duplicates or obsolete Blueprint-managed pages.
- `notion-comment-page`
  Use this when a page needs human clarification or a visible note about why it was not auto-fixed.
- `notion-reconcile-relations`
  Use this to repair related work, docs, skills, and owner/freshness metadata together.
- `notion-read-work-queue`
  Use this when a cleanup depends on the current execution breadcrumb or the agent-facing queue view.
- `web-search`
  Secondary tool only. Use it for citation repair or externally sourced refreshes, not internal workspace routing.

## Alert Paths
- Manager and exec Slack webhook paths through Blueprint automation
  Use these for stale, ambiguous, or unsafe-to-repair workspace problems after the Paperclip issue is real.

## Trust Model
- Paperclip issue state outranks Notion page state for execution truth
- Paperclip and app runtime state outrank Notion Agent Runs rows for live execution truth
- repo KB outranks Notion Knowledge pages for durable markdown research artifacts when both exist
- Blueprint-managed Hub structure outranks ad-hoc page placement guesses
- explicit page relations outrank inferred relationships from titles alone

## Do Not Use Casually
- arbitrary workspace cleanup outside known Blueprint-managed surfaces
- archive or move operations when the natural key is weak or contested
- external search when local workspace evidence is already sufficient
- recent Paperclip run history as a proxy for current Notion truth
  If the Notion tool path is unavailable, block the issue instead of guessing from run logs.
