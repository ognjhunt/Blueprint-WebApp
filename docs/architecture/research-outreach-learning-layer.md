# Research and outreach learning layer

Status: verified foundation deployed; prior-research reconciliation staged; runnable read-only consumer adapter/CLI available. Caller hooks remain separately owned integrations; see the consumer handoff contract below.
Owner: WebApp learning projection, coordinated by the parent engineering lane.
Authorized objective: make site/job/team research reuse evidence from previous
research, contact availability, outreach, replies and later outcomes. The owner
explicitly approved this support layer on 2026-10-01 at 17:07. It does not change
scientific verdict, rights, physical-outcome or send authority.

## Field ownership and exact joins

| Record/fields | Writer and authority | Learning behavior |
| --- | --- | --- |
| `outboundProspects/{prospectId}`: facility/job/contact, `siteId`, `taskId`, `caseId`, `researchPublicationId`, stage, contacted timestamps and communications pointers | Existing CRM/intake owner | Read exact IDs; preserve all existing records and `BP-*` CRM IDs. Do not deduplicate by company name, sender or subject. |
| `blueprintCommunications/default/briefs`, `handoffs`, `researchSources`, `researchBindings` | Existing research QA/publication and verified intake adapter | Verify brief/source/handoff digests and publication receipts. Reuse fact IDs, original check dates, grades and capability/team IDs. Reading a snapshot or reviewing a brief does not refresh public sources. |
| `action_ledger/communications_{jobId}`: payload/body, model draft/usage links, approval/status/timestamps | Existing communications/action policy owner | Verify complete job/brief/recipient and payload digest. Export message digest and references; never export email/body or approval authority. |
| `blueprintCommunications/default/sendReceipts/{deliveryKey}`: attempting/unknown/sent, job/payload/ledger/RFC IDs, attempted/sent timestamps and Gmail receipt | Existing communications send owner (PR786) | Attempting is an attempt; unknown acknowledgement remains unknown; sent plus Gmail refs means provider acceptance. None proves delivery. |
| `outboundProspects/{id}/communicationsEvents/reply_{messageId}`: correlated inbound message, `untrusted:true`; `sent_{jobId}`: sent receipt/job/payload/ledger refs | Existing communications store | Read only exact associated job/thread/message records. Preserve source hashes, not raw mailbox text. Legacy meaning is unknown; human correction provides classification. |
| PR786 `firstContactAuthorities`, `recipientFirstTouches`, `firstContactDailyUsage` | PR786 first-contact owner | No edits, duplicate implementation, authority inference or new grants. Daily reserved attempts are not delivered messages. |
| Robot-team/capability registry and public-source research snapshots | Existing registry/research owner | Preserve exact team/capability and fact refs/grades. No automatic capability promotion. Company joins remain null until owner-supplied. |
| `blueprintResearchLearning/default/events/{eventId}` | Research adapter: research/contact; communications adapter: attempt/acceptance/delivery/reply; outcome adapter: confirmed operational outcomes; human: append-only corrections | New strict, content-addressed evidence records. Create only; never update/delete history or write source-owned fields. Actor and prospect scope come from the trusted server. |
| `blueprintResearchLearning/default/snapshots/{snapshotId}` | WebApp learning materializer | Immutable versioned, principal/prospect/section-scoped read projection. Hash-checked readback; no live current-pointer change in this release. |
| `blueprintResearchLearning/default/sourceSnapshots/{snapshotId}` | Authorized source reconciler | Separate immutable CRM/capability snapshot. Reconcile existing BP IDs and complete independently read Sheet rows before staging; preserve nullable native joins. No synthetic v1 prospect events. |
| `blueprintResearchLearning/default/siteLearningEvents/{eventId}` | Authenticated human-source adapter | Human-attested motive, bounded question, decision-changing evidence, stated decision/evidence owner IDs, brief/later/no/unknown choice and usefulness feedback. Capture actor differs from stated site owner. Correct by append-only chain; source/brief bindings are host-issued inputs. No live writer route is exposed. |
| Sheets `Research Learning` review/export view | Learning exporter | Firestore-owned derived rows with existing CRM ID, snapshot hash/cutoff/event refs/unknowns. Sheet edits do not write back CRM or learning facts. Corrections enter through a separately authenticated human append. |
| Notion playbook/learning summary | Summary exporter | Aggregate counts, denominators, unconfirmed hypotheses, confounders, exploration allocation and snapshot refs. No raw threads or authoritative CRM state. |

## Runnable research and communications consumer handoff

`server/research-learning/consumer.ts` exports
`openResearchLearningSession(existingFirestoreAdmin, trustedHostBinding, selection)`.
It runs immediately when called; it has no activation flag, model execution,
source/pointer write or directory-migration prerequisite. The research owner
owns its invocation before the daily research prompt; the communications owner
owns invocation before drafting. Their package, scheduler, OAuth, approval and
send files are outside this slice's ownership. Await one session, give its
`handoff` to the agent as untrusted evidence, and wrap its `search`, `details`
and `history` methods as scoped read-only retrieval tools. An unavailable read
means unknown evidence; it cannot authorize or independently prevent a send.
Existing communications consent, suppression, send and approval policy still
owns that decision.

The host constructs `blueprint.research-learning-consumer-binding.v1` after
existing authorization. Its exact fields are `principalId`, `role`
(`daily_research` or `communications`), `sourceSnapshotId`, `crmIds`,
`prospectIds`, `discoveryCapabilityIds`, `detailCapabilityIds`, and `expiresAt`.
Never accept this binding from a model, client body or model-selected file.
Discovery access is separate from detail access; the host expands detail scope
when authorized. This logical scope is not a new IAM/OAuth/security grant.
Selection contains at most ten `crmIds`, ten explicit native `prospectIds`,
five initial `capabilityIds`, `focus: {city, industry}` and optional
`maturityDays` (default fourteen). Larger runs select successive relevant
scopes; ten is a context bound, not a research-success ceiling.

Opening captures prior sanitized research and queries canonical prospects by
exact `researchPublicationId` for the selected CRM IDs. Missing or competing
native joins remain unknown. New CRM admissions can read current exact native
history even when their rows are absent from the older source snapshot. The
reader combines normalized current communications-owned source records with
append-only learning events and human corrections, preserving exact refs,
hashes, event/fact IDs and original dates. Initial summaries expose counts and
unknowns, not raw addresses, message bodies, approval authority or full fact
bags. First email and the next research run need no complete directory migration.

Progressive operations within the same captured, expiring session:

- `search({taskTags, regionTags, companyIds, capabilityIds, pageSize, cursor})`
  returns a compact ranked page. Empty/broader queries retain all authorized
  alternatives; an absent capability means unknown. Coverage is explicitly
  `cached_capabilities_only`, not the whole robot-team directory.
- `details(capabilityIds)` returns only host-permitted fact/source details and
  explicit unknown IDs. It preserves grades, conflicts, original check dates
  and stable Blueprint fact IDs; loading is not revalidation.
- `history(prospectId, {pageSize, cursor})` returns structured event pages with
  citation/evidence IDs. Cursors bind context hash and exact prospect. Session
  methods never query an unrelated mailbox or acquire a research lease.
- `siteHistory(crmId, {pageSize, cursor})` retrieves human observations under
  the same context and exact CRM scope. Initial context contains at most five
  recent observations plus counts, preserving the rest for selective retrieval.

Portable operator/host invocation, using the existing Admin environment:

```bash
npx tsx scripts/research-learning/read-consumer.ts \
  --binding /authorized/host-scope.json \
  --request /authorized/selection.json \
  --output output/research-learning/new-consumer-export.json
```

Request JSON is `{ "selection": { "crmIds": ["BP-000001"],
"prospectIds": [], "capabilityIds": [], "focus": { "city": "Sacramento",
"industry": "Laundromats" } }, "queries": [], "details": [], "history": [] }`.
`queries` uses the search arguments above; `details` is an array of selected
capability-ID lists; `history` entries contain `prospectId` and `pageSize`;
optional `siteHistory` entries contain `crmId` and `pageSize`.
The export is create-only, mode 0600, standard JSON. The binding selects the
reviewed Firestore snapshot; no provider session or Library ID is required.
The replacement agent can clone this user-owned GitHub repo, use its already
authorized Blueprint Admin binding, and rerun the same scoped export/read API.

Real existing-binding validation on October 1 opened both roles against
source snapshot `0e1ccd1e7dcb22cca5df09aea78f2cfbdf857d8fe4436105722234302ddf0527`.
Each read one CRM row and searched four cached capability entries; detail
scope exposed only BP-CAP-001. BP-000001 had no current exact native join, so
contact/outcome history stayed unknown. Synthetic contract tests separately
exercise actual communications-owned accepted receipts, unknown delivery,
human reply corrections, later owner outcomes, scope expiry and paging.

## Permanent portability and release requirements

Root and nested `AGENTS.md` now require company-controlled canonical storage
and portable formats for business code, prompts/configuration, records,
evidence, workflow state and required artifacts. Stable Blueprint-owned IDs
are business identity; provider/session/Library references are provenance or
optional delivery copies. Replacement agents must work without dot, ChatGPT
Library or one model vendor. This applies to reconciliation, migration and
backup helpers as well as consumers.

Every release/handoff identifies canonical locations, hashes, schema/format,
source/check provenance and an export/recovery route. This layer's canonical
locations are user-owned GitHub source contracts and Blueprint Firestore
`blueprintResearchLearning/default/{sourceSnapshots,events,siteLearningEvents}`.
Local JSON verification/export bytes are preserved. Blueprint's existing
configured Firebase/GCS bucket `gs://blueprint-8c1ca.appspot.com` is the
object-storage destination candidate (existing metadata read succeeded);
private proof/backup transfer requires approval for the specific destination
and verified existing access. No such transfer or Library-only handoff occurs
in this release, and no claim is made that all historical artifacts migrated.

`npx tsx scripts/research-learning/check-portability.ts` audits explicit
production Library-only canonical references and mandatory-Library flags in
server/client/scripts/workflow source and root deployment/package configs.
Docs, fixtures, tests, optional delivery copies and model integrations are
excluded. This practical regression check does not prove remote accessibility
or complete artifact recovery; releases must provide that operational evidence.

Review destination: [existing CRM](https://docs.google.com/spreadsheets/d/1n95Ih0Swc-q-kZyUaDHoZh6SVzxvf_zt-CRR7i39bWY/edit).
Learning/playbook workspace: [NotionNow](https://app.notion.com/p/3ea80154161d81c7810cc42e9e7df9c5).
These are planned export destinations. This release performs no Sheets or Notion
writes and does not claim either destination has changed.

## v1 event and read contract

`server/research-learning/contract.ts` defines strict discriminated event types:
research, contact, outreach, delivery evidence, reply and confirmed operational
outcome. Each carries occurrence/recording dates, exact prospect/CRM/company/
site/task/case/team/capability refs (unknown joins stay null), writer/actor,
source record hashes/check dates and an optional correction edge.

Outreach includes exact job/payload/ledger/message/thread refs, message digest,
contract version and a separately known-or-unknown message variant. Attempts
without a Gmail acknowledgement have null message/thread refs. Research fact
checks retain original source dates and grades separately from QA review time.
Reply classification includes confidence, uncertainty, method, interest subtype
and normalized objections. Curiosity, willingness to talk, evaluation interest
and pilot discussion never assert pilot readiness. Pilot agreement, evaluation
participation and deployment capacity require their own owner-confirmed event.
Operational milestones do not establish authoritative physical robot performance.
The worker can record multiple correlated incoming messages, including an
earlier opt-out, under one reply job. Each history item keeps its own Gmail
message identity and exact RFC/thread/sender/recipient correlation; it need not
equal that job's trigger message. Legacy meaning stays unknown until corrected.

`recordedAt` does not change semantic event identity. Exact replay keeps the first
persisted record; a changed source hash appends a new event. Human corrections
must reference an existing event, preserve exact joins, and carry attestation.
Later corrections form a chain. Competing corrections to one parent fail closed.
Originals remain available in history. Only evidence recorded/checked by the
snapshot cutoff enters an as-of view.

Grants are **trusted server/control-plane inputs**, never model metadata, prompt
content or client-supplied authority. Each grant names a principal, explicit
prospect list, authorized sections and expiry. Requests must be subsets. New
collections inherit existing server-only Firestore restrictions; no security
rule or access grant is changed. Agents receive only the relevant structured
snapshot. Raw associated mail stays private to the existing communications
owner. Nothing searches an unrelated mailbox, reads OAuth records or discloses
credentials. The ingestion adapter uses existing Firestore records from the
already authorized Nijel read-only mailbox path; it makes no new Gmail/OAuth call.

`harness.ts` produces an untrusted-evidence-only context for shared research
agents. Pipeline owns the follow-up optional `tools/daily_research/learning.py`
loader and `learning_snapshot` configuration; coordinate through the parent.
No edits were made to PR786 send/OAuth/approval files, the pinned portable
research release, or Pipeline PR2518. No BlueprintContracts expansion is needed
for this staged local read contract; a later cross-repo contract promotion can
pin the verified v1 artifact.

## Prior research without invented outreach joins

The deployed v1 event contract remains byte-for-byte unchanged. CRM inventory
can exist before a native `outboundProspects` ID or outreach brief exists.
`prior-research.ts` therefore defines the independent
`blueprint.research-learning-source-snapshot.v1` contract rather than pretending
that a `BP-*` CRM ID is a native prospect/site/task ID. Host-issued grants name
explicit CRM and capability IDs, sections, principal and expiry. The reader
filters CRM rows, companies, capabilities and their referenced source pages.
Source hashes, original checked dates, confidence, vendor-claim grades, conflicts,
unknowns and failed-run status survive loading. Raw contact names, emails,
private notes and source quotes are not projected; malformed/private URLs and
contaminated statements fail closed. Loading is not evidence revalidation.

`shared-context.ts` supplies the scoped harness input, a derived Sheet review
payload and a counted Notion summary payload. It cannot authorize sends or
publish these payloads. Pipeline owns consumer wiring and package promotion in
a separate release; no pinned package or send-path file changes here.

The separate human `site-learning` contract keeps unknown motive/feedback
unknown. `later` and `no` describe the brief choice; they do not mean a lost
pilot or rejection of robotics. `helped`/`did_not_help` require a precise brief
record/version/revision/hash and attributed feedback; `pending` requires an
actual dated feedback request. The append adapter must supply verified human
attestation and brief bindings from their owner records, never model input.
Before enabling an adapter, it must verify that the exact brief and attributed
feedback belong to this CRM/native subject, in addition to matching the stored
brief version/hash; an unrelated valid brief is not enough.
The stored prior-research row fences CRM/native/site/task joins. No synthetic
human record was made from CRM inventory, and no live human writer endpoint is
enabled in this release.

The bounded CLI `scripts/research-learning/reconcile-sources.ts` extracts only
the reviewed immutable `Store.fileGet` bridge from the installed archive, then
reads the two Firestore source blobs. It uses the existing Admin environment
binding without copying credentials. An independently captured formatted
`Prospects!A1:Z1000` manifest contains header, CRM IDs and full-row hashes, not
contact values. Duplicate/missing/changed rows, mixed source hashes, stale
independent reads and changed archive pins stop staging. Dry run is default.
An explicit staged run needs the reviewed snapshot hash and cutoff and rechecks
both source hashes. The store accepts only an unchanged successful reconciliation
report produced in the same process, so serialized or self-hashed snapshots
cannot bypass the row comparison. It creates only that `sourceSnapshots`
document and requires scoped hash-checked readback; it never updates a pointer,
source, lease or run.

The existing `Publisher.prepare/write/reconcile` route is reviewed-packet and
lease gated, with its own fixed research destinations. It is not the learning
publisher and must not be invoked to publish learning summaries. Future Sheets
and Notion publishers need independent destination/schema/reconciliation
review; Sheet edits never become competing authoritative Firestore writers.

Real-source reconciliation on 2026-10-01 found 11 current CRM IDs
`BP-000001`–`BP-000011`, four companies, four capability records and 32 facts
(16 reviewed, one conflicted, 15 unknown), with no row mismatches or source-hash
errors. Native prospects, communications jobs, briefs and normalized events
were zero in bounded reads. All 11 native joins remain null. The original CRM
checks are 2026-09-29; public-source checks are 2026-09-29/30. The failed
2026-10-01 research run remains failed. These observations do not establish a
completed research batch, verified contact, sent/delivered email or pilot proof.

Read targets are `blueprintDailyResearch/sites-first/files/{crm,knowledge}.json`,
that root's `runs`, selected native prospects and bounded communications/event
metadata. The only staging target is
`blueprintResearchLearning/default/sourceSnapshots/{reviewedHash}`. Later human
observations have a separate `siteLearningEvents` target. `readyForCutover`
remains false until the Pipeline consumer and relevant host-issued grants are
reviewed and the staged readback/source reconciliation is verified. No security
grant, OAuth scope, paid classifier or first-contact activation is implied.

## Progressive retrieval and actual coverage

The current staged reader takes explicit CRM/capability IDs from the cached
knowledge snapshot. It does **not** query every Firestore `robotTeams` record
on every run, and no live Pipeline consumer is enabled by this release.
`retrieval.ts` defines the progressive consumer contract: a compact paged
directory search, selective scoped detail/evidence fetch, query broadening and
host-issued detail-scope expansion. A discovery grant permits only the exact
index hash; it never expands a detail grant or provider/tool authority.

The index carries IDs, public names, task/region tags, original source dates and
unknown/conflict flags, without fact bodies, contacts or mailbox data. Search
ranks relevant entries but leaves every authorized entry reachable by paging
or an empty broader query. Missing tags stay unknown and nonmatching listed
tags do not establish incompatibility. Ten prospects or one shortlist is not a
stop condition. Cursor hashes bind the query and index for reproducibility.

The same read contract supports an owner-built lightweight full authorized
`robotTeams` directory index. That enumeration/provider is a separate reviewed
consumer step. The current cache-derived index explicitly declares
`cached_capabilities_only` and incomplete directory coverage; it does not claim
the four cached companies are the whole team directory. Begin each run with
compact scope, prior findings and open questions, then let the agent search,
broaden and fetch relevant detail. Keep the scoped snapshot for provenance and
reproducibility alongside these operations, rather than dumping full records
into a prompt or fixing one permanently filtered bundle.

## Planner semantics

The planner supplies observed counts for the focus cohort, same industry in
other cities, and other industries in the same city. Cohort metadata, contact
availability and message controls are taken at the first observed outreach
touch; later research does not silently move old outcomes into new cohorts.
Task/team, contact route, exact message digest/known variant, campaign and timing
strata expose comparability gaps. Existing records lack some city/industry,
campaign and timing fields: they stay unknown and need owner-reviewed mapping.
Textual addresses and messages are not guessed into cohorts.

An attempted touch is one distinct outreach job, including unknown ACKs.
Accepted touches require Gmail acceptance refs. Verified delivery requires a
separate delivery notification, which the current Gmail records do not have.
Delivery rates use verified-delivered **accepted** jobs over accepted jobs;
delivery evidence for an unknown-ACK job is separately counted. Reply maturity
uses a configurable 1–90 day window (fixture: 14) from the first accepted touch.
Correlated replies on any later accepted thread count within that original
prospect observation window. Observed replies after unknown acknowledgement
remain visible with `replyAcceptanceUnknownProspects`; they do not enter the
accepted-thread rate numerator. A mature prospect with only such a response
enters `matureReplyAcceptanceUnknownProspects`, never mature nonresponse.
Null Gmail refs or a missing legacy touch never erase a validated correlated
reply observation. Missing/mismatched touch thread/contract references and
replies before a matching acceptance stay outside accepted-rate eligibility;
their observation and acceptance uncertainty remain visible. Actual unrelated
incoming mail fails correlation at the source adapter. Classified automatic
replies do not count. Copy strata hash the validated canonical envelope subject/body
before recipient-specific transport footers; full payload and receipt hashes
retain transport evidence. Mismatched canonical payload copy is quarantined.
Only a bounce on that touch excludes its prospect from that mature denominator.
Later bounced follow-ups do not erase the original window. Reply counts include
unclassified correlated replies and exclude classified automatic responses;
classification uncertainty remains visible. Mature nonresponse is not rejection.
Only certain human labels count as curiosity or explicit rejection. Cumulative
operational milestone counts retain earlier observed outcomes.

Hypotheses are descriptive and unconfirmed. Small samples, selection, delivery,
timing, task/team, contact and copy differences remain confounders. Default
planning allocation is 40% replication / 40% comparison / 20% new exploration,
a proposed research allocation rather than spend or send authority. There is no
ten-prospect success ceiling. `gpt-6-luna` model classification is disabled and
has no execution path; a separate activation budget and reviewed implementation
are required.

## First-batch site learning mapping

The owner-approved first-batch objective is to learn which robotics uncertainty
a real site wants help resolving and whether an Atlas-independent short
Blueprint brief helps a concrete decision. The owner makes the walkthrough and
handles replies personally. This objective does not authorize automatic reply
interpretation, new outreach, or pilot-readiness inference.

| Requested learning | Existing source/read mapping | Minimal remaining gap |
| --- | --- | --- |
| Bounded task/question and decision owner | Existing communications brief owns `boundedJob`, `contact.learningQuestion`, `decision`, nullable `decisionOwner`; snapshot retains exact site/task/case and brief evidence refs | A sanitized scoped projection of these already-owned fields when a consumer needs the actual question/decision. Reading them must not infer site interest. |
| Stated trigger/motive, unknown allowed | Existing correlated reply evidence and human classification/attestation give provenance | A nullable owner-confirmed structured summary; no guessed motive and no raw mailbox excerpt in agent context. |
| Evidence that would change the decision | Research fact IDs/check dates/grades and owner-confirmed evidence references already fit | An owner-stated relationship between the concrete decision and the requested evidence, kept separate from researcher hypotheses. |
| Voluntary next step: brief/later/no | Human reply correction preserves stated interest and objections | A small explicit `unknown`/`brief`/`later`/`no` learning choice. Do not force it into pilot agreement or `lost`; declining a brief does not establish robotics rejection. |
| Whether the short brief helped a decision | Existing case/task IDs and owner-confirmed outcome record references preserve joins | An explicit unknown/pending/helped/did-not-help assessment with brief version and human evidence refs. Existing operational outcome enums do not represent brief helpfulness. |

The strict v1 event schema does not yet accept those learning-specific response
fields. The smallest follow-up is one human-confirmed structured learning
record and its bounded projection, reusing the current case/prospect ownership,
attestation, corrections and hash/check-date contracts. It should preserve
unknowns, separate observation from hypotheses and keep nonresponse maturation
unchanged. No broad experiment platform, new model or automated writer is
needed. This mapping records the gap without delaying the reviewed bug repairs
or changing the separately owned Notion guidance.

## Migration dry run and staged reconciliation

1. The parent confirms file/release ownership with PR786 and the Pipeline
   Perplexity owner. Export only the explicit approved prospect scope through
   `readExistingSources`, using the existing binding. No new credentials/grants.
2. `normalizeExistingSources` validates immutable research handoffs and exact
   CRM/site/task/case/ledger/recipient joins. Retain legacy unknown meanings.
   Preserve valid historical sends if the current CRM contact has changed and
   quarantine that mismatch for owner reconciliation. Missing joins are
   quarantined rather than assigned replacement IDs.
3. Assemble the normalized dry-run input with an **independently captured**
   expected prospect/evidence manifest, source quarantine and existing learning
   events. `migrationFixture` is synthetic test setup, never live manifest proof.
4. Run `npx tsx scripts/research-learning/dry-run.ts input.json report.json`.
   It is local-only, has no apply mode, creates a private output without
   overwriting existing artifacts, checks exact scope/evidence coverage and
   reports append/replay counts plus the hash-bound snapshot and planner.
5. Reconcile CRM IDs, missing case/site/task joins, contact corrections, unknown
   cohort metadata and source counts. Replay must propose zero additional events.
   No unresolved quarantine or missing/unexpected evidence refs may pass.
6. After parent release coordination, stage only append-only learning events
   with authenticated writer contexts, materialize bounded private snapshots and
   verify Firestore readback/hash/counts against the dry-run artifact. Rollback
   means stop the new reader/exporter and keep history, never deleting old CRM.
7. Cut over one explicitly scoped research consumer after reconciled owner
   review and compare prior/new plans. Then activate derived Sheets/Notion
   exports with readback receipts. Expansion follows observed verification.

`readyForStagedAppend` is local preflight only. `readyForCutover` is always false
in this release. No live data was migrated, no worker/flag was enabled, and no
prospect was contacted.

## Local validation and completion evidence

Run `npx vitest run server/tests/research-learning.test.ts` and `npm run check`.
Regression coverage includes scope/privacy denial, no source writes, exact
joins, hash tampering, correction replay/chains/conflicts, date boundaries,
delivery unknown/ACK rates, bounce maturity, historical cohorts, message controls,
cumulative outcomes, source quarantine, and aggregate-only exports.
Run the required graphify refresh after code changes. Record broader checks,
independent Sol review, actual dry-run counts and any tooling blockers in the
task closeout. Green synthetic tests prove the offline contract, not live ingest
or export readiness.
