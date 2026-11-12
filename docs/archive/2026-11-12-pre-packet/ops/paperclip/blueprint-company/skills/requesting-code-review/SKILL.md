---
name: requesting-code-review
description: Adapted from obra/superpowers. Use after meaningful implementation work to request a focused review against requirements and regressions.
---

# Requesting Code Review

Use this skill when a change is ready for an explicit review pass.

## Process

1. Summarize what changed, why it changed, and what should now be true.
2. Point the reviewer at the exact issue, plan, or requirement set.
3. Include the narrowest useful diff or file set.
4. Ask for review against:
   - correctness
   - regressions
   - requirement coverage
   - missing tests or verification
5. Feed the findings back into the issue before closing it.

## Guardrails

- Request review early enough that fixing findings is still cheap.
- Do not ask for a generic "LGTM"; ask for review against specific requirements.
- Keep the review scope small when the change is small.
