# Blueprint First-Principles MVP Report

Date: 2026-03-10

Status: Internal working memo

## Executive summary

Blueprint's MVP should be a **qualification platform**, not a marketplace, not a capture gig network, and not a robot adaptation lab by default.

The default product should be a standardized intake-to-decision pipeline:

1. An operator submits a site, task, and constraints.
2. Blueprint collects guided evidence for the exact task zone.
3. Blueprint runs automated QA, completeness checks, scoping, and risk extraction.
4. Blueprint produces a structured qualification record.
5. Human review handles low-confidence, high-risk, incomplete, or externally shared cases.
6. Qualified sites emit a match-ready opportunity handoff.
7. Only then can a site move into scene-package generation, evaluation, or adaptation work.

That is the important change. The default Blueprint output is not a scene artifact. It is a reusable qualification record plus a routing object.

The current stack is real. The problem is that the center of gravity is wrong. The public WebApp still carries marketplace assumptions. The capture app still behaves like a nearby-target and reservation system. `BlueprintCapturePipeline` is still defined around sim-ready scene assembly. `BlueprintValidation` is explicitly centered on policy trust, world-model adaptation, and PolaRiS-backed evaluation. Those are later-stage systems. The missing MVP is the qualification layer in the middle.

NuRec should stay in the architecture, but it should stop defining the product. It should become a bounded follow-on tool for geometry escalation, not the default output-defining step for every new site.

## The product Blueprint should sell first

### Primary buyer

Site operator.

This buyer owns the site, workflow, permissions, and real deployment decision. The MVP should start there.

### Secondary buyer

Robot team with a site already in hand.

That still begins with qualification. The difference is who initiates the workflow, not what the product is.

### Core job

Determine whether a real site and workflow are ready enough to justify deeper pursuit.

### Default product definition

Blueprint should productize site qualification as a repeatable software workflow.

The first product is not a consulting memo. It is a system that turns raw submissions and walkthrough evidence into:

- a structured site record
- an automated QA and readiness scorecard
- a machine-readable qualification brief
- a match-ready opportunity handoff for qualified sites

Human review should be the exception path, not the default production engine.

### Explicit non-defaults

These are not part of the MVP-default product:

- generalized marketplace browsing
- scene packages as the default output
- USD assembly as the default output
- teleop capture loops
- RLDS export
- policy tuning
- world-model fine-tuning
- PolaRiS final-gate evaluation
- managed adaptation as the first engagement

Those may all matter later. They should not define the first sellable product.

## The canonical MVP flow

### Stage 0: Intake

The system begins with a site submission, not a marketplace lead and not a capture reservation.

Minimum required inputs:

- site identity and location
- buyer type
- concrete task statement
- workflow context
- workcell or task-zone boundaries if known
- operating hours and constraints
- privacy and security restrictions
- known blockers and safety concerns
- target robot, integrator, or embodiment assumptions if already known

If the task is vague, the system should not pretend the site is qualified. It should return a scope problem early.

### Stage 1: Guided evidence capture

The capture app should collect evidence for a known workflow question.

Default hardware:

- modern iPhone or equivalent phone capture

Optional hardware:

- ARKit pose and depth when available
- richer capture only when later-stage evaluation justifies it

Not required for the MVP:

- robot on site
- teleop rig
- calibration markers as a default path
- specialized sensor suite

Required capture content:

- walkthrough of the task zone
- adjacent workflow context
- ingress and egress
- aisle width and clearance constraints
- handoff points and bottlenecks
- obstacles, clutter, floor transitions, and reflective surfaces
- human traffic and restricted zones
- motion / IMU stream aligned to video
- ARKit poses, intrinsics, frames, and depth when available

This is evidence capture, not a promise that every site becomes a simulator artifact.

### Stage 2: Automated QA and completeness

Before any deeper processing, the system should answer:

- is the footage usable
- is the task zone sufficiently covered
- are key views missing
- are privacy restrictions masking decision-critical areas
- is another capture pass required

Allowed result at this stage:

- `need_more_evidence`

This is not a readiness decision yet. It is a truth check on whether the system has enough evidence to proceed.

### Stage 3: Task scoping and constraint extraction

The system should convert raw evidence into an explicit scoped question:

- what exact task is under evaluation
- what area is in scope
- what adjacent workflow matters
- what counts as pilot success
- what assumptions are currently being made
- what blockers or unknowns are already visible

This is the step the current stack does not really own today.

### Stage 4: Qualification decision

The qualification layer should score the site across a fixed rubric:

- physical access and clearances
- task repeatability and variance
- environmental conditions
- safety and process constraints
- integration friction
- unknowns and follow-up burden

Allowed readiness states:

- `ready`
- `risky`
- `not_ready_yet`

The system should also carry confidence and escalation metadata.

### Stage 5: Opportunity handoff

If the site clears enough gates, Blueprint should produce a structured handoff for robot-team review.

That handoff is the bridge from operator-side qualification into downstream matching, evaluation, and later paid work.

### Stage 6: Advanced follow-on lanes

Only after qualification should a site enter:

- geometry escalation with NuRec
- scene-package generation
- team-specific evaluation
- stack-specific adaptation

That split is what turns the business from custom services into a platform workflow.

## Canonical artifact set

The MVP should standardize around JSON-first artifacts.

### Default artifacts

1. `site_intake.json`
2. `capture_package_manifest.json`
3. `capture_qa_scorecard.json`
4. `task_scope_record.json`
5. `qualification_record.json`
6. `qualification_brief.json`
7. `opportunity_handoff.json`

### Raw evidence artifacts

- `mp4`
- `jsonl`
- `object_index.json` once a canonical object index has been built
- thumbnails and preview stills
- optional ARKit depth and mesh outputs

### Advanced-lane artifacts

These should exist only when later work justifies them:

- `ply`
- `3dgs_compressed.ply`
- `usda`
- `scene_manifest.json`
- `labels.json`
- `structure.json`
- `task_targets.synthetic.json`
- optional occupancy outputs
- scene package
- evaluation package
- RLDS bundle
- policy training artifacts

### Preferred geometry handoff format

If Blueprint generates or returns a splat or PLY for later-stage work, it should prefer an InteriorGS-like bundle over a naked geometry file.

The useful format is:

- `3dgs_compressed.ply`
- `labels.json`
- `structure.json`
- `task_targets.synthetic.json` or equivalent camera-targetable task hints
- optional occupancy artifacts

That matters because the downstream problem is not just "have a splat." It is "know where each thing is well enough to point a camera at it, render targeted views, and bootstrap task-local reasoning."

In practice, that means the geometry bundle should preserve:

- object identity
- semantic label
- world-space center
- extents or OBB
- articulation hints
- support-surface and room-structure context

This does not change the MVP-default product definition. Qualification artifacts are still the default output. It does change what the advanced geometry lane should emit once a site has earned deeper work.

## Draft contract requirements

The report does not need full JSON Schema. It does need enough field-level specificity that the repos can be changed against a real target.

### `site_intake.json`

Required fields:

- `site_submission_id`
- `site_id`
- `buyer_type`
- `site_name`
- `site_location`
- `task_statement`
- `workflow_context`
- `operating_constraints`
- `privacy_security_constraints`
- `known_blockers`
- `target_robot_team`
- `created_at`

### `capture_package_manifest.json`

Required fields:

- `site_submission_id`
- `site_id`
- `task_id`
- `capture_pass_id`
- `media_files`
- `device_facts`
- `capture_started_at`
- `capture_completed_at`
- `arkit_available`
- `capture_checklist`
- `zone_coverage_declarations`
- `privacy_annotations`

### `capture_qa_scorecard.json`

Required fields:

- `site_submission_id`
- `capture_pass_id`
- `usable_footage`
- `missing_views`
- `blur_score`
- `lighting_score`
- `motion_score`
- `coverage_sufficiency`
- `privacy_occlusion_impact`
- `confidence`
- `need_more_evidence`
- `recommended_recap_actions`

### `task_scope_record.json`

Required fields:

- `site_submission_id`
- `task_id`
- `scoped_task_statement`
- `in_scope_zone`
- `adjacent_workflow`
- `success_criteria`
- `operating_assumptions`
- `blocker_candidates`
- `open_questions`

### `qualification_record.json`

Required fields:

- `site_submission_id`
- `task_id`
- `readiness_state`
- `confidence`
- `rubric_scores`
- `required_follow_ups`
- `escalation_reason`
- `human_review_required`
- `reviewer_overrides`
- `recommended_next_step`

### `qualification_brief.json`

Required fields:

- `site_submission_id`
- `task_id`
- `site_summary`
- `task_summary`
- `pass_criteria`
- `key_constraints`
- `risks`
- `open_questions`
- `recommended_next_step`

### `opportunity_handoff.json`

Required fields:

- `site_submission_id`
- `opportunity_id`
- `disclosure_level`
- `operator_approved_summary`
- `target_robot_capabilities`
- `key_constraints`
- `qualification_state`
- `recommended_next_step`
- `downstream_evaluation_eligibility`

## AI and human review

The right operating model is still AI-assisted and human-owned. The difference is where the human time sits.

### What AI should do first

- capture QA and completeness checks
- task-zone and workflow scoping drafts
- blocker extraction
- evidence summarization
- qualification record drafting

### What humans should still own

- low-confidence cases
- externally shared outputs
- safety-sensitive judgment
- final readiness overrides
- approval of opportunity handoff

### What should change operationally

Right now the process reads like a tech-enabled service with human review built into the middle of nearly every job. The platform version should move humans toward:

- exception handling
- review queue management
- approval of shareable outputs
- periodic rubric tuning

That is the only way throughput improves without headcount scaling linearly.

## What the current repos are doing now

### WebApp and ops workflow

The public framing has improved, but the product surface is still mixed.

The codebase still exposes marketplace-first routes and surfaces. `client/src/app/routes.tsx` still treats `/marketplace`, environment listings, and marketplace detail routes as first-class product surfaces. `client/src/pages/BusinessSignUpFlow.tsx` still asks for marketplace-style needs such as scene-library access, dataset packs, and custom capture. `server/types/inbound-request.ts` and `server/routes/inbound-request.ts` still define lead taxonomy around benchmark packs, scene-library, dataset packs, custom capture, and pilot-exchange requests.

That is not a qualification intake system. It is a hybrid of marketing refresh on top of old product assumptions.

### BlueprintCapture

The accessible worktree at `/Users/nijelhunt_1/.cursor/worktrees/BlueprintCapture/Cydvx` shows the app is still structurally centered on nearby targets, reservations, and completion flows.

Examples:

- `Views/NearbyTargetsView.swift` and `ViewModels/NearbyTargetsViewModel.swift` are built around nearby-target discovery
- `Services/ReservationService.swift` and `Services/TargetStateService.swift` manage reservation and check-in state
- `Services/CaptureUploadService.swift` keys uploads off `targetId`, `reservationId`, and `jobId`
- `CaptureFlowViewModel.swift` creates upload jobs from those same identifiers

The capture engine itself is useful. `VideoCaptureManager.swift` already records video, motion logs, manifests, and optional ARKit depth and mesh outputs. That is real infrastructure. The problem is the surrounding product model. It still assumes field capture against a location marketplace, not operator-owned qualification evidence.

### BlueprintCapturePipeline

This repo is currently explicit about what it thinks the product is. The README defines it as NuRec-first orchestration for converting capture descriptors into sim-ready scenes with swappable assets. The capture bridge contract requires a passed QA report and then produces `nurec_outputs.json`, `swap_candidates.json`, `scene_manifest.json`, layout, inventory, simready preparation, and downstream scene artifacts.

That is useful later. It is the wrong default for the MVP.

The good news is that the repo already has pieces that matter for qualification:

- descriptor parsing
- manifest handling
- task-target inference
- quality gates
- object index handling
- pipeline summaries

Those should be preserved. What should change is the default output contract and the point where the pipeline is allowed to stop.

There is also a useful downstream format hint here. If the repo does produce a splat or PLY, it should aim to emit an InteriorGS-like geometry bundle with companion semantic files rather than a standalone geometry artifact. That makes the output far more useful for targeted camera planning and later validation work.

### BlueprintValidation

This repo is also very clear about its purpose. The README defines the canonical question as which policy to trust for an exact deployment scene. The pipeline stages are render, enrich, world-model tuning, rollout evaluation, policy tuning, PolaRiS, and reporting. The default config model starts from `facility.ply`, task hints, and manipulation zones.

That is not a qualification system. It is a post-qualification evaluation stack.

Again, this is useful infrastructure. It is just not the MVP core.

It also means that an InteriorGS-like bundle is a good follow-on target. `BlueprintValidation` already has code paths that look for `3dgs_compressed.ply` with `labels.json` and `structure.json` alongside it, then use that metadata to bootstrap task hints instead of falling back to weaker first-pass inference.

## Repo reset recommendations

### WebApp

The WebApp needs a real intake and review model for qualification.

#### Required resets

- replace marketplace-first signup taxonomy with qualification-first intake
- replace lead categories with qualification, deeper evaluation, and managed tuning lanes
- create internal review states and escalation queue
- move internal identifiers to `site_submission_id`, `qualification_state`, and `opportunity_state`

#### New default internal states

- `submitted`
- `capture_requested`
- `qa_passed`
- `needs_more_evidence`
- `in_review`
- `qualified_ready`
- `qualified_risky`
- `not_ready_yet`
- `handoff_ready`
- `escalated_to_geometry`
- `escalated_to_validation`

#### What should stop being primary

- `/marketplace` as a top-level product story
- pilot-exchange-style submission taxonomy
- scene and dataset shopping as the main entrypoint

### BlueprintCapture

The app should stop behaving like a location-reservation network and start behaving like a guided evidence collection tool.

#### Required resets

- remove nearby-target, payout, and check-in as the default product frame
- tie capture to operator-owned site submissions
- change upload metadata to:
  - `submission_id`
  - `site_id`
  - `task_id`
  - `capture_pass_id`
- expand the capture manifest with:
  - task statement
  - workcell boundaries
  - privacy restrictions
  - checklist completion
  - evidence coverage metadata

#### What should stay

- phone capture default
- motion logs
- manifest writing
- optional ARKit enrichment

The capture engine is not the problem. The surrounding workflow and metadata model are.

### BlueprintCapturePipeline

This repo should be split conceptually into two lanes.

#### Lane 1: Qualification lane

Default path:

- intake normalization
- capture QA and completeness
- task scoping
- blocker extraction
- qualification record generation

This lane should be allowed to stop without reconstruction.

#### Lane 2: Advanced geometry lane

Triggered only when:

- the site is promising but geometry is ambiguous
- clearances or access claims need deeper support
- a qualified site is moving toward evaluation

NuRec should live here.

#### Required resets

- change the default trigger target from scene assembly to qualification artifacts
- redirect task-target inference, geometry hints, and quality checks into qualification-support outputs
- move SAM3D assetization, simready assembly, and data-gen exports behind an explicit advanced trigger
- when NuRec runs, prefer emitting an InteriorGS-like bundle:
  - `3dgs_compressed.ply`
  - `labels.json`
  - `structure.json`
  - `task_targets.synthetic.json`

NuRec should remain in the architecture. It should just stop acting like the definition of the product.

### BlueprintValidation

This repo should be reclassified, not deleted.

#### Required resets

- treat it as post-qualification only
- change intake from `facility PLY + task hints` to `qualified opportunity handoff + optional derived scene assets`
- make its role explicit: it answers later stack-specific questions, not site-worthiness

#### Thin handoff contract

Validation should consume:

- qualified task definition
- site constraints
- success criteria
- target robot or team
- optional geometry package
- optional scene package when justified

If the geometry package exists, the preferred shape is an InteriorGS-like bundle with object locations and scene structure intact. That is much more useful than a standalone PLY because it already answers the camera-targeting question for downstream rendering and task bootstrapping.

## The role of NuRec

NuRec should stay.

That said, the business should stop forcing every submission through a reconstruction-defined path. The right framing is:

- default MVP path: qualification without reconstruction when evidence is sufficient
- escalation path: NuRec for bounded geometry support when needed
- advanced path: scene-package and evaluation work after qualification

This keeps the real asset you already have without letting it pull the whole company into the wrong product definition.

## What the 90-day build should look like

### 0-30 days

- rewrite intake taxonomy and internal state model in the WebApp
- define the canonical qualification artifacts
- change capture metadata around site submissions instead of target reservations
- add qualification-lane output contracts in `BlueprintCapturePipeline`
- formally reclassify `BlueprintValidation` as post-qualification

### 30-60 days

- ship internal review queue and approval states
- add capture QA tied to qualification completeness
- emit `task_scope_record.json`, `qualification_record.json`, and `qualification_brief.json`
- add explicit geometry-escalation trigger for NuRec rather than always-on reconstruction

### 60-90 days

- emit `opportunity_handoff.json`
- add match-ready routing for qualified sites
- add bounded evaluation handoff into `BlueprintValidation`
- keep scene package and adaptation work behind explicit follow-on triggers

## Test plan and acceptance criteria

The MVP should cleanly handle these cases:

1. Operator submits a site with only phone capture and a concrete workflow. The system returns structured qualification artifacts without requiring reconstruction.
2. Capture is incomplete. The system returns `need_more_evidence` and does not trigger validation.
3. Site is clearly blocked. The system returns `not_ready_yet` with machine-readable blocker categories.
4. Site is borderline. The system returns `risky`, bounded follow-ups, and human escalation.
5. Site qualifies. The system emits `qualification_brief.json` and `opportunity_handoff.json`.
6. Validation does not run unless the site is qualified and the next question is stack-specific.
7. Submission volume can increase without reviewer headcount scaling proportionally because high-confidence cases flow through with exception-based review.

## Final view

Blueprint does not need to throw away its current technical assets. The repos already contain real capture, geometry, and evaluation infrastructure. The problem is that those layers have become the product story.

The MVP should reverse that order.

Blueprint should sell a standardized qualification system first. It should produce a reusable qualification record second. It should route qualified opportunities third. Only after that should it invoke NuRec for deeper geometry or move into `BlueprintValidation` for stack-specific evaluation.

That is the cleaner product, the more scalable workflow, and the more credible venture story.
