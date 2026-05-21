# Robot-Team Agent Access

Blueprint exposes a repo-native headless access layer for robot-team agents that need to discover site worlds, inspect grounded package context, open eligible hosted sessions, manipulate scenario/start-state inputs, run rollouts, render explorer frames, and export dataset artifacts.

This layer wraps the existing `/api/site-worlds` and `/api/site-worlds/sessions` contracts. It does not create a second hosted-session runtime, entitlement path, auth stack, or product truth source.

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
npm run agent:cli -- world get siteworld-f5fd54898cfb
npm run agent:cli -- readiness --site-world-id siteworld-f5fd54898cfb
npm run agent:cli -- session create \
  --site-world-id siteworld-f5fd54898cfb \
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

Read-only tools can use public endpoints. Session/write tools require either public-demo eligibility or a scoped bearer token that resolves through the existing Firebase robot-team/admin access checks.

## Tools

- `blueprint.catalog.search`
- `blueprint.siteWorld.get`
- `blueprint.session.create`
- `blueprint.session.reset`
- `blueprint.session.step`
- `blueprint.session.runBatch`
- `blueprint.session.renderExplorer`
- `blueprint.session.export`

## Smoke

```bash
npm run smoke:agent-headless
```

The default smoke runs in mock mode and exercises:

`catalog -> readiness -> create session -> reset -> step -> run batch -> export`

Use `tsx scripts/agent-access/headless-hosted-session-smoke.ts --mode public-demo` only when a local or preview public-demo runtime is intentionally available and provider/runtime calls are in scope.

## Truth Boundaries

- `capture_grounded` means a field is tied to capture evidence, provenance, or package records.
- `provider_derived` means a runtime/provider/adapter produced the output from the package path.
- `generated` means the artifact was produced by a hosted run or render request.
- `sample_demo` means public demo shape, not customer proof.
- `request_gated` means access, rights, export, or hosted availability still depends on review.

Protected site worlds continue through Firebase Admin verification and the existing `buyerType === "robot_team"` or admin access check.
