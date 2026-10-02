# Communications and shared-learning repair checkpoint

Scope: owner-requested audit items 2 and 3, supporting ADP partner intake,
authorization and evidence review. Day gate: pre-outreach review; the current
direction is draft-only. Observed blockers are the inline agent configuration
drift, the unconnected private research-worker learning bridge, and incomplete
live feedback-loop proof. Completion artifacts are the company-owned source,
regression tests and the exact deployed checkpoint below. This document grants
no spending, scheduling, access or sending authority.

## Observed release and preserved state

The parent audit checked WebApp main and the ready Render worker at
`c9fd4b08882926c8cdf213822abce91cbfe5c4e1` (PR807). The worker's daily-research,
communications-worker and communications-send flags were false. They remain
unchanged by these repairs. The Tony Torrez draft stays preserved: no send,
regeneration or approval was performed.

PR800 and PR803 are merged. PR799 was open and green at its reviewed
`ef7cad3ecef35dffd3b0875112ab84715ed5f32a` head; green checks did not prove that
its stale scheduler/configuration/writer duplication was safe to merge. This
repair reuses the canonical native implementation instead. Pipeline PR2529's
safe bridge reconciliation and the vendor-package pin are separately owned;
this WebApp change does not edit the tarball or installer.

Using the existing worker credential, the parent observed a successful
metadata-only GET of the saved communications agent in the Default project.
It returned Luna, max reasoning, low verbosity, zero tools, disabled
multi-agent and auto tier. Its instructions SHA-256 was
`85bcc95f3f8d02fd680de41dbb00c5e4fb84aec7d68f3de3132f6ae57444f5d7`.
The real response includes nullable summary/format/concurrency metadata;
the regression fixture retains that shape without instruction or secret text.
That observation proves the saved definition exists and matches. It does not
prove a new paid session used it.

A fresh metadata-only Firestore read found the daily root's learning control
absent. The retained source snapshot passed the current strict hash verifier:
11 CRM rows, four capability records and 32 facts, with all 11 native
prospect/site/task/case joins null. The source-only control manifest is prepared
under the existing authorized logical scope; its application does not resume
the worker. It admits zero native prospects and keeps denominators unknown.

## Scoped repairs

New communications sessions first verify the company-owned v4 instructions
and the saved provider configuration. They create with the exact `agent_id`
and omit inline overrides, then retain configuration/instruction/request
digests in session metadata. Drift stops before paid-draft reservation or
session creation. Saved legacy sessions continue with their original
checkpoint and inline configuration; recovery never recreates them.

The existing lossless parser already retains raw output and recovers fenced
JSON, extended metadata and long saved outputs. The existing send path already
reconciles an unknown acknowledgement against exact message/thread/body
evidence. Those paths remain covered by regression tests. The read-only
preflight now accepts Gmail's primary sender identity without requiring the
alias-only `verificationStatus: accepted` field.

Correlated reply observations are now create-only, content-hashed receipts.
They retain original observation time, normalized observation time and receipt
time, plus the exact job/brief/prospect identity and `untrusted: true`. Replay
preserves the original bytes; a changed message is rejected. Learning uses the
actual observation check date for new receipts. Deterministic opt-outs retain
their own label; interest, motive and objections remain unknown unless a
trusted human supplies them. An opt-out is not a demand or robotics-fit result.

The actual private Python worker loads
`dist/research-learning/research-worker-host.js` through `learningHostModule`.
Its only learning operation is `learning_context(day, allow_create)`; the mode
must be an explicit boolean. Only a new request may aggregate and prepare a
new native input. Recovery with false can observe an existing frozen input;
it cannot create a manifest, snapshot or history session.

The host consumes the existing trusted
`blueprintDailyResearch/sites-first.learning` control. It validates canonical
principal, source snapshot, business subjects, focus, maturity and existing
CRM/prospect/capability scopes, and honors the earliest existing expiry. It
does not infer native joins from BP IDs, authorize missing data, renew a grant
or enable absent/disabled learning. Unsupported capability-detail selections
require reconciliation rather than silent expansion.

There is one TypeScript 06:45 America/Chicago scheduler and one canonical
terminal writer. New daily manifests use that exact scheduled cutoff even
after a late restart. Existing immutable manifests keep their original cutoff.
Relevant business, research, outcome and site history is captured through every
authorized cursor page, with repeated-cursor detection. It has no 20-page or
500-record success ceiling. A Firestore-size overflow names export or scope
partitioning as the repair; it never silently truncates history.

The private input carries every selected CRM/prospect in the already granted
scope, including the eleventh CRM row, and all separately authorized
capability-detail pages. Public facts retain original grades, limits, sources
and check dates; loading them does not refresh them. Both Python and the host
enforce the same 600,000-byte serialized input boundary. Replay rechecks the
detail/history scope before returning those earlier bytes.

The host returns a stable UTF-8 `content_json`, its raw-byte SHA-256
`inputHash`, and the normalized control `bindingHash`. The JSON contains the
native input reference/hash, handoff, complete available history, original
capture time and explicit unknowns, with `paidAnalysisCalls: 0` and
`sendsAuthorized: false`. The paired Pipeline bridge freezes those exact bytes
before prompt/provider creation and mounts them at
`/workspace/inputs/blueprint-research-learning.json`. Terminal status callbacks
carry only day/state; `afterNativeWork` reads durable native evidence and uses
`BP-RUN-` plus the digest of `{recordRef, sourceHash}`. Python owns neither a
second 06:45 timer nor a second terminal writer.

## Canonical artifacts and recovery

Code/instructions stay in the company GitHub repository. Firestore owns
`blueprintResearchLearning/default/sourceSnapshots`, append-only learning and
business/site events, `nativeLearningJobs`, and immutable content-addressed
`nativeLearningInputs`. Native research rows retain the input bytes/hash in
their original create payload; communications jobs retain their frozen input
reference/hash. Provider agent/session IDs are optional provenance, not the
only recoverable business artifact. Existing standard-format company-storage
exports and their manifests remain the portable export route described in
`docs/architecture/research-outreach-learning-layer.md`.

A replacement agent reads the exact Git commit, verifies the Firestore
content hashes and existing authorized scope, then replays a saved native
input or reads the standard-format export with its manifest. It never assigns
legacy null site/task/case/prospect joins, rebuilds a saved prompt using current
history or assumes a provider session proves durable business state. Sheets
and Notion remain review projections; their live readback receipts are separate
from canonical persistence and agent consumption.

## Read-only deployed checkpoint

After the paired WebApp/Pipeline release is deployed, use the existing worker
environment. This command performs GETs and local schema checks only; it
prints no credentials, message text, instruction text, control IDs or learning
content. Do not change flags to run it.

```sh
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { CommunicationsAgentsAPI } from './dist/agents/communications-api.js';
import { boundResearchLearningHooks, researchLearningHost } from './dist/research-learning/research-worker-host.js';
const flags = Object.fromEntries(['BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED',
  'BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED', 'BLUEPRINT_COMMUNICATIONS_SEND_ENABLED']
  .map(key => [key, process.env[key] === 'true']));
try {
  const verified = await new CommunicationsAgentsAPI({ apiKey: process.env.OPENAI_API_KEY,
    allowPaidInference: false, requestTimeoutMs: 15000 }).preflight();
  console.log(JSON.stringify({ readOnly: true, flags, savedAgent: verified,
    newPaidCalls: 0, sendsAuthorized: false }));
} catch { console.log(JSON.stringify({ readOnly: true, flags,
  savedAgent: 'metadata_unverified', newPaidCalls: 0, sendsAuthorized: false })); }
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ?? (process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8') : null);
const db = getFirestore(initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() }));
try {
  const control = (await db.doc('blueprintDailyResearch/sites-first').get()).data()?.learning;
  if (control?.enabled !== true) console.log(JSON.stringify({ readOnly: true,
    learning: 'absent_or_disabled', schedulerActivated: false }));
  else {
    boundResearchLearningHooks(db, control); // schema/expiry check; no aggregation
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
    const prior = await researchLearningHost(db)({ op: 'learning_context', day, allow_create: false }, control);
    console.log(JSON.stringify({ readOnly: true, learning: 'existing_control_valid',
      context: 'content_json' in prior ? 'existing_frozen_input_verified' : prior.state,
      inputHash: prior.inputHash ?? null, bindingHash: prior.bindingHash ?? null,
      newPaidCalls: 0, sendsAuthorized: false, schedulerActivated: false }));
  }
} catch { console.log(JSON.stringify({ readOnly: true,
  learning: 'existing_control_or_input_requires_reconciliation', schedulerActivated: false })); }
finally { await db.terminate(); }
NODE
```

Metadata verification is followed by a separately authorized new-run trace:
exact release identities, native input hash, mounted-file hash, original
provider-create payload, terminal evidence identity and canonical/export
readback. The worker flags being false means that trace is not yet observed.

## Remaining concrete gates

Gmail Drafts are not implemented or authorized by the current readonly+send
OAuth binding. The minimum access packet is an incremental grant of
`https://www.googleapis.com/auth/gmail.compose` to the existing approved
founder mailbox/client. Google's compose scope allows draft management and
sending; send capability already exists, but the current no-send direction
continues. No `gmail.modify`, mailbox-wide `mail.google.com`, new client or new
identity is requested. References: [Google's Gmail scope table](https://developers.google.com/workspace/gmail/api/auth/scopes).

Before any consent/apply, the concrete implementation must show a versioned
draft-to-canonical-job mapping, exact body/recipient hashes, idempotent create
and update with unknown-ACK reconciliation, and readback of the edited draft.
Draft creation must not call `drafts.send`, mark a job approved or infer send
authority from a Gmail edit. The existing canonical edit/review path remains
usable while that packet awaits the owner's explicit access decision.

There is no automatic inbox watcher in the current communications runtime.
Authenticated manual reply enqueue and exact thread/message correlation exist;
that proves ingestion of a selected reply, not background inbox coverage.
An unsent first-contact draft has no accepted-send/thread evidence to correlate
against. Live deduplication, suppression and reply-history closeout require an
actually observed authorized reply; no reply or label was invented here.

The existing site/business event and correction contracts, planner, consumer
and export routes have offline coverage. A complete current production-shaped
feedback chain—research, contact, draft/edit/review, accepted send, correlated
reply, human learning feedback, business decision, terminal result, next-plan
change and Notion/Sheets/export readback—is still unobserved. Missing site
decision-owner, reason/motive, uncertainty, scope, budget and outcome remain
unknown; no synthetic fixture is represented as live proof.

The concrete fictional fixture, isolated storage destinations, zero-call
expected choice and approval scope are in
`docs/agents/research-learning-validation-fixture-plan-2026-10-02.md`. That
fixture has not been approved or applied.

## Validation

Focused regression suites cover saved-definition drift and real GET metadata,
immutable reply receipts, long/extended output recovery, unknown send ACK,
scope denial, legacy recovery, Chicago/DST/cutoff behavior and complete history
beyond 500 business decisions. Full TypeScript checking, local host bundling
and the production portability audit are required before release. The required
graphify refresh uses the existing isolated graphifyy interpreter and publishes
the canonical root graph outputs; it introduces no package installation.
