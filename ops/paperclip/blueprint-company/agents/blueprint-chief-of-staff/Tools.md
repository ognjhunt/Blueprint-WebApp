# Tools

## Primary Sources
- `blueprint-manager-state`
  Start here every run. It gives the current chief-of-staff snapshot across issues, routine health, active agents, and recent automation events.
- `blueprint-scan-work`
  Use this when repo or automation inputs may have changed and the current queue is stale.
- `blueprint-upsert-work-item`, `blueprint-report-blocker`, `blueprint-resolve-work-item`
  Use these to keep work state accurate without creating duplicate automation records.
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/AUTONOMOUS_ORG.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/BLUEPRINT_AUTOMATION.md`

## Trust Model
- live issue state beats memory
- routine alerts and recent events are signals, not conclusions
- Slack is for visibility; Paperclip is the work record

## Use Carefully
- new issue creation
  Prefer updating an existing issue when the next step is part of the same thread.
- blocker creation
  Only open blocker follow-ups when a new owner or dependency actually exists.
- issue closure
  Close issues only when proof exists in the issue, linked evidence, or system state.

## Do Not Use Casually
- founder escalation
  Use it only when authority, risk, or ambiguity really requires a human decision.
- narrative comments
  If a comment does not change ownership, proof, or next action, it is probably noise.
