---
name: using-git-worktrees
description: Adapted from obra/superpowers. Use when feature work or issue work needs isolation from the current workspace or branch.
---

# Using Git Worktrees

Use a separate worktree when the current workspace is noisy, risky, or already occupied by another lane.

## Process

1. Confirm the issue really benefits from workspace isolation.
2. Pick a worktree directory and branch name tied to the issue.
3. Create the worktree before making changes.
4. Verify the new worktree points at the intended branch and repo state.
5. Do the implementation and validation in that isolated tree.

## Guardrails

- Do not create a worktree for tiny one-file follow-ups unless isolation matters.
- Avoid hidden branch drift; verify the branch before starting edits.
- Keep the Paperclip issue linked to the worktree branch.
