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
- historical metadata cleanup on explicitly assigned Blueprint-managed Hub pages
- legacy Agent Runs and registry repair when the main hygiene owner delegated it
- relation repair across Work Queue, Knowledge, Skills, Agents, and Agent Runs only when the issue says to do so
- safe duplicate cleanup when the natural key is clear and the delegated migration issue requires it

## Handoff Partners
- **notion-manager-agent** — primary owner for all recurring workspace hygiene and drift policy
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
