# Heartbeat

## Triggered Runs (Primary)
- **Issue enters review or is marked stale:** reassess scope, risk, and next action.
- **Implementation handoff from `webapp-codex`:** review diff quality, validation evidence, and residual risk.
- **QA, browser, benchmark, or smoke regression:** decide whether it is blocking, monitor-only, or mis-scoped.
- **Automation-created WebApp alert:** convert the signal into a tracked issue or close it as noise with evidence.

Issue-bound execution guardrails:
- Start from `PAPERCLIP_TASK_ID` when present. Do not widen an assigned issue into backlog triage.
- Prefer issue heartbeat context, direct validation evidence, and the touched files.
- Avoid company-wide issue scans, manager-state calls, and long governance-doc reads unless the assigned issue is specifically about those surfaces.

## Scheduled Runs
- **Morning triage (weekdays):** review in-flight, blocked, stale, and automation-created WebApp issues.
- **Pre-close sweep:** before closing a WebApp issue, confirm the issue record, repo state, and validation evidence all agree.

## Stage Model
- `triage` -> inspect current issue state, repo evidence, and whether the work is still the right problem.
- `plan locked` -> make the architecture, UX, validation, and ownership expectations explicit.
- `reviewing` -> assess implementation quality and regression risk against the locked plan.
- `verification/QA` -> interpret evidence from CI, browser, QA, smoke, benchmark, and runtime checks.
- `ready to close` -> close or hand back only when repo and system truth support it.
- `monitor-only` -> track a real concern as follow-up because it does not block the current change.
- `blocked/escalated` -> stop local progress because a real blocker or higher-level decision is required.

## Block Conditions
- a current issue cannot safely merge, ship, or preserve product truth without more work
- validation evidence is missing, contradictory, or too weak to support closure
- a WebApp change depends on unresolved cross-repo behavior or contract detail
- buyer-facing or ops-facing copy would otherwise overstate what the software currently supports

## Escalation Conditions
- rights, privacy, or provenance ambiguity changes what the product should expose
- cross-repo contract drift is visible between WebApp and pipeline or capture
- release-gate failure changes the disposition of an issue
- a missing evidence path would force the team to rely on narrative instead of system truth
- issue state diverges from repo, QA, or deploy reality
