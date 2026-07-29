# Task Evaluation Run migration

Date: 2026-07-29

## Product decision

Blueprint has one customer-facing product: a Task Evaluation Run. Robot teams and site operators are personas using the same request contract, lifecycle, result model, scoped-quote concept, and intake. The maintained Site-Task Testbed is the reusable substrate behind runs.

The lifecycle is:

`real site-task -> maintained testbed -> Task Evaluation Run -> least-cost qualified evidence plan -> decision or abstention -> targeted physical evidence when needed -> maintained learning loop`

Post-training is only a permitted use attached to qualifying evidence. It is not a SKU, navigation concept, checkout, delivery promise, or proof that training occurred.

## Shared contract provenance

WebApp mirrors the proposed Pipeline Decision/Evidence Router handoff in `contracts/pipeline/decision-evidence-router.v1.json`.

The mirrored versions are:

- `blueprint.site_task_testbed_manifest.v1`
- `blueprint.decision_evidence_request.v1`
- `blueprint.evidence_plan.v1`
- `blueprint.evidence_method_profile.v1`
- `blueprint.normalized_evidence_result.v1`
- `blueprint.decision_envelope.v1`
- `blueprint.physical_outcome_join.v1`

The local mirror digest is verified by `npm run pipeline:robot-eval-contract:verify`. The Pipeline source contract had not merged when this migration was implemented, so the verifier reports the dependency as proposed/unmerged unless an exact Pipeline contract path is supplied. Local parity is not claimed as live cross-repo compatibility.

## Ownership boundary

Pipeline owns method qualification, evidence routing, method-profile snapshots, normalized evidence results, scientific verdicts, decision envelopes, and physical-outcome joins.

WebApp owns authenticated intake, schema validation, idempotency, authorization and entitlement checks, durable queue/outbox state, status projection, artifact-access presentation, redaction, compatibility translation, and operator workflows.

The normal request identifies Pipeline as routing authority and sets `webapp_backend_selection_allowed=false`. It contains no simulator preference, provider choice, client secret, private endpoint, or raw policy weights.

## Request model

The request includes the request/decision identifiers; testbed id, version, and digest; decision question; site/task conditions; candidate references; claims; thresholds and units; false-safe severity and consequence; acceptable risk/confidence; budget and deadline; available physical evidence; rights/privacy/provider restrictions; requested audience; idempotency; provenance; authenticated owner; and server-owned commercial scope.

The authenticated intake uses progressive sections and never asks an ordinary customer to select MuJoCo, Isaac, Cosmos, OSCAR, or another evidence backend.

## Result model

Supported states are `draft`, `submitted`, `accepted`, `planning`, `awaiting_authorization`, `running`, `aggregating`, `decision_available`, `abstained`, `blocked`, `failed`, and `superseded`.

Unknown future states fail closed. They remain visible as unsupported and are never rendered as success.

The run detail leads with the decision or explicit abstention, then shows scope, per-claim outcomes, evidence methods and selection reasons, measurements, validation envelope, coverage, uncertainty, disagreements and correlated-evidence warnings, unsupported conditions, claim ceiling, next cheapest experiment, physical evidence still needed, cost/time when available, exact artifact versions and digests, and permitted uses.

An abstained result cannot select or infer a winner from raw scores. Partial decisions do not upgrade unresolved claims.

## Compatibility

- `/api/task-evaluation-runs` is the current authenticated request/status surface.
- `/api/robot-eval/job-requests` remains an explicit API alias for old clients.
- Legacy request contract values are translated only when intent is unambiguous.
- Paid or customer-visible legacy commercial intent is rejected with a precise migration error rather than silently reinterpreted.
- Retired public offer URLs redirect to `/pricing`.
- Authenticated `/app/packs`, `/app/policies`, `/app/data`, and `/app/entitlements` remain compatibility views but are removed from primary navigation.
- Historical orders, entitlements, hosted sessions, artifacts, and transactions remain readable under their original access controls.
- New standalone quote and checkout paths return `410` and create no Stripe session, order, charge, or entitlement.

No destructive database migration is part of this change.

## Security and proof boundaries

The migration preserves authentication, Firebase owner identity, CSRF checks, global rate limits, tenant and site entitlement checks, idempotency conflict detection, server-authoritative commercial scope, error redaction, audit/status records, and signed artifact-access boundaries.

Provider availability never becomes customer-visible success. Pipeline or provider unavailability produces a queued, blocked, awaiting-authorization, or abstained state. Physical outcome ingestion requires exact join identifiers and authoritative physical evidence; a user note cannot recalibrate a method.

Fixture, simulation, provider, real-observation, and physical evidence remain distinct. Estimates are not physical guarantees, and safety approval remains external.

## Publication boundary

This migration authorizes repo-local code, documentation, tests, contract generation, PR publication, and protected-main merge. It does not authorize Render deployment, production Firestore mutation, Stripe mutation, live Pipeline/provider execution, physical robot execution, customer messages, credential changes, or other paid operations.
