# Harbor Task Notes

Each pilot lane should be turned into Harbor-style eval fixtures built from historical resolved cases.

Minimum case payload:

- `input.json`
- `expected.json`
- `labels.json`

Recommended split:

- `dev/`
- `holdout/`
- `shadow/`

Case directories or fixture registries should follow the lane-specific rules in the subdirectories.

## Local Evaluation

`npm run autoagent:run -- --sample 3` evaluates these fixtures offline by default.
The evaluator checks:

- fixture input shape
- expected output schema compatibility with the production task contract
- required lane fields
- lane-specific optional fields such as scores, response drafts, and retry flags
- safety penalties for unsafe auto-clear, wrong queue, wrong retry, or wrong
  escalation decisions

It also runs one negative control per case. `negative_controls_blocked=N/N` means
the local scorer rejected the intentionally bad candidate for every evaluated case.
Fixtures can add extra schema-valid named controls in `labels.json` under
`negative_controls[]`; use those for recurring Blueprint failure modes such as
no-change churn, unsupported hosted-session proof, and public-copy proof drift.

`agent-failure-promotion` is the repo-local AutoResearch lane for unknown or
meta Paperclip/Hermes failure families. It evaluates offline promotion
candidates only; it must not claim live Paperclip, provider, hosted-session,
payment, rights, city, or launch readiness from fixture success.

Paperclip/Hermes run-failure sweep JSON can also seed fixture candidates through
the recursive-improvement loop's `--paperclip-failure-sweep` input. The
ingestion artifact normalizes repeated failures, no-change churn, fake
progress, unsupported proof, copy/proof drift, retry loops, and blocked-lane
overreach into local fixture candidates. AI may draft a candidate fixture when
configured, but deterministic validation, duplicate suppression, negative
controls, and local evaluator scoring decide whether it enters this task tree.
