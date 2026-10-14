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
8. **Terms update notice**: Terms version `2026-10-14.1` changed governing law
   to Delaware. Per the Terms' own update clause, email account holders about
   the material change before it takes effect; continued use after that is
   acceptance. The workspace does not force re-acceptance of a new version.
7. **Terms `2026-10-14.2` and Privacy `2026-10-14.1` notice** (not sent): Terms
   section 1 and 3 and the Privacy Policy now say that the start form shows the
   exact anonymized job card and offers **Keep this job private instead**
   (restored after `0acbf5d` removed it); that uploaders must tell people in
   the work area they are recording and sharing the video with Blueprint, and
   should avoid conversations and turn sound off; and that Blueprint keeps the
   original upload as received but removes sound before any automated review
   or AI/3D provider upload, and does not analyze speech. Per section 12, email
   account holders about these material changes before they take effect. Before
   sending, confirm the Pipeline also strips sound before its own Gemini video
   upload (`scene_semantics.py`), or the sound statement is not yet true there,
   and have counsel review the recording-notice and sound wording.

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
4. Before step 5 ships, the Privacy Policy needs its reCAPTCHA Enterprise
   disclosure (owned outside this change).
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
