# Robot-team agent access

## Current product boundary

Blueprint exposes one customer-facing product: a Task Evaluation Run. Agent discovery and request drafting use the same product, request contract, lifecycle, decision or abstention result model, and scoped-quote intake as the human site.

The active request path asks for the site-task, decision question, candidates when applicable, claims, thresholds, false-safe consequence, acceptable risk, budget, deadline, available evidence, restrictions, audience, owner, idempotency, and provenance. It does not ask the customer or agent to choose a simulator, world model, or provider. Pipeline owns evidence-method qualification, routing, and scientific verdicts.

Valid results include bounded positive decisions, bounded negative decisions, candidate elimination, partial decisions, explicit abstention, and a request for the next evidence needed. A result must preserve its validation envelope, uncertainty, disagreements, unsupported conditions, claim ceiling, next cheapest experiment, physical-evidence requirement, exact artifacts, and permitted uses. Post-training is only a permitted use of qualifying evidence; it is not a product or proof that training occurred.

## Public discovery and intake

Public, read-only commands:

```bash
npm run agent:cli -- help --format json
npm run agent:cli -- doctor --format json
npm run agent:cli -- setup-auth --format json
npm run agent:cli -- plan --q "Warehouse tote transfer" --want task-evaluation-run
npm run agent:cli -- site-world search --q "Warehouse tote transfer" --limit 5
npm run agent:cli -- request location --location "Chicago warehouse" --workflow "tote transfer"
npm run agent:cli -- ask --q "How do I request a Task Evaluation Run with a budget?"
```

The request-location command is intake-only. It does not submit, write, grant access, authorize payment, clear rights, run a provider, create a hosted session, or prove a result. The current request/decision lifecycle begins at `/contact/robot-team` or `/contact/site-operator`; authenticated run records use `/api/task-evaluation-runs`.

The planner returns an exact testbed match, a request candidate, or a `task_evaluation_run_request`. It never creates standalone commerce or selects an evidence backend.

## Current MCP tools

- `blueprint.siteWorld.search`
- `blueprint.catalog.search` (compatibility alias)
- `blueprint.ask`
- `blueprint.request.locationDraft`
- `blueprint.siteWorld.get`
- `blueprint.siteWorld.launchReadiness`
- `blueprint.commerce.order.get` (historical read)
- `blueprint.commerce.liveOrder.get` (historical read)
- `blueprint.commerce.entitlement.get` (historical read)
- `blueprint.commerce.entitlementReadiness` (historical compatibility)
- `blueprint.session.create`
- `blueprint.session.reset`
- `blueprint.session.step`
- `blueprint.session.runBatch`
- `blueprint.session.control`
- `blueprint.session.renderExplorer`
- `blueprint.session.export`

Hosted-session tools are compatibility operations for already entitled records. They retain Firebase robot-team/admin authentication, entitlement, tenant, session ownership, rights, runtime, and launch-readiness gates. They are not a separate current product or a promise of new fulfillment.

Historical compatibility commands remain available for authorized records:

```bash
npm run agent:cli -- commerce entitlement-readiness --site-world-id <site-world-id> --entitlement-id <entitlement-id>
npm run agent:cli -- session create --site-world-id <site-world-id> --robot-profile-id <robot-profile-id> --task-id <task-id> --scenario-id <scenario-id> --start-state-id <start-state-id>
```

## Retired commerce writes

Standalone site-package and hosted-session quote and checkout are retired:

- `GET /api/agent-access/commerce/quote`
- `POST /api/agent-access/commerce/dry-run-checkout`
- `POST /api/agent-access/commerce/live-checkout`
- legacy `sessionType=robot-eval-run` checkout

These endpoints return `410` with `standalone_commerce_retired` or `legacy_robot_eval_checkout_retired`. They create no Stripe session, order, charge, or entitlement. Historical orders and entitlements remain readable for reconciliation under their original access controls.

The CLI rejects retired quote and checkout commands before any network call. The MCP manifest does not advertise quote or checkout tools. The OpenAPI contract retains the URLs as deprecated `410` compatibility operations so old clients receive a precise migration response.

## Truth labels and proof boundaries

- `capture_grounded`
- `provider_derived`
- `generated`
- `request_gated`
- `protected_robot_team`
- `legacy_commerce_read_only`
- `decision_or_abstention`

Fixture, simulation, provider, real-observation, and physical evidence stay distinct. Provider availability is not a result. An export is not proof of training. A user-entered physical note cannot recalibrate a method. Historical payment proves only the recorded payment/entitlement state, not rights clearance, provider execution, deployment, safety, or physical success.

## Contracts and drift guard

- Dynamic OpenAPI: `GET /api/agent-access/openapi.json`
- Static OpenAPI: `/agent-access.openapi.json`
- Agent manifest: `GET /api/agent-access`
- Public orientation: `/llms.txt` and `/llms-full.txt`
- Contract version: `2026-07-29`

Regenerate static artifacts with `npm run agent:contract`. `scripts/agent-access/agent-access-drift-guard.test.ts` verifies exact OpenAPI parity, current tool names, active CLI commands, and truth labels.
