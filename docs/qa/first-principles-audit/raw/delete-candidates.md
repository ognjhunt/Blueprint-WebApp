# Delete candidates, both repositories (agent `dim-vestigial`)

2026-11-22. WebApp `0ee5df6` (live), Pipeline `7d8b532` (host runs `cbff06b`).
One section per candidate, ordered by prize against risk: big and safe first, risky last.
Each section has the same four parts: why it can go, cost today, what depends on it, and how to remove it safely.
Evidence and measurement scripts are listed in `dim-vestigial.md` sections 1 and 6. Finding ids refer to `dim-vestigial.findings.json` and the other agents' files.

Rules for every PR below:
- One small PR per step.
- Never delete a withdrawal reader (`website_capture_withdrawal_*`) or a money reader (`screening_retained_ledger`, billing extractors) before the data it reads is gone or exported.
- Owner-only steps are marked **Owner**: protected texts, legal pages, door operate requests and data purges.
- After each Pipeline PR run `python -m blueprint_pipeline.impacted_test_selection` and ruff on the changed files.
- After each WebApp PR run `npm run check`, `npx vitest run client/tests` and the affected e2e spec.

---

## 1. Remote and host episode compilation (Pipeline)

**Why it can go.** The 2026-11-12 frame deleted the robot-team evaluation lanes. Episode compilation only served policy and controls runs. A website job prepares as scene configuration and never compiles episodes (`scripts/deploy_control_plane_commit.py:643-646`). The remote half stays armed "only to drain", and there is nothing to drain.

**Cost today.**
- About 1,180 runs a day at 12.1 CPU-seconds each: about 14,200 CPU-seconds, or 3.9 CPU-hours, a day. Every run collects `rows: 0` (door `journal`, 58 runs in 1.16 h).
- Code: 17 modules, 17,152 lines (12 on the website import closure); 7 test files; 68 test imports.
- 17 commits touched it in the last 30 days.
- 6 unit files.

**What depends on it.**
- `team_scene_packet.py:439` imports `task_evaluation_native_arena_episode_compiler`.
- `task_evaluation_launch_preparation_worker.py:72` imports `task_evaluation_episode_compilation_queue`.
- `team_scene_packet_remote` imports `task_evaluation_episode_compilation_remote`.
- The supervisor allowlist names `task_evaluation_episode_compilation_worker` (`task_evaluation_scene_retirement_supervisor.py:1117`).
- `DEFAULT_PAUSED_LANE_DISARM_UNITS`.

**How to remove.**
1. PR: move the three remote units and the three host units to `DEFAULT_RETIRED_TRIGGER_UNITS`, delete the six unit files, and drop the supervisor allowlist entry. Deploy. Check `door units`: the six units are gone and the capacity stall checks are unchanged.
2. PR: replace the two live imports. The launch preparation worker stops staging episode compilation for `reuse_configured_scene`, a request kind the website never sends. `team_scene_packet` drops the compiler branch. Delete the 17 modules and 7 test files.
3. After: the remote CPU runtime (`/opt/blueprint/remote-cpu-runtime`, 8.3 GiB, shared with the team-scene collector, candidate 5) can be purged once candidate 5 is done too.

---

## 2. Beta cohort gate and its deploy readiness check (WebApp)

**Why it can go.** It was written for the invite-cohort beta (2026-07, #411), and that beta is gone. `evaluateBetaCohortGate` and `recordBetaCohortAdmission` have no caller outside their own file and test.

**Cost today.**
- `/health/ready` requires `betaCohortControls` (`server/utils/launch-readiness.ts:222-232`). A deploy whose readiness fails rolls back (`.github/workflows/deploy.yml:501-513`). So a missing `BLUEPRINT_BETA_*` value undoes a good release.
- 301 lines, 1 test file, 7 env names, 41 stored admissions.

**What depends on it.** Only `launch-readiness.ts`.

**How to remove.**
1. One PR: delete `beta-cohort-policy.ts` and its test, delete the readiness check, and remove the 7 names from `render.*.env.example`.
2. Check: `/health/ready` locally returns 200 without any `BLUEPRINT_BETA_*` set.
3. **Owner:** purge `betaCohortAdmissions` (41).

---

## 3. Host-only units: 206 failed transient units, 22 hold-expiry units, 1 canary watchdog (host)

**Why it can go.** These are one-off experiment units from 2026-09-26 to 2026-10-27, hold timers for holds that no longer exist, and a watchdog for a retired canary. None is shipped by the repo.

**Cost today.** 207 red lines in `door status` hide the one real failure, the spend guard (IP-03, D-07). The 22 hold-expiry units are armed.

**What depends on it.** Nothing. The only door hold is an expired one on `blueprint-agent-run-dispatcher.timer`, whose code left on 2026-11-15.

**How to remove.**
1. **Owner** (door `unit` request, operate scope): `reset-failed` the 206 transient units; stop and remove the 22 hold-expiry units and `blueprint-existing-policy-canary-watchdog.service`; release the expired hold.
2. PR (Pipeline): have the release lifecycle reset-failed transient `blueprint-*` units older than 7 days.
3. Check: `door status.failed_units` lists only real units.

---

## 4. Retired-lane disk (host)

**Why it can go.** The lanes were retired between 2026-11-05 and 2026-11-14.

**Cost today.**
- At least 67.5 GiB (survey half complete): policy canaries 15.9, configured controls 9.1, G1 development 8.6, internal-team diagnostic 5.5, controlled policy integration 5.0, runtime comparison 4.9, G1 CUDA source 4.3, native policy canaries 2.8, scene841757 2.0, and screening attempts 9.4.
- Disk gates stopped the real job twice (C-12).

**What depends on it.** Withdrawal deletion may need to find site data in screening attempts and in G1 registrations (`website_capture_withdrawal_screening`, `website_capture_withdrawal_native_g1`). The money ledger may cite screening attempt records.

**How to remove.**
1. **Owner** (door `purge-experiment-folder`, one root per request): G1 and native roots first, then configured controls, the internal-team diagnostic, runtime comparison, controlled policy integration and the policy canaries.
2. Screening attempts go last: export the screening money ledger, then delete through withdrawal or with explicit owner approval.
3. Check: `door usage` totals and `capacity.alerts` for storage classes.

---

## 5. Shipped units for idle lanes and checks (Pipeline)

**Why it can go.**
- Rigid probe: no website half queues a probe (SYSTEM_MAP step 11).
- Team-scene Cloud Run collector: SYSTEM_MAP says it is switched off, yet it is armed.
- Terminal resource release: queue empty since 2026-08-12.
- Chain preflight: "not a health signal yet" (D-04); its 108 blockers go unread (IP-17).

**Cost today.**
- Rigid probe: about 250 runs a day x 1.7 CPU-s, output `[]`.
- Team-scene remote: about 1,440 starts a day, every one skipped by its condition.
- Preflight: 48 runs a day x 6.7 CPU-s.
- 10 unit files in all (13 with the host episode compilation units counted in candidate 1).

**What depends on it.**
- `scene_stage_maintenance.py:251`, `scene_stage_holds.py:203` and `team_scene_packet.py:1429` import the rigid probe runner.
- `team_scene_packet_worker` imports the remote collector.
- Withdrawal reads probe outputs (`website_capture_withdrawal_rigid_probe`) and team-scene halves.

**How to remove.**
1. PR: delete the 10 unit files, add the trigger names to `DEFAULT_RETIRED_TRIGGER_UNITS` and remove them from `DEFAULT_DEPLOYED_SYSTEMD_UNITS`.
2. PR: cut the three imports of the probe runner (C-13 also calls the robot-fit and probe parts vestigial).
3. **Owner** (owner question in the findings): drop the $1 rigid-probe spend line from AGENTS.md.
4. Once withdrawal reports no probe outputs left on the host, delete the 12 probe modules (4,403 lines), 7 test files and the withdrawal reader in the same PR.

---

## 6. Experiments framework (WebApp)

**Why it can go.** Growth experiments are retired. `resolveExperimentVariant` has no caller, so `/api/experiments/assignments` is never fetched.

**Cost today.** 209 lines, 1 public route, an empty field on every analytics event, and 2 `experiment_rollouts` docs.

**What depends on it.** `client/src/lib/analytics.ts:228` (empty field only).

**How to remove.** One PR: delete both files, the mount at `server/routes.ts:68`, the analytics field and the rules entry.

---

## 7. Growth-campaign storage in the email webhook (WebApp)

**Why it can go.** Growth campaigns are retired; the last campaign was written 2026-06-25.

**Cost today.** Every Resend event stores the recipient address and the full payload in `growth_campaign_events` (403 docs). Privacy: these are unnecessary copies of site and company addresses.

**What depends on it.** Nothing reads it. Suppressions (bounce, complaint, unsubscribe) are written in the same handler and must stay.

**How to remove.**
1. One PR: keep `recordEmailSuppression`; delete the two writes (`server/routes/resend-webhook.ts:50-79`).
2. **Owner:** purge `growth_campaign_events` and `growthCampaigns`.

---

## 8. Pipeline modules imported only by tests or by nothing

**Why it can go.** Nobody asked for them: no unit, guard, deploy script or other script reaches them.

**Cost today.** 50 modules, 20,765 lines (54 found, minus 4 with real dynamic use). Their tests run in the nightly lane, and 30 test files (6,061 lines) test nothing live. AGENTS.md names one of them (`runtime_service_app`) as an entry point (IP-11).

**What depends on it.** Tests only. Keep `_sam_parser_js`, `config.isaacsim_nurec_601.rendering_setup`, `pytest_full_lane_evidence` and `qualification_control_admission`.

**How to remove.**
1. PRs of 5 to 10 modules each, grouped by family: delete the module and its test, and fix any doc line naming it.
2. Second pass: the 79 CLI-only modules (37,702 lines). Keep the owner tools: `impacted_test_selection`, the replays, `test_job_matrix`, `website_capture_withdrawal_drill`, `website_atlas_operator`, `account_spend_limit_drill`.

---

## 9. WebApp files that never run

**Why it can go.** Nobody asked for them. Their systems are the capture-app World Labs purchase, robot match, the marketplace, pilots and web search.

**Cost today.** 36 files, 8,967 lines (IW-05).

**What depends on it.** Type imports (`client/src/types/inbound-request.ts`), other dead files, and hand scripts (`scripts/seed-robot-teams.ts`, `restore-granted-brief.ts`, `requeue-capture-coverage-review.ts`). Two protected texts name `evaluationPricing.ts`: `scripts/claims/cross-source-claims-guard.ts:618` and a comment at `client/src/pages/Terms.tsx:16`.

**How to remove.**
1. PR: delete the six files with no reference at all (601 lines).
2. PR: delete the World Labs chain (1,893 lines) and the robot-match chain (2,240 lines) with their hand scripts and tests. Move needed types first.
3. **Owner:** edit the claims guard line and the Terms comment, then delete `evaluationPricing.ts`.

---

## 10. Unused dependencies (both)

**Why it can go.** Nobody asked for them.

**Cost today.**
- WebApp: `framer-motion` and `node-fetch` have no production importer. `@radix-ui/react-avatar` and `@radix-ui/react-dropdown-menu` are used only by unreachable components. `pngjs` is a production dependency used only by a dead file and tests.
- Pipeline: `json-numpy` has no importer anywhere. Every PR installs the `policy_model_cpu` extra (onnx, onnxruntime) for code nothing runs. The nightly and wide lanes install `groot-libero-cpu` (torch, lerobot, transformers, peft, timm, decord...) for retired GR00T and G1 tests.

**What depends on it.** `vite.config.ts:59` names `framer-motion` in a chunk rule. The action-ledger test fixtures resolve the Firestore SDK's own `node-fetch`.

**How to remove.**
1. WebApp PR: remove the four packages and the two `ui/` files, and move `pngjs` to dev once `taskThumbnail.ts` goes. Then build and check.
2. Pipeline PR: remove `json-numpy`.
3. After candidates 15 and 17: remove the two extras and their CI flags.

---

## 11. Retired console scripts (Pipeline)

**Why it can go.** RunPod was retired 2026-11-05; Lambda was never used; G1 was paused 2026-11-12; the trial was dropped 2026-11-14.

**Cost today.** 9 of 49 console scripts (`pyproject.toml:278,281,286,288-293`), plus about 10,000 lines behind them.

**What depends on it.** `task_evaluation_dispatcher_cgroup_cleanup.py:24` and `vast_independent_watchdog_control` import `groot_oscar_runpod_watchdog` for one constant.

**How to remove.**
1. PR: move `EVIDENCE_NAME` into the cleanup module.
2. PR: remove the nine entries; delete the RunPod adapter and watchdogs, the Lambda adapter, the six unitree modules and their tests.
3. **Owner** (separately): close the RunPod account and delete the key, which ends the guard failures (IP-02, D-01).

---

## 12. Job-evidence panel, staff captures page, capture-upload routes (WebApp)

**Why it can go.** It comes from the capture-app era (#1145, 2026-10-29). The launch copy pass kept it as a staff tool on 2026-11-20 without naming a need. No job-evidence question has ever existed in production.

**Cost today.**
- About 5,534 lines: `Captures.tsx` 655, `captureUploads.ts` 448, `capture-uploads.ts` 2,182, `owned-capture-atlas.ts` 88, `ownedCaptureAtlas*` 396, `JobWorkflowPanel.tsx` 158, `job-workflow.ts` 159, `jobEvidence*` 548, `reconstructionForwarding.ts` 635, `captureUploadForwarding.ts` 250.
- 13 server test files, 4,524 lines.
- Routes A31-A48, A101-A103, A167-A169, A174-A175.
- Any invited account can call reconstruction authorize and execute (D-10). Money exposure.

**What depends on it.**
- Keep `captureUploadSessions` (the company simulation record).
- Keep `captureLifecycleForwarding.ts` (withdrawal uses it).
- `ownedCaptureAtlasPreparation.ts` is also imported by `internal-capture-worlds.ts`.
- `jobEvidenceContract.ts` is imported by `siteManagedEvidence.ts`, `betaPolicyScreeningHold.ts` and `jobManagedEvaluation.ts`.

**How to remove.**
1. PR: delete the panel link and `JobWorkflowPanel`, the job-workflow routes and the job-evidence lane.
2. PR: delete `/app/captures`, the client lib and the capture-upload routes except whatever internal test jobs need. Check `internal-test-jobs.ts` first.
3. PR: delete owned-capture Atlas once `internal-capture-worlds.ts` no longer imports it.
4. Check: the `job-companies`, `site-answer` and `account-deletion` e2e specs, and a withdrawal in the emulator.

---

## 13. Launch-forward and job-evidence worker lanes, submission routes (WebApp + Pipeline)

**Why it can go.** The robot-team evaluation line left on 2026-11-14 (#1300). Website launches do not use submissions.

**Cost today.**
- Two lanes poll every minute and find no work: no `forward_*` launch record exists, and job-evidence requests are 0.
- About 2,900 lines of contract code, 3 routes (A89-A91) and 12 env names.

**What depends on it.**
- Pipeline `submit_task_evaluation_*via_webapp*.py`, which no unit, guard or deploy path reaches.
- The scene-intake lane and the launch receipt route (A93) share the file and module and must stay.

**How to remove.**
1. PR: remove the two lanes from `startTaskEvaluationLaunchForwardWorker`.
2. PR: delete the submission and preparation routes and their contracts. Keep `taskEvaluationLaunchContract.ts` only if A93 still imports it.
3. Pipeline PR: delete the submit scripts.
4. Confirm first with Firestore aggregates 1 and 2 in `dim-vestigial.md`.

---

## 14. Retired Firestore data (WebApp)

**Why it can go.** The systems that wrote it are retired.

**Cost today.**
- `opsActionLogs` 4,834 docs (last write 2026-04-08).
- `agentRuns` 2,478 (2,183 failed, 2,148 from `codex_local`); may hold job text.
- `taskEvaluationPolicyRuns` 121 and `captureTaskEvaluationRuns` 95.
- `evaluationRuns` 37, `marketplaceEntitlements` 39, `betaCohortAdmissions` 41.
- `growthCampaigns` 58 and `growth_campaign_events` 403.
- 10 rules-only collections.

**What depends on it.** The writer `server/agents/ops-action-logs.ts` (no write since April). The `codex_local`/`acp_harness`/`openclaw` provider ids, which have no adapter.

**How to remove.**
1. PR: delete `ops-action-logs.ts` and the three providers with their 8 env names; delete rules for the rules-only collections.
2. **Owner:** export counts and any money totals, then purge. Keep any record that backs a past payment.

---

## 15. Early trial in the Pipeline (seven PRs)

**Why it can go.** The owner dropped the trial on 2026-11-14.

**Cost today.**
- 55 modules, 17,535 lines (44 on the website closure).
- 59 live import edges.
- 27 commits in 30 days.
- 34 test files.
- `config/trial` (124 KB), `config/policy_runtimes`, `config/beta_policy_candidates.v1.json`.
- Every activation still builds a paired policy campaign record.
- $34.52 of November's metered spend is screening (two captures).

**What depends on it.** See `dim-vestigial.md` section 3 for every edge with file:line. Generic helpers inside trial names (`wam_provider_object_store` and 3 others) are needed by the simulation build. `policy_canary_official_billing` stays until trial Vast invoices are settled.

**How to remove.** T1 to T7 in section 3 of the report, in order:
1. T1, move (17 edges).
2. T2, constants (10).
3. T3, gates (11).
4. T4, result branches (6).
5. T5, Vast probes (7).
6. T6, launch contract split (6). Replay a recorded website launch and a dry dispatch before and after. Money.
7. T7, supervisor (2).

Then delete the 22 modules, the three config paths, three env roots in unit files, the 34 tests and the AGENTS.md lines.

---

## 16. Early trial remains in the WebApp

**Why it can go.** Same as candidate 15.

**Cost today.**
- About 7,250 lines in 16 files: `robotTeamTestSubmission.ts`, `taskEvaluationRunContract.ts`, `taskEvaluationLaunchPreparationContract.ts`, `evaluationReadyRunContract.ts`, `taskEvaluationLaunchSubmission.ts`, `policyCanaryWebappSyncContract.ts`, `configuredSceneOfferingContract.ts`, `jobManagedEvaluation.ts`, `websiteOwnerSuccessConfirmation.ts`, `runResultScoring.ts`, `policyIntegration.ts` and 3 routes.
- 37 test files, about 6,400 lines.
- 56 of 338 WebApp commits in 30 days touched trial-named files.
- The site job page still has trial-era phases (A-06).

**What depends on it.**
- `jobManagedEvaluation.ts` is imported by `siteManagedEvidence.ts`, `betaPolicyScreeningHold.ts` and `job-workflow.ts`.
- `policyIntegration.ts` is imported by `robotTeamSupply.ts` and `internal-capture-worlds.ts`.
- `runResultScoring.ts` is imported by `agentRunRecord.ts` and `pilotRecommendationEvidence.ts`.
- Live and to be renamed, not deleted (V-16): `taskEvaluationSceneIntake.ts` (scene intent), the screening-holds route and `betaPolicyScreeningContract.ts` (job ceiling).

**How to remove.**
1. After candidates 12 and 13: delete `websiteOwnerSuccessConfirmation` and route A82 (D-13).
2. Delete `policyIntegration` (the Dream Labs endpoint) with its `robotTeamSupply` branch.
3. Delete the run and launch contracts.
4. Prune `jobOutlook` trial phases (with journey A's A-06 PR).
5. Rename the live parts.

---

## 17. G1 and native humanoid lanes (Pipeline)

**Why it can go.** Paused by the owner on 2026-11-12. No website job uses a humanoid.

**Cost today.**
- 35 modules, 14,261 lines (27 on the website closure).
- 16 live importers.
- 12 commits in 30 days.
- 90 test imports; 35 failed transient units.
- About 15 GiB of disk (candidate 4).
- 5 `configs/g1_*` files and 6 console scripts.

**What depends on it.**
- `website_locomotion_hold.py:95` imports `task_evaluation_g1_catalog`.
- `task_evaluation_embodiment_registry` imports `native_g1_beta_authority`.
- `native_task_arena_runtime` imports `native_g1_navigation_goal`.
- `control_plane_lane_experiment_*` imports `native_g1_registered_containment`.
- Withdrawal: `website_capture_withdrawal_deletion` imports `website_capture_withdrawal_native_g1`, which deletes G1 site registrations.
- The door's `experiment_purge.py` reads `config/native_g1_shared_inputs.v1.json`.

**How to remove.**
1. PR: cut the four non-withdrawal live imports.
2. PR: delete the console scripts and the G1-only modules.
3. Once withdrawal reports no G1 registration rows and no `native-g1/` packets remain: delete `website_capture_withdrawal_native_g1` and the config.

---

## 18. Rigid robot-free probe code (Pipeline)

Covered in candidate 5, steps 2 to 4.

**Prize.** 12 modules, 4,403 lines; 18 commits in 30 days; 64 test imports; a $1 spend line.

**Risk.** The withdrawal reader must go last. The owner may want a "solvable" check on the packet later (see "might come back" in the report).

---

## 19. Astra CAD authoring (Pipeline) — owner question

**Why it might go.** AGENTS.md keeps it "when that backend runs". ARTISAN is the object path the website uses.

**Cost today.**
- 13 modules, 5,268 lines.
- 19 live importers, including `website_task_preparation.py:1809`, `website_native_inputs.py:224` and `website_synthetic_cad.py:195`.
- 63 test imports.
- The `astra_asset_authoring` dependency group (8 packages, including langgraph).

**How to remove.** Only after the owner says yes:
1. Cut the 19 imports behind the backend choice.
2. Delete the modules, the extra and the AGENTS.md spend row.

---

## 20. RunPod and Lambda (Pipeline)

Covered in candidate 11.

**Prize.** 5 modules, 5,248 lines. The guard's RunPod read stops when the owner deletes the key. The guard has failed 4,844 times since 2026-11-13.

---

## 21. Stale docs (both)

**Why it can go.** Docs that name deleted code mislead agents.

**Cost today.**
- Pipeline `AGENTS.md:90-91` names three deleted screening modules.
- 33 of 207 Pipeline Markdown docs name 206 missing modules.
- 16 of 72 WebApp Markdown docs name 48 missing files.
- The cloud scene runbook still walks the dropped trial (C-15).

**How to remove.**
1. One PR per repo that rewrites or deletes each stale line.
2. Add a CI check that fails when `AGENTS.md` or `SYSTEM_MAP.md` names a path missing from both repos.
3. Do not edit inside shared `PLATFORM_CONTEXT.md` blocks.

---

## 22. Legal versions in the app source (WebApp) — Owner

**Why.** Ten frozen Terms and Privacy versions (2,586 lines) are pinned by digest but rendered by no route.

**How.** **Owner** decision: move them to a read-only legal archive with their digests and the version map. The app keeps the current and previous versions. Rights: the archive must keep matching the pinned bytes.

---

## 23. Unrun and duplicate Playwright configs (WebApp)

**Why it can go.** Nobody asked for them: three intake configs never run in CI (685 spec lines), and `playwright.result-consumer.config.ts` duplicates invited-beta.

**How to remove.**
1. If IW-06 decides to run the intake cases, fold them into the default config.
2. Either way, delete the four configs.

---

## Kept on purpose (do not delete)

| Thing | Named source | Why |
|---|---|---|
| `screening_retained_ledger` | AGENTS.md (money) | past screening spend is still accounted |
| `website_capture_withdrawal_screening`, `_native_g1`, `_team_scene`, `_rigid_probe` | privacy hard stop | each must outlive its lane's site data |
| `policy_canary_official_billing` | money | until trial-era Vast invoices are settled |
| `wam_provider_object_store` and 3 other trial-named helpers | simulation build | live staging; rename (T1) |
| Scene-intake worker lane, launch receipt route A93 | owner direction 2026-11-12 (website job path) | the simulation build needs them |
| `captureUploadSessions`, `captureLifecycleForwarding.ts` | packet record; withdrawal | company simulation status; withdrawal hand-off |
| `retiredCapturerRoutes.ts` | owner 2026-11-11 | explicit 410 to old app clients |
| Suppression branch of the email webhook | provider terms, unsubscribe law | honours complaints and unsubscribes |
| GPU spend guard | money hard stop | fix its RunPod read; do not delete |
