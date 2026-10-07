# Judgment and knowledge reliability, 2026-10-07

Scope: authorized reliability closeout of partner intake and inspectable evidence. Base: `efd2e6858`. ADP relationship: partner admission/evidence review supporting Arm Decision Proof v1; no new backlog item or physical day-gate completion is asserted. All test/reference artifacts remain `development_only`.

## Fixed blocker

The footage task requires a timestamp for every visible observation, but its permissive output schema accepts `moments: []`. Two consumers previously promoted those claims: brief proposals became confirmable `observation` answers, and screening summaries admitted uncited contradictions. The brief projection also ignored `footage_status="unusable"`.

`server/utils/siteVideoObservationClaims.ts` now supplies the same projection to both consumers. Only usable/partially usable footage and a visible observation with a finite, nonnegative timestamp qualify. An invalid observation does not discard supported siblings. Timestamp zero is valid. The source object is unchanged; the schema still admits incomplete output so retained model evidence is available for diagnosis. This is a minimum evidence-reference requirement, not semantic verification of what appears at that time.

The fix does not change the requested task or the brief's summary. `mergeFootageIntoBrief` contributes gate proposals only; the operator still confirms or corrects them. Describing a dishwasher or moving its rack is not a demonstrated dish-loading cycle. A model's word choice cannot establish that equivalence.

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

`judgment-reference-set.json` is a portable, source-hashed inventory. Six existing cup-evaluation MP4s were read locally and all six matched the SHA-256 and byte lengths recorded in `client/public/proof/cup-evaluation/provenance.json`. Their existing outcome labels are attributed to that manifest, not independently adjudicated here. The videos are recorded simulation, selected from three of ten conditions, not physical proof or an overall ranking. Semantic viewing was not performed by this lane. They can check artifact integrity/evidence-class preservation, not site-screening accuracy.

The user's dishwasher reference is retained with its reported filename, size, SHA-256 and optional Library provenance ID. No supported Library tools were exposed to the coordinating agent and its local library-files directory was empty. This lane did not obtain or inspect the clip. The user's report of door/rack manipulation with dishes already present is attributed as reported context. It must not become an observed dish-loading label. The missing company-controlled canonical artifact location is recorded rather than treating Library as canonical storage.

Other fixture provenance manifests are explicitly synthetic/test-only references. No real customer, rights clearance, independent physical outcome, or new field example was invented.

## Holdout and release policy

There are **zero independently adjudicated real-site clips** and **no untouched labeled holdout** in this inventory. The new regression cases are synthetic controls developed after inspecting the bug, so their pass rate is software-contract evidence only. No accuracy, precision, recall, confidence calibration or deployment-readiness claim follows.

For a future authorized judgment evaluation: retain original bytes in existing company-controlled storage; hash and identify the source, task requested, capture conditions and rights scope; label only directly inspectable actions with time ranges and explicit unknowns; keep conflicting readings for adjudication. Split at site/capture-family level before tuning, freeze reviewer/task rubric and model/prompt/config hashes, and keep the holdout inaccessible to prompt/threshold selection. Report abstentions separately, including footage of an adjacent action rather than the requested task. A holdout used to fix a failure becomes development material and needs a fresh replacement for a final measurement. Provider evaluation remains separately authorized; this document starts no run and incurs no spend.

## Verification

- New judgment suite: 3 failures reproduced before repair; 5/5 after repair. Cases include missing timestamps, unusable footage, supported siblings, timestamp zero and partial visibility.
- Existing brief reading, video evidence, research-learning sources and research-learning consumer suites plus new judgment suite: **121/121 passed**.
- New public-Q&A evidence-boundary suite: **2/2 passed**, embedding provider mocked; no API call.
- `npm run check`: passed (exit 0).
- `git diff --check`: passed.
- Required Graphify command staged its corpus but could not install pinned `graphifyy==0.9.79` through the sandbox proxy (connection denied). The release coordinator is provisioning the shared interpreter and owns the final integrated refresh.

Recovery: restore this manifest, source contracts and relative artifact paths from Blueprint-owned Git and verify the stored SHA-256 values. User-video bytes remain an explicit gap. Raw model outputs remain the original records; this patch changes projections only. No paid inference, upload, send, production write or external outreach occurred in this lane.
