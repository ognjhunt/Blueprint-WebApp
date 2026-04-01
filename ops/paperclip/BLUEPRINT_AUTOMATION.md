# Blueprint Paperclip Automation

## What This Adds

Blueprint now has three layers working together inside Paperclip:

1. A stronger company package with explicit executive and repo-specialist issue-management behavior.
2. A Hermes-backed `blueprint-chief-of-staff` loop that runs every 5 minutes and also wakes on issue, routine, queue, and failure signals.
3. A Blueprint-specific plugin at `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/plugins/blueprint-automation`.
4. Bootstrap, configure, verify, and smoke scripts that provision the plugin, secret refs, and automation checks on a persistent trusted host.

The automation loop is deliberately grounded in real repo state and truthful product doctrine:

- repo drift comes from actual local workspaces attached to Paperclip projects
- CI failures come from real webhook or polling signals
- issue creation, dedupe, blocker follow-up, and resolution happen as actual Paperclip issues
- executive routines are instructed to manage issue lifecycle explicitly rather than narrate status
- chief-of-staff wakeups and major task/delegation changes are mirrored into Slack when webhook targets exist
- Codex remains the implementation default while Claude stays the executive/review lane and Hermes powers selected research/copilot/summary agents on this host

## Architecture

### Company package

- `ceo-daily-review` is the executive prioritization loop.
- `chief-of-staff-continuous-loop` is the 24/7 managerial loop.
- `cto-cross-repo-triage` is the cross-repo technical orchestration loop.
- Repo implementation and review loops are instructed to work from actual Paperclip issues, create blocker follow-up issues, and close or reprioritize issues explicitly.
- `blueprint-executive-ops` is the cross-repo / operator project for executive and blocker work.
- `*-codex` agents stay on `codex_local` for implementation work.
- `blueprint-chief-of-staff`, `notion-manager-agent`, `revenue-ops-pricing-agent`, `ops-lead`, `growth-lead`, `analytics-agent`, `investor-relations-agent`, `community-updates-agent`, `market-intel-agent`, `supply-intel-agent`, `capturer-growth-agent`, `city-launch-agent`, `demand-intel-agent`, `robot-team-growth-agent`, `site-operator-partnership-agent`, `city-demand-agent`, `buyer-solutions-agent`, `solutions-engineering-agent`, `security-procurement-agent`, `capturer-success-agent`, `site-catalog-agent`, `outbound-sales-agent`, and `buyer-success-agent` run on `hermes_local`.
- Hermes-backed agents are configured for Codex OAuth only. Do not assume Anthropic/OpenAI API-key routing for them on this host.
- `blueprint-ceo`, `blueprint-cto`, and the `*-claude` review agents are now controlled by `BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE`, which supports `claude`, `codex`, and `auto`.
- In `auto`, reconcile probes the Claude adapter and flips only the executive/review lane to `codex_local` when Claude is unavailable, then flips back on a later maintenance pass when Claude is healthy again.
- For immediate operator control, run `scripts/paperclip/switch-blueprint-paperclip-lanes.sh auto|claude|codex`.

### Blueprint plugin

The plugin key is `blueprint.automation`.

It provides:

- scheduled repo scans via the `repo-scan` job
- scheduled Notion Work Queue sync via the `ops-queue-scan` job
- GitHub workflow and review webhook intake
- generic CI webhook intake
- generic operator-intake webhook suitable for Slack workflow or email-forward integrations
- Firestore ops webhook intake for waitlist, inbound request, and capture-complete events
- Stripe ops webhook intake for payout, dispute, and account exceptions
- support inbox webhook intake for routed support tickets
- deduped issue upsert and resolution
- linked blocker follow-up issue creation
- optional outbound notification webhooks for high-priority issue opens, blocker follow-ups, and CI recovery
- a dashboard page and widget for watch-only operators
- agent tools for CEO/CTO loops:
  - `blueprint-scan-work`
  - `blueprint-upsert-work-item`
  - `blueprint-report-blocker`
  - `blueprint-resolve-work-item`
- deterministic reporting writers for structured growth lanes:
  - `analytics-report`
  - `market-intel-report`
  - `demand-intel-report`
- editorial/publishing primitives that the new writing agents use:
  - `web-search`
  - `notion-write-knowledge`
  - `notion-write-work-queue`
- manager-grade Notion reconciliation primitives:
  - `notion-search-pages`
  - `notion-fetch-page`
  - `notion-upsert-knowledge`
  - `notion-upsert-work-queue`
  - `notion-update-page-metadata`
  - `notion-move-page`
  - `notion-archive-page`
  - `notion-comment-page`
  - `notion-reconcile-relations`
  - `nitrosend-upsert-audience`
  - `nitrosend-create-campaign-draft`
  - `slack-post-digest`
- manager-state visibility for the chief-of-staff loop:
  - `blueprint-manager-state`
- Slack activity mirroring for task opens, delegations, closures, and chief-of-staff wakeups:
  - routes to ops/growth by default
  - can use dedicated exec/engineering/manager webhooks when configured
- structured handoff monitoring:
  - validates `[Handoff]` issue request comments at creation time in Paperclip
  - tracks handoff latency, blocked depth, bounce rate, and stuck handoffs
  - mirrors new handoffs, responses, and stuck escalations into Slack
  - opens and resolves managed escalation issues for handoffs that stall

### Storage and traceability

- Webhook deliveries are stored by Paperclip in `plugin_webhook_deliveries`.
- Source-to-issue mappings are stored by the plugin as `source-mapping` plugin entities, keyed by stable fingerprints like `github-workflow:webapp:Build:main`.
- Recent automation activity and latest scan summaries are stored in company-scoped plugin state.

### Focused Paperclip core patch

`/Users/nijelhunt_1/workspace/paperclip/server/src/services/plugin-host-services.ts` now makes plugin-originated issue create/update flows behave more like the normal issue routes:

- plugin-created or plugin-reassigned issues wake the assignee
- plugin issue updates sync routine run status when they close or move routine-backed work

Without that patch, the Blueprint plugin could create issues but leave Paperclip’s execution loop partially disconnected.

## Secrets and Config

### Shared env file

Use a single host-local env file:

- `/Users/nijelhunt_1/workspace/.paperclip-blueprint.env`

Start from:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-paperclip.env.example`

The bootstrap, configure, verify, smoke, and LaunchAgent flows all read that file when present.

### Supported env values

- `PAPERCLIP_PUBLIC_URL`
- `COMPANY_NAME`
- `BLUEPRINT_PAPERCLIP_GITHUB_OWNER`
- `BLUEPRINT_PAPERCLIP_GITHUB_TOKEN`
- `BLUEPRINT_PAPERCLIP_GITHUB_WEBHOOK_SECRET`
- `BLUEPRINT_PAPERCLIP_CI_SHARED_SECRET`
- `BLUEPRINT_PAPERCLIP_INTAKE_SHARED_SECRET`
- `BLUEPRINT_PAPERCLIP_NOTIFICATION_WEBHOOK_URL`
- `NOTION_API_TOKEN`
- `SLACK_OPS_WEBHOOK_URL`
- `SLACK_GROWTH_WEBHOOK_URL`
- optional dedicated channels:
  - `SLACK_EXEC_WEBHOOK_URL`
  - `SLACK_ENGINEERING_WEBHOOK_URL`
  - `SLACK_MANAGER_WEBHOOK_URL`
- `SEARCH_API_KEY`
- `SEARCH_API_PROVIDER`
- `BLUEPRINT_PAPERCLIP_VERIFY_CLAUDE`
- `BLUEPRINT_PAPERCLIP_AUTO_SETUP_GITHUB_WEBHOOKS`
- `BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE`
- `BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES`
- `BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_MODEL`
- `BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_REASONING_EFFORT`

### How secrets are handled

- Bootstrap/configure reads the env file.
- If a secret value is present, `configure-blueprint-paperclip-plugin.sh` creates or rotates a Paperclip company secret.
- The plugin config stores only the Paperclip secret UUID reference, not the plaintext secret.
- The plugin resolves the secret at execution time via `ctx.secrets.resolve(...)`.

This is materially better than relying on random shell state, while still fitting Paperclip’s current self-hosted architecture.

### Lane failover

This host is designed to use subscription-backed local auth only.

`reconcile-blueprint-paperclip-company.sh` now probes `claude_local`, `codex_local`, and `hermes_local` per workspace. Claude/Codex lanes keep the existing failover behavior; Hermes-backed agents stay on Hermes and are not affected by the `auto|claude|codex` executive/review lane switch.

In practice that means:

- executive and review agents stay on Claude when Claude is healthy, then fail over to Codex when Claude is rate-limited or otherwise unavailable
- implementation agents stay on Codex when Codex is healthy, then fail over to Claude when Codex is unavailable
- Hermes-backed chief-of-staff, ops, growth, and research/copilot/summary agents stay on Hermes when the local `hermes` CLI is healthy

No Anthropic or OpenAI API-key wiring is required for the Codex/Claude host policy, and Hermes is expected to use Codex OAuth rather than provider API keys on this host.

## Commands

Bootstrap the whole stack:

```bash
/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/bootstrap-blueprint-paperclip.sh
```

If an older local instance already accumulated duplicate projects, agents, or routines from re-imports, repair it directly:

```bash
/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/repair-blueprint-paperclip-company.sh --apply
```

If you need to re-normalize the canonical unsuffixed agents and routines after an import, run:

```bash
/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/reconcile-blueprint-paperclip-company.sh
```

Flip the executive/review lane immediately:

```bash
/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/switch-blueprint-paperclip-lanes.sh auto
```

or:

```bash
/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/switch-blueprint-paperclip-lanes.sh codex
```

Reconfigure only the plugin and secret refs:

```bash
/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/configure-blueprint-paperclip-plugin.sh
```

Create or refresh GitHub webhooks once `PAPERCLIP_PUBLIC_URL` is publicly reachable:

```bash
/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/setup-github-webhooks.sh
```

Verify adapters, routines, plugin readiness, and dashboard reachability:

```bash
/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/verify-blueprint-paperclip.sh
```

`verify-blueprint-paperclip.sh` now validates the repo-side agent employee kit before it checks adapters, checks both Codex and Claude by default so the dual-lane host configuration stays honest, and verifies the chief-of-staff loop plus the added Ops and Growth routines rather than only the original engineering loops.

Run the end-to-end automation smoke:

```bash
/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/verify-blueprint-paperclip.sh --smoke
```

Or directly:

```bash
/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/smoke-blueprint-paperclip-automation.sh
```

Install the recurring macOS bootstrap agent:

```bash
/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/install-blueprint-paperclip-launchagent.sh
```

## Webhook Wiring

All plugin webhooks resolve through:

- `${PAPERCLIP_PUBLIC_URL}/api/plugins/blueprint.automation/webhooks/<endpoint>`

Endpoints:

- `github`
- `ci`
- `intake`
- `ops-firestore`
- `ops-stripe`
- `ops-support`

### GitHub

Use the `github` endpoint for:

- `workflow_run`
- `pull_request_review`

If `BLUEPRINT_PAPERCLIP_GITHUB_WEBHOOK_SECRET` is configured, the plugin verifies `X-Hub-Signature-256`.

`setup-github-webhooks.sh` now uses the same env file as bootstrap/configure, creates or updates hooks on the three Blueprint repos, and validates delivery by triggering GitHub ping events and checking the latest delivery status.

### Generic CI

Use the `ci` endpoint for any CI system that can POST JSON with:

- `sourceType`
- `sourceId`
- `projectName`
- `assignee`
- `title`
- `description`
- optional `status`, `priority`, `signalUrl`

If `BLUEPRINT_PAPERCLIP_CI_SHARED_SECRET` is configured, send it as:

- `Authorization: Bearer <secret>`

### Operator intake

Use the `intake` endpoint for normalized external signals such as:

- Slack workflow webhooks
- email-forward automations
- internal ops relay services

Payloads can:

- upsert work
- resolve work
- create blocker follow-up issues

If `BLUEPRINT_PAPERCLIP_INTAKE_SHARED_SECRET` is configured, send it as:

- `Authorization: Bearer <secret>`

## Outbound Notifications

If `BLUEPRINT_PAPERCLIP_NOTIFICATION_WEBHOOK_URL` is configured, the plugin will POST Slack-compatible webhook payloads for:

- new `high` or `critical` automation-created issues
- blocker follow-up issue creation
- CI-tracked issue resolution

This uses a Paperclip secret ref rather than storing the webhook URL in plugin config directly.

## Watch-Only Runbook

If you mostly want to watch updates:

1. Keep the trusted Paperclip host running with the LaunchAgent or another process supervisor.
2. Open the Blueprint automation page or dashboard widget in Paperclip.
3. Watch:
   - recent ingress
   - open automation issues
   - repo scan summary
4. Intervene only when:
   - a blocker issue escalates to executive ops
   - a secret or webhook path is broken
   - the automation dashboard shows repeated scan errors

The intended operator posture is to inspect the queue and recent activity, not manually create most tasks.

## Current Limits And Honest Blockers

These limits still come from Paperclip upstream architecture, not from the Blueprint layer:

- practical deployment remains self-hosted, persistent-filesystem, single-node oriented
- dynamic plugin installation is not cloud-ready for horizontally scaled multi-instance deployments
- plugin UI is trusted same-origin code, not a frontend sandbox boundary
- true multi-user cloud productization is still limited by Paperclip’s broader roadmap
- direct Slack Events API style challenge/response handling is not implemented here because the current plugin webhook contract returns a generic acknowledgement, not a provider-specific response body

Because of that, the best deployable story right now is:

- one persistent trusted host running Paperclip
- optional network exposure or Tailscale access from other operator machines
- local-path Blueprint plugin install from the checked-out repo
- centralized env file plus Paperclip company secrets on that host

One additional portability quirk showed up during validation:

- re-applying a company package onto an already-existing Paperclip company can duplicate routines, projects, and agents rather than merging cleanly

The bootstrap script now avoids repeated re-import once the new CTO routine marker exists, but if a host already accumulated duplicates from older imports, manual cleanup inside Paperclip is still required.
