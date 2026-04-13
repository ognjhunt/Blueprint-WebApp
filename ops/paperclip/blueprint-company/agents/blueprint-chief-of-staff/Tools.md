# Tools

## Primary Sources
- `blueprint-manager-state`
  Start here every run. It gives the current chief-of-staff snapshot across issues, routine health, active agents, and recent automation events.
- `npm exec tsx -- scripts/paperclip/chief-of-staff-snapshot.ts`
  Hermes-safe fallback when tool surfaces are unavailable or unreliable.
  Safe fetch/check forms:
  - `npm exec tsx -- scripts/paperclip/chief-of-staff-snapshot.ts --assigned-open --plain`
  - `npm exec tsx -- scripts/paperclip/chief-of-staff-snapshot.ts --issue-id "$PAPERCLIP_TASK_ID" --plain`
  - `npm exec tsx -- scripts/paperclip/chief-of-staff-snapshot.ts --open --limit 25 --plain`
  Do not replace these with `curl | python` or any other pipe-to-interpreter localhost probe.
- `blueprint-scan-work`
  Use this only when the run is actionable or the queue is stale enough that a scan will change ownership, proof, or closure state.
- `blueprint-upsert-work-item`, `blueprint-report-blocker`, `blueprint-dispatch-human-blocker`, `blueprint-resolve-work-item`
  Use these to keep work state accurate without creating duplicate automation records.
- `blueprint-dispatch-human-blocker`
  Use this when a true human gate should become a standard blocker packet. Queue chief-of-staff review when another lane needs send approval; use the same tool again to send the reviewed packet.
- `notion-upsert-knowledge`
  Use this for founder-facing recurring artifacts such as the weekday brief, Friday recap, and weekly gaps report.
- `npm exec tsx -- scripts/paperclip/chief-of-staff-founder-report.ts --issue-id <current-issue-id>`
  Hermes-safe fallback for founder report routines when direct Notion or Slack tool access is not available. It infers the routine kind from the issue title and can publish the Notion artifact plus the founder Slack digest when a direct exec webhook is configured.
  Use this first, not after exploration, for the recurring founder report issues.
- `npm exec tsx -- scripts/paperclip/chief-of-staff-issue-router.ts --issue-id <current-issue-id> --apply`
  Hermes-safe deterministic fallback for non-founder routing when the next owner is obvious from issue title and project context.
- `slack-post-digest`
  Use this for the founder-facing exec digest after the underlying state is real.
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/AUTONOMOUS_ORG.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/programs/founder-decision-packet-standard.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/BLUEPRINT_AUTOMATION.md`

## Trust Model
- live issue state beats memory
- routine alerts and recent events are signals, not conclusions
- Slack is for visibility; Paperclip is the work record
- founder-facing digests summarize state; they do not replace it
- founder-facing `Needs Founder` items are decisions to package, not status to dump
- raw shell access is a fallback, not the primary interface for Paperclip state

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
