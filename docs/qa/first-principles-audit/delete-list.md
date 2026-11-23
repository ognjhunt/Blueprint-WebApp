# Delete list

2026-11-22. Every system, stage, route, rule, flag, test, email and piece of
copy that can go. Nothing has been deleted. Each row says why, what it costs
today, what depends on it, and how to remove it safely. The order is prize
against risk: big and safe first.

The rule used: a thing stays only if a named owner direction, a doctrine line,
a law or one of the three hard stops (privacy, rights, money) needs it. "The
code does it" and "a test pins it" count as nobody. The row-by-row verdicts
for 429 steps, fields, rules, stages and timers are in
`requirements-ledger.md`: 160 delete, 69 simplify, 25 merge, 168 keep.

## The prize, in numbers

About 80,700 Pipeline lines in 181 modules and about 21,000 WebApp source
lines. About 160 test files. 16 shipped unit files and 229 units that live
only on the host. At least 67 GiB of disk. About 4 CPU-hours a day of timers
that collect nothing. 4 WebApp packages and one Pipeline dependency. Nine
kinds of manual step. (Sources: `raw/dim-vestigial.md`, `raw/journey-D.md`.)

## Processes, gates and manual steps

| # | Delete | Why | Cost today | What depends on it | How to remove it safely | Finding |
|---|---|---|---|---|---|---|
| 1 | The GPU object build as a gate in front of the company simulation | The room, the object as filmed and the success rule are already a simulation. The build has never finished for a website job. | The only real job lost 6.3 of its 7 days there and produced nothing. 14 pipeline steps instead of 5. | The package builder takes its source from the built scene first; a room fallback exists and did not fire. | First find why the fallback did not fire (replay only). Then make the room the source as soon as it is ready. Keep the build as a later upgrade. Owner OK: it changes what a company is given. | C-01 |
| 2 | The RunPod key file on the host | RunPod was retired on 2026-11-05. | The money guard has failed on every run since 2026-11-13 (4,984 failures by 2026-11-22) and alerts every hour. A real failure would look the same. | Nothing: once the key is gone the guard treats RunPod as retired. | Owner closes the account and deletes the key. No code change. | D-01 |
| 3 | Taking a job down when Blueprint's 7-day work window ends | It protects none of privacy, rights or money. The $40 cap is the money bound. | A slow job vanishes for every company and Introduce us is refused. 3 upload sessions ended this way. | The same code path also closes a job on withdrawal, source revocation and owner close. Those must stay. | Close only for those three endings. Tests for `teamJobAccess` and the introduction gate. | G-01 |
| 4 | "Film it again" for a fit code, and "wait until two hours before the window ends" | Doctrine: flag it and keep going. | The real job sat 10.5 hours on such a hold. | The held hand-off replay also carries consent checks: keep those. | Ship the room flagged. Keep the page to the operator. | C-04, G-04 |
| 5 | The owner's approval of each window extension, and the success-threshold confirmation | An extension moves only time. The confirmation changes no threshold and nothing waits for it. | Two operator commands, each with a preview, an apply and written evidence. | Nothing reads the confirmation. | Let an expired window end the job with what it has. Remove the door command after the code that calls it. | G-10, D-13 |
| 6 | The once-a-day deploy rule, and recording each deploy in the tracker | Nobody follows it: 146 deploys in November (153 deploy receipts). The door already holds a deploy while paid work is in flight. | Each deploy paused every job trigger for about 7 minutes and retired work in flight: 26 of one job's 28 preparations. | The rule exists because a deploy retires in-flight work. | First make a preparation finish on the release that started it. Then delete the rule. Owner OK. | C-02 |
| 7 | Staff forms that record a send or a company's answer by hand | No person should stand between a video and an introduction. Never used: 0 sends in production. | Two forms and their routes. | The staff hold on the same page is Blueprint's only staff stop for privacy or rights. | Delete the two forms. Keep the hold, and require a reason. | D-09 |
| 8 | The beta cohort check in front of every WebApp deploy | No code enforces the cohort controls it checks. Its "kill switch" pauses nothing. | It can roll back any deploy. | The deploy readiness check reads 7 environment names. | Remove the check and the names together. Owner decides whether a real pause is wanted. | V-02 |
| 9 | The per-call "release admitted" check before paid room calls | The door already deploys only commits on `main`. | It stopped two internal test jobs for days. No real job is shown to have hit it. | Money: it keeps paid calls off unreleased code. | Check once at deploy instead of per call. | C-05 |
| 10 | Slack bells and alerts for retired steps | They name screening calls, hand footage review and grants that no longer exist. One tells staff a person will review footage, which is untrue. | Noise. | Nothing. | Delete the senders. | D-11 |

## Code, routes, timers and data

| # | Delete | Why | Cost today | What depends on it | How to remove it safely | Finding |
|---|---|---|---|---|---|---|
| 11 | 206 stale failed units and 229 host-only units | Finished experiments from September and October. | They bury the one unit that matters in a 135 KB status. | Nothing in the repository ships them. | Door requests, in the order in section 3 below. Owner OK: these are operate requests. | IP-03 |
| 12 | The episode-compilation lane and its timers | It served the dropped trial. | About 1,180 runs a day, about 4 CPU-hours, zero rows. 17 modules, 17,152 lines, 6 unit files. | Two live modules import pieces of it. | Cut the two imports first. Section 1 below. | V-01 |
| 13 | The staff captures page and the capture-uploads API | A retired staff upload page for 360 cameras. | Its API accepts any invited account, with no admin check, and includes reconstruction authorize and execute. | `captureUploadSessions` and the lifecycle forwarding are still used by today's job. Keep them. | Add the admin check first (one line). Then delete the page, client and router. | D-10 |
| 14 | The email delivery-event store, and the retired analytics writer | Built for growth campaigns that no longer run. Nothing reads either. | 403 rows holding recipient and subject of every email; 399 are job emails. 1,247 analytics rows. | The suppression list is separate and must stay. | Stop writing first. Then delete the rows with the owner's OK. | O-01, O-13 |
| 15 | The development authoring consent fields in production | The form no longer shows them outside development. | Production still accepts them from a hand-made request. Two records carry them. | Development builds use them. | Ignore the fields outside development. Owner says what the two records are. | A-04 |
| 16 | The dropped trial in the Pipeline | Dropped on 2026-11-14. | 59 import edges from 41 live modules into 22 trial modules. | 17 of the 59 are shared helpers with trial names; today's job needs them. The withdrawal and money readers of trial records must stay. | Seven PRs: rename the shared helpers first, then delete. Section 15 below. | IP-05 |
| 17 | The dropped trial in the WebApp | Same. | About 10,500 lines, a worker loop, and trial phases inside the job page. | Some routers named for the trial carry today's job (scene execution window, owner success proposal, the two launch routes). | Start from each caller, never from the name. Section 16 below. | IW-02 |
| 18 | API routes nothing calls | No caller in the website, the Pipeline or the scripts. | At most 33 routes. | Two routes first counted as uncalled are called by the live Pipeline through its service files: publication readiness and launch progress. Deleting them would stop job launches. | Delete in small groups. Supply-agreement and marketplace routes need the owner's word. | IW-01 |
| 19 | WebApp files that never run | Not reachable from any entry point. | About 9,000 lines in 36 files, including a direct World Labs client. | Two references sit inside protected texts. | Leave the protected texts alone; delete the rest. Section 9 below. | IW-05 |
| 20 | Retired data in Firestore | Paid evaluations, trial runs, agent runs, outreach. | More than 8,000 records. Some hold a site's job text. | A record that supports a past payment must be kept. | Export counts, then delete, with the owner's OK. Section 14 below. | IW-11, O-04 |
| 21 | Retired data on the host | Lanes no website job feeds. | At least 67 GiB. Retired roles also still count in the disk budget that refused the real job. | Withdrawal deletion must find nothing there first. | Dry run, then an owner-approved deletion list. Section 4 below. | C-12 |
| 22 | Client upload rules for retired folders | No client code uploads there. | Any signed-in account can write up to 500 MB per file, and sign-up is open. | The scenes raw path is described as still used by the Android app: keep it until the third repository confirms. | Remove the five rules in both repositories together. Check the deployed rules first. | IW-04 |
| 23 | Idle lanes, console scripts and modules only tests import | Rigid probe, RunPod and Lambda adapters, nine console scripts, about 50 modules and 30 test files that exist for each other. | Timers every 5 minutes with an empty queue; a $1 spend line. | The rigid probe has a withdrawal reader. | Sections 5, 8, 11, 18 and 20 below. Owner OK for the rigid probe and Astra. | IP-16, IP-11, C-13 |
| 24 | Spend limits of retired lanes, and two alert lines above the account limit | They guard dollars that can no longer be spent. | `AGENTS.md` lists 22 limits. | The GPU rate and fleet limits, the Google Cloud stop and the Vast credit check do real work. Keep them. | Delete only the retired-lane rows and the two alert lines. Owner OK: money. | G-07 |

## Copy, emails, fields and tests

| # | Delete | Why | Cost today | How to remove it safely | Finding |
|---|---|---|---|---|---|
| 25 | "Blueprint will update this job as the work progresses." | Filler. It says nothing a site can act on. | A test pins it. | Remove the line and its pin in one PR. | A-10 |
| 26 | About 65 of the 70 status sentences a job page can show | A site needs five states. | 35 headlines and as many reasons to keep true. | Map every state to one of five. Owner OK for site-facing wording. | A-06 |
| 27 | The "Your job is posted" email | It repeats what the site agreed to when it sent. | One of four emails before the first introduction. | Fold its one new fact into the job link email. Owner chose the four-email list on 2026-11-19. | A-12 |
| 28 | The "Planning a pilot" choice on the start form | It belongs to a retired frame. | One optional field. | Keep "What counts as success?", which the job and the company page read. | A-09 |
| 29 | The password step and the second Terms press for a new company | The invitation link already proves the address. | Two extra steps before the first job. The one approved company stopped here. | Let the link sign the address in. Keep one Terms press: it protects the site's rights. | B-07 |
| 30 | The cookie banner's Marketing choice | No advertising runs. | The policy, the banner and the code say three different things. | Keep the Analytics choice: it gates Blueprint's own event log. Owner edits the policy. | M-03 |
| 31 | Demo PR 1369 | It holds invented quotes and counts. | Risk of showing them. | Close it unmerged. | E-04 |
| 32 | Documents that name deleted files, and runbook steps for the trial | About 250 dead references. Agents are told to trust these documents. | Wrong turns. | Fix or delete, starting with `AGENTS.md` and the cloud scene runbook. | IP-09 |
| 33 | Playwright suites that never run, and a duplicate config | Six site suites run only from a manual script. | Unknown whether they pass. | Either add them to CI or delete them. Do not keep both. | IW-06 |
| 34 | The old onboarding checklist, the experiments framework, unused packages, ten unrouted legal versions | Retired or never called. | A route, a page, profile fields; 4 packages. | Sections 6, 10 and 22 below. Legal versions move to an archive with their digests: owner only. | IW-08, V-06, V-09, V-18 |

## Deletions I expect might have to come back

If none of these came back, the list was not bold enough.

- The modelled object, for jobs whose object moves in parts (a drawer, a lid). As an upgrade to a package that already exists.
- The free-text place on the start form, if companies need a city before they answer.
- The "Your job is posted" email, if the owner wants a notice at the moment of sharing.
- A deploy window, if jobs become frequent enough that the door's hold parks deploys all day.
- The password, for a company that wants to sign in without access to its email.

## Do not delete

Checking found these wrongly marked for deletion, or easy to delete by mistake:

- The two launch routes (publication readiness and progress) and the routers for the scene execution window and the owner success proposal. Today's job uses them.
- The staff hold. It is the only staff stop for a privacy or rights problem.
- "What counts as success?" on the start form.
- The Analytics choice in the cookie banner.
- The listing re-check when an introduction is sent. It stops an introduction on a job under a rights hold.
- The GPU rate and fleet limits, the Google Cloud stop and the Vast credit check.
- The hand settlement of spend that cannot be proven. That is the money stop working.
- The withdrawal readers (`website_capture_withdrawal_*`) and the money readers (`screening_retained_ledger`).
- `captureUploadSessions` and the capture lifecycle forwarding.

## The candidates in detail

The sections below are the working list from the agent that hunted retired
code, with its measurements. Where a row above differs, the row above is
right: it carries the corrections from checking.


### 1. Remote and host episode compilation (Pipeline)

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

### 2. Beta cohort gate and its deploy readiness check (WebApp)

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

### 3. Host-only units: 206 failed transient units, 22 hold-expiry units, 1 canary watchdog (host)

**Why it can go.** These are one-off experiment units from 2026-09-26 to 2026-10-27, hold timers for holds that no longer exist, and a watchdog for a retired canary. None is shipped by the repo.

**Cost today.** 207 red lines in `door status` hide the one real failure, the spend guard (IP-03, D-07). The 22 hold-expiry units are armed.

**What depends on it.** Nothing. The only door hold is an expired one on `blueprint-agent-run-dispatcher.timer`, whose code left on 2026-11-15.

**How to remove.**
1. **Owner** (door `unit` request, operate scope): `reset-failed` the 206 transient units; stop and remove the 22 hold-expiry units and `blueprint-existing-policy-canary-watchdog.service`; release the expired hold.
2. PR (Pipeline): have the release lifecycle reset-failed transient `blueprint-*` units older than 7 days.
3. Check: `door status.failed_units` lists only real units.

---

### 4. Retired-lane disk (host)

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

### 5. Shipped units for idle lanes and checks (Pipeline)

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

### 6. Experiments framework (WebApp)

**Why it can go.** Growth experiments are retired. `resolveExperimentVariant` has no caller, so `/api/experiments/assignments` is never fetched.

**Cost today.** 209 lines, 1 public route, an empty field on every analytics event, and 2 `experiment_rollouts` docs.

**What depends on it.** `client/src/lib/analytics.ts:228` (empty field only).

**How to remove.** One PR: delete both files, the mount at `server/routes.ts:68`, the analytics field and the rules entry.

---

### 7. Growth-campaign storage in the email webhook (WebApp)

**Why it can go.** Growth campaigns are retired; the last campaign was written 2026-06-25.

**Cost today.** Every Resend event stores the recipient address and the full payload in `growth_campaign_events` (403 docs). Privacy: these are unnecessary copies of site and company addresses.

**What depends on it.** Nothing reads it. Suppressions (bounce, complaint, unsubscribe) are written in the same handler and must stay.

**How to remove.**
1. One PR: keep `recordEmailSuppression`; delete the two writes (`server/routes/resend-webhook.ts:50-79`).
2. **Owner:** purge `growth_campaign_events` and `growthCampaigns`.

---

### 8. Pipeline modules imported only by tests or by nothing

**Why it can go.** Nobody asked for them: no unit, guard, deploy script or other script reaches them.

**Cost today.** 50 modules, 20,765 lines (54 found, minus 4 with real dynamic use). Their tests run in the nightly lane, and 30 test files (6,061 lines) test nothing live. AGENTS.md names one of them (`runtime_service_app`) as an entry point (IP-11).

**What depends on it.** Tests only. Keep `_sam_parser_js`, `config.isaacsim_nurec_601.rendering_setup`, `pytest_full_lane_evidence` and `qualification_control_admission`.

**How to remove.**
1. PRs of 5 to 10 modules each, grouped by family: delete the module and its test, and fix any doc line naming it.
2. Second pass: the 79 CLI-only modules (37,702 lines). Keep the owner tools: `impacted_test_selection`, the replays, `test_job_matrix`, `website_capture_withdrawal_drill`, `website_atlas_operator`, `account_spend_limit_drill`.

---

### 9. WebApp files that never run

**Why it can go.** Nobody asked for them. Their systems are the capture-app World Labs purchase, robot match, the marketplace, pilots and web search.

**Cost today.** 36 files, 8,967 lines (IW-05).

**What depends on it.** Type imports (`client/src/types/inbound-request.ts`), other dead files, and hand scripts (`scripts/seed-robot-teams.ts`, `restore-granted-brief.ts`, `requeue-capture-coverage-review.ts`). Two protected texts name `evaluationPricing.ts`: `scripts/claims/cross-source-claims-guard.ts:618` and a comment at `client/src/pages/Terms.tsx:16`.

**How to remove.**
1. PR: delete the six files with no reference at all (601 lines).
2. PR: delete the World Labs chain (1,893 lines) and the robot-match chain (2,240 lines) with their hand scripts and tests. Move needed types first.
3. **Owner:** edit the claims guard line and the Terms comment, then delete `evaluationPricing.ts`.

---

### 10. Unused dependencies (both)

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

### 11. Retired console scripts (Pipeline)

**Why it can go.** RunPod was retired 2026-11-05; Lambda was never used; G1 was paused 2026-11-12; the trial was dropped 2026-11-14.

**Cost today.** 9 of 49 console scripts (`pyproject.toml:278,281,286,288-293`), plus about 10,000 lines behind them.

**What depends on it.** `task_evaluation_dispatcher_cgroup_cleanup.py:24` and `vast_independent_watchdog_control` import `groot_oscar_runpod_watchdog` for one constant.

**How to remove.**
1. PR: move `EVIDENCE_NAME` into the cleanup module.
2. PR: remove the nine entries; delete the RunPod adapter and watchdogs, the Lambda adapter, the six unitree modules and their tests.
3. **Owner** (separately): close the RunPod account and delete the key, which ends the guard failures (IP-02, D-01).

---

### 12. Job-evidence panel, staff captures page, capture-upload routes (WebApp)

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

### 13. Launch-forward and job-evidence worker lanes, submission routes (WebApp + Pipeline)

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

### 14. Retired Firestore data (WebApp)

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

### 15. Early trial in the Pipeline (seven PRs)

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

### 16. Early trial remains in the WebApp

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

### 17. G1 and native humanoid lanes (Pipeline)

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

### 18. Rigid robot-free probe code (Pipeline)

Covered in candidate 5, steps 2 to 4.

**Prize.** 12 modules, 4,403 lines; 18 commits in 30 days; 64 test imports; a $1 spend line.

**Risk.** The withdrawal reader must go last. The owner may want a "solvable" check on the packet later (see "might come back" in the report).

---

### 19. Astra CAD authoring (Pipeline) — owner question

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

### 20. RunPod and Lambda (Pipeline)

Covered in candidate 11.

**Prize.** 5 modules, 5,248 lines. The guard's RunPod read stops when the owner deletes the key. The guard has failed 4,844 times since 2026-11-13.

---

### 21. Stale docs (both)

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

### 22. Legal versions in the app source (WebApp) — Owner

**Why.** Ten frozen Terms and Privacy versions (2,586 lines) are pinned by digest but rendered by no route.

**How.** **Owner** decision: move them to a read-only legal archive with their digests and the version map. The app keeps the current and previous versions. Rights: the archive must keep matching the pinned bytes.

---

### 23. Unrun and duplicate Playwright configs (WebApp)

**Why it can go.** Nobody asked for them: three intake configs never run in CI (685 spec lines), and `playwright.result-consumer.config.ts` duplicates invited-beta.

**How to remove.**
1. If IW-06 decides to run the intake cases, fold them into the default config.
2. Either way, delete the four configs.

---

### Kept on purpose (do not delete)

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
