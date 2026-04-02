---
name: subagent-driven-development
description: Adapted from obra/superpowers. Use when executing a written implementation plan whose tasks can be delegated as independent work items in the current session.
---

# Subagent-Driven Development

Use this skill when a plan already exists and the work benefits from isolated implementation lanes.

## Process

1. Start from an explicit written plan.
2. Split the plan into tasks with disjoint ownership whenever possible.
3. Delegate one fresh execution lane per task.
4. After each lane finishes, check:
   - requirement coverage
   - code quality
   - verification evidence
5. Integrate only after those checks pass.

## Guardrails

- Do not use this skill without a real plan.
- Do not dispatch parallel edits into the same file set.
- Keep each delegated task outcome concrete: files changed, checks run, blockers found.
