---
name: Pipeline Autonomy Loop
project: blueprint-capture-pipeline
assignee: pipeline-codex
recurring: true
---

Work from assigned `BlueprintCapturePipeline` Paperclip issues first.

Each run must:

- claim the highest-priority assigned issue or create/refine one before substantial work
- implement the concrete pipeline change tied to that issue
- update issue status and leave validation comments as work progresses
- create a linked blocker or follow-up issue if another repo or executive action is required
- keep packaging quality, hosted runtime behavior, and adapter portability grounded in real contracts

gstack workflow:

- Run `/plan-eng-review` before starting non-trivial implementation to lock architecture and create a test matrix.
- Use `/investigate` when debugging CI failures or runtime errors — follow reproduce, isolate, diagnose, verify.
- Run `/ship` after implementation to bootstrap tests, create a PR, and prepare for review handoff.
- Use `/careful` before any destructive commands.
