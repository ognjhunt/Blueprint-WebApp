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
| `handoffs/{briefDigest}` | Immutable `blueprint.communications-handoff.v1`, written by verified agent intake or optional authenticated operator context review |
| `researchSources/{briefDigest}` | Immutable original candidate, QA reference/digest, exact publication plan digest and external Sheets ID; bound by the brief's optional `researchOrigin.sourceDigest` |
| `researchBindings/{sourceIdentityDigest}` | One immutable WebApp prospect binding per Sheets document/BP ID, preventing duplicate first touches through separate prospect IDs |
| `intake/{sourceIdentityDigest}` | Agent-owned admitted, needs_research, blocked or already_requested outcome with exact date/candidate/source digests; no human pre-draft form |
| `intakeState/publishedResearch` | Private bounded pagination cursor and lease; never the research runner lease |
| `firstTouches/{deliveryKey}` | One first-touch queue claim across revisions; only proven pre-inference research failures can be replaced atomically |
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

### Automatic publication intake

The existing communications worker runs deterministic intake on its one-minute
tick when `BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED=true`. It reads completed
`blueprintDailyResearch/sites-first/workItems` in pages of five using a durable
communications-only cursor, then reloads the pinned `Store.snapshot(date)` and
verifies source QA and both publication readbacks. There is no startup catch-up.
An unavailable older snapshot becomes an agent-owned research request and the
cursor advances, so it cannot block a newer publication. The 7am research package,
scheduler, control records and leases are unchanged.

For a candidate to supply a public business contact automatically, its already
QA-approved evidence must contain this exact versioned assertion in `claim`:

```text
blueprint.public-business-contact.v1:{"organization":"Exact candidate organization","site":"Exact candidate site","email":"recipient@facility.example","purpose":"business_inquiries","status":"public_business_contact"}
```

This uses the existing research evidence schema; it adds no upstream field or
research tool. The evidence must be a live, current-operational operator fact.
The citation host must equal the candidate's organization URL host or a
dot-bounded subdomain. The quote must independently contain that exact email
and identify a public business/commercial/partnership inquiries route. Competing
addresses, personal/support-only routes, no-contact restrictions and any
contact/recipient/email/permission-related unknown refuse admission. A bare
email in a quote, old CRM row or vendor claim is insufficient. No address is
guessed, and no robotics interest is inferred.

An existing prospect may instead reuse its exact previously verified immutable
handoff for this publication. Intake verifies the complete brief, separate
handoff, immutable source provenance, global Sheets/BP binding, original contact
check date and current canonical email/context. An explicit contradictory
assertion never falls back to an old handoff.

Verified source contact permits intake to derive a bounded purpose, one easy
non-confidential relevance question, unknown interest and public-only sharing.
In one transaction it binds the published Sheets identity to a WebApp prospect,
creates the canonical projection if absent, immutable brief/handoff/provenance,
intake outcome and internal first-touch queue record. Generated `research-*`
site/task/case references are provisional; they do not admit or qualify an entity.
A sourced location is stored with its explicit unverified-street-address
provenance. Existing contacted/closed/converted states and recipient bindings
are never overwritten. Suppression blocks admission.

Missing, stale, ambiguous or unrepresentable facts produce `needs_research` and
an agent-owned `refreshRequests/intake_*` record with the precise gap. They do
not ask for a mandatory human form or create a paid session. Terminal
pre-inference stale/context jobs may be replaced by a verified revision after
lease expiry, only if no create/session ambiguity, output, approval ledger or
send receipt exists. Prior jobs remain marked superseded. Active/drafted/sent
first touches remain fenced across revisions.

Paid drafting still requires `BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE=true`.
With that flag off, intake can queue verified work but cannot call Luna. An
internal first-touch draft has no Gmail dependency; actual reply reads and every
send retain the isolated founder mailbox verification. The draft enters the
existing exact recipient/body/sender human approval queue. This build does not
create Gmail drafts, send mail, enable flags or install grants.

The authenticated, CSRF-protected `research-preview`/`research-approve` routes
remain an optional operator-reviewed context path. They are not the automatic
trigger. They preserve exact preview-digest approval and server-derived actor/time;
manual approval itself does not enqueue or create a session.

The adapter requires completed research with raw/review/evidence hashes, a
validated QA artifact bound to the actual research session/QA turn, an accepted
candidate, both acknowledged readback receipts, and exact selected-order Sheets
plan rows/IDs. It preserves the full original candidate, including publisher,
quotes, scope, cached snapshot/fact IDs and unknowns. Every fact receives a stable
source-derived ID and its original check/published date. Operator facts remain
operator-stated, independent facts primary, vendor claims vendor-reported, and
hypotheses inference. All are conservatively consequential (seven-day freshness).
Original assertion scopes also travel in each fact to the writer; dated
background cannot become current operational or deployment readiness evidence.
The worker revalidates the source digest against the durable publication before
inference; loading a cached source cannot refresh its date.

This bounded producer supports first-touch public business contact only: stage
stays unknown, no actual prior Gmail conversation is invented, and team/capability
IDs remain empty. Existing verified connection/capability records require their
own review rather than being silently discarded. Conflict, stale/future evidence,
unknown permission, identity changes and source overflow refuse preview/approval.
The current brief limits (16 unknowns, 1,200 characters per fact/unknown) may refuse
otherwise valid larger research packets (20/2,000); no source text is truncated.

Real mailbox access, model inference and email sending remain unproved and
disabled under their existing controls. Incoming-message and relevant-refresh
producers remain separate work; this adapter does not turn mocked worker tests
into evidence of live Gmail or paid-model execution.

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

### Owner connection preparation and disabled consent adapter

`/admin/leads` → Approvals → **Prepare founder mailbox** remains the review
surface. Its preparation GET reports presence/selected storage only and never
claims live account access. The new Gmail-only consent routes are disabled unless
all owner configuration gates are satisfied. No client registration, OAuth grant,
credential entry/storage or permission change occurred during this build.

The implemented fixed callback is
`https://tryblueprint.io/api/communications/gmail/oauth/callback`.
This is code, **not proof of Google registration or deployment**. Only this exact
URI is admitted; no request can supply a redirect or another provider endpoint.
The existing Blueprint Work OAuth authorizes Blueprint tools and is not a Google
mailbox connection route.

The exact initial scope is `https://www.googleapis.com/auth/gmail.readonly`,
which permits whole-mailbox messages/settings access even though runtime
retrieval is limited to relevant full threads and exact sent receipts. This flow
rejects any additional granted scope. It has no Gmail draft-write or send
capability. Drafts remain in Blueprint. A later separately reviewed send authority
needs `https://www.googleapis.com/auth/gmail.send`; this initial connection does
not install or accept it. Existing exact recipient/body/sender approval and the
communications send control remain independent gates.

The same API prefix has authenticated `GET /status`, `POST /start`, and
`POST /complete`. Both POST bodies are exactly `{}`; they accept no secrets.
Start/complete require a current Firebase bearer identity matching the configured
owner UID, a freshly re-read non-disabled/revoked operator role, existing CSRF
protection and exact `https://tryblueprint.io` Origin. Tenant identities are
refused. On `www.tryblueprint.io`, the preparation screen offers a fixed link to
`https://tryblueprint.io/admin/leads?founder_gmail=prepare`, which opens Approvals
and expands preparation without starting consent. The owner signs in on apex
if needed, then explicitly starts there. Start, callback and complete require
the apex request Host; forwarded-host headers cannot select a callback host.
The browser binding remains host-only: no shared-domain cookie or second Google
callback is needed. Start creates a ten-minute one-use state, a separate HttpOnly Secure
SameSite=Lax browser binding and S256 PKCE. Transient code/verifier material is
bound-encrypted with the existing field-encryption primitive in the private,
default-denied `communicationsGmailOAuthFlows` collection. Its `expireAt` timestamp
supports an owner-configured TTL; logical expiry is enforced even without TTL.
No TTL configuration was changed by this build.

The Google callback consumes state and encrypts the code, then redirects to a
fixed clean Blueprint URL. It performs no token exchange or credential write.
After returning, the original owner explicitly clicks **Verify and save founder
read-only connection**. Complete durably claims the exchange before one bounded
Google token POST (no retry/redirect). It requires exactly the read scope and a
refresh token, verifies primary `nijel@tryblueprint.io` plus its accepted sender,
rechecks owner/control/approval drift and expiry, then persists the verified
credential. Wrong accounts, replay, missing scope, revoked owners, ambiguous
exchange or storage failures fail closed. No auto-revocation can disturb an
existing operations grant. An uncertain persistence outcome must be checked
against the private binding before requesting another grant.

The isolated binding is `communications-founder-gmail` in the default-denied
`communicationsGmailCredentials` collection. The existing bound field encryption
protects the refresh credential and binds it to owner, Google client and flow.
The shared integration owner must approve selecting this REST store contract;
it is not an OpenAI MCP vault credential and is not readable through vault GET.
Both Render services use their existing Firebase/encryption bindings to read it.
The runtime and built read-only preflight reuse the same private reader. There is
no HUMAN_REPLY fallback, secret export or ordinary frontend credential form.
Initial connection never overwrites an existing environment/durable founder
binding. Replacement or scope expansion requires a separate reviewed owner
operation. All HUMAN_REPLY fields, identities and watchers remain untouched.

Owner-only setup after exact-head review, green CI and an approved disabled
release:

1. In project `blueprint-8c1ca`, verify an **existing** compatible web client and
   its shared operations usage; register the exact implemented callback after
   approving that client change. No existing client currently has this callback.
2. Establish founder eligibility and approve the audience/publishing design.
   Current evidence is External/Testing, `nijel@` absent from test users, with
   only read scope. Testing Gmail refresh grants expire after seven days. A
   deliberately approved temporary test connection is explicitly marked and
   stops being usable after seven days; `durable_reviewed` is an owner attestation
   requiring verified production/appropriate Internal Workspace eligibility,
   not a durability proof supplied by code.
3. Through secure owner-controlled configuration only, bind the verified client
   ID/secret to the separate existing founder fields. Do not copy ops values or
   put credentials in chat. Confirm both services already have compatible
   encryption access. No new key or security grant is part of this code.
4. Record the approved owner UID, nonsecret approval reference and exact
   registered callback; select the approved private storage contract and grant
   mode. Only then enable this **consent flow**, leaving worker/inference/send
   controls off. Use the Blueprint buttons and complete Google's founder consent
   yourself. The callback token is handled only on the server.

Required configuration names (all unset/default-disabled until owner action):
`BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_ENABLED=true`,
`BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID`,
`BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_APPROVAL_REF`,
`BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_REGISTERED_CALLBACK` (exact URI above),
`BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_GRANT_MODE` (`temporary_testing` or
`durable_reviewed`), and `BLUEPRINT_COMMUNICATIONS_GMAIL_BINDING_STORAGE=bound-field-firestore-v1`.
The separate existing `BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_ID` and
`BLUEPRINT_COMMUNICATIONS_GMAIL_CLIENT_SECRET` remain private; the owner flow
writes an encrypted refresh credential instead of writing environment values.
None of these fields were configured in this build. See Google's
[web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server),
[Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), and
[Testing expiry](https://developers.google.com/identity/protocols/oauth2#expiration).

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
The worker flag gates the timer and deterministic intake; the paid-inference
flag separately gates job processing, including recovery. With paid inference
disabled, checkpoints remain durable and no automatic saved-turn reads run. The API's read-only reconciliation method can run without paid authority;
there is no separate production recovery endpoint in this release. Do not enable
paid inference solely to recover a saved turn.

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
unapproved. The automatic producer is bound to the existing worker, but default-off runtime
flags and actual verified contacts/QA publications must be present before claiming
unattended operation.

1. On existing Render worker `srv-d9t8gg1t0dsc73am9q70`, run
   `node scripts/communications-preflight.mjs` with existing
   in-place founder bindings. This performs only model discovery and Gmail profile/sendAs
   reads, prints sanitized status, and creates no session/draft/send. Environment-only preflight uses the existing `googleapis` dependency. The owner-installed encrypted binding requires the reviewed `dist/agents/communications-gmail.js` reader built by this release; it does not import worker startup or write credentials. Do not copy
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
