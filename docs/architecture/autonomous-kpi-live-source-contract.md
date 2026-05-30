# Autonomous KPI Live Source Contract

Date: 2026-05-30
Status: repo-local contract for Notion-mirror-ready KPI source status
Owner: `analytics-agent`
Mirror owner: `notion-manager-agent`

## Purpose

This contract keeps autonomous metrics and queue truth fail-closed while Notion KPI rows are still marked `Source needed` or `Missing source`.

The repo-local generator in `scripts/autonomy/generate-kpi-source-status.ts` reads fixture or repo-local snapshot JSON only. It does not export live Firestore, write Notion, send messages, touch Stripe, call providers, or mutate Paperclip.

## Status Semantics

| Status | Meaning |
|---|---|
| `Sourced` | A fresh repo-local snapshot contains allowed evidence from the owning source contract. The row can be mirrored later with its evidence refs. |
| `Source needed` | Required evidence is missing, stale, unsupported, or drifted. The generator suppresses the claimed value and names the blocked source. |

Unsupported KPI values cannot become truth. If a row has a claimed value but the allowed source evidence fails, the value is emitted only as `suppressedClaim`.

## KPI Source Contracts

| KPI row | Owner system | Collection or artifact | Allowed fields | Freshness | Blocker behavior |
|---|---|---|---|---:|---|
| Captures | Firestore capture projections backed by `BlueprintCapture` run truth | `capture_submissions`, `creatorCaptures` | Capture id, site submission id, buyer request id, capture job id, upload/captured timestamps, status/update fields | 7 days | Keep `Source needed` until capture/upload provenance is in a repo-local snapshot or live export is explicitly authorized. |
| Proof packages | `BlueprintCapturePipeline` package output projected into WebApp | `operatingGraphEvents` with `entity_type=package_run` and `stage=package_ready` or `hosted_review_ready` | Entity id, stage, source repo/kind, package id, capture/request linkage, recorded timestamp | 7 days | Keep `Source needed` until package-ready evidence links back to capture or request ids. |
| Hosted starts | WebApp hosted-session runtime | `hostedSessions` plus correlated `operatingGraphEvents` `stage=hosted_review_started` | Session id, status, site/package identity, runtime handle, presentation runtime, latest episode, event metadata session id, recorded timestamp | 3 days | Keep `Source needed` unless hosted runtime/session evidence exists. Sample text or uncorrelated operating-graph prose is `hosted_session_proof_drift`. |
| Contacts | Firestore inbound/contact records | `inboundRequests`, `contactRequests` | Request id, status, qualification/opportunity state, normalized contact/company fields, request source, created/updated timestamps | 7 days | Keep `Source needed` when contact rows are absent or only exist as target research. |
| Sends / replies / calls | Action ledger, human reply events, qualified call ledger | `action_ledger`, `humanReplyEvents`, call event artifact | Idempotency key, lane/action/status/provider ref, reply thread/blocker id, call id/request id/status/timestamps | 7 days | Keep grouped KPI `Source needed` until sends, replies, and calls each have source evidence. |
| Buyer support | Support triage source rows | `contactRequests`, `action_ledger` support lane | Queue, priority, support intent/status, human-review flag, confidence, action id/status/source refs | 7 days | Keep `Source needed` unless buyer-support rows come from support triage or support action ledger evidence. |
| CI failures | GitHub workflow polling mirrored through Paperclip/plugin snapshots | GitHub workflow run snapshot, Paperclip managed issue/source mapping | Repo, workflow, run id, status/conclusion, URL, source type/id, issue id, updated timestamp | 3 days | Keep `Source needed` unless a workflow run snapshot or source-mapped Paperclip issue names the failing run. |
| Revenue / payments | Stripe checkout/webhook truth | Stripe event or checkout-session snapshot | Event/session/payment intent ids, payment status, amount, currency, timestamps | 7 days | Keep `Source needed` until Stripe evidence exists. Entitlement, request text, or Notion prose is not payment truth. |

## Firestore And Rules Reconciliation

`ops/paperclip/FIRESTORE_SCHEMA.md` documents `action_ledger` and now explicitly documents `hostedSessions` as hosted-session state, not an autonomous queue collection.

`firestore.rules` intentionally keeps KPI source collections server-only. Admin SDK/server routes can write operational records, but client-side Firestore reads and writes for `action_ledger`, `hostedSessions`, `capture_submissions`, `operatingGraphEvents`, `operatingGraphState`, `buyerOutcomes`, and human-reply collections are denied. The generator therefore consumes repo-local snapshots, not live client Firestore reads.

## Automation Plugin Path Reconciliation

`ops/paperclip/plugins/blueprint-automation/src/worker.ts` has Notion and queue tools that can mirror or sync workspace visibility later:

- `metricsReporterReport` and the analytics report helpers produce Notion-facing reports, but they do not own KPI truth.
- `notionUpsertKnowledge`, `notionUpsertWorkQueue`, and metadata/relation tools can update Notion when explicitly invoked by an authorized Notion Manager run.
- `runOpsQueueScanJob` reads Notion Work Queue and creates Paperclip issues; it is not a KPI source.
- GitHub workflow polling and source mappings can supply CI evidence when a repo-local snapshot includes the workflow run or managed issue reference.

This contract deliberately does not add `hostedSessions` to the autonomous ops queue set. Hosted-start KPI truth stays blocked until a snapshot contains hosted runtime/session evidence.

## Generator

Default command:

```bash
npm run autonomy:kpi-source-status
```

Default input:

```text
server/tests/fixtures/kpi-live-source-snapshot.json
```

Default output:

```text
output/autonomous-org/kpi-source-status-latest/kpi-source-status.json
output/autonomous-org/kpi-source-status-latest/kpi-source-status.md
```

Notion Manager may mirror the generated markdown later, but this command must not write Notion.
