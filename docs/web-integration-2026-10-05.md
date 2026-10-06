# Free beta and durable recovery integration

This integration joins the free-beta/recording-consent repair at
`740da18d5eae1847831d7f52a553bcad0a998b40` with main at
`fa45f5310a59d97d2ac3a741868fc557ed8c97c6`. Neither source branch was changed.
The observed blocker was eight merge conflicts plus automatically merged
competing recovery paths. The completion artifact is this integration commit
and its local regression evidence. This is workflow/authorization work in the
ADP partner-intake lane; it does not promote the ADP-009 gate or any scientific
or physical outcome.

## Resolution

- Coverage has one executor: `captureCoverageQueue`. It retains the immutable
  source, brief digest, additive supplement provenance, delayed-brief recovery,
  bounded attempts, and retained agent evidence from main. Current recording
  consent is checked at enqueue, claim, publication, and completion. Publication
  also verifies the exact source and brief. A stale worker cannot finish a
  successor's claim. Legacy pending coverage is adopted without resetting its
  attempts or current lease; a newer canonical request cannot be overwritten.
  `captureReviewRecovery` continues description/brief retries and exports only
  a compatibility alias for coverage enqueue.
- App completion queues coverage once after checking the current source and
  recording consent, before publishing the completion marker. Immutable parent
  and supplement identity remain intact.
- Results use the atomic, digest-bound `result_notification_intent` flow from
  main. A repeated historical result binds its notice to retained evidence,
  while current confidence labels remain a read projection. Legacy result
  intents are adopted into that flow; they cannot invent a missing result.
  Existing deterministic outbox records retain their delivery state. The
  legacy terminal-intent worker handles no-result notices and delegates result
  notices to the canonical reconciler. Private outcomes remain team-only.
- Human replies retain principal/channel checks, complete-reply classification,
  rejection precedence, action-digest claims, crash reconciliation, and
  outcome-based closeout. An authenticated, current ledger approval needs the
  exact action digest and a durable claim before execution. Missing bindings,
  freeform approval, and city planning/activation remain held. A wake-up alone
  does not resolve the blocker.
- The merge's duplicate Firestore mock property and non-spy transaction fixture
  were repaired so tests verify the intended behavior. Fixtures now include
  required recording permission instead of bypassing that gate.

## Local verification

- TypeScript: `npm run check` passed.
- Fourteen focused Vitest files: 272 tests passed. They cover human-reply
  admission/routing/worker execution, action execution, coverage source and
  consent publication, legacy lease/budget adoption, atomic notices, result
  immutability, free-beta guards, app-bundle routes/recorded fixtures, and
  capture manifests.
- `git diff --check` passed; no conflict markers remain in TypeScript sources.
- Required Graphify AST refresh passed using isolated `graphifyy==0.9.73`:
  98 code files, 1,522 nodes, 2,855 edges, 54 communities. Canonical derived
  outputs were published to the repo's ignored `graphify-out/` directory.
  The pre-existing manifest entry for `PolicyCanaryReportOverview.tsx` is
  absent and was reported by the runner.

All verification used local stores, mocked providers and email transports, or
loopback HTTP. It proves integration behavior, not a deployed journey or a
physical robotics outcome. No production mutation, external send, provider job,
remote branch update, or deployment was performed. Full cross-repository
journey verification remains a separate release check.
