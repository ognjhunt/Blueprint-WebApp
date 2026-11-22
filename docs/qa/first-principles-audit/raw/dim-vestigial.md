# Vestigial code and what it costs (agent `dim-vestigial`)

Audit date 2026-11-22. WebApp at `0ee5df6` (the live site; HEAD `b3b5e9b2` adds only audit files).
Pipeline at HEAD `7d8b532`; the control plane runs `cbff06b`.
Findings are in `dim-vestigial.findings.json` (ids `V-01` to `V-20`, validator OK).
The full ordered delete list, one section per candidate, is in `delete-candidates.md`.

Nothing here read a site's video, frames, name, address, contact details or job sentence.
Production numbers are document counts, states and dates from the orchestrator's baseline
(`scratchpad/baseline/firestore-*.json`). Host numbers come from door read subcommands (`journal`, saved `status`, `units`, `usage`).
Scratch scripts and raw outputs: `/tmp/claude-0/-home-user/e3989091-e008-5b78-a9cb-b7c31a5efdb8/scratchpad/agents/dim-vestigial/`
(`cut.py`, `famcommits.py`, `rates.py`, `deadtests.py`, `docpaths.py`, `staledocs.py`, `jobmin.py`, `journal-*.txt`, `runs-*.json`).

## 0. The short version

- **One collector wastes about 4% of the host.** The remote episode-compilation unit runs every 74 s,
  spends 12 CPU-seconds and collects zero rows, about 1,180 times a day (V-01). The owner deleted that lane.
- **An unused gate can roll back any WebApp deploy.** `/health/ready` requires beta cohort settings.
  The cohort gate those settings feed is called by nothing (V-02).
- **The trial cannot be deleted by name.** 17 of its 59 live import edges are generic B2 and output
  helpers the simulation build needs, sitting under trial names. Section 3 gives the exact seven-PR cut order (V-03).
- **Two chains have zero production records.** The job-evidence panel leads to the staff captures page
  (`/app/captures`), the capture-upload routes and reconstruction forwarding: about 5,500 lines (V-05).
  Two worker lanes poll queues no live code fills (V-04).
- **Retired data is kept.** Over 8,000 Firestore records of retired systems remain (V-08).
  The email webhook keeps every recipient address under "growth campaigns", a retired system (V-07, privacy).
- **The prize** (section 6): about **80,700 Pipeline lines in 181 modules** (11% of the package) and **21,000 WebApp source lines**.
  Also: about **160 test files**, **16 shipped unit files** plus **229 host-only units**, **about 4 CPU-hours a day** and **67 GiB** of disk.
  Packages: **4 WebApp packages**, **1 Pipeline base dependency** and **3 Pipeline dependency groups**.

## 1. How each "dead" claim was checked

Two checks per claim, as the task asks:

1. **Import graph.** For the Pipeline I reused the inventory's `graph.py`, `reach.json` and `testonly.json`
   (AST, every import including those inside functions, plus exact-module-name strings).
   For the WebApp I reused `reach_rt.mjs` and `dead_runtime.json` (runtime imports from `main.tsx`, `server/index.ts`, `server/worker.ts`).
2. **Dynamic use.** I searched each candidate's module path, file name and quoted leaf name.
   Pipeline places: `src`, `scripts`, `deploy`, `functions`, `tools`, `pyproject.toml`, `.github`, `main.py`.
   WebApp places: `client/src`, `server`, `scripts`, `shared`, `vite.config.ts`, `package.json`, `firestore.rules`, `render.yaml`, `.github`.
   For routes I searched the path. For units I read the journal.

| Claim | Graph | Dynamic search | Production evidence |
|---|---|---|---|
| 54 Pipeline modules imported only by tests or nothing (V-11) | yes (`testonly.json`) | yes: 4 have real dynamic use and stay (`_sam_parser_js`, `config.isaacsim_nurec_601.rendering_setup`, `pytest_full_lane_evidence`, `qualification_control_admission`, 559 lines) | n/a |
| 36 WebApp runtime-dead files (V-12) | yes (`dead_runtime.json`) | yes: 6 have no reference at all; 30 are referenced only by type imports, other dead files, hand scripts or protected texts | n/a |
| Experiments framework has no caller (V-06) | yes (no importer of `resolveExperimentVariant`) | yes (route path only fetched inside that function) | `experiment_rollouts` 2 docs |
| Beta cohort gate unused (V-02) | yes | yes (only its own file and test) | `betaCohortAdmissions` 41, none dated |
| Launch-forward and job-evidence lanes idle (V-04) | yes (writers reached only from routes whose Pipeline callers are not live) | yes (route paths in Pipeline: only `submit_*_via_webapp.py`) | no `forward_pending`/`forward_blocked` launch; `jobEvidenceRequests` 0 |
| Job-evidence and captures chain (V-05) | yes | yes (`/app/captures` linked only from `JobWorkflowPanel.tsx:142`) | `jobEvidenceRequests` 0, `jobEvidencePublications` 0, `captureUploadSessions` 32 undated + 2 from October |
| Remote episode compilation idle (V-01) | n/a | unit file and deploy lists | journal: rows 0 on every run |
| Rigid probe idle (V-14) | yes (on the website closure, so not dead by graph) | unit file | journal output `[]`; stall check `pending: 0` |
| Unused dependencies (V-09) | import grep per package | string search (found `framer-motion` only in `vite.config.ts:59`, `node-fetch` only in test fixtures) | n/a |
| Trial edges (V-03) | yes (`boundary.json`, `cut.py` names each imported symbol) | supervisor worker list and units were rooted explicitly by the inventory | n/a |

Claims checked only one way are marked in the findings (`verified` stays `yes` only where evidence is direct).

## 2. Candidates at a glance

Ordered by prize against risk. Details, dependents and the safe removal order are in `delete-candidates.md`.

| # | Candidate | Repo | Why it can go | Cost today (measured) | Risk | Finding |
|---|---|---|---|---|---|---|
| 1 | Remote and host episode compilation | P | robot-team lanes deleted by owner (2026-11-12 frame) | about 1,180 runs a day x 12.1 CPU-s = 14,200 CPU-s/day; 17 modules, 17,152 lines; 7 test files; 17 commits in 30 days | low | V-01 |
| 2 | Beta cohort gate and readiness check | W | invite-cohort beta gone; gate never called | can fail `/health/ready`, which rolls back the deploy; 301 lines, 7 env names | low | V-02 |
| 3 | Host-only units (206 failed transient, 22 hold-expiry, 1 canary watchdog) | host | one-off experiments 2026-09/10 | 207 red lines in status; hides the one real failure | none (owner door request) | V-13 |
| 4 | Retired-lane disk | host | lanes retired | at least 67.5 GiB; disk gates stopped the real job twice (C-12) | privacy for screening attempts | V-17 |
| 5 | Shipped units for idle lanes (rigid probe, team-scene remote, terminal release, preflight, host episode compilation) | P | lanes paused; preflight "not a health signal" | rigid probe about 250 runs/day x 1.7 CPU-s; team-scene remote about 1,440 skipped starts/day; preflight 48 runs/day x 6.7 CPU-s | low | V-14 |
| 6 | Experiments framework | W | growth experiments retired | 209 lines, 1 public route | none | V-06 |
| 7 | Growth-campaign storage in the email webhook | W | growth campaigns retired | 403 stored events with recipient addresses | privacy (good direction) | V-07 |
| 8 | 54 test-only and unimported Pipeline modules (minus 4) | P | nobody | 50 modules, 20,765 lines; their tests run nightly | low | V-11 |
| 9 | 36 runtime-dead WebApp files | W | nobody | 8,967 lines | low; 2 protected references | V-12 |
| 10 | Unused dependencies | both | nobody | 4 WebApp packages; `json-numpy` on every host; 2 heavy extras in CI | low | V-09 |
| 11 | Retired console scripts | P | RunPod, Lambda, G1, trial | 9 of 49 scripts; about 10,000 lines behind them | low | V-10 |
| 12 | Job-evidence panel, `/app/captures`, capture-upload routes | W | capture-app era; no production record | about 5,500 lines, 13 test files (4,524 lines), 18+3 routes | medium (internal test jobs may use owned Atlas) | V-05 |
| 13 | Launch-forward and job-evidence worker lanes, submission routes | W+P | robot-team line left 2026-11-14 (#1300) | about 2,900 lines, 3 routes, 12 env names | low-medium | V-04 |
| 14 | Retired Firestore data | W | retired systems | 8,000+ docs; `agentRuns` may hold job text | owner decision | V-08 |
| 15 | Early trial, Pipeline (seven PRs) | P | trial dropped 2026-11-14 | 55 modules, 17,535 lines; 27 commits in 30 days; 34 test files; `config/trial` 124 KB | medium-high (T6 touches the paid launch path) | V-03 |
| 16 | Early trial, WebApp remains | W | same | about 7,250 lines in 16 files, 37 test files (about 6,400 lines); 56 of 338 WebApp commits in 30 days touched trial-named files | medium | V-03, V-04 |
| 17 | G1 / native humanoid lanes | P | paused 2026-11-12 | 35 modules, 14,261 lines; 16 live importers; 12 commits in 30 days; 90 test imports | medium (withdrawal reader) | V-10, V-17 |
| 18 | Rigid robot-free probe code | P | queues nothing for website jobs | 12 modules, 4,403 lines; 18 commits in 30 days; $1 spend line | medium (withdrawal reader) | V-14 |
| 19 | Astra CAD authoring | P | owner question | 13 modules, 5,268 lines; 19 live importers; dependency group of 8 | owner | owner question |
| 20 | RunPod and Lambda | P | RunPod retired 2026-11-05; Lambda unused | 5 modules, 5,248 lines; spend guard failing 4,844 times (IP-02, D-01) | money: owner closes account first | V-10 |
| 21 | Stale docs | both | nobody | about 250 missing names in docs agents trust | low | V-15 |
| 22 | Legal versions in app source | W | legal record | 14 files, 3,593 lines | owner, rights | V-18 |
| 23 | Duplicate and unrun Playwright configs | W | nobody | 4 configs, 685 spec lines | low | V-20 |

Not candidates, kept on purpose (named source):
- `screening_retained_ledger` and `website_capture_withdrawal_screening`: money accounting and withdrawal (AGENTS.md).
- `website_capture_withdrawal_native_g1`, `_team_scene`, `_rigid_probe`: withdrawal (privacy), until each lane holds no site data.
- `retiredCapturerRoutes.ts` (410 answers).
- The scene-intake lane and the launch receipt route (A93), which the Pipeline posts to.

## 3. The Pipeline early-trial cut order (loose end settled)

Source: `boundary.json` (inventory) refined by `cut.py`, which reads each edge's `from ... import` line and symbols.
59 edges from 41 live modules into 22 trial modules. They fall into seven groups. Do them in this order.
The early PRs change no behaviour; the late ones do.

**T1. Move generic helpers out of trial names (17 edges, no behaviour change).**
- `wam_provider_object_store` (1,994 lines) is the B2/S3 bundle staging that scene configuration uses.
  It has 9 importers: `task_evaluation_scene_configuration_vast.py:138`, `_warm_diagnostic.py:72`, `_warm_transport.py:19`, `provider_output_promotion.py:133`,
  `native_task_arena_paired_witness_staging.py:128,180`, `native_task_arena_warm_vast.py:52`, `adp_content_agents_vast.py:74`, `adp_gaussian_excision_vast.py:46`, `adp_isaac_lab_arena_vast.py:49`.
  Rename it `provider_object_store`. Keep the console script `blueprint-stage-wam-provider-object-store` as an alias for one release (GPU bundle scripts may call it).
- `wam_async_runner_common.download_url_to_file`: 1 importer, `provider_output_disk_capacity.py:10`. Move the function.
- `wam_provider_output`: 3 importers (`vast_provider_adapter.py:164`, `provider_output_remote_collection.py:73`, `adp_isaac_lab_arena_vast.py:338`). Rename it `provider_output_inspection`.
- `policy_canary_output_members`: 4 importers (`arena_provider_output_streaming.py:62`, `provider_output_member_view.py:87`, `adp_isaac_lab_arena_vast.py:524`, `task_evaluation_result_delivery.py:41`). Rename it `provider_output_members`.

**T2. Inline constants (10 edges).**
- `droid_policy_canary_embodiment`: 5 importers. They take ids and joint constants (`website_robot_fit.py:99`, `task_evaluation_embodiment_registry.py:59`, `task_evaluation_result_delivery.py:40`, `team_candidate_quick10_registry.py:50`, `native_task_camera_start_configuration.py:618`).
- `task_evaluation_control_stage_policy` (12 lines): 3 importers.
- `task_evaluation_policy_candidate_registry`: action and observation constants for `task_evaluation_embodiment_registry.py:65`, and registries for `job_capability_routing.py:22`.

**T3. Delete gates no website intent needs (11 edges).**
- `task_evaluation_scene_policy_capability`. In `task_evaluation_scene_progression.py:725` it returns `[]` for every `scene_preparation` intent with `policy_candidates == []` (`task_evaluation_scene_policy_capability.py:66-72`). The WebApp sends only such intents (`server/utils/taskEvaluationSceneIntake.ts:730,738`). Also imported by `team_run_context` and `team_run_controller`.
- `task_evaluation_scene_policy_binding`: 5 importers.
- `task_evaluation_policy_canary_result`: 3 importers (`task_evaluation_run_webapp_sync.py:31`, `task_evaluation_scene_terminal_reconciler.py:47`, `..._terminal_result_index.py:48`).
- This settles IP-06: the gate protects nothing for website jobs.

**T4. Cut trial branches from result delivery and the arena bundle (6 edges).**
- `task_evaluation_result_delivery.py:1458,1465` -> `policy_canary_control_result_delivery`; `:1495` -> `policy_paired_summary`.
- `native_task_arena_bundle.py:292,302` and `team_candidate_quick10_registry.py:195,201` -> `policy_canary_scene_resolution`, `task_family_policy_execution`.

**T5. Cut trial probes from the Vast adapter and arm reach (7 edges).**
- `vast_provider_adapter.py:197,6445` -> `vast_policy_canary_remote_progress`.
- `vast_provider_adapter.py:169` and `provider_output_remote_collection.py:68` -> `vast_structured_policy_canary_inspection`.
- `vast_provider_adapter.py:158` -> `vast_wam_terminal_diagnostic`.
- `vast_provider_adapter.py:8875,9792` -> `company_policy_network_lease`.
- `team_arm_reach.py:147` -> `scripted_robot_runtime_dispatch`.
- `vast_official_billing_extractor.py:23` -> `policy_canary_official_billing`. Money: keep this billing reader until every trial-era Vast invoice line is settled. Then delete.

**T6. Split the launch contract (6 edges; changes the paid launch path).**
`task_evaluation_policy_run_contract` (1,092 lines) is imported by six modules:
- the activation worker (`:67`; at `:1251` it builds a "paired policy campaign" manifest on every activation; result status `policy_campaign_queue_materialized_no_execution`);
- the preparation worker (`:63`, `build_policy_run_plan`);
- the preparation contract (`:39`, eight schema and validation functions);
- the dispatcher (`:61`, `validate_policy_run_setup`, only when a profile carries `policy_run_setup`);
- `task_evaluation_run_webapp_sync.py:27`;
- `task_evaluation_scene_configuration_publication.py:739` (`REQUIRED_FAMILIES`).

Do this:
1. Extract the scene-configuration subset (setup schema, `REQUIRED_FAMILIES`) into a scene launch contract.
2. Delete the paired-campaign manifest, the result projection and the controls qualification.
3. Before and after, replay one recorded website launch with `python -m blueprint_pipeline.task_evaluation_stage_replay` and one dry-run dispatch. No paid call.

**T7. Supervisor (2 edges).** `task_evaluation_supervisor` and its `openai_cost_authority` import `task_evaluation_supervisor.candidate_policy` (1,248 lines). Delete it once T6 lands.

**Then delete:**
- the 22 trial modules;
- `config/trial/` (5 files), `config/policy_runtimes/` (2) and `config/beta_policy_candidates.v1.json`, which no production code reads (inventory section 4);
- the env-root names `task-evaluation-policy-canary-dispatches`, `policy_canary_dispatch`, `policy_canary_output` in three unit files;
- the 34 trial test files;
- the AGENTS.md lines naming the deleted coordinator, plan and capabilities modules.

Check: 7 + 10 + 11 + 6 + 7 + 6 + 2 = 59 edges.

## 4. `/app/captures`, the admin-only legacy page in Pipeline terms (loose end settled)

- **What it is.** `client/src/pages/app/Captures.tsx`, 655 lines. Staff only since 2026-11-20 (`routes.tsx:334-336`).
  It speaks Pipeline: "3D Gaussian splat (.ply)", "USD, GLB, or PLY", "Approve the 3D scene plan", authorize and execute a reconstruction.
- **How staff reach it.** Only through one link, "Prepare task-specific capture evidence" (`client/src/components/admin/JobWorkflowPanel.tsx:142`).
  That link appears only when a job-evidence question exists. In production there has never been one (`jobEvidenceRequests` 0, `jobEvidencePublications` 0).
- **What it calls.** The `capture-uploads` routes (A31-A48, 2,182 lines). Through `reconstructionForwarding.ts` (635 lines), plan/authorize/execute forwards to the Pipeline's paid compute.
- **Use.** `captureUploadSessions` holds 34 docs: 32 undated and 2 from October.
- **Security.** Journey D-10 found the same API callable by any invited account.
- **Verdict: DELETE the page, the panel link, the panel and the routes (V-05).**
- **Keep:**
  - the `captureUploadSessions` collection (it records the company simulation, 6 docs with `with_company_simulation`);
  - `captureLifecycleForwarding.ts` (used by `websiteCaptureWithdrawal.ts`);
  - the retired 410 routes.
- **Check first:** `ownedCaptureAtlasPreparation.ts` is also imported by `internal-capture-worlds.ts`. Cut that import only after confirming internal test jobs do not use the owned-capture Atlas path.

## 5. Questioning the scale: what the core loop needs per family

The core loop (AGENT-BRIEF): sentence and video in, agreement recorded, packet, company answer, Introduce us, two emails, billable event, 14/45/90-day question, withdrawal.

| Family | Today | Core loop needs (estimate, with basis) | What the rest costs |
|---|---|---|---|
| Pipeline modules | 1,621 modules, 715,431 lines; website closure 1,317 (81%) | the 11 W units' own modules plus money, privacy and deploy guards. The inventory's live set is 1,393 modules, but it is inflated by hub imports. After the V-03/V-01/V-10 cuts and V-11, about 1,440 modules remain (`prize.py`: 181 modules, 80,660 lines removable) | every job-path change drags 600,000 lines into its import closure |
| Pipeline test files | 1,754 (644,817 lines) | tests of live modules. At least 110 files (27,921 lines) test only non-live or retired-family modules; 30 (6,061 lines) test nothing live at all | nightly full lane: 7 runs x 228.5 min = about 1,600 runner-minutes a week, red 4 nights running (IP-12) |
| Pipeline unit files | 72 in `deploy/systemd` (68 units) | W 24 files + G 18 (without the preflight) + P 2 + D 5 + M 2 + slice = 52 | 16 files for idle lanes (V-01, V-14) |
| Host units | 306 listed | the 63 deployed plus door units | 229 not shipped by the repo (V-13) |
| Pipeline console scripts | 49 | live stages and owner tools, about 30 | 9 for retired lanes (V-10) |
| Pipeline dependency groups | base + 14 extras | base, `dev`, `cloud`, one geometry group | `policy_model_cpu`, `groot-libero-cpu` installed in CI for dead or retired code; `astra_asset_authoring` (owner question); `json-numpy` unused in base |
| WebApp env names | 249 | about 60: Firebase 8, Resend 3, OpenAI/Gemini 4, Pipeline sync 6, storage 4, App Check 2, rate limits 4, site and app URLs 3, field encryption 2, plus caps | at least 38 belong to retired systems (beta cohort 7, old agent runtimes 8, city launch 4, hosted session 2, launch forward and submit 12, reconstruction forward 4, embeddings 1); 142 are in no manifest (inventory) |
| WebApp client redirects | 124 (+ about 50 server 301s) | the URLs ever sent in an email or printed: unknown without Render logs | three tables to keep in step (IW-10); 52 redirect routes with no test at all (inventory 1b). Verify with 90 days of request logs before cutting |
| WebApp API routes | 176 | about 60 (site link 25, company 8, Pipeline callbacks for the job path about 15, account 8, health 3) | 35 with no caller (IW-01), plus `/api/experiments` (V-06), plus the capture-upload set (V-05) and submissions (V-04) |
| Firestore collections | 78 in code + 10 rules-only | about 20: inboundRequests, siteTaskBriefs, captureOutbox, users, robotTeamAccess, companySends, companyViews, clarifications, introductions, billableEvents, email_suppressions, accountDeletionRequests, websiteCaptureDeletionReceipts, taskEvaluationSceneIntakes, captureUploadSessions, deliveryReceipts, opsHeartbeats, opsAutomationLeases, durableDailyCaps, siteAssessmentJobs | retired collections hold 8,000+ docs (V-08); 10 rules-only collections |
| Playwright configs | 12 | default, core-journey, privacy, operator: 4 | 3 never run + 1 duplicate (V-20) |
| Legal page versions | 7 versions each, 14 files, 3,593 lines | current + previous in the app; the rest in an archive | owner decision (V-18) |
| Docs | Pipeline 515 files (207 Markdown), WebApp 605 | AGENTS.md, SYSTEM_MAP.md, runbooks for live stages | 33 Pipeline and 16 WebApp Markdown docs name missing code (V-15) |
| CI minutes | Pipeline about 7,200 a week (CI 3,879; CodeQL 1,605 on every push to main; full lane 1,599), WebApp about 2,460 | CI on changed code, a nightly lane on live code | retired and dead tests ride in every nightly run; CodeQL 86 runs a week where `codeql.yml` also has a weekly schedule |

Maintenance load, last 30 days (since 2026-10-23, `git log` on the family's files):

| Family | Modules / files | Lines | Commits touching it |
|---|---|---|---|
| Pipeline trial (55 modules) | 55 | 17,535 | 27 |
| Pipeline G1 / native | 35 | 14,261 | 12 |
| Pipeline episode compilation | 17 | 17,152 | 17 |
| Pipeline rigid probe | 12 | 4,403 | 18 |
| Pipeline Astra | 13 | 5,268 | 2 |
| Pipeline RunPod | 4 | 3,524 | 3 |
| Pipeline Lambda | 1 | 1,724 | 0 |
| Pipeline screening (kept) | 3 | 860 | 5 |
| WebApp trial-named files | 25 | 9,700 (1,176 of it is live scene intake) | 56 of 338 |
| WebApp screening-named files | 5 | 631 | 37 |

## 6. The prize in numbers

| Measure | Pipeline | WebApp |
|---|---|---|
| Source lines | 80,660 in 181 modules (`prize.py`: retired families after moving helpers, 133 modules / 60,379 lines; plus 48 more test-only or unimported modules / 20,281 lines). 75 modules / 36,348 lines can go today without touching live code; 106 modules / 44,312 lines need the cut PRs. A second pass over 79 CLI-only modules (37,702 lines) is not counted | about 21,000: trial remains 7,246; captures and job-evidence chain 5,534; runtime-dead files 7,844 not already counted; beta cohort, experiments, ops action logs 586. Legal archive move (2,586) not counted |
| Test files | about 110 (27,921 lines) by the broad measure; 34 trial and 41 retired-only within it | about 50 (37 trial, world-model and robot-match files, about 6,400 lines; 13 capture and evidence files, 4,524 lines) |
| Timers and units | 16 unit files; 229 host-only units; about 15,000 CPU-seconds a day (episode remote 14,200, rigid probe 410, preflight 320) | 2 worker lanes (2 queries a minute each, no work) |
| Disk | at least 67.5 GiB (lower bound; survey half complete) | n/a |
| Money | no direct provider spend today (`held_usd: 0` on retired reservations). Indirect: CPU and disk on a $385.80/month host; CI minutes | none direct |
| CI | `policy_model_cpu` extra off every PR; `groot-libero-cpu` (torch, lerobot, transformers...) off the nightly and wide lanes; about 110 fewer test files per nightly run | about 50 fewer server test files |
| Dependencies | `json-numpy` (base); extras `policy_model_cpu` (2), `groot-libero-cpu` (11), `astra_asset_authoring` (8, owner) | `framer-motion`, `node-fetch`, `@radix-ui/react-avatar`, `@radix-ui/react-dropdown-menu`; `pngjs` moves to dev |
| Env names | 3 unit env roots for policy canaries | at least 38 |
| Routes | n/a | 35 no-caller + 1 experiments + about 21 capture-upload/evidence + 3 submission routes |
| Console scripts | 9 | n/a |

## 7. Deletions I expect might come back, and why

- **Episode compilation and the robot arena.** The note in `deploy_control_plane_commit.py:640-642` says "a deployment company running its own software in our simulation is later". If that returns, it will want an episode compiler. It should come back as a new, small lane that a company's simulation download feeds, not this one. Git history keeps the code.
- **The rigid robot-free probe.** "Tested it: can do / cannot yet" may want Blueprint to show that a simulation is solvable at all. A $1 scripted check is the cheapest way to show that. If the owner wants that line on the packet, the probe or its successor comes back.
- **Some redirects.** Without Render request logs, cutting the 52 untested redirects may break a link printed in an old email or deck. Expect a few to return after the first 404s.
- **A staff capture upload.** If a site cannot film and Blueprint films for it again, someone will want an upload page. The capture-app direction was retired on purpose, so this should need an owner decision.
- **Paid-evaluation and entitlement records.** If a past payment is disputed, the owner may need them. That is why V-08 asks for an export before any purge.
- **Experiments.** A future home-page test would want assignment code. It should be rebuilt when an experiment exists, not kept.

## Requirements ledger

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| Remote episode-compilation timer, path, service | pipeline:deploy/systemd/blueprint-task-evaluation-episode-compilation-remote.* | nobody (lane deleted; "armed to drain") | nothing: rows 0 on every run | DELETE | |
| Host episode-compilation units (disarmed each release) | pipeline:deploy/systemd/blueprint-task-evaluation-episode-compilation.* | nobody | nothing | DELETE | |
| Rigid robot-free probe units | pipeline:deploy/systemd/blueprint-rigid-robot-free-probe-runner.* | AGENTS.md spend line (lane kept) | nothing on the website path (SYSTEM_MAP:59) | DELETE | |
| Rigid probe withdrawal reader | pipeline:website_capture_withdrawal_rigid_probe | privacy hard stop | a withdrawn site's probe outputs would not be deleted | KEEP | Must outlive any probe output that still exists. |
| Team-scene Cloud Run collector units | pipeline:deploy/systemd/blueprint-team-scene-packet-remote.* | nobody (SYSTEM_MAP calls it off) | nothing; skipped by condition about 1,440 times a day | DELETE | |
| Terminal resource release units | pipeline:deploy/systemd/blueprint-task-evaluation-terminal-resource-release.* | nobody (queue empty since 2026-08-12) | nothing | DELETE | |
| Chain preflight timer | pipeline:deploy/systemd/blueprint-control-plane-preflight.timer:5,12 | nobody ("not a health signal yet", D-04) | nothing anyone acts on (IP-17) | DELETE | |
| GPU spend guard | pipeline:deploy/systemd/blueprint-gpu-spend-guard.* | money hard stop, AGENTS.md Spend limits | orphan GPUs could run unbounded | KEEP | It is the money stop; fix its RunPod read (IP-02), do not delete it. |
| RunPod inventory read in the guard | pipeline:scripts/gpu_spend_guard.py:2322-2337 | money (while a key exists) | a live orphan pod could go unseen | SIMPLIFY | Owner closes the account and deletes the key; the read then stops by itself. |
| Withdrawal deletion timer | pipeline:deploy/systemd/blueprint-website-withdrawal-deletion.* | privacy hard stop | withdrawn sites keep their data | KEEP | Withdrawal is in the core loop. |
| screening_retained_ledger | pipeline:src/blueprint_pipeline/screening_retained_ledger.py | money (AGENTS.md) | past screening spend could not be accounted | KEEP | Money accounting still reads it. |
| website_capture_withdrawal_screening | pipeline:src/blueprint_pipeline/website_capture_withdrawal_screening.py | privacy (AGENTS.md) | screening copies of a site's data would survive withdrawal | KEEP | Withdrawal still reads it. |
| Scene policy capability gate | pipeline:task_evaluation_scene_progression.py:725 | nobody (trial) | nothing for website intents (returns []) | DELETE | |
| Paired policy campaign manifest on activation | pipeline:task_evaluation_launch_activation_worker.py:1251 | nobody (trial) | nothing a site or company sees | DELETE | |
| wam_provider_object_store | pipeline:src/blueprint_pipeline/wam_provider_object_store.py | the simulation build (stages bundles) | scene configuration cannot stage to B2 | KEEP | It is live staging under a trial name; rename it (T1). |
| Policy-canary official billing reader | pipeline:vast_official_billing_extractor.py:23 | money | past Vast invoices could not be reconciled | KEEP | Until every trial-era Vast line is settled, then delete. |
| config/trial, config/policy_runtimes, config/beta_policy_candidates.v1.json | pipeline:config/ | nobody | nothing (no production reader) | DELETE | |
| RunPod and Lambda console scripts | pipeline:pyproject.toml:278,281 | nobody | nothing | DELETE | |
| G1 console scripts (6) | pipeline:pyproject.toml:288-293 | nobody (paused 2026-11-12) | nothing | DELETE | |
| policy_model_cpu extra in PR CI | pipeline:.github/workflows/ci.yml:210 | nobody | a test of dead code stops running | DELETE | |
| groot-libero-cpu extra in nightly and wide lanes | pipeline:full-test-lane.yml:293, impacted-wide-lane.yml:271 | nobody | retired G1/GR00T tests stop running | DELETE | |
| json-numpy base dependency | pipeline:pyproject.toml:58 | nobody | nothing (no importer) | DELETE | |
| 54 test-only / unimported modules (minus 4) | pipeline:testonly.json | nobody | nothing | DELETE | |
| _sam_parser_js, isaacsim_nurec_601 rendering_setup, pytest_full_lane_evidence, qualification_control_admission | pipeline (dynamic use) | live stage, CI, paid allocator check | SAM decode, Isaac render, CI evidence, allocator verification | KEEP | Each has a non-import user (package data, path read, workflow, verifier). |
| Host failed transient units and hold-expiry units | door units | nobody | nothing; status gets readable | DELETE | |
| Retired-lane disk roots | door usage | nobody | nothing; disk gates stop firing | DELETE | |
| Screening attempts folder (9.4 GiB) | /mnt/blueprint-work/beta-policy-screening-work | privacy and money | possible site data and spend evidence | KEEP | Until withdrawal confirms its contents and the ledger is exported, then delete through withdrawal. |
| /health/ready beta cohort check | webapp:server/utils/launch-readiness.ts:222-232 | nobody | a deploy can no longer fail on unused settings | DELETE | |
| beta-cohort-policy.ts and 7 env names | webapp:server/utils/beta-cohort-policy.ts | nobody (pre-beta 2026-07) | nothing (gate never called) | DELETE | |
| Experiments framework and route | webapp:client/src/lib/experiments.ts, server/routes/experiments.ts | nobody | nothing | DELETE | |
| Growth-campaign writes in the email webhook | webapp:server/routes/resend-webhook.ts:50-79 | nobody | nothing | DELETE | |
| Suppression branch in the email webhook | webapp:server/routes/resend-webhook.ts:84-99 | provider terms (bounces, complaints) and unsubscribe law | Blueprint keeps mailing people who complained or bounced | KEEP | Required to honour complaints and unsubscribes. |
| ops-action-logs writer | webapp:server/agents/ops-action-logs.ts | nobody (no write since 2026-04-08) | nothing | DELETE | |
| codex_local, acp_harness, openclaw providers | webapp:server/agents/provider-config.ts:17-27 | nobody | nothing (no adapter files) | DELETE | |
| Launch-forward worker lane | webapp:server/utils/taskEvaluationLaunchForwardWorker.ts:215 | nobody (#1300) | nothing (no forward_* records) | DELETE | |
| Job-evidence worker lane | webapp:server/utils/taskEvaluationLaunchForwardWorker.ts:213 | nobody | nothing (0 requests ever) | DELETE | |
| Scene-intake worker lane | webapp:server/utils/taskEvaluationLaunchForwardWorker.ts:214 | owner direction 2026-11-12 (website job path) | scene intents never reach the Pipeline; no simulation | KEEP | It forwards every website job's scene intent. |
| Capture coverage worker lane | webapp:server/utils/taskEvaluationLaunchForwardWorker.ts:206-211 | first look on paper (core packet) | no first look | KEEP | It reads the video for the first look. |
| Launch submission and preparation routes | webapp:server/routes/internal-task-evaluation-launch-{submissions,preparations}.ts | nobody | nothing (callers not live) | DELETE | |
| Launch receipt route (A93) | webapp:server/routes/internal-task-evaluation-launches.ts:110 | simulation build status | the job page loses launch status | KEEP | The Pipeline posts launch receipts to it. |
| Owner success proposal route (A82) | webapp:server/routes/internal-owner-success-proposal.ts | nobody (D-13: changes no threshold) | nothing | DELETE | |
| Job-evidence panel link to /app/captures | webapp:client/src/components/admin/JobWorkflowPanel.tsx:142 | nobody | nothing (no evidence question ever) | DELETE | |
| /app/captures page | webapp:client/src/app/routes.tsx:336 | launch copy f-103 2026-11-20 kept it as staff tool, no need named | nothing | DELETE | |
| capture-uploads routes A31-A48 and owned-capture-atlas A167-A169 | webapp:server/routes/capture-uploads.ts, owned-capture-atlas.ts | nobody | nothing found; check internal test jobs first | DELETE | |
| captureUploadSessions collection | webapp:server (42 files) | packet (company simulation record) | company simulation status is lost | KEEP | Records the company simulation package. |
| captureLifecycleForwarding.ts | webapp:server/utils/websiteCaptureWithdrawal.ts | privacy (withdrawal) | withdrawal cannot tell the Pipeline | KEEP | Withdrawal uses it. |
| Retired capturer 410 routes | webapp:server/utils/retiredCapturerRoutes.ts:13 | owner 2026-11-11 | old app clients get a confusing 404 or worse | KEEP | Cheap explicit refusal. |
| beta-policy-screening-holds route (name) | webapp:server/routes.ts:71 | held-job sentences (live) | held jobs lose their sentence | SIMPLIFY | Live; rename to job holds, do not delete. |
| betaPolicyScreeningContract.ts (name) | webapp:server/utils/betaPolicyScreeningContract.ts | money (job ceiling uses it) | job ceiling breaks | SIMPLIFY | Live; rename. |
| 6 unreferenced WebApp files | webapp:server/utils/web-search.ts etc. | nobody | nothing | DELETE | |
| World Labs client chain and robot-match chain | webapp:server/utils/worldlabs.ts etc. | nobody | nothing at runtime | DELETE | |
| evaluationPricing.ts | webapp:client/src/lib/evaluationPricing.ts | nobody (protected references) | claims guard and a Terms comment name it | DELETE | |
| framer-motion, node-fetch, react-avatar, react-dropdown-menu | webapp:package.json | nobody | nothing | DELETE | |
| Ten unrouted legal pages in app source | webapp:client/src/pages/*Announced/Earlier/Former/Older/Prior.tsx | legal record | proof of what earlier users accepted, if not archived | MERGE | Move to an archive with digests (owner). |
| Three unrun intake Playwright configs | webapp:playwright.intake*.config.ts | nobody | nothing (not in CI) | DELETE | |
| result-consumer Playwright config | webapp:playwright.result-consumer.config.ts | nobody | nothing (duplicate) | DELETE | |
| AGENTS.md lines naming deleted modules | pipeline:AGENTS.md:90-91 | nobody | agents stop chasing deleted files | DELETE | |
| Retired Firestore collections | Firestore (V-08 list) | nobody | nothing on the job path | DELETE | |

## Firestore aggregates wanted

For the orchestrator's reviewed read-only script. Non-personal fields only.

1. `taskEvaluationLaunches`: count by `state` with `created_at_iso` after 2026-11-14, and count with `state in (forward_pending, forward_blocked)` ever. Confirms V-04 (expected 0 for the second).
2. `taskEvaluationLaunches`: count by the field that marks the writer (the receipt route vs the submission route; for example presence of `terminal_receipt` vs `submission_*` fields) after 2026-11-14. Shows whether submissions ever ran after #1300.
3. `captureUploadSessions`: count with `reconstruction.state` set, grouped by state, and the max of any created/updated timestamp. Confirms nobody used `/app/captures` reconstruction (V-05).
4. `inboundRequests`: count with `job_evidence_forward_pending == true` or `job_evidence_forward_next_at_ms` set. Confirms the job-evidence lane has no parent markers (V-04).
5. `growth_campaign_events`: count by `event_type` and by `campaign_id == "unknown"`. Shows how many are job emails rather than campaigns (V-07).
6. `agentRuns`: count by `provider` and `status` for docs with any timestamp after 2026-11-01. Tells which agent providers still run (V-08).
7. `marketplaceEntitlements` and `evaluationRuns`: count with any money field set (amount, price, paid), no values. Tells whether a purge touches payment records (V-08).

## Findings index

| id | severity | dimension | title |
|---|---|---|---|
| V-01 | P1 | vestigial | The remote episode-compilation lane runs about 1,180 times a day and collects nothing |
| V-02 | P1 | over-gated | Every deploy is gated on beta cohort controls that no code enforces |
| V-03 | P1 | vestigial | Trial code cannot be deleted by name: 17 of its 59 live imports are generic helpers wearing trial names |
| V-04 | P2 | vestigial | The worker polls two queues every minute that no live code fills |
| V-05 | P1 | vestigial | The staff captures page and the job-evidence panel lead to a chain with no production record |
| V-06 | P2 | vestigial | The experiments framework assigns nothing: its one entry function has no caller |
| V-07 | P1 | vestigial | The email delivery webhook keeps every recipient address for a retired growth-campaign system |
| V-08 | P2 | vestigial | Firestore still holds 8,000+ records of retired systems, and one dead writer remains |
| V-09 | P2 | vestigial | Dependencies ship and CI installs packages only dead or retired code uses |
| V-10 | P2 | vestigial | Nine Pipeline console scripts start retired lanes |
| V-11 | P2 | vestigial | About 50 Pipeline modules and 30 test files exist only for each other |
| V-12 | P2 | vestigial | About 9,000 WebApp lines never run, and two references sit inside protected texts |
| V-13 | P2 | vestigial | The host keeps 229 units the repository does not ship |
| V-14 | P2 | vestigial | Thirteen more shipped unit files run lanes or checks nobody reads |
| V-15 | P2 | untrue | Docs agents are told to trust name about 250 files and modules that no longer exist |
| V-16 | P2 | fragile | Live job code still carries retired names, so a delete by name would break it |
| V-17 | P1 | vestigial | Retired lanes hold at least 67 GiB while disk gates stop real jobs |
| V-18 | P2 | vestigial | Seven Terms and Privacy versions ship in the app source; ten are unrouted |
| V-19 | P2 | vestigial | The scale is set by retired directions: tests, units, env names, redirects, collections |
| V-20 | P2 | vestigial | Three site-intake test suites and one duplicate Playwright config are kept but never run |

Builds on: IP-02, IP-03, IP-05, IP-06, IP-09, IP-10, IP-11, IP-13, IP-16, IP-17, IW-01, IW-05, IW-06, IW-10, IW-11, IW-12, C-12, C-13, C-15, D-01, D-05, D-07, D-10, D-13.

## Not covered

- No Render request logs, so route and redirect cuts rest on code callers, not traffic.
- Host env files were not read.
- CI minutes are estimated from six sampled runs per workflow over seven days, not billing.
- Journey E was not written yet; not cross-referenced.
- Cloud Run, GCP and B2 objects of retired lanes were not inventoried.
- No test suite was run after a trial deletion; safety rests on the import graph and string search.
- I did not measure how much of the spend guard's 35 CPU-seconds per run is the RunPod query.
