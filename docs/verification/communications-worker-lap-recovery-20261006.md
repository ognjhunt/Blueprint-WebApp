# Communications worker lap recovery prerequisite

## Observed evidence and limits

The release parent reports deployed main
`a5da2cbe38e764ab092b2e2e4f48fb39507c6ae3`, new Render instance `spr6r`
starting at 2026-10-06 15:09:19 UTC, and
`communications_worker_lap_unsettled` / `Communications worker requires recovery`
each minute from 15:10:25 through 15:37:25 UTC. Research `workflow_idle` at
15:37:08 and instance-count metrics of one through 15:34 do not prove
communications drainage. These Render observations came from the parent.
A subsequent bounded, read-only transaction through the cloud's existing
Firebase SDK retained the lap and research control in a private local packet
with document update times and hashes. It confirmed an active, expired lap
without a completion receipt. The raw operational record stays outside public
commits; its process/effect correlation is still unproven. No live mutation or
credential/access change was performed.

## Installed lifecycle

The installed `server/agents/communications-release-lease.ts` reads the research
release control and `blueprintCommunications/default/intakeState/workerLap`
atomically. Any active lap, even expired, or an `uncertain` phase raises
`communications_worker_lap_unsettled`. A successful claim creates a unique owner
and generation. Renewal extends that same owner; only its retained handle can
settle the lap after all admitted stages and pending renewal have finished.

In `startCommunicationsQueueLoop`, this particular claim error occurs before
intake, founder observation, mailbox copying, automatic sends or model jobs.
Thus each reported failed tick admits none of those stages. It does not prove a
different process or previously admitted operation ended. Reply and opt-out
intake are also unavailable on those ticks; this is a launch blocker, not a
healthy idle state.

The installed loop's `finally` awaits renewal and calls the owned `release()`. Release
failure retains the active record and logs `Communications lap drainage awaits
its durable receipt`. The local handle is then lost; a later tick cannot settle
that orphan. A killed process can likewise leave active evidence. These are
possible causes, not a diagnosed cause for the current live record. Another
reproduced defect loses an unadmitted claim identity when its transaction
commits but its acknowledgement is lost. Neither defect is established as the
cause of generation 259. The record contains no process/instance binding. The
queue's first tick is sixty seconds after timer registration; the parent's
reported startup log at 15:09:25 cannot alone explain a claim at 15:09:45.
Ordinary early returns and throws execute `finally`; a stalled stage retains
the active tick and prevents later ticks in that same loop. Launch-only mode
does not bypass this communications lifecycle.

Worker SIGTERM/SIGINT stops further admission and awaits research plus the
communications tick. `Blueprint worker stopped` proves the promise returned,
but is insufficient alone: release errors are caught by the loop. The durable
lap must also show a matching completion receipt. Expiry, process count and a
successful new deployment cannot substitute for that receipt.

## Evidence required before recovery or release

Obtain a private, read-only snapshot with document update time and a hash of the
raw JSON, retaining schema, phase, lease owner/generation/until, startedAt,
renewedAt and completedAt. Read the current research-release control in the same
consistent inventory. Do not publish private operational records in a commit.

Correlate the lap's owner/generation to its actual process and admitted effects.
The current schema does not retain a host/instance ID and current warnings do
not log the owner; Render startup and shutdown timestamps alone cannot establish
that mapping. Preserve any existing trusted deployment/process receipts and
earlier renewal/release failure logs. Inventory scanner/job claims, existing
provider-session checkpoints, draft-copy writers, send reconciliation and
publication rows through their own existing evidence contracts. A stopped host
does not prove remote work ended or that an ambiguous write never happened.

If the original process still owns the retained handle, the supported route is
its ordinary awaited drainage and owner/generation `release()`, followed by
readback of `phase: complete`, the same owner/generation, `lease.until: 0` and a
valid completedAt. Read again under the normal bounded research-release lease
before deployment; preserve all other controls and historical rows.

If that handle/process ended without settlement, installed code has **no
supported operator orphan-lap reconciliation function, route or script**.
`reconcile-draft` recovers an existing model session and usage; Gmail writer
reconciliation addresses a distinct copy attempt. Neither settles this lap.
Do not clear/delete the document, invent its owner, reset flags or use TTL as
authority. The release remains blocked until an evidence-backed reconciliation
is reviewed and supported by the owner of the release protocol.

## Reviewed prospective repair

The candidate retains the exact claim attempt before awaiting its transaction.
An ambiguous acknowledgement returns a permanently non-admitting handle. This
also covers an SDK callback retry that encounters the same committed candidate
and newly held research-release control. Settlement requires the exact original
owner, generation and initial timestamps; missing readback or changed identity
preserves the handle and blocks fresh work. No absent document is created by
settlement. A canonical release race that aborts the candidate before commit
still admits no lap or effects.

The loop retains drained handles after final-release failures and retries their
settlement before any new claim or stage. A matching valid completion receipt
recovers a lost release acknowledgement without rewriting it. Stop awaits the
active stage and renewal, retries its pending settlement, and rejects when the
receipt remains unresolved. Successor generations stay protected. Existing
synthetic lease, worker-entrypoint and release-fence suites exercise these cases;
independent review accepted the repair. It cannot adopt today's generation 259.

## Shortest safe release and recovery sequence

The legacy unresolved draft-budget admission remains an accounting hold. It
must not be reset or counted as zero. It blocks new paid admissions according
to its existing policy, but does not independently prohibit deploying code to
an idle worker whose actual process admission is fenced. A deployment must not
be described as worker recovery merely because the old active lap continues
to reject every tick.

For a source-only idle deployment, the release owner first verifies actual
process admission settings and demonstrates that the target process has no
admitted local stage, renewal or settlement still in flight. It must not
terminate an unidentified process that may retain an owned lap handle. Disabled
admission or repeated failed ticks alone do not prove local drainage. Then use
normal exact-SHA green-CI deployment and readback while retaining the lap,
budget hold and all controls. A selected shell's environment is not process
proof. This lane neither activates outreach nor publishes native research
inputs through the separate publication fence.

For runtime recovery or native publication, first retain the expected lap
record/update time/hash, establish that every possible originating process has
ended or is durably fenced, and reconcile each admitted remote effect. Bound
session/turn GETs, unresolved refresh claims, draft/send receipts and the
cancelled research session's archive requirements must be evaluated under their
own contracts. An accounting uncertainty can remain a preserved hold when
separate execution evidence proves there is no active remote work.

For a proven ended orphan, a separate narrowly reviewed reconciliation would
need expected raw-record hash/update time, exact owner/generation, trusted
process-ended and effect-reconciliation evidence, actor/audit record and atomic
compare-and-set. A supplied string saying "process ended" is not proof. Current
live evidence is insufficient to execute that recovery safely. The repair can
be run from an exact reviewed checkout with the existing Admin SDK before a
deployment; it need not already be installed in the worker. Its versioned
operator evidence must bind trusted process/fence receipts and complete remote
effect readbacks, rather than accepting a string that asserts drainage. The
atomic operation would preserve owner/generation, write a matching completion
receipt and a private audit, reject changed evidence, and leave all other
controls/history/accounting untouched. This companion belongs to the existing
release-protocol owner. Installed code has no such orphan operation today.

The cancelled research row cannot use installed `cleanup_completed`: that
standing route requires a completed, QA-validated run, terminal publication and
verified delivery receipts. `record-cleanup` records already proven deletion;
it is not an archive/delete shortcut. The native owner's minimal companion is
a versioned stopped-session cleanup action bound to the exact Oct6 owner
direction, session and environment. It must reuse full export, immutable archive
and generation/digest readback, recheck all turns and child work terminal, claim
deletion idempotently, verify both resources absent, and retain cleanup/audit
receipts. No new session, provider spend, credential or access change is needed.
No live mutation, paid call or activation has been performed by this candidate.
