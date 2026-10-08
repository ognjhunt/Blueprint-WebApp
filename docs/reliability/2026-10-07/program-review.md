# Independent reliability review

Reviewer: separate non-author agent `independent_review`. This review inspects
the actual integrated source, minimized baseline evidence, executed receipts,
privacy/authorization effects and evidence accounting. It does not approve live
spending, assert provider truth, or substitute for required CI and deployment.

## Source slices approved

| Integrated commit | Scope | Independent evidence and limits |
| --- | --- | --- |
| `58b2a958` | Assessment source admission | Focused suites 152/152 passed. Isolated baseline validator reproduced 64/120 packet passes and 56 failures. These are 15 executable structural conditions, with seven failing baseline conditions; prose topics do not change validation. Candidate passes all 15. No executed semantic judgments or perception accuracy follows. |
| `92d58960` | Outbox uncertainty and recovery fairness | Corrected v2 replay 170/170 passed: 150 offline cases and 20 additional fake-storage/provider integration traces. Baseline 135/150 passed. Malformed acceptance stays unknown; rotating recovery avoids repeated delay behind held rows. This establishes bounded fake replay, not permanent starvation or live delivery. |
| `a4a74c1d`, `089890f6` | Scoped draft/retry identity and return UX | Independent focused replays passed; final author report 127/127. Independent intercepted-API browser replay passed 8/8. Original baseline's three minimized return cases failed. Unreadable bytes prevent silent replacement; account/provider scopes separate local state; fresh consent is unchecked. Seven days describes recovery eligibility, not automatic deletion. Orderly Chromium closure with explicit storageState transfer is not abrupt-crash disk proof. |
| `772623ab`, `1e9d1222` | Acknowledged upload part integrity | Independent 62/62 passed. Retained baseline 57/60 passed: three composition topologies showed identical total size but changed video bytes after a conflicting duplicate part. Create-only writes and generation-pinned equality preserve the first acknowledged bytes; identical retries succeed and conflicting retries receive actionable 409 recovery. Actual GCS execution and middleware authorization are separate gates. |
| `90f4a586` | Non-destructive deployed draft smoke | Exact script and retained baseline JSON/PNG hashes verified. Fresh anonymous browser blocks external and every non-GET/HEAD request; no submit, upload, account login or provider call. Before/after serving SHA was `1b8d810ec117b93fe52fd323be052ddafa7070db`; all four draft fields disappeared after reload. This is one observed production presentation failure, not a joined backend journey. |
| `3d2f9acc` (author `a955cab90fe8d85b6b6ad7cf5d163d8c878b3c76`) | Coverage notification recipient | Independent strict encrypted/legacy/withdrawn/unavailable-key replay 4/4 passed; baseline 2/4 passed, with encrypted object recipients producing unknown delivery. Existing decrypt helper unwraps only destination/greeting at enqueue, preserving canonical ciphertext and duplicate identity. Author focused checks 33/33 and typecheck passed. |

The changes introduce no migration, credential/service requirement, production
fault injection or raw footage in tracked artifacts. Runtime source preserves
existing access/consent boundaries. Company Git contains portable catalogs,
commands and sanitized decision records; private local traces remain ignored.

## Material review corrections

1. Judgment packet counts were inflated as semantic evidence: 120 topic/source
   packets collapse to 15 executable source conditions. The coordinator retains
   original receipts and explicitly corrects the denominator in
   `program-semantic-correction.json`. The 120 semantic-judgment target remains
   unmet. An invented claim inside a valid observed interval still passes this
   structural guard; semantic entailment remains a known limitation.
2. Queue catalog v1 included unused attempt parameters and exhausted worker
   branches that never reached their named faults. Author v2 substitutes reached
   fault boundaries and meaningful storage outcomes, preserves invalidated v1
   evidence, and reruns baseline/candidate without reducing family floors.
3. Local-draft copy implied deletion at expiry. Follow-up `089890f6` accurately
   describes recovery eligibility and explicit clear action; no deletion behavior
   is invented.
4. The multipart recorder may lack an original complete local file. Follow-up
   `1e9d1222` adds the existing support address/job-link fallback to conflict
   recovery without weakening byte integrity.
5. Joined UI021's first worker receipt contains an encrypted **object** as the
   coverage-shortfall email recipient. `captureCoverageReview.ts` casts raw
   encrypted contact data to a string shape. The permissive local sink marks it
   sent, while customer-recipient filtering excludes it. This is an actionable
   P2 notification failure; author `a955cab90fe8d85b6b6ad7cf5d163d8c878b3c76`
   repairs the boundary with independently passing strict regression evidence.
   Both joined sinks now reject invalid recipient types before receipt creation.
   Do not claim that notification as delivered from the old permissive receipt.
   An unavailable decryption key safely skips the notice and logs a warning;
  durable retry of that skipped notice remains a documented P2 limitation.

The replacement `program-semantic-variants.json` catalogs 120 meaningfully
different synthetic typed evidence states across 60 paired questions. Independent
expectation inspection found narrow supported claims unnecessarily forbidden
and an explicit fixture-motion contradiction incorrectly weakened by unrelated
owner testimony. Author label version `provisional.v2` records the correction,
adds explicit supported/contradicted/unknown annotations, and separates broader
forbidden capability/certification claims. Independent source/hash/paired-state
validation passes 120/120. Its 55 supported, 32 contradicted and 33 unknown
annotations describe invented packets: **zero semantic model judgments, zero
human truth labels, zero real videos added**, and no untouched holdout. They are
approved as provisional expectation design, not an accuracy result or another
120 cases to add to the obsolete topic-expanded inventory.

## Joined harness and readiness limits

The coordinator's latest source isolates actual Express handlers and Admin SDK
Firestore on loopback project `demo-blueprint-reliability`. Object storage,
models and notifications remain local fakes; authentication Admin is absent.
Source/catalog hashes, a condition-based v3 catalog, distinct fresh worker
processes and private retained runs make replay inspectable. Dedicated browser
tests remain outside the generic runner and have their own recorded command.

Diagnostic v6 executed three passing cases and cannot establish coverage-notice
delivery because its sink was permissive. Corrected scored v3 run
`journeys-20261008T045920118Z` executed **21/21**, with strict recipient sinks,
all top-level outbox entries sent, coverage notice addressed to the intended
synthetic customer, and status cross-checked against persisted records. UI006
joins upload/coverage/status; UI020 orderly native-profile browser shutdown
during a held object write; UI021 SIGKILL followed by same-job queued-link return
and fresh-worker/reentry. Independently inspected UI021 worker PIDs are 3178 and
3221; first worker records one simulated model call and three plaintext local
mail effects, reentry zero model/mail calls. No live provider call occurred.

The coordinator added the empty KMS configuration pin after v3 source freeze.
Independently removing only that line from each current harness exactly
reconstructs both frozen hashes; assertions were unchanged. The run process
used a whitelisted clean environment without inherited KMS configuration.
Runtime hashes match. Independently verified pre-pin snapshots now reconstruct
the exact frozen source hashes. Final pinned replay
`journeys-20261008T050521396Z` passes 21/21 with all current source fingerprints
matching (result hash `037753f56746422549b669c38874b2ade6f8035c30885624342bac3d16719410`).
Selected UI006/019/020/021 each pass three attempts including the full run;
the two four-case repeat receipts and hashes match `program-trace-index.json`,
with zero disagreement and zero extra independent cases. Earlier diagnostics,
failed runs and scope corrections remain retained. Joined harness commit
`01c463091434c2a3aa8332b6a702632f1643dc10` and replay guide `1389c51a` are
approved for this explicitly simulated/emulator layer; dedicated CI requires
ffmpeg before the eight intercepted frontend checks.

The coordinator additionally reproduced the actual UI006 failure before the
notification repair with strict sinks: recipient type `object` failed the
required plaintext assertion. Corrected catalog v3 retains that failure and
invalidates earlier permissive delivery evidence. Both test processes explicitly
disable inherited KMS configuration and use deterministic local encryption;
replay cannot select external KMS because of an inherited key-name setting.

Prior immediate SIGKILL automatic local draft recovery failed and remains a
retained diagnostic. UI020's revised orderly-shutdown expectation and separate
UI021 email recovery must be disclosed as a versioned scope correction. Native
browser cache durability after a crash remains unproven; durable backend work
survived that experiment.

These joined traces disable site-task-brief reading and emit only fake coverage
results. They can establish upload/coverage/status recovery, not final assessment
publication or semantic justification. Emulator execution does not prove real
Firebase indexes, authentication, storage rules or provider execution. A single
selected real-site video with zero current human reference labels cannot meet
the 12–24 source reference tier; provisional labels stay outside accuracy
denominators. Existing low-risk customer learning is not gated by this audit.

Verdict: listed source slices approved for normal protected release checks.
Joined workflow replay passes its bounded upload/coverage/status layer;
assessment usefulness, full reference tier, exact-head CI, merge and deployed
candidate behavior remain separate gates. No bounded-beta or full-program
completion claim is approved by this review snapshot.

## Overlapping PR940 discovery, release integration pending

Before release, the coordinator discovered an independently active integration
branch `origin/codex/reliability-integration-20261008`/PR940 and coordinated one
release owner. Read-only comparison identified additional affected-path controls:
cross-tab monotonic intake freeze/acknowledgement; current consent before queued
capture-notice dispatch; withdrawn derived review/status/workspace visibility;
production revoked/disabled token checks; and digest/state/attempt/terminal fencing
of asynchronous Pipeline forwarding responses. These protections require joined
integration review rather than two competing releases. Intake author owns the
scoped compatible cross-tab graft and reproducer.

Directly replacing overlapping files would discard this program's upload-part
integrity, malformed-provider outcome handling, encrypted-recipient boundary,
finite reference admission and scoped recovery protections. Preserve both tested
slices and rerun their minimized cases. Installed Firebase Admin SDK confirms
production revocation checks default off while its emulator forces them, making
the production-contract regression meaningful but distinct from live account
proof. PR940's additional suites and integrated diff have not yet been independently
executed by this reviewer; this snapshot does not approve that whole PR or a
release that omits newly identified material controls.

## Cross-tab follow-up review in progress

The compatible intake candidate uses shared Web Locks to freeze one complete
submission before dispatch and protects pending identity/body, monotonic receipt
state, selected video and consent. Independent helper checks pass 11/11; actual
two-tab baseline/candidate receipts remain the author's separate intercepted UI
layer. They cannot establish real backend deduplication.

A material candidate counterexample remains open: after another tab explicitly
clears a pending draft and installs a fresh identity, a late acknowledgement
rewrites the old private task and identity into local storage. Independent owned
fixture replay returns `lateAckAccepted=true`, `clearedIdentityPreserved=false`,
and `privateDraftResurrected=true`. Lock serialization alone does not fence stale
authority after a clear. Author must repair and retain the failing evidence before
this slice receives approval. Missing Web Locks or denied storage also now
blocks first-time intake; supported-browser scope is an explicit integration
decision, distinct from preserving an existing job recovery route.

The author corrected the clear finding with identity fencing for both pending
and fresh rows, captured operation authority before asynchronous headers, and
explicit refusal of retired freeze attempts. Independent identical helper replay
now returns `lateAckAccepted=false`, `clearedIdentityPreserved=true`,
`privateDraftResurrected=false`, `retiredFreezeRejected=true`; independent
helper/component checks pass 23/23. This was a reviewer-observed uncommitted
candidate failure, not an exact deployed baseline defect. The ignored diagnostic
receipt explicitly states the missing exact pre-correction snapshot limitation.
Final author commit, browser clear replay and catalog correction remain pending.

The integration owner explicitly bounded fresh creation to secure-context
Web Locks and available origin persistence, with no-dispatch supported-browser
and existing support-address guidance. This affects evaluated intake creation,
not existing private-link uploads or parallel customer conversations. Actual
Chrome execution and mobile emulation establish this tested scope; they do not
prove all Safari versions, private browsing or sudden-crash durability. Record
this capability scope correction before final replay, without lowering floors.

Independent receipt inspection confirms v2 full browser replay 12/12
(`89dc73425c87d4fc3da5061f46de0b0e3afe21a21a8ed1080c809dd231cbb8f6`)
and four supplemental cases repeated three additional times, 12/12
(`5f396cb72e12253eae5c457073cee9ae1ea4f4d3a0df11d4c30966f68650cae0`).
Each selected case therefore has four total attempts, zero disagreement and
no additional unique cases. Final create-reply barrier UI001/UI002 fail against
author-retained exact `46e6b2ef` runtime, 0/2
(`91c4120ee5ee59140bad438c77ae85c4b856332777e17be28e3ae3bb67aa9288`).
All catalog-declared final source hashes independently match. The supplemental
denominator correction is explicit: 13 to 16 offline cases and two to four
intercepted browser cases, original 90 unchanged. Source review has no remaining
material finding; exact committed identity and required checks remain pending.

Final cross-tab source commit
`d1033932f926ebcc8e873f2ccc6a07468af9634b` is approved. Independently verified
committed bytes equal all frozen source hashes, every listed receipt hash
matches, focused checks pass 133/133, and typecheck/Graphify receipts report
success. The three minimized original helper failures and two final browser
baseline failures remain retained. Clear-race finding is resolved with the
explicit pre-correction source-snapshot limitation preserved. Normal protected
release and exact combined PR940 review/CI/deployed behavior remain separate
gates; this approval does not certify assessment usefulness or beta readiness.

## Combined backend review at 2e5abb97a9618bc2ee8c3be640c1979ddca45737

Read-only comparison against reviewed root `8ccc99cc` confirms chunk integrity,
encrypted coverage-recipient handling and malformed-provider acceptance guards
are preserved. Current-consent checks run inside the final outbox dispatch
transaction; withdrawal suppresses retained derived status/workspace material;
production token validation checks revoked/disabled/deleted users; asynchronous
Pipeline responses are fenced by state, request digest/bytes, attempt and terminal
receipt. Fresh and retained video readings use identical timestamp admission,
and unsupported unknown/no-reason robot exclusions are rejected.

Independent isolated exact-head replay passes 11 suites and 312/312 checks
in 52.15 seconds, with no live providers or credentials. Receipt SHA256
`4d5c8e0ba56293bd14a20e19ef26a58e57248150e8fbb02d2d0a7b2519059952` is retained under ignored
`output/reliability-program/reviewer/pr940-focused.log`. These are checks, not
312 new journeys. The 640 queue seeds remain schedule variations. Auth checks
use an SDK-contract mock; opt-in emulator suites were not independently executed
by this reviewer and remain separate evidence.

The actual SDK scripted diagnostics deliberately retain six accepted unsupported
capability/specification/event/measurement outputs as partial semantic evidence.
A structural guard cannot establish citation entailment or video perception.
No assessment usefulness or beta readiness approval follows from this green run.

No material new finding remains in the reviewed backend diff at this head. Client
source is provisional: it currently substitutes the older draft implementation,
deletes unreadable/expired bytes, omits authoring scope, permits unlocked fallback,
and lacks the reviewed clear/response-status guards. The release owner is actively
integrating `d1033932` and crash-checkpoint changes; that final exact client head
must preserve the accepted protections and receive independent review before
release approval. This snapshot does not approve the full combined PR.

Fixture correction `6f7ef4b76110092046a5dc286719a8fa9865a947` is approved.
Independent replay uses exact `2e5abb97` backend plus only the committed queue
test/helper correction: 150/150 pass, all 30 provider variants reach the strict
fake sink exactly once, and every source hash matches the correction manifest.
Result SHA256 `9b3be3979de25dc1d5dd2d7cf48ff77333abb131aa68f8865a8e75ffda5da48f`
is retained under ignored reviewer output. Current capture-notice authority stays
unmocked. Prior 81/150 failures were missing current-request prerequisites, with
zero reached provider faults; they are preserved as integration diagnostics,
not counted as 69 customer defects. Definitions and unique-case counts stay
unchanged. No production source repair is included in this fixture correction.

Retained-packet offline replay tool is approved at script SHA256 `026d2b4bbebb747d966b0c8b09339dab2f2e81a30d95c93393efe21d66eb2d49`.
Independent exact authorized observable packet replay reproduces baseline
admission and candidate rejection `assessment_published_source_required`, using
baseline `1b8d810` and byte-attested `2e5abb97` candidate source. Raw packet
hash remains unchanged, committed candidate source matches its declared runtime,
and provider calls are zero. Independent receipt SHA256
`df103d7a09218f8a47ed8be1f4abbbc7784a6fc027aabb0a2ab4550099b92e03` is private.
Four malformed/alias negatives reject with static codes, no synthetic sensitive
sentinel disclosure, no report creation and unchanged input hashes.

The tool refuses input/output aliases, pre-existing output, writes outside
ignored program output and mismatched source identity/cwd. Raw content, IDs and
reasoning are neither copied into reports nor printed. This actual packet fails
candidate admission; do not normalize its label after the fact or call the
candidate assessment successful. Text-conditioned source discussion and
provisional frame references do not establish video perception or human truth.

Narrow assessment delta at `83aa791c1576c53d1a149beafaaf9a7d58ecfc7e`
is independently approved: four focused suites pass 159/159 checks. Its SDK
25-case report comprises 21 passed admission cases and four semantic partials,
receipt SHA256 `04660068f481b52c8069b703e8e54da539e0336d6ad15c2910d4e6ec1f42c02b`. Empty/inferred registry sources and empty knowledge no
longer support published claims; qualified published/self-reported/measured
controls and explicit estimates remain admitted. Wrong prose/value against an
otherwise qualified registry field still passes, as do corrected stale knowledge,
conflicting event claims and invented measured video values. Qualification of a
source does not establish claim-to-field mapping, entailment or video perception.
Client remains unchanged and provisional; no full-PR approval follows.

Correction to reviewer coordination: the 83-head queue test already seeds a
current request inline, although its helper is older. Missing-request cancellation
was therefore incorrectly predicted from inspecting only that helper. The
approved `6f7ef4b` correction adds explicit fault-reached assertions and consistent
source accounting; it does not supply a missing prerequisite in that 83 test.

## Final combined delta and device checkpoint review

Backend delta at `9de35ded4ba4da7865ac86605a8a6ade922f554f` is approved.
Independent isolated clean-environment replay passes five files and 169/169
checks, receipt SHA256
`9280dcd199b8cc9ad6380c795c71e3a3956e11ce77c67a6b20f984dd4da52968`.
Measured claims require admitted knowledge/registry records; video timing,
operator reports and explicit estimates retain their respective bases. The
prompt keeps free assessment independent of customer budget questions and
keeps internal provenance metadata outside customer-facing site facts. Coverage
production now passes portable task data instead of spreading executable Zod
schemas/functions; registry prompt construction and output validation remain.
The 30 scripted SDK diagnostics retain three semantic partials: stale knowledge,
conflicting statements and a wrong claim against a qualified registry field.
This is admission evidence, not video perception or assessment quality proof.

The device checkpoint at `8a4d35d` (four production files preserved at `9de35ded`)
uses native strict IndexedDB commits before intake dispatch, hydrates before
fresh identity creation, and scopes retirement across each account's authoring
modes. WebLocks, stale-body fences, acknowledgement monotonicity, active-account
guards, explicit clear and withdrawal protections remain. Native browser crash
and emulator journey receipts belong to their respective runner owners; helper
contract fakes do not prove native IndexedDB durability.

Independent exact `9de35ded` client replay passes seven files and 222/222 checks,
receipt SHA256
`03811f365e189b2075e95f9d96c190db441a2576b5a4c6960b7d7d7aa063abe4`.
This includes actual AuthProvider session wiring with explicit Firebase and
cleanup API mocks and the ported recovery helper/component layer with an
explicit durability contract fake. Neither this layer nor its passing result
exercises the malformed-canonical rejection below or proves native durability.

Review found one reproducible rejection gap in `writeSiteCaptureRecoveryDurably`:
an invalid pending body replaces valid local draft bytes before canonical
validation throws outside rollback. Exact `8a4d35d` source replay rejects the
write but leaves unreadable recovery, with no IndexedDB execution or dispatch.
Private minimized receipt is `reviewer/durable-malformed-before.json`; this is a
helper failure and does not establish customer data loss or native crash loss.
Validate-before-write or protected rollback is required before final client
approval. The `9de35ded` acknowledgement uses a mutable recovery pending value
to preserve the workspace-to-inbound fallback endpoint; an explicit successful
request body/endpoint snapshot is preferable. No reachable false acknowledgement
has been demonstrated from that line. Final exact-head client replay, required
CI, protected merge and deployed verification remain separate release gates.

Final source at `88476cb8bb367573e8cf5d1664721e9fac71b8d8` is approved.
Canonical validation now runs inside conditional rollback; the identical retained
probe rejects the invalid write while preserving exact prior bytes and readable
recovery. Its helper source SHA256 is
`45dbdfbdb0eb5df69711703d521b44796522b48ff9bf70ec870f77dcfed7ee62`,
and corrected receipt SHA256 is
`7fd6a762fa76ef6543d62e6e333b00a43b919acafeae6a17688309c716607e4e`.
An independent isolated native Chromium diagnostic executes the actual helpers,
WebLocks and IndexedDB and verifies both stores unchanged on rejection, receipt
SHA256 `586cb710f91b01d96aac91c9e4f8263af77c99e639828d4ac10890135f5eaff6`.
It executes no backend, provider or customer journey. The committed native
regression checks the same invariant. Seven exact-head client files pass 223/223,
receipt SHA256 `b5b198247a9173d6a1b70ab297150941ac1a77240120ddbf5dea7404e6ac84ba`.
Backend is unchanged from approved `9de35ded`. No demonstrated material source
finding remains; the explicit acknowledgement snapshot recommendation is tracked
P2, with no reproduced false acknowledgement. Required CI and final joined replay,
protected merge, deployment and post-deployment receipts remain owner gates.

Supplemental UI022 test/evidence commit `199df069dfe7a7887d7d501576233ac8de56de67`
is approved. All 70 source/receipt checks and 63 original-case comparisons match;
the original 21 conditions/hashes are unchanged and unattempted in these selected
runs. Three successful native SIGKILL/ordinary-form return attempts represent one
new unique journey. The source overlay is explicitly `9de35ded` UI plus `f659ce4b`
other runtime, and author restoration is clean. Manifest SHA256 is
`5691561d491248cf4f298fef56e862dcf746eea050495573854f9e06dd52773c`.
The initial Invalid Chai harness failure and zero-attempt setup diagnostic remain
retained. These are historical results; final `88476cb8` source requires its own
replay rather than relabeling earlier receipts. Firestore is an emulator, objects
and providers are simulated, and no live video-analysis quality follows.

The final checkpoint exposed two outdated intercepted-browser assertions: a
retired acknowledgement now fails before old-page success, and missing WebLocks
now blocks before form rendering. Prior 10-pass/two-failed traces are retained;
their downstream invariants were not reached. The proposed test-only port keeps
fresh identity/body/reload/explicit new Start assertions, adds both-store equality,
and keeps no-dispatch plus supported-browser and actual contact-link guidance.
It changes assertions to match the reviewed checkpoint contract, not case IDs,
meaningful conditions, unique denominators or safety thresholds.

An independent same-fields neighbor checked whether the stale old recovery
button could dispatch a fresh identity. It did not: only the original POST was
observed, no new success appeared, and both recovery stores stayed byte-identical.
Receipt SHA256 is `5a26d22e84f1b94adabcd594024fc24314d16addacad4963c50dd164d6600478`.
Actual Chromium/WebLocks/IndexedDB run against intercepted APIs; this diagnostic
has no durable backend and earns no scored unique journey credit. An initial
probe failed before the intended fault because it did not await asynchronous
clear; that partial harness diagnostic remains retained. The stale recovery
control and unconditional emailed-link suggestion for a fresh visitor are P2
clarity items. No silent new-intake defect was established by this probe.

**Reopened: INTAKE-HYDRATION-AUTOSAVE-001, P1, exact `88476cb8`.**
Affected client approval is withdrawn. The ported clear/reload case reached an
actual lost-draft boundary: restored DOM fields remain populated, but initial
autosave runs while `interactive=false` disables the enclosing fieldset.
FormData omits its controls, and autosave writes an empty draft to both stores.
The subsequent explicit Start body disagrees with that draft, so canonical
validation safely refuses dispatch. This violates draft survival and recovery;
it is not an obsolete assertion or a reason to weaken the new Start expectation.
The runtime owner is the combined release coordinator. A guarded autosave repair
and identical native failing/passing replay are required before client release.
Backend admission/privacy/dispatch guards and the canonical rollback repair
remain approved. Previously green unit, 300-case and joined journey layers did
not exercise this exact unsubmitted-draft reload and do not override this finding.

Independent ordinary one-tab native replay confirms the same P1 without a clear
race: all four fields were saved in both stores, then reload kept them displayed
while emptying both saved drafts under the same identity. Explicit Start was
refused before POST. Baseline receipt SHA256
`4bc9e942ae3fa55a444a9feda6dc11f4389ccef3db3622a7dc53341d416b2e4f`
and exact-source probe are retained under private reviewer output. The test-only
contract port `40eff62c6f01b7e92ca2b40a00d5c6fdd83fd537` is approved: all
11 source/receipt/count checks match, original cases/thresholds remain, author
restore is clean, and the final 003 baseline fails at stored-draft equality.
It makes no repaired-candidate claim.

UI022 pre-checkpoint comparison also preserves the same frozen condition: three
`8ccc99cc` client-source attempts fail automatic native crash return against the
same backend; three checkpoint attempts pass. The selected originals are
unattempted and repeats remain one condition. Old source hashes, create/upload
and fresh-return transitions and final candidate restoration were independently
checked. This reinforces a scoped crash-recovery repair, with emulator/fake
provider limits; it does not resolve the separately reopened plain-draft P1.

**Resolved: INTAKE-HYDRATION-AUTOSAVE-001 at
`8baba7d231c09fe5302af9016e60b75f287bee8d`.** Client source approval is restored.
The only production changes skip draft autosave while noninteractive and rerun
that effect when interaction becomes available. Existing identity, consent,
checkpoint and active-account fences remain; backend bytes are unchanged.
Eight exact-head client files independently pass 232/232 checks, receipt SHA256
`7cddf3cea7063b39920ec716b1b61db34fe7d892f76b2f0d191f12f64b8e96c8`.
Presentation tests explicitly use contract fakes; static prerender tests require
loading/no editable form/no intake requests plus an actual support route.

The identical outcome observer was frozen and replayed on `88476cb8` before
candidate execution. It records either refusal or success instead of awaiting
the old bug's alert; original alert-specific probe and baseline are retained.
This is an explicit observer correction with unchanged inputs/actions and
acceptance: all four fields survive both stores, identity remains, and exactly
one explicit Start succeeds. Observer SHA256 is
`71941ffa2d19c66af080312acb735fae10bc3a6e4392f7c9e1934711b89f3655`.
Baseline receipt `574161eb07126336bd49580de122b1e3df14611c21bfccd2bed8a957ddafca19`
loses both drafts and refuses Start; candidate
`d264f53777492b39b5cab9959b0c9a36263fe97d39cee20bdf9c873f2e77fc2f`
retains both drafts and sends one successful request under the same identity.
This native Chromium/WebLocks/IndexedDB proof uses intercepted APIs and establishes
no durable backend/provider result. Final joined replay, required CI, merge,
deployment and post-deployment verification remain distinct owner gates.

The independent native ordinary-reload candidate was executed three times;
all three retain both drafts, preserve identity and send exactly one successful
request, with no disagreement. Private repeat summary SHA256 is
`77e4a2606519a667e5a56f878248dcebffc31d6c2af7a287b5e0e8f9a5ba3982`.
Identical observable outcome hashes are expected; repetitions are executions,
not new independent cases or model-quality samples. No paid providers ran.
The earlier test-only provenance followup `9e0e5a8d` is also approved: each
diagnostic's declared source fingerprint matches its native trace's embedded
test source, preserving the v1/v2 correction history without relabeling runs.

Final intercepted-browser receipt commit `5faa6870` is approved. All 42 checked
JSON/trace/test-source/client fingerprint relations match and the author's
production overlay is restored clean. Exact `8baba7d` passes the frozen original
12 cases plus four selected repeat attempts: 16/16, selected 003/004 three times
each, zero new unique cases. Manifest SHA256 is
`73c7756b4a577eec7353d909b5ff2f7e619e7f9c3fd15b9d51d76f1bb59fb8d5`.
The unchanged test definition is `2602ab64...`; all earlier 884 failed/partial
receipts remain. This establishes repaired browser/checkpoint behavior with
intercepted APIs and does not replace final real-handler/emulator execution,
provider receipts, required CI, deployed checks or assessment-quality evaluation.


**Scoped release independently verified at `d8988ab3f8bcfa16527d0a77ba168f1cde19f63c`; assessment evaluation remains partial.**
The reviewer independently reread PR940 merge metadata and both completed GitHub
runs: main CI `37738528838` and deployment `37739286731` are successful at that
exact SHA. Direct read-only Render deployment queries confirm web
`dep-db3jnn2j9qps73fupnrg` and worker `dep-db3jnnegekts73f31qqg` are live at d898,
with the documented finish timestamps. The previously approved `8baba7d` source
tree is identical to merged d898 under client/src, server, scripts and package
manifests; the coordinator checkout differs only in replay/test tooling.

The protected production smoke receipt independently hashes to
`89ca675c9e3198fe4721f237dd7f74de0fc9742c4cb258eeb996f0d07dac5417`; its PNG hashes to
`6a59b9bbd4aef3cb9f898c7a217c0e0add22bbe0ea848c85539dc07df88a9294` and executed
script remains `306b01bc00db0c0f4f383b68bc16c62d08010428919c0829611d1cd3e656803b`.
The retained observation at 06:48:57–06:48:59 UTC verifies matching serving identity
before/after, health/readiness 200, all four synthetic local draft fields restored
on ordinary reload, country retained and recording consent unchecked. Its fresh
context blocks all non-GET/HEAD and external requests, records zero attempted
intake mutations and never submits/uploads/sends. This supports deployed identity
and ordinary local draft recovery, not a production backend job, worker outcome,
assessment publication, privacy fault injection or delivery proof. Individual
repair claims still depend on their separately retained offline/native replays.

The static portability audit hashes to
`2fbc657ed7df0c1538406e20bd470739d4d07f31261359f9e8e1e9bf3e81b6aa` and reports zero
explicit-reference findings. Its stated limitation is preserved: it verifies no
remote artifact access, completeness of migration or recoverability of all data.
The stale ledger description of 1b8 as current production was corrected to
historical baseline. No runtime or release changes were made by this reviewer.

Assessment-source admission fixes being deployed does not resolve semantic truth.
The exact-main scripted SDK trace still admits three synthetic false claims: an
explicitly noncurrent specification presented as current, a completed video event
absent from the supplied observation, and 50 m reach attributed to a qualified
registry field holding 1 m. Ledger IDs `ASSESS-STALE-APPLICABILITY-001`,
`ASSESS-VIDEO-ENTAILMENT-001` and `ASSESS-FIELD-ENTAILMENT-001` preserve these as P1
defects for the affected internal advisory path. They are not measured live-model
incidence or demonstrated customer publication. Any narrow follow-up guard needs
its own exact diff/reproducer/retest review. The current joined customer path
remains unproven; the reference-source and human-label shortfalls remain explicit.
There is no independent approval for assessment-quality beta, broad end-to-end
beta or full-goal completion. Existing authorized customer conversations remain
independent of these specific evidence limits.


**Scoped source approval: `e048c74e7eeaf44996ce17a0e24b48d8d985104d` over deployed d898.**
The three-file stale-applicability repair adds one narrow admission rule: a known
published claim cannot cite a knowledge record explicitly marked boolean
`current:false`. The actual SDK returns the same source wrapper that this guard
checks. Unknown and estimated historical context remains usable; source/claim
bytes remain untouched. Current/missing/string-valued applicability, independent
current siblings and older timestamps receive no invented age cutoff or coercion.
The diff changes no authentication, provider dispatch, storage contract, budget,
notification or private-video exposure. No material independent finding remains
for this scope.

Independent exact-function extraction from both Git revisions reproduces the
same seven meaningful controls: deployed d898 admits the unsupported known claim
(6/7); e048 rejects it with `assessment_known_published_source_not_current` and
passes 7/7. All originals remain unchanged. Baseline source SHA256 is
`67a51a0d7a2164464d07fe983522857c180eaf8caa6539d824eaf47a91a8d1c4`; candidate is
`a889137a97af596aeeb4f90a320993bb7765e4bf43b8a03af232ea3460edcfba`. Minimized
private receipt SHA256 is
`362f00e6856245059451c9aa5c5e5f4687930ffcec9dd4f711d7210f6a6dae71`.

The independent candidate five-file replay passes 176/176 checks, receipt SHA256
`1bd93ef84e3b076e98a43e69f27423692b4aaf47b640446d38b27e1989c12624`. Its actual
SDK Runner result receipt is
`74111bf5a38c0390a91e1ee51a3e21590fbb41a385302aca3acaf60f790245c9`: 28 admission
conditions pass and two semantic counterexamples remain partial/admitted. All
30 IDs, semantic hashes, returned source/tool receipts and scripted provider
outputs exactly match the retained baseline. The V9 expectation correction is
explicit; it changes one admission expectation without changing its input,
counting a new case or relabeling the original baseline. These are isolated
scripted callbacks, not paid model/video perception or customer publication.

`ASSESS-STALE-APPLICABILITY-001` is code-repaired for this explicit known/published
knowledge boundary, pending its own protected merge/deployment verification.
`ASSESS-VIDEO-ENTAILMENT-001` and `ASSESS-FIELD-ENTAILMENT-001` still admit false
claims and remain consequential internal-advisory quality defects. The rule
does not validate sentences, all other claim locations/bases, current-spec
completeness or measured robot suitability. Full assessment/beta readiness and
joined customer qualification/publication remain unapproved. Reviewer production
trees remain clean; no runtime source was edited for this review.


**Scoped Pipeline source approval: `a25bddbe20c32bebfe77a97c640ea500097979e4`
over `4cb97edeb5fabcac30a14a4576a896a6a22941a3` (PR2648).**
The two runtime files repair the producer/consumer mismatch for ADP-030/day28
scene preparation. The compiler already fixes purpose to scene_preparation,
selects no policies and retains a development_only claim ceiling. Unknown and
explicit owner targets now permit this geometry path while their exact values
and unverified translation remain canonical. Native staging preserves original
context bytes, stores the targets in the task template and carries the same
metadata in its existing owner authority. Supplied targets receive recognized
`proposal_only`, never invented confirmation of fixed development controls.
Legacy omission retains its historical behavior; it does not prove a current
normal-UI journey. Existing access, consent, spend, source-binding and separate
team evaluation authority checks are unchanged. No material source finding
remains for this narrow boundary.

Independent disposable snapshots verify all 2,187 src files byte-identical to
each claimed Git revision. Only the three exact candidate test files were
transplanted into the baseline snapshot. The same four unknown/explicit compiler
and staging assertions fail 4/4 there, solely at the prior translation veto,
before downstream assertions can execute. Candidate focused checks pass 16/16
including legacy omission and scene-only no-controls/no-policy neighbors.
Independent baseline log SHA256 is
`8a7337aa686e68f42044ecb7bfbddcbf96b668382e39acbd75cb8d609c87ccdb`; candidate log is
`5e3268e9f7581df15c0f8ce6e14634278aa6b6b822660be868aca00b293d43b1`. All 14 author
manifest source/log hash relationships match its retained manifest
`2cd25fab12d53e9b3d5646c64bf1843075a69579d3e7068eed492cca543f1804`. The author's
108 neighboring passes are retained author execution, not independently rerun
108 samples.

Four additional independent transport controls pass, preserving the actual
staged targets through the existing rigid and articulated native adapters.
The real rigid success-contract seal rejects proposal_only authority. Although
the native episode compiler deliberately skips that rigid helper for articulated
tasks, the existing `confirmed_articulated_contract` consumer separately rejects
the staged articulated proposal with
`scene_control_omission_articulated_owner_contract_unconfirmed`; policy-run/canary
validators also require a confirmed success contract. No generalized new gate
or execution mode was added. These are actual CPU module consumers with owned
synthetic geometry and fixture qualification records, not executed GPU policies
or proof that every performance route has run.

The first reviewer transport diagnostic retained two failures because its
borrowed rigid fixture omitted the contract-required flag that the real staged
website success record supplies. The corrected diagnostic carries that actual
staged flag into both matching immutable fixture records and retains the initial
receipt; those failures are a harness limitation, not demonstrated product bugs.
The extra controls/repeats receive no new frozen catalog or journey credit.
Private reviewer manifest under output/reliability-program/reviewer/pipeline-owner-target
is SHA256 `2a83f4b619fdcab9a8ddb92dbfe589905aae3e06d86c69af0c41b75e7d9e89fa`;
final consumer log is `90dd003715126404fa731591918637f7d72de354c56ca3b97a8d0409ac884814`.
No provider calls, spending, customer data or shared QA mutations occurred.
Required PR checks, exact-main promotion, protected deployment and the actual
joined customer outcome remain separate unverified owner gates for this commit.

**WebApp follow-up release observation:** reviewed e048 production bytes match
merged PR941 SHA `eda83741bd06026f9ad4e9e8fa16417bdc1d432c`. Independent GitHub
reads confirm merge and successful completed main CI37741000664/deploy37741434386
at eda. Direct Render reads confirm both listed follow-up receipts live at eda.
The protected ordinary-draft-only smoke hashes to
`c2b2aee36f4c2ae0fbf3cc1c8ea154374d4aaef1a95fdbac2f71845b90107847` and retains
its identity/health/local-draft ceiling and zero intake dispatch. Earlier d898
receipts are historical. This release establishes deployed narrow stale-source
admission code and scoped draft behavior; two admitted synthetic entailment
defects and joined assessment-publication/reference-quality shortfalls remain.


**Reopened: omitted/null owner-target authority at `a25bddbe`; affected source
release approval withdrawn.** A separate cloud reviewer traced the actual staged
website task/success/execution records through the native adapter with the real
producer contract-required flag. When owner targets are absent, the a25 conditional
still marks fixed development controls confirmed; the real rigid seal returns a
confirmed/task_owner contract. Read-only PR2648 comments 6054895177/6054949521
record the minimized lineage and preserve its initial zero-thickness support
fixture refusal separately from the corrected synthetic support prerequisite.
This is a consequential false authority counterexample in isolated source
execution, not evidence of completed native/customer performance or incidence.

The earlier a25 approval proved supplied unknown/explicit targets and their
proposal-only consumer refusals, while treating omitted criteria as historical
compatibility. That assumption cannot justify a claim of owner confirmation.
Those scoped passing observations remain valid; they do not override this newly
executed omitted-target defect. The smallest correction is to make website
fixed-control authority proposal_only for omitted/null as well as supplied
targets, retain all originals and preserve genuinely separately confirmed
contracts. Exact new diff and unchanged-lineage replay are required before
release approval is restored. Geometry preparation may remain eligible; no
provider, disclosure, spending or new execution-mode authority follows.
