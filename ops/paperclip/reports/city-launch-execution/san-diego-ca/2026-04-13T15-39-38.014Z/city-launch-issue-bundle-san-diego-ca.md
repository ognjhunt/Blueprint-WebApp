# San Diego, CA Launch Issue Bundle

This issue bundle turns the San Diego playbook into executable lanes using the current Blueprint agent org.

## Maintain the San Diego capture target ledger

- key: city-target-ledger
- phase: founder-gates
- agent owner: city-demand-agent
- human owner: Growth Lead
- purpose: Rank which San Diego sites and site clusters should be captured first based on current robot workflow focus, buyer value, and access realism.
- human gate: Escalate only when a target requires a sensitive operator-lane, rights/privacy exception, or posture-changing outbound motion.
- dependencies: none
- inputs:
  - ops/paperclip/playbooks/city-demand-san-diego-ca.md
  - robot-team-demand-playbook.md
  - San Diego capture target ledger
- done when:
  - The San Diego target ledger names the immediate top 25, the next 100 expansion buckets, and the long 300-1000 site universe model.
  - Capture priorities stay tied to current robot workflow demand instead of generic city coverage.

## Lock San Diego source policy and invite/access-code posture

- key: growth-source-policy
- phase: founder-gates
- agent owner: growth-lead
- human owner: Growth Lead
- purpose: Keep San Diego sourcing narrow, truthful, and off the founder lane for routine approvals.
- human gate: Founder approval only if the policy expands spend, public posture, or channel scope beyond the bounded San Diego pilot.
- dependencies: none
- inputs:
  - ops/paperclip/playbooks/city-launch-san-diego-ca.md
  - capturer-supply-playbook.md
  - founder-approved San Diego launch posture
- done when:
  - San Diego source policy names allowed channels, disallowed channels, referral rules, and who may issue invites or access codes.
  - Routine invite/access-code decisions stay with Growth Lead and Ops Lead inside written guardrails.

## Publish San Diego intake rubric, trust kit, and first-capture thresholds

- key: ops-rubric-thresholds
- phase: founder-gates
- agent owner: ops-lead
- human owner: Ops Lead
- purpose: Give Intake, Field Ops, QA, and Rights lanes explicit San Diego rules so they can run without founder review.
- human gate: none
- dependencies: growth-source-policy
- inputs:
  - ops/paperclip/playbooks/city-launch-san-diego-ca.md
  - capturer-trust-packet-stage-gate-standard.md
  - field-ops-first-assignment-site-facing-trust-gate.md
- done when:
  - San Diego rubric covers source quality, access-path truth, equipment/device fit, trust-packet minimums, and approval outcomes.
  - San Diego first-capture thresholds and trust-kit checklist exist in one operator packet.

## Build the San Diego capturer prospect list and post package

- key: supply-prospects
- phase: supply
- agent owner: capturer-growth-agent
- human owner: Growth Lead
- purpose: Generate the first San Diego supply wave without widening into generic gig-market posture.
- human gate: Human review before any public posting or channel expansion beyond the written San Diego source policy.
- dependencies: city-target-ledger, growth-source-policy
- inputs:
  - capturer-supply-playbook.md
  - ops/paperclip/playbooks/city-launch-san-diego-ca.md
  - San Diego source policy
- done when:
  - 25-50 curated San Diego prospects are named with source bucket, rationale, and next move, or the org explicitly switches to the broader 100-signup path.
  - Any post copy stays draft-first and preserves no-guarantee capture language.

## Route San Diego applicants into qualification and approval

- key: supply-qualification
- phase: supply
- agent owner: intake-agent
- human owner: Ops Lead
- purpose: Classify San Diego applicants using the approved rubric instead of ad hoc founder review.
- human gate: Escalate only when the rubric is ambiguous or the application raises rights/privacy/trust exceptions.
- dependencies: ops-rubric-thresholds
- inputs:
  - San Diego intake rubric
  - waitlistSubmissions
  - capturer signup records
- done when:
  - San Diego applicants are tagged by source bucket, approval state, and missing-trust evidence.
  - Exceptions are blocked with explicit missing facts instead of silently held.

## Own approved San Diego capturers through onboarding and repeat-ready

- key: capturer-activation-success
- phase: supply
- agent owner: capturer-success-agent
- human owner: Ops Lead
- purpose: Give every approved San Diego mapper one routine relationship owner from approval through onboarding, first pass, and repeat-readiness so the founder is not the default support lane.
- human gate: Escalate only when routine support exposes a threshold, rights, privacy, payout, or policy exception.
- dependencies: ops-rubric-thresholds, supply-qualification
- inputs:
  - San Diego intake rubric
  - San Diego trust kit
  - field assignment and reminder state
  - capture QA evidence
- done when:
  - Each approved San Diego capturer has a named lifecycle owner for approved -> onboarded -> first capture -> first pass -> repeat-ready.
  - Routine mapper questions, support, and coaching stay with capturer-success-agent unless they become logistics, QA, rights, privacy, or policy exceptions.

## Assign San Diego first captures, reminders, and site-facing trust prep

- key: first-capture-routing
- phase: supply
- agent owner: field-ops-agent
- human owner: Ops Lead
- purpose: Turn approved San Diego capturers into real first captures inside bounded thresholds.
- human gate: Escalate only for missing site access, ambiguous permissions, or threshold exceptions.
- dependencies: supply-qualification, capturer-activation-success
- inputs:
  - San Diego first-capture thresholds
  - capture_jobs
  - field-ops-first-assignment-site-facing-trust-gate.md
- done when:
  - Approved San Diego capturers receive assignment, reminder, and site-facing trust steps through the existing field-ops lane.
  - Travel, timing, and access blockers are explicit on the issue and visible in the admin queue.

## QA San Diego first captures and route recapture decisions

- key: capture-qa
- phase: proof-assets
- agent owner: capture-qa-agent
- human owner: Ops Lead
- purpose: Ensure San Diego proof assets are real, clean, and ready for buyer proof work.
- human gate: none
- dependencies: first-capture-routing
- inputs:
  - pipeline artifacts
  - capture QA evidence
- done when:
  - San Diego captures receive PASS, BORDERLINE, or FAIL with explicit evidence.
  - Recapture instructions are attached when the first pass is not proof-ready.

## Clear rights, provenance, and privacy on San Diego proof assets

- key: rights-clearance
- phase: proof-assets
- agent owner: rights-provenance-agent
- human owner: Designated human rights reviewer
- purpose: Make San Diego proof packs releasable without weakening trust boundaries.
- human gate: Human rights review for sensitive or precedent-setting privacy, rights, or commercialization questions.
- dependencies: capture-qa
- inputs:
  - pipeline compliance artifacts
  - site-facing trust evidence
  - rights/provenance checklist
- done when:
  - Each San Diego proof asset is marked CLEARED, BLOCKED, or NEEDS-REVIEW with evidence citations.
  - Policy-setting exceptions route to the human reviewer and founder only when precedent changes.

## Assemble San Diego proof packs and publish 1-2 proof-ready listings

- key: proof-pack-listings
- phase: proof-assets
- agent owner: buyer-solutions-agent
- human owner: Ops Lead
- purpose: Turn San Diego captures into concrete exact-site proof assets with a hosted-review path.
- human gate: Escalate only when a buyer-visible claim would outrun the underlying evidence or commercial scope.
- dependencies: city-target-ledger, rights-clearance
- inputs:
  - CLEARED San Diego proof assets
  - robot-team-demand-playbook.md
  - proof-path-ownership-contract.md
- done when:
  - At least 1-2 San Diego proof-ready listings or equivalent proof packs exist with exact-site versus adjacent-site labeling.
  - Each proof pack includes provenance, coverage boundaries, hosted-review path, and next-step guidance.

## Research San Diego robot-company target accounts and buyer clusters

- key: buyer-target-research
- phase: demand
- agent owner: demand-intel-agent
- human owner: Growth Lead
- purpose: Build a real San Diego demand list that matches the proof assets Blueprint can actually show.
- human gate: none
- dependencies: proof-pack-listings
- inputs:
  - ops/paperclip/playbooks/city-demand-san-diego-ca.md
  - robot-team-demand-playbook.md
  - San Diego proof-ready listings
- done when:
  - 20-40 named San Diego-relevant robot-company targets are researched with facility/workflow fit and proof-path notes.
  - Exact-site versus adjacent-site proof rules are explicit per target.

## Prepare San Diego proof-led outbound package and first touches

- key: outbound-package
- phase: demand
- agent owner: robot-team-growth-agent
- human owner: Growth Lead
- purpose: Make outbound specific to San Diego proof assets and hosted review instead of generic AI messaging.
- human gate: Human review before any live send.
- dependencies: buyer-target-research
- inputs:
  - buyer-target-research
  - San Diego proof packs
  - standard commercial handoff rules
- done when:
  - San Diego outbound templates lead with one site, one workflow lane, proof-led CTA, and hosted-review next step.
  - 10-20 tailored first touches are queued for operator approval or event-driven send.

## Run San Diego outbound and move serious buyers into hosted review

- key: outbound-execution
- phase: demand
- agent owner: outbound-sales-agent
- human owner: Growth Lead
- purpose: Convert named San Diego targets into serious proof conversations without dragging the founder into routine work.
- human gate: Escalate only for posture changes, non-standard terms, or sensitive rights/privacy questions.
- dependencies: outbound-package
- inputs:
  - approved outbound package
  - San Diego buyer target list
- done when:
  - 5-8 San Diego buyer conversations are active with explicit next steps.
  - 2-3 hosted proof reviews are run end to end or clearly blocked with named reasons.

## Keep San Diego buyer threads inside standard commercial handling

- key: buyer-thread-commercial
- phase: commercial
- agent owner: revenue-ops-pricing-agent
- human owner: Designated human commercial owner
- purpose: Prevent routine pricing and packaging questions from escalating to founder review.
- human gate: Human commercial owner approval for standard quotes; founder approval only for non-standard commitments.
- dependencies: outbound-execution
- inputs:
  - San Diego buyer conversations
  - San Diego proof packs
  - revenue-ops-pricing-agent-program.md
- done when:
  - Standard San Diego quote bands, discount guardrails, and handoff thresholds are documented and used.
  - Only non-standard commitments escalate above the designated human commercial owner.

## Publish the San Diego launch scorecard and blocker view

- key: city-scorecard
- phase: measurement
- agent owner: analytics-agent
- human owner: Growth Lead
- purpose: Make San Diego progress measurable and reviewable without relying on narrative updates.
- human gate: none
- dependencies: supply-qualification, proof-pack-listings, outbound-execution
- inputs:
  - growth_events
  - inboundRequests.ops.proof_path
  - city launch ledgers
  - published San Diego proof assets
- done when:
  - San Diego scorecard reports supply and demand progress against the launch thresholds.
  - Missing instrumentation is surfaced as blocked instead of smoothed over.

## Mirror San Diego execution artifacts into Notion Knowledge and Work Queue

- key: notion-breadcrumbs
- phase: measurement
- agent owner: notion-manager-agent
- human owner: Chief of Staff
- purpose: Keep the San Diego launch runnable and inspectable for humans outside the repo.
- human gate: Escalate only for ambiguous Notion identity or rights-sensitive content movement.
- dependencies: city-scorecard
- inputs:
  - San Diego launch system doc
  - San Diego issue bundle
  - San Diego scorecard
- done when:
  - San Diego execution system doc is mirrored into Notion Knowledge.
  - A Work Queue breadcrumb exists for the current San Diego activation state and next human gate.

## Run the San Diego switch-on review before activation

- key: switch-on-review
- phase: measurement
- agent owner: beta-launch-commander
- human owner: CTO
- purpose: Confirm the software/runtime surfaces needed by the San Diego launch are safe before switch-on.
- human gate: CTO review on release safety; founder only if compliance or rights evidence is ambiguous.
- dependencies: city-scorecard
- inputs:
  - alpha:check
  - alpha:preflight
  - San Diego launch system doc
- done when:
  - San Diego switch-on review returns GO, CONDITIONAL GO, or HOLD with evidence.
  - Any software/runtime blocker is routed to the right engineering lane before launch activation.
