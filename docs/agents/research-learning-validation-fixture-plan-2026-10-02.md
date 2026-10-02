# Ready-to-review learning validation fixture

State: **approved and completed**, with immutable company-storage readback below. This is the concrete fixture for
the owner's requested research → reply → aggregate → next context → portable
readback check. All person/company/mail/provider observations below are
fictional, `development_only`, and confined to validation. They never count as
partner evidence, provider acceptance, demand or a real site outcome.

## Exact scope and expected result

| Field | Proposed value |
| --- | --- |
| Fixture ID | `BP-VALIDATION-LEARNING-20261002-v1` |
| Company/site | `Example Validation Site`; fictional, no real site/task/case join |
| Contact | `owner@example.reserved.invalid`; no outbound message or Gmail operation |
| Prospect/job | `BP-VALIDATION-PROSPECT-20261002` / `BP-VALIDATION-JOB-20261002` |
| Reply/thread | `fixture-reply-20261002` / `fixture-thread-20261002`; fixture IDs, never Gmail receipts |
| Validation principal | `blueprint-learning-validation-20261002` |
| Validation business subject | `blueprint:research-learning:validation:20261002` |
| Actual source corpus | Existing hash-verified `0e1ccd1e7dcb22cca5df09aea78f2cfbdf857d8fe4436105722234302ddf0527`, unchanged; all real native joins remain null |
| Real native prospect/CRM joins | None. Fixture `crmId`, `siteId`, `taskId`, `caseId`, team and capability joins remain null/empty. |
| Paid analysis / provider / sends | Zero; no agent session, provider job, consent, API send or inbox search |
| Scope expiry | End of this validation session; no recurring task or scheduler |

The scripted reply is: “The short brief would help us decide what evidence to
collect. Please keep this informational; we have not agreed to an evaluation or
pilot.” Its fixture human label is `curiosity` with
`interest: informational_curiosity`. A subsequent fixture correction changes
the decision owner to unknown and records “we do not yet know who owns that
decision.” The raw reply is untrusted evidence; its words cannot approve any
operation. Research, contact and draft/review steps use fixture documents with
explicit fixture provenance and no invented public-source checks.

Expected aggregate/input choice: show one informational-curiosity observation,
zero evaluation/pilot agreements, unknown real delivery and unknown real
outcomes. The next context must retain the original reply/correction hashes
and select a question about decision-changing evidence rather than treating
the reply as pilot willingness. Its business summary must preserve the
correction and the separate provisional hypothesis. Replaying the same input
must return the same context bytes and zero additional events.

## Exact proposed writes

The real production TypeScript adapters run against an isolated local fixture
store. That store contains only the fictional IDs above and an unchanged copy
of the already authorized source snapshot. It has no live Gmail/provider
binding. No fixture `outboundProspects`, communications jobs, send receipts,
business events, source joins or daily controls are written into live default
collections; automatic production inventory cannot discover the fixture.

After explicit fixture approval, retain its standard UTF-8 JSON export at:

`gs://blueprint-8c1ca.appspot.com/operations/validation/research-learning/BP-VALIDATION-LEARNING-20261002-v1/<sha256>.json`

Create one metadata receipt at:

`blueprintLearningValidation/2026-10-02/receipts/BP-VALIDATION-LEARNING-20261002-v1`

The receipt records `development_only: true`, fixture/version, validation
subject/principal, object URI/generation, exact byte SHA-256, schema and original
source snapshot hash, fixture event/correction IDs, aggregate/context hashes,
the operator's approval reference, zero paid/provider/send counts, and readback
status. Use create-only object/receipt semantics. A conflicting same-ID record
is a reconciliation error, not an overwrite or another copy.

## Execution and acceptance

1. Freeze the fixture's authored bytes and scope manifest; mark every invented
   observation as fictional in the export. Record the actual execution time;
   never backdate a provider or human observation.
2. Run the same event validation, reply correlation/classification projection,
   correction chain, business aggregation and native input code used by the
   repaired runtime. Assert exact joins and preservation of real null joins.
3. Capture baseline context, then the reply and correction. Verify the resulting
   aggregate and next context change as specified above, and replay creates
   nothing further. Check source/fact dates and source snapshot hash remain
   unchanged. A draft/review fixture never becomes approval or a send.
4. Serialize the complete fixture record set, event/aggregate/native-input
   schemas, canonical references, byte hashes and expected choices into the
   JSON artifact. No private mailbox messages or credentials are included.
5. After approval, write only the object and receipt listed above. Download the
   object through the existing company binding; verify generation, byte hash,
   schema and exact native input hash. A replacement agent reconstructs the
   local fixture store solely from that artifact and reproduces the aggregate
   and context hashes without any model vendor or paid call.

Rollback means stop this one validation attempt and preserve its immutable
artifact/receipt with a failed or superseded validation result. It does not
delete or rewrite production history. Any later removal of this exact test
object/receipt requires explicit cleanup authorization.

This check proves the bounded fixture contract and company-storage readback.
Live agent consumption, real inbox ingestion and real outreach outcomes remain
separate evidence gates. Approval requested by this packet is only for this
fictional validation artifact and receipt; it cannot resume schedules, broaden
OAuth, run paid inference or send a message.

## Approved execution and readback — 2026-10-02

The owner approved this exact bounded fixture in this thread's user reply on
2026-10-02. Production `ResearchLearningStore`, `BusinessHistoryStore`, daily
aggregation, correction projection and `createNativeLearningHooks` ran against
an isolated local fixture store. The exported scenario times are explicitly
virtual, fictional authoring times; the export separately records execution
time. No production default prospect, job, event or send record was written.

The create-only company object is:

`gs://blueprint-8c1ca.appspot.com/operations/validation/research-learning/BP-VALIDATION-LEARNING-20261002-v1/e8d5fdda97ba47df32233255fa35311e06c01bd9db18250bc12b3bc17a66f2f5.json`

Generation `1790946551829047`, 198,571 bytes; SHA-256 is the filename. One
create-only metadata receipt lives at the exact receipt path above. Downloaded
bytes reconstructed a replacement local store solely from the export; the
replacement reproduced aggregate
`06aad06827c9d4648390b2b3761c38d8498814534296cde7cdd4a593505e4014`
and next input
`5761e17184ee90ba0fffe256eebfd61069f2c116a96f4f245ddc8ead3c4f91d8`
with zero replay writes. Baseline context stayed immutable after correction.

Observed fixture counts: one informational-curiosity reply, zero accepted or
verified-delivered messages, zero evaluation/pilot agreements. The corrected
owner remains unknown, and the next question asks which evidence would change
the decision and who owns it. Original reply, classification correction and
business supersession hashes are retained. The actual source corpus remained
11 CRM rows, four capabilities, 32 facts and zero real native joins.
Paid analysis calls, provider jobs, sends and default-collection writes: zero.
Live agent consumption and real inbox outcomes remain unproven by this fixture.
