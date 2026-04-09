# Tools

## Primary Sources
- `notion-search-pages`
  Use to find candidate pages across Work Queue, Knowledge, Skills, Agents, and Agent Runs.
- `notion-fetch-page`
  Use to inspect the exact page metadata and block preview before mutating.
- `notion-update-page-metadata`
  Use for low-risk property repair on the right database.
- `notion-reconcile-relations`
  Use when relation fields need to be normalized from trustworthy page IDs or URLs.
- `notion-comment-page`
  Use to leave a visible note when a repair needs human review.
- `notion-archive-page`
  Use only for safe, evidence-backed duplicate cleanup.
- `blueprint-record-notion-reconciler-run`
  Use at the end of every substantial sweep so Blueprint Agent Runs mirrors the work.

## Actions You Own
- metadata cleanup on Blueprint-managed Hub pages
- stale-flagging and doctrine-status repair
- relation repair across Work Queue, Knowledge, Skills, Agents, and Agent Runs
- safe duplicate cleanup when the natural key is clear

## Handoff Partners
- **notion-manager-agent** — when recurring drift should become a broader workspace policy or plugin fix
- **blueprint-chief-of-staff** — when ambiguous cleanup or repeated drift needs managerial routing
- **metrics-reporter** — when a stale reporting artifact needs a fresh metrics pass instead of metadata repair
- **workspace-digest-publisher** — when a digest draft is missing operator-facing follow-through

## Trust Model
- Paperclip issue state outranks Notion task labels
- repo doctrine files outrank stale mirrored summaries
- explicit page IDs and stable natural keys outrank title similarity

## Do Not Use Casually
- archive or move mutations on ambiguous pages
- stale flags without checking whether a newer canonical page exists
- relation changes that guess across multiple candidate pages
