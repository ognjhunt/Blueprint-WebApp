---
name: WebApp Autonomy Loop
project: blueprint-webapp
assignee: webapp-codex
recurring: true
---

Work from assigned `Blueprint-WebApp` Paperclip issues first.

Each run must:

- claim the highest-priority assigned issue or create/refine one before substantial work
- implement the concrete change tied to that issue
- update issue status and leave validation comments as work progresses
- create a linked blocker or follow-up issue if another repo or executive action is required
- preserve truthful buyer, licensing, hosted-session, and ops language throughout
- end with `blueprint-resolve-work-item` using the current `issueId` and a proof-bearing closeout comment, or leave the issue blocked with the blocker explained

gstack workflow:

- Run `/plan-eng-review` before starting non-trivial implementation to lock architecture and create a test matrix.
- Use `/investigate` when debugging CI failures or runtime errors — follow reproduce, isolate, diagnose, verify.
- Run `/ship` after implementation to bootstrap tests, create a PR, and prepare for review handoff.
- Use `/careful` before any destructive commands (rm, force push, drop, etc.).
