# Sacramento Intake Rubric, Trust Kit, and First-Capture Thresholds

## Scope
This playbook defines the Sacramento-specific operating packet for Intake, Field Ops, QA, and Rights.

It inherits the shared rules from:
- `ops/paperclip/playbooks/capturer-trust-packet-stage-gate-standard.md`
- `ops/paperclip/playbooks/field-ops-first-assignment-site-facing-trust-gate.md`
- `ops/paperclip/playbooks/city-launch-sacramento-ca.md`
- `ops/paperclip/HANDOFF_PROTOCOL.md`

Use this packet when a Sacramento contributor, applicant, or first-capture path needs a clear approval posture without dragging founder review into routine work.

## Truth Guardrails
- Approval means operational readiness, not a promise of work volume, payout, or repeat access.
- A completed trust packet does not imply site permission, operator clearance, legal clearance, or privacy clearance.
- If the lane depends on compensation, rights, privacy, access terms, or legal interpretation, stop and escalate instead of standardizing the answer.
- When a check is genuinely lane-dependent, record `not_required` instead of pretending the check passed.
- Do not collapse source truth, review truth, and assignment truth into one vague "scheduled" or "approved" note.

## Sacramento Intake Stages

### 1. `sourced`
Use when Blueprint has identified a Sacramento prospect, but there is no usable live application yet.

Required evidence:
- source channel or cohort
- city or market framing when known

Exit criteria:
- the person submits through the approved intake path
- or the prospect is closed out as off-lane

### 2. `applied`
Use when a live application or inbound record exists and intake has enough raw facts to start review.

Required evidence:
- reachable contact path
- capturer intent or clear participation intent
- market or operating area when available
- device claim when available

Exit criteria:
- request the trust packet if the prospect is plausibly in-scope
- block or close if the record is clearly unusable

### 3. `trust_packet_requested`
Use when intake has asked for the minimum evidence set needed to evaluate Sacramento readiness.

Required evidence:
- named reviewer owner
- missing evidence list
- due-next action for the applicant

Exit criteria:
- trust packet materials arrive and can be reviewed
- or the record stalls and needs follow-up or closure

### 4. `trust_packet_verified`
Use only when the required checks have explicit outcomes recorded.

Required evidence:
- identity outcome
- duplicate or integrity outcome
- policy, privacy, and rights acknowledgement outcome
- location or device validation outcome, or `not_required`
- authorization outcome, or `not_required`

Exit criteria:
- move to `approved` if all required checks are acceptable
- move to `blocked` if any approval-critical check is unresolved
- escalate edge cases instead of forcing approval

### 5. `approved`
Use when the contributor is eligible for Sacramento cohort participation and can be onboarded into real capture work under current policy.

Required evidence:
- approval timestamp
- approval owner
- any restrictions on allowed lanes, cities, or device classes

Exit criteria:
- contributor receives onboarding and operating expectations

### 6. `onboarded`
Use when the contributor has received the current operating brief and knows what Blueprint does and does not authorize.

Required evidence:
- onboarding completed
- current policy and rights framing delivered
- allowed next action is explicit

Exit criteria:
- first capture is assigned or submitted through the approved path

### 7. `first_capture_assigned`
Use when Sacramento has a truthful first assignment and the capturer has enough context to show up or submit without improvising permission claims.

Required evidence:
- job reference or assignment reference
- named Blueprint contact path
- current site posture

Exit criteria:
- the capturer submits the first capture or the job is re-routed

### 8. `first_capture_submitted`
Use when the contributor has delivered a first real capture for review.

Required evidence:
- linked capture submission or job reference
- submission timestamp

Exit criteria:
- capture QA returns a pass or fail outcome

### 9. `first_capture_passed`
Use when capture QA confirms the first submitted capture met the required quality bar.

Required evidence:
- capture QA pass result
- any notes about restrictions, coaching, or follow-up requirements

Exit criteria:
- contributor can be considered for repeat participation and referral eligibility under current program rules

### 10. `repeat_ready`
Use when the contributor has passed the first-capture gate and can re-enter work without redoing first-time approval logic.

Required evidence:
- first passed capture is recorded
- any contributor tier or lane restriction is current

Exit criteria:
- contributor participates in repeat work
- referral eligibility can be considered if the current program rules allow it

## Sacramento Intake Rubric

### Source Quality
Accept a Sacramento prospect only when the source is named and traceable enough to route real work.

Check:
- the source channel is one of the approved Sacramento channels or a named referral path
- the source bucket is explicit in the record
- the record does not invent provenance or overstate reach

### Access-Path Truth
Accept a Sacramento prospect only when the access path is honest about what is actually known.

Check:
- private controlled interiors are not being treated like public walk-ins
- site permission is not implied unless the record actually says it is granted
- any operator-facing boundary, escort rule, or restriction remains visible

### Equipment And Device Fit
Accept a Sacramento prospect only when the device and gear claim fit the lane.

Check:
- the device class is sufficient for the intended capture mode
- storage, battery, and accessory fit are known before approval
- any lane-specific device limit is explicit in the record

### Trust-Packet Minimums
Accept a Sacramento prospect only when the minimum packet is complete enough to trust the next routing step.

Check:
- identity and contact are stable
- market or operating area is specific enough to route
- duplicate and integrity review is not open
- policy, privacy, and rights framing has been acknowledged

### Approval Outcomes
Use one of these outcomes and keep the reason visible:
- `approved`: all required checks passed and the contributor can move forward
- `approved_with_restrictions`: the contributor is usable, but the record must list the lane or city limits
- `request_more_evidence`: the prospect is plausible, but the packet is incomplete
- `blocked`: a required approval-critical check is unresolved
- `escalate`: a human-only decision is needed for compensation, rights, privacy, access, or public-claim ambiguity

## Trust Kit Checklist

### Identity And Contact
- stable real-world identity appropriate to the workflow
- reachable contact path that matches the operating record
- market or city specificity good enough to route real work
- cohort or referral source when the applicant came through a trusted path

### Market, Device, And Lane Fit
- claimed operating market or travel pattern
- claimed device and capability
- lane-specific device sensitivity noted in the record
- `not_required` when device validation is unnecessary for the lane

### Authorization And Field-Facing Trust
- whether the planned work needs operator-facing authorization proof or only an internal field-ready explanation
- any artifact required before first assignment
- what the capturer may and may not say on site
- escalation note for any workflow that could imply ungranted permission or legal clearance

### Duplicate And Integrity Review
- duplicate application check
- duplicate referral or alias check when relevant
- suspicious portfolio or sample reuse check when the workflow depends on prior evidence
- explicit result: `pass`, `needs_review`, or `blocked`

### Policy, Privacy, And Rights Acknowledgement
- confirmation that the capturer received current capture-policy framing
- confirmation that the capturer understands rights, privacy, and site-access constraints may limit work
- confirmation that no misleading earnings, incentive, or work-volume claim was used to onboard them

### Reviewer Decision
- current stage
- reviewer owner
- next action
- blocker or escalation note if the applicant cannot advance

## First-Capture Thresholds
Use these thresholds as the Sacramento minimum progression rules:

- Access threshold: first lawful access path required before private controlled capture dispatch
- Supply threshold: first approved capturer required before first assignment
- Supply threshold: first completed capture required before QA claims
- Supply threshold: first QA-passed capture required before proof-pack assembly
- Proof threshold: first rights-cleared proof asset required before buyer-visible proof
- Proof threshold: first proof-pack delivery required before hosted-review conversion analysis
- Demand threshold: first hosted review started required before widening
- Commercial threshold: first human commercial handoff required before broader commercial playbook claims

## Field-Facing Trust Boundary
When a Sacramento first assignment needs a site-facing explanation, the capturer may say only:
- "I’m here for a scheduled Blueprint capture."
- "If you need confirmation or have site questions, I can connect you with the Blueprint contact on this job."

The capturer may not say:
- Blueprint already has permission for everything
- the site approved them
- they can answer privacy, rights, or access-policy questions

## Escalation Rules
Escalate instead of standardizing the problem if any of the following are true:
- the site is likely to question the visit and there is no verified Blueprint contact path
- the record would force the capturer to negotiate access terms
- compensation, rights, privacy, legal interpretation, or commercialization judgment is being requested
- the site uses escort rules, badge rules, restricted zones, or filming limits that the capturer would have to interpret

## Recordkeeping
- Keep the intake record, the assignment record, and the access truth separable.
- Use linked Paperclip issues for evidence notes, reviewer rationale, and escalation history.
- Keep `waitlistSubmissions`, `capture_jobs`, and the Paperclip issue aligned with the actual review posture.
- Use `not_required` when a lane does not need a check rather than inventing a pass.

## Handoffs
- Route site-facing authorization questions or first-assignment artifact rules to `field-ops-agent`.
- Route first-capture pass and referral-unlock logic to `capture-qa-agent`.
- Route schema or admin-surface implementation work to the owning implementation issue rather than ad hoc notes.
- Escalate any rights, privacy, legal, compensation, or public-claim ambiguity to `ops-lead`.
