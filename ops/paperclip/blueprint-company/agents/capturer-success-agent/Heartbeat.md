# Heartbeat

## Scheduled Runs
- `0 9 * * 1-5` — Morning capturer health check (weekdays 9am ET). Review new approvals, pending first captures, recapture needs, and inactive capturers.
- `0 14 * * 1-5` — Afternoon follow-up (weekdays 2pm ET). Check for completed uploads, QA results, and capturers needing outreach.

## Triggered Runs (Primary)
- **New capturer approved:** Intake-agent approves a capturer application. Begin activation sequence.
- **First capture uploaded:** A capturer's first upload lands. Monitor QA outcome closely.
- **Capture QA result (FAIL/BORDERLINE):** A capturer's capture was flagged. Prepare specific recapture guidance.
- **Capturer inactive >7 days:** An active capturer has not uploaded in a week. Assess and decide on outreach.

## Stage Model
1. Review all capturers in active pipeline stages (approved → activating → first capture → active → at risk).
2. For each stage, apply the appropriate playbook (see below).
3. Update capturer status in Paperclip and Firestore as stages change.
4. If systemic patterns emerge (many capturers failing at the same step), escalate to ops-lead as a platform issue.

## Block Conditions
- capturer account, app state, QA output, or lifecycle record cannot be inspected
- the next action requires field logistics, payout approval, app engineering, rights/privacy review, or policy judgment
- recapture guidance cannot be specific from the QA evidence

## Escalation Conditions
- multiple capturers fail at the same onboarding, device, upload, or QA step
- a high-value capturer becomes inactive or blocked
- supply capacity or quality is materially slipping enough for founder/ops visibility

## Capturer Lifecycle Stages
1. **Approved** — Application accepted, onboarding materials sent. Clock starts.
2. **Activating** — Capturer has app installed, account created. Waiting for first capture attempt.
3. **First capture attempted** — Upload received. Awaiting QA.
4. **First capture passed** — Capturer is now active. Monitor for second capture within 14 days.
5. **Active** — Capturer has completed 2+ captures. Monitor for quality trends and activity gaps.
6. **At risk** — Capturer inactive >14 days or recent QA failures. Intervention needed.
7. **Churned** — Capturer inactive >30 days with no response to outreach. Document and close.

## Playbooks by Stage

**Approved → Activating (target: <3 days)**
- Send device-specific setup guide (iOS vs Android vs glasses).
- Confirm app install and account creation.
- If no activity in 48 hours: check for blockers (device incompatibility, app crashes, confusion).

**Activating → First Capture (target: <7 days)**
- Suggest a nearby, low-complexity site for practice.
- If struggling: offer a walkthrough of the capture flow (step-by-step).
- If device issues: route to capture-codex/capture-review for technical support.

**First Capture QA Failure**
- Translate QA feedback into specific, actionable recapture instructions.
- Focus on the top 1-2 issues (not a wall of feedback).
- Offer to review their next attempt quickly.

**Active → At Risk**
- Check last capture date and recent QA scores.
- If quality declining: specific technique feedback.
- If inactive: gentle check-in. Ask if there are blockers.
- If no response after 2 attempts: reduce investment, mark at risk.

## Signals That Should Change Your Posture
- Cluster of new capturers all failing at the same step (platform bug or UX issue)
- A top capturer suddenly going inactive (personal issue or platform frustration)
- QA consistently rejecting captures from a specific device type
- Capturer reporting site access issues repeatedly (field-ops coordination needed)
- a supply-side issue is severe enough that the founder should see it in the exec visibility layer
