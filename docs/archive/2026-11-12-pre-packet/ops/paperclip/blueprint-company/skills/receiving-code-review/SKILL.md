---
name: receiving-code-review
description: Adapted from obra/superpowers. Use when review feedback arrives and needs technical validation before implementation or pushback.
---

# Receiving Code Review

Treat review comments as technical claims to verify, not social cues to satisfy.

## Process

1. Restate the review request in concrete technical terms.
2. Check the current code, tests, and runtime behavior before agreeing.
3. Decide whether the feedback is:
   - correct and actionable
   - partially correct but needs a narrower fix
   - incorrect for this codebase
4. Implement one validated item at a time.
5. Re-test the affected behavior before resolving the thread or closing the issue.

## Guardrails

- Do not blindly agree before checking the code.
- Do not reject feedback without specific repo evidence.
- Keep the response factual and short.
