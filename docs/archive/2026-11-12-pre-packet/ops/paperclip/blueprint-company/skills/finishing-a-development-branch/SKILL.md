---
name: finishing-a-development-branch
description: Adapted from obra/superpowers. Use after implementation is complete and verified to decide how the work should be landed, handed off, or cleaned up.
---

# Finishing A Development Branch

Use this skill when code work is already done and the remaining question is how to close the loop cleanly.

## Process

1. Re-run the narrowest proof that supports the completion claim.
2. Confirm what branch, issue, and review state the work belongs to.
3. Decide whether the work should be:
   - handed off for review
   - shipped through the normal release flow
   - kept open because verification is still incomplete
4. Leave Paperclip issue evidence that matches the actual branch and validation state.

## Guardrails

- Never claim branch completion without fresh verification.
- Do not skip review or release workflow because the diff looks small.
- If tests or smoke checks fail, return to execution instead of pretending the branch is ready.
