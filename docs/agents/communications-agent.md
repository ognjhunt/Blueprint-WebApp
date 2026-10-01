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
accepted only as a recipient alias on correlated incoming replies. Communications
uses only the distinct private server fields `BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID`,
`BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_SECRET`, and
`BLUEPRINT_COMMUNICATIONS_GMAIL_REFRESH_TOKEN`. There is no partial or complete
fallback to `BLUEPRINT_HUMAN_REPLY_GMAIL_*`. The existing human-blocker watcher,
approved `ohstnhunt@gmail.com` identity, query, scheduler and credentials remain
independent. That personal mailbox and dot's Gmail connector cannot substitute
for founder outreach. Gmail `users.getProfile` must prove the founder mailbox and
`users.settings.sendAs.list` its accepted sender before any thread read or send.
No OAuth configuration, credential copy, new client/key, grant or browser-session
extraction occurs in this build. Missing/wrong mailbox or unavailable read/send
permissions fail closed. API permissions require owning-system evidence.

### Owner connection preparation

In `/admin/leads` → Approvals → **Prepare founder mailbox**, authenticated ops
can read `GET /api/admin/outbound-prospects/communications/connection`. It reports
field presence only (`missing` or `configured_unverified`), never secret values or
verified mailbox access. It makes no Google request or database write, accepts no
credentials, and supplies no authorization URL or callback. No Gmail OAuth
callback or reconnect screen was previously documented in this repository;
Firebase sign-in and Blueprint Work OAuth are unrelated authorization paths.

The exact initial scope is `https://www.googleapis.com/auth/gmail.readonly`, which
permits whole-mailbox messages/settings access even though this runtime retrieves
only relevant full threads and exact sent receipts. It covers profile, accepted
sender lookup, full thread/message reads and receipt searches. If sending is later
authorized, add only `https://www.googleapis.com/auth/gmail.send`. Settings-write,
message-modify, draft-management and full-mail deletion scopes are unnecessary.
See Google's [sender lookup](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs/list),
[full threads](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/get)
and [send API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send).

The smallest owner action is to inspect the **existing** Google OAuth client's
registered redirect, audience and allowed scopes for `nijel@tryblueprint.io` in
Google Auth Platform. Return non-secret registration evidence only. The existing
client may be reused only after that compatibility is verified. No callback is
invented or registered here. A missing compatible owner-controlled callback is a
specific connection-preparation blocker; any callback implementation must be
reviewed against the actual registered URI before owner consent. Offline access,
state validation and server-side code exchange belong in that verified flow.

The logical binding is `communications-founder-gmail`, serving **both** Render
services `Blueprint-WebApp` (approval/send and receipt recovery) and
`blueprint-webapp-worker` (draft/reply context). Its current private server adapter
uses the three separate fields above. Final token storage/credential entry remains
blocked pending the shared vault owner's verified contract; no credential-entry
URL is invented. The separate research-integration owner owns that shared
MCP/vault preparation, and local UI inspection checks existing Platform consent
flows before custom OAuth plumbing. Tokens, authorization codes and client secrets
must never be entered in chat, ordinary frontend forms, repo files or logs.
No route in this release accepts them. Preserve all `BLUEPRINT_HUMAN_REPLY_*`
ops fields; reconnecting that separate watcher is outside this operation.

Google documents an official service-origin MCP server at
`https://gmailmcp.googleapis.com/mcp/v1` in its
[Gmail MCP guide](https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server).
It is Developer Preview, requiring program membership and Gmail/MCP service
enablement; actual project access and existing client/vault compatibility are
unverified. Minimum relevant read tools are `get_thread` and `search_threads`.
The listed draft tools are `create_draft` and `list_drafts`; the documented tool
list has no send tool. Its general setup requests read/compose scopes; do not
infer a narrower authenticated MCP grant has been established from REST scope
documentation. No APIs are enabled or compose grant requested here.

PR774 provides full bounded Gmail context through its deterministic server
adapter; the model's tools remain empty until the shared MCP owner supplies an
approved, mailbox-scoped read adapter and verified vault authorization. Any
future MCP draft tool remains separately gated and may only report a Gmail draft
after an actual verified receipt. No model-controlled MCP send may bypass the
exact recipient/body/sender checks in the existing deterministic approval path.

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

After the 180-second inference deadline, read the saved session/root turn/final
answer before requesting cancellation. A completed turn can still produce its
reviewable draft; unavailable saved state is bounded recovery, never a new POST
or evidence of cancellation. Shutdown closes admission, clears the timer and
awaits the current tick's checkpoint/draft writes before the entrypoint exits.

In Approvals → **Review blocked communications jobs**, an authenticated operator
can inspect up to 20 canonical blocked jobs and retry after repairing the
dependency. `POST /api/admin/outbound-prospects/{prospectId}/communications/{jobId}/retry`
accepts only `{briefDigest}` and derives the actor from authenticated Firebase
identity. The transaction requires blocked state, expired lease, remaining
three-attempt budget, matching prospect/full brief and a current approved handoff.
It preserves the create claim/session and never resets attempts. Unknown create
acknowledgements, exhausted budgets, closed/converted prospects and changed
context fail closed. Requeue itself creates no session, approval or send; the
worker rechecks real context, current suppression and permissions before work.

## Disabled release and shortest test path

Flags default off; this change writes no environment values:

- `BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED=true` permits the queue loop.
- `BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE=true` separately permits inference.
- `BLUEPRINT_COMMUNICATIONS_SEND_ENABLED=true` separately permits approved sending.

`startCommunicationsWorker()` is an additive exported hook with no startup catch-up.
After PR773 merged at `614780173940f9a35cbdbca5f683b2b1f531f5e0`, the isolated
branch reconciled that exact base and added a separate communications startup/stop
call to `startWorker`. The merged research hook, package, Render flags and
scheduler remain as released by owner `01a0f464-4d3b-73c7-b166-239e0bc960ee`.
Communications has its own default-off flags and queue, with no 07:00 schedule or
research lease mutation. The owner approved a disabled merge/deployment after exact
review and green CI; inference, sending and credential/grant installation remain
unapproved. The consumer's queue producer and upstream QA handoff must be bound on
Blueprint infrastructure before claiming unattended operation.

1. On existing Render worker `srv-d9t8gg1t0dsc73am9q70`, run
   `node scripts/communications-preflight.mjs` with existing
   in-place founder bindings. This performs only model discovery and Gmail profile/sendAs
   reads, prints sanitized status, and creates no session/draft/send. The script is self-contained and uses only the worker's existing `googleapis` dependency, so its reviewed source can run in place before the communications deployment. Do not copy
   credentials into the workspace. Missing scopes/binding blocks communications
   enablement and does not authorize access grants or ops credential replacement.
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
and `founder_gmail_binding_missing`. On October 1 the parent ran the earlier
reviewed preflight on Render: exact `gpt-6-luna` model discovery in Default was
verified; the **previous shared** HUMAN_REPLY binding returned `invalid_grant`
before mailbox/sender identity was verified. That error does not establish token
ownership or its cause. This repaired preflight never reads that ops binding;
actual separate founder binding/access remains unverified. Neither model listing
nor the earlier Default saved-agent GET200 proves Agents API Luna inference.
October 1 first outreach remains conditional, not send authorization or a promise.

Mock validation covers research corruption/publication identity, handoff changes,
stale refresh, queue races/bounded recovery, actual thread correlation/injection,
newer opt-out, exact approval races, send suppression/identity races, Gmail
permissions/header parsing and lost-ACK/no-resend behavior. No live emails,
provider sessions or Gmail drafts were created by tests.
