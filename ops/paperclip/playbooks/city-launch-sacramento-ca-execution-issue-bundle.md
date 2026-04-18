# Sacramento, CA Launch Issue Bundle

This issue bundle turns the Sacramento playbook into executable lanes using the current Blueprint agent org.

## Maintain the Sacramento capture target ledger

- key: city-target-ledger
- phase: founder_gates
- agent owner: city-demand-agent
- human owner: growth-lead
- purpose: Rank which Sacramento sites and site clusters should be captured first based on current robot workflow focus, buyer value, and access realism.
- human gate: Escalate only when a target requires a sensitive operator-lane, rights/privacy exception, or posture-changing outbound motion.
- dependencies: none
- metrics dependencies: first_lawful_access_path
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/city-demand-sacramento-ca.md
  - robot-team-demand-playbook.md
  - Sacramento capture target ledger
- done when:
  - The Sacramento target ledger names the first proof candidates, queued lawful-access buckets, and longer-horizon discovery lanes.
  - Capture priorities stay tied to current robot workflow demand and lawful access realism instead of generic city coverage.

## Maintain the Sacramento parallel lawful-access queue

- key: parallel-lawful-access-queue
- phase: founder_gates
- agent owner: city-demand-agent
- human owner: growth-lead
- purpose: Keep a multi-site lawful-access queue active so Sacramento warehouse and facility work does not stall on a single signature path.
- human gate: Escalate only when the next candidate requires a posture-changing operator motion, a rights/privacy exception, or founder review on a new precedent.
- dependencies: city-target-ledger
- metrics dependencies: first_lawful_access_path
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/city-capture-target-ledger-sacramento-ca.md
  - ops/paperclip/playbooks/city-launch-sacramento-ca.md
  - buyer-linked exact-site requests
  - site access path notes
- done when:
  - Sacramento keeps 3-5 named lawful-access candidates or buyer-linked fallback sites queued in parallel, with one current next step per candidate.
  - The current candidate set is explicit rather than implied, and includes Northgate Logistics, US Cold Storage - Ambient Module, McClellan Park - Building 775 (Light Industrial), Sacramento Costco - Natomas, and Home Depot - Sacramento (Cal Expo).
  - If one warehouse stalls, another named access path is ready without restarting city planning from zero.
  - Each queued candidate names the current access posture, likely owner/operator/tenant path, and whether the next move belongs to buyer thread, operator intro, or existing lawful access.

## Lock Sacramento source policy and invite/access-code posture

- key: growth-source-policy
- phase: founder_gates
- agent owner: growth-lead
- human owner: growth-lead
- purpose: Keep Sacramento sourcing narrow, truthful, and off the founder lane for routine approvals while explicitly distinguishing private controlled interiors from public, non-controlled commercial capture.
- human gate: Founder approval only if the policy expands spend, public posture, or channel scope beyond the bounded Sacramento pilot.
- dependencies: none
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/city-launch-sacramento-ca.md
  - capturer-supply-playbook.md
  - founder-approved Sacramento launch posture
- done when:
  - Sacramento source policy names allowed channels, disallowed channels, referral rules, and who may issue invites or access codes.
  - Sacramento source policy makes public, non-controlled commercial community sourcing explicit while keeping private controlled interiors on stricter lawful-access paths.
  - Sacramento source policy names the online habitats for the public commercial lane instead of leaving community sourcing abstract.
  - Routine invite/access-code decisions stay with Growth Lead and Ops Lead inside written guardrails.

## Build the Sacramento city-opening distribution brief and channel map

- key: city-opening-distribution
- phase: founder_gates
- agent owner: city-launch-agent
- human owner: growth-lead
- purpose: Make Sacramento city opening explicit before the system expects replies: define who needs to hear about Blueprint in the city, what proof-led message each lane gets, which channels are in scope, what is out of scope, and how replies should route back into Blueprint.
- human gate: Human review only when the brief would expand channel classes, blur lawful-access boundaries, or make posture-changing public claims.
- dependencies: city-target-ledger, growth-source-policy
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/city-launch-sacramento-ca.md
  - ops/paperclip/playbooks/city-demand-sacramento-ca.md
  - ops/paperclip/playbooks/city-capture-target-ledger-sacramento-ca.md
  - Sacramento source policy
- done when:
  - Sacramento city-opening brief exists with a warehouse/facility direct-awareness track and a bounded public-commercial community-awareness track.
  - Sacramento channel map names the target audience, named channel or channel class, proof posture, exact CTA, and what is allowed versus out of scope for each lane.
  - Sacramento distribution brief tells people who Blueprint is, what the city launch is trying to source, what spaces are in scope, what is not allowed, and what counts as a qualified reply.
  - Sacramento distribution brief names the CTA path and source-tagging rules needed for later intake and response tracking.

## Publish the Sacramento city-facing CTA and intake routing path

- key: city-opening-cta-routing
- phase: founder_gates
- agent owner: ops-lead
- human owner: ops-lead
- purpose: Ensure Sacramento awareness work routes into a live intake path instead of scattering replies across ad hoc inboxes, notes, or untracked side conversations.
- human gate: none
- dependencies: city-opening-distribution, ops-rubric-thresholds
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - Sacramento city-opening brief
  - Sacramento intake rubric
  - live capturer intake path
  - city launch ledgers
- done when:
  - Sacramento warehouse/facility direct-awareness replies and public-commercial community replies both land in a named CTA path with city, lane, source, and owner routing.
  - Sacramento CTA path states what Blueprint is asking for, what access or site facts respondents must provide, and what the next review step is.
  - Responses do not die in personal inboxes or draft docs; they enter the canonical intake queue or ledger path with next-owner visibility.

## Assemble first-wave pack

- key: city-opening-first-wave-pack
- phase: supply
- agent owner: capturer-growth-agent
- human owner: growth-lead
- purpose: Prepare first-wave outreach and posting assets.
- human gate: Human review before the first live send or post in any channel, and before any expansion beyond the written city-opening brief.
- dependencies: city-opening-distribution, city-opening-cta-routing
- metrics dependencies: first_lawful_access_path
- validation required: false
- source: activation_payload
- inputs:
  - Sacramento city-opening brief
  - Sacramento channel map
  - Sacramento CTA / intake path
  - ops/paperclip/playbooks/city-capture-target-ledger-sacramento-ca.md
- done when:
  - First-wave pack is ready.

## Run Sacramento site-operator partnership routing

- key: site-operator-partnership
- phase: founder_gates
- agent owner: site-operator-partnership-agent
- human owner: growth-lead
- purpose: Prepare the operator-side access path for Sacramento warehouses and facilities by identifying contacts, operator value props, approval sequence, and escalation boundaries before the city waits on a single site.
- human gate: Human review before the first live operator outreach, and immediate escalation for commercialization, legal, privacy, consent, or non-standard access questions.
- dependencies: parallel-lawful-access-queue, growth-source-policy, city-opening-distribution
- metrics dependencies: first_lawful_access_path
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/site-operator-access-and-commercialization-playbook.md
  - ops/paperclip/playbooks/city-launch-sacramento-ca.md
  - ops/paperclip/playbooks/city-capture-target-ledger-sacramento-ca.md
  - Sacramento city-opening brief
  - parallel lawful-access queue
- done when:
  - Sacramento operator-lane packet identifies likely owner/operator/tenant contacts, operator-side value props, and the exact approval sequence for the highest-priority warehouse/facility candidates.
  - The first operator-outreach draft or intro packet is ready for human review instead of being invented ad hoc at the moment of blockage.
  - Open questions and escalation boundaries are explicit before live operator outreach begins.

## Publish Sacramento intake rubric, trust kit, and first-capture thresholds

- key: ops-rubric-thresholds
- phase: founder_gates
- agent owner: ops-lead
- human owner: ops-lead
- purpose: Give Intake, Field Ops, QA, and Rights lanes explicit Sacramento rules so they can run without founder review.
- human gate: none
- dependencies: growth-source-policy
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/city-launch-sacramento-ca.md
  - capturer-trust-packet-stage-gate-standard.md
  - field-ops-first-assignment-site-facing-trust-gate.md
- done when:
  - Sacramento rubric covers source quality, access-path truth, equipment/device fit, trust-packet minimums, and approval outcomes.
  - Sacramento first-capture thresholds and trust-kit checklist exist in one operator packet.

## Build the Sacramento capturer prospect list and post package

- key: supply-prospects
- phase: supply
- agent owner: capturer-growth-agent
- human owner: growth-lead
- purpose: Generate the first Sacramento curated professional supply wave for private controlled interiors and buyer-linked exact-site paths, then push the first real prospect or invite response into the live intake path without widening into generic gig-market posture.
- human gate: Escalate only for rights/privacy exceptions or posture-changing source-policy changes beyond the approved Sacramento launch posture.
- dependencies: city-target-ledger, growth-source-policy, city-opening-first-wave-pack, city-opening-cta-routing
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - capturer-supply-playbook.md
  - ops/paperclip/playbooks/city-launch-sacramento-ca.md
  - Sacramento source policy
  - Sacramento city-opening brief
  - Sacramento first-wave outreach pack
  - live capturer intake path
- done when:
  - A curated first-wave Sacramento professional prospect set is named with source bucket, rationale, lawful access posture, and next move.
  - At least one real Sacramento invite, reply, or applicant signal is landed in the live intake path with source bucket and next owner recorded.
  - Any copy stays draft-first and preserves no-guarantee capture language.

## Run Sacramento public-commercial community sourcing

- key: public-commercial-community-sourcing
- phase: supply
- agent owner: capturer-growth-agent
- human owner: growth-lead
- purpose: Open a bounded online-community sourcing lane for public, non-controlled commercial locations such as groceries, retail stores, and similar walk-in sites, and turn that lane into real intake signals.
- human gate: none
- dependencies: growth-source-policy, city-opening-first-wave-pack, city-opening-cta-routing
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - capturer-supply-playbook.md
  - ops/paperclip/playbooks/city-launch-sacramento-ca.md
  - Sacramento source policy
  - Sacramento city-opening brief
  - Sacramento first-wave posting pack
  - public-area-only capture brief
  - live capturer intake path
- done when:
  - Sacramento public-commercial sourcing names the online communities, channels, and posting brief for public, non-controlled commercial capture.
  - At least one live Sacramento community-sourced invite, reply, or applicant signal is landed in the intake path with source bucket and public-commercial posture recorded.
  - If no automated publication connector exists, the lane still produces a complete agent-owned posting pack and does not block the automated launch path.
  - The lane stays explicitly limited to lawful public areas and preserves privacy, signage, and provenance rules.

## Route Sacramento applicants into qualification and approval

- key: supply-qualification
- phase: supply
- agent owner: intake-agent
- human owner: ops-lead
- purpose: Classify Sacramento applicants using the approved rubric instead of ad hoc founder review, and resume immediately once the first live invite or applicant signal lands.
- human gate: Escalate only when the rubric is ambiguous or the application raises rights/privacy/trust exceptions.
- dependencies: ops-rubric-thresholds
- metrics dependencies: first_approved_capturer
- validation required: false
- source: default_task_bundle
- inputs:
  - Sacramento intake rubric
  - waitlistSubmissions
  - capturer signup records
  - capturer invite replies / live intake responses
- done when:
  - Sacramento applicants are tagged by source bucket, approval state, and missing-trust evidence.
  - Exceptions are blocked with explicit missing facts instead of silently held.
  - If no live applicant signal exists yet, the lane is left blocked as a missing live signal rather than quietly waiting.

## Own approved Sacramento capturers through onboarding and repeat-ready

- key: capturer-activation-success
- phase: supply
- agent owner: capturer-success-agent
- human owner: ops-lead
- purpose: Give every approved Sacramento mapper one routine relationship owner from approval through onboarding, first pass, and repeat-readiness so the founder is not the default support lane.
- human gate: Escalate only when routine support exposes a threshold, rights, privacy, payout, or policy exception.
- dependencies: ops-rubric-thresholds, supply-qualification
- metrics dependencies: first_approved_capturer, first_completed_capture
- validation required: false
- source: default_task_bundle
- inputs:
  - Sacramento intake rubric
  - Sacramento trust kit
  - field assignment and reminder state
  - capture QA evidence
- done when:
  - Each approved Sacramento capturer has a named lifecycle owner for approved -> onboarded -> first capture -> first pass -> repeat-ready.
  - Routine mapper questions, support, and coaching stay with capturer-success-agent unless they become logistics, QA, rights, privacy, or policy exceptions.

## Assign Sacramento first captures, reminders, and site-facing trust prep

- key: first-capture-routing
- phase: supply
- agent owner: field-ops-agent
- human owner: ops-lead
- purpose: Turn approved Sacramento capturers into real first captures inside bounded thresholds.
- human gate: Escalate only for missing site access, ambiguous permissions, or threshold exceptions.
- dependencies: supply-qualification, capturer-activation-success
- metrics dependencies: first_completed_capture
- validation required: false
- source: default_task_bundle
- inputs:
  - Sacramento first-capture thresholds
  - capture_jobs
  - field-ops-first-assignment-site-facing-trust-gate.md
- done when:
  - Approved Sacramento capturers receive assignment, reminder, and site-facing trust steps through the existing field-ops lane.
  - Travel, timing, and access blockers are explicit on the issue and visible in the admin queue.

## QA Sacramento first captures and route recapture decisions

- key: capture-qa
- phase: proof_assets
- agent owner: capture-qa-agent
- human owner: ops-lead
- purpose: Ensure Sacramento proof assets are real, clean, and ready for buyer proof work.
- human gate: none
- dependencies: first-capture-routing
- metrics dependencies: first_qa_passed_capture
- validation required: false
- source: default_task_bundle
- inputs:
  - pipeline artifacts
  - capture QA evidence
- done when:
  - Sacramento captures receive PASS, BORDERLINE, or FAIL with explicit evidence.
  - Recapture instructions are attached when the first pass is not proof-ready.

## Clear rights, provenance, and privacy on Sacramento proof assets

- key: rights-clearance
- phase: proof_assets
- agent owner: rights-provenance-agent
- human owner: designated-human-rights-reviewer
- purpose: Make Sacramento proof packs releasable without weakening trust boundaries.
- human gate: Human rights review for sensitive or precedent-setting privacy, rights, or commercialization questions.
- dependencies: capture-qa
- metrics dependencies: first_rights_cleared_proof_asset
- validation required: false
- source: default_task_bundle
- inputs:
  - pipeline compliance artifacts
  - site-facing trust evidence
  - rights/provenance checklist
- done when:
  - Each Sacramento proof asset is marked CLEARED, BLOCKED, or NEEDS-REVIEW with evidence citations.
  - Policy-setting exceptions route to the human reviewer and founder only when precedent changes.

## Assemble Sacramento proof packs and publish 1-2 proof-ready listings

- key: proof-pack-listings
- phase: proof_assets
- agent owner: buyer-solutions-agent
- human owner: ops-lead
- purpose: Turn Sacramento captures into concrete exact-site proof assets with a hosted-review path.
- human gate: Escalate only when a buyer-visible claim would outrun the underlying evidence or commercial scope.
- dependencies: city-target-ledger, rights-clearance
- metrics dependencies: proof_pack_delivered, first_proof_pack_delivery
- validation required: false
- source: default_task_bundle
- inputs:
  - CLEARED Sacramento proof assets
  - robot-team-demand-playbook.md
  - proof-path-ownership-contract.md
- done when:
  - At least one Sacramento proof-ready listing or equivalent proof pack exists with exact-site versus adjacent-site labeling.
  - Each proof pack includes provenance, coverage boundaries, hosted-review path, and next-step guidance.

## Research Sacramento robot-company target accounts and buyer clusters

- key: buyer-target-research
- phase: demand
- agent owner: demand-intel-agent
- human owner: growth-lead
- purpose: Build a real Sacramento demand list that matches the proof assets Blueprint can actually show.
- human gate: none
- dependencies: proof-pack-listings
- metrics dependencies: robot_team_inbound_captured, proof_path_assigned
- validation required: false
- source: default_task_bundle
- inputs:
  - ops/paperclip/playbooks/city-demand-sacramento-ca.md
  - robot-team-demand-playbook.md
  - Sacramento proof-ready listings
- done when:
  - A named Sacramento buyer target set is researched with facility/workflow fit and proof-path notes.
  - Exact-site versus adjacent-site proof rules are explicit per target.

## Prepare Sacramento proof-led outbound package and first touches

- key: outbound-package
- phase: demand
- agent owner: robot-team-growth-agent
- human owner: growth-lead
- purpose: Make outbound specific to Sacramento proof assets and hosted review instead of generic AI messaging.
- human gate: Escalate only for rights/privacy exceptions, posture-changing claims, or non-standard commercial commitments beyond the approved launch posture.
- dependencies: buyer-target-research
- metrics dependencies: proof_path_assigned
- validation required: false
- source: default_task_bundle
- inputs:
  - buyer-target-research
  - Sacramento proof packs
  - standard commercial handoff rules
- done when:
  - Sacramento outbound templates lead with one site, one workflow lane, proof-led CTA, and hosted-review next step.
  - First proof-led touches are prepared for autonomous dispatch inside the approved launch posture.

## Run Sacramento outbound and move serious buyers into hosted review

- key: outbound-execution
- phase: demand
- agent owner: outbound-sales-agent
- human owner: growth-lead
- purpose: Convert named Sacramento targets into serious proof conversations without dragging the founder into routine work.
- human gate: Escalate only for posture changes, non-standard terms, or sensitive rights/privacy questions.
- dependencies: outbound-package
- metrics dependencies: hosted_review_ready, hosted_review_started, hosted_review_follow_up_sent, proof_motion_stalled, first_hosted_review
- validation required: false
- source: default_task_bundle
- inputs:
  - approved outbound package
  - Sacramento buyer target list
- done when:
  - Sacramento buyer conversations are active with explicit next steps.
  - At least one hosted proof review is run end to end or clearly blocked with named reasons.

## Keep Sacramento buyer threads inside standard commercial handling

- key: buyer-thread-commercial
- phase: commercial
- agent owner: revenue-ops-pricing-agent
- human owner: designated-human-commercial-owner
- purpose: Prevent routine pricing and packaging questions from escalating to founder review.
- human gate: Human commercial owner approval for standard quotes; founder approval only for non-standard commitments.
- dependencies: outbound-execution
- metrics dependencies: human_commercial_handoff_started, first_human_commercial_handoff
- validation required: false
- source: default_task_bundle
- inputs:
  - Sacramento buyer conversations
  - Sacramento proof packs
  - revenue-ops-pricing-agent-program.md
- done when:
  - Standard Sacramento quote bands, discount guardrails, and handoff thresholds are documented and used.
  - Only non-standard commitments escalate above the designated human commercial owner.

## Publish Sacramento city-opening response tracking

- key: city-opening-response-tracking
- phase: measurement
- agent owner: analytics-agent
- human owner: growth-lead
- purpose: Make Sacramento city-opening distribution measurable so operators can see which awareness lanes actually create replies before deeper capture or buyer workflows take over.
- human gate: none
- dependencies: city-opening-cta-routing, city-opening-first-wave-pack
- metrics dependencies: none
- validation required: true
- source: default_task_bundle
- inputs:
  - Sacramento city-opening brief
  - Sacramento CTA / intake path
  - growth_events
  - city launch ledgers
- done when:
  - Sacramento response-tracking view shows which warehouse/facility channels and which public-commercial community channels were activated, with asset or message attribution where available.
  - A real Sacramento city-opening response is defined and counted only when a reply, applicant, referral, operator callback, or buyer callback is recorded with city, lane, source, and CTA attribution.
  - Missing attribution or missing visibility is called out explicitly instead of assuming awareness work happened.

## Run the Sacramento city-opening reply-conversion and follow-up cadence lane

- key: city-opening-reply-conversion
- phase: supply
- agent owner: city-launch-agent
- human owner: growth-lead
- purpose: Convert live Sacramento city-opening replies across warehouse/facility and public-commercial channels into routed next steps with explicit follow-up cadence, instead of letting first responses decay across scattered threads.
- human gate: Escalate only when follow-up would require posture-changing claims, rights/privacy promises, pricing or commercial commitments, legal interpretation, or blanket permission language.
- dependencies: city-opening-response-tracking, city-opening-cta-routing
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - Sacramento city-opening brief
  - Sacramento CTA / intake path
  - Sacramento response-tracking view
  - live city-opening replies
  - city launch ledgers
- done when:
  - Sacramento reply-conversion queue exists with each live response tagged by responder type, channel, current status, next owner, next follow-up due, and downstream handoff target.
  - Sacramento follow-up cadence rules define first response, second follow-up, stale-response handling, and the handoff boundary into qualification, site-operator partnership, buyer handling, or no-fit closure.
  - At least one live Sacramento city-opening response is moved through the queue into qualification, operator/buyer handoff, blocked-with-reason, or explicit no-fit / closed-lost outcome.
  - Live responses do not sit unowned after landing; each one has an explicit next step and cadence state.

## Publish the Sacramento launch scorecard and blocker view

- key: city-scorecard
- phase: measurement
- agent owner: analytics-agent
- human owner: growth-lead
- purpose: Make Sacramento progress measurable and reviewable without relying on narrative updates.
- human gate: none
- dependencies: supply-qualification, proof-pack-listings, outbound-execution, city-opening-response-tracking, city-opening-reply-conversion
- metrics dependencies: robot_team_inbound_captured, proof_path_assigned, proof_pack_delivered, hosted_review_ready, hosted_review_started, hosted_review_follow_up_sent, human_commercial_handoff_started, proof_motion_stalled
- validation required: true
- source: default_task_bundle
- inputs:
  - growth_events
  - inboundRequests.ops.proof_path
  - city launch ledgers
  - published Sacramento proof assets
- done when:
  - Sacramento scorecard reports supply and demand progress against the launch thresholds.
  - Missing instrumentation is surfaced as blocked instead of smoothed over.

## Mirror Sacramento execution artifacts into Notion Knowledge and Work Queue

- key: notion-breadcrumbs
- phase: measurement
- agent owner: notion-manager-agent
- human owner: chief-of-staff
- purpose: Keep the Sacramento launch runnable and inspectable for humans outside the repo.
- human gate: Escalate only for ambiguous Notion identity or rights-sensitive content movement.
- dependencies: city-scorecard
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - Sacramento launch system doc
  - Sacramento issue bundle
  - Sacramento scorecard
- done when:
  - Sacramento execution system doc is mirrored into Notion Knowledge.
  - A Work Queue breadcrumb exists for the current Sacramento activation state and next human gate.

## Run the Sacramento switch-on review before activation

- key: switch-on-review
- phase: measurement
- agent owner: beta-launch-commander
- human owner: cto
- purpose: Confirm the software/runtime surfaces needed by the Sacramento launch are safe before switch-on.
- human gate: CTO review on release safety; founder only if compliance or rights evidence is ambiguous.
- dependencies: city-scorecard
- metrics dependencies: none
- validation required: false
- source: default_task_bundle
- inputs:
  - alpha:check
  - alpha:preflight
  - Sacramento launch system doc
- done when:
  - Sacramento switch-on review returns GO, CONDITIONAL GO, or HOLD with evidence.
  - Any software/runtime blocker is routed to the right engineering lane before launch activation.
