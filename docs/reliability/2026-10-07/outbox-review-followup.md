# PR 922 review followup

Base: `5d3f8046d`, original queues/recovery branch. Scope: failure telemetry and deterministic test cleanup; dispatch/unknown-outcome state transitions are unchanged.

Two provider-receipt regressions first demonstrated that returned SDK errors and missing acceptance IDs produced zero `logger.error` calls. The classifier's early return had bypassed the existing `email_dispatch_failed` event. The failure event is restored with the existing redacted metadata, a fixed failure reason, numeric status when available, and the preserved `not_sent`/`unknown` classification. Raw provider text, full recipient, subject and body are excluded from that application log. Tests verify both event presence and sensitive-fixture exclusion.

The concurrent-sender and late-receipt tests previously relied on Vitest's implicit one-second `waitFor` budget and released their held provider promises only after assertions succeeded. They now use an explicit bounded ten-second readiness budget and release/drain held promises in `finally`, including assertion-failure paths. Promise rejection handlers attach immediately; provider failures still propagate to the test instead of being swallowed. No ten-second sleep was added.

Verification: 43 tests across `capture-outbox`, `email-provider-receipt`, `email-logging`, and `email-test-redirect` passed with native networking blocked. The 640 distinct seeded schedules remain part of that count's workload, not 640 additional test cases. `git diff --check` and the required Graphify refresh passed. No send, live provider call, production data mutation, deployment or broader branch change was performed. Root coordinator owns propagation into the later atomic-intent and integration candidates.
