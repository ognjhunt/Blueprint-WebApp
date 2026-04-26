# Austin, TX Capturer Lifecycle Ledger
- city: Austin, TX
- owner: capturer-success-agent
- human owner: ops-lead
- purpose: Track every approved Austin capturer through their full lifecycle: approved -> onboarded -> first capture -> first pass -> repeat-ready
- last updated: 2026-04-26T02:50:00.000Z

## Lifecycle Stages (Inherited from Durham Standard)

### 5. `approved`
Use when the contributor is eligible for Austin cohort participation and can be onboarded into real capture work under current policy.

Required evidence:
- approval timestamp
- approval owner (capturer-success-agent)
- any restrictions on allowed lanes, cities, or device classes (Austin-only by default for zero-budget launch)
- linked approval issue or intake record

Exit criteria:
- contributor receives onboarding and operating expectations
- move to `onboarded` stage

### 6. `onboarded`
Use when the contributor has received the current operating brief and knows what Blueprint does and does not authorize.

Required evidence:
- onboarding completed timestamp
- current policy and rights framing delivered (Austin zero-budget policy, warehouse-only initial scope)
- allowed next action is explicit (first capture assignment rules)
- field-facing trust script acknowledged

Exit criteria:
- first capture is assigned or submitted through the approved path
- move to `first_capture_assigned` stage

### 7. `first_capture_assigned`
Use when Austin has a truthful first assignment and the capturer has enough context to show up or submit without improvising permission claims.

Required evidence:
- job reference or assignment reference (linked to Austin target ledger site)
- named Blueprint contact path (capturer-success-agent)
- current site posture (public commercial / operator-lane only, per Austin source policy)
- access path truth recorded (no implied permissions)

Exit criteria:
- the capturer submits the first capture or the job is re-routed
- move to `first_capture_submitted` stage

### 8. `first_capture_submitted`
Use when the contributor has delivered a first real capture for review.

Required evidence:
- linked capture submission or job reference
- submission timestamp
- site match to Austin target ledger confirmed

Exit criteria:
- capture QA returns a pass or fail outcome
- move to `first_capture_passed` or `blocked` stage

### 9. `first_capture_passed`
Use when capture QA confirms the first submitted capture met the required quality bar.

Required evidence:
- capture QA pass result (PASS outcome)
- any notes about restrictions, coaching, or follow-up requirements
- linked QA evidence record

Exit criteria:
- contributor can be considered for repeat participation and referral eligibility under current program rules
- move to `repeat_ready` stage

### 10. `repeat_ready`
Use when the contributor has passed the first-capture gate and can re-enter work without redoing first-time approval logic.

Required evidence:
- first passed capture is recorded
- any contributor tier or lane restriction is current (Austin warehouse lane only initially)
- repeat assignment eligibility confirmed

Exit criteria:
- contributor participates in repeat work
- referral eligibility can be considered if the current program rules allow it

## Current Approved Austin Capturers
| Capturer ID | Name | Approval Date | Current Stage | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- |
| *No approved Austin capturers yet* | - | - | - | - | Waiting for first approval signal from intake-agent (BLU-?? ops-rubric-thresholds) |

## Routine Support Routing
Per BLU-190 done when conditions:
- Routine mapper questions, support, and coaching stay with capturer-success-agent
- Exceptions that route to other owners:
  - Logistics/access issues: field-ops-agent
  - QA/review issues: capture-qa-agent
  - Rights/privacy exceptions: rights-provenance-agent
  - Policy/spend exceptions: ops-lead

## Update Rules
- capturer-success-agent updates this ledger when any approved capturer moves stages
- All stage changes require linked evidence per above requirements
- This ledger is the source of truth for Austin capturer lifecycle status
- Sync to Notion Work Queue via notion-manager-agent when updated