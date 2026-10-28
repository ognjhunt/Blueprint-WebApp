# Customer closeout of stopped task preparation

This extends the existing signed capture-link and authenticated workspace status
projection. It serves beta journey L3/L6 and rehearses ADP-009D's day-28 typed
abstention/delivery seam. The office floor-to-table case remains development-only;
it completes neither the sealed public-scene gate nor physical trials.

## Owner closure of a capture run

An owner may close a run as a conservative abstention through the existing signed
owner link: `POST /api/site-task-brief/:token/run-closure` with
`{"decision":"conservative_abstention","confirmed":true}`. It requires the
owner-scoped credential and the normal CSRF cookie/header. A film-only credential
cannot close the run or read the owner's closure evidence.

The transaction retains a digest-bound `website_run_closure.v1` receipt under
the capture ID in the existing inbound request. It verifies the uploaded source
identity and is idempotent; a changed source or malformed receipt refuses. It
preserves the raw recording, recording consent, task facts, commercial state,
existing reservations and billing records. It is not numeric task acceptance,
a robot verdict, or physical proof.

Current task-context reads return the typed 409 `website_run_closed_by_owner`.
The existing Atlas worker treats that refusal as terminal and runs its normal
provider cleanup. New preparation reservations (including reuse of a retained
admission) and coverage/assessment model calls are refused transactionally.
Settlement of already admitted calls remains possible. The owner and account
status views show the closure before unconfirmed-brief or older progress states;
withdrawn recording rights continue to take precedence. No automatic renewal or
ordinary task edit removes the closure. Resumption requires a new explicit
owner instruction and a separately authorized operation.

Observed blocker: the floor-to-table run had been resumed by another work lane
after the earlier abstention and was again processing at the mesh stage when
the owner chose to close it. Existing controls exposed retry or recording
withdrawal, not a run-specific stop that retained the recording. This is the
minimal beta results/ADP-040 day-28 owner-abstention control; no Pipeline deploy,
new provider purchase, policy run or general infrastructure is introduced.

| Finding | Customer outcome | Evidence and next action |
| --- | --- | --- |
| Retained robot carry check rejected the checked configuration | `robot_incompatibility`, explicitly `conservative_configuration_check` | Source/context-bound preparation, collision/runtime and verdict digests; Blueprint reviews scale, grasp and checked stations before another configuration. This is not exhaustive impossibility proof. |
| Named source coverage, geometry or task evidence is insufficient | `insufficient_evidence` | Current capture-specific finding; Blueprint identifies the exact missing fact/view/measurement before asking the site for anything. |
| Reconstruction or preparation stopped internally | `processing_failure` | Current retained failure receipt; Blueprint resolves/reconciles it before an authorized retry. The site's video stays saved and it is not asked to reupload or confirm the brief to fix our error. |

The status reader requests `website_preparation_status.v3`. Older Pipeline
releases continue returning v1/v2; all three schemas remain strict and readable.
V3's optional-in-meaning, required-nullable `outcome` is hash-bound with the rest
of the receipt. It is accepted only in a stopped state. A new receipt cannot
smuggle in a verified constraint, physical validation or an arbitrary message.
The Pipeline alone binds the retained report chain. The WebApp alone maps its
allowlisted codes to customer copy; private paths/provider errors are excluded.

The existing capture-specific, digest-verified Atlas preview receipt also feeds
this projection. It needs no job mutation or rerun to close out a saved failure.
The exact `atlas_scene_planner_requires_reconciliation` receipt from the fresh
office run is retained as a regression fixture; it yields a processing failure,
never a robot verdict. Coverage abstention is insufficient evidence. Unknown
provider/authorization refusals stay Blueprint's operational issue.

Withdrawal overrides derived findings. Later native handoff/scene progress and
actual evaluation runs supersede an older optional preview stop. A newer preview
revision clears its old failure. Film-only links do not receive the evidence
outcome; owner links and the account owner's workspace agree. Status polling is
read-only for these outcomes and cannot allocate, retry, confirm acceptance,
resume authority, select a robot or send a notification.

On the signed owner page, the current preparation outcome also controls the
shared job workspace's next action. A Blueprint-owned stop retains the draft
brief for inspection and suppresses the default confirmation form, generic
footage-review copy, and processing-retry prompt. It does not mark the brief
accepted or change commercial milestones. An editing form the owner already
opened keeps its draft. If a later poll is unreadable, current evidence claims
are hidden and the page does not revert to asking the site to repair Blueprint's
stop. A fresh successful response clears that hold when preparation recovers.

Verification includes source/rights isolation and malformed-evidence negatives,
v1/v2/v3 negotiation, both real route handlers, the saved production receipt,
and desktop/mobile rendering through the existing workspace browser harness.

## Source-bound task details on the existing brief

`BLUEPRINT_WEBSITE_FAMILY_TASK_FACTS_V4_ENABLED` defaults off. When enabled, the
existing status reader requests v4, whose nullable `family_authoring` contains
the bounded `website_family_authoring_status.v1` projection. The signed status
receipt and its ordinary source/rights verification still precede persistence.
No raw report paths or provider errors enter the projection. Older Pipeline
versions may answer v1/v2/v3; they produce no family question.

The owner brief presents one current task question: a captured target, the
required duration of an outcome, or clarification of the job description. It
does not ask the site to write simulator JSON, measurement geometry, material
parameters or force limits. Unknown remains unknown and is recorded without
repeating the same source-bound question on every preparation generation.
Previously stated targets and durations can be corrected through the same
confirmation route. Film-only credentials receive neither this question nor
the owner's recorded details.

The confirmation transaction binds facts to the current capture, retained
source fingerprint, operation/target IDs, description and success criteria. It
refuses changed source generations, stale questions and ended processing
permission. Each accepted fact version is retained under the existing brief;
corrections change the current projection without overwriting prior versions.
The inner facts and outer task context explicitly select RFC 8785 hashing;
unflagged legacy contexts keep their existing bytes and digest algorithm.

Rollout requires the paired Pipeline v4 producer/context readers and the
existing funding continuation to support the changed context before enabling
this flag. A fact correction does not create a grant, reset consumed funds or
uncertain reservations, extend expiry or increase limits. The status/facts
integration alone does not establish simulator execution, measurement fidelity
or production acceptance.
