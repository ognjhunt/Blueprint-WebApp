# Blueprint-owned daily research package

This WebApp package carries the reviewed research-only Pipeline source used by
its existing daily-research worker hook. It supports source-backed site/task
discovery for partner admission; packaging alone proves no live research,
qualification, publication or deployment outcome.

## Current reviewed repair package

The October 3 release carries controlled Pipeline source
`3bd4c9ba143e0789fc20f696c8a4ef311b7b82e9` (PR2560; reviewed head
`a08f2e130254b74ca3b94d8062d33b42700294f0`). Its 839,680-byte archive
SHA256 is `09b92cf66a4c8b050ef9d7482f69fc7851ca4519def057bfdb388eefdd08c0f1`,
with 49 manifested source files. It preserves the deployed owner MCP, history,
QA and publication source from `e863c2823bfc8a6b604609e8fb85daa31ae5552b`.
This is a research-only controlled release; Pipeline main is a separate lineage.

The founder approved automatic cleanup of completed research runs on October 3:
save and verify complete company-owned backups, confirm the run has finished,
delete only its attached temporary provider resources, and verify cleanup while
retaining reports, sources, CRM and learning records. The existing scheduler
implements this lifecycle only when a retained `cleanup_policy` is enabled in
its trusted company control. Installing the package alone enables no deletion.

Before deletion, the worker verifies completed research, validated QA, actual
Notion/Sheets publication receipts, exact session/environment/turn ownership,
complete provider records and artifact contents, and the canonical portable
export. Every backup object in the existing private company bucket is read back
by generation, byte count and SHA256. A durable one-use deletion claim prevents
repeating an uncertain DELETE; later observations use GET only. Both session and
attached environment must return authenticated 404 before clearing the next-run
guard. Unknown usage remains unknown and `billing_stop_verified` remains false.

The policy starts with the completed October 3 run and keeps the existing
October 9 at 7pm Central expiry. It changes no research/comms spending authority,
access scope, sending, Gmail draft setting, CRM record or retained learning record.
Canonical backup objects use `gs://blueprint-8c1ca.appspot.com/operations/research/cleanup/DATE/MANIFEST_HASH/`;
the run row and portable `cleanup-manifest.json` carry exact object generations,
hashes, sizes and source-row binding. Replacement agents recover through the
existing authorized worker storage binding and normal `render export` route.

The original admitted package below remains the recovery identity for the
October 1 run. Preserve its bytes and original input bindings; an upgrade does
not rewrite prior charged runs or their receipts.

## Original admitted package pin

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
