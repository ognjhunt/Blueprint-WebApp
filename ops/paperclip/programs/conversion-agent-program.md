# Conversion Optimizer — Current Focus

## Priority
Unblock trustworthy funnel measurement before running experiments, then correct buyer-entry defaults that currently lean too hard on qualification-first framing.

## Current Cycle: Baseline Measurement (not experimentation)
The first cycle is a measurement cycle, not an experiment cycle:
1. Confirm step-level and outcome-level analytics coverage is live on the capturer signup flow (`/client/src/pages/CapturerSignUpFlow.tsx`).
2. Confirm start, submit, success, and failure events are live on the buyer signup and contact request flows (`/client/src/pages/BusinessSignUpFlow.tsx`, `/client/src/components/site/ContactForm.tsx`).
3. Validate PostHog and GA event naming, property shape, and no-PII discipline against the current analytics contract in `/client/src/lib/analytics.ts`.
4. Establish current completion rate per step and per entry lane only after the above events are live.
5. Audit whether buyer-entry defaults are pushing a qualification-first story instead of an exact-site world-model story.
6. Only then propose the first experiment.

## Hypothesis Queue (deferred until baseline data available)
1. Simplify signup form — email + device type only, defer other fields to post-signup onboarding
2. Add progress indicator to multi-step flow
3. Reduce required fields per step

Focus area: `/client/src/pages/CapturerSignUpFlow.tsx` and related components.

## Constraints
- Do NOT touch checkout or payment flows
- Do NOT modify rights/privacy/consent UI
- Do NOT change brand voice or core messaging (see WORLD_MODEL_STRATEGY_CONTEXT.md)
- Keep changes small — one variable per experiment
- Measurement period: minimum 48hrs per experiment, minimum 100 sessions per variant

## Statistical Requirements
- **Minimum sample size:** 100 sessions per variant (control + treatment) before evaluation
- **Significance threshold:** Two-proportion z-test, p < 0.05 (95% confidence)
- **Effect size minimum:** Relative improvement >= 10% in primary metric to implement
- **Maximum measurement period:** 7 days — if not significant after 7 days, declare inconclusive and revert
- **Guard rail metrics:** Buyer signup rate (must not decrease >5%), inbound request rate (must not decrease >5%), page load time (must not increase >500ms)
- **Evaluation protocol:**
  1. Wait for minimum sample size (100 sessions per variant)
  2. Run two-proportion z-test on primary metric
  3. Check guard rail metrics
  4. Decision: KEEP (significant + no guard rail violations), REVERT (guard rail violated OR significant degradation), EXTEND (not yet significant, <7 days), INCONCLUSIVE (not significant after 7 days → revert)

## Success Metrics
- Primary: capturer signup completion rate (started → completed)
- Secondary: time-to-first-capture after signup
- Guard rail: do not degrade buyer signup or inbound request rates

## Recent Context
- First cycle — no prior experiments
- Analytics Daily first run completed 2026-03-29 (BLU-38) — operational health focus, not funnel metrics yet
- PostHog deployed 2026-03-27; funnel data still accumulating
- Current signup flow is multi-step; friction points unknown until baseline data
- As of 2026-04-08, the repo analytics layer emits the capturer signup, buyer signup, and contact request events this program depends on, and the associated analytics contract tests pass in the current worktree.
- As of 2026-04-08, buyer-entry defaults still need a final audit for any remaining qualification-first framing in key surfaces, but the current blocker is live production data accumulation rather than missing event plumbing.
