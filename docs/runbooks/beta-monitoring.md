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
| Outbox backlog | same monitor (`scanOutboxBacklog`) | Reads `captureOutbox` entries with `status == "pending"`. Alerts when `BLUEPRINT_OUTBOX_BACKLOG_ALERT_COUNT` (50) or more are waiting, or one has waited `BLUEPRINT_OUTBOX_BACKLOG_ALERT_AGE_MS` (30 min). The pump sends every minute and gives up after 6 attempts, so either means delivery stalled. |
| Worker heartbeat | `server/utils/workerHeartbeat.ts`: the worker writes `opsHeartbeats/blueprint-webapp-worker` every minute (production, never previews); the monitor reads it | Alerts when the heartbeat is older than `BLUEPRINT_WORKER_HEARTBEAT_STALE_AFTER_MS` (5 min) or missing. `GET /health/worker` answers 200 `fresh` or 503 `stale`/`missing`/`unavailable` for the external probe. |
| Crashes | `installProcessErrorHandlers` in `server/index.ts` and `server/worker.ts` | `unhandledRejection` → fatal log + Slack (process keeps serving). `uncaughtException` → fatal log + Slack, then exit(1) so Render restarts it. Rate-limited per kind (15 min). |
| 5xx spikes | `createServerErrorRateMonitor` in `server/index.ts` | Slack when ≥10 5xx responses in 5 min and ≥5 % of responses (`BLUEPRINT_5XX_ALERT_THRESHOLD`, `_WINDOW_MS`, `_MIN_RATIO`). Health probes excluded. Rate-limited. |
| Resend quota | `server/utils/email.ts` | A quota rejection logs `email_quota_exhausted` at `error` and posts one Slack alert per 15 min. |
| ADP worker lanes | `server/agents/adp-managed-runs.ts` | Tick failures log at `error` and alert (rate-limited per lane). |
| Autonomous lanes | `server/utils/automationLaneSummary.ts` | Each process logs, and posts one Slack summary at boot, of the lanes active in it. `BLUEPRINT_ALL_AUTOMATION_ENABLED` logs a loud warning listing what it switched on. |
| External uptime | `blueprint-uptime-probe` Render cron job (`render.yaml`), every 10 min; `.github/workflows/uptime.yml` as the backstop | Both run `scripts/ops/uptime-probe.mjs`: `GET /health`, `/version.json` and `/health/worker`, 3 attempts each. A failure posts to the ops Slack webhook and fails the run. GitHub throttles its schedule (it ran every 2-5 hours, not every 10 minutes), so the Render cron is the 10-minute probe and the workflow is the check that still runs when Render itself is down. |

The monitor's backlog and heartbeat alerts are per incident: one Slack message
and one ops email when the condition starts, a Slack reminder each hour while
it lasts, and a Slack message when it clears. Email goes once because the
Resend free plan's daily cap is shared with customer email.

Controls: `BLUEPRINT_BETA_OPS_MONITOR_ENABLED=0` disables the monitor (not
recommended), `BLUEPRINT_BETA_OPS_MONITOR_INTERVAL_MS` changes its interval,
`BLUEPRINT_INTAKE_OPS_NOTICE_{MAX_ATTEMPTS,RETRY_AFTER_MS,ESCALATE_AFTER_MS}`
tune the sweep. Pull-request previews (`IS_PULL_REQUEST=true`) never run it.
`BLUEPRINT_OUTBOX_BACKLOG_ALERT_{COUNT,AGE_MS}` and
`BLUEPRINT_WORKER_HEARTBEAT_STALE_AFTER_MS` set the new thresholds (web);
`BLUEPRINT_WORKER_HEARTBEAT_CHECK_ENABLED=0` (web) and
`BLUEPRINT_WORKER_HEARTBEAT_ENABLED=0` (worker) turn the heartbeat off.

### Readiness checks that now apply in production

`/health/ready` (503 + `blocker_count`) reports these **blockers** on a deployed
production service (never on the loopback launch smoke):

- `email`: Resend not configured (`RESEND_API_KEY` + `RESEND_FROM_EMAIL`).
  Intake notices and escalations depend on it.
- `stripeWebhookQueue`: `BLUEPRINT_STRIPE_WEBHOOK_QUEUE=1` with no confirmed
  consumer. The deployed worker never drains the queue; unset the flag.

`.github/workflows/deploy.yml` fails (and restores the previous release) when
`/health/ready` is not 200 after a deploy, so confirm both before merging.

It reports these as **warnings** (listed in `warnings`, never failing a deploy):

- `slackOpsAlerts`: `SLACK_WEBHOOK_URL` unset, so alerts reach only email.
- `redis`: `REDIS_URL` unset. Rate limits, idempotency and the leader lease
  fall back to per-process state. Fine for a single instance; add Render Key
  Value and set `REDIS_URL` before running more than one, or record the
  decision with `BLUEPRINT_READINESS_REDIS_WAIVED=1`.

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
   `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `CONTACT_TO` are set. The founder
   chose a single instance without Redis for the beta (2026-10-14): add
   `BLUEPRINT_READINESS_REDIS_WAIVED=1` here. `render.yaml` records the same
   value, but a dashboard-created service does not read it (see
   `DEPLOYMENT.md`), so the dashboard entry is what takes effect. Optionally set
   `SLACK_INBOUND_WEBHOOK_URL` for a separate new-request channel and
   `BLUEPRINT_ADMIN_EMAIL_ALLOWLIST` (see access control below).
5. **Resend → Billing**: see *Email volume* below.
6. **Firestore TTL for the cap counters**: run
   `./scripts/apply_firestore_ttl_policies.sh` once (gcloud with Firestore
   admin). It adds `expires_at` TTL on `durableDailyCaps` and
   `durableDailyCapReceipts`, so a day's counters are swept about 8 days later.
   The caps work without it; the collections just keep growing.
7. **App Check**: follow *App Check rollout* below. Until it is enforced,
   `npm run alpha:env` lists it under *Recommended-missing*.
8. **Terms and Privacy reissue (owner decision 2026-10-15)**: the Terms and
   Privacy versions published on 2026-10-15 said "Effective October 14" with
   no notice. They are reissued as `2026-11-15.1`, effective November 15, 2026.
   Until then the versions live before that release stay in force and stay
   published: Terms `2026-10-14.1` at `/terms/previous` and Privacy
   `2026-10-13.1` at `/privacy/previous`. A banner on the public site and in
   the workspace announces the date until it passes. The owner decided not to
   email account holders; Terms section 12 and the Privacy Policy's "Changes"
   section in both versions still say account holders are emailed before a
   material change, so have counsel confirm the banner is enough or change
   that clause in a later reissue. The reissued Privacy Policy states the real
   footage retention (no automatic deletion, at least 7 years) in place of the
   previous "180 days after the job closes". Still open from the earlier
   notice: confirm the deployed Pipeline strips sound before its own Gemini
   video upload (its `scene_semantics.py` now uploads through
   `audio_free_upload_copy`; check that build is the one running), and have
   counsel review the recording-notice and sound wording.
9. **Uptime cron (every 10 minutes)**: Render → New → Cron Job, from this
   repo's `main`: name `blueprint-uptime-probe`, region Virginia, schedule
   `*/10 * * * *`, build command `node --version`, start command
   `node scripts/ops/uptime-probe.mjs`, env `UPTIME_BASE_URL=https://tryblueprint.io`
   and `SLACK_WEBHOOK_URL` (the same ops webhook as the web service), Auto-Deploy
   off. `render.yaml` declares it, but the existing services were created by
   hand, so it does not appear until it is created or the Blueprint is synced.
   Then **Render → Notifications**: enable *Cron job failed* for it. Verify:
   the job's first runs log `OK /health`, `OK /version.json` and
   `OK /health/worker`. Redeploy it by hand when the script changes.
10. **Worker heartbeat**: after the next deploy, `curl -s https://tryblueprint.io/health/worker`
    reads `"status":"fresh"`. If it reads `missing`, the worker is not running
    with `NODE_ENV=production` (its start command sets it) or set
    `BLUEPRINT_WORKER_HEARTBEAT_ENABLED=0`. Also confirm `SLACK_WEBHOOK_URL`
    is set on `blueprint-webapp-worker`, so its crash alerts reach Slack.

## Email volume (Resend free plan)

Resend's free plan caps sending at **100 emails/day and 3,000/month** (check the
current limits on the Resend pricing page). Expected beta volume per new site:
1 task-received or confirmation email, 1 ops notice, plus lifecycle and
status-update emails over the following weeks (typically 3–6 per active site),
and robot-team result/new-task emails. Ops notices and escalations count too.
Around **15–20 new sites a day** reaches the daily cap. The durable intake
message caps (below) keep first-touch email to at most 40 a day and 2 per
recipient, so the form cannot be used to flood a third party's inbox.

When `email_quota_exhausted` alerts (or monthly usage passes ~70 %), upgrade:
Resend → Billing → *Pro*; no code or env change is needed (the same
`RESEND_API_KEY` keeps working). Until then, failed customer emails exhaust the
outbox retry budget and are reported by the outbox failure alert, and intake
notices keep retrying via Slack.

## Durable spend and abuse caps

Sign-up is open and the beta is free, so Blueprint pays for every anonymous
intake, email, upload and model review. The in-memory limiters (10 intakes per
IP and 3 per email per 15 minutes, and the global `/api` limiter) absorb bursts
but reset on every restart of the single instance. Behind them, per-UTC-day
counters in Firestore (`server/utils/durableDailyCaps.ts`, configured in
`server/utils/betaAbuseCaps.ts`) hold across restarts. Each consumption is one
transaction across all of its caps, so a request refused by one cap uses none of
the others. IPs, email addresses and job ids are stored only as HMAC keys.

| Cap | Env (default) | Applies to | Over cap | Store unavailable |
| --- | --- | --- | --- | --- |
| Intakes, all | `BLUEPRINT_INTAKE_DAILY_LIMIT` (50; `0` closes intake) | `POST /api/inbound-request` and workspace job starts. Invited robot-team evaluation requests are not counted. | 429 + `Retry-After` (seconds to UTC midnight), `code: intake_global_daily_limit`. No record, email, ops notice or model call. | Production: 503 `intake_capacity_unavailable`, `Retry-After: 60` (fail closed: the record needs the same store, and failing open would make a degraded store the way to unlimited intake). |
| Intakes per IP | `BLUEPRINT_INTAKE_PER_IP_DAILY_LIMIT` (20) | same | 429 `intake_ip_daily_limit` | same |
| Intakes per mailbox | `BLUEPRINT_INTAKE_PER_EMAIL_DAILY_LIMIT` (5; `+tags` and Gmail dots folded) | same | 429 `intake_email_daily_limit` | same |
| Intake messages, all | `BLUEPRINT_INTAKE_EMAIL_DAILY_LIMIT` (40) | The one first-touch email per intake (task received, or the generic confirmation) and the film-link handoff to a named filmer. Ops notices are not counted. | Message withheld. The request records `intake_message_suppression` (or `filmer_handoff_suppression`) with `reason`; no outbox intent; the submit response still returns the private job link; a retry does not re-send it. | Withheld, `reason: cap_store_unavailable`. |
| Intake messages per recipient | `BLUEPRINT_INTAKE_EMAIL_PER_RECIPIENT_DAILY_LIMIT` (2) | same | same, `reason: recipient_daily_limit` | same |
| Upload bytes, all | `BLUEPRINT_UPLOAD_DAILY_MB_LIMIT` (20480 MiB) | Capture-link whole-file uploads, each resumable part, item photos, app-bundle plans (planned bytes, once per plan, before any signed target), contact-form videos. Charged by declared length before any byte is read; a resent part is free. | 429 `upload_daily_limit`, `Retry-After`. | Production: 503 `upload_capacity_unavailable`. |
| Upload bytes per job | `BLUEPRINT_UPLOAD_PER_JOB_DAILY_MB_LIMIT` (4096 MiB) | same, per request id | 429 `upload_job_daily_limit` | same |
| Model review USD per day | `BLUEPRINT_SITE_ASSESSMENT_DAILY_USD_CAP` (50) | Every site-assessment (Sol and Gemini) and coverage-review (Gemini) call. The call's worst-case estimate ($1.82 per Gemini video call, $0.33 per Sol turn) is reserved before dispatch and reconciled to priced usage after; unknown usage keeps the full reservation. | The call is not made (`site_assessment_daily_cost_cap`). Queues check headroom first, so a review stays `queued` with `spend_blocker` (`reason: daily_usd_cap_reached`) on its `siteAssessmentJobs` doc and resumes the next UTC day; the site sees "queued". | Fail closed (`site_assessment_cost_unresolved`; queued with `reason: spend_counter_unavailable`). |
| Model review USD per review | `BLUEPRINT_SITE_ASSESSMENT_REVIEW_USD_CAP` (10) | One customer site assessment: priced usage plus outstanding reservations. The owner-authorized local iteration tool stays accounting-only. | The run stops with `site_assessment_inference_cost_cap`; the job goes to `needs_review` and the existing retry path applies. | n/a (in-process) |

Run artifacts now report the truth: `inference_reservation.hard_cost_cap_usd`
is the per-review cap and `spending_gated` is `true`; each
`capture_inference_reservations` receipt carries `daily_cap_usd` and
`daily_cap_day`.

Defaults are sized from the observed beta: 3–5 invited sites, ~60 MB typical
walkthroughs, the Resend free plan's 100 emails a day (50 ops notices + 40
first-touch emails stays under it), and a 2 GiB upload ceiling (4 GiB per job
is one full upload plus a retry). Raise a value in Render (web and worker) when
honest traffic approaches it; no deploy is needed. Watch for
`Durable daily cap reached` (warn, with the cap name and day; never the
subject), `Intake confirmation email withheld by daily cap`,
`Site advisory waits for model budget` and
`Coverage review waits for model budget`. Today's usage is the `used` field of
`durableDailyCaps/<cap>__<YYYY-MM-DD>` (model spend is in micro-USD).

## App Check rollout

Firebase App Check (reCAPTCHA Enterprise) asks anonymous intake
(`POST /api/inbound-request`) and capture-link upload admissions (whole-file
upload, parts, parts completion, item photos) to prove they came from the web
app. It is off by default and staged by `BLUEPRINT_APP_CHECK_MODE`. The iOS
bundle routes are not guarded; the app would first need an App Attest provider.

1. **Firebase console → App Check → Apps**: register the Blueprint web app with
   the **reCAPTCHA Enterprise** provider. Do not turn on enforcement for
   Firestore, Storage or other Firebase products here; this server checks the
   token itself.
2. **Google Cloud console → Security → reCAPTCHA Enterprise**: create a
   *website* key (score-based, no checkbox) for `tryblueprint.io` and
   `www.tryblueprint.io` in project `blueprint-8c1ca`, and paste it into the
   App Check registration from step 1.
3. **Render → web service → Environment**: set
   `VITE_FIREBASE_APPCHECK_SITE_KEY=<site key>` and **rebuild** (Vite inlines
   it at build time; a restart is not enough). The CSP then admits the
   reCAPTCHA script and frame hosts. The key is public by design.
4. The reCAPTCHA Enterprise disclosure is in the reissued Privacy Policy
   (`2026-11-15.1`), which takes effect on November 15, 2026; the previous
   version in force until then (`/privacy/previous`) does not name reCAPTCHA.
   Once step 3 ships, reCAPTCHA runs on every job submission and footage
   upload, so do steps 3 and 5 on or after November 15, 2026, unless counsel
   agrees the published disclosure is enough before then.
5. Set `BLUEPRINT_APP_CHECK_MODE=monitor` and restart. Requests are never
   refused; Render logs show `event: "app_check_monitor"` with
   `outcome: missing | invalid | unverifiable` for each request that would have
   been refused (valid ones log at debug). Watch real traffic for several days:
   expect `missing` only from old cached pages, scripts and blocked reCAPTCHA.
6. When the remaining refusals are explained, set
   `BLUEPRINT_APP_CHECK_MODE=enforce`. Missing tokens get 401
   (`app_check_required`), invalid ones 403 (`app_check_invalid`), and an
   unavailable verifier 503. Roll back by setting `monitor` or `off`; no
   deploy is needed.

## Access control

Admin/ops authority comes from Firebase custom claims first, then
`BLUEPRINT_ADMIN_EMAIL_ALLOWLIST` / `BLUEPRINT_OPS_EMAIL_ALLOWLIST` (verified
email only). Legacy users-doc roles still work while
`BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK` is unset (the default is on, so nobody is
locked out), but that fallback is only as safe as the deployed Firestore
rules: if a ruleset that lets a client write `admin`, `ops`, `role`, `roles`
or `accessRoles` on its own `users/{uid}` document were ever deployed (both
repos deploy to the same project, last writer wins), the fallback would turn
that write into admin access. The goal is to turn it off.

What shows whether anyone still depends on it:

- **Log**: `admin_role_from_user_doc` (also `metric:
  admin_role_doc_fallback_grant`), at most once an hour per uid. Each line
  names the `uid`, the `roles` held only through the users doc, and the
  `claimRoles` / `allowlistRoles` that would remain with the fallback off.
- **Counter**: `debug.adminRoleDocFallback` on `GET /health/status` (send the
  `x-health-status-token` header in production): `docOnlyGrantsSinceBoot`,
  `docOnlyPrincipalsSinceBoot`, `lastDocOnlyGrantAt`. Counts only; it resets
  on deploy or restart.

Decision steps before setting it to 0:

1. Run the read-only audit and fix every `DOC-ONLY` row by granting a custom
   claim (or adding the verified email to the allowlist) for each legitimate
   operator; remove the role fields from docs that should not have them.

   ```bash
   npx tsx scripts/ops/audit-admin-roles.ts          # needs Firebase Admin credentials; exit 2 = DOC-ONLY rows remain
   ```

2. Confirm the rules both repos would deploy are identical and that the
   deployed rules match them, so no older ruleset is quietly allowing
   client-written role fields:

   ```bash
   npm run rules:parity                               # WebApp vs BlueprintCapture checkout
   bash scripts/ops/verify-firebase-rules-parity.sh --project blueprint-8c1ca   # deployed vs repo, read-only
   ```

3. Check the Render logs for `admin_role_from_user_doc` over at least a week
   of normal operator use (and `debug.adminRoleDocFallback` on
   `/health/status`). Any line after step 1 names someone the audit missed;
   fix them as in step 1.
4. Set `BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK=0` on the Render web service,
   redeploy, and confirm each operator can still open `/admin`. `fallbackEnabled` on `/health/status`
   reads `false` afterwards. To roll back, unset the variable.

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
  Account notices have no lead record: their alert gives the exact
  `captureOutbox/<key>` Firestore path and `deliveryReceipts` recovery reference.
  Inspect those with existing authorized Firestore access; see
  [account-notice delivery](account-notice-email.md#approved-delivery).
- **5xx / crash**: Render logs, filter `level>=50` and the trace id.
- **Readiness not ready**: `curl -H "x-health-status-token: $HEALTH_STATUS_TOKEN"
  https://tryblueprint.io/health/ready` lists the blockers (the token is
  accepted only in that header).
