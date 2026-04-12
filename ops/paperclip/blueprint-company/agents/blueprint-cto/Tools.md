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
