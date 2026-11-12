---
name: growth-experiment-engine
description: Run disciplined Blueprint growth experiments with explicit hypotheses, baselines, guardrails, ownership splits, and keep-or-revert decisions across growth-lead, conversion-agent, and analytics-agent.
---

# Growth Experiment Engine

Use this skill when Blueprint is planning, running, or evaluating a growth experiment on a measurable surface.

Primary users:

- `growth-lead`
- `conversion-agent`
- `analytics-agent`

## Goal

Turn growth ideas into bounded experiments with:

- one primary metric
- a clear baseline
- explicit guardrails
- a measurement window
- one owner for implementation
- one owner for evaluation

## Role Split

### `growth-lead`

- chooses the experiment focus
- scores priority using ICE
- confirms the primary metric and guardrails
- rejects experiments that drift from company doctrine or current stage

### `conversion-agent`

- proposes the change
- defines the variants
- names the implementation surface
- writes rollback steps
- implements only after the experiment is approved

### `analytics-agent`

- validates baseline availability
- checks sample size realism
- evaluates result quality
- issues the final `KEEP`, `REVERT`, `EXTEND`, or `INCONCLUSIVE` call

## Blueprint Metrics

Prefer these over vanity metrics:

- visitor -> signup
- signup -> request submitted
- request submitted -> qualified
- qualified -> proof-ready
- proof-ready -> purchase or active evaluation

Useful secondary metrics:

- bounce rate on buyer pages
- completion rate on request flows
- return visits from active buyers

## Guardrails

Every experiment must define at least three guardrails:

- a quality guardrail
  Example: qualified-request rate must not fall materially
- an operational guardrail
  Example: request-review queue depth must not spike beyond what ops can absorb
- a performance guardrail
  Example: page load time must not regress noticeably

If any guardrail breaks, default to `REVERT`.

## Experiment Contract

Every experiment must have:

- `Hypothesis`
- `Surface`
- `Primary metric`
- `Baseline window`
- `Measurement window`
- `Minimum evidence needed`
- `Guardrails`
- `Rollback plan`
- `Decision owner`

If any field is missing, do not run the experiment.

## Workflow

1. Read the current growth context and active priorities.
2. Choose one variable to test.
3. Reject experiments that change too many things at once.
4. Confirm that the metric is measurable with current instrumentation.
5. Write the experiment contract.
6. Implement and launch only after approval in the current phase.
7. Evaluate against baseline and guardrails.
8. Record the outcome and the learning, even when the answer is `REVERT`.

## Decision Rules

- `KEEP`: primary metric improves with enough evidence and no guardrail is violated
- `REVERT`: primary metric degrades, a guardrail fails, or the implementation introduced operational harm
- `EXTEND`: evidence is too thin but the test is still safe to keep running briefly
- `INCONCLUSIVE`: evidence never became decision-useful; revert and log the lesson

Do not pretend weak evidence is a win.

## Output Format

When planning:

- `Experiment`
- `Hypothesis`
- `Why now`
- `Baseline`
- `Guardrails`
- `Implementation scope`
- `Rollback plan`

When evaluating:

- `Decision`
- `Primary metric result`
- `Guardrail result`
- `Confidence`
- `What we learned`
- `Next action`

## Do Not

- run multiple unrelated changes in one test
- optimize for clicks while harming qualified demand
- use significance language if the evidence is obviously too thin
- run experiments on rights, privacy, checkout, or legal commitments without explicit approval
- keep a winning change if it distorts product truth
