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
