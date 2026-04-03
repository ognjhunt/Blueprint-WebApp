# Paperclip Agent Run Failure Runbook

Use this runbook when a Blueprint Paperclip alert says an agent run failed, especially when the failure came from a local Codex or Claude lane while working an active issue.

This is a short operator recovery guide. It is not the full launch checklist and it is not a generic outage procedure.

## What This Runbook Covers

- failed Paperclip agent runs tied to a specific issue
- the default retry, reroute, or blocker decision
- the special case where the model ran out of context window
- what evidence to capture before retrying

## 1. Confirm The Failure Type

Open the alert and check:

- failed agent
- issue ID
- exact error text

If the error says the model ran out of room in the context window, or tells you to start a new thread or clear earlier history, treat it as a thread-size failure rather than a provider outage.

## 2. Check For Partial Progress

Before retrying, inspect the issue and repo state for:

- commits or local diffs already produced
- comments or handoff notes from the failed run
- validation evidence already attached

Do not throw away partial work just because the thread overflowed.

## 3. Default Response

For any `agent.run.failed` alert, the default decision is:

1. retry once if the failure looks bounded
2. reroute if a different lane or human owner can take it cleanly
3. surface or update a blocker issue if neither of the above is safe

This matches the chief-of-staff automation posture in `ops/paperclip/blueprint-company/agents/blueprint-chief-of-staff/Heartbeat.md`.

## 4. Context Window Failure Playbook

When the run failed because the model ran out of context window:

1. do not keep replying in the old thread
2. start a fresh thread for the same issue
3. provide a compressed handoff that includes:
   - issue ID
   - current objective
   - completed work
   - changed files, branch, or commit SHA if any
   - exact next step
4. retry once in that fresh thread
5. if it fails again, split the work into a smaller task or reroute it

Do not use a bloated thread as the primary recovery path.

## 5. When To Mark It Blocked

Mark the issue blocked when:

- repeated fresh-thread retries still fail
- the next step cannot be compressed into a smaller bounded handoff
- the problem depends on missing product, repo, or runtime truth

If the work is still real but the current assignee cannot move it, reroute before blocking.

## 6. Evidence To Attach

Capture these in the issue or follow-up comment:

- failed run ID
- exact error text
- whether partial code or proof exists
- whether a fresh-thread retry was attempted
- who owns the next move

## Notes

- Context-window failures usually indicate thread hygiene problems, not a broken product surface.
- Repeated failures on the same issue should push the work toward smaller handoffs, not larger prompts.
