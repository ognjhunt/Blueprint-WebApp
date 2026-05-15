# Refactor Hotspots

Date: 2026-05-14

Purpose: list the biggest AI-unfriendly files and safe future decomposition slices without changing product behavior in this orientation pass.

Line counts are from a local `wc -l` scan on 2026-05-14. Generated reports, test files, package locks, and deep-research report bodies are excluded from the main hotspot interpretation.

## Highest-Risk Navigation Hotspots

| File | Lines | Responsibility | Why it is AI-unfriendly | Safe future slices |
|---|---:|---|---|---|
| `ops/paperclip/plugins/blueprint-automation/src/worker.ts` | 16,781 | Paperclip plugin worker, event handling, issue/routine actions, external routing, human-blocker/autonomy glue. | Extremely broad blast radius, live control-plane side effects, many event families in one file, hard to reason about ownership and idempotency. | Split by event family into `issue-events`, `routine-events`, `human-blockers`, `runtime-events`, and `provider-health` modules. First extract pure payload builders and validators with tests before moving dispatch logic. |
| `server/utils/cityLaunchExecutionHarness.ts` | 4,804 | City-launch activation, artifact writing, Paperclip issue dispatch, buyer/supply/GTM packaging. | Crosses planning, policy, artifact, Paperclip, scorecard, and launch readiness concerns. Changes can alter launch claims or dispatch behavior. | Extract artifact writers, budget/policy summaries, Paperclip dispatch builders, and certification summaries behind existing tests. Keep the top-level orchestration function stable. |
| `client/src/data/content.ts` | 4,410 | Large public content registry. | Mixed product copy, route content, legacy content, and proof/marketing text in one large module. Easy to create doctrine drift or duplicate outdated claims. | Split by public surface: home/product, proof, support, capture, pricing, legacy redirects. Keep exported names stable or add a compatibility barrel. |
| `server/routes/site-world-sessions.ts` | 3,689 | Hosted-session creation, loading, runtime proxying, demo/runtime readiness, media/frame serving. | Graphify hotspot with many high-connectivity helpers. It mixes public and authenticated session paths, runtime proxy behavior, readiness diagnostics, and file/media handling. | Extract pure readiness/diagnostic builders first, then runtime proxy helpers, then presentation/demo session helpers. Preserve route signatures and test with `server/tests/site-world-sessions.test.ts`. |
| `client/src/pages/AdminLeads.tsx` | 3,327 | Admin request/submission review UI. | Large component with many admin states and request actions; UI state and domain rules are hard to separate. | Extract request-state panels, pipeline attachment panels, action toolbar, and filters as components. Keep data fetching and mutation hooks stable during first split. |
| `client/src/pages/HostedSessionWorkspace.tsx` | 3,266 | Hosted-session workspace UI, runtime controls, diagnostics, export/actions. | Dense user-facing runtime UI connected to graphify hosted-session hotspots; easy to break controls or layout while moving code. | Extract keyboard/control intent, diagnostics panel, export/actions panel, and runtime status header. Use Playwright/browser verification for visual/session changes. |
| `server/agents/runtime.ts` | 2,922 | Agent runtime execution and provider/harness orchestration. | Central to autonomous org behavior and provider fallback. Mistakes can alter cost, completion, retries, or closeout semantics. | Extract provider invocation adapters, run event emission, prompt/context assembly, and result normalization with focused tests. Do not change fallback policy while splitting. |
| `server/routes/admin-leads.ts` | 2,841 | Admin leads API and request management. | Broad admin API surface with request state, pipeline, review, and action queue concerns. | Extract request lookup/serialization, action queue handlers, pipeline attachment helpers, and auth/admin guard utilities. |
| `client/src/pages/Dashboard.tsx` | 2,677 | Buyer/user dashboard. | Large UI surface with mixed account, request, onboarding, and product state. | Extract account summary, request list, onboarding progress, and product CTA sections. Verify protected-route behavior. |
| `client/src/components/admin/AdminAgentConsole.tsx` | 2,569 | Admin agent console UI. | Combines agent runtime state, controls, logs, and UI presentation in one component. | Extract run list, event log, action forms, and status summary components. Keep API client shape unchanged. |

## Secondary Hotspots

- `client/src/pages/AdminGrowthStudio.tsx` (2,181): split Growth Studio views and Notion/sync panels.
- `client/src/pages/OffWaitlistSignUpFlow.tsx` (2,150), `client/src/pages/Onboarding.tsx` (2,081), `client/src/pages/OutboundSignUpFlow.tsx` (2,071): split multi-step flows by step and validation helpers.
- `ops/paperclip/plugins/blueprint-automation/src/notion.ts` (1,802): isolate Notion payload mapping from API calls and retry behavior.
- `server/utils/site-worlds.ts` (1,720): split fixture/demo fallback resolution, Firestore listing reads, pipeline artifact normalization, and explorer asset resolution.
- `server/routes/admin-growth.ts` (1,706): split webhook handling, Growth Studio routes, and reporting helpers.

## Prioritized Follow-Up Plan

### P1. Hosted-session readiness extraction

- First safe slice: extract pure diagnostic/readiness builders from `server/routes/site-world-sessions.ts` into a server utility module without changing route registration, auth, response shape, or runtime proxying.
- Tests: run `server/tests/site-world-sessions.test.ts` and `npm run check`; add focused unit coverage for any extracted pure helpers if current tests do not cover the moved logic.
- Stop rule: do not move proxy/file-serving side effects in the first slice.

### P1. Paperclip worker payload builders

- First safe slice: extract pure issue/routine payload builders from `ops/paperclip/plugins/blueprint-automation/src/worker.ts` behind existing behavior.
- Tests: add or run focused plugin tests around the extracted builders, then run `scripts/paperclip/validate-agent-kits.sh`.
- Stop rule: do not change live dispatch, routine wake, human-blocker, or provider-health side effects in the first slice.

### P2. Site-world disclosure content split

- First safe slice: split `client/src/data/content.ts` by public surface while preserving exported names through a compatibility barrel.
- Tests: run `npm run check`; run targeted page/component tests if available; use browser verification for affected public pages.
- Stop rule: do not rewrite public product meaning while moving data.

### P2. Admin leads UI component extraction

- First safe slice: extract request-state display panels from `client/src/pages/AdminLeads.tsx` without changing data fetching, mutation hooks, or API calls.
- Tests: run `npm run check`; run targeted admin UI tests if present.
- Stop rule: do not alter request-state transitions or pipeline attachment actions.

### P3. Agent runtime provider adapter split

- First safe slice: extract provider invocation normalization from `server/agents/runtime.ts` with existing fallback behavior preserved.
- Tests: run the narrow runtime tests for provider/fallback behavior, then `npm run check`.
- Stop rule: do not change model routing, retry policy, cost accounting, or closeout semantics in the first slice.

## Refactor Rules For Future Work

- Do not split a large runtime file just because it is large. Split only when the first slice is mechanical, covered by tests, and reduces navigation risk.
- Prefer extracting pure functions and payload builders before moving side-effecting dispatch or route registration code.
- Keep public route paths, API response shapes, Firestore field names, and Paperclip issue/routine contracts stable unless the task explicitly changes a contract.
- Add or run targeted tests for the exact behavior moved. For hosted-session slices, include `server/tests/site-world-sessions.test.ts`. For city-launch slices, include relevant `server/tests/city-launch-*.test.ts`. For Paperclip plugin slices, add focused plugin tests before moving side-effecting code.
- Update `docs/architecture/ai-onboarding-map.md` after successful structural refactors so agents do not keep navigating through obsolete hotspots.
