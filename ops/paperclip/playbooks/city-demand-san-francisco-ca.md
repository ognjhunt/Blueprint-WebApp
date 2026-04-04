# San Francisco, CA City Demand Plan

Status: internal operating proposal only. Do not use this as public launch copy, outreach copy, or a city-live claim.

Scores below are relative planning scores, not objective market measurements.

## City Call

San Francisco should be treated as a Bay Area robot-team corridor, not a downtown-only market.

The strongest San Francisco wedge is:

- Bay Area robot platform teams, especially along the Peninsula and South Bay corridor, that need exact-site hosted evaluation or site packages for one warehouse, lab-support, retail backroom, or hospital back-of-house workflow before travel

Why this wedge:

- the Bay Area has stronger robotics community density than Austin
- the current repo already includes a San Jose micro-fulfillment site-world example, which is much closer to a truthful local proof asset than Austin has
- Bay Area robotics communities are large and active, but the facilities and buyers are geographically spread, so the plan must stay corridor-based

## Localized ICP

| Local cluster | Best fit for Blueprint | Local evidence | Readiness | Main blocker |
| --- | --- | --- | --- | --- |
| Robot platform teams comparing policies or checkpoints | Hosted reruns on one customer site | Dense Bay Area robotics communities and ROS practitioners | High | Need stronger city-to-facility mapping per vertical |
| Humanoid and general-purpose robotics startups | Exact-site evaluation before customer visits | Bay Area community density plus active robotics events | Medium-high | Needs a tighter facility-type story than "anything indoors" |
| Logistics and micro-fulfillment teams | Site package plus hosted evaluation on one facility | Current San Jose micro-fulfillment example in the repo | High | Need public proof pack cleanup if this becomes the lead wedge |
| Hospital, lab-support, and service-ops robotics teams | Optional secondary wedge | Bay Area buyer density is plausible, but current local proof is weaker | Medium | Requires buyer-specific proof and stronger rights/access clarity |

## Message Localization

Keep the generic message hierarchy intact, but localize the examples:

1. Lead with one Bay Area corridor site and one task lane, not "San Francisco robotics is huge."
2. Use micro-fulfillment, back-of-house logistics, and repeatable service workflows first because the repo already has a nearby proof anchor.
3. Position hosted evaluation as a way for Bay Area teams to inspect the exact customer facility before sending engineers on site.
4. Keep commercialization and operator language secondary unless a real site-access conversation exists.

## Facility Types To Prioritize

- micro-fulfillment and warehouse interiors
- retail backrooms with repeatable pick or replenishment loops
- hospital or clinical back-of-house transport areas
- lab-support or service corridors only when the workflow is tight enough to be legible in a proof pack

## What Must Be True Before San Francisco Execution

### Proof Pack

- the San Jose micro-fulfillment example must stay clearly labeled as the proof anchor if it leads the city story
- the proof path should show what artifacts and hosted outputs already exist for a Bay Area buyer
- if the city story expands beyond micro-fulfillment, each new facility type needs its own truthful example

### Hosted Session

- hosted-session setup should expose one Bay Area-relevant robot/task combination without genericizing the market
- policy comparison, task reruns, and export paths need to remain tied to one exact site
- buyers must be able to tell what is a local proof asset versus a future desired site

### Intake And Ops

- inbound request fields should capture which part of the Bay Area matters to the buyer and whether the target site is local or remote
- ops needs a human-reviewed rule for when "San Francisco" really means South Bay, Peninsula, East Bay, or a buyer HQ with a non-local site

### Human Gates

- no autonomous Bay Area meetup outreach
- no public "San Francisco is live" language unless a human approves the corridor framing and proof anchor

## Optional Site-Operator Lane

Use the operator lane only when it unlocks a facility with real buyer pull:

- warehouse or micro-fulfillment operators with one concrete site
- hospital or lab operators with clear rights/access rules
- enterprise operators evaluating multiple Bay Area sites only after a human confirms commercial usefulness

Do not make site-operator partnerships the lead story for Bay Area demand.

## Relevant Communities And Events

Internal-only suggestions. Human review required before any participation or outreach.

- Silicon Valley Robotics events and startup support: https://www.svrobo.org
- ROS by the Bay meetup in Mountain View: https://www.meetup.com/ros-by-the-bay/
- HomeBrew Robotics Club in Sunnyvale: https://www.hbrobotics.org
- Use Bay Area community touchpoints to refine the corridor map, not to claim demand that is already proven

## Readiness Scorecard

| Dimension | Score | Why |
| --- | --- | --- |
| Buyer cluster density | 4/5 | Bay Area robotics communities and startup support are materially denser than Austin |
| Facility fit | 4/5 | Micro-fulfillment, retail backroom, and service corridors fit Blueprint's exact-site story |
| Proof-pack readiness | 3/5 | The repo already has a San Jose micro-fulfillment example, which is a usable local anchor |
| Hosted-session fit | 4/5 | Bay Area platform teams are a strong fit for reruns, checkpoint comparisons, and hosted review |
| Community access | 4/5 | SVR, ROS by the Bay, and HBRC create real internal mapping surfaces |
| Human-gate readiness | 3/5 | Better than Austin because local proof exists, but city claims still need corridor narrowing and human review |

Overall call: Bay Area is the stronger near-term city demand lane, but only if Blueprint treats it as a corridor with a proof anchor, not a broad "San Francisco" market story.

## What Stays Generic

- capture-first framing
- site package versus hosted evaluation split
- provenance, rights, and privacy language
- no deployment guarantee language
- pricing, procurement, and contract handling staying with humans

## Issue-Ready Follow-Up Work

1. `market-intel-agent`
Map 12 Bay Area robot teams or platform programs into corridor buckets: San Francisco, Peninsula, South Bay, and East Bay. Identify whether each team's likely first Blueprint use is site package, hosted evaluation, or not a fit.

2. `conversion-agent`
Draft Bay Area-specific internal copy variants that use the San Jose micro-fulfillment proof anchor and avoid collapsing the corridor into a generic San Francisco headline.

3. `analytics-agent`
Propose a city-segment view for robot-team funnel events so Bay Area traffic can be split by corridor and facility type without claiming demand is proven.

4. `ops-lead`
Define the rule for when the San Jose proof anchor is enough to support a Bay Area buyer conversation versus when a new local site capture is required.

## Evidence Notes

- `client/src/data/siteWorlds.ts` includes `Bayview Micro-Fulfillment Center` in San Jose, which is the strongest current Bay Area proof anchor in the repo.
- Silicon Valley Robotics, ROS by the Bay, and HomeBrew Robotics Club show an active Bay Area robotics community with current 2026 events and membership activity.
- This is still a corridor plan. The evidence does not justify a blanket claim that downtown San Francisco alone is the market center.
