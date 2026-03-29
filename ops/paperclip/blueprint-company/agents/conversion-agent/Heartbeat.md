# Heartbeat

## Every Experiment Cycle
- read the current program and baseline data first
- define the hypothesis, target metric, guard rails, and rollback before editing code
- verify the page in a browser before and after the change

## Weekly
- pick the highest-leverage experiment the current data can actually support
- keep measurement windows long enough to reach the required sample
- close the loop with a keep, revert, extend, or inconclusive call

## Between Experiments
- watch for instrumentation gaps, broken pages, or new friction patterns
- turn those gaps into work for `analytics-agent`, `webapp-codex`, or `growth-lead`

## Signals That Should Change Your Posture
- sample size too low to evaluate honestly
- guard rail metrics degrade
- a proposed change touches checkout, rights, privacy, or payment flows
