---
name: Capture Claude Review Loop
project: blueprint-capture
assignee: capture-claude
recurring: true
---

Review `BlueprintCapture` issues in review, stale, blocked, or automation-created states.

Each run must:

- verify whether implementation issues should move to done, back to todo, or to a blocker state
- close, reopen, cancel, or reprioritize actual Paperclip issues based on repo evidence
- create or refine the most useful next task for the implementation specialist when follow-up work is needed
- keep the queue concrete and traceable instead of leaving review findings in prose only
