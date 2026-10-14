# Beta launch audit — 14 October 2026

Scope: Blueprint-WebApp and BlueprintCapturePipeline, audited against what the
public site promises after the founder's 2026-10-13 decision. Read-only audit:
no deploys, provider calls, sends, payments, or production writes. WebApp
`main` at `6e49314`; Pipeline `main` at `25946c9`.

> **Status: in progress.** Sections L3–L5 are complete and source-verified; the remaining sections are being filled in on this branch.

<!-- VERDICT -->

## 1. The promise, reduced to what must be true

The home page makes three promises: *show us the task*; *invited teams test it
in a simulation built from your site*; *book the recommended pilot*. The
`/beta` page adds that everything is free and that a site is told when no team
has passed. For that to be true for a site that signs up today, every link in
this chain must hold:

| # | Link | Must be true |
|---|---|---|
| L1 | Understand | A site owner understands the offer, its limits, and what they will get, from the public pages alone. |
| L2 | Submit | They can describe one recurring job and share footage, with consent they actually chose. |
| L3 | Build | Blueprint turns that footage into a simulation of *their* site and a scoreable version of *their* task. |
| L4 | Supply | Invited robot teams exist, are willing, and run a robot the simulator supports. |
| L5 | Evaluate | A team's own policy runs in that simulation for enough episodes to be judged against the job's pass mark. |
| L6 | Recommend | When one passes, the site sees one recommendation with honest limits; when none passes, it is told so. |
| L7 | Book | "Book this pilot" reaches the team, and the physical pilot is arranged. |
| X | Operate | Each site is supported by a human with bounded cost, monitored systems, sound security, and legal terms that match behavior. |

A chain is as strong as its weakest link. The rest of this document grades each
link from code and retained evidence.

<!-- LINKS-WEB -->

### L3 — Build a simulation of *their* site: **partial, engineer-driven, never the captured room**

What works, with live website-origin evidence
(`docs/website-task-pipeline-completion.md`, steps 1–10):

- browser video → confirmed task digest;
- MapAnything depth and cameras on Vast;
- Gemini task, coverage and object analysis, then SAM 3.1 tracking;
- GPT Image removal of the task object, then a Marble reconstruction;
- an authored replacement USD for the task object.

The gaps:

- **The captured room has never been the simulation.** Step 11 (register the
  base to the original references) is *pending*. The Marble collider lacks
  support beneath the registered object (`website-task-pipeline-completion.md`
  step 11). The policy run therefore used an authored development surface, and
  `captured_scene_integration` is still `"pending"` in Pipeline
  `website_object_local_frame.py` and `website_development_test.py`. The drawer
  attempt was blocked by `website_registration_anchor_frame_missing`
  (`docs/drawer-scene-website-e2e-completion.md`). The home page's "a simulation
  built from your site" is today a simulation of *the task object from your
  site* on a Blueprint-authored surface.
- **Only two task families score.**
  - `rigid_pick_place`/`planar_push` and `articulated_open_close` are the only
    families in Pipeline `adp_task_scoring.py`.
  - Every other job a site can type into the form has no scorer.
  - Per Pipeline `scene_placement/robot_profile.py` (after `1f91cce`),
    humanoid, mobile and wheeled set-ups are
    `requirements_only_no_registered_adapter_or_asset`.
- **Every scene needs people.**
  - A Claude Code cloud session drives each stage through the operator door
    (`docs/runbooks/cloud-scene-runs.md`).
  - Articulated construction is quoted at $21–35, above the $20 native
    ceiling, so each scene needs an owner budget grant (Pipeline `e44ced5`,
    `c01d0de`).
  - Attempt allowances are amended by hand.
  - Host env edits (the development-surface allowlist) still need the
    founder's Mac (`cloud-scene-runs.md` § "What still needs the Mac").
- **Throughput is about one scene at a time.**
  - Blue object: 3 days to a published result.
  - Drawer: more than 5 days, incomplete, with $81.72 of an $84 cap held.
  - Dishwasher (the founder's own test site): more than 3 weeks, still in
    articulated construction as of 10-12, after more than 10 fix PRs.
  - Constraints: three Vast launch slots shared with other lanes
    (`vast_launch_slots.py`); one control-plane droplet with a 100 GB volume,
    whose rebuild drill has never been run (Pipeline
    `docs/CONTROL_PLANE_CAPACITY_PLAN.md`); and Marble as the only
    reconstruction provider (Atlas is unavailable).
- **Direct provider cost is modest: about $30–45 per site.** That is
  preparation ≤$5, construction $20–35, and about $1 per 10-cell policy run,
  plus held attempts. Cost is not the constraint. Engineering attention and
  reliability are.

### L4 — Willing robot teams on a supported robot: **unproven, and narrower than the page implies**

- **No admitted partner on record.** Pipeline
  `docs/arm_decision_proof_v1/ADP_010_BLOCKER_ACTION_PACKET.md` records
  "admitted partner count: `0`". It names ten missing pieces of partner
  evidence, among them two runnable candidates, task owner, and integration
  inventory. The file has not changed since. The beta acceptance packet says
  "Neither a registry entry nor a fixture proves a team is willing for a live
  pilot" (`docs/beta/INVITED_BETA_ACCEPTANCE.md`).
- **The registry seed is prospects, correctly.**
  - `server/data/robotTeamSeed.ts` lists real companies as `status: "prospect"`
    with quoted, sourced figures.
  - `matchRobotTeam` returns `provisional` for all of them.
  - No relationship is implied. That is the right design, but it is not
    supply.
- **Only one robot can be evaluated.**
  - The website runtime supports a Franka arm with a Robotiq 2F-85 on the
    DROID interface.
  - Unitree G1 exists as a development registry for one retained scene
    (Pipeline `docs/arm_decision_proof_v1/G1_TEAM_CAMPAIGN_REGISTRY.md`).
  - `/for-robot-teams` says "Tell us what your robot can do", and the home
    page example shows a humanoid moving totes. A mobile-manipulator,
    AMR or humanoid team that applies today cannot be evaluated, and nothing
    tells them so before they invest time.
- **The team-discovery work is unmerged.** WebApp PRs #831 and #834 (weekly
  robot-team discovery and directory refresh) have been open since 10-03.

Supply is a founder task more than a code task. For the beta to deliver even
one recommendation, a small number of named teams must agree to:

1. run a policy on the supported interface;
2. accept a free evaluation on a real job;
3. take the pilot if they pass.

Those agreements should be recorded before sites are told teams will
evaluate their job.

### L5 — A team's own policy runs long enough to be judged: **missing**

This is the link the whole promise rests on, and no path through it exists
today.

- **The website scene runtime runs only Blueprint's two frozen public
  policies.** Pipeline `task_evaluation_policy_canary_model_rights.py:22` is
  `CANDIDATES = ("pi05_droid", "groot_n17_droid")`. Anything else fails
  closed. The only preset is `quick_10`; `standard_100` and `deep_500` are
  "coming later".
- **The path built for external team policies runs exactly one episode.**
  Pipeline `controlled_native_queue.py:121` raises
  `controlled_native_execution_budget_or_episode_scope_invalid` unless
  `episodes == 1`. It runs HTTPS policies on the one sealed Franka rigid task.
- **The recommendation rule needs at least 10 episodes at the job's pass
  mark.** That is `MINIMUM_EVIDENCE_EPISODES = 10` and a default pass mark of
  90% (`server/utils/pilotRecommendationEvidence.ts:57-59,234-237`). These are
  correct guards, but no runtime can currently satisfy them for a team.
- **The team-policy plumbing is real but has never run a task.**
  `docs/robot-team-policy-live-proof-20260928/README.md` proves these live:
  - private model upload;
  - sandboxed container inference (runsc, nine network-denial probes);
  - authenticated HTTPS policy transport;
  - KMS credential leases;
  - outbox forwarding.

  It also states "automated native task execution was not exercised", and
  "registration does not prove execution".
- **No policy has ever succeeded at a website task.** The only website-origin
  run to finish end to end (blue object, 09-19 to 09-22) ran all 10 cells and
  20 outcomes. Step 13 says "Neither policy succeeded at the task". Eight π0.5
  cells were joint-limit rejections. The drawer fixture run collided with the
  cabinet (π0.5) and failed reset parity (GR00T). Zero-shot generalist
  policies at a 90% pass mark will not produce a recommendation. Only a team
  policy tuned for the embodiment and task can.
- **Controls are paused by owner decision** (Pipeline
  `docs/website-controls-pause-2026-09-21.md`), so results are "diagnostic".
  The robot-free success-contract probe added 10-12 (`7d85948`, `b656175`) is
  the natural replacement admission check, but it is not yet mandatory.
- **The founder dispatch stop.** The Pipeline agent-run dispatcher carries a
  founder stop with `require_explicit_release: true` (Pipeline
  `docs/OPERATOR_DOOR.md`; `docs/free-beta-readiness-2026-10-05.md` item 2).
  Neither repo records a release since 10-05. Its live state is only readable
  through `door status`.
- **Spend lock coverage was incomplete.** `PAID_SPEND_ADMISSION_LOCK` needs
  current billing reconciliation. Vast coverage was "incomplete" on 09-30
  (`docs/launch-readiness/2026-09-30.md` LR-05), and AWS is uncovered.

Smallest path to close L5: let the existing `quick_10` policy-canary runtime
accept one *team* candidate in place of the frozen pair. Begin with a team's
fine-tuned π0.5-DROID or GR00T-N1.7 checkpoint, or an HTTPS policy on the same
DROID Franka interface, reusing the proven sandbox and lease. Then do one live
proof with a friendly team on a scene that passed the robot-free probe. The
Pipeline audit estimates this at 1–2 weeks of engineering plus one live run
(inferred).

<!-- LINKS -->

<!-- BLOCKERS -->

<!-- DECISIONS -->

<!-- SHAPE -->

<!-- CHECKS -->
