# Autonomous Loop Evidence Checklist

Date: 2026-05-03
Status: Active shared closeout checklist
Control-plane owner: `Blueprint-WebApp`

## Purpose

This checklist prevents false completion in Blueprint autonomous loops.

It applies to `Blueprint-WebApp`, `BlueprintCapture`, `BlueprintCapturePipeline`, and Paperclip-owned issue loops whenever an agent marks work `done`, `blocked`, or `awaiting_human_decision`.

The operating graph vocabulary remains defined in [Autonomous Org Cross-Repo Operating Graph Contract](./autonomous-org-cross-repo-operating-graph-2026-04-20.md). This checklist defines the minimum evidence that must be present before a loop can claim one of those states.

## Universal Closeout Fields

Every closeout comment, report, manifest, or issue update must include:

1. Objective: the issue or run objective in one sentence.
2. Stage reached: the lifecycle stage or repo-local phase actually reached.
3. State claimed: exactly one of `done`, `blocked`, or `awaiting_human_decision` for the branch being closed.
4. Durable evidence: exact file paths, ledger keys, issue ids, run ids, hosted-session ids, package ids, capture ids, or artifact URIs that prove the claim.
5. Verification: commands, checks, or manual inspections run, with observed result.
6. Coverage: explicit mapping from each acceptance criterion or evidence requirement to the evidence above.
7. Next action: owner, target repo or lane, and retry/resume condition.
8. Residual risk: what remains unverified or outside the current lane.

Adapter success, a green status badge, a passing test suite, or a closed issue is not enough by itself. It only counts when it is tied to the objective and evidence requirements.

## `done`

Use `done` only when all are true:

- The intended durable output exists.
- Each explicit acceptance criterion, numbered requirement, named file, command, test, gate, or deliverable maps to concrete evidence.
- Verification covered the behavior being claimed, not only adjacent plumbing.
- Any downstream projection needed by the operating graph has been written or the closeout names why no projection is required.
- No immediate next action is silently dropped; follow-up work is either unnecessary or linked as a separate issue.

Required `done` proof:

```text
State: done
Objective:
Stage reached:
Durable outputs:
Verification:
Requirement coverage:
Operating graph or Paperclip update:
Remaining risk:
Next action:
```

## `blocked`

Use `blocked` only when the current branch cannot safely advance and there is no meaningful reversible work left for that branch.

Required `blocked` proof:

- Earliest hard stop, not a downstream symptom.
- Stage reached before the stop.
- Exact evidence path, command output, run id, manifest entry, or missing dependency proving the stop.
- Why the lane cannot continue with reversible work.
- Next required input, owner, and retry condition.
- Linked follow-up or escalation issue when another repo, provider, or executive lane owns the unblock.
- For sender verification, Gmail OAuth, first-send approval, or city-launch resume blockers: durable blocker id, exact env/account/approval input, safe proof command, retry/resume condition, and disallowed workaround. Do not summarize these as vague credential or approval blockers.

Required `blocked` proof format:

```text
State: blocked
Objective:
Stage reached:
Earliest hard stop:
Evidence:
Why no reversible work remains:
Next required input:
Owner:
Retry/resume condition:
Linked follow-up:
```

## `awaiting_human_decision`

Use `awaiting_human_decision` only for known next actions that are irreversible, policy-changing, legally sensitive, rights-sensitive, budget-sensitive, or otherwise reserved for human judgment.

A human-gated branch must not be marked `done` until the human reply is recorded and the owning lane resumes or closes from evidence.

Required `awaiting_human_decision` proof:

- Gate category from the operating-graph routing matrix.
- Exact decision requested, with one recommended option when possible.
- Evidence packet path or issue/comment id.
- Durable blocker id for reply correlation.
- Routing surface used: founder inbox, Slack DM, email, or repo-local no-send.
- Watcher/owner responsible for recording the reply and resuming execution.
- Resume condition and deadline when available.

Required `awaiting_human_decision` proof format:

```text
State: awaiting_human_decision
Objective:
Stage reached:
Gate category:
Decision requested:
Recommendation:
Evidence packet:
Blocker id:
Routing surface:
Watcher/owner:
Resume condition:
Deadline:
```

## Repo-Specific Evidence Anchors

`Blueprint-WebApp`:

- Paperclip issue id and proof-bearing comment.
- WebApp ledger, Firestore projection, hosted-session id, buyer outcome record, or operating graph event when relevant.
- Pipeline/WebApp sync closeout must name the real `site_submission_id`, `request_id`, `buyer_request_id`, and `capture_job_id` used for projection; missing request/job/bootstrap links are blockers, not placeholder records or hosted-review proof.
- Targeted command output such as `npm run check`, focused `vitest`, launch smoke, or the domain-specific script that covers the claim.

`BlueprintCapture`:

- Capture id, scene id, raw bundle path, upload ledger, or `capture_upload_complete.json`.
- Validation command or Xcode/cloud bridge test that covers the changed capture behavior.
- Explicit statement that generated, payout, provider, or readiness claims were not inferred from advisory UX.

`BlueprintCapturePipeline`:

- Package id, manifest path, qualification/privacy/retrieval/runtime artifact, WebApp sync record, or `.not-executed.json` blocker artifact.
- `pytest` or targeted launch gate output covering the pipeline behavior.
- Explicit distinction between implemented locally, artifact-only, contract-covered, and blocked by missing live services/secrets.

Paperclip:

- Issue id, run id, transcript/log reference, status mutation, and closeout comment.
- Goal evidence requirements mapped to concrete artifacts.
- `done` and `blocked` are the valid terminal issue states; use `awaiting_human_decision` as branch state in the comment or operating graph, not as a fake Paperclip terminal status unless the Paperclip schema explicitly supports it.

## Failure Modes This Blocks

- Treating issue status as stronger than latest run artifacts.
- Treating adapter success as proof that the issue is complete.
- Closing a run as `done` when a human decision packet was merely sent.
- Reporting a whole branch blocked when reversible work remains.
- Overstating generated outputs, readiness, buyer sends, rights, or capture provenance.
