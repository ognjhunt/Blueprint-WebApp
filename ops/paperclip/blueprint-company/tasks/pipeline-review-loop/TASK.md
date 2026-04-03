---
name: Pipeline Review Loop
project: blueprint-capture-pipeline
assignee: pipeline-review
recurring: true
---

Review `BlueprintCapturePipeline` issues in review, stale, blocked, or automation-created states.

Each run must:

- verify whether implementation issues should move to done, back to todo, or to a blocker state
- close, reopen, cancel, or reprioritize actual Paperclip issues based on repo evidence
- create or refine the most useful next task for the implementation specialist when follow-up work is needed
- keep the queue concrete and traceable instead of leaving review findings in prose only
- end with `blueprint-resolve-work-item` using the current `issueId` and a proof-bearing closeout comment when review is complete

gstack workflow:

- Run `/review` on every implementation PR or completed issue — staff-engineer-level code review with auto-fixes.
- Use `/cso` on changes touching model-provider auth, API keys, data flow, or service boundaries — OWASP Top 10 + STRIDE audit.
- Use `/investigate` for systematic root-cause analysis when pipeline failures or data issues are reported.
