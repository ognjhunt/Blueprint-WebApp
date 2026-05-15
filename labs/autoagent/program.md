# Blueprint AutoAgent Lab Program

Optimize narrow Blueprint automation harnesses offline.

Rules:

- do not optimize executive or employee persona agents
- optimize only schema-bound task lanes with measurable outcomes
- prefer safety and review correctness over raw completion
- treat false-safe decisions as worse than conservative blocked decisions
- do not port changes directly into production without manual review
- keep local evals runnable from seed/canonical fixtures without Firestore,
  live provider credentials, ACP harness access, or production exports

Current targets:

1. `waitlist_triage`
2. `support_triage`
3. `preview_diagnosis`

Keep separate harnesses per target model family when optimization starts to diverge.

Current offline acceptance loop:

1. seed or reuse local fixtures under `labs/autoagent/tasks`
2. build Harbor-style tasks under `labs/autoagent/harbor`
3. run local schema and scoring checks for all three pilot lanes
4. report pass/fail counts, split counts, reward summaries, and negative-control
   detection

`npm run autoagent:run -- --sample 3` performs that loop without live export.
Pass `--export-live` only when intentionally refreshing historical cases from
Firestore.
