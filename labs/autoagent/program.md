# Blueprint AutoAgent Lab Program

Optimize narrow Blueprint automation harnesses offline.

Rules:

- do not optimize executive or employee persona agents
- optimize only schema-bound task lanes with measurable outcomes
- prefer safety and review correctness over raw completion
- treat false-safe decisions as worse than conservative blocked decisions
- do not port changes directly into production without manual review

Current targets:

1. `waitlist_triage`
2. `support_triage`
3. `preview_diagnosis`

Keep separate harnesses per target model family when optimization starts to diverge.
