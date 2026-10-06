# Launch outreach and durable reply handoff

This cloud implementation supersedes the paused, unpublished local implementation
planned as `codex/outreach-framing-web-20261006`. That branch was absent from the
published repository on October 6. No existing branch was overwritten or force
pushed. Original draft PR #876 starts from reviewed PR #872, commit
`c986f040c704c551df434cd45240aa1ba1c8465a`. The launch candidate is instead
`codex/outreach-launch-main-20261006`, based on live main
`a5da2cbe38e764ab092b2e2e4f48fb39507c6ae3`, preserving PR #875's How It Works
illustrations and browser proof. It reuses PR #872's Web phase2 hypothesis,
contact and screen consumers without adopting its research archive, installed
runtime, startup collector or deployment workflow. Those Pipeline/native
publication changes remain with their release owner. The selected phase2 code
is commit `832ce03ea`; its large tier-equality fixture is existing reviewed
source, not a new test harness. Old runtime publications without a screen
snapshot remain inadmissible for that separate cohort. No source is promoted
just because this Web code can read it.

PR #873 and its main-based intake equivalent #874 have no file overlap with this
candidate and are not included or edited. This owner handles independent review,
required CI and release verification; the parent coordinates normal merge/deploy
clearance, activation, recipient scope and any actual Gmail copy. The current
[communications lap recovery prerequisite](verification/communications-worker-lap-recovery-20261006.md)
blocks safe release until its live evidence is resolved.

The [first-touch policy](outreach-first-touch-policy.md) records the owner-approved
launch direction. `communications-launch-framing.ts` is its versioned executable
writing definition, consumed by the existing worker and saved-agent configuration
flow. It does not replace Pipeline research truth or its immutable qualification
questions. The provider saved agent and existing session definitions stay exact;
new hypothesis overrides use v13-v16, while v9-v12 still replay unchanged.
The small `communications-api.ts` caller changes select and verify that prospective
configuration; they add no tools, providers, credentials, spending or runtime lane.

## Runtime path

`communications-worker.ts` freezes `framingVersion` before a fresh draft, then
`buildCommunicationsInput` includes the framing version, guidance digest, role and
question. New hypothesis output uses `blueprint.outreach.v3`, with an interest
question that leaves every original research open check unresolved. The ordinary
reviewed-lead contract remains v1. The role is optional authenticated research
context, included in the immutable brief; historical briefs default to site.
Source, recipient, qualification and contact checks still run. This change does
not add a robot-team discovery source or promote a source that fails its existing
admission contract.

Launch-framed drafts enter the existing human review ledger, never automatic first
contact. The existing exact-revision founder Gmail-copy path remains separately
gated by retained owner direction, verified compose capability, suppression,
duplicate-contact checks, revision and message readback. Founder-origin replies
remain `learning_only` at every inference, revision, copy, approval and send gate.
Neither the handoff nor its review can release a founder reply into drafting.

`communications-gmail.ts` reads correlated message evidence. Reply intake binds
the original sent receipt or owner-gated founder-send observation, retains each
original message under
`outboundProspects/<prospectId>/communicationsEvents/reply_<messageId>`, and
atomically creates an owner-review handoff under
`outboundProspects/<prospectId>/replyFollowups/<handoffId>`.

The Blueprint-owned handoff ID hashes prospect ID, original brief digest and
thread ID. Its evidence digest hashes its immutable context and sorted message
references, including original IDs, timestamps and message hashes. The handoff
retains the original site/task hypothesis and consent boundary separately from
the operator-recorded task meaning. Owner defaults to the founder mailbox;
stated task, desired outcome and timing start at `null`, meaning starts at
`unknown`, and the next action is internal reply review. The authority object
always denies spending, listing, recording, sharing and sending.

The existing reply-intake worker also persists free preparation as
`blueprint.reply-preparation.v1`: exact evidence and review-revision bindings,
an owner task and a conditional single-question draft. Unreviewed fields are
labelled `not_interpreted`, so the system does not pretend the recipient omitted
information that may already be in the message. The conditional proposal requires
review of continuation and the unanswered question before use. This consumer runs
with paid processing off and never opens a model session, Gmail draft or ledger.

Exact replay preserves an operator's review. New evidence reopens review without
silently carrying earlier meaning forward; earlier attestations remain in the
`reviews` subcollection and the latest reviewed task/outcome/timing stays visible
as `priorReviewedContext`, explicitly historical and requiring reassessment.
The current preparation is rebound to the new evidence. Durable suppression precedes opt-out admission. A late
opt-out closes the handoff and prevents reopening it through the review endpoint.
A missing canonical founder prospect produces a visible context-repair flag and
retains the original bound context; it never invents a replacement prospect.

## Owner review and continuation

The existing authenticated admin/ops surface exposes handoffs through:

- `GET /api/admin/outbound-prospects/:prospectId/communications`
- `GET /api/admin/outbound-prospects/:prospectId/communications/followups`
- `POST /api/admin/outbound-prospects/:prospectId/communications/followups/:handoffId/review`

The dedicated GET also works when the canonical prospect is missing. The POST
requires the current `expectedEvidenceDigest`, an authenticated actor and exact
message ID/quote references for any nonunknown meaning, stated task, desired
outcome or timing. Meaning can be exploratory interest, no need, negative or an
explicit commitment; none changes action authority. No need and negative meaning
require `nextAction:"no_action"`. The remaining actions are internal review,
context clarification or preparing a draft for separate review. A repeated
identical operator review is idempotent; changed evidence yields a conflict.

Authenticated evidence review automatically refreshes preparation: exploratory or
explicit interest gets one role-appropriate question for the next unresolved
task, desired outcome or timing field. Fully recorded details yield a bounded
owner handoff. No need, negative meaning and opt-out yield no draft proposal;
missing canonical context yields an internal repair task. The ordinary system
reply writer also receives this persisted preparation. Founder reply jobs stay
terminal `learning_only`; the private proposal never becomes a mailbox copy or
send command. Meaning interpretation remains attributed owner work; automatic
semantic extraction is not implemented or claimed.

No mail or paid model call occurs in that route. The ordinary system-origin reply
worker consumes the frozen handoff as untrusted evidence. An owner-reviewed
`no_action` stops before inference and is checked again before saving a draft if
owner review arrives during inference. The existing authorized company-history tools
also expose `reply_followup` records within their prospect scope, preserving the
same evidence/authority boundary. A reviewer must inspect the original message
events and audit revision when assessing recorded meaning; quotations establish
provenance, not semantic correctness.

## Storage and recovery

All canonical records are private Firestore documents in the existing company
database. Export/recover through the existing authorized Admin SDK path as JSON:
the handoff, its `reviews` subcollection, referenced `communicationsEvents`, and
the original `blueprintCommunications/default/briefs`, `replyBindings` and
sent-observation/receipt lineage. Verify each message hash and the handoff evidence
digest before using the record. No model session, Library ID or generated summary
is required as the only business artifact. The schema is
`blueprint.reply-followup.v1`; unknown values remain `null` or `unknown`.

## Validation and release boundary

Synthetic/offline tests exercise actual worker inputs and ledger persistence,
saved-session configuration/request/readback, and exact-revision Gmail-copy
create/readback/replay using mocked provider ports. Coverage includes all four
roles, closed-source/early-stage context, exploratory future interest, no need,
negative meaning, unsupported readiness/hardware claims, missing context, stale
review evidence, replay, late opt-out and existing paid/flag brakes.

Independent review of `743eb689` found the missing preparation consumer,
historical-context visibility and malformed-sibling isolation. Those findings
are addressed by real intake/review persistence and scoped-history regressions.
The Graphify dependency was resolved using the repository-documented isolated
`graphifyy==0.9.73` environment and deterministic AST runner; no model tokens or
runtime dependency were introduced. Canonical derived outputs are in ignored
`graphify-out/`.

No real Gmail drafts, messages, model calls, deployment, access changes or
activation were performed. The release owner must obtain independent review,
required CI, normal merge/deployment and deployed-version readback, then verify the
exact authorized contact/budget scope before any real draft copy. Local runtime
tests prove consumer behavior; they do not prove production activation.
