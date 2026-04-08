# Paperclip Runtime Recovery Runbook

Use this runbook when Blueprint Paperclip automation degrades because GitHub webhook/plugin configuration or Google Calendar server-side configuration is incomplete.

This is a connector-recovery runbook, not the full autonomous-alpha launch checklist. For the public launch decision, run the full gate sequence in [autonomous-org-launch-checklist.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/autonomous-org-launch-checklist.md).

## What This Runbook Covers

- shared Paperclip health and plugin readiness
- GitHub webhook/plugin prerequisite checks
- Google Calendar server-side configuration for field-ops booking/reschedule automation
- targeted post-fix verification for repo/CI access and field-ops calendar usage

This runbook is intentionally explicit about what is machine-verifiable versus what still requires operator-owned service configuration.

## 1. Verify Shared Paperclip Health

Run:

```bash
scripts/paperclip/verify-blueprint-paperclip.sh
```

Expected:

- the shared Paperclip instance is reachable on the canonical local API URL
- the Blueprint automation plugin is `ready`
- required routines are present
- GitHub prerequisite env vars are present:
  - `BLUEPRINT_PAPERCLIP_GITHUB_OWNER`
  - `BLUEPRINT_PAPERCLIP_GITHUB_TOKEN`
  - `BLUEPRINT_PAPERCLIP_GITHUB_WEBHOOK_SECRET`

If this step fails on missing GitHub env/config, treat it as a connector/auth configuration problem, not generic runtime instability.

Before continuing, also run:

```bash
npm run alpha:preflight
npm run smoke:agent
```

Reason:

- `verify-blueprint-paperclip.sh` proves Paperclip/package health
- `alpha:preflight` proves the production env contract is actually present
- `smoke:agent` proves the selected structured runtime provider is live

Do not treat a passing Paperclip verify alone as public-launch readiness.

## 2. Refresh Plugin Configuration

Run:

```bash
scripts/paperclip/configure-blueprint-paperclip-plugin.sh
scripts/paperclip/setup-github-webhooks.sh
```

Expected:

- Blueprint plugin secrets are current
- GitHub webhook endpoints point at the active public Paperclip URL
- webhook ping validation succeeds

## 3. Verify Calendar-Backed Field Ops Prereqs

Confirm the server-side calendar path is configured:

- `GOOGLE_CALENDAR_ID`
- one of:
  - `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
  - `GOOGLE_APPLICATION_CREDENTIALS`

These are required for the Blueprint-WebApp calendar execution path.

## 4. Run Targeted Post-Fix Checks

Run:

```bash
scripts/paperclip/verify-blueprint-paperclip.sh --smoke
```

Then run the focused test slice:

```bash
npx vitest run server/tests/field-ops-automation.test.ts server/tests/phase2-workflows.test.ts
```

Expected:

- verify passes shared instance, plugin, routines, and adapter probes
- smoke passes Blueprint plugin ingress/dedupe/manager-state flows
- field-ops tests pass reminder scheduling and pending-approval reschedule behavior
- support and payout Phase 2 routing tests remain green

## 5. Runtime Confirmation

After the configuration update, trigger one targeted Paperclip run for each affected lane:

- one GitHub-dependent lane:
  - `webapp-codex`, `pipeline-codex`, or another repo/CI-dependent role
- one field-ops lane that needs calendar access:
  - `field-ops-agent`

Confirm the resulting behavior no longer shows GitHub webhook/plugin failures or server-side Google Calendar configuration failures.

Then rerun:

```bash
npm run smoke:agent
scripts/paperclip/verify-blueprint-paperclip.sh --smoke
```

These are the minimum post-fix confirmations before treating the recovered connectors as launch-capable.

## Notes

- Keep sensitive lanes human-gated. This runbook restores connector health; it does not authorize money movement, rights decisions, or legal/privacy approvals.
- If runtime transcripts or server logs still show GitHub or calendar configuration failures after these updates, capture the exact snippet and attach it to the Paperclip issue for follow-up.
