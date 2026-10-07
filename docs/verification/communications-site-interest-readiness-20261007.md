# Site interest before evaluation access

Owner request: October 7, 2026, 12:41 UTC. This change supports partner task
intake and durable follow-up while evaluation capability is request-specific.
It does not claim a match, pilot booking, hardware supply or operational launch.

Fresh site communication jobs retain readiness evidence in their existing
checkpoint and draft envelope. Reply generation receives short, description-first
scoping guidance for operational improvement, learning pilots and preparation
for later. The exact thread remains untrusted evidence. Task, desired outcome,
pilot purpose, constraints and timing have evidence-backed CRM review fields.
Missing details remain unresolved; video is optional. Existing charged
checkpoints and saved agent definitions are unchanged.

Readiness comes from the existing live Pipeline launch profile catalog when no
explicit capability publication exists. Only an exact scene/task match with
`partner_run_pending_physical_join` and live execution admission establishes
bounded evaluation access. Profiles are alternative recipes. Development and
internal diagnostic profiles, static environment profiles, unmatched tasks and
unreadable catalogs remain unknown. Live catalog retrieval is a read-only GET;
it does not launch evaluation or spend. Its observation time is distinct from
original evidence dates. The profile digest is retained and retrieval times
do not change the capability binding. A frozen observation is valid for at
most one hour, and Gmail-copy/send guards read current readiness again.

Optional compound capability evidence uses
`blueprintCommunications/default/evaluationReadiness/current`, schema
`blueprint.evaluation-readiness-publication.v1`. It lists required capability
IDs, canonical owner-system Firestore document paths and whole-record SHA-256
digests. Each owner record contains `communicationsReadiness`, schema
`blueprint.capability-readiness-evidence.v1`: capability ID, availability,
owning system, `owner_system` proof basis, `operational` claim ceiling, original
checked/expiry dates and global or exact site/task scope. Every required
capability must be current and available. Stale, mismatched or changed records
remain unknown. Communications/prospect/draft records cannot prove capability.
This change creates no production publication or readiness evidence. Atlas is
only a dependency if the owner evidence explicitly names it as required.

Canonical CRM records stay under
`outboundProspects/{prospectId}/replyFollowups/{handoffId}`. Intake creates one
portable pointer under
`blueprintCommunications/default/readinessFollowups/{handoffId}`. The existing
worker lap revisits pointers after opt-out intake, including when paid inference
is disabled. Reviewed interest waits for evidenced capability; unknown meaning
waits for review. Negative/no-need, opt-out and suppression close the action.
The first available transition creates the stable private owner action
`replyFollowups/{handoffId}/readinessActions/capability_available`. Replays and
unavailable/available oscillation retain that action; they create no new reply
job, model request, approval or email. New reply evidence requires reassessment.

Drafts use the existing canonical ledger and gated Gmail copy path. Promise
checks produce same-turn repair diagnostics and stop unsafe Gmail copies.
Recipient linkage, RFC/Gmail correlation, suppression, duplicate, lease,
feature-flag, copy direction and budget gates remain in place. Founder-origin
threads remain learning-only under their retained owner direction; their CRM
scoping/follow-up can improve without opening generation, copy or send authority.
No live send, paid test, credential, access or flag changes are part of this work.

Recovery/export: use existing authorized Firestore export to preserve the
follow-up, reviews, original `communicationsEvents` and readiness action plus
the communication job/checkpoint/envelope and referenced owner-system records.
These are company-controlled JSON records with stable Blueprint IDs. Digests
use `communicationsDigest` (canonical map-key ordering, SHA-256). Recompute
record digests, verify exact reply-event hashes and readiness source bindings,
then resume the existing worker cursor. Gmail IDs are delivery provenance;
the Firestore ledger and evidence records remain canonical.

Hermetic regression commands:

```bash
npx vitest run server/tests/communications-readiness.test.ts server/tests/communications-reply-intake.test.ts server/tests/communications-agent.test.ts server/tests/communications-gmail-draft.test.ts server/tests/communications-founder-sent-observer.test.ts server/tests/communications-api.test.ts server/tests/communications-send.test.ts server/tests/communications-draft-revision.test.ts
npm run check
npx tsx scripts/research-learning/check-portability.ts
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

Provider ports and readiness evidence are synthetic in tests. They prove code
behavior, including one unsent Gmail copy, rather than real evaluation access
or production effects. Merge and shared deploy belong to the parent/release
owner; PR completion alone is not end-to-end completion.
