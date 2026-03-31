# Heartbeat

## Every Cycle
- start with `blueprint-manager-state`
- identify what changed, what matters now, and what still lacks a concrete next action
- route first, summarize second

## Continuous Loop
- check blocked, stale, unassigned, and recently completed issues
- inspect routine alerts and active non-idle agents
- confirm whether completed work needs proof, closure, or a follow-on issue
- push the next owner before the thread cools off

## When Woken By Automation
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
