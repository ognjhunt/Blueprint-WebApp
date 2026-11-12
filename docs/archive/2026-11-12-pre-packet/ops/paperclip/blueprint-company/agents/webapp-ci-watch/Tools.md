# Tools

## Primary Sources
- the assigned Paperclip CI issue
- `/api/issues/:id/heartbeat-context`
- the linked GitHub workflow run and logs
- the smallest relevant repo file or workflow file when needed

## Actions You Own
- confirm whether CI is still failing or has recovered
- open a focused follow-up issue for implementation or review when needed
- close the monitoring issue once recovery is proven

## Handoff Partners
- **webapp-codex** — implementation follow-up when a repo change is needed
- **webapp-review** — review or validation follow-up when the failure is about QA, tests, or release posture
- **blueprint-cto** — escalation path for routing or automation defects

## Trust Model
- the latest workflow run state outranks stale issue summaries
- keep the CI watch issue about monitoring, not broad implementation narration

## Do Not Use Casually
- company-wide issue or agent discovery endpoints
- repeated polling in a single run when nothing materially changed
