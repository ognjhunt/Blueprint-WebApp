# Browser Use Rollout Spec

Date: 2026-04-09

Status: Proposed

Owner: `blueprint-cto`

Execution owner: `webapp-codex`

## Goal

Define a concrete, low-risk rollout plan for using Browser Use with Hermes- and Blueprint-routed agents without turning Browser Use into a new default execution layer, a new source of truth, or an org-wide default capability.

## Decision

Blueprint may use Browser Use as an optional browser backend for a small number of low-risk, browser-dependent lanes.

Blueprint will not:

- make Browser Use a default capability for every Hermes agent
- introduce Browser Use as a new source of truth or control plane
- route financial, rights-sensitive, buyer-commitment, or workspace-mutation lanes through Browser Use by default
- allow Browser Use to silently replace API, MCP, Firestore, Notion, Paperclip, or repo-file authority

The default rule remains:

1. prefer direct API, MCP, repo, and system-evidence paths
2. use browser automation only when the needed evidence is behind a UI and no safer direct path exists
3. keep browser use isolated, approval-bounded, and lane-specific

## Why This Fits Repo Doctrine

This rollout follows existing repo rules:

- AI tooling is a support layer, not an architecture override
- no new primary services may be introduced implicitly
- Paperclip remains the execution and ownership record
- Hermes memory remains supportive, not authoritative
- browser/computer-use is for UI-dependent work only when no API or MCP path exists

This also fits the current narrow-automation strategy:

- `preview_diagnosis` is already one of the repo's initial low-risk optimization lanes
- the current task system already has explicit `tool_policy` controls, including `browser_fallback_allowed` and `isolated_runtime_required`
- the current runtime already supports screenshot/log artifact capture when a task is marked `browser` or `mixed`

## External Research Notes

Research checked on 2026-04-09:

- Hermes docs say Browser Use is a supported cloud browser provider, alongside Browserbase and Firecrawl
- Browser Use's Hermes docs describe two integration patterns: cloud browser backend and CLI/skill mode
- Browser Use docs describe persistent profiles, proxy-country routing, and free-plan session limits rather than an unrestricted permanent free tier

Reference URLs:

- https://hermes-agent.nousresearch.com/docs/user-guide/features/browser/
- https://docs.browser-use.com/cloud/tutorials/integrations/hermes-agent
- https://docs.browser-use.com/open-source/customize/browser/remote

## Non-Goals

- No org-wide enablement for all Hermes agents.
- No replacement of OpenClaw, OpenAI Responses, ACP harnesses, or existing task routing.
- No expansion into buyer messaging, pricing, payouts, rights, privacy, or legal lanes.
- No use of persistent browser auth with human personal accounts.
- No production dependency on Browser Use for flows that already have stable API or MCP access.

## Rollout Shape

### Phase 0. Policy Lock

Owner: `blueprint-cto`

Deliverable:

- this rollout spec committed in `docs/`
- explicit approval that Browser Use is optional, lane-specific, and not org-wide

Acceptance criteria:

- the allow/deny scope is explicit
- guardrails are written in repo-visible form
- no text implies Browser Use is a new primary service for `Blueprint-WebApp`

### Phase 1. Manual Validation In A Sandboxed QA Lane

Owner: `webapp-codex`

Goal:

- validate that Browser Use actually helps with rendered, authenticated, or console-visible preview failures before touching production automation behavior

Allowed actors:

- `webapp-codex`
- `beta-launch-commander`
- a temporary supervised QA thread under CTO direction

Required setup:

- dedicated Browser Use profile for Blueprint preview QA only
- dedicated test credentials only
- explicit domain allowlist for Blueprint-owned staging, preview, and hosted-session surfaces
- isolated runtime environment separate from always-on manager loops

Validation tasks:

- reproduce 10 known preview or hosted-session failures that benefit from rendered browser evidence
- capture screenshot, console output, and high-signal page state for each
- compare whether browser evidence materially improves diagnosis versus the current API-only path

Acceptance criteria:

- at least 9 of 10 validation runs capture usable evidence
- median browser session duration stays under 4 minutes
- zero runs use personal credentials, customer credentials, or non-allowlisted domains
- zero write actions are taken against external systems

### Phase 2. Shadow Pilot For `preview_diagnosis`

Owner: `blueprint-cto`

Execution owner: `webapp-codex`

Goal:

- allow browser-assisted diagnosis only as a shadow or evidence-enrichment path for `preview_diagnosis`

Scope:

- `preview_diagnosis` only
- no change to the task's structured JSON output contract
- no automatic downstream action based solely on browser output

Required implementation posture:

- task remains bounded to its existing schema
- browser path is enabled only when `browser_fallback_allowed=true`
- isolated runtime is required
- screenshots/logs are attached as artifacts, not treated as authority by themselves
- primary business state still comes from repo/runtime evidence and existing queue documents

Recommended evaluation set:

- 25 historical resolved preview-diagnosis cases
- 10 live shadow runs on real preview failures
- a tagged subset of visually dependent cases where API-only evidence was weak

Acceptance criteria:

- exact-match score for `disposition` and `retry_recommended` improves by at least 10 percentage points on the visually dependent subset, or false `retry_now` recommendations drop by at least 25 percent
- no more than a 2 percentage point regression on the full preview-diagnosis corpus
- at least 80 percent of browser-assisted runs attach a usable evidence package
- session startup failure rate stays below 5 percent after one retry
- zero unauthorized writes or off-domain actions occur

### Phase 3. Limited Supervised Expansion

Owner: `blueprint-cto`

This phase is optional and should happen only after Phase 2 passes.

Candidate later lanes:

- `market-intel-agent` for read-only competitor-flow inspection
- `demand-intel-agent` for supervised SERP and landing-page research
- `city-launch-agent` for public launch-surface QA on Blueprint-owned pages

Conditions:

- read-only or reversible actions only
- explicit domain scopes per lane
- no use as the default research path when web search or direct page fetch is enough
- no rollout into always-on managerial loops

Acceptance criteria:

- 20 supervised runs per lane
- at least 85 percent operator-rated usefulness
- zero fabricated claims sourced only from browser interpretation
- zero actions on external systems beyond the approved read-only scope

## Access Matrix

### Approved In Initial Rollout

| Lane / Agent | Access | Why |
|---|---|---|
| `preview_diagnosis` | Yes, shadow-only in Phase 2 | This lane is already designated as a low-risk optimization target and often benefits from rendered evidence, console output, and screenshot proof. |
| `webapp-codex` | Yes, supervised in Phase 1 | Implementation and debugging lane; best suited to validate browser evidence quality before any wider rollout. |
| `beta-launch-commander` | Yes, supervised in Phase 1 | Launch QA is already proof- and smoke-oriented; browser evidence is a natural fit. |

### Conditionally Allowed Later

| Lane / Agent | Access | Condition |
|---|---|---|
| `market-intel-agent` | Later, read-only only | Only after preview pilot passes and only for public-site research or operator-attached tasks. |
| `demand-intel-agent` | Later, read-only only | Only for supervised discovery or objection-capture work tied to truthful wedge research. |
| `city-launch-agent` | Later, QA-only | Only for Blueprint-owned launch-surface verification. |

### Not Approved

| Lane / Agent | Access | Why not |
|---|---|---|
| `waitlist_triage` | No | Pure structured triage; browser adds cost and ambiguity without adding needed evidence. |
| `support_triage` | No | Support should stay schema-bound and fail closed; browser access increases risk around accounts and promises. |
| `inbound_qualification` | No | This is classification and drafting work, not browser work. |
| `post_signup_scheduling` | No | Real scheduling actions must stay in controlled business logic and human-gated systems. |
| `payout_exception_triage` | No | Financial lane; browser access is unnecessary and too risky. |
| `blueprint-chief-of-staff` | No default access | The manager loop should route work, not become a persistent browser actor. |
| `ops-lead` | No default access | Same reason as chief of staff; keep manager loops out of always-on authenticated browsing. |
| `growth-lead` | No default access | Strategy and routing lane, not a browser-execution default. |
| `notion-manager-agent` | No | Workspace reconciliation should use Notion surfaces directly, not browser mutation. |
| `investor-relations-agent` | No | Drafting lane; browser auth and persistent sessions are unnecessary. |
| rights, pricing, buyer-solution, finance, and compliance lanes | No | These lanes involve commitments or regulated sensitivity and must not rely on browser automation. |

## Guardrails

### 1. Browser Is Fallback, Not Default

- Browser Use may be used only when direct API, MCP, repo, or runtime evidence is insufficient.
- If a stable direct integration exists, it wins.

### 2. Isolated Runtime Required

- Approved Browser Use lanes must run in an isolated runtime.
- Always-on management loops and unrelated agent sessions must not share the same authenticated browser profile.

### 3. Dedicated Profiles Only

- Use dedicated Blueprint-controlled test profiles such as:
  - `blueprint-preview-qa`
  - `blueprint-growth-research`
- Do not use founder, employee personal, buyer, or customer production accounts.

### 4. Domain Allowlists Are Mandatory

- Every enabled lane must have an explicit allowlist.
- No wildcard browsing across the public web in production automation lanes.
- Phase 1 and Phase 2 should stay limited to Blueprint-owned or operator-approved domains.

### 5. Read-Only By Default

- Initial rollout is read-only or evidence-capture only.
- No email sends, Slack sends, Notion mutations, payments, refunds, contract acceptance, or entitlement changes through browser automation.
- Any future write action would require a separate CTO-approved decision document.

### 6. Human Gates Stay In Place

- Browser evidence may inform a decision, but it does not remove existing review requirements.
- Any run that touches release risk, buyer commitments, rights, policy, or pricing still follows the existing human-review gates.

### 7. Artifact Retention And Auditability

- Keep screenshots, text summaries, logs, and any session metadata required for operator review.
- Browser artifacts are evidence attachments, not new source-of-truth records.
- Evidence should remain tied back to the existing task run, issue, or queue item.

### 8. Bounded Time And Cost

- Cap default browser session duration at 6 minutes for pilot lanes.
- Keep one active browser session per approved lane unless the CTO explicitly approves more.
- If the browser backend is unavailable, the task must fail closed or continue via its non-browser path; it must not silently widen scope.

### 9. No Silent Capability Spread

- Enabling Browser Use for one lane does not authorize its use elsewhere.
- Each additional lane requires an explicit change to the lane's task policy plus a repo-visible approval note.

## Required Success Metrics

### Safety Metrics

- 0 unauthorized external writes
- 0 uses of personal or customer credentials
- 0 runs outside approved domain allowlists
- 0 cases where browser evidence overrides a required human gate

### Operational Metrics

- browser session startup success rate >= 95 percent after one retry
- median session duration < 4 minutes in pilot use
- at least 80 percent of browser-assisted runs produce an evidence package judged usable by an operator

### Quality Metrics For `preview_diagnosis`

- improvement on visually dependent preview failures without regressing the full corpus materially
- fewer false `retry_now` recommendations on provider- or artifact-side failures
- better operator confidence in `next_action` and `internal_summary`

### Expansion Metrics

- no expansion beyond `preview_diagnosis` until two consecutive review windows meet the safety and operational metrics above
- any later lane must show operator-rated usefulness >= 85 percent in supervised trials

## Implementation Hooks In The Current Repo

This rollout can be implemented against the current repo shape without changing product truth boundaries:

- `server/agents/types.ts`
  - task-level `tool_policy` already supports `browser_fallback_allowed` and `isolated_runtime_required`
- `server/agents/policies.ts`
  - default policy already keeps browser fallback off
- `server/agents/tasks/preview-diagnosis.ts`
  - current schema is already narrow and should remain unchanged
- `server/agents/runtime.ts`
  - artifact capture already includes screenshots for `browser` and `mixed` tool modes
- `docs/openclaw-deployment.md`
  - existing execution sidecar contract already supports tool and artifact policy fields

Recommended implementation order:

1. keep the existing `preview_diagnosis` JSON schema unchanged
2. add an opt-in browser-assisted execution path only for the preview lane
3. require explicit allowlists, isolated runtime, and dedicated profiles
4. run shadow evaluations first
5. promote only if the success metrics pass

## Explicit Decision Rule

If a future change asks, "Should this Hermes agent get Browser Use access?", the default answer is no unless all are true:

1. the lane is low-risk and browser-dependent
2. no stable API, MCP, or repo-native path gives equivalent evidence
3. the lane has an explicit allowlist and isolated runtime
4. the lane has a written evaluation plan and success metrics
5. `blueprint-cto` approves the rollout in repo-visible form

Absent those conditions, Browser Use should not be enabled for that lane.
