# Beta monitoring runbook

The beta is free and sites sign up openly, so the failure that matters most is
a request (or a customer email) that nobody sees. Monitoring uses only the
existing stack: the structured logger, the ops Slack webhook, Resend email,
Firestore, GitHub Actions and Render's own notifications. No third-party error
tracker is installed.

## What is automated (in the repo)

| Signal | Where it runs | What it does |
| --- | --- | --- |
| Intake ops notice | `server/utils/intakeOpsNotice.ts`, called from `POST /api/inbound-request` | Writes `ops_notice` on the `inboundRequests` doc in the same commit as the request, sends a **link-only** Slack + ops email (request id, type, priority, queue, `/admin/leads/<id>`; no name, email, company, site or task text), and records the per-channel outcome. Undelivered notices log at `warn`. |
| Intake notice sweep | `server/utils/betaOpsMonitor.ts`, **web process**, every 5 min, leader-leased (shared ops automation lease) | Retries pending notices after 10 min, escalates after 30 min or when the retry budget (5) is spent: `opsAlerts` record + Slack (`intake_forwarding_failure`) + email to `CONTACT_TO` (default `ops@tryblueprint.io`) + `error` log. Each notice escalates once. |
| Terminal outbox failures | same monitor | Read-only scan of `captureOutbox` for `status == "failed"`; alerts once per entry (create-only marker in `opsOutboxFailureAlerts`) by Slack and ops email, link-only. |
| Readiness | same monitor + `/health/ready` | Re-evaluates launch readiness each pass. Alerts when readiness regresses, recovers, **or is not ready right after boot**. |
| Crashes | `installProcessErrorHandlers` in `server/index.ts` and `server/worker.ts` | `unhandledRejection` → fatal log + Slack (process keeps serving). `uncaughtException` → fatal log + Slack, then exit(1) so Render restarts it. Rate-limited per kind (15 min). |
| 5xx spikes | `createServerErrorRateMonitor` in `server/index.ts` | Slack when ≥10 5xx responses in 5 min and ≥5 % of responses (`BLUEPRINT_5XX_ALERT_THRESHOLD`, `_WINDOW_MS`, `_MIN_RATIO`). Health probes excluded. Rate-limited. |
| Resend quota | `server/utils/email.ts` | A quota rejection logs `email_quota_exhausted` at `error` and posts one Slack alert per 15 min. |
| ADP worker lanes | `server/agents/adp-managed-runs.ts` | Tick failures log at `error` and alert (rate-limited per lane). |
| Autonomous lanes | `server/utils/automationLaneSummary.ts` | Each process logs, and posts one Slack summary at boot, of the lanes active in it. `BLUEPRINT_ALL_AUTOMATION_ENABLED` logs a loud warning listing what it switched on. |
| External uptime | `.github/workflows/uptime.yml`, every 10 min | `GET https://tryblueprint.io/health` and `/version.json` with 3 retries. Fails the run and, if the `SLACK_WEBHOOK_URL` **repository secret** is set, posts to Slack. Runs outside Render, so it still fires when the service is down. |

Controls: `BLUEPRINT_BETA_OPS_MONITOR_ENABLED=0` disables the monitor (not
recommended), `BLUEPRINT_BETA_OPS_MONITOR_INTERVAL_MS` changes its interval,
`BLUEPRINT_INTAKE_OPS_NOTICE_{MAX_ATTEMPTS,RETRY_AFTER_MS,ESCALATE_AFTER_MS}`
tune the sweep. Pull-request previews (`IS_PULL_REQUEST=true`) never run it.

### Readiness blockers that now apply in production

`/health/ready` (503 + `blocker_count`) reports these as blockers on a deployed
production service (never on the loopback launch smoke):

- `slackOpsAlerts`: `SLACK_WEBHOOK_URL` unset, so every alert above reaches nobody.
- `email`: Resend not configured (`RESEND_API_KEY` + `RESEND_FROM_EMAIL`).
- `redis`: `REDIS_URL` unset. Rate limits, idempotency and the leader lease
  fall back to per-process state. Either add Render Key Value and set
  `REDIS_URL`, or consciously waive it for a single-instance beta with
  `BLUEPRINT_READINESS_REDIS_WAIVED=1` (it then shows as a warning).
- `stripeWebhookQueue`: `BLUEPRINT_STRIPE_WEBHOOK_QUEUE=1` with no confirmed
  consumer. The deployed worker never drains the queue; unset the flag.

**Before merging this change, confirm these four in the production Render
environment.** `.github/workflows/deploy.yml` fails (and restores the previous
release) when `/health/ready` is not 200 after a deploy.

Redis outages fail open: rate limiting lets requests through within ~750 ms
(`RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS`) instead of hanging `/api`.

## What the founder must click (not automatable from the repo)

1. **Render → Blueprint-WebApp → Settings**
   - Instance type: **Starter** (free instances sleep, which stops the
     in-process outbox pump and this monitor). `render.yaml` says `starter`,
     but a dashboard-created service does not read it.
   - Health Check Path: **`/health`**. Leave `/health/ready` to the deploy
     workflow and the monitor; a 503 there must not make Render cycle a live
     instance.
2. **Render → Account/Workspace → Notifications**: enable email (and Slack, if
   the Render Slack app is connected) for *Deploy failed*, *Service
   unhealthy / health check failed*, and *Instance restarted / out of memory*,
   for both `Blueprint-WebApp` and `blueprint-webapp-worker`.
3. **GitHub → Settings → Secrets and variables → Actions**: add repository
   secret `SLACK_WEBHOOK_URL` (an ops channel incoming webhook) so the uptime
   workflow posts failures. Confirm *Settings → Notifications → Actions* emails
   you on failed workflows. GitHub pauses scheduled workflows after 60 days
   without repository activity; re-enable from the Actions tab if so.
4. **Render → Blueprint-WebApp → Environment**: confirm `SLACK_WEBHOOK_URL`,
   `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `CONTACT_TO` are set, and decide
   Redis (`REDIS_URL` or `BLUEPRINT_READINESS_REDIS_WAIVED=1`). Optionally set
   `SLACK_INBOUND_WEBHOOK_URL` for a separate new-request channel and
   `BLUEPRINT_ADMIN_EMAIL_ALLOWLIST` (see access control below).
5. **Resend → Billing**: see *Email volume* below.

## Email volume (Resend free plan)

Resend's free plan caps sending at **100 emails/day and 3,000/month** (check the
current limits on the Resend pricing page). Expected beta volume per new site:
1 task-received or confirmation email, 1 ops notice, plus lifecycle and
status-update emails over the following weeks (typically 3–6 per active site),
and robot-team result/new-task emails. Ops notices and escalations count too.
Around **15–20 new sites a day** reaches the daily cap.

When `email_quota_exhausted` alerts (or monthly usage passes ~70 %), upgrade:
Resend → Billing → *Pro*; no code or env change is needed (the same
`RESEND_API_KEY` keeps working). Until then, failed customer emails exhaust the
outbox retry budget and are reported by the outbox failure alert, and intake
notices keep retrying via Slack.

## Access control

Admin/ops authority comes from Firebase custom claims first, then
`BLUEPRINT_ADMIN_EMAIL_ALLOWLIST` / `BLUEPRINT_OPS_EMAIL_ALLOWLIST` (verified
email only). Legacy users-doc roles still work (no lockout) but log
`admin_role_from_user_doc`. Run the read-only audit, fix any `DOC-ONLY` rows,
then set `BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK=0`:

```bash
npx tsx scripts/ops/audit-admin-roles.ts          # needs Firebase Admin credentials
```

## Data-protection checks (read-only; run by a human, never from CI)

```bash
# Firestore PITR + scheduled backups (gcloud authenticated as a project viewer)
bash scripts/ops/verify-firestore-backups.sh --project blueprint-8c1ca

# Deployed Firestore/Storage rules + indexes vs the repo
bash scripts/ops/verify-firebase-rules-parity.sh --project blueprint-8c1ca
```

Both scripts only read. See `docs/runbooks/DATA_BACKUP_AND_DR_RUNBOOK.md` for
restore steps.

## Responding to an alert

- **Intake notice escalation**: open the admin link, contact the site, then
  check why both channels failed (`ops_notice.last_error` on the request doc).
- **Outbox failures**: open the request; the message body and recipient are in
  `captureOutbox/<key>`. Resend quota and bounces are the usual causes.
- **5xx / crash**: Render logs, filter `level>=50` and the trace id.
- **Readiness not ready**: `curl -H "x-health-status-token: $HEALTH_STATUS_TOKEN"
  https://tryblueprint.io/health/ready` lists the blockers (the token is
  accepted only in that header).
