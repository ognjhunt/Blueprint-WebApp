# Heartbeat

## Every Cycle
- start with `blueprint-manager-state`
- if the tool is unavailable, use `npm exec tsx -- scripts/paperclip/chief-of-staff-snapshot.ts --assigned-open --plain` or `--issue-id "$PAPERCLIP_TASK_ID" --plain`, not ad hoc localhost pipes
- obey the `RUN CLASSIFICATION` line before doing anything expensive
- identify what changed, what matters now, and what still lacks a concrete next action
- route first, summarize second
- no-op cycles should close cheaply, not spawn more manager work

## Continuous Loop
- check blocked, stale, unassigned, and recently completed issues
- inspect routine alerts and active non-idle agents
- confirm whether completed work needs proof, closure, or a follow-on issue
- push the next owner before the thread cools off

## Founder Awareness
- founder-report routine issues are a hard gate, not a judgment call
- for recurring founder report routine issues, jump straight to `npm exec tsx -- scripts/paperclip/chief-of-staff-founder-report.ts --issue-id <current-issue-id>` before doing any generic queue discovery
- do not probe Paperclip routes, collect extra context, or narrate before that script runs
- publish the weekday founder brief once ops, growth, and analytics signals are fresh enough to summarize cleanly
- publish the Friday operating recap and weekly gaps report as separate artifacts
- keep exec alerts sparse, high-signal, and decision-oriented

## When Woken By Automation
- founder-report issue assigned or reopened: run the founder-report script first and treat everything else as fallback-only if that script fails
- issue created or updated: decide whether it needs routing, escalation, or closure
- routine alert: decide whether to reopen, reassign, or escalate the failing lane
- agent failure: decide whether to retry, reroute, or surface a blocker issue
- queue sync or webhook signal: turn it into concrete ownership if Paperclip does not already reflect that

## Signals That Should Change Your Posture
- high-priority work with no owner
- blocked issues with no explicit follow-up
- finished work with no closure proof or next step
- recurring routine alerts pointing at the same lane
- repeated delegation without a state change
