# Capturer Supply Playbook

Status: internal operating proposal only. Do not treat this as approved public-facing execution.

## Objective

Turn adjacent-market supply evidence into a reusable Blueprint capturer acquisition system that optimizes for approved and activated capturers, not raw signup volume.

This playbook is grounded in:

- [BLU-96](/BLU/issues/BLU-96) for verified adjacent-market supply patterns
- [BLU-97](/BLU/issues/BLU-97) for bounded acquisition-test design
- `ops/paperclip/programs/capturer-growth-agent-program.md` for current-cycle focus

## Operating Rules

- Keep Blueprint capture-first and world-model-product-first.
- Use truthful language about approval, work uncertainty, site sensitivity, and quality expectations.
- Do not imply guaranteed earnings, guaranteed work volume, or preferential approval.
- Do not open broad acquisition channels until trust gates and ops capacity are clear.
- Keep city-specific rollout choices with `city-launch-agent`; keep this document generic.

## Channel Matrix

| Channel | Role in system | Current posture | Why | Dependencies |
| --- | --- | --- | --- | --- |
| Handpicked first-cohort invite | Seed initial high-signal capturer pool | Ready for internal design | Highest-confidence path to quality and feedback | Intake screening, ops review, QA tracking |
| Warm outreach to adjacent contractors | Expand first-cohort candidate pool in one city | Ready for internal sourcing design | Matches early Blueprint need better than mass-market blasting | Truthful invite copy, intake fields, manual review capacity |
| Post-activation referrals | Add supply only after capturers see real utility and expectations | Ready after first activated cohort exists | Referral quality should improve once contributors understand the work | Activated capturers, referral provenance tracking |
| Broad public waitlist growth | Increase top-of-funnel volume | Not ready | Risks vanity signups and unrealistic expectations | Baseline approval/activation funnel, stronger ops capacity |
| Paid acquisition for raw signup volume | Drive scale quickly | Not ready | Evidence does not support top-funnel-first for trusted site capture | Human review, measurement, proven funnel economics |
| Open public postings implying immediate work | Maximize reach | Not ready | Highest risk of misleading applicants about work availability | Human approval, policy review, stable fulfillment capacity |

## Messaging Hierarchy

1. Real-site capture and quality matter more than fast approval.
2. Approval is selective and based on fit, trust, and operational readiness.
3. Early work should be framed as scoped, reviewed, and quality-gated.
4. Expanded access comes after successful completed work, not before.
5. Referral is a credibility layer after activation, not a top-of-funnel gimmick.

## Trust Ladder

### 1. Entry Gate

- Identity, device, and adjacent-experience checks before approval.
- Truthful invite language about uncertainty and quality expectations.
- No promises about earnings, assignment frequency, or fast-track status.

### 2. Activation Gate

- Newly approved capturers start with low-risk, tightly scoped work.
- Success is first capture completion plus acceptable QA outcome.
- Only activated capturers move into repeat-work or referral consideration.

### 3. Expanded Access Gate

- More sensitive or higher-value work unlocks after repeated successful completions.
- Reverification, short training, or additional documentation belongs here, not at initial signup.

### 4. Ambassador / Referral Gate

- Only top-performing activated capturers should be considered for peer referral or visible cohort roles.
- Ambassador behavior is earned through quality history, not granted at signup.

## Reusable Test System

### Test 1: First-Cohort Invite

- Channel: approved waitlist leads, warm referrals, and known adjacent contractors in one launch city
- Sequence:
  - shortlist candidates with walkthrough, field-ops, or site-documentation adjacency
  - invite with truthful language about approval, work uncertainty, and quality expectations
  - approve only after entry-gate checks
  - measure first capture completion, QA outcome, and top-performer emergence
- Success criteria:
  - approved-to-activated rate beats the general waitlist baseline
  - first-capture QA pass rate stays above broader applicant average
  - ops handles the cohort without response-time degradation

### Test 2: Staged Access Unlock

- Channel: post-approval onboarding and assignment routing
- Sequence:
  - route newly approved capturers into low-risk early assignments
  - measure completion and QA outcomes
  - unlock more sensitive work only after repeated successful completions
  - require reverification or short training only at the unlock step
- Success criteria:
  - lower early QA failure than flat-access routing
  - acceptable drop-off between approval and first successful capture
  - clear enough rules for intake and ops to apply consistently

### Test 3: Post-Activation Referral

- Channel: referral ask to already activated capturers
- Sequence:
  - wait until a capturer clears activation gates
  - ask a narrow referral question with no guarantee language
  - route referred applicants through the same entry gate as everyone else
  - compare referred applicants against non-referral applicants on approval and activation quality
- Success criteria:
  - referral applicants approve at a higher rate than cold applicants
  - referral applicants activate faster or pass QA more consistently
  - the process does not create unrealistic expectations

## Measurement Requirements

- Source tracking: first-cohort shortlist, adjacent outreach, referral provenance
- Funnel stages: invited, applied, approved, activated, repeat-success, expanded-access eligible
- Quality signals: first-capture QA outcome, repeat QA outcome, ops exceptions
- Time-to-stage: invite to application, application to approval, approval to first successful capture

## Readiness Call

Ready now:

- internal first-cohort design
- internal adjacent-contractor sourcing design
- internal referral-system design for post-activation use

Blocked or not ready:

- public rollout approval
- paid acquisition experiments
- mass-market waitlist expansion as a primary growth lever
- ops-heavy scaling before first-cohort quality is proven

## Downstream Queue

- `conversion-agent`: draft internal-only first-cohort invite copy and post-activation referral ask variants
- `analytics-agent`: define event schema and reporting for trust-stage and referral measurement
- `intake-agent`: propose waitlist fields for source, adjacent experience, trust stage, and referral provenance
- `ops-lead`: confirm whether manual review capacity can support a handpicked cohort without backlog growth
- `city-launch-agent`: localize this generic system into city-specific corridor and sequencing choices

## Current Constraints

As of 2026-03-30, `conversion-agent` is available, but `analytics-agent`, `intake-agent`, `ops-lead`, and `growth-lead` are in `error` state in Paperclip. Treat the downstream queue as issue-ready work, not active execution, until those lanes recover or a human re-routes ownership.
