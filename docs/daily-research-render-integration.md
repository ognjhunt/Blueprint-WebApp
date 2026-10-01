# Blueprint-owned daily research

This WebApp change hosts the reviewed, research-only Pipeline package in existing
Render worker `srv-d9t8gg1t0dsc73am9q70`. It adds a separately enabled hook to
`startWorker()`; existing ops/outbound/launch flags and paid authority are preserved.
No GPU/Pipeline application packages, new service, credential or grant are added.

`vendor/daily-research/receipt.json` pins the exact Pipeline source SHA and archive
SHA256. Build with `BLUEPRINT_DAILY_RESEARCH_PACKAGE_BUILD=true`; the build
verifies all bytes and creates the isolated Python 3.11-compatible OpenAI SDK
environment. `BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED` defaults false and must
remain false through deployment/preflight/manual canary. Live actions belong to
the authorized operator, after review and release gates.

The prepared correction pins Pipeline source
`20d0c9e8b784e451aa281f3adee85d34c8054b5a` (PR 2507), including the complete CRM
identity guard and bounded full-parent Notion pagination repair. It accepts the actual
file-based skill discovery setup and packages the original four reviewed text
files. Exact hashes are checked before the create payload is persisted; inline
session overrides bind those bytes without mutating the saved template. Package
verification covers 32 source files. The initial disabled release
`614780173940f9a35cbdbca5f683b2b1f531f5e0` verified Python 3.14.3 with OpenAI
3.22.1. Python 3.11/3.12/3.14 are covered by isolated research CI. Each updated
package release still requires fresh exact deployed-SHA, installed-byte and
disabled-process/control verification; a source pin alone does not prove live
installation or remote skill loading.

The full current command/cutover contract ships in the pinned package at
`dist/daily-research/release/tools/daily_research/RENDER.md`. It retains 07:00
America/Chicago DST behavior, one create per date, durable intent before provider
creation, uncertain-attempt reconciliation, immutable artifacts, the $1 total
soft target, no outreach and exact action-time deletion approval.

Communications integration consumes
`blueprintDailyResearch/sites-first/workItems/YYYY-MM-DD`, using existing
authorized Firestore access. Stages are `agent_qa_pending` and
`publication_pending`; pointer fields are `row_blob` and `packet_digest`.
`Store.snapshot(date)` returns `blueprint.research-snapshot.v1` with verified row,
base64 exact files, and explicit missing-file list. The scheduler and run/reconcile entry points execute same-session QA and guarded
publication automatically under the separate workflow control. They preserve
digest/source-support/CRM/readback gates and save QA artifacts before publication. Agents own
QA and Sheets/Notion publication; dot observes. No dot receipt is required.

The communications branch must not overwrite `server/worker.ts` research startup;
coordinate any shared-worker edits and integrate separate branches after review.
The pinned consumer is executable; its live execution remains unverified. The
workflow example defaults disabled and requires reviewed QA/publication authority.
It shares the original 180-second total runtime and $1 total soft target. Unknown
QA inputs and publication attempts are never repeated after restart; readback
conflicts block success. A complete hermetic run reaches both publication receipts.
See the packaged RENDER.md for exact request, recovery and readback contracts. Canonical Sheet readonly
access is verified through the existing service account (HTTP 200, 16 total
rows/11 data, complete at 01:19:46 UTC). The owner subsequently approved an
Editor grant on that exact canonical file, and the persisted permission was
independently read back. The owner also saved a narrowly scoped Notion worker
key; its runtime Knowledge-page read remains pending. Actual publication
writes/readbacks, Firestore-writing preflight, live canary and the first unattended
wake still require owning-system verification. See
[the connection handoff](agents-mcp-connections.md) for supported standard API
setup and separate MCP-preview preparation. No dot runtime bridge is required.

The old automation `6abc4ffae84881919154bba45f749074` remains the operator's cutover
responsibility. Do not activate both triggers, erase an old date ledger, or release
hold `20260930T132640Z-hold-354d4ae6`.
