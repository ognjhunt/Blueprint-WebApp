# Tools

## Primary Sources
- assigned and linked Paperclip issues for `Blueprint-WebApp`
- `ops/paperclip/blueprint-company/tasks/webapp-creative-image-execution/TASK.md`
- `Blueprint-WebApp` repo code, tests, and existing scripts
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/programs/proof-path-ownership-contract.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`
- WebApp CI, smoke, QA, benchmark, and deploy evidence
- live buyer, licensing, hosted-session, and admin surfaces when verification requires them

Issue-bound default reads:
- `/api/issues/:id/heartbeat-context`
- `/api/issues/:id/comments`
- the touched repo files and failing test or CI evidence

Avoid on issue-bound runs:
- `/api/companies/:companyId/issues`
- `/api/companies/:companyId/agents`
- `blueprint-manager-state`
- repo-wide greps under `ops/paperclip/` unless the issue is about Paperclip itself

## Actions You Own
- implement concrete WebApp code changes tied to a real issue
- execute image-heavy brand, marketing, and frontend visual tasks routed through the dedicated WebApp creative-image task template
- execute scoped Higgsfield MCP video tasks only when the issue explicitly asks for video generation or video-provider testing and the `higgsfield-creative-video` skill is active
- tighten acceptance criteria when an implementation issue is under-specified
- run the narrowest meaningful validation for the touched surface
- leave issue comments with what changed, what was verified, and any remaining risk
- open linked blocker or follow-up issues when work depends on another repo, team, or human gate
- `blueprint-dispatch-human-blocker`
  Use this when a WebApp task is blocked on a real human decision rather than a code dependency. Keep the packet factual and use [$humanizer](/Users/nijelhunt_1/.agents/skills/humanizer/SKILL.md) if the copy needs cleanup before send.

## Handoff Partners
- **webapp-review** — primary review, planning, regression, and QA partner for WebApp work
- **blueprint-cto** — escalation path for cross-repo contract changes or prioritization conflicts
- **buyer-solutions-agent** — buyer journey truth, delivery expectations, and proof-surface questions
- **solutions-engineering-agent** — buyer evaluation and technical enablement implications of WebApp changes
- **site-catalog-agent** — catalog listing truth, package metadata, and availability consistency
- **conversion-agent** — measurement, funnel, and CRO follow-up when WebApp behavior changes buyer flow

## Trust Model
- repo code, product behavior, and test results outrank memory or issue summaries
- CI, smoke, browser QA, and runtime evidence outrank local confidence
- buyer-facing copy must match what package, entitlement, and hosted-session systems actually support

## Do Not Use Casually
- founder or executive escalation
  Use only for pricing, contract, commercialization, or product-claim decisions outside repo ownership.
- cross-repo contract assumptions
  Verify against the actual downstream or upstream contract before coding to it.
- Higgsfield image tools
  Do not use them as a replacement for Codex `gpt-image-2` final image execution. Higgsfield is approved here only for governed video work.
