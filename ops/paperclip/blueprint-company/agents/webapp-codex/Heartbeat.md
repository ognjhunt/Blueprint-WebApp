# Heartbeat

## Triggered Runs (Primary)
- **Assigned implementation issue:** tighten the issue, confirm scope, and begin execution.
- **Reviewer or QA follow-up:** address concrete findings and return the issue to a validated state.
- **CI, smoke, or runtime regression on touched code:** reproduce, fix, and document the validation path.
- **Cross-repo dependency discovered:** open a linked blocker and hand off before continuing blind.

Execution guardrails for triggered issue runs:
- Start from `PAPERCLIP_TASK_ID` when present. Do not replace an issue-bound run with a general repo sweep.
- Use the issue heartbeat context and recent issue comments first. Pull broad repo state only when the issue itself is repo-drift or workspace-drift work.
- Keep reads narrow: acceptance criteria, touched files, failing tests, launch scripts, or one concrete contract. Avoid multi-file dumps that are not directly required.
- If the issue wake came from assignment or execution dispatch, prefer one focused implementation or validation pass over collecting extra repo context.
- If a run starts in a fallback workspace instead of the project-primary checkout for `Blueprint-WebApp`, treat that as recovery-only context and avoid editing unrelated files there.

## Scheduled Runs
- **Morning sweep (weekdays):** review assigned WebApp issues, stale implementation work, and open blockers.
- **Pre-handoff sweep:** before moving any issue to review, confirm validation evidence and residual risk are documented.

## Stage Model
- `intake` -> confirm the assigned issue is real, current, and worth executing now.
- `issue tightened` -> turn fuzzy scope into explicit acceptance criteria, dependencies, and validation steps.
- `implementing` -> make the smallest useful code change for the issue.
- `validating` -> run targeted checks, manual verification, or smoke coverage for the touched surface.
- `ready for review` -> hand to `webapp-review` with evidence, risks, and follow-up notes attached to the issue.
- `blocked/escalated` -> stop local work when a dependency, human gate, or contract question prevents safe progress.

## Block Conditions
- acceptance criteria are too ambiguous to implement safely
- buyer-facing claims depend on missing product or artifact evidence
- a needed contract detail lives in pipeline or capture and is not yet confirmed
- the touched surface fails validation and root cause is still unknown

## Escalation Conditions
- rights, privacy, or provenance ambiguity affects what the WebApp can show or promise
- cross-repo contract drift appears between WebApp and pipeline or capture
- release-gate failure blocks a fix or ship decision
- product surfaces would otherwise overstate capability without evidence
- issue status and repo reality have diverged enough that the work record is no longer trustworthy
