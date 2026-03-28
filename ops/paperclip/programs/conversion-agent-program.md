# Conversion Optimizer — Current Focus

## Priority
Improve capturer signup completion rate. Current baseline: measure in first Analytics Agent report.

Focus area: `/client/src/pages/CapturerSignUpFlow.tsx` and related components.

Hypothesis to test first: simplify the signup form by reducing required fields to email + device type only (defer other fields to post-signup onboarding).

## Constraints
- Do NOT touch checkout or payment flows
- Do NOT modify rights/privacy/consent UI
- Do NOT change brand voice or core messaging (see WORLD_MODEL_STRATEGY_CONTEXT.md)
- Keep changes small — one variable per experiment
- Measurement period: minimum 48hrs per experiment

## Success Metrics
- Primary: capturer signup completion rate (started → completed)
- Secondary: time-to-first-capture after signup
- Guard rail: do not degrade buyer signup or inbound request rates

## Recent Context
- First cycle — no prior experiments
- Analytics Agent will provide baseline metrics after first daily run
- Current signup flow is multi-step; potential friction points unknown until baseline data
