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
the parent operator, after review and release gates.

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
base64 exact files, and explicit missing-file list. The research adapter's review
and receipt commands preserve digest/source-support/CRM/readback gates. Agents own
QA and Sheets/Notion publication; dot observes. No dot receipt is required.

The communications branch must not overwrite `server/worker.ts` research startup;
coordinate any shared-worker edits and integrate separate branches after review.
Queue projection is not proof of a running consumer. Existing Sheet readonly
access, Firestore writes, QA/publication app bindings, live canary and first
unattended wake still require owning-system verification.

The old automation `6abc4ffae84881919154bba45f749074` remains the operator's cutover
responsibility. Do not activate both triggers, erase an old date ledger, or release
hold `20260930T132640Z-hold-354d4ae6`.
