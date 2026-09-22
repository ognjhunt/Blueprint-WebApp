# Robot policy-evaluation results page — what robot teams want, and the gap analysis (2026-09-04)

Scope: the `internal_policy_canary` result page at `/app/results/<id>`
(`TaskEvaluationResultDetail.tsx` → `PolicyCanaryResultPortal.tsx` and its four
children). This is the buyer-facing surface for a head-to-head simulation
comparison of two robot manipulation policies (e.g. π0.5 DROID vs GR00T N1.7
DROID) on one captured scene.

This note records (1) what robotics teams actually want from an evaluation
report, drawn from how the field reports policy evals; (2) how our page
compared before this change; (3) the presentation cleanups shipped in this PR;
and (4) the genuinely **missing content that needs pipeline/backend data** — the
"if something is missing we'd like to know" ask.

Nothing here removes provenance or honesty. The goal was to make the same honest
evidence answer-first and legible, per the repo doctrine that raw capture and
physical outcomes outrank derived artifacts and that simulation never certifies
physical performance.

## 1. What robot teams want from an eval report (ranked)

1. **The comparative verdict, first, as an explicit delta.** Which policy won
   and by how much, as the largest element on the page. Peer reports lead with
   the head-to-head number (OpenVLA "+16.5% absolute"; GR00T N1 "45% vs 33.4%";
   π0 leads with a comparison bar chart).
2. **A paired difference test with a significance verdict.** Because both
   policies run the *same* cells, the correct statistic is a paired comparison
   (McNemar / exact sign test) with a plain "distinguishable / not distinguishable
   at this N" line — not two independent CIs read side by side.
3. **k/N with an honest, owned sample size.** Report success as k/N and state
   that N=10/policy on one scene is diagnostic-only (peer norm is ~50–300+ trials
   per condition).
4. **The task-success contract shipped *with* the result.** The immutable
   pass/fail criteria (inside-target + upright + valid support height + no
   drops/collisions, with thresholds). The criterion *is* the result; a success
   rate whose definition is undelivered is unauditable.
5. **A graded progress / partial-credit score, not binary-only.** Did a failure
   happen at grasp, transport, or placement? Binary hides near-misses.
6. **Comparison fairness / setup parity.** Same observation/action grounding,
   camera set (incl. wrist), control rate, prompt, and adaptation budget,
   configured to each vendor's spec — so a gap reads as capability, not a broken
   integration.
7. **Per-axis / per-variation breakdown with in-dist vs held-out split.**
8. **A named engine + per-policy model card.** Simulator + physics/contact model
   and its known limits; per policy the checkpoint identity, zero-shot vs
   fine-tuned, and inference stack.
9. **A sim-to-real validity basis, or an explicit "none established."** A bare
   sim rate proves nothing about the real robot; sim rankings can invert on
   hardware.
10. **Deep per-episode drill-down wired to the headline** (verdict → contrast
    cell → video + facts + timeline).
11. **Scorer validation against human ground truth** (agreement, false-success /
    false-failure rates) — substantiate confidence numbers rather than asserting
    them.
12. **Reference anchors** — a no-op/random floor and a scripted-oracle/teleop
    ceiling on the same scene, so "is 60% good?" is answerable.

Selected sources consulted: OpenVLA (arXiv 2406.09246), NVIDIA "How to evaluate
general-purpose robot policies for real-world deployment," RoboArena (arXiv
2506.18123), SIMPLER (arXiv 2405.05941), COLOSSEUM (arXiv 2402.08191), ManiSkill
(arXiv 2107.14483), LIBERO (arXiv 2306.03310), RoboMimic study, TRI "Statistical
Thinking for Robot Policy Evaluation," Physical Intelligence π0 / π0.6.

## 2. Two genuine strengths to preserve

- **Wilson 95% intervals were already computed** (`wilson95` in
  `policyCanaryResultPortal.ts`) — ahead of most vendor pages.
- **Per-episode failure classification + interpretable/uninterpretable flags**
  map directly to the field's concern about silent/false successes.

The dominant problems were ordering and language, not capability.

## 3. Presentation cleanups shipped in this PR (no new pipeline data)

> Superseded on 2026-09-22 by the simplification in section 5. The honesty
> content below still ships; section 5 records where each piece now lives.

- **Answer-first hero verdict** (`PolicyCanaryPrimarySummary.tsx`): leads with
  the comparative outcome ("GR00T N1.7 DROID led by 50 pp"), two `PolicyRankBar`
  comparison bars with each policy's k/N and Wilson interval, and the honest
  N=10 sample-size line. The scenario-count and record chips are demoted to a
  meta row; "No winner declared · diagnostic" is now a *qualifier* on the
  verdict, not a replacement for it.
- **Paired significance verdict** (`pairedCanaryComparison()` in
  `policyCanaryResultPortal.ts`): an exact two-sided sign test (McNemar's exact
  form) over the matched cells, surfaced in the hero and as a summary line above
  the metrics table ("not statistically distinguishable at this sample size —
  exact sign test p ≈ 0.06; matched cells 10; discordant split 5–0").
- **One "How to read this canary" block** (`PolicyCanaryResultPortal.tsx`)
  replaces the three-plus stacked warning banners: a two-column
  "establishes / does not establish" layout, the unlisted-link visibility line,
  a "what a qualifying run adds" line, and post-publication adjustments folded
  into one expandable note. The page-level banner is now non-canary only
  (`TaskEvaluationResultDetail.tsx`).
- **Success contract as an honest gate**: when the immutable contract is
  delivered it renders inline under the verdict; when absent, a single clear
  block states the numbers cannot yet serve as an acceptance test — instead of a
  quiet "not delivered" note among many.
- **Metrics table de-noised** (`PolicyCanaryReportOverview.tsx`): columns that
  are empty for every policy (progress, destination error, contact maintained)
  are dropped and named once in a coverage line, rather than rendering a wall of
  "Unavailable — not delivered." The observed leader is marked.
- **Evidence summarized before the dump** (`PolicyCanaryEvidenceInventory.tsx`):
  an integrity one-liner + a role-grouped summary (role → count → total size)
  precede the full digest table, which now lives one click deeper. Empty system
  telemetry (GPU/memory/latency) collapses to a single honest line instead of a
  dozen blank rows.
- **Sentence-case header**: "Head-to-head policy test — Scene … · simulation."

## 4. What is still MISSING — needs pipeline / backend data

These cannot be fixed by reordering the UI; they require the evaluation pipeline
to deliver new content. Ranked by buyer impact.

1. **The task-success contract** for delivered results. Today many results ship
   without it, and the page must flag that the numbers are not yet an acceptance
   test. Publishing should gate on the contract being present.
2. **A graded progress / partial-credit score** per episode and policy (a
   subgoal rubric: reached / grasped / lifted / transported / placed). The
   raw signals (object-moved, max-lift) exist; the score is not computed.
3. **Comparison-fairness / setup-parity fields** — observation & action
   grounding, camera set, control rate, prompt format, adaptation budget — plus
   the exact language instruction issued and confirmation of prompt-format
   parity.
4. **A per-policy model card** — checkpoint name/revision, zero-shot vs
   fine-tuned, inference precision/backend/decoder. Only the opaque
   `checkpoint_digest` exists today.
5. **Named simulator / physics / contact model + known fidelity limits.**
6. **Scorer validation vs human labels** — agreement rate and false-success /
   false-failure rates; calibration for the "independent interpretation"
   confidence numbers.
7. **Reference anchors** — random/no-op floor and scripted-oracle/teleop ceiling
   on the same scene.
8. **Sim-to-real correlation status** (paired real trials / MMRV, or an explicit
   "none established") and a per-policy inversion caveat.
9. **Deployment telemetry** — policy inference latency p50/p95/max, control
   rate, and a throughput proxy (successes/hour). On-thesis for a page
   positioned on deployment; currently "not captured."
10. **Multiple seeds per cell + reported variance.** The design is n=1/cell
    today, which cannot separate policy skill from initial-condition luck.
11. **Before/after impact + symmetry** for post-publication score corrections
    (what changed, per arm, and that both arms were treated identically).

The page now renders (2)–(11) as honest "not captured / not delivered" states
rather than blanks, and the UI is structured so each can be populated in place
as the pipeline delivers it.

## 5. 2026-09-22 simplification — bare page, same evidence

Owner feedback on a real run: far too much text, confusing even to the team.
The page had grown to ~1,200 visible words and ~6,200 px on desktop (~11,000 px
on a phone) before any drawer was opened, with the verdict, the paired
statistics, and the "no winner" boundary each stated three or more times.

The page now matches the rest of the workspace (plain type, `ws-*` styles) and
reads top to bottom as three things, ~250 visible words and ~2,200 px:

1. **Result.** One plain verdict as the heading ("Neither policy completed the
   task.", "π0.5 DROID succeeded more often.", "The policies tied."), a
   significance line only when one policy leads, a four-column table (Episodes /
   Scored / Completed per policy), a short list of the caveats that apply to this
   run, and the four primary downloads as links.
2. **Episodes.** One row per scenario with each policy's outcome
   (Completed / Failed / Not scored / Ambiguous). Selecting a row opens a
   side-by-side viewer: camera tabs, one line saying why each episode failed or
   was not scored, the on-demand video, and a closed "Details and files" drawer
   (measurements, AI review, episode id, files).
3. **Three closed drawers.** "How this was scored" (rules, paired sign test,
   Wilson intervals, criteria provenance), "Control runs" (only when control runs
   exist), and "Run details and all files" (run bindings, scene/task ids, exact
   result record, telemetry, full inventory, closure receipts, email retry).

Where each boundary now lives (nothing was dropped):

| Boundary | Now |
| --- | --- |
| Simulation only, no winner, not safety/deployment evidence | One line under the result table |
| Unscored episodes are not failures, and why they were not scored | Per-policy line under the table ("9 of 10 episodes weren't scored — the policy's actions couldn't be executed"); scorable-only counts |
| Control runs skipped, pending, or failed | One line under the table (the setup, not the policies, is unverified) |
| Success criteria missing or only a registry default | Line under the table / criteria provenance in "How this was scored" |
| Post-publication score correction applied or rejected | Line under the table |
| Unlisted-link visibility | Line under the table (unlisted results only) |
| Runtime variation not applied / not reported | Marked on the scenario row / one line under the scenario table |
| Duplicate records for a scenario | "Ambiguous" in the row; both records listed in the viewer; excluded from counts |
| Paired sign test and Wilson intervals | "How this was scored" |
| AI interpretation never changes the score | Episode details; a visible line only when it disagrees with the score |

Removed as duplication or noise: the "How to read this canary" block (every
point is one of the lines above), the separate metrics table (it repeated the
verdict and showed "Action delivery 100%" beside nine unexecuted episodes), the
four-filter variation matrix (ten rows need no filters), the nine-row failure
cohort table (seven rows read "None delivered"; the cohorts now drive the
one-line reasons), the always-open 14-row criteria panel, the delivery-stage
chips, the eyebrow, and the run id and JSON button in the header (both are in
"Run details and all files"). Two small fixes rode along: p-values below 0.01 no
longer print as "p ≈ 0.00", and candidate resolution no longer throws when a
compact delivery omits its episode list.


## 6. 2026-09-22 round 2 — every other kind of result

Results that are not head-to-head policy tests now use the same plain layout
(one visibility-and-simulation line, a counts list, one comparison table, one
closed drawer per episode, downloads, and a run-details drawer). The run
progress, run record, runs list, tasks, setup, and captures pages were
simplified in the same pass; see
[`workspace-simplification-2026-09-22.md`](workspace-simplification-2026-09-22.md).
