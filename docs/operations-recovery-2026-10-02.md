# Spending and operations recovery — October 2, 2026

This implements the spending and Slack portions of the eight-workstream audit.
The owner stopped recurring research, communications, spend publication and
Slack triage. Installation is not authorization to resume any of them.

## Observed boundaries

- The existing daily spend snapshot was collected at 11:59:31.329323 UTC and
  generated at 11:59:33.772433 UTC. Its 4,700,190 retained bytes have SHA256
  `88dd95d618bf0cf6908115783554c60c5f6bee579528e24fd439e605888c56c2`.
  It contains 1,464 rows, 1,465 historical revisions, ten proposed Notion
  upserts and 1,454 withheld identities. These counts are not daily charges.
- All-provider daily and October consumption totals remain **unknown**.
  Missing GCP/RunPod sources, incomplete Vast identity/pagination and unknown
  provider freshness prevent an honest complete total. A freshly written
  accounting pointer does not establish fresh provider data.
- At 12:06:50 UTC, `#ops-digest` still received a generic blocked message from
  source bot `B0C5NNFTZNE`. Read access to this channel does not prove the
  company's event subscription, signing configuration or posting identity.
- No AWS account-closure, final-bill or courtesy-credit decision is established
  by collector removal. The exact existing support case must be read in its
  owning account; the connected founder mailbox is a different account.

## Canonical storage and recovery

All new collections are server-owned and inherit the Firestore client default
deny. Existing Admin authorization is required; this change adds no client
access, OAuth scope or credential.

| Record | Canonical location | Format and identity |
|---|---|---|
| Exact spend snapshot | `gs://blueprint-8c1ca.appspot.com/operations/spend/snapshots/<raw-sha256>.json` | Original JSON bytes; raw SHA256, immutable create and byte readback |
| Snapshot import | `blueprintSpendEvidence/default/snapshots/<raw-sha256>` | `blueprint.spend-snapshot.v1`; source/check/import timestamps distinguished |
| Retained observation | `blueprintSpendEvidence/default/observations/<row-content-sha256>` | `blueprint.spend-observation.v1`; original revision and source key retained |
| Existing Notion binding | `blueprintSpendEvidence/default/notionBindings/<source-key-sha256>` | Durable revision, unknown-publication intent and verified readback |
| Source Slack occurrence | `blueprintOpsIncidents/default/events/<team-channel-message-ts-sha256>` | `blueprint.ops-incident-event.v1`; exact message text, evidence, source and observed timestamps |
| Incident | `blueprintOpsIncidents/default/incidents/<team-channel-workflow-run-sha256>` | `blueprint.ops-incident.v1`; one owner/thread, first/last occurrence and recurrence count |
| Operator decision | `blueprintOpsIncidents/default/decisions/<actor-command-sha256>` | `blueprint.ops-decision.v1`; evidence reference, actor, action and expected fingerprint |
| Slack delivery | `blueprintOpsIncidents/default/deliveries/<incident-fingerprint-sha256>` | `blueprint.ops-delivery.v1`; POST intent, acceptance and separate thread readback |
| Missed-event cursor | `blueprintOpsIncidents/default/reconciliation/<channel-id>` | `blueprint.ops-reconciliation.v1`; complete-scan watermark with overlap |

Replacement agents can download a snapshot by its `gs://` reference, verify its
raw hash, and import it through `scripts/autonomy/retain-spend-evidence.ts` using
a JSON provenance file with `sourceRef` and `sourceVersion`. The importer never
polls billing APIs or changes a stopped schedule. Provider version unknowns must
remain explicit in provenance. Firestore documents can be exported as JSON with
their stable paths; source bytes and observation revisions are not deleted by
publication. Notion and Slack are projections, never the only evidence copy.

The existing Spend ledger data source is
`22a9c161-930d-4c6f-b7d7-de7cb4a4a065`; no second tracker is created. Publication
queries the exact source key, refuses duplicate matches, clears corrected
unknown values, preserves unrelated cash/invoice/funding entries, and reads
back every changed property. A lost create acknowledgment requires query
reconciliation; it cannot issue another blind create. Older source revisions
cannot replace newer ones. Full source bytes remain in GCS even when individual
rows cannot safely be published.

## Company worker wiring

`server/routes/slack-events.ts` verifies Slack signatures before incident
admission. `server/utils/opsAutomationScheduler.ts` uses its existing leader
lease for the missed-event reader, incident delivery and spend publication.
Each new lane requires its own explicit `true`; the global automation setting
cannot activate an owner-stopped lane.

| Lane | Explicit enable | Default |
|---|---|---|
| Primary event admission | `BLUEPRINT_OPS_SLACK_INGEST_ENABLED` | stopped |
| Missed-event reconciliation | `BLUEPRINT_OPS_SLACK_RECONCILE_ENABLED` | stopped |
| Incident thread delivery | `BLUEPRINT_OPS_SLACK_DELIVERY_ENABLED` | stopped |
| Existing-ledger publication | `BLUEPRINT_SPEND_PUBLICATION_ENABLED` | stopped |

Slack additionally needs the verified existing team/app/channel/own-bot/source-
bot bindings and accountable owner in `BLUEPRINT_OPS_SLACK_*`, plus an explicit
`BLUEPRINT_OPS_SLACK_RECONCILE_START_TS`. The reader verifies the existing
token's team and bot before channel reads; no extra scopes are requested. An
absent binding is an actionable failure, not permission to create credentials.

All source reports are untrusted evidence. Their text cannot acknowledge,
assign, resolve, deploy, spend, reveal secrets or delete. An authenticated
operator can call `recordOpsIncidentDecision` with an evidence reference and
the current fingerprint; stale resolutions refuse. Material newer evidence
reopens a resolved incident. Late replay does not move its first/last times
backwards or fabricate a new owner. Handler status messages are ignored.

Thread delivery posts only a material incident update in the existing source
thread. Slack API acceptance and actual readback are separate. After a lost
acknowledgment, the worker searches the thread for its own exact delivery key;
an unobserved POST remains unknown and is never blindly repeated. The missed-
event reader uses the same ingestion function and never creates repair workers.

## Required observed acceptance

Local tests use retained natural alert text and the actual private spend
snapshot, plus hermetic duplicate, timestamp, partial-page, unknown-acknowledgment
and correction cases. They do not establish production event delivery or an
unattended daily Notion update.

Before any live Slack test, verify the existing app membership, subscriptions,
signing secret presence and token identity/scopes without exposing values. The
proposed low-impact test uses `#ops-digest`, a fictional `development_only`
workflow/run `ops-validation/20261002`, two equivalent reports, one changed
fingerprint, and one handler reply. It creates no repair agent, provider call,
spend authority or real-prospect contact. Replay the received events, verify one
incident/owner/thread, three distinct occurrences, no duplicate deliveries,
echo filtering and exact Firestore/Slack readback; then restore all stopped
flags. Owner approval is required before this test and before production triage
resumption. Existing credentials/scopes must suffice or the precise gap remains
pending.

Spend publication's observed daily Notion acceptance waits for the owner's
resumption direction. Until then retained imports may be staged, but the
publisher stays stopped and the dashboard must show incomplete coverage.

## AWS warning and exit boundary

The current instrumented billing transport classifies a Cost Explorer endpoint
as `aws/cost_explorer`, writes an attempted/denied receipt and raises
`endpoint_forbidden` **before transport on the first attempt**. Its attention
signal is `metered_attempt_outcome_requires_attention`. This proves prevention
at those tested seams; it does not prove that every historical or unrelated
caller would have been observed, or that a production Slack warning would have
arrived within a particular time. Full caller coverage and Slack delivery remain
unverified. Do not recreate paid Cost Explorer polling to inspect the shutdown.

For the existing courtesy-credit case, the next owner response should identify
the original case, request its current status and any applied adjustment, supply
the documented caller mitigation without claiming account-wide closure, and
request inclusion of attributable October usage before mitigation. Do not send
a duplicate case or a response without explicit owner direction.

The supported account-exit sequence is to inspect remaining resources, retained
data, commitments and Marketplace subscriptions through existing no-fee console
views; preserve required exports; confirm final/continuing liabilities and
recovery needs; then have the owner perform consequential closure/payment/data
actions. Account closure is not evidence of a zero final bill or immediate
card-removal eligibility. Use the current [AWS account-closure instructions](https://docs.aws.amazon.com/accounts/latest/reference/manage-acct-closing.html)
and [Cost Explorer pricing](https://aws.amazon.com/aws-cost-management/aws-cost-explorer/pricing/).
The removed IAM identity must not be restored.
