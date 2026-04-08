# Paperclip Connector Recovery Runbook

Use this runbook when Blueprint Paperclip agent runs degrade because GitHub or Google Calendar runtime connectors have lost auth.

This is a connector-recovery runbook, not the full autonomous-alpha launch checklist. For the public launch decision, run the full gate sequence in [autonomous-org-launch-checklist.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/autonomous-org-launch-checklist.md).

## What This Runbook Covers

- shared Paperclip health and plugin readiness
- GitHub webhook/plugin prerequisite checks
- manual re-auth for the Claude GitHub connector
- manual re-auth for the `claude.ai Google Calendar` connector
- targeted post-fix verification for repo/CI access and field-ops calendar usage

This runbook is intentionally explicit about what is machine-verifiable versus what still requires an operator to re-auth a runtime connector.

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

## 3. Re-Auth Runtime Connectors

These steps are manual. They are not fully machine-verifiable from the current Paperclip API.

### GitHub

Re-auth the GitHub connector used by Claude-facing runtime agents.

**Steps:**

1. Open Claude (claude.ai) in your browser
2. Go to Settings → Connected Apps → GitHub
3. If it shows "failed" or disconnected, click "Reconnect" or "Disconnect" then "Connect"
4. Authorize the OAuth flow for your GitHub account (`ognjhunt`)
5. Verify the connection by checking that Claude can see your repos

**Alternative (if Claude UI doesn't work):**

1. Go to GitHub → Settings → Applications → Authorized OAuth Apps
2. Find the Claude app and revoke access
3. Go back to Claude and re-authorize from scratch

Success criteria:

- the connector no longer shows `failed` in runtime transcript context
- GitHub-dependent agents can read repo/CI state without connector errors

### Google Calendar

Re-auth the `claude.ai Google Calendar` connector used by field-ops workflows.

**Steps:**

1. Open Claude (claude.ai) in your browser
2. Go to Settings → Connected Apps → Google Calendar
3. If it shows "needs-auth" or disconnected, click "Reconnect" or "Connect"
4. Authorize the OAuth flow for your Google account
5. Select the calendar you want Claude to access (or grant access to all)

**Alternative (if Claude UI doesn't work):**

1. Go to Google Account → Security → Third-party apps with account access
2. Find Claude and remove access
3. Go back to Claude and re-authorize from scratch

Success criteria:

- the connector no longer shows `needs-auth` in runtime transcript context
- the field-ops agent can complete a booking or simple reschedule path that requires calendar access

## 4. Verify Calendar-Backed Field Ops Prereqs

Before blaming runtime connector auth for field-ops failures, confirm the server-side calendar path is configured:

- `GOOGLE_CALENDAR_ID`
- one of:
  - `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
  - `GOOGLE_APPLICATION_CREDENTIALS`

These are required for the Blueprint-WebApp calendar execution path even after the Claude runtime connector is re-authenticated.

## 5. Run Targeted Post-Fix Checks

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

## 6. Runtime Confirmation

After the manual re-auth, trigger one targeted Paperclip run for each affected lane:

- one GitHub-dependent Claude lane:
  - `Intake Agent`, `Capture Claude`, or another repo/CI-dependent role
- one field-ops lane that needs calendar access:
  - `field-ops-agent`

Confirm the resulting runtime transcript does not show:

- `plugin:github:github status failed`
- `claude.ai Google Calendar status needs-auth`

Then rerun:

```bash
npm run smoke:agent
scripts/paperclip/verify-blueprint-paperclip.sh --smoke
```

These are the minimum post-fix confirmations before treating the recovered connectors as launch-capable.

## Notes

- Keep sensitive lanes human-gated. This runbook restores connector health; it does not authorize money movement, rights decisions, or legal/privacy approvals.
- If runtime transcripts still show connector failures after re-auth, capture the exact transcript snippet and attach it to the Paperclip issue for follow-up.
