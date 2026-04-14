# City Launch Planning — Current Focus

## Objective
Use the generic capturer-growth playbook plus Blueprint's existing supply, demand, and operations research to publish one concrete city launch guide per week for the selected city.

## Planning Engine Requirement

All substantial city-launch planning work must use the Gemini Deep Research harness documented in
`docs/city-launch-deep-research-harness-2026-04-11.md`.

Operational rule:
- use `npm run city-launch:plan -- --city "<City, ST>"` as the default upstream planning pass for city launch work
- treat the generated deep-research playbook as the expansive planning source
- then condense the relevant decisions into the compact city-launch playbook and issue-ready follow-ups
- when the selected city moves from planning to execution, hand the approved city playbook into `npm run city-launch:activate -- --city "<City, ST>"` and route work through `ops/paperclip/programs/city-launch-activation-program.md`
- do not treat ad hoc web summaries or generic LLM output as sufficient replacements for this harness

## City Selection
Only one city is active at a time.

Selection rule:
- pick the next city whose guide is missing or stale and whose evidence packet is strongest
- do not start a second city in the same cycle unless the current city has been handed off for execution or explicitly closed
- treat all non-selected cities as deferred/background only until a new evidence packet exists
- do not rotate just for novelty; choose the next city where a guide would improve real planning clarity

Deferred-city reopening requires one of:
- one new exact-site proof signal tied to that city, or
- one new qualified local anchor demand/supply signal tied to that city, or
- one explicit founder request after reviewing a bounded decision packet

Absent one of those, do not reopen deferred-city planning and do not create founder-facing review work about it.

## Required City Guide Structure
For every city guide, maintain:
- launch thesis
- why this city now
- target capturer profile
- best-fit channels
- city-opening distribution layer
- city channel map
- first-wave outreach/posting assets
- city-facing CTA / intake path
- response-tracking plan
- reply-conversion queue and follow-up cadence rules
- channel/account registry
- send ledger and first-send approval state
- city-opening execution report
- local trust / quality risks
- operational dependencies
- web / funnel dependencies
- measurement plan
- launch readiness score
- immediate next actions
- a four-layer operating split:
  - founder-only
  - human operator-owned
  - agent-prepared / autonomous
  - exception-only escalation

## Initial Readiness Dimensions
Score each city 1-5 on:
1. channel reachability
2. likely supply quality
3. operations feasibility
4. measurement readiness
5. legal/compliance clarity
6. strategic importance

## Required Outputs
- update exactly one `ops/paperclip/playbooks/city-launch-<slug>.md` file per weekly run when repo writes are available
- create or update one Notion Knowledge page for that city's current guide every run
- create or update one Notion Work Queue breadcrumb whenever human review, approval, or downstream follow-up is required
- use `ops/paperclip/playbooks/city-launch-template.md` as the default shape for new cities
- create issue-ready actions for other agents only when they represent real next work
- keep a clear list of what still needs irreversible human decisions, but do not let those future decisions stop reversible agent work
- do not leave the city guide only as a Paperclip attachment or comment

## Constraints
- No public launch claims
- No paid-spend approval
- No legal interpretation
- No promises on city-level demand or earnings
- No founder-facing routine approval work for invite issuance, referral execution, intake rubric approval, first-capture thresholds, trust-kit creation, analytics validation, or proof-pack quality confirmation when written operator guardrails already exist
- Deep Research outputs are planning artifacts only; they do not override human gates or make live commitments

## Operating Rule
The city-launch agent does not invent a launch. It translates reusable strategy into city-specific plans and makes dependencies explicit, one city at a time.

Autonomy-first execution rule:

- once a city is founder-approved and activated, assume every lane should run immediately
- do not convert missing policy packets, lawful-access proof, telemetry, proof-ready assets, or hosted reviews into idle states for the whole city
- instead, make each lane execute the best reversible approach now and stop only where a real external confirmation, signature, or irreversible human decision is actually required
- do not assume a city is open just because target lists exist; make the city-opening brief, channel map, first-wave assets, CTA path, and response tracking explicit before expecting replies
- once replies exist, do not assume response tracking is enough; make the reply-conversion queue, follow-up cadence, and downstream handoff rules explicit so the first responses become motion rather than stale leads
- city planning and source policy must distinguish private controlled interiors from public, non-controlled commercial locations; the first stay on operator / buyer-linked / professional channels, while the second may use bounded online community sourcing
- do not treat a prospect list as completed supply execution if no live intake signal exists yet; the first policy-compliant invite, reply, or applicant record must be pushed into the live intake path
- do not mark lawful-access or other external-confirmation lanes done when only a draft packet exists; if signatures or counterpart confirmation are still pending, leave the issue open or blocked with that dependency named explicitly

Required ownership split in every city:
- Founder-only: city go/no-go, gated-versus-expand decisions, new spend envelopes, posture-changing public claims, non-standard commercial commitments, policy-level rights/privacy exceptions
- Human operator-owned: Growth Lead for channel/referral/source posture; Ops Lead for intake rubric, activation thresholds, trust kit, and launch-readiness checklist; designated human commercial owner for standard commercial handling inside approved bands
- Agent-prepared / autonomous: city-launch-agent, intake-agent, field-ops-agent, analytics-agent, notion-manager-agent, webapp-codex, buyer-solutions-agent, and revenue-ops-pricing-agent prepare evidence and packets inside the human-owned guardrails
- Exception-only escalation: founder sees only the bounded packet for city posture changes or irreversible exceptions

## Weekly Run Log

### 2026-04-06
- Refreshed current city playbooks with latest findings
- Incorporated April 5 agent bootstrap completions as new downstream capacity
- Incorporated growth-lead weekly review analytics gap findings
- No new city guides published this run (current city still first in queue; Chicago remains deferred)
- Key block: analytics instrumentation not deployed — city expansion cannot be evidence-based
