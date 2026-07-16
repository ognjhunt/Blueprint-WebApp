# Robot-Team Agent Access

Blueprint exposes a repo-native headless access layer for robot-team agents that need to discover site worlds, ask grounded questions, inspect grounded package context, buy with a budget, open eligible hosted sessions, manipulate scenario/start-state inputs, run rollouts, render explorer frames, and export dataset artifacts.

This layer wraps the existing `/api/site-worlds`, `/api/site-worlds/search`, `/api/site-worlds/sessions`, buyer-order, and marketplace-entitlement shapes. The dry-run agent commerce route creates quote, order, receipt, and entitlement proof without calling live Stripe or granting live package access. The live agent commerce route creates a real Stripe Checkout Session on the same buyer-order/webhook/entitlement rails used by the human marketplace. Neither creates a second hosted-session runtime, auth stack, or product truth source.

## Public Resources

- Public page: `/agents`
- OpenAPI contract: `/agent-access.openapi.json`
- Dynamic contract route: `/api/agent-access/openapi.json`
- Public discovery: `/api/site-content`
- LLM map: `/llms.txt` and `/llms-full.txt`

## CLI

```bash
export BLUEPRINT_API_BASE_URL=https://tryblueprint.io
export BLUEPRINT_AGENT_AUTH_TOKEN=<firebase-id-token>

npm run agent:cli -- discover
npm run agent:cli -- help --format json
npm run agent:cli -- doctor --format json
npm run agent:cli -- setup-auth --format json
npm run agent:cli -- plan --q "Whole Foods near Durham" --want hosted-review
npm run agent:cli -- catalog list --limit 3
npm run agent:cli -- catalog search --q "whole foods" --limit 5
npm run agent:cli -- site-world search --q "Whole Foods near Durham" --limit 5
npm run agent:cli -- request location --location "Whole Foods near Durham" --site-class grocery --workflow "shelf restocking"
npm run agent:cli -- catalog search --q "warehouse tote" --limit 5
npm run agent:cli -- ask --q "How do I buy a hosted session with a budget?"
npm run agent:cli -- world get siteworld-f5fd54898cfb
npm run agent:cli -- commerce quote --site-world-id siteworld-f5fd54898cfb --product hosted-session-rental --session-hours 1
npm run agent:cli -- commerce checkout --site-world-id siteworld-f5fd54898cfb --product hosted-session-rental --mode dry_run
npm run agent:cli -- commerce checkout --site-world-id <pipeline-site-world-id> --product hosted-session-rental --mode live --budget-cents 20000
npm run agent:cli -- commerce live-order <live-order-id>
npm run agent:cli -- commerce order <dry-order-id>
npm run agent:cli -- commerce entitlement <dry-entitlement-id>
npm run agent:cli -- commerce entitlement-readiness --site-world-id siteworld-f5fd54898cfb --entitlement-id <dry-entitlement-id>
npm run agent:cli -- readiness --site-world-id siteworld-f5fd54898cfb
npm run agent:cli -- session create \
  --site-world-id siteworld-f5fd54898cfb \
  --entitlement-id <dry-entitlement-id> \
  --order-id <dry-order-id> \
  --commerce-mode dry_run \
  --robot-profile-id other_sample \
  --task-id sw-chi-01-task-1 \
  --scenario-id sw-chi-01-scenario-1 \
  --start-state-id sw-chi-01-start-1
```

JSON is the default output. Add `--format ndjson` for harness logs that expect one JSON event per line. Add `--format text` only for human terminal output.

`help`, `doctor`, and `setup-auth` are local setup commands:

- `npm run agent:cli -- help --format json` prints command usage, env vars, examples, exit codes, and truth boundaries without calling Blueprint APIs.
- `npm run agent:cli -- doctor --format json` checks local setup, output formats, credentialless public/demo support, optional protected auth env, and dry-run commerce defaults without calling live services.
- `npm run agent:cli -- setup-auth --require-auth --format ndjson` fails predictably when a protected robot-team/admin bearer token is required but neither `BLUEPRINT_AGENT_AUTH_TOKEN` nor `BLUEPRINT_FIREBASE_ID_TOKEN` is present.

Predictable CLI exit codes:

| Code | Meaning |
|---:|---|
| `0` | Command or setup check succeeded. |
| `1` | Unexpected local CLI error. |
| `2` | Usage error, unknown command, invalid option, or missing required flag. |
| `3` | Setup/auth doctor failed, such as malformed `BLUEPRINT_API_BASE_URL` or missing required bearer auth. |
| `4` | Blueprint API request failed or could not be reached. |

The CLI setup checks do not call Stripe, providers, Firebase writes, Paperclip mutation, payment, payout, or hosted-session fulfillment paths. Protected non-demo hosted-session creation still requires existing Firebase robot-team/admin bearer auth plus a provisioned entitlement; existing session operations require session ownership, admin access, or an active per-session share grant.

## Agent Journey Planner

Use `plan` when a robot-team agent has a natural-language query and needs the next safe machine action in one compact JSON response:

```bash
npm run agent:cli -- plan --q "Whole Foods near Durham" --want hosted-review
```

Planner actions are read/dry-run by default: `exact_catalog_match`, `request_candidate`, `dry_run_quote_order`, `entitlement_readiness`, `public_demo_session_path`, or `blocked_protected_session_path`. Blockers are returned as structured objects with `code`, `severity`, `ownerSystem`, `message`, and `retryAction`. The planner does not create live payment, private access, provider execution, or hosted-session fulfillment.

## Request/Commerce/Session Lifecycle

The request/commerce/session lifecycle is intentionally split so robot-team agents cannot mistake intake, dry-run commerce, or hosted-session lifecycle proof for the same thing:

- `request intake`: use `requestCandidate` from search or `blueprint.request.locationDraft` to produce a contact URL and inbound-request draft. This does not submit, write, grant package access, or create entitlement.
- `dry-run commerce`: use quote, dry-run checkout, order, entitlement, and entitlement-readiness tools to prove the commerce shape without live Stripe, package delivery, rights clearance, provider execution, or hosted fulfillment.
- `live agent commerce`: use `blueprint.commerce.checkoutLive` to create a real Stripe Checkout Session for a pipeline-backed site world with an optional server-enforced `budgetCents` guard, then poll `blueprint.commerce.liveOrder.get` until webhook fulfillment marks the order paid and provisions the entitlement.
- `hosted-session lifecycle`: use create/reset/step/runBatch/control/renderExplorer/export only after public-demo eligibility or protected Firebase robot-team/admin auth plus entitlement/session ownership gates allow it.

## Structured Robot-Team Test Submission

The buyer-facing structured submission surface lives at `/for-robot-teams` and `/robot-team/eval`. It creates an eligible hosted session through `POST /api/site-worlds/sessions` when public-demo or protected robot-team access allows direct create, and falls back to a prefilled `/contact` intake URL when the package is request-gated. The fallback URL carries a compact modality/field-reference summary in the contact `message` so existing intake can preserve artifact references without adding raw uploads.

The hosted-session create payload may include `policy.robotTeamTestSubmission` with schema version `blueprint.robot_team_test_submission.v1`. WebApp normalizes and validates this object before storing it on the session policy or forwarding it to the hosted-session runtime adapter.

Supported modalities:

| Modality | Required reference class |
|---|---|
| `policy_api_endpoint` | Callable policy endpoint, auth handling reference, observation/action schemas, runtime constraints, callback/log URI, owner contact. |
| `docker_container` | Image reference, digest/checksum, entrypoint, environment contract, hardware needs, IO schema, runtime notes. |
| `recorded_action_trace` | Trace manifest, format, task/scenario mapping, timestamp alignment, observation/action alignment, success/failure labels, checksum. |
| `high_level_skill_trace` | Skill taxonomy, ordered skill sequence, preconditions/postconditions, failure labels, source type, confidence/coverage note. |
| `teleop_demo` | Demo artifact, operator/device, control mapping, time sync, task/scenario mapping, rights/privacy attestation, labels. |
| `sim_controller_plugin` | Simulator framework, plugin reference, supported control modes, observation/action spaces, replay/export path, compatibility notes. |

The Pipeline schema truth for these modalities is `robot_team_test_submission_modalities.v0.1` and the WebApp policy field is `policy.robotTeamTestSubmission`. Submitted references are artifact pointers only. They do not prove policy execution, simulator completion, hardware execution, off-scope validation, rights/privacy clearance, or generated-world rank fidelity. Missing modality evidence is surfaced as fail-closed statuses such as `needs_policy_api_endpoint_ref`, `needs_docker_container_ref`, `needs_recorded_action_trace_ref`, `needs_high_level_skill_trace_ref`, `needs_teleop_demo_ref`, and `needs_sim_controller_plugin_ref`.

## MCP Stdio Config

```json
{
  "mcpServers": {
    "blueprint": {
      "command": "npm",
      "args": ["run", "agent:mcp", "--"],
      "env": {
        "BLUEPRINT_API_BASE_URL": "https://tryblueprint.io",
        "BLUEPRINT_AGENT_AUTH_TOKEN": "<firebase-id-token>"
      }
    }
  }
}
```

Read-only tools can use public endpoints. Session/write tools require either public-demo eligibility or a scoped bearer token that resolves through the existing Firebase robot-team/admin access checks. Protected non-demo session create also requires a provisioned hosted-session entitlement; protected session operations require admin access, session ownership, or an active per-session share grant.

## Catalog Search

Use `GET /api/site-worlds/search` or MCP tool `blueprint.siteWorld.search` when an agent does not know the exact site-world id. The endpoint accepts `q`, `limit`, `category`, `industry`, `city`, `state`, `siteType`, `taskLane`, `objectTags`, `robot`, `availability`, `readiness`, and `sort`.

Search is deterministic without `OPENAI_API_KEY`. When embeddings are unavailable, responses include `embeddings_unavailable` and rank by alias, lexical, location, task/object/robot, availability, and readiness signals. Queries such as `store`, `supermarket`, `Whole Foods`, `Kroger`, `retail aisle`, and `warehouse tote` return close catalog matches with `score`, `reasons`, `matchedAliases`, `matchedFields`, `matchSemantics`, and `requestCandidate`.

Brand aliases are only ontology hints. A `Whole Foods` query may return the closest grocery/retail site-world, but it does not imply Blueprint has a real Whole Foods package or partner-cleared availability. If `matchSemantics.noExactScannedPackage` is true, use `requestCandidate.requestUrl` or `requestCandidate.inboundRequestDraft` to route intake with `source=site-worlds`, `buyerType=robot_team`, and `path=new-capture`.

Example:

```bash
npm run agent:cli -- site-world search --q "Whole Foods near Durham" --limit 5
```

The returned request candidate records interest only. It does not grant package access, entitlement, payment, rights clearance, provider execution, fulfillment, live hosted-session availability, private artifact access, or admin access.

## Request Location Draft

Use `request location` or MCP tool `blueprint.request.locationDraft` when an agent already knows the requested site or nearby place and needs a first-class intake draft without scraping `/contact`.

Example:

```bash
npm run agent:cli -- request location \
  --location "Whole Foods near Durham" \
  --site-class grocery \
  --workflow "shelf restocking"
```

The default response is a local dry-run packet with `contactUrl`, `inboundRequestDraft`, `missingRequiredFields`, `truthBoundaries`, and `submitInstructions`. It does not write to `/api/inbound-request`, call Stripe, run a provider, create a hosted session, grant package access, or clear rights. Direct submit is not implemented in this CLI/MCP draft tool; submit only by explicitly posting complete contact fields to `/api/inbound-request` or routing a human through `contactUrl`.

## Dry-Run Agent Commerce

Agent commerce is repo-safe by default:

- `GET /api/agent-access/commerce/quote` returns a dry-run quote for `hosted_session_rental` or `site_world_package`.
- `POST /api/agent-access/commerce/dry-run-checkout` returns a fulfilled dry-run order, receipt, and provisioned marketplace entitlement using buyer-order and marketplace-entitlement-compatible fields.
- `GET /api/agent-access/commerce/orders/:orderId` reads the dry-run receipt trail.
- `GET /api/agent-access/commerce/entitlements/:entitlementId` reads the provisioned dry-run entitlement.
- `GET /api/agent-access/commerce/entitlement-readiness` proves that the entitlement would unlock protected hosted-session launch for that site-world id.

The dry-run path never creates a live Stripe Checkout Session, payment intent, customer, charge, payout, live package delivery, or provider execution. Live payment, webhook fulfillment, rights clearance, package access, and hosted fulfillment remain owned by their normal systems.

## Live Agent Commerce (Budgeted Agents)

Agents holding a budget/wallet buy through the live commerce endpoints:

- `POST /api/agent-access/commerce/live-checkout` (MCP `blueprint.commerce.checkoutLive`, CLI `commerce checkout --mode live`) validates the request, prices the SKU server-side from the public catalog, enforces the optional `budgetCents` guard, and creates a buyer-order ledger entry plus a real Stripe Checkout Session. The response returns the Stripe checkout URL, order id, and a status URL.
- `GET /api/agent-access/commerce/live-orders/{orderId}` (MCP `blueprint.commerce.liveOrder.get`, CLI `commerce live-order`) polls a non-PII projection of the order until `paid` and `provisioned` are true.

Guardrails:

- Only pipeline-backed site worlds are live-purchasable. Sample or planned catalog profiles return a structured `not_live_purchasable` blocker that routes to dry-run commerce or request intake, so agents can never buy fake supply.
- Quotes above `budgetCents` return a `budget_exceeded` blocker and create no order, session, or charge.
- Client-supplied prices are ignored; the server-side quote is authoritative.
- A Firebase bearer token is optional: an authenticated buyer binds the entitlement to their uid, while an anonymous agent binds by the email Stripe collects at payment.
- Payment completes on the Stripe-hosted checkout page. The existing Stripe webhook marks the order paid and provisions the marketplace entitlement — the same rails as human marketplace purchases — which then unlocks `entitlement-readiness` and protected hosted-session launch.

A created live checkout is labeled `live_checkout` and proves payment intent only until Stripe reports the session paid. It never proves rights clearance, provider execution, or hosted runtime success.

## Ask (Grounded Q&A)

`GET|POST /api/agent-access/ask` (MCP `blueprint.ask`, CLI `ask`) answers agent questions about the product, search, buying with a budget, dry-run versus live commerce, the entitlement-to-session flow, pricing ranges, proof boundaries, and intake. Answers are curated citation-backed snippets over public canonical content with machine next-actions (endpoint + MCP tool), ranked by alias/lexical/embedding signals with a deterministic no-key fallback. The endpoint never generates unsupported claims and grants no access or commerce state; a `noConfidentMatch` response includes a structured human-intake fallback URL.

## Tools

- `blueprint.siteWorld.search`
- `blueprint.catalog.search` (backward-compatible alias; prefer `blueprint.siteWorld.search`)
- `blueprint.ask`
- `blueprint.request.locationDraft`
- `blueprint.siteWorld.get`
- `blueprint.siteWorld.launchReadiness`
- `blueprint.commerce.quote`
- `blueprint.commerce.checkoutDryRun`
- `blueprint.commerce.checkoutLive`
- `blueprint.commerce.order.get`
- `blueprint.commerce.liveOrder.get`
- `blueprint.commerce.entitlement.get`
- `blueprint.commerce.entitlementReadiness`
- `blueprint.session.create`
- `blueprint.session.reset`
- `blueprint.session.step`
- `blueprint.session.runBatch`
- `blueprint.session.control`
- `blueprint.session.renderExplorer`
- `blueprint.session.export`

## Smoke

```bash
npm run smoke:agent-headless
```

The default smoke runs in mock mode and exercises:

`catalog -> quote -> dry-run order -> entitlement -> entitlement readiness -> create session -> reset -> step -> run batch -> control -> explorer render -> export`

Use `tsx scripts/agent-access/headless-hosted-session-smoke.ts --mode public-demo` only when a local or preview public-demo runtime is intentionally available and provider/runtime calls are in scope.

## Truth Boundaries

- `capture_grounded` means a field is tied to capture evidence, provenance, or package records.
- `provider_derived` means a runtime/provider/adapter produced the output from the package path.
- `generated` means the artifact was produced by a hosted run or render request.
- `sample_demo` means public demo shape, not customer proof.
- `public_demo_eligible` means the public sample can exercise credential-free demo paths without representing protected customer access.
- `request_gated` means access, rights, export, or hosted availability still depends on review.
- `dry_run_order` means local/test quote, order, receipt, and entitlement proof with no live Stripe charge or live package access.
- `live_checkout` means a real Stripe Checkout Session and buyer-order ledger entry exist for a budgeted agent purchase; payment and entitlement provisioning complete only after Stripe reports the session paid, and rights/provider/runtime proof stay with their owning systems.
- `protected_robot_team` means protected hosted-session creation requires robot-team/admin auth plus a provisioned entitlement; existing protected session operations require creator ownership, admin access, or an active per-session share grant.

Protected site worlds continue through Firebase Admin verification and the existing `buyerType === "robot_team"` or admin access check. Hosted-session create/export/render/media/explorer-frame/control are not paid-entitlement-backed operational launch proof unless live Stripe, webhook, Firebase entitlement, provider/runtime, and rights systems have current evidence.
