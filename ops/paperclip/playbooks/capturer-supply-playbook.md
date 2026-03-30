# Blueprint Capturer Supply Playbook

## Purpose
This is the reusable Blueprint playbook for acquiring, activating, and retaining capturers before customizing tactics by city.

It should be updated by `capturer-growth-agent` as new market and operating evidence arrives.

## Core Thesis
Blueprint should grow capturer supply the same way it grows capture quality: truthfully and deliberately.

That means:
- do not optimize for raw signups that never activate
- do not run open-city top-of-funnel pushes before gated cohorts are working
- do not make promises about earnings or work volume that the product cannot support
- do not copy gig-economy tactics that trade trust for short-term volume
- do optimize for reliable, rights-safe, high-quality local contributors

## Generic Funnel
1. targeted channel entry
2. gated cohort intake or access-code expression of interest
3. qualification and trust-packet review
4. approval into an active cohort
5. onboarding and expectation setting
6. first capture activation
7. quality review, trust building, and contributor tiering
8. repeat capture participation
9. referral or ambassador loop

## Candidate Channel Stack

Open discovery should feed gated cohorts, not immediate broad approval. The operating default is: find promising contributors in public or semi-public channels, then move them into invite, access-code, or operator-reviewed cohorts before scale.

| Channel | Lane | Hypothesis | Audience | Expected quality | Evidence level | Human dependencies |
| --- | --- | --- | --- | --- | --- | --- |
| Robotics / creator / mapping communities | Gated cohort | Highest-signal early supply comes from communities that already understand spatial, capture, or technical field work | technical creators, robotics-adjacent contributors, mapper profiles | high | high | community outreach, operator review, access-code or invite workflow |
| Local photo / video / production freelancer groups | Gated cohort | contributors already used to site visits and media capture can activate faster than generic gig applicants | freelance camera and production operators | medium-high | medium | truthful screening copy, portfolio review, trust packet |
| Campus technical communities | Gated cohort | school-linked or program-linked cohorts can create higher-trust early density | student builders, labs, clubs, campus creators | medium-high | high | campus relationship owner, access-code logic, approval queue |
| Local operations and field-service communities | Gated cohort | contributors with field discipline can convert if expectations are explicit | inspectors, survey-support profiles, field-service workers | medium | medium | intake review, policy and rights briefing |
| Approved-capturer referrals | Gated referral | the best new contributors come from activated capturers, not unqualified social reach | approved capturers and their trusted peers | high | high | referral tracking, milestone verification, human-approved incentive copy |
| Founder/operator outbound into trusted networks | Gated cohort | direct outreach can seed the first city cohorts before scalable channels are live | known local connectors and community leads | high | medium | operator time, cohort management, approval follow-up |
| Partner channels with aligned local networks | Gated cohort | aligned institutions can provide trust and density if the workflow is controlled | schools, studios, robotics groups, creator orgs | medium-high | medium | partnership owner, materials, intake stage management |
| City-specific local communities | Open discovery | useful for lead discovery only after intake and trust controls exist | local creator and neighborhood groups | low-medium | medium | moderation, fast follow-up, move leads into gated intake |
| Niche field-task platforms | Open discovery | can surface supply pockets but usually with more noise and trust burden | task-platform workers | low-medium | medium | duplicate/content checks, stronger review, limited pilot scope |
| Event-based recruiting pushes | Gated cohort | time-bounded cohorts can work when intake and onboarding are already standardized | hackathons, meetups, local activations | medium | medium | event coordination, fast stage management, human attendance |

## Cohort and Access Rules
- Austin and San Francisco should start with cohort-based supply seeding, not citywide open recruiting.
- Open channels are discovery surfaces only until approval rate, first-capture activation rate, and trust checks are stable.
- Access codes, invite links, or direct operator review should be the default way to admit early cohorts.
- Private or higher-trust work should stay restricted to approved contributors who have passed a first capture and trust review.

## Messaging Hierarchy
1. what Blueprint is asking people to do
2. why the work is real and valuable
3. what approval, authorization, and trust expectations exist
4. what happens after approval and first capture
5. what is not guaranteed about work volume, timing, or incentives

## Stage Management and Trust Packet

Every active city or cohort should use the same stage language so operators do not recreate onboarding from scratch.

### Suggested stage model
1. sourced
2. applied / expressed interest
3. trust packet requested
4. trust packet verified
5. approved
6. onboarded
7. first capture submitted
8. first capture passed
9. repeat-ready / tiered

### Trust packet minimums before scale
- identity verification appropriate to the workflow
- authorization proof or field-ready explanation artifacts when needed, using [field-ops-first-assignment-site-facing-trust-gate.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/field-ops-first-assignment-site-facing-trust-gate.md) for first-assignment decisions
- duplicate and content-integrity checks
- location and device validation where relevant
- policy, privacy, and rights acknowledgement

If these controls are not operational, Blueprint should not widen top-of-funnel spend or public recruiting intensity.

## Incentive Rules
- referral and incentive ideas may be proposed here
- referral logic should trigger only after an approved capturer completes a first passed capture or equivalent activation milestone
- no compensation or bonus change is valid until a human approves it
- public earnings language, bonus claims, or invite-post copy require human review before use
- avoid tactics that create fake signups, low-trust behavior, or adversarial quality outcomes

## Referral Loop Rules
- referrals are an activation-quality loop, not a signup-volume loop
- only approved capturers who have passed a first capture should be eligible to refer
- referred contributors should count only after their first passed capture or equivalent quality milestone
- referral programs should prefer metro-specific or cohort-specific windows over blanket always-on pushes
- private higher-trust opportunities can be used as a retention and quality lever before cash-heavy public incentives

## Quality and Trust Filters
- market and device fit
- responsiveness
- trust packet completeness
- first-capture quality
- repeat reliability
- duplicate/content integrity
- location and device validation where relevant
- policy and rights adherence
- ability to operate inside standardized stage management

## Measurement Requirements
- signup volume by channel
- gated-cohort entry volume by source
- approval rate by channel
- trust-packet completion rate
- first-capture activation rate
- first-capture pass rate
- repeat capture rate
- referral-to-passed-capture rate
- ops load per activated contributor
- quality pass rate by source
- time spent in each stage before approval and first passed capture

## Ready / Blocked / Needs Data

### Ready now
- gated cohort seeding through trusted communities
- activation-gated referral design
- standardized stage management
- trust packet as a prerequisite for broader scale

### Blocked on operating readiness
- public incentive or compensation changes
- earnings-led recruiting copy
- broad open-city recruiting without stronger trust controls

### Needs data
- Blueprint channel-by-channel capturer conversion
- Blueprint trust-packet drop-off and approval timing
- city-by-city first-capture activation benchmarks
- ops burden by cohort source and contributor tier

## Handoffs
- `intake-agent`: signup qualification, trust-packet rules, approval stages, and contributor tier entry rules
- `analytics-agent`: instrumentation for gated cohorts, trust-packet completion, first passed capture, and referral activation quality
- `conversion-agent`: landing pages, forms, access-code flows, and truthful recruiting copy
- `city-launch-agent`: Austin and San Francisco adaptation using gated cohort defaults instead of open-city pushes
- `ops-lead` / `field-ops-agent`: authorization artifacts, identity workflow, duplicate/content checks, and stage-management operations once supply is real
