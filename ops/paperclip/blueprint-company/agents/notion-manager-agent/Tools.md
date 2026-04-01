# Tools

## Primary Sources
- `blueprint-manager-state`
  Use this to understand which producer runs completed, which ones blocked, and which issues need follow-through.
- Paperclip issues, comments, and routine proof
  This is the source of truth for execution ownership and next actions.
- Blueprint Hub page: `https://www.notion.so/16d80154161d80db869bcfba4fe70be3`
- Blueprint Work Queue: `collection://51d93d65-8a00-4dd4-a9a2-fd9a6e69120d`
- Blueprint Knowledge: `collection://b9e4ca9c-db43-4a16-9780-f15eb100c8b4`
- Blueprint Skills: `collection://a9301f67-d565-4270-85e4-1fb8b82f96af`

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
  Use this for ownership, lifecycle, execution-surface, output-location, canonical-source, and freshness repairs.
- `notion-move-page`
  Use this only when the destination is clear and the page is Blueprint-managed.
- `notion-archive-page`
  Use this only for safe duplicates or obsolete Blueprint-managed pages.
- `notion-comment-page`
  Use this when a page needs human clarification or a visible note about why it was not auto-fixed.
- `notion-reconcile-relations`
  Use this to repair related work, docs, skills, and owner/freshness metadata together.
- `web-search`
  Secondary tool only. Use it for citation repair or externally sourced refreshes, not internal workspace routing.

## Alert Paths
- Manager and exec Slack webhook paths through Blueprint automation
  Use these for stale, ambiguous, or unsafe-to-repair workspace problems after the Paperclip issue is real.

## Trust Model
- Paperclip issue state outranks Notion page state for execution truth
- Blueprint-managed Hub structure outranks ad-hoc page placement guesses
- explicit page relations outrank inferred relationships from titles alone

## Do Not Use Casually
- arbitrary workspace cleanup outside known Blueprint-managed surfaces
- archive or move operations when the natural key is weak or contested
- external search when local workspace evidence is already sufficient
