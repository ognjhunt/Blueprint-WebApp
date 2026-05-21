# Robot-Team Agent Access

Blueprint exposes a repo-native headless access layer for robot-team agents that need to discover site worlds, inspect grounded package context, open eligible hosted sessions, manipulate scenario/start-state inputs, run rollouts, render explorer frames, and export dataset artifacts.

This layer wraps the existing `/api/site-worlds`, `/api/site-worlds/search`, `/api/site-worlds/sessions`, buyer-order, and marketplace-entitlement shapes. The dry-run agent commerce route creates quote, order, receipt, and entitlement proof without calling live Stripe or granting live package access. It does not create a second hosted-session runtime, auth stack, or product truth source.

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
npm run agent:cli -- catalog list --limit 3
npm run agent:cli -- catalog search --q "whole foods" --limit 5
npm run agent:cli -- catalog search --q "warehouse tote" --limit 5
npm run agent:cli -- world get siteworld-f5fd54898cfb
npm run agent:cli -- commerce quote --site-world-id siteworld-f5fd54898cfb --product hosted-session-rental --session-hours 1
npm run agent:cli -- commerce checkout --site-world-id siteworld-f5fd54898cfb --product hosted-session-rental --mode dry_run
npm run agent:cli -- commerce order <dry-order-id>
npm run agent:cli -- commerce entitlement <dry-entitlement-id>
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

JSON is the default output. Add `--format text` only for human terminal output.

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

Read-only tools can use public endpoints. Session/write tools require either public-demo eligibility or a scoped bearer token that resolves through the existing Firebase robot-team/admin access checks. Protected non-demo session create also requires a provisioned hosted-session entitlement; protected session operations require admin access, session ownership, or a matching provisioned entitlement.

## Catalog Search

Use `GET /api/site-worlds/search` when an agent does not know the exact site-world id. The endpoint accepts `q`, `limit`, `category`, `industry`, `city`, `state`, `siteType`, `taskLane`, `objectTags`, `robot`, `availability`, `readiness`, and `sort`.

Search is deterministic without `OPENAI_API_KEY`. When embeddings are unavailable, responses include `embeddings_unavailable` and rank by alias, lexical, location, task/object/robot, availability, and readiness signals. Queries such as `store`, `supermarket`, `Whole Foods`, `Kroger`, `retail aisle`, and `warehouse tote` return close catalog matches with `score`, `reasons`, `matchedAliases`, and `matchedFields`.

Brand aliases are only ontology hints. A `Whole Foods` query may return the closest grocery/retail site-world, but it does not imply Blueprint has a real Whole Foods package or partner-cleared availability.

## Dry-Run Agent Commerce

Agent commerce is repo-safe by default:

- `GET /api/agent-access/commerce/quote` returns a dry-run quote for `hosted_session_rental` or `site_world_package`.
- `POST /api/agent-access/commerce/dry-run-checkout` returns a fulfilled dry-run order, receipt, and provisioned marketplace entitlement using buyer-order and marketplace-entitlement-compatible fields.
- `GET /api/agent-access/commerce/orders/:orderId` reads the dry-run receipt trail.
- `GET /api/agent-access/commerce/entitlements/:entitlementId` reads the provisioned dry-run entitlement.
- `GET /api/agent-access/commerce/entitlement-readiness` proves that the entitlement would unlock protected hosted-session launch for that site-world id.

The dry-run path never creates a live Stripe Checkout Session, payment intent, customer, charge, payout, live package delivery, or provider execution. Live payment, webhook fulfillment, rights clearance, package access, and hosted fulfillment remain owned by their normal systems.

## Tools

- `blueprint.catalog.search`
- `blueprint.siteWorld.get`
- `blueprint.siteWorld.launchReadiness`
- `blueprint.commerce.quote`
- `blueprint.commerce.checkoutDryRun`
- `blueprint.commerce.order.get`
- `blueprint.commerce.entitlement.get`
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
- `request_gated` means access, rights, export, or hosted availability still depends on review.
- `dry_run_order` means local/test quote, order, receipt, and entitlement proof with no live Stripe charge or live package access.
- `protected_robot_team` means protected hosted-session access requires robot-team/admin auth plus session ownership or a matching provisioned entitlement.

Protected site worlds continue through Firebase Admin verification and the existing `buyerType === "robot_team"` or admin access check. Hosted-session create/export/render/media/explorer-frame/control are not paid-entitlement-backed operational launch proof unless live Stripe, webhook, Firebase entitlement, provider/runtime, and rights systems have current evidence.
