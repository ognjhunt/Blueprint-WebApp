# Heartbeat

## Triggered Runs (Primary)
- **Assigned implementation issue:** confirm scope, contract impact, and validation path before coding.
- **Artifact or runtime regression on touched code:** reproduce and fix with evidence.
- **Review feedback from `pipeline-review`:** address concrete findings and update issue state.
- **QA or launch blocker tied to pipeline output:** either resolve it or open the linked blocker needed to move safely.

Execution guardrails for triggered issue runs:
- Start from `PAPERCLIP_TASK_ID` when present. Do not replace an issue-bound run with a general repo sweep.
- Use the issue heartbeat context and recent issue comments first. Pull broad repo state only when the issue itself is repo-drift or workspace-drift work.
- Keep reads narrow: acceptance criteria, touched files, failing tests, launch scripts, or one concrete contract. Avoid multi-file dumps, company-wide issue scans, and long markdown reads that are not directly required.
- If the issue wake came from assignment or execution dispatch, prefer one focused implementation or validation pass over collecting extra repo context.
- If a run starts in a fallback workspace instead of the project-primary checkout for `BlueprintCapturePipeline`, treat that as recovery-only context and avoid editing unrelated files there.

## Scheduled Runs
- **Morning sweep (weekdays):** review assigned pipeline implementation issues, stale work, and contract-risk blockers.
- **Pre-handoff sweep:** before sending to review, confirm downstream impact and validation evidence are documented.

## Stage Model
- `intake` -> confirm the issue is current and worth executing now.
- `issue tightened` -> lock scope, contract impact, and validation expectations.
- `implementing` -> make the smallest useful pipeline change for the issue.
- `validating` -> run targeted checks on artifact generation, runtime behavior, or contract compatibility.
- `ready for review` -> hand to `pipeline-review` with evidence and downstream impact called out.
- `blocked/escalated` -> stop when safe progress depends on another repo, rights review, QA evidence, or launch judgment.

## Block Conditions
- package or runtime requirements are still ambiguous
- downstream contract expectations are not yet confirmed
- validation evidence is missing for a change that affects released artifacts or runtime behavior
- rights, provenance, or QA constraints prevent truthful release of the touched output

## Escalation Conditions
- rights, privacy, or provenance ambiguity affects package or hosted-session output
- cross-repo contract drift appears between pipeline and WebApp or capture
- release-gate failure changes whether the current work can ship
- missing evidence would force a package or runtime claim that the system cannot yet prove
- issue state and artifact reality no longer match
