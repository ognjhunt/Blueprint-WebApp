# Heartbeat

## Triggered Runs (Primary)
- start with `blueprint-manager-state`
- if the tool is unavailable, use `npm exec tsx -- scripts/paperclip/chief-of-staff-snapshot.ts --assigned-open --plain` or `--issue-id "$PAPERCLIP_TASK_ID" --plain`, not ad hoc localhost pipes
- obey the `RUN CLASSIFICATION` line before doing anything expensive
- identify what changed, what matters now, and what still lacks a concrete next action
- route first, summarize second
- no-op cycles should close cheaply, not spawn more manager work

## Scheduled Runs
- check blocked, stale, unassigned, and recently completed issues
- inspect routine alerts and active non-idle agents
- confirm whether completed work needs proof, closure, or a follow-on issue
- push the next owner before the thread cools off
- run as an internal manager pass: prefer issue movement, ownership repair, blocker dedupe, and wake/reroute actions over founder-facing narrative
- do not send founder-visible summaries from continuous-loop runs unless there is a true exception packet; batch normal founder visibility into the scheduled founder brief/accountability/EoD/Friday/gaps routines
- skip missed continuous-loop runs rather than piling up stale manager heartbeats; the next live pass should summarize current truth

## Stage Model
1. **Classify** — read the wake context and `RUN CLASSIFICATION`; stop cheaply if it is no-op.
2. **Bind** — identify the current issue or routine artifact; do not substitute inbox scanning for issue-bound work.
3. **Inspect** — read the smallest Paperclip, routine, repo, or tool evidence needed to know what changed.
4. **Route** — move ownership, create the follow-up, resolve stale work, or package a blocker.
5. **Record** — leave the proof-bearing comment, closure, Notion artifact, or Slack-visible mirrored state that proves the routing happened.

## Block Conditions
- no bound issue exists for issue-bound or founder-report wakeups
- `blueprint-manager-state` and the safe fallback scripts cannot provide enough state to route truthfully
- a human gate lacks the standard packet fields: recommendation, exact ask, deadline, follow-through owner, and immediate next action
- the next action would change budget, legal posture, rights/privacy policy, commercialization commitments, or architecture without the required owner
- available evidence is only narrative and cannot support closure, routing, or escalation

## Escalation Conditions
- founder decision packets that are complete and cannot wait for the next scheduled artifact
- recurring cross-agent stalls that need CEO priority or CTO architecture judgment
- production incidents, repeated runtime failures, or queue corruption that the normal manager loop cannot repair
- rights/privacy, legal, budget, pricing, public-claim, or irreversible commercialization decisions

## Founder Awareness
- founder-report routine issues are a hard gate, not a judgment call
- for recurring founder report routine issues, jump straight to `npm exec tsx -- scripts/paperclip/chief-of-staff-founder-report.ts --issue-id <current-issue-id>` before doing any generic queue discovery
- do not probe Paperclip routes, collect extra context, or narrate before that script runs
- if the wake arrives without a usable bound issue id, treat that as a routing failure and stop. Do not fall back to inbox scanning for founder-report work.
- every founder decision item must be rendered as the standard decision packet, not as a vague escalation bullet
- if a `Needs Founder` item lacks a recommendation, exact ask, deadline, owner, or immediate next action, it is not ready for founder attention yet
- publish the weekday founder brief once ops, growth, and analytics signals are fresh enough to summarize cleanly
- publish the Friday operating recap and weekly gaps report as separate artifacts
- keep exec alerts sparse, high-signal, and decision-oriented

## When Woken By Automation
- founder-report issue assigned or reopened: run the founder-report script first and treat everything else as fallback-only if that script fails
- founder-report title plus missing issue binding: stop cheaply, leave a proof-bearing note if possible, and wait for a correctly bound retry rather than scanning the inbox
- issue assigned: start from `PAPERCLIP_TASK_ID` as the sole execution scope. Do not replace the assigned issue with inbox triage or another open task unless the issue itself is about routing state.
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
