---
name: test-driven-development
description: Adapted from obra/superpowers. Use for behavior-changing implementation work so the expected behavior is captured before the fix or feature lands.
---

# Test-Driven Development

Use this skill when behavior is changing and the repo has a meaningful place to express that behavior in tests.

## Process

1. Identify the smallest failing test or assertion that proves the intended behavior.
2. Write or update that test first.
3. Run it and confirm it fails for the right reason.
4. Implement the minimum code required to make it pass.
5. Re-run the targeted test plus one adjacent regression check.

## Guardrails

- Do not add production code before you have a failing proof of the behavior.
- If the repo has no sensible automated test surface for the change, document that explicitly.
- Keep tests specific to the behavior you are changing.
