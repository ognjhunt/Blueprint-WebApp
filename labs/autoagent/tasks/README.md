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
