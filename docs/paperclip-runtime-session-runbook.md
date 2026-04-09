# Paperclip Runtime Session Runbook

Date: 2026-04-09

## Purpose

Use this runbook to inspect or reason about Blueprint runtime sessions after the runtime hardening rollout.

## What A Session Is

A runtime session is the execution record for one meaningful run under a Paperclip issue or routine.

Paperclip issues still own:

- assignment
- routing
- human review
- closure status

Runtime sessions now own:

- run lifecycle
- trace events
- checkpoints
- linked proof artifacts
- environment profile and version pin metadata

## Primary Inspection Path

Use the plugin tool:

- `blueprint-runtime-session-status`

Recommended inputs:

- `issueId` when you know the work item
- `sessionId` when a trace or log already references a session

The tool returns:

- current session status
- agent key
- version and channel pin
- environment profile
- recent trace events
- linked runtime subagents

## Manual Checkpointing

Use:

- `blueprint-runtime-session-checkpoint`

This captures a lightweight workflow checkpoint without waiting for the whole issue to finish.

Use it when:

- a long run needs a stable audit point
- a manager wants a before/after snapshot around a reroute
- a complex session is about to hand off or resume later

## What To Expect In Trace

Normal trace events include:

- session start and status changes
- routine dispatch wakeups
- agent comment turns
- handoff creation and completion
- memory writes
- artifact link capture
- explicit checkpoints

## Current Limits

The runtime trace uses existing Paperclip/plugin events.

That means:

- issue and activity events are strong
- run failures are strong
- fine-grained built-in tool execution is only traced where the plugin has visibility

This is still materially better than relying only on issue comments and Slack mirrors.
