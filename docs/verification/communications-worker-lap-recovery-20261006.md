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

The installed `server/agents/communications-release-lease.ts` is unchanged by
the launch framing candidate. `claimCommunicationsWorkerLap` reads the research
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

The loop's `finally` awaits renewal and calls the owned `release()`. Release
failure retains the active record and logs `Communications lap drainage awaits
its durable receipt`. The local handle is then lost; a later tick cannot settle
that orphan. A killed process can likewise leave active evidence. These are
possible causes, not a diagnosed cause for the current live record.

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

## Minimal prospective repair scope

For transient final-release failures, retain and retry the original drained lap
handle before allowing another tick. A retry must preserve owner/generation,
admit no stages, and leave evidence unchanged when its transaction cannot prove
ownership. This can prevent a new orphan but cannot repair today's unknown lap.

For a proven ended orphan, a separate narrowly reviewed reconciliation would
need expected raw-record hash/update time, exact owner/generation, trusted
process-ended and effect-reconciliation evidence, actor/audit record and atomic
compare-and-set. A supplied string saying "process ended" is not proof. Current
live evidence is insufficient to define or execute that recovery safely. No
lap lifecycle repair, live mutation, paid call or activation is bundled into the
framing candidate.
