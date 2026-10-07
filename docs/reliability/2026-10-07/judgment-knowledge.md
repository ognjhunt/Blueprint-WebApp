# Judgment and knowledge reliability, 2026-10-07

Scope: authorized reliability closeout of partner intake and inspectable evidence. Base: `efd2e6858`. ADP relationship: partner admission/evidence review supporting Arm Decision Proof v1; no new backlog item or physical day-gate completion is asserted. All test/reference artifacts remain `development_only`.

## Fixed blocker

The footage task requires a timestamp for every visible observation, but its permissive output schema accepts `moments: []`. Two consumers previously promoted those claims: brief proposals became confirmable `observation` answers, and screening summaries admitted uncited contradictions. The brief projection also ignored `footage_status="unusable"`.

`server/utils/siteVideoObservationClaims.ts` now supplies the same projection to both consumers. Only usable/partially usable footage and a visible observation with a finite, nonnegative timestamp qualify. An invalid observation does not discard supported siblings. Timestamp zero is valid. The source object is unchanged; the schema still admits incomplete output so retained model evidence is available for diagnosis. This is a minimum evidence-reference requirement, not semantic verification of what appears at that time.

The fix does not change the requested task or the brief's summary. `mergeFootageIntoBrief` contributes gate proposals only; the operator still confirms or corrects them. Describing a dishwasher or moving its rack is not a demonstrated dish-loading cycle. A model's word choice cannot establish that equivalence.

The follow-up cycle check reproduced another unsupported fact: the schema accepts a claimed median/band with no cycles, incomplete cycles, reversed intervals or zero-length intervals, and the old summary copied that number into `measured_cycle_seconds`. The projection now computes its median from distinct finite positive complete intervals. Duplicate intervals count once; partial/invalid intervals contribute nothing; overlapping distinct intervals or unusable footage yield no measurement. The numeric band follows existing `cycleTime` option labels (under 30; 30 through 120; over 120 through 600; over 600 seconds). `varies` is a qualitative model claim and is not a derived median band. Original model numbers remain in the raw output. This arithmetic check does not prove that the modeled repetition is actually present, match a timestamp to video duration, infer human cycle time from a simulated episode, or retroactively repair stored summaries.

## Ownership map and limits

| Step | Canonical implementation | Authority and limits |
| --- | --- | --- |
| Description reading | `server/agents/tasks/site-task-brief-reading.ts`, `server/utils/siteTaskBriefReading.ts` | A quote must occur in the submitted description or the proposal is downgraded to an assumption. Quote existence does not prove semantic entailment or immunity to malicious source instructions. |
| Video reading | `server/agents/tasks/site-video-evidence.ts` | Video observables, time references and unknowns. No location, timeline, budget, readiness or physical performance may be inferred. No model was called in this closeout. |
| Brief confirmation | `server/utils/siteTaskBrief.ts` | Owner-confirmed gate answers and source-bound proposal history. Footage proposals do not rewrite the task summary. |
| Screening | `client/src/lib/gateTriage.ts` | Deterministic gate values; credible video contradictions can only lower a disposition to conversation, never grant readiness. |
| Coverage | `server/utils/captureCoverageReview.ts` | Coverage checks named requested views, readability, confidence, consent and source/brief binding. Coverage is not proof of a complete job cycle. |
| Scientific result | Pipeline; WebApp result consumers | README explicitly assigns scientific verdicts to Pipeline. WebApp cannot manufacture a winner from a score or certify physical performance. |
| Pilot recommendation | `server/routes/admin-robot-teams.ts` | Named operator route resolves an applied/engaged registry team and avoids replacing a booked recommendation. Current schema does not bind evaluation, budget-fit or pilot-willingness evidence IDs. Human-reviewed recommendation, not a measured automatic selection guarantee. |
| Public grounded Q&A | `server/retrieval/agentAsk.ts` | Curated answers/citations/actions, lexical ranking with optional embeddings. The new tests mock embeddings off. Ranking can select an imperfect snippet; answers are not live operational evidence. |
| Prior research | `server/research-learning/{prior-research,retrieval,consumer}.ts` | Hash-bound sources, explicit host scope, separate directory/detail grants, paged retrieval preserving unknown/nonmatching rows, untrusted-evidence label. No corpus completeness or capability incompatibility may be inferred from missing rows. |
| Hermes knowledge | `knowledge/AGENTS.md` | Support, not approval/rights/provenance/pricing/runtime authority. |

Existing research tests cover cross-scope detail denial, tampering, expired grants, query-bound cursors, privacy omissions, unknown confidence, and no-write consumers. The new public-Q&A adversarial query test checks that injected query instructions cannot add a fabricated capability, citation or action to the returned curated answers. These deterministic boundaries do not measure LLM prompt-injection resistance or semantic judgment quality. No new retrieval corpus, credentials, provider service or live mutation was introduced.

## Reference provenance

`judgment-reference-set.json` is a portable, source-hashed inventory. Six existing cup-evaluation MP4s were read locally and all six matched the SHA-256 and byte lengths recorded in `client/public/proof/cup-evaluation/provenance.json`. Their existing outcome labels are attributed to that manifest, not independently adjudicated here. The videos are recorded simulation, selected from three of ten conditions, not physical proof or an overall ranking.

In the follow-up, this lane visually inspected nine exact decoded frames per video, **54 frames total**, at indices 0, 8, 16, 24, 32, 40, 48, 56, 62. `ffprobe` reports 4 fps, 63 frames and 15.75 seconds, placing these at presentation times 0, 2, 4, 6, 8, 10, 12, 14 and 15.5 seconds. Each reference now carries provisional observations and unknowns. The 00 clips show the cup-shaped object tipped sideways in later samples; the 02/04 clips show differing object/gripper positions around the green marker. These visible differences do not adjudicate success thresholds, containment/collision, grasp stability or physical performance. This was sampled-frame inspection, not full-motion review. Source outcome labels were already known, so the observations are not blind or independent validation. Presentation timestamps in simulation do not establish human task cycle time.

Reproduce a contact sheet locally with the retained source bytes (substitute the reference's canonical MP4 path):

```bash
ffmpeg -v error -i INPUT.mp4 -vf 'select=eq(n\,0)+eq(n\,8)+eq(n\,16)+eq(n\,24)+eq(n\,32)+eq(n\,40)+eq(n\,48)+eq(n\,56)+eq(n\,62),scale=480:-1,tile=3x3' -frames:v 1 contact-sheet.jpg
```

Read it row by row, left to right. Original MP4 bytes in Blueprint-owned Git and the manifest's frame indices are canonical; derived contact sheets under `work/video-inspection/` are reproducible scratch artifacts. This reference set supports artifact integrity, evidence-class preservation and provisional visual development review, not site-screening accuracy.

The user's dishwasher reference is retained with its reported filename, size, SHA-256 and optional Library provenance ID. No supported Library tools were exposed to the coordinating agent and its local library-files directory was empty. This lane did not obtain or inspect the clip. The user's report of door/rack manipulation with dishes already present is attributed as reported context. It must not become an observed dish-loading label. The missing company-controlled canonical artifact location is recorded rather than treating Library as canonical storage.

Other fixture provenance manifests are explicitly synthetic/test-only references. No real customer, rights clearance, independent physical outcome, or new field example was invented.

## Holdout and release policy

There are **zero independently adjudicated real-site clips** and **no untouched labeled holdout** in this inventory. The new regression cases are synthetic controls developed after inspecting the bug, so their pass rate is software-contract evidence only. No accuracy, precision, recall, confidence calibration or deployment-readiness claim follows.

For a future authorized judgment evaluation: retain original bytes in existing company-controlled storage; hash and identify the source, task requested, capture conditions and rights scope; label only directly inspectable actions with time ranges and explicit unknowns; keep conflicting readings for adjudication. Split at site/capture-family level before tuning, freeze reviewer/task rubric and model/prompt/config hashes, and keep the holdout inaccessible to prompt/threshold selection. Report abstentions separately, including footage of an adjacent action rather than the requested task. A holdout used to fix a failure becomes development material and needs a fresh replacement for a final measurement. Provider evaluation remains separately authorized; this document starts no run and incurs no spend.

## Verification

- New judgment suite: 3 failures reproduced before repair; 5/5 after repair. Cases include missing timestamps, unusable footage, supported siblings, timestamp zero and partial visibility.
- Existing brief reading, video evidence, research-learning sources and research-learning consumer suites plus new judgment suite: **121/121 passed**.
- New public-Q&A evidence-boundary suite: **2/2 passed**, embedding provider mocked; no API call.
- Follow-up cycle suite: **5 failures reproduced before repair; 15/15 passed after**, including band boundaries, duplicated/overlapping repetitions and supported partial siblings. Cycle, timestamp, brief-reading, existing video and strengthened nonvacuous Q&A suites: **50/50 passed**.
- `npm run check`: passed (exit 0), including a fresh follow-up run after the cycle fix.
- `git diff --check`: passed.
- Required Graphify refresh passed (exit 0) in the follow-up using the coordinator's shared pinned interpreter, publishing root `graphify-out/`. The first attempt had staged the corpus but failed to install `graphifyy==0.9.79` through the sandbox proxy; shared provisioning resolved that dependency gap. The release coordinator still owns the final integrated refresh.

Recovery: restore this manifest, source contracts and relative artifact paths from Blueprint-owned Git and verify the stored SHA-256 values. User-video bytes remain an explicit gap. Raw model outputs remain the original records; this patch changes projections only. No paid inference, upload, send, production write or external outreach occurred in this lane.
