# Blueprint pipeline implementation prompt

Copy everything below into the next coding session. Give that session access to `BlueprintCapturePipeline`, `Blueprint-WebApp`, and, for coordinated shared-doctrine changes, `BlueprintCapture`.

---

You are implementing the pipeline support for Blueprint's updated product. Inspect the actual repositories, make the necessary code and contract changes, connect them to the website, and complete a useful working implementation. Do not stop after research, a plan, documentation, or an API that nobody can operate.

The owner wants the product **bare bones**. They explicitly said: “stop with adding any extra stuff like checks” and “bare bones.” Keep existing requirements that protect access, rights, scientific truth, physical operations, and authorized spending. Do not introduce extra review stages, certifications, checklists, dashboards, scoring frameworks, or approval loops. Use the simplest existing operating surface. Ask for missing human information only when it actually blocks the next action; complete independent work meanwhile.

## 1. Starting point and source authority

The website implementation is in `ognjhunt/Blueprint-WebApp`, PR [#1077](https://github.com/ognjhunt/Blueprint-WebApp/pull/1077), originally implemented at commit `fb3763306c34c1e31401e205684a5a13a2029b63`. Read the current merged code, because the final release can include follow-up fixes.

The owner asked the website session to merge and deploy this work. Read PR #1077, the current main branch, the existing release workflow, and the live `/version.json` to establish the actual release state. Do not assume the original implementation commit is the final deployed SHA.

The pipeline's `main` was inspected at `599264bda025ffb274996037d2ac997ec53f8a1b` on October 21, 2026. That is a research snapshot, not an instruction to reset the repo. It includes the October 19 fidelity-profile templates and site-measurement catalog. Inspect current `main`, current deployment identities, pending work, and any newer owner directions before editing. Preserve unrelated changes and work in a suitable branch/worktree.

Read the nearest `AGENTS.md` and these focused sources first:

- WebApp: `docs/design/job-first-automation-marketplace/IMPLEMENTATION.md`, the October 21 preambles in `AGENTS.md`, `PLATFORM_CONTEXT.md`, and `WORLD_MODEL_STRATEGY_CONTEXT.md`.
- WebApp: `client/src/types/jobMarketplace.ts`, `server/routes/job-workflow.ts`, `server/utils/jobMarketplaceWorkflow.ts`, `client/src/components/admin/JobWorkflowPanel.tsx`, and the owner `JobWorkspace` component.
- Pipeline: `AGENTS.md`, `docs/DOCTRINE_PRECEDENCE.md`, `doctrine/README.md`, the three canonical doctrine fragments, and the existing architecture/onboarding map.
- Pipeline: `decision_evidence_contracts.py`, `decision_evidence_router.py`, `decision_evidence_execution.py`, `evaluation_run_contract.py`, `evaluation_run_execution.py`, `site_task_testbed_compiler.py`, and their existing consumers. These live under `src/blueprint_pipeline/`.
- Pipeline: `task_evaluation_run_control_plane.py`, `task_evaluation_run_state.py`, `task_evaluation_run_webapp_sync.py`, `site_task_testbed_webapp_sync.py`, `physical_outcome_learning.py`, and the existing launch/admission path.
- Pipeline: `docs/webapp_handoff/decision-evidence-router.v1/`, `docs/architecture/task-site-measurement-routing.md`, `task_site_measurement_routing.py`, `site_task_fidelity_profile_templates.py`, and the existing simulation qualifier.
- Pipeline: `docs/arm_decision_proof_v1/README.md`, `POLICY_CANDIDATE_REGISTRY.md`, `PERSISTENT_POLICY_PAIR.md`, `EXACT_WORKCELL_VARIATION_MATRIX.md`, and `policy_integration_runners_20260928.md`.

Do targeted discovery from those seams. Do not turn this into an unrelated architecture audit or load the entire historical evidence archive.

## 2. The product decision you are implementing

Blueprint should become the place a business submits work it wants automated and gets a suitable, deliverable solution. Independent assessment earns trust today; accumulated delivery evidence makes future matching faster.

The customer buys dependable work at an acceptable total cost. Simulation, policy endpoints, robot hardware, and evaluation infrastructure are means to answer that buying decision. Every job does not need the same evidence process.

The intended journey is:

1. Find a site with one recurring, valuable job, or let the site submit it.
2. Start with a plain description and optional video. Understand volume, current cost, required output, acceptable quality, timing, and who makes the decision. Ask for missing measurements only when they affect a real option or decision.
3. Agree a job brief. Establish what successful work means and the important site constraints.
4. Identify a small number of plausible, supportable complete solutions. Speak to deployment partners early enough to know what they can actually supply, install, and support. Ordinary automation is eligible where appropriate.
5. Reuse relevant prior evidence. Run targeted simulation or other tests only when they resolve an uncertainty that matters. Use physical trials when the remaining question needs physical truth. An unsuitable or insufficiently understood job can end with a clear explanation and next action.
6. Blueprint runs accessible policies itself through licensed APIs, approved hosted endpoints, or supported self-hosted models. A technology team can supply its endpoint or integration when Blueprint lacks access. Inviting every robot team to operate its own evaluation must no longer be mandatory.
7. Obtain comparable written delivery proposals from suitable deployment companies against the same scope and acceptance criteria. The proposal includes hardware, software, integration, preparation, price, timing, support, assumptions, and human assistance.
8. Recommend a complete approach and delivery partner. The customer chooses a proposal. The customer and partner then agree their physical pilot directly. A website selection is not a contract or reservation.
9. Measure the agreed pilot. Keep reported commercial outcomes distinct from authoritative physical evidence. Reuse valid, permitted evidence for the next relevant customer.

This is not an instruction to test every policy against every embodiment, build a universal simulator, or promise an accurate digital twin from any phone video. Build only what resolves the decision. Geometry, appearance, collision, dynamics, and sensor matching have different evidential requirements. Missing observations remain missing.

The longer-term direction is a default destination for robot jobs: concentrated real demand, supportable solutions, available delivery partners, and delivery history. Start with the current supported niche and region. Do not build a social network, public auction, universal search marketplace, or cross-embodiment leaderboard now.

## 3. Commercial behavior and responsibilities

An early budget is useful as a planning constraint or economic ceiling. It is optional for free intake and assessment. Capture current process cost separately from desired future spending. Never convert a customer's labor budget into an approved supplier price or Blueprint spending authority.

Firm supplier prices follow a sufficiently understood scope. Partners can clarify assumptions and revise proposals; revisions need to remain attached to the correct brief. Prefer two or three comparable proposals when real suitable suppliers exist. One credible option is better than invented competition. There is no first-come award and no lowest-price bidding war. Compare installed and operating cost, performance evidence, assistance, installation disruption, delivery timing, and support.

The current beta remains free. This work does **not** introduce Blueprint assessment fees, success fees, a percentage cut, paid provider evaluations, balances, top-ups, checkout, escrow, or future pricing promises. A delivery proposal's installation/monthly price concerns the partner's physical work, not a Blueprint charge. Do not add Stripe or a billing service.

Blueprint owns intake, the agreed brief, comparison, evidence coordination, a reasoned recommendation, and the record of what happened. Deployment partners own the delivery commitments they explicitly make: equipment, installation, integration, training where included, maintenance, and support. The customer approves its choice and physical agreement. A technology provider may supply a policy without being willing or able to deploy it; do not conflate those roles.

Pipeline owns evidence planning, method qualification, execution integrity, normalized scientific results, uncertainty, abstention, claim ceilings, and authoritative Physical Outcome Joins. WebApp owns commercial state and customer interaction. A scientific winner is not automatically the best available commercial proposal. A commercial recommendation cannot change the scientific result.

## 4. Website behavior already implemented

Preserve the simple public language: “Find the right way to automate your work.” The main action is “Submit a job.” Video is optional at entry. The public website has simple partner paths for deployment companies and technology providers. Do not redesign it again as part of this pipeline task.

The commercial types are in `client/src/types/jobMarketplace.ts`. They already define:

- `JobBuyingRequirements`: `jobFrequency`, `purchaseReadiness`, `requiredOutput`, `installationBudget`, `ongoingBudget`, `currentProcessCost`, and `targetStartDate`. `purchaseReadiness` is `exploring`, `planning`, `ready_for_proposals`, or `unsure`.
- `JobOptionsReview`: `options_identified`, `more_information`, or `no_suitable_option`, plus summary, next action, time, and scope revision.
- `DeliveryProposal`: provider, scope, equipment, software, delivery commitment, installation/monthly USD costs or unknown, exclusions, preparation, human assistance, timing, support, evidence summaries, acceptance criteria, and optional recommendation reason.
- Evidence summary labels: `prior_deployment`, `simulation`, `physical_trial`, `unverified`. These commercial labels are not scientific method qualification or permission to issue a physical-validation claim.
- Immutable proposal identity/revision, scope digest, and status `available`, `withdrawn`, or projected `review_required`.
- A customer's proposal selection tied to an exact proposal revision.
- A pilot agreement tied to that same selection, with both parties' agreement references and dates.
- A separately authorized customer-reported outcome containing summary, whether criteria were met or unknown, optional units/hour and interventions/hour, and notes. Its source is explicitly `customer_reported`.

The six commercial stages are `job_submitted`, `brief_agreed`, `options_assessed`, `proposals_ready`, `pilot_agreed`, and `results_recorded`, with a next action and responsible actor. Do not expose internal pipeline states as extra customer stages.

Canonical commercial state lives at `inboundRequests/{requestId}.job_marketplace`. Confirmed briefs live at `siteTaskBriefs/{requestId}`. A bounded journal lives below the request in `jobWorkflowEvents`. Proposal scope digests include both the confirmed brief and buying requirements. Changes require review of affected proposals; an unrelated stale alternative must not prevent using a fresh selected proposal. Requirements freeze after a recorded agreement. Do not mutate an agreed scope silently.

Existing owner routes are mounted under `/api/job-workflow/owner/:token`: GET, PATCH `/requirements`, POST `/select`, and POST `/outcome`. The token is an existing signed owner-link token; it is not a pipeline service credential.

Existing admin routes are under `/api/job-workflow/admin/:requestId`: GET, POST `/review`, POST `/proposals`, PUT `/proposals/:id`, POST `/proposals/:id/withdraw`, and POST `/agreement`. They use existing Firebase authentication and admin role checks. Proposal creation uses `Idempotency-Key`; quote changes use expected revision. Read actual schemas before calling them.

`JobWorkflowPanel` already lets an operator enter real reviews, proposals, and agreement references. `JobWorkspace` already lets an owner review and choose. Use these surfaces for any indispensable additional information. Do not leave a new integration operable only through curl or a hidden database edit, but do not add a new console.

Partner applications use the existing `/api/robot-team-access/apply` route with `partnerRole: deployment|technology` and supported-system information. They remain reviewed applications, not admitted runtimes or verified delivery coverage. Existing qualification/lifecycle messaging has been updated, without authorizing new sends.

One current limitation: outcome recording permission is stored with the agreement and there is no separate later-permission update endpoint. If the real workflow requires recording permission obtained later, implement the smallest authorized amendment path with preserved agreement history; do not redesign consent or silently set permission. Otherwise leave it alone and describe the limitation.

## 5. Inspect first, then decide what actually needs to change

Produce a short implementation map while inspecting: what already works, what blocks this journey, the existing seam to extend, and the concrete result that removes the blocker. Then implement. This is a working map, not a lengthy separate approval document.

Answer these questions from code and persisted contracts:

- What currently triggers capture processing, brief confirmation, scene compilation, policy invitation, launch, and publication? Which are incorrectly mandatory for every commercial job?
- Can a description-only job be assessed without inventing a capture session, testbed, run, or passed evaluation?
- Where do job IDs, intake IDs, capture sessions, approved task digests, testbed versions, run IDs, request/plan/result digests, and proposal revisions join today?
- What already supports evidence reuse, analytical rejection, an information request, physical-only evidence, or a no-suitable-option result?
- Which endpoints are genuinely executable and licensed now, rather than merely listed, admitted for a different embodiment, or historical compatibility code?
- Which existing signed publication and receipt mechanisms can carry the relevant result back into the job?
- Where is the existing operator action that starts the appropriate bounded evaluation? What does the buyer see if it is blocked, abstained, stale, cancelled, or unavailable?

Prefer extensions over replacements. Retain scientific schemas and historical readers where their consumers still exist. Remove obsolete mandatory dependencies from the *normal commercial path* rather than deleting valid evidence-program machinery.

## 6. Evidence planning must serve the decision

A job assessment can have zero evaluation runs. Lack of a simulation is not a failed job when sufficient evidence exists for the next commercial step. Equally, “we have a relevant previous deployment” is not enough to assert performance at a materially different site.

Use the existing Decision/Evidence Router for technical claims. Separate easy commercial screening from scientific evaluation: an unsupported region or unavailable delivery partner can eliminate an offer without generating a fake scientific failure. Analytical reach/payload/fit screening, prior deployment evidence, recorded observations, simulation, and a physical test can answer different questions.

The normal decision request should express the question, candidate identities where relevant, job context, acceptance thresholds, uncertainty limits, restrictions, and authority. The pipeline chooses qualified methods. Do not make customers choose physics engines or backend providers, and do not encode simulator preference as a required customer field.

Return enough structured context to explain: which exact question was answered; what evidence supports it; for which candidate, site, task and conditions; which important assumptions remain; what cannot be concluded; and the smallest useful next action. Reuse existing `DecisionEnvelope`, plan, uncertainty, disagreement, claim-ceiling, and next-experiment structures. A plain-language projection can summarize them without recalculating them.

Reuse the recently added measurement catalog and existing qualifier for targeted measurements. The inspected pipeline has `rigid_pick_place` and `articulated_open_close` fidelity-profile templates. Templates contain proposed thresholds and explicitly require review before a request-specific profile exists. Do not auto-approve those thresholds, generalize that two-family catalog into universal robotics support, or force every initial applicant through all measurements.

An initial phone video may identify the job. Metric capture and task-specific measurements may still be required later for a valid simulation. Identify the missing quantity and why it changes a decision. Preserve measured versus inferred versus authored values. A generated model, splat, render, or world-model rollout cannot become collision, force, safety, or physical-success authority by relabeling it.

## 7. Complete configurations and provider access

A candidate solution is more than a model name. Where needed for a reproducible technical comparison, bind the robot model/configuration, end effector, payload/reach, sensors and placement, observation preprocessing, state schema, action representation/units, normalization, controller, action chunking/rate, latency/network assumptions, inference location, policy identity/version, and adapter/runtime identity.

Do not build an elaborate new registry if existing profiles already represent these facts. Add only missing fields needed for real compatibility, reproducibility, or supportability. Keep declarations separate from tested compatibility and from a partner's commercial willingness to deliver.

Support the existing access patterns where valid:

- Blueprint-managed, licensed self-hosted model through its existing approved worker/runtime.
- Blueprint-managed provider API with server-side credentials and approved observation access.
- A technology team's approved hosted endpoint, approved uploaded-model profile, or existing isolated controller adapter.

All routes must still step the actual environment and use an independent grader for task results. A provider response saying “success,” a submitted skill sequence, or an uploaded package is not an executed episode. Use the current controlled-observation boundary: only approved observations/state go out; no hidden scoring truth, private scene assets, evaluator internals, or secrets. Keep endpoint origin restrictions, timeouts, resource isolation, bounded tensors, retained policy inputs, and actual runtime receipts.

At the inspected pipeline snapshot, `task_evaluation_policy_candidate_registry.py` marks only `pi05_droid` and `groot_n17_droid` runnable. They use `droid_two_camera_robot_state_v1`, `droid_absolute_joint_position_v1`, and their explicit DROID-to-arena adapters. Registry status is code-recorded admission, not proof a fresh paid run or physical deployment occurred. Other listed entries have integration/license blockers. Do not promote them by changing a label or trusting a model card.

Provider context motivating this work includes Dream Labs' hosted Dream-1 research beta, Physical Intelligence's API beta, Generalist's announced access plans, and open-model serving routes. Re-check primary documentation and actual account access if integrating one. Dream-1's bimanual/YAM-related interface is not interchangeable with the current fixed-arm DROID setup. Pi's hosted service is not automatically the same artifact as openpi π0.5. Generalist interest/waitlist is not API access. Open weights do not automatically grant every intended commercial use. Do not make this project depend on an unavailable account.

Do not integrate every advertised API. Complete the normal independent-execution path using current valid adapters first. Add a genuinely useful provider only if access, rights, interface, and task compatibility are present. If not, leave a precise unavailable reason and preserve the working route. Avoid provider-name-specific logic in the core decision flow.

Pin immutable checkpoints where available. For hosted models, retain the strongest available provider version/deployment identity and record if it cannot be frozen. Never invent a checkpoint digest. Separate out-of-box tests from adaptation/fine-tuning budgets and data access. Training use requires its own existing permission; assessment/video permission is not training consent.

## 8. Shortlisting and fair comparison

The commercial job may screen many possible solutions and shortlist a few. It must not launch a Cartesian product of all robots and policies. Do inexpensive compatibility, delivery, and economics screening first. Evaluate the unresolved, relevant alternatives.

The current Arm Decision Proof protocol compares **exactly two frozen candidates** on its defined fixed-arm workcell distribution, then uses held-out physical evidence. Preserve that protocol, its immutable identities, matched conditions/seeds/resets, and prospective record. Its restrictions are not a reason to force every commercial job into a two-policy simulation. Conversely, this product change is not permission to silently widen the scientific proof protocol. Put shortlist orchestration above the bounded evaluation when needed.

Same-body policy comparisons and complete-system comparisons answer different questions. If hardware, sensors, tooling or labor differs, retain those differences and report full-system behavior/cost. Do not present a universal policy ranking. Keep task/site/configuration-specific scope and uncertainty.

Freeze what is being compared before observing the outcomes. Retain independent scoring, real episode lifecycle, full required observation receipts and replay. Preserve holdout separation. A model must not receive privileged simulator/evaluator state just because that makes integration easy. Reused correlated evidence is not independent repeated proof. Existing episode counts belong to their particular protocols; do not copy one number everywhere or claim statistical adequacy from a nominal count.

## 9. Resolve the actual cross-repo contract gap

Do not assume the WebApp's `contracts/pipeline/decision-evidence-router.v1.json` establishes a live producer/consumer contract. In the inspected WebApp it explicitly says `proposed_dependency_unmerged`, names an expected Pipeline path under `contracts/decision_evidence_router/`, and uses schema/state names that differ from current pipeline objects.

The inspected Pipeline already has a real handoff in `docs/webapp_handoff/decision-evidence-router.v1/`: request/result/normalized schemas, examples, status machine, legacy translations, compatibility and redaction rules, and a digest-bound artifact manifest. `decision_evidence_handoff.py` verifies that bundle. Start there and reconcile against real producers and consumers. Import the actual canonical artifact or use an explicit versioned translator; do not create a third competing contract or declare compatibility because a mock fixture passes.

Existing signed publication modules include `site_task_testbed_webapp_sync.py` and `task_evaluation_run_webapp_sync.py`. Existing WebApp receivers include `server/routes/internal-capture-testbeds.ts`, `internal-capture-task-evaluation-runs.ts`, and existing internal launch/preparation routes. Inspect mount paths, signatures, receipts, bindings and current versions before changing transport.

Preserve exact binding from commercial job and approved task to its relevant evidence. Keep evidence identity independent from a later quote price revision. A new buying budget can stale a quote without invalidating an unchanged physical observation; a changed task or configuration can invalidate technical applicability. Implement that distinction at the existing scope/version seam rather than rerunning everything on every edit.

A description-only job must not need fake `capture_session_id`, source bundle, testbed or run values to proceed commercially. A real capture-derived scientific publication still must meet its actual source/task/testbed bindings. If an aggregate job-assessment projection is missing, add the smallest separate projection referencing real evidence and the current brief; do not weaken capture publication schemas to accept invented values.

Use existing service authentication and signed sync. Never pass owner-link tokens, provider secrets or raw policy weights through public job projections. Persist accepted scientific results immutably with provenance. WebApp may display and link them, not infer a winner from abstention or raise claim ceilings. Stale results remain historical, with applicability clearly separated from the current recommendation.

Retries must be safe. Replaying a publication or request cannot create duplicate evaluation allocation, duplicate proposals, duplicate notifications, or reset an owner's spend/expiry limits. Reuse current deterministic IDs, digests, idempotency and receipt logic. Preserve cancellation/revocation behavior and bounded data sizes; store large evidence in existing object storage with authorized references.

## 10. Connect evidence to proposals and outcomes

Keep the initial commercial process operator-assisted. Pipeline results can prefill factual evidence summaries and next actions if their references and scope are valid. They must not invent a provider, quote, support coverage, contract, pass, or installation date. The existing admin can record actual supplier proposals and explain a recommendation combining evidence and deliverability.

If evidence reference fields are needed beyond the current short commercial summaries, add stable references/version/digest and a simple authorized link. Preserve compatibility with existing proposals containing only summaries. Do not create a second scientific report store inside `job_marketplace`, and do not let a supplier's marketing PDF become an authoritative result.

The customer chooses the exact current proposal. Only after both parties agree may the existing agreement record be created. Pipeline completion must never auto-select a proposal, award a contract, create agreement references, or start physical work. Installation, operating or labor budgets are not resource allocation permission.

For pilot outcomes, preserve `customer_reported` provenance and the existing permission requirement. A customer's note, “met criteria” flag, units/hour, or uploaded video can be useful operational input. It is not automatically an authoritative `PhysicalOutcomeJoin`, cannot adjudicate the ADP proof, and cannot recalibrate a method alone.

Where independently authoritative physical evidence is available and permitted, use the existing `physical_outcome_learning.py` join process. Bind exact decision, testbed, configuration, condition and physical artifact identities. Preserve source authority, retention/use rights, and immutable joins. If those requirements are absent, retain a reported outcome and a clear limitation rather than manufacturing the join.

Reuse later evidence only within its actual task/configuration/site envelope, provenance and permissions. Support better matching from verified repeated deliveries over time through existing data structures. Do not build a recommendation model, cross-site generalization claim, or training corpus as a side effect of this task.

## 11. Update doctrine at its source

The website's October 21 owner direction supersedes the old public requirements that every job needs simulation, an invited team, and one-click booking. The new owner instruction authorizes the corresponding pipeline product changes. Record it clearly; do not let historical public-positioning text force the new service back into the old funnel.

The WebApp implementation intentionally left locked shared blocks and their digests unchanged. Their canonical editable source is `BlueprintCapturePipeline/doctrine/`: `platform-context.md`, `vision.md`, and `world-model-strategy.md`. Read the actual propagation script. Make the focused product-language change there and use `scripts/sync_shared_doctrine.py --write` with the three real sibling checkouts. Commit the generated blocks and lock updates together in the relevant repositories according to the existing coordinated procedure.

Do not hand-edit shared generated blocks, recalculate only a local lock to hide drift, or claim all repos were synchronized when one was absent. Obtain/read the missing sibling through existing authorized repo access if possible. If a repo is genuinely inaccessible, finish independent code work and report the exact remaining sync dependency.

Keep Arm Decision Proof active as the bounded scientific proof track. Preserve its physical-validation authority, historical evidence counts, and frozen proof definitions. Change the customer journey, not historical truth. Keep world models as optional internal methods with bounded roles. No universal-runtime, new-embodiment, provider-bakeoff, or post-training research campaign is required by this product request.

## 12. Execution and completion

Work end to end in the smallest coherent increments:

1. Inspect current sources and identify the specific real gaps. Confirm the commercial/evidence boundary and current deployment state without changing runtime flags.
2. Reuse or extend the job-to-decision/evidence mapping so a description-only job can progress without a fabricated evaluation, and a job requiring evidence can create the correctly scoped existing request.
3. Connect real supported independent policy execution and the existing team-supplied route, with accurate availability. Preserve current scientific protocol boundaries.
4. Publish actual scoped results through the reconciled signed handoff. Surface the necessary evidence and next action in the existing operator/owner flow.
5. Connect proposals and permitted outcomes by reference while retaining commercial authorship and physical proof authority. Update canonical doctrine and the affected repo docs.
6. Run only the meaningful existing affected contract, type and behavior checks needed to show the changes work and satisfy required release CI. Repair relevant failures. Do not add a new test program, broad audit, check dashboard, or release bureaucracy.

Use development fixtures to prove software behavior when real site/provider access is unavailable; label them honestly. Do not claim paid execution, physical performance, production compatibility or customer evidence from fixtures. If a real resource operation is already explicitly authorized in the current session, use the existing allocator within that authority; otherwise implement and verify the no-spend path and report the exact external dependency. Writing software is not permission to launch GPUs, buy inference, move a robot, send outreach, resume held workers, or publish private evidence.

Do not change outreach/send flags or automatic operations to make the demo appear active. Preserve existing disabled workers and release holds. Use the existing release path if this session is explicitly asked to deploy; otherwise prepare concrete reviewable changes and PRs with exact dependency order. Do not infer deployment authorization solely from the website's previous deployment.

The implementation is useful when these behaviors work through existing interfaces:

- A site can submit a description without video or budget and receive a truthful next action.
- An operator can assess a job using sufficient existing evidence without being forced to create a simulation or invite a team.
- A supported job that needs new evidence reaches the correct bounded pipeline run and returns its exact result to the right job.
- A Blueprint-accessible supported policy can be evaluated without the technology team operating the run, while the approved team-hosted route still works.
- Unsupported hardware, unavailable API access, insufficient evidence, negative results and abstention produce clear limitations; none silently become a recommendation or pass.
- Current, comparable real proposals can reference the relevant evidence; scope changes invalidate only the affected applicability/quotes.
- Customer selection, both-party agreement and a reported outcome remain distinct, durable actions.
- Authoritative physical evidence can join through the existing proof path when present; reported outcomes cannot impersonate it.
- Existing records remain readable, exact IDs/digests/provenance survive, permissions are preserved, and retrying the flow does not repeat paid or external effects.
- Doctrine accurately describes the product and is synchronized through the canonical mechanism.

At completion, give a concise account of what changed and why, the exact working flow, the evidence actually observed, and any genuine external blocker. List the PRs/commits and release state if applicable. Separate software verification from real provider execution and physical proof. Explain any remaining owner decision in plain English and keep it narrowly tied to the next useful step.

Do the work, keep the product simple, and leave Blueprint able to run this service rather than just describe it.
