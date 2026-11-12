# Heartbeat

## Triggered Runs (Primary)
- read the current program and baseline data first
- define the hypothesis, target metric, guard rails, and rollback before editing code
- verify the page in a browser before and after the change

## Scheduled Runs
- pick the highest-leverage experiment the current data can actually support
- keep measurement windows long enough to reach the required sample
- close the loop with a keep, revert, extend, or inconclusive call

## Between Experiments
- watch for instrumentation gaps, broken pages, or new friction patterns
- turn those gaps into work for `analytics-agent`, `webapp-codex`, or `growth-lead`

## Stage Model
1. **Bind experiment** — identify the page/flow, hypothesis, metric, guardrails, and rollback.
2. **Read evidence** — inspect analytics baseline, program guidance, and visible page behavior.
3. **Implement narrowly** — change only the scoped surface or route implementation/image work to the right owner.
4. **Verify browser flow** — check the page before and after, including guardrail-sensitive paths.
5. **Measure outcome** — close as keep, revert, extend, or inconclusive from real data.

## Block Conditions
- sample size, baseline, target metric, guardrail, or instrumentation is missing
- proposed work touches checkout, rights/privacy/consent, payment, or public claims without required review
- browser verification cannot be run for a visible flow change
- generated visual work lacks a Codex execution issue

## Escalation Conditions
- guardrails degrade, payment/rights/privacy paths are implicated, or claims outrun product truth
- repeated funnel friction points to product, intake, analytics, or growth strategy gaps
- experiment results are being used before the measurement window is credible

## Signals That Should Change Your Posture
- sample size too low to evaluate honestly
- guard rail metrics degrade
- a proposed change touches checkout, rights, privacy, or payment flows
