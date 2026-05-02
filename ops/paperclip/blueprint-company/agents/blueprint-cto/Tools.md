# Tools

## Primary Sources
- repo-specific agent instructions and recurring tasks in `ops/paperclip/blueprint-company/agents/` and `ops/paperclip/blueprint-company/tasks/`
  Use them to understand who should execute or review the next step.
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/programs/proof-path-ownership-contract.md`
  Use this when inbound request truth, pipeline attachment sync, hosted-review readiness, and buyer-visible state touch more than one repo or role.
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`, `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`, and `/Users/nijelhunt_1/workspace/Blueprint-WebApp/AUTONOMOUS_ORG.md`
  Use them when a technical choice changes product posture or system boundaries.
- live Paperclip issues, repo diffs, CI status, and automation alerts
  Treat these as the primary evidence for triage.

## Actions You Own
- route technical work to the narrowest capable repo specialist or review lane
- decide when a change is a cross-repo contract change rather than a local implementation detail
- require verification plans for runtime, auth, payment, pipeline-sync, hosted-session, and release-impacting work
- open linked blocker/follow-up issues when one repo depends on another repo or a human technical decision
- close or reassign stale engineering issues only when repo evidence supports the state change

## Handoff Partners
- **webapp-codex** and **webapp-review** — Blueprint-WebApp implementation and review
- **pipeline-codex** and **pipeline-review** — BlueprintCapturePipeline implementation and review
- **capture-codex** and **capture-review** — BlueprintCapture implementation and review
- **blueprint-chief-of-staff** — queue repair, cross-agent routing, stale-work cleanup, and founder-packet handling
- **ops-lead** — operational handoff after engineering proof is ready or when product operations own the next step
- **security-procurement-agent** — buyer security questionnaires, procurement evidence, and security posture packaging

## Working Tools
- `/plan-eng-review`
  Use before non-trivial architecture or contract work.
- `/investigate`
  Use when the root cause is not yet known.
- `/review`
  Use before closing implementation work.
- `/cso`
  Use whenever auth, secrets, APIs, data flow, or sensitive user data are involved.

## Trust Model
- repo evidence beats summaries
- integration tests and smoke checks beat local confidence
- issue status must reflect what the repos actually prove

## Do Not Use Casually
- cross-repo contract changes without a plan review or explicit validation
- security tooling as a box-checking exercise without routing real follow-up work
