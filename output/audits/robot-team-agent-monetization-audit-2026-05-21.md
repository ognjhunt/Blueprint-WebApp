# Robot-Team Agent Monetization Audit

Date: 2026-05-21
Repo: `/Users/nijelhunt_1/workspace/Blueprint-WebApp`

## Verdict

| Area | Verdict | Reason |
| --- | --- | --- |
| Agent-first discovery ready | Mostly ready | `/agents`, `/llms.txt`, `/llms-full.txt`, `/api/site-content`, `/agent-access.openapi.json`, `/api/agent-access/openapi.json`, and sitemap discovery all resolve locally. The header primary nav still does not promote `/agents`, but machine-readable discovery does not require guessing. |
| Contract ready | Partial | The hosted-session contract is generated, served, and consistent across public/docs/dist artifacts. It does not include checkout, order, payment, billing, purchase, or entitlement endpoints. |
| CLI ready | Partial | The CLI can call discovery, catalog, world detail, readiness, create/read/reset/step/run-batch/control/explorer-render/export. It has no command to buy data, rent/host a session, inspect billing limits, create checkout, poll receipt, or prove entitlement after payment. |
| MCP ready | Not for the full happy path | The MCP server exposes catalog, site-world get, session create/reset/step/runBatch/renderExplorer/export. It omits launch-readiness and control despite those being part of the documented happy path, and it has no commerce or entitlement tools. |
| Monetized end-to-end ready | No | The agent path never enters Stripe checkout or marketplace entitlement provisioning. Hosted-session access is gated by Firebase buyerType/admin plus launchability, not a paid entitlement or order grant. |

Bottom line: an external AI agent can discover the public robot-team agent surface and inspect the hosted-session API shape. It cannot truly rent/host a session or buy data for its team end-to-end today without human/browser checkout and an out-of-band entitlement path.

## Evidence Table

| Evidence | Result |
| --- | --- |
| `git status --short` at start | Clean output. No unrelated work detected before audit. |
| `AGENTS.md` and read-first files | Public launch-ready can be polished, but operational launch-ready claims require owning-system proof. Command safety matrix allows local `check`, build, and dry-run/mock smokes; live Stripe/provider mutation is not allowed. |
| `graphify-out/GRAPH_REPORT.md` | Hosted-session and site-world disclosure nodes are central; `ensureLaunchAccess`, `createSessionRecord`, `readFreshHostedSession`, and launch-readiness helpers are high-impact surfaces. |
| `client/src/app/routes.tsx:146` | `/for-robot-teams` now serves `ForRobotIntegrators`; stale prior route gap is fixed. |
| `client/src/app/routes.tsx:152` | `/agents` is a public route. |
| `client/src/components/site/navigation.ts:1` and `:15` | Header primary nav has Product, Robot teams, World models, Capture, Proof, Pricing; footer product links include `/agents`. |
| `client/public/llms.txt:16` and `client/public/llms-full.txt:96` | LLM maps expose `/agents`, `/api/site-content`, and agent OpenAPI contract paths. |
| `server/routes/site-content.ts:76` and `:165` | `/api/site-content` lists `/agents` and machine-readable files including llms, full llms, OpenAPI, sitemap, robots. |
| `server/utils/robot-agent-contract.ts` plus generated JSON | OpenAPI includes hosted-session lifecycle paths but no commerce path. `jq` path scan for checkout/payment/stripe/entitlement/order/purchase/price/billing returned `[]`. |
| `client/public/agent-access.openapi.json`, `docs/agent-access/agent-access.openapi.json`, `dist/public/agent-access.openapi.json` | `cmp` public-vs-docs and public-vs-dist both returned `0` after `npm run agent:contract` and build. |
| `docs/agent-access/robot-team-agent-access.md:54` | Docs list MCP tools but omit `blueprint.session.control`; they also do not list readiness as an MCP tool. |
| `scripts/agent-access/blueprint-mcp-server.ts:41` | MCP exposes 8 tools: catalog/search, siteWorld/get, create/reset/step/runBatch/renderExplorer/export. No readiness, control, payment, entitlement, billing, order, or receipt tool. |
| `scripts/agent-access/agent-api-client.ts:167` | API client supports discovery/catalog/detail/readiness/session lifecycle/control/render/export. No checkout/payment/entitlement client methods. |
| `scripts/agent-access/headless-hosted-session-smoke.ts:98` | Default smoke is mock mode. It runs catalog, readiness, create, reset, step, runBatch, export. It omits payment, control, explorer render, and real provider proof. |
| `server/routes/site-world-sessions.ts:134` | Protected hosted-session access resolves to Firebase Admin token, then admin or `buyerType === "robot_team"`. It returns `entitled: true` from buyer type, not from a paid order or Stripe entitlement. |
| `server/routes/site-world-sessions.ts:3027` | Protected session creation calls `ensureLaunchAccess`, validates launchability, and creates runtime sessions. No Stripe/order/entitlement id is required in the request body. |
| `server/routes/site-world-sessions.ts:3541` and `:3624` | Protected `render`, `media`, and `explorer-frame` are behind Firebase middleware at the route mount, but do not call `ensureLaunchAccess` themselves. This is weaker than the robot_team/admin check on mutations/export. |
| `server/routes/api/create-checkout-session.ts:411` | Marketplace checkout drafts `buyerOrders`, creates Stripe Checkout, and returns `sessionUrl`. This route is not included in the agent OpenAPI, CLI, MCP, or smoke. |
| `server/utils/accounting.ts:657` | Stripe webhook completion can mark buyer orders paid and create `marketplaceEntitlements`. |
| `server/routes/marketplace-entitlements.ts:72` | Current entitlement lookup is Firebase-protected and returns provisioned marketplace access by buyer user/SKU. Hosted-session launch does not read this entitlement. |
| `client/src/hooks/useStripeCheckout.ts:51` | Human UI marketplace checkout posts to `/api/create-checkout-session` and redirects the browser to Stripe. No headless agent checkout path exists. |
| `client/src/pages/SiteWorldDetail.tsx:1008` and `:1041` | Site-world page truthfully frames package and hosted access as request-scoped and checked before launch. It is not a direct buy/rent path. |
| `client/src/pages/Pricing.tsx:95` | Pricing lists package and hosted review ranges, but CTAs route to contact/request, not agent checkout. |
| Local route probe on `PORT=5123` | `/agents`, llms files, `/api/site-content`, OpenAPI routes, sitemap, catalog all returned 200. OpenAPI route reported 14 paths and `hasCheckout=false`. Public-demo readiness returned 200 with `launchable=false`, `entitled=true`, `blockers=2`. `/api/marketplace/entitlements/current` returned 401 without auth. `/api/create-checkout-session` returned 403 without CSRF/auth. |
| `npm run check` | Passed. |
| Targeted Vitest | Passed 7 files, 34 tests: robot-agent contract, CLI, MCP, headless smoke, marketplace entitlement/checkout metadata, site-world sessions. No `Agents` page test file exists under `client/src`. |
| `npm run agent:contract` | Passed and rewrote public/docs OpenAPI with no git diff. |
| `npm run smoke:agent-headless` | Passed in mock mode only. Session id was `mock-session-1`; export URI was mock-shaped evidence, not real export proof. |
| `npm run build` | Passed. Vite emitted the existing Spark WASM dynamic URL warning and bundle-size warnings. |

Note: the first local dev attempt failed because port `5000` was already occupied and returned 403s from the existing listener. A temporary dev server on `5123` was used for route probes and stopped afterward. Despite attempted automation-disable env vars, local waitlist and inbound-qualification workers logged one run each with `processedCount: 0` and `failedCount: 0`; no live Stripe, provider, email, Notion, Paperclip, or deployment action was performed.

## End-to-End Journey Map

1. Discovery: an agent can find Blueprint through `/llms.txt`, `/llms-full.txt`, `/api/site-content`, `/agents`, sitemap, and OpenAPI links.
2. Catalog discovery: `GET /api/site-worlds?limit=...` returns public site-world listings.
3. Site-world detail: `GET /api/site-worlds/{siteWorldId}` returns the public catalog detail, task/scenario/start-state catalogs, proof labels, and package context.
4. Launch/readiness inspection: `GET /api/site-worlds/sessions/launch-readiness?siteWorldId=...` exists in the API client, CLI, OpenAPI, and smoke, but not as an MCP tool.
5. Auth: protected flows require a Firebase bearer token. `verifyFirebaseToken` requires `Authorization: Bearer ...`; hosted-session access then requires admin or Firestore user profile `buyerType === "robot_team"`.
6. Hosted-session create: `POST /api/site-worlds/sessions` can create a public-demo session only for public-demo site worlds, or a protected session for robot_team/admin users. It requires launchability but not payment, order id, checkout session id, marketplace entitlement id, SKU, or license grant.
7. Session operations: reset, step, run-batch, control, explorer-render, render/media/frame, and export exist at server level. CLI covers control and explorer-render; MCP lacks control and readiness; smoke lacks control and explorer-render.
8. Payment path: the only traced real Stripe path is `/api/create-checkout-session`, used by browser UI flows. It requires CSRF and Firebase auth, creates `buyerOrders`, calls Stripe Checkout, and expects Stripe webhook completion.
9. Entitlement grant: Stripe webhook completion can create `marketplaceEntitlements`. `GET /api/marketplace/entitlements/current` can return provisioned access for a buyer/SKU. Hosted-session launch does not consult this collection.
10. Access proof after payment: marketplace entitlement access is separate from hosted-session export/session proof. There is no single agent-visible receipt path that proves `paid order -> entitlement -> hosted session or export artifact`.

## Gap Matrix

| Blocker | Owner System | Proof Path | Severity | Exact Next Fix |
| --- | --- | --- | --- | --- |
| No agent-facing checkout/payment/order endpoint in OpenAPI, CLI, MCP, or docs | WebApp agent-access + Stripe checkout | OpenAPI path scan returned no commerce paths; API client/MCP/CLI have no purchase methods | P0 | Add a repo-safe agent commerce contract for quote/create-checkout/read-order/read-entitlement in test/dry-run first. Do not call live Stripe in smoke. |
| Hosted-session access is buyerType/admin, not paid entitlement-backed | WebApp hosted-session auth + entitlement bridge | `ensureLaunchAccess` returns `entitled: true` for admin or `buyerType === "robot_team"` | P0 | Require a provisioned hosted-session entitlement or explicit internal/demo bypass for protected non-demo session creation/export; keep robot_team/admin as an outer gate, not the entitlement itself. |
| Data/package marketplace entitlement is separate from site-world/session exports | WebApp marketplace entitlements + site-world catalog | `marketplaceEntitlements/current` resolves by SKU; site-world sessions never read it | P0 | Map site-world package SKUs and hosted-session rental SKUs to entitlement records and expose the mapping in site-world detail and agent contract. |
| No headless-safe payment test/demo mode | WebApp Stripe adapter/testing | Smoke is mock only; local checkout route rejects without CSRF/Firebase; no dry-run checkout command | P0 | Add deterministic test-mode commerce smoke that stubs Stripe behind the route boundary and proves order/entitlement/session linkage without card/provider spend. |
| MCP omits launch-readiness and session control | Agent MCP server | `BLUEPRINT_MCP_TOOLS` lacks readiness/control; docs tool list also lacks control | P1 | Add `blueprint.siteWorld.launchReadiness` and `blueprint.session.control`; update docs/tests. |
| Smoke omits control and explorer render | Agent smoke | `headless-hosted-session-smoke.ts` steps stop at export after runBatch | P1 | Extend mock smoke to cover control and explorer render, then add a separate public-demo smoke that is explicitly allowed only when a local demo runtime is available. |
| Protected render/media/explorer-frame do not call buyerType/admin gate | Hosted-session routes | `render`, `media`, and `explorer-frame` load session and proxy without `ensureLaunchAccess` | P1 | Add `ensureLaunchAccess` plus session owner/entitlement checks for render/media/frame and add regression tests for non-robot-team authenticated users. |
| Session ownership is not checked on protected session operations | Hosted-session authorization | Protected operations call `ensureLaunchAccess`, then load arbitrary `sessionId` | P1 | Require session creator, admin, or paid/team entitlement for every protected session id, not only buyerType. |
| Public-demo readiness is not launchable locally | Hosted demo runtime/artifacts | Local route probe returned `launchable=false`, `blockers=2` for public demo readiness | P2 | Keep public demo separate from monetization. Fix public-demo runtime/artifact blockers only if demo execution is part of the next goal. |
| `/agents` is machine-discoverable but not header-primary | Public navigation | Footer and machine maps include `/agents`; primary nav does not | P3 | Add a restrained header or secondary nav affordance only if public agent acquisition is a primary route goal. |

## Benchmark Notes

Primary sources inspected:

- [Higgsfield MCP](https://higgsfield.ai/mcp)
- [Higgsfield MCP Hermes tab](https://higgsfield.ai/mcp?tab=hermes)
- [Parallel Search MCP blog](https://parallel.ai/blog/search-mcp-server)
- [Parallel Search MCP docs](https://docs.parallel.ai/integrations/mcp/search-mcp)
- [Parallel free web search MCP blog](https://parallel.ai/blog/free-web-search-mcp)
- [OpenAI Agents SDK evolution](https://openai.com/index/the-next-evolution-of-the-agents-sdk/)
- [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Cursor TypeScript SDK](https://cursor.com/blog/typescript-sdk)

| Source | What Blueprint should copy | What Blueprint should avoid or adapt |
| --- | --- | --- |
| Higgsfield | Agent-specific setup tabs, remote MCP URL, sign-in based auth, explicit billing tools for balance/transactions/plans, workspace-scoped tools, and async generation semantics. | Do not make credit spend feel generic. Blueprint needs site-world, rights, provenance, and runtime limits attached to every paid action. |
| Parallel | A free anonymous endpoint for exploration, an authenticated endpoint/API-key path for higher limits, client-specific install snippets, tiny tool surface, and clear 401/402/balance guidance. | Avoid letting anonymous demo behavior blur into paid or protected access. Blueprint should keep public-demo access narrow and label it as sample only. |
| OpenAI Agents SDK | Standard primitives around MCP, skills, AGENTS.md, shell/apply-patch style tooling, sandbox-aware orchestration, and long-running agent harnesses. | Do not claim readiness from an SDK-shaped wrapper alone. Blueprint still needs domain proof: payment, entitlement, provider/runtime, and export artifacts. |
| Claude Agent SDK | Quickstart-first docs, built-in tools, hooks, subagents, MCP, permissions, and sessions surfaced as agent lifecycle concepts. | Blueprint should expose permission and session state as first-class agent resources, not bury them in human page copy. |
| Cursor TypeScript SDK | Programmatic TypeScript SDK, sample projects, CLI pattern, cloud/sandbox framing, and explicit token-based billing. | Blueprint should not mirror generic token billing. Use site/package/session-hour/SKU units that map to Stripe orders and entitlements. |

Blueprint already matches the discovery pattern better than many ordinary public sites because it has `/llms.txt`, `/llms-full.txt`, `/api/site-content`, generated OpenAPI, CLI, and MCP. It does not yet match the monetized-agent pattern because it lacks billing/spend tools, quote/payment endpoints, receipt polling, and entitlement proof.

## Earliest Hard Blocker

The earliest hard blocker is missing agent-commerce contract wiring.

An external robot-team agent reaches the agent OpenAPI/CLI/MCP surface before it ever sees a way to pay. The served agent contract has no checkout/payment/order/entitlement path; the CLI/MCP have no buy/rent/quote/receipt commands; `/agents` explains auth and sessions but not machine payment; and hosted-session creation does not require a paid entitlement. Because of that, the first blocker is not Stripe configuration, Firebase token setup, hosted-session runtime, provider execution, or export artifact availability. Those matter downstream, but the agent cannot even choose a paid product and enter a safe checkout/entitlement flow from the agent contract today.

Owner system: WebApp agent-access plus Stripe marketplace entitlement bridge.

Proof path: `client/public/agent-access.openapi.json`, `scripts/agent-access/agent-api-client.ts`, `scripts/agent-access/blueprint-mcp-server.ts`, `server/routes/api/create-checkout-session.ts`, `server/utils/accounting.ts`, `server/routes/marketplace-entitlements.ts`, `server/routes/site-world-sessions.ts`.

## Follow-Up Implementation Goal

```text
/goal Implement the first repo-safe robot-team agent commerce bridge.

Work in /Users/nijelhunt_1/workspace/Blueprint-WebApp. Read AGENTS.md and required doctrine first. Preserve dirty work. Do not create live Stripe charges, mutate live products/prices, deploy, send emails, mutate Notion/Paperclip production, or spend provider money.

Objective: add a test/dry-run agent commerce contract that lets a robot-team agent quote a site-world package or hosted-session rental, create a dry-run checkout/order, inspect the resulting entitlement, and prove whether that entitlement would unlock hosted-session create/export. Keep existing Firebase robot_team/admin checks. Do not weaken protected access.

Required fix scope:
- Add agent-access OpenAPI paths and generated JSON for quote/order/entitlement proof in dry-run/test mode.
- Add CLI commands for quote, checkout dry-run, entitlement read, and entitlement-gated readiness.
- Add MCP tools for readiness, control, quote, checkout dry-run, and entitlement read.
- Add server-side dry-run adapter that does not call live Stripe but exercises the same buyerOrders/marketplaceEntitlements shape.
- Add hosted-session entitlement lookup behind buyerType/admin for protected non-demo create/export, with explicit public-demo/internal bypass labels only.
- Add regression tests that non-robot-team Firebase users cannot render/media/explorer-frame or use another team session id.

Verification:
- npm run check
- targeted Vitest for agent contract, CLI, MCP, smoke, marketplace entitlement, checkout fulfillment, and site-world sessions
- npm run agent:contract
- npm run smoke:agent-headless in mock/dry-run commerce mode
- local route probes for /agents, llms, OpenAPI, quote/order/entitlement routes

Stop and report the first hard blocker if a required Stripe/Firebase/runtime proof would require live credentials, live card use, provider spend, deployment, or production mutation.
```
