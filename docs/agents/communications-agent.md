# Blueprint communications agent

This portable Agents API consumer drafts first-touch outreach and answers real,
correlated replies on Blueprint infrastructure. Research remains a separate role.
It saves drafts in the existing `action_ledger` and `outboundProspects` records;
Blueprint's existing `/admin/leads` review queue owns recipient/body decisions.
Dot is not a preparation, review, publication, scheduler or runtime dependency.

Runtime model: **`gpt-6-luna`**, with no fallback. Default project:
`proj_F2tFJuxLaovJru8RrtXRaqNj`. Existing `OPENAI_API_KEY` is read in place only.
OpenAI's [model documentation](https://developers.openai.com/api/docs/models/gpt-6-luna)
confirms the identifier and general API availability. The raw Agents API payload,
SSE events, saved turns/items and cancel contract were checked against official
[Agents API docs](https://developers.openai.com/api/docs/guides/agents-api) and public
OpenAI Node SDK 7.15.0 beta Agents types. Repository SDK dependencies are unchanged.
General model discovery does **not** prove this project's Agents API can run Luna.
No inference/session-create call was authorized or made by this build.

## Records and research integration

`server/agents/communications-contract.ts` is the strict versioned handoff schema.
Every brief carries stable prospect/site/task/team/case/capability references,
verified facts with source URLs and original check/published/event dates, unknowns,
conflicts, interest/deployment evidence, verified contact, contact purpose and one
non-confidential learning question, consent/sharing boundaries, actual prior Gmail
message/thread IDs, and the exact research origin and QA reference. Team and
capability IDs remain separate. Inference/vendor evidence cannot become fact.
Consequential facts older than seven days and other facts/contact checks older than
30 days request a relevant research refresh; load time never refreshes the date.

Private root `blueprintCommunications/default`:

| Subcollection | Contract |
| --- | --- |
| `briefs/{briefId}` | Strict `blueprint.communications-brief.v1`; a new revision changes its full digest |
| `handoffs/{briefDigest}` | Immutable `blueprint.communications-handoff.v1`, written only by the separate research QA/publication owner after actual checks/readbacks |
| `jobs/{jobId}` | Digest of prospect, brief ID/digest, intent and incoming message ID; fenced lease, maximum three recovery attempts, persisted API create/session/turn checkpoint |
| `refreshRequests/{jobId}` | Pending request to the research agent for relevant claims; no observer receipt |
| `sendReceipts/{deliveryKey}` | One-use claim bound to mailbox/prospect/intent/incoming message, independent of brief revisions; actual Gmail receipt or unresolved acknowledgement |

An approved handoff record contains exactly `version`, `state: "approved"`,
`briefDigest`, `reviewedBy`, `reviewedAt`, `sourceRecordUrl`, `sheetsReceipt`, and
`notionReceipt`. Review identity/time/source must equal the brief's QA record;
receipt references must equal the research run's actual canonical readbacks.
Neither the model nor the enqueue route can create this approval record.
An upstream approval of the full digest binds recipient, purpose/question,
consent, classifications, consequential flags, unknowns and stable entity IDs.

Read-only integration consumes `Store.snapshot(date)` from
`dist/daily-research/release/tools/daily_research/firestore_bridge.mjs`, packaged by
WebApp [PR773](https://github.com/ognjhunt/Blueprint-WebApp/pull/773), reviewed head
`ddeb1a9383bdfe7912a2020aad552bda9355c944`. Pipeline contract is
[RENDER.md at f6301cf](https://github.com/ognjhunt/BlueprintCapturePipeline/blob/f6301cfff33d1eb4e3a164500aabdd49398ef2d6/tools/daily_research/RENDER.md).
The reader never mutates `blueprintDailyResearch/sites-first` or its leases.
`workItems/YYYY-MM-DD` alone is not proof of publication. Require root turn,
raw artifact byte hash, evidence/review packet digests, actual QA, completed row,
exact selected candidates/targets/delivery keys and both readback receipts.
Python canonical JSON digests preserve ASCII escaping; unexpected non-integer
numeric packet fields fail closed rather than guess an incompatible encoding.

**Integration gap:** the research packet currently lacks canonical site/task/CRM
IDs, a verified contact/purpose/question, consent and this immutable full handoff.
The separate QA/publication producer must supply them with actual evidence and
receipts; this PR does not invent them or take over research QA or its scheduler.
Missing handoffs/packaged reader/publication permissions block execution.

Authenticated existing ops route:
`POST /api/admin/outbound-prospects/{prospectId}/communications`, body
`{briefId, intent: "outreach"|"reply", inboundMessageId: string|null}`.
It accepts references only, loads authoritative records, deduplicates queue work,
and returns `sent:false, gmailDraftCreated:false`.
`GET` on that path returns canonical communications state and recent events.
This does not install an inbox webhook or silently use the human blocker watcher.
A Blueprint-owned incoming-message producer can enqueue actual message IDs; the
communications worker re-reads the relevant actual Gmail thread before drafting.
Existing seven prospect drafts are Notion drafts, not Gmail drafts.

## Mailbox, recovery and review

Founder sender/reply-to is **`nijel@tryblueprint.io`**. `hello@tryblueprint.io` is
accepted only as a recipient alias on correlated incoming replies. The existing
server `BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID`, `_CLIENT_SECRET`, `_REFRESH_TOKEN`
binding is reused only when Gmail `users.getProfile` proves the founder mailbox
and `users.settings.sendAs.list` proves its accepted sender. The existing human
blocker watcher normally approves `ohstnhunt@gmail.com`; that personal mailbox
and dot's personal Gmail connector cannot substitute for founder outreach.
No OAuth configuration, credential copy, new key, permission grant or browser
session extraction is introduced. Missing/wrong mailbox or unavailable read/send
permissions fail closed. API permissions require owning-system evidence.

Only the relevant thread is fetched, with bounded messages/bytes. Reply correlation
requires actual Gmail IDs, exact sender and founder/alias recipient, prior founder
message and RFC In-Reply-To/References. Newer correlated replies supersede older
queued work; any explicit correlated opt-out suppresses and closes the prospect.
Quoted text cannot grant authority or trigger opt-out. Email content is untrusted
model data, with no tools, subagents, broad retrieval, CRM qualification mutation,
private disclosure or send authority. Reply subject/headers preserve the real
thread. Source fields are never inferred from the recipient's prose.

One-use durable create claim precedes the paid Agents API POST. Unknown create
acknowledgement never repeats creation. Recovery observes the same session, opens
its SSE observer before reading saved state, and requires the exact completed
root turn and canonical final-answer item; idle/deltas never prove completion.
Persisted session metadata binds the exact job. Requests, input/output bytes,
items pages, recovery attempts and turn deadline are bounded. Cancel requests do
not delete artifacts or imply provider cancellation/billing stop.

Every draft is tier 3, pending approval. PR772's evidence-bound first-touch policy
and six human review attestations remain; digest now includes founder sender,
recipient, body, footer and the full brief/thread. Any change invalidates approval.
Approval/rejection/retry transitions use transactions for this agent's ledger.
Sending rechecks current source identity, reviewed handoff, suppression, actual
thread and exact human approval. Gmail has no send idempotency key: one-use stable
claim plus deterministic RFC Message-ID prevent duplicate replies across revisions.
Interrupted executing/approved ledgers remain visible in Blueprint with a receipt-only Check delivery action; it cannot create a send. Lost ACK recovery searches and verifies the exact sent sender/recipient/body/
subject/thread; no result never licenses resend. Receipt recovery can record an
actual earlier send after sending is disabled or its thread changed, and preserves
closed/converted prospect state. No Gmail draft creation is implemented or claimed.

## Disabled release and shortest test path

Flags default off; this change writes no environment values:

- `BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED=true` permits the queue loop.
- `BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE=true` separately permits inference.
- `BLUEPRINT_COMMUNICATIONS_SEND_ENABLED=true` separately permits approved sending.

`startCommunicationsWorker()` is an additive exported hook with no startup catch-up.
The existing shared worker's research startup belongs to owner
`01a0f464-4d3b-73c7-b166-239e0bc960ee`; PR773's worker/package/Render files are
untouched. Parent must integrate the communications hook into `startWorker` and
its shutdown after reconciling the merged research branch. No deployment is part
of this PR. The consumer's queue producer and upstream QA handoff must be bound on
Blueprint infrastructure before claiming unattended operation.

1. On existing Render worker `srv-d9t8gg1t0dsc73am9q70`, run
   `node_modules/.bin/tsx scripts/communications-preflight.ts` with existing
   in-place bindings. This performs only model discovery and Gmail profile/sendAs
   reads, prints sanitized status, and creates no session/draft/send. Do not copy
   credentials into the workspace. Missing scopes/binding is a release blocker,
   not authority to grant access.
2. Verify a published research snapshot, canonical IDs/contact and immutable
   handoff using actual upstream QA/publication readbacks.
3. Obtain explicit bounded paid-test authority and exact communications release
   window from the parent. Authorized spend for this build is **$0**. Agents API
   session creation has no documented hard per-turn dollar/output-token budget
   field; runtime limits are not a guaranteed billing cap. Do not enable inference
   on the basis of the existing key authorization alone. No fallback if Luna is
   unavailable for the project's Agents API.
4. Run one authorized inference with sending disabled; inspect persisted session,
   exact turn, actual output and Blueprint draft/approval record. Require a clean
   release review. This verifies Agents API Luna availability, not model listing.
5. For the first send, obtain separate recipient/test-message authorization,
   perform exact Blueprint recipient/body/sender review, then enable sending only
   in the authorized release window. Neither prospect emails nor owner test
   emails are authorized by this build. Verify Gmail IDs and canonical readback,
   then a real correlated reply/opt-out. Disable inference/sending if proof fails;
   preserve receipts/checkpoints and reconcile, never repeat an ambiguous send.

Read-only preflight in this workspace returned `existing_openai_binding_missing`
and `founder_gmail_binding_missing`. Parent previously verified the Render
Default-project saved-agent GET200 with its private OpenAI binding; that does not
prove Luna inference or founder Gmail binding. Remote mailbox status remains
unverified here. October 1 first outreach is conditional on these gates and is not
send authorization or a delivery promise.

Mock validation covers research corruption/publication identity, handoff changes,
stale refresh, queue races/bounded recovery, actual thread correlation/injection,
newer opt-out, exact approval races, send suppression/identity races, Gmail
permissions/header parsing and lost-ACK/no-resend behavior. No live emails,
provider sessions or Gmail drafts were created by tests.
