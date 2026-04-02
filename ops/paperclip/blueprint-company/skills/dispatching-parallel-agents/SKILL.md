---
name: dispatching-parallel-agents
description: Adapted from obra/superpowers. Use when 2 or more independent investigations or implementation tasks can run without shared state or strict sequencing.
---

# Dispatching Parallel Agents

Use this skill when a single queue item actually contains multiple independent problem domains.

## When to use

- several unrelated regressions or failures are present at once
- different repos or subsystems can be explored independently
- waiting on one investigation would otherwise stall the rest

## Process

1. Split the work into clean, non-overlapping problem statements.
2. Keep one owner for each problem domain.
3. Pass each delegated lane only the files, issue context, and verification target it needs.
4. Do not delegate tightly coupled edits that will conflict in the same files.
5. Rejoin the results into one Paperclip issue update with concrete evidence.

## Guardrails

- Prefer one agent per independent domain, not one agent per tiny subtask.
- Do not create parallel lanes when the real blocker is shared context.
- If the delegated work touches the same files, keep it in one lane instead.
