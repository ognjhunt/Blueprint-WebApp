# Austin, TX City Demand Plan

Status: internal operating proposal only. Do not use this as public launch copy, outreach copy, or a city-live claim.

Scores below are relative planning scores, not objective market measurements.

## City Call

Austin should be treated as an emerging robot-team demand city, not a default live market.

The strongest Austin wedge is:

- north and east Austin industrial corridors for humanoid and mobile-manipulation teams evaluating one exact warehouse, light-manufacturing, or back-of-house retail site before travel

Why this wedge:

- Apptronik publicly centers 3PL, retail, and manufacturing workflows, which fit Blueprint's site-specific package and hosted-session story
- Texas Robotics gives Austin a real research-to-industry robotics base, but that does not yet equal broad buyer-ready demand for Blueprint across every facility type
- Capital Factory gives Austin an active founder and investor network, which helps internal discovery and community mapping without justifying autonomous outreach

## Localized ICP

| Local cluster | Best fit for Blueprint | Local evidence | Readiness | Main blocker |
| --- | --- | --- | --- | --- |
| Humanoid and general-purpose robotics teams | Exact-site evaluation before customer demos or integration travel | Apptronik plus Texas Robotics industry linkage | Medium | No Austin-specific public proof pack yet |
| Warehouse and retail-ops automation teams | Site package plus hosted reruns on one customer facility | Apptronik publicly names 3PL and retail workflows | Medium | Need one truthful Austin facility example |
| Light-manufacturing and machine-tending teams | Hosted evaluation for one workcell or line-side zone | Apptronik publicly names manufacturing and machine tending | Medium | Need tighter sample deliverables for machine-tend tasks |
| Food-service or smart-kitchen teams | Optional secondary wedge, not the lead city story | Internal repo mock example exists, but not as buyer-proof | Low | No current Austin capture-backed proof asset |

## Message Localization

Keep the generic message hierarchy intact, but localize the examples:

1. Lead with one exact Austin-area site, not "Austin is booming."
2. Use warehouse, machine-tending, replenishment, tote movement, or trailer workflows as the first task examples.
3. Make the hosted path sound like one site, one robot, one task question before travel.
4. Keep operator revenue-share or commercialization language secondary unless a real operator-access thread exists.

## Facility Types To Prioritize

- warehouse and 3PL interiors
- retail backrooms and replenishment zones
- light-manufacturing floors with line-side handoff or machine-tending tasks
- optional test kitchens or food-prep labs only after a real buyer asks for them

## What Must Be True Before Austin Execution

### Proof Pack

- at least one Austin-area capture-backed site must exist in `/world-models` or `/proof`
- the listing must show what artifacts exist now, not a generalized future promise
- the task lane should be a repeatable indoor workflow with clear success/failure framing

### Hosted Session

- one Austin-relevant robot profile should be configured for warehouse or line-side evaluation
- hosted-session setup must make site, task, and launch blockers explicit
- export expectations must be legible for policy comparison, debugging, and internal review

### Intake And Ops

- inbound request fields should capture facility type, aisle/workcell constraints, task lane, and why Austin matters to the buyer
- ops needs a human-reviewed answer for whether Austin demand is buyer-led, operator-led, or capture-led in each case

### Human Gates

- no Austin outreach sequence without human approval
- no public "Austin is live" claim until there is at least one Austin proof asset plus a human-approved operating path

## Optional Site-Operator Lane

Use the operator lane only when it unlocks a specific site:

- warehouse operators who control access to one evaluation-worthy facility
- light-manufacturing operators who can approve capture and commercialization boundaries
- kitchen or hospitality operators only when a robot-team buyer already exists

Do not make Austin operator outreach the default motion. The robot-team buyer still anchors the plan.

## Relevant Communities And Events

Internal-only suggestions. Human review required before any participation or outreach.

- Texas Robotics community and industry partnership surface: https://robotics.utexas.edu
- Capital Factory founder and meetup network in Austin: https://capitalfactory.com
- Austin AI and autonomy-adjacent meetup flow visible through Capital Factory's event calendar
- Apptronik's workflow focus for 3PL, retail, and manufacturing: https://apptronik.com

## Readiness Scorecard

| Dimension | Score | Why |
| --- | --- | --- |
| Buyer cluster density | 3/5 | Austin has real robotics gravity, but the city signal is still narrower than the Bay Area |
| Facility fit | 4/5 | Warehouses, retail backrooms, and light manufacturing fit Blueprint's exact-site story well |
| Proof-pack readiness | 1/5 | Current repo surfaces do not show a capture-backed Austin buyer listing or proof artifact |
| Hosted-session fit | 3/5 | The product shape fits Austin workflows, but local proof is still thin |
| Community access | 3/5 | Capital Factory and Texas Robotics provide network surfaces, but that is not the same as approved buyer demand |
| Human-gate readiness | 2/5 | Austin still needs a human decision on whether the first move is buyer discovery, capture buildout, or operator access |

Overall call: promising but not ready for autonomous city-level execution. Austin is best treated as a capture-and-proof build city first.

## What Stays Generic

- capture-first framing
- site package versus hosted evaluation split
- provenance, rights, and privacy language
- no deployment guarantee language
- pricing, procurement, and contract handling staying with humans

## Issue-Ready Follow-Up Work

1. `market-intel-agent`
Validate 10 Austin-area robot teams or autonomy programs against this wedge, sorted into humanoid, warehouse automation, and manufacturing workflows. For each, record whether Blueprint's likely first value is site package, hosted evaluation, or not a fit.

2. `conversion-agent`
Draft Austin-specific internal copy variants for `/for-robot-teams` and `/world-models` that use warehouse, replenishment, and machine-tending examples without implying Austin is live.

3. `intake-agent`
Propose Austin request fields that capture facility subtype, travel-avoidance goal, operator access status, and the exact indoor task lane.

4. `ops-lead`
Define the minimum Austin proof pack for a first industrial site: artifacts shown, hosted-session launch blockers, and what must stay behind human review.

## Evidence Notes

- `client/src/data/siteWorlds.ts` currently includes a Bay Area site-world example but no Austin buyer-facing example.
- `client/src/pages/Portal.tsx` includes an Austin mock card, which is useful as internal inspiration but not strong enough to count as Austin proof.
- Apptronik public workflow and industry pages support the Austin industrial/warehouse wedge.
- Texas Robotics and Capital Factory support the claim that Austin has a real robotics network, but not a blanket Blueprint-ready buyer market.
