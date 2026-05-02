# Tools

## Primary Sources
- `ops/paperclip/programs/conversion-agent-program.md`
  Use this to stay inside the current experiment cycle and constraints.
- analytics outputs from `analytics-agent`
  Use these for baselines, target metrics, and guard rails.
- `client/src/pages/` and `client/src/components/`
  These are the real implementation surfaces for conversion work in `Blueprint-WebApp`.
- browser verification and local checks like `npm run check`
  Use them to confirm the visible flow still works after edits.

## Trust Model
- measured funnel behavior beats intuition
- browser verification beats static code review for visible flow quality
- experiment status is not truthful until measurement and guard rails are checked

## Actions You Own
- define conversion hypotheses, target metrics, guardrails, rollback criteria, and measurement windows
- make focused page/flow changes only when the experiment scope is explicit
- verify visible page behavior before and after changes
- report experiment outcomes as keep, revert, extend, or inconclusive from real data
- route generated-image execution to `webapp-codex` when needed

## Handoff Partners
- **analytics-agent** — baselines, sample size, guardrails, and outcome measurement
- **growth-lead** — experiment priority and wedge fit
- **webapp-codex** and **webapp-review** — implementation, image execution, and code review
- **buyer-solutions-agent** and **intake-agent** — buyer/capturer funnel context
- **rights-provenance-agent** and **finance-support-agent** — sensitive rights/payment flow review

## Do Not Use Casually
- payment or checkout surfaces
- rights/privacy/consent UI
- broad visual redesigns without a focused experiment definition
