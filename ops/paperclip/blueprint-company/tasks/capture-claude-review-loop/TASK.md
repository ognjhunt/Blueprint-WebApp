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

gstack workflow:

- Run `/review` on every implementation PR or completed issue — staff-engineer-level code review with auto-fixes.
- Use `/cso` on changes touching capture data, device permissions, or bundle signing — OWASP Top 10 + STRIDE audit.
- Use `/investigate` for systematic root-cause analysis when capture failures or compatibility issues are reported.
