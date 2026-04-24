# Durham, NC Launch Issue Bundle

This issue bundle turns the Durham playbook into executable lanes using the current Blueprint agent org.

## Maintain the Durham capture target ledger

- key: city-target-ledger
- phase: founder_gates
- agent owner: city-demand-agent
- human owner: growth-lead
- purpose: Rank which Durham sites and site clusters should be captured first based on current robot workflow focus, buyer value, and access realism.
- policy_guardrail: Automatic policy block only when a target requires a sensitive operator lane, unsupported rights/privacy handling, or posture-changing outbound motion.
- dependencies: none
- metrics dependencies: first_lawful_access_path
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/city-demand-durham-nc.md
  - robot-team-demand-playbook.md
  - Durham capture target ledger
- done when:
  - The Durham target ledger names the first proof candidates, queued lawful-access buckets, and longer-horizon discovery lanes.
  - Capture priorities stay tied to current robot workflow demand and lawful access realism instead of generic city coverage.

## Maintain the Durham parallel lawful-access queue

- key: parallel-lawful-access-queue
- phase: founder_gates
- agent owner: city-demand-agent
- human owner: growth-lead
- purpose: Keep a multi-site lawful-access queue active so Durham warehouse and facility work does not stall on a single signature path.
- policy_guardrail: Automatic policy block only when the next candidate requires a posture-changing operator motion or unsupported rights/privacy handling.
- dependencies: city-target-ledger
- metrics dependencies: first_lawful_access_path
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/city-capture-target-ledger-durham-nc.md
  - ops/paperclip/playbooks/city-launch-durham-nc.md
  - buyer-linked exact-site requests
  - site access path notes
- done when:
  - Durham keeps 3-5 named lawful-access candidates or buyer-linked fallback sites queued in parallel, with one current next step per candidate.
  - If one warehouse stalls, another named access path is ready without restarting city planning from zero.
  - Each queued candidate names the current access posture, likely owner/operator/tenant path, and whether the next move belongs to buyer thread, operator intro, or existing lawful access.

## Lock Durham source policy and invite/access-code posture

- key: growth-source-policy
- phase: founder_gates
- agent owner: growth-lead
- human owner: growth-lead
- purpose: Keep Durham sourcing narrow, truthful, and fully autonomous inside written policy while explicitly distinguishing private controlled interiors from public, non-controlled commercial capture.
- policy_guardrail: Automatic policy block only if the plan expands spend, public posture, or channel scope beyond the bounded Durham pilot.
- dependencies: none
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/city-launch-durham-nc.md
  - capturer-supply-playbook.md
  - Durham autonomous launch posture
- done when:
  - Durham source policy names allowed channels, disallowed channels, referral rules, and who may issue invites or access codes.
  - Durham source policy makes public, non-controlled commercial community sourcing explicit while keeping private controlled interiors on stricter lawful-access paths.
  - Durham source policy names the online habitats for the public commercial lane instead of leaving community sourcing abstract.
  - Routine invite/access-code decisions stay with Growth Lead and Ops Lead inside written guardrails.

## Build the Durham city-opening distribution brief and channel map

- key: city-opening-distribution
- phase: founder_gates
- agent owner: city-launch-agent
- human owner: growth-lead
- purpose: Make Durham city opening explicit before the system expects replies: define who needs to hear about Blueprint in the city, what proof-led message each lane gets, which channels are in scope, what is out of scope, and how replies should route back into Blueprint.
- policy_guardrail: Automatic policy block only when the brief would expand channel classes, blur lawful-access boundaries, or make posture-changing public claims.
- dependencies: city-target-ledger, growth-source-policy
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/city-launch-durham-nc.md
  - ops/paperclip/playbooks/city-demand-durham-nc.md
  - ops/paperclip/playbooks/city-capture-target-ledger-durham-nc.md
  - Durham source policy
- done when:
  - Durham city-opening brief exists with a warehouse/facility direct-awareness track and a bounded public-commercial community-awareness track.
  - Durham channel map names the target audience, named channel or channel class, proof posture, exact CTA, and what is allowed versus out of scope for each lane.
  - Durham distribution brief tells people who Blueprint is, what the city launch is trying to source, what spaces are in scope, what is not allowed, and what counts as a qualified reply.
  - Durham distribution brief names the CTA path and source-tagging rules needed for later intake and response tracking.

## Publish the Durham city-facing CTA and intake routing path

- key: city-opening-cta-routing
- phase: founder_gates
- agent owner: ops-lead
- human owner: ops-lead
- purpose: Ensure Durham awareness work routes into a live intake path instead of scattering replies across ad hoc inboxes, notes, or untracked side conversations.
- policy_guardrail: none
- dependencies: city-opening-distribution, ops-rubric-thresholds
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - Durham city-opening brief
  - Durham intake rubric
  - live capturer intake path
  - city launch ledgers
- done when:
  - Durham warehouse/facility direct-awareness replies and public-commercial community replies both land in a named CTA path with city, lane, source, and owner routing.
  - Durham CTA path states what Blueprint is asking for, what access or site facts respondents must provide, and what the next review step is.
  - Responses do not die in personal inboxes or draft docs; they enter the canonical intake queue or ledger path with next-owner visibility.

## Assemble the Durham first-wave outreach and posting pack

- key: city-opening-first-wave-pack
- phase: supply
- agent owner: capturer-growth-agent
- human owner: growth-lead
- purpose: Turn the Durham city-opening brief into concrete first-wave assets that can create the first responses: direct named outreach for warehouse/facility awareness and small bounded posting packages for public-commercial awareness.
- policy_guardrail: Automatic policy block before any send, post, or expansion that outruns the written city-opening brief.
- dependencies: city-opening-distribution, city-opening-cta-routing
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - Durham city-opening brief
  - Durham channel map
  - Durham CTA / intake path
  - ops/paperclip/playbooks/city-capture-target-ledger-durham-nc.md
- done when:
  - Durham warehouse/facility first-wave outreach pack names the first buyers, operators, integrators, or facilities to contact, the proof-led message variants, and the next move per target.
  - Durham public-commercial first-wave posting pack names the first small community placements, the public-area-only brief, and the exact CTA copy for each placement.
  - Every Durham first-wave asset points to the same truthful CTA path, uses source attribution, and avoids invented traction, blanket permission claims, or fake legal certainty.

## Run Durham site-operator partnership routing

- key: site-operator-partnership
- phase: founder_gates
- agent owner: site-operator-partnership-agent
- human owner: growth-lead
- purpose: Prepare the operator-side access path for Durham warehouses and facilities by identifying contacts, operator value props, approval sequence, and escalation boundaries before the city waits on a single site.
- policy_guardrail: Automatic policy block before live operator outreach that lacks a written access, commercialization, privacy, consent, or legal basis.
- dependencies: parallel-lawful-access-queue, growth-source-policy, city-opening-distribution
- metrics dependencies: first_lawful_access_path
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/site-operator-access-and-commercialization-playbook.md
  - ops/paperclip/playbooks/city-launch-durham-nc.md
  - ops/paperclip/playbooks/city-capture-target-ledger-durham-nc.md
  - Durham city-opening brief
  - parallel lawful-access queue
- done when:
  - Durham operator-lane packet identifies likely owner/operator/tenant contacts, operator-side value props, and the exact approval sequence for the highest-priority warehouse/facility candidates.
  - The first operator-outreach draft or intro packet is ready before the lane reaches a policy or evidence block.
  - Open questions and escalation boundaries are explicit before live operator outreach begins.

## Publish Durham intake rubric, trust kit, and first-capture thresholds

- key: ops-rubric-thresholds
- phase: founder_gates
- agent owner: ops-lead
- human owner: ops-lead
- purpose: Give Intake, Field Ops, QA, and Rights lanes explicit Durham rules so they can run without founder review.
- policy_guardrail: none
- dependencies: growth-source-policy
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/city-launch-durham-nc.md
  - capturer-trust-packet-stage-gate-standard.md
  - field-ops-first-assignment-site-facing-trust-gate.md
- done when:
  - Durham rubric covers source quality, access-path truth, equipment/device fit, trust-packet minimums, and approval outcomes.
  - Durham first-capture thresholds and trust-kit checklist exist in one operator packet.

## Build the Durham capturer prospect list and post package

- key: supply-prospects
- phase: supply
- agent owner: capturer-growth-agent
- human owner: growth-lead
- purpose: Generate the first Durham curated professional supply wave for private controlled interiors and buyer-linked exact-site paths, then push the first real prospect or invite response into the live intake path without widening into generic gig-market posture.
- policy_guardrail: Automatic policy block only for unsupported rights/privacy handling or posture-changing source-policy changes beyond the approved Durham launch posture.
- dependencies: city-target-ledger, growth-source-policy, city-opening-first-wave-pack, city-opening-cta-routing
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - capturer-supply-playbook.md
  - ops/paperclip/playbooks/city-launch-durham-nc.md
  - Durham source policy
  - Durham city-opening brief
  - Durham first-wave outreach pack
  - live capturer intake path
- done when:
  - A curated first-wave Durham professional prospect set is named with source bucket, rationale, lawful access posture, and next move.
  - At least one real Durham invite, reply, or applicant signal is landed in the live intake path with source bucket and next owner recorded.
  - Any copy stays draft-first and preserves no-guarantee capture language.

## Run Durham public-commercial community sourcing

- key: public-commercial-community-sourcing
- phase: supply
- agent owner: capturer-growth-agent
- human owner: growth-lead
- purpose: Open a bounded online-community sourcing lane for public, non-controlled commercial locations such as groceries, retail stores, and similar walk-in sites, and turn that lane into real intake signals.
- policy_guardrail: none
- dependencies: growth-source-policy, city-opening-first-wave-pack, city-opening-cta-routing
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - capturer-supply-playbook.md
  - ops/paperclip/playbooks/city-launch-durham-nc.md
  - Durham source policy
  - Durham city-opening brief
  - Durham first-wave posting pack
  - public-area-only capture brief
  - live capturer intake path
- done when:
  - Durham public-commercial sourcing names the online communities, channels, and posting brief for public, non-controlled commercial capture.
  - At least one live Durham community-sourced invite, reply, or applicant signal is landed in the intake path with source bucket and public-commercial posture recorded.
  - If no automated publication connector exists, the lane still produces a complete agent-owned posting pack and does not block the automated launch path.
  - The lane stays explicitly limited to lawful public areas and preserves privacy, signage, and provenance rules.

## Route Durham applicants into qualification and approval

- key: supply-qualification
- phase: supply
- agent owner: intake-agent
- human owner: ops-lead
- purpose: Classify Durham applicants using the approved rubric instead of ad hoc founder review, and resume immediately once the first live invite or applicant signal lands.
- policy_guardrail: Automatic policy block only when the rubric is ambiguous or the application raises unsupported rights/privacy/trust conditions.
- dependencies: ops-rubric-thresholds
- metrics dependencies: first_approved_capturer
- validation required: false
- source: default_task_bundle
- inputs:
  - Durham intake rubric
  - waitlistSubmissions
  - capturer signup records
  - capturer invite replies / live intake responses
- done when:
  - Durham applicants are tagged by source bucket, approval state, and missing-trust evidence.
  - Exceptions are blocked with explicit missing facts instead of silently held.
  - If no live applicant signal exists yet, the lane is left blocked as a missing live signal rather than quietly waiting.

## Own approved Durham capturers through onboarding and repeat-ready

- key: capturer-activation-success
- phase: supply
- agent owner: capturer-success-agent
- human owner: ops-lead
- purpose: Give every approved Durham mapper one routine relationship owner from approval through onboarding, first pass, and repeat-readiness so the founder is not the default support lane.
- policy_guardrail: Automatic policy block only when routine support exposes a threshold, rights, privacy, payout, or policy exception.
- dependencies: ops-rubric-thresholds, supply-qualification
- metrics dependencies: first_approved_capturer, first_completed_capture
- validation required: false
- source: default_task_bundle
- inputs:
  - Durham intake rubric
  - Durham trust kit
  - field assignment and reminder state
  - capture QA evidence
- done when:
  - Each approved Durham capturer has a named lifecycle owner for approved -> onboarded -> first capture -> first pass -> repeat-ready.
  - Routine mapper questions, support, and coaching stay with capturer-success-agent unless they become logistics, QA, rights, privacy, or policy exceptions.

## Assign Durham first captures, reminders, and site-facing trust prep

- key: first-capture-routing
- phase: supply
- agent owner: field-ops-agent
- human owner: ops-lead
- purpose: Turn approved Durham capturers into real first captures inside bounded thresholds.
- policy_guardrail: Automatic policy block only for missing site access, ambiguous permissions, or threshold exceptions.
- dependencies: supply-qualification, capturer-activation-success
- metrics dependencies: first_completed_capture
- validation required: false
- source: default_task_bundle
- inputs:
  - Durham first-capture thresholds
  - capture_jobs
  - field-ops-first-assignment-site-facing-trust-gate.md
- done when:
  - Approved Durham capturers receive assignment, reminder, and site-facing trust steps through the existing field-ops lane.
  - Travel, timing, and access blockers are explicit on the issue and visible in the admin queue.

## QA Durham first captures and route recapture decisions

- key: capture-qa
- phase: proof_assets
- agent owner: capture-qa-agent
- human owner: ops-lead
- purpose: Ensure Durham proof assets are real, clean, and ready for buyer proof work.
- policy_guardrail: none
- dependencies: first-capture-routing
- metrics dependencies: first_qa_passed_capture
- validation required: false
- source: default_task_bundle
- inputs:
  - pipeline artifacts
  - capture QA evidence
- done when:
  - Durham captures receive PASS, BORDERLINE, or FAIL with explicit evidence.
  - Recapture instructions are attached when the first pass is not proof-ready.

## Clear rights, provenance, and privacy on Durham proof assets

- key: rights-clearance
- phase: proof_assets
- agent owner: rights-provenance-agent
- human owner: designated-human-rights-reviewer
- purpose: Make Durham proof packs releasable without weakening trust boundaries.
- policy_guardrail: Automatic rights/provenance policy block for sensitive or precedent-setting privacy, rights, or commercialization questions.
- dependencies: capture-qa
- metrics dependencies: first_rights_cleared_proof_asset
- validation required: false
- source: default_task_bundle
- inputs:
  - pipeline compliance artifacts
  - site-facing trust evidence
  - rights/provenance checklist
- done when:
  - Each Durham proof asset is marked CLEARED, BLOCKED, or NEEDS-REVIEW with evidence citations.
  - Policy-setting exceptions stay blocked until repo policy and supporting evidence are updated.

## Assemble Durham proof packs and publish 1-2 proof-ready listings

- key: proof-pack-listings
- phase: proof_assets
- agent owner: buyer-solutions-agent
- human owner: ops-lead
- purpose: Turn Durham captures into concrete exact-site proof assets with a hosted-review path.
- policy_guardrail: Automatic policy block only when a buyer-visible claim would outrun the underlying evidence or commercial scope.
- dependencies: city-target-ledger, rights-clearance
- metrics dependencies: proof_pack_delivered, first_proof_pack_delivery
- validation required: false
- source: default_task_bundle
- inputs:
  - CLEARED Durham proof assets
  - robot-team-demand-playbook.md
  - proof-path-ownership-contract.md
- done when:
  - At least one Durham proof-ready listing or equivalent proof pack exists with exact-site versus adjacent-site labeling.
  - Each proof pack includes provenance, coverage boundaries, hosted-review path, and next-step guidance.

## Research Durham robot-company target accounts and buyer clusters

- key: buyer-target-research
- phase: demand
- agent owner: demand-intel-agent
- human owner: growth-lead
- purpose: Build a real Durham demand list that matches the proof assets Blueprint can actually show.
- policy_guardrail: none
- dependencies: proof-pack-listings
- metrics dependencies: robot_team_inbound_captured, proof_path_assigned
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/city-demand-durham-nc.md
  - robot-team-demand-playbook.md
  - Durham proof-ready listings
- done when:
  - A named Durham buyer target set is researched with facility/workflow fit and proof-path notes.
  - Exact-site versus adjacent-site proof rules are explicit per target.

## Prepare Durham proof-led outbound package and first touches

- key: outbound-package
- phase: demand
- agent owner: robot-team-growth-agent
- human owner: growth-lead
- purpose: Make outbound specific to Durham proof assets and hosted review instead of generic AI messaging.
- policy_guardrail: Automatic policy block only for unsupported rights/privacy handling, posture-changing claims, or non-standard commercial commitments beyond the approved launch posture.
- dependencies: buyer-target-research
- metrics dependencies: proof_path_assigned
- validation required: false
- source: default_task_bundle
- inputs:
  - buyer-target-research
  - Durham proof packs
  - standard commercial handoff rules
- done when:
  - Durham outbound templates lead with one site, one workflow lane, proof-led CTA, and hosted-review next step.
  - First proof-led touches are prepared for autonomous dispatch inside the approved launch posture.

## Run Durham outbound and move serious buyers into hosted review

- key: outbound-execution
- phase: demand
- agent owner: outbound-sales-agent
- human owner: growth-lead
- purpose: Convert named Durham targets into serious proof conversations without dragging the founder into routine work.
- policy_guardrail: Automatic policy block only for posture changes, non-standard terms, or sensitive rights/privacy questions.
- dependencies: outbound-package
- metrics dependencies: hosted_review_ready, hosted_review_started, hosted_review_follow_up_sent, proof_motion_stalled, first_hosted_review
- validation required: false
- source: default_task_bundle
- inputs:
  - approved outbound package
  - Durham buyer target list
- done when:
  - Durham buyer conversations are active with explicit next steps.
  - At least one hosted proof review is run end to end or clearly blocked with named reasons.

## Keep Durham buyer threads inside standard commercial handling

- key: buyer-thread-commercial
- phase: commercial
- agent owner: revenue-ops-pricing-agent
- human owner: designated-human-commercial-owner
- purpose: Prevent routine pricing and packaging questions from escalating to founder review.
- policy_guardrail: Automatic commercial policy block whenever proposed terms fall outside the written standard quote bands.
- dependencies: outbound-execution
- metrics dependencies: human_commercial_handoff_started, first_human_commercial_handoff
- validation required: false
- source: default_task_bundle
- inputs:
  - Durham buyer conversations
  - Durham proof packs
  - revenue-ops-pricing-agent-program.md
- done when:
  - Standard Durham quote bands, discount guardrails, and handoff thresholds are documented and used.
  - Only terms inside the written quote bands proceed automatically; anything else stays blocked until the quote policy changes.

## Publish Durham city-opening response tracking

- key: city-opening-response-tracking
- phase: measurement
- agent owner: analytics-agent
- human owner: growth-lead
- purpose: Make Durham city-opening distribution measurable so operators can see which awareness lanes actually create replies before deeper capture or buyer workflows take over.
- policy_guardrail: none
- dependencies: city-opening-cta-routing, city-opening-first-wave-pack
- metrics dependencies: none
- validation required: true
- source: default_task_bundle
- inputs:
  - Durham city-opening brief
  - Durham CTA / intake path
  - growth_events
  - city launch ledgers
- done when:
  - Durham response-tracking view shows which warehouse/facility channels and which public-commercial community channels were activated, with asset or message attribution where available.
  - A real Durham city-opening response is defined and counted only when a reply, applicant, referral, operator callback, or buyer callback is recorded with city, lane, source, and CTA attribution.
  - Missing attribution or missing visibility is called out explicitly instead of assuming awareness work happened.

## Run the Durham city-opening reply-conversion and follow-up cadence lane

- key: city-opening-reply-conversion
- phase: supply
- agent owner: city-launch-agent
- human owner: growth-lead
- purpose: Convert live Durham city-opening replies across warehouse/facility and public-commercial channels into routed next steps with explicit follow-up cadence, instead of letting first responses decay across scattered threads.
- policy_guardrail: Automatic policy block only when follow-up would require posture-changing claims, unsupported rights/privacy promises, pricing or commercial commitments outside policy, legal interpretation, or blanket permission language.
- dependencies: city-opening-response-tracking, city-opening-cta-routing
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - Durham city-opening brief
  - Durham CTA / intake path
  - Durham response-tracking view
  - live city-opening replies
  - city launch ledgers
- done when:
  - Durham reply-conversion queue exists with each live response tagged by responder type, channel, current status, next owner, next follow-up due, and downstream handoff target.
  - Durham follow-up cadence rules define first response, second follow-up, stale-response handling, and the handoff boundary into qualification, site-operator partnership, buyer handling, or no-fit closure.
  - At least one live Durham city-opening response is moved through the queue into qualification, operator/buyer handoff, blocked-with-reason, or explicit no-fit / closed-lost outcome.
  - Live responses do not sit unowned after landing; each one has an explicit next step and cadence state.

## Publish the Durham launch scorecard and blocker view

- key: city-scorecard
- phase: measurement
- agent owner: analytics-agent
- human owner: growth-lead
- purpose: Make Durham progress measurable and reviewable without relying on narrative updates.
- policy_guardrail: none
- dependencies: supply-qualification, proof-pack-listings, outbound-execution, city-opening-response-tracking, city-opening-reply-conversion
- metrics dependencies: robot_team_inbound_captured, proof_path_assigned, proof_pack_delivered, hosted_review_ready, hosted_review_started, hosted_review_follow_up_sent, human_commercial_handoff_started, proof_motion_stalled
- validation required: true
- source: default_task_bundle
- inputs:
  - growth_events
  - inboundRequests.ops.proof_path
  - city launch ledgers
  - published Durham proof assets
- done when:
  - Durham scorecard reports supply and demand progress against the launch thresholds.
  - Missing instrumentation is surfaced as blocked instead of smoothed over.

## Mirror Durham execution artifacts into Notion Knowledge and Work Queue

- key: notion-breadcrumbs
- phase: measurement
- agent owner: notion-manager-agent
- human owner: chief-of-staff
- purpose: Keep the Durham launch runnable and inspectable for humans outside the repo.
- policy_guardrail: Automatic policy block only for ambiguous Notion identity or rights-sensitive content movement.
- dependencies: city-scorecard
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - Durham launch system doc
  - Durham issue bundle
  - Durham scorecard
- done when:
  - Durham execution system doc is mirrored into Notion Knowledge.
  - A Work Queue breadcrumb exists for the current Durham activation state and next policy block.

## Run the Durham switch-on review before activation

- key: switch-on-review
- phase: measurement
- agent owner: beta-launch-commander
- human owner: cto
- purpose: Confirm the software/runtime surfaces needed by the Durham launch are safe before switch-on.
- policy_guardrail: Automatic release-safety block when compliance or rights evidence is ambiguous.
- dependencies: city-scorecard
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - alpha:check
  - alpha:preflight
  - Durham launch system doc
- done when:
  - Durham switch-on review returns GO, CONDITIONAL GO, or HOLD with evidence.
  - Any software/runtime blocker is routed to the right engineering lane before launch activation.
