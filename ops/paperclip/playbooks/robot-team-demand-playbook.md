# Blueprint Robot-Team Demand Playbook

## Purpose
This is the reusable Blueprint playbook for generating and qualifying robot-team demand before customizing motions by city.

It should be updated by `robot-team-growth-agent` as new demand and operating evidence arrives.

## Core Thesis
Blueprint should grow robot-team demand the same way it grows product trust: truthfully and specifically.

That means:
- do not optimize for generic AI curiosity that never becomes an exact-site buying conversation
- do not lead with abstract model claims when the real product is site-specific world models and hosted access
- do not treat qualification or readiness as the main thing being sold
- do optimize for technical buyers who need exact-site coverage, provenance, hosted-session proof, and clear rights boundaries

## Primary Buyer Lane
Blueprint's core demand lane is robot teams buying:
- site-specific world-model packages
- hosted access to exact-site environments
- attached provenance, rights, and privacy boundaries
- optional trust or readiness outputs when they materially help the deal

## Secondary Buyer Segments
These can matter, but they are not the center of the playbook:
- deployment and operations teams around robot fleets
- systems integrators coordinating site-specific robot rollouts
- simulation or data teams that need exact-site grounding for downstream work

## Generic Buyer Funnel
1. demand signal or introduction
2. site and use-case fit check
3. 24-hour proof-path triage
4. proof-pack review
5. hosted-session demo or exact-site artifact review
6. commercial scoping and human-gated questions
7. buyer activation or package purchase
8. usage feedback, renewal, or adjacent site expansion

## ICP and Segment Guidance

### 1. Primary ICP
- robot autonomy teams with real deployment or evaluation needs
- teams that care about exact sites more than generic benchmark content
- buyers who can evaluate hosted proof and provenance artifacts

### 2. Strong Secondary ICP
- deployment-heavy robotics programs coordinating facility-specific rollouts
- technical operators who need site-grounded assets before spend or field work
- partner-led buyers who already work inside robotics data, teleoperation, or industrial-software stacks and want Blueprint to fit into an existing review workflow

### 3. Weak-Fit Segments
- buyers seeking only generic model demos
- teams that do not care which site is used
- buyers expecting mature procurement, pricing, or legal packaging that Blueprint does not yet support

## Message Hierarchy
1. Blueprint turns real captured sites into exact-site world-model packages and hosted review surfaces.
2. The buyer should understand the proof path within a day, not after a bespoke integration cycle.
3. The primary deliverables are exact-site packages, hosted access, and clear artifact handoff expectations, not abstract AI claims.
4. Blueprint should be explained as fitting into an existing robotics, inspection, or data-review stack where possible.
5. Provenance, privacy boundaries, rights boundaries, and recency stay attached to the product.
6. Optional trust or readiness layers can support a deal when they materially help.

## Latest Operating Evidence
- As of 2026-03-30, `inboundRequests.ops.proof_path` is the authoritative storage layer for proof-path timestamps, but truthful reporting still depends on new requests plus ops-stamped manual milestones for steps the system cannot infer automatically.
- The intake contract now captures buyer role, target site type, proof-path preference, existing-stack or review-workflow context, and early human-gated topics, so the first response can distinguish exact-site proof from adjacent-site proof without guessing.
- The reusable proof motion now has explicit support artifacts in `hosted-review-artifact-handoff-checklist.md` and `robot-team-finance-support-routing-playbook.md`, so hosted review and commercial-routing claims do not need to live as unwritten tribal knowledge.
- Austin and San Francisco playbooks now inherit this shared proof system, but live intake review still shows no city-tagged buyer-demand evidence for either city. City-specific messaging should stay hypothesis-labeled until tagged traffic is real.

## Reusable Segment and Channel Matrix
| Buyer role | Site / workflow need | Channel fit | Proof requirement | Evidence level | Human dependencies |
| --- | --- | --- | --- | --- | --- |
| autonomy or perception lead | evaluate an exact site before deployment or model tuning | founder intros, robotics builder networks, technical community events | exact-site proof pack plus hosted review within 24 hours | ready now | human only for pricing, rights exceptions, and deeper scope questions |
| deployment or operations lead | remote review before field travel, rollout planning, or intervention prep | partner referrals, operations communities, deployment-heavy intros | hosted review path, artifact handoff checklist, recency and site coverage summary | ready now | human for site access, delivery commitments, and rollout coordination |
| systems integrator or industrial data partner | fit Blueprint output into an existing customer stack | stack-adjacent partners and implementation relationships | compatibility statement, artifact export expectations, and explicit gap labeling | partial | human for integration scoping, commercials, and partner terms |
| simulation or data platform owner | consume exact-site artifacts inside an existing data workflow | developer-native channels, docs, partner introductions | standardized artifact structure, provenance, and what would require extra packaging | partial | human for delivery scope and any custom export commitments |

## Proof Pack Requirements
- exact site summary
- 24-hour proof-path target for first qualified review
- capture provenance summary
- capture recency and known site coverage boundaries
- package and runtime artifact description
- existing-stack compatibility statement describing how the buyer can inspect or ingest the current output
- hosted-session walkthrough or access path
- standardized artifact handoff checklist covering what the buyer receives now
- rights, privacy, and consent boundary summary
- explicit statement of what exists now versus what would require additional capture, packaging, integration, approvals, or ops work

## Proof Pack Structure
Every reusable proof pack should be organized in this order so the buyer can understand the offer without a live explanation:

1. Buyer context block
   - buyer role
   - target robot workflow
   - facility type
   - exact-site versus adjacent-site label
2. Site evidence block
   - site name or labeled proxy description
   - capture date or recency window
   - known coverage boundaries
   - provenance and rights summary
3. Review-now block
   - hosted-session entry point or walkthrough path
   - what the buyer can inspect remotely today
   - expected time to first technical review
4. Artifact handoff block
   - package or artifact types currently available
   - compatibility notes for the buyer's stack
   - what can be reviewed asynchronously versus what needs a live session
5. Gap and escalation block
   - what still requires more capture, packaging, or integration
   - what still requires human review for rights, privacy, commercials, or access
   - named next step: proof review, scoped follow-up, or human handoff

## 24-Hour Proof Path
For qualified robot-team demand, Blueprint should aim to move from first serious signal to a reviewable proof path inside one business day.

1. Confirm the buyer role, target site type, and immediate workflow question.
2. Decide whether current Blueprint evidence supports an exact-site proof pack, a clearly labeled adjacent-site proof pack, or only a scoped follow-up.
3. Deliver a standard proof pack with hosted review access or walkthrough instructions.
4. Attach artifact handoff expectations so the buyer knows what can be reviewed asynchronously versus what still needs a live conversation.
5. Flag all human-gated topics immediately instead of hiding them in later stages.

If Blueprint cannot satisfy this proof path truthfully, the motion should be framed as a scoped follow-up, not as a ready-now demo.

## Hosted Review and Artifact Handoff Standard
Every serious robot-team motion should default to a hosted review and artifact handoff structure that answers:

- what exact site or adjacent-site evidence is being shown
- what the buyer can inspect remotely right now
- what artifact formats or outputs exist today
- how the current output fits into the buyer's existing stack or review workflow
- what additional capture, packaging, integration, or approvals would still be required
- which questions must be escalated to humans

The hosted review should feel like a technical evaluation surface, not a generic sales demo.

## Hosted-Session Demo Motion
1. Start with the target site type and the buyer's actual robot workflow.
2. Show only exact-site or clearly labeled adjacent-site proof.
3. Lead with what the buyer can review now within the existing proof pack and hosted surface.
4. Use hosted access to demonstrate grounded navigation or inspection, not speculative autonomy claims.
5. State how the current artifact handoff fits into the buyer's existing stack or review process.
6. Label any gaps that would require additional capture, packaging, integration, or approvals.
7. Escalate pricing, contracts, permissions, privacy, rights, and commercialization questions to humans.

## Buyer Follow-Up Standard
The default follow-up after a serious hosted review should be an artifact-led technical recap, not a generic sales email.

Within one business day after the hosted session or async review:
- restate the exact site or labeled adjacent-site evidence that was reviewed
- attach or relink the proof pack and hosted-session entry point
- list the specific artifacts the buyer can inspect now
- name the open technical questions that still block buyer confidence
- separate human-gated topics from product or evidence gaps
- propose one concrete next step: exact-site request, deeper technical review, or scoped human commercial handoff

If the hosted review surfaced a missing proof surface, the follow-up should say that directly instead of pretending the deal is already in commercial scoping.

## Channel Hypotheses
- founder-led introductions into technical robot-team networks
- robotics deployment and autonomy communities
- systems-integrator and rollout-partner relationships
- technical events where exact-site proof can be discussed credibly
- stack-adjacent partner channels where Blueprint can be evaluated inside an existing review or inspection workflow
- inbound traffic from truthful exact-site or hosted-session pages when instrumentation exists

## Source-Tag Discipline
- Keep reusable source tags limited to explicitly evidenced paths such as founder intro, university or lab intro, industrial partner, proof-led event, buyer-matchmaking community, and partner referral.
- Do not infer a city, community, or partner source from a vague conversation thread. If the source is unknown, leave it unknown and preserve that ambiguity in analytics.
- Treat city-specific channel bets as inherited hypotheses until live tagged demand shows that a source repeatedly reaches qualified hosted review.

## Packaging Expectations
Robot-team buyers should be able to understand:
- which site is covered
- how recent the capture is
- what product format is available now
- what hosted access includes
- how the current artifact can be reviewed or handed off inside an existing toolchain
- what rights, privacy, and commercialization boundaries are already known
- what still requires human scoping
- what still requires extra capture, packaging, or integration work

## Buyer-Motion Status
### Ready now
- exact-site or clearly labeled adjacent-site proof-pack review
- hosted review as the default technical evaluation surface
- provenance, rights, privacy, and recency labeling
- compatibility-oriented messaging that explains how current Blueprint output can fit into existing workflows
- ops-side hosted-review and artifact handoff checklist
- finance-support routing guidance that cleanly separates technical proof follow-up from human-only commercial decisions

### Blocked
- public proof-pack pages or contact flows that still over-weight qualification-first framing
- analytics and reporting work that still does not expose time-to-proof, proof-pack delivery, hosted review, follow-up, and stall reasons end to end
- any buyer motion that implies ready-now integration or procurement support Blueprint cannot yet deliver truthfully

### Needs data
- which partner channels produce the fastest path to qualified hosted review
- how often buyers accept adjacent-site proof versus requiring exact-site proof immediately
- where hosted review stops being enough and a deeper integration workflow becomes necessary
- whether Austin- or San Francisco-tagged buyer traffic is real enough to justify sharper city-specific copy and ops thresholds

## Measurement Requirements
- qualified robot-team inbound volume
- time from qualified inbound to first proof-pack delivery
- time from qualified inbound to hosted review availability
- proof-pack review to hosted-session rate
- hosted-session to follow-up rate
- exact-site request rate
- artifact handoff acceptance rate
- time to human commercial handoff
- ops load created by each buyer segment

## Funnel Instrumentation Map
| Stage | Required event or state | Why it matters |
| --- | --- | --- |
| demand signal | `robot_team_inbound_captured` with source, city, buyer role, and requested lane | separates real robot-team demand from generic awareness |
| fit check | `robot_team_fit_checked` with exact-site versus adjacent-site classification | shows whether Blueprint had truthful proof scope for the request |
| proof-path triage | `proof_path_assigned` with outcome: exact_site, adjacent_site, scoped_follow_up | measures how often serious demand gets a real proof path inside one day |
| proof-pack delivery | `proof_pack_delivered` with delivery timestamp and artifact summary | measures time-to-proof and proof coverage quality |
| hosted review ready | `hosted_review_ready` with hosted mode and review path | shows whether buyers received a real technical inspection surface |
| hosted review started | `hosted_review_started` with buyer segment and source | measures whether proof packs are compelling enough to open |
| hosted follow-up | `hosted_review_follow_up_sent` with next-step recommendation | keeps follow-up operational instead of anecdotal |
| buyer next action | `exact_site_request_created`, `deeper_review_requested`, or `human_commercial_handoff_started` | distinguishes product pull from commercial escalation |
| stalled motion | `proof_motion_stalled` with blocker reason | exposes whether demand is failing on proof, product gaps, or human gates |

Authoritative storage for proof-path milestones lives in `inboundRequests.ops.proof_path`. Historical requests remain incomplete until ops backfills the manual milestone fields, so reporting should explicitly distinguish live coverage from legacy gaps.

## Downstream Execution Queue
| Owner | Work package | Success condition |
| --- | --- | --- |
| `conversion-agent` | update buyer-entry and follow-up copy so robot-team flows lead with exact-site proof, hosted review, and artifact handoff instead of qualification-first framing | robot-team landing, signup, and contact surfaces describe the 24-hour proof path and hosted review clearly |
| `analytics-agent` | instrument the funnel events in this playbook and publish stage definitions for reporting | growth can see time-to-proof, hosted-review conversion, and stall reasons by buyer segment and source |
| `intake-agent` | classify inbound robot-team requests by buyer role, exact-site need, and proof-path outcome | intake can route serious requests into exact-site, adjacent-site, or scoped follow-up lanes without ambiguous qualification-only framing |
| `ops-lead` | define the operational checklist for proof-pack assembly, hosted review readiness, and human escalation triggers | ops can support the proof motion without ad hoc delivery behavior |
| `finance-support-agent` | define the human-gated commercial questions that should be separated from technical proof follow-up | pricing, contract, billing, and dispute questions stop contaminating the technical proof motion |
| `city-demand-agent` | inherit this proof-pack and hosted-review standard into Austin and San Francisco demand plans | city plans customize channels and clusters without rewriting the reusable buyer proof system |

## City Inheritance Rules
Austin and San Francisco plans should inherit the same message hierarchy, proof-pack standard, hosted review structure, and human-gate rules from this playbook.

Cities should customize:
- which communities and intros produce qualified demand
- which partner channels shorten access or deployment friction
- which site clusters show enough density to justify targeted follow-up

## Handoffs
- `conversion-agent`: buyer landing pages, proof-pack pages, and demo-request flows
- `analytics-agent`: instrumentation and funnel reporting
- `intake-agent`: inbound classification and missing-info handling
- `ops-lead`: delivery and operational coordination when demand becomes real work
- `finance-support-agent`: human-gated billing, dispute, and commercial support routing documented in [robot-team-finance-support-routing-playbook.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/robot-team-finance-support-routing-playbook.md)
- `city-demand-agent`: city-specific adaptation
