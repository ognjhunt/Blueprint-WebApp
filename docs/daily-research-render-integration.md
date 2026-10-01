# Blueprint-owned daily research package

This WebApp package carries the reviewed research-only Pipeline source used by
its existing daily-research worker hook. It supports source-backed site/task
discovery for partner admission; packaging alone proves no live research,
qualification, publication or deployment outcome.

## Immutable package pin

- Pipeline source: `35f5c9ad43f84aa053aa7616a63a9aa4f6e32a61` (PR 2518)
- Archive: `vendor/daily-research/blueprint-research.tar`
- Archive SHA256: `1aa932767fe9ec73c06ece6b5ba1e573027a636a3249363d62df7bf6415a3651`
- Archive bytes: `409600`
- Manifested source files: `41`
- Isolated CPU SDK requirement: `openai==3.22.1`

`vendor/daily-research/receipt.json` and the archive manifest bind the same
source commit and file hashes. All manifested bytes must match the immutable
source. The package includes the original four reviewed instruction-only skill
files, complete CRM identity and Notion pagination repairs, the output-validator
repair, adaptive scope coverage and Perplexity Fast application tools. It does
not include the full Pipeline application, GPU packages or dynamic input files.

## Build and import contract

Build with `BLUEPRINT_DAILY_RESEARCH_PACKAGE_BUILD=true`. The existing
`scripts/install-daily-research.py` verifies the archive, safe regular-file
members, manifest and every source-file digest before extraction. Its default
target is `dist/daily-research`; the release stays separate from the WebApp SDK.

`BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED` defaults false. Replacing this package
changes no existing flags or live controls. Installing source is separate from
activating a profile. Preserve existing admitted rows and their original
request, runtime, artifact, recovery and cleanup bindings during upgrades.

For local package verification:

```bash
python scripts/install-daily-research.py --verify-only --target output/research-package-proof
```

The installer tests also import the packaged Python modules without Pipeline,
Torch or OpenAI imports, verify the four skill hashes, check Node bridge dependency imports, and reject altered archive bytes before
extraction or installation.
Run the existing package tests and required WebApp checks on the final combined
commit before merge/deployment. A source pin does not prove installed runtime bytes.

## Selected profile behavior

The reasoning agent remains GPT6.1Sol. Perplexity Fast search and bounded primary
source reads are application function tools; the agent chooses queries and
follow-ups rather than consuming a fixed outer-runner shortlist. Source passages,
URLs, dates and complete bounded static-page text are retained with digests.
Unsupported formats, source failures and resource ceilings remain explicit gaps.
There is no silent native-search fallback.

Prospect count never establishes completion. Define task/industry/region
hypotheses, retain all defensible findings within the resource envelope, and
report actual source coverage, duplicate/rejection reasons, unresolved promising
branches and evidence-based or interrupted stopping reasons. Ten findings are
neither a cap nor a reason to stop; interrupted work is not completed coverage.
The scope remains bounded and makes no exhaustive global-market claim.

The new recurring example is disabled with `soft_target_usd=null` and pending
recurring-budget authority. It requires an explicitly chosen approved target
before activation. The example admits 30 minutes total, with 20 for research and
10 reserved for QA; older rows keep their originally admitted runtime and
budget/planning references. One-time test authority is separate from recurring
authority. Package installation does not supply either.

Research collection, same-session source/duplicate QA and publication retain
durable exact-turn and digest bindings. Unknown paid search attempts are not
replayed; saved function results can be returned idempotently. QA/publication
remain separately gated, and research is not outreach or pilot readiness.

The complete source contract is in the packaged `tools/daily_research/SEARCH.md`,
`RENDER.md`, `SKILLS.md` and `ADAPTIVE.md`. Review those versioned contracts rather
than inferring activation, source support or completion from this integration
page.
