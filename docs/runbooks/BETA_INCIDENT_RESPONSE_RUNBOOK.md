# Runbook: Beta Incident Response

Status: Active operational runbook for the external beta. Pair with the company policy
`docs/company/incident-response-and-escalation.md` (severity, evidence, legal rules) — this
runbook is the hands-on beta-ops layer: who is paged, how to roll back, how to take data
down, and what to say to buyers and capturers while a blocker is live.

Owner of record: **Beta On-Call (primary)** — TODO: real name + phone/Slack.
Backup: **Eng Lead** — TODO: real name + phone/Slack.
Final escalation: **Founder** — TODO: real name + phone (`ohstnhunt@gmail.com` is the durable
async decision trail).

Scope: production Blueprint-WebApp beta on Render, its dependencies (Firebase/Firestore,
Firebase Storage / Backblaze, Stripe + Stripe Connect, Redis, the Pipeline intake / robot-eval
forwarding), and buyer- or capturer-visible degradation.

Review cadence: after every SEV-1/SEV-2, and before each new city or provider cohort goes live.

## Remediates audit finding R038

R038 (P1): no beta incident-response runbook (owner, escalation, rollback, takedown,
customer-comms) and no deploy rollback path. This runbook + `scripts/rollback-deploy.sh`
close it. The failure classes called out by the audit are the four degraded-state playbooks
below: **upload failure**, **package blocked / review-required**, **provider down**, and
**payout exception**.

## 0. Ownership and escalation ladder

| Tier | Role | When it pages | TODO: real contact |
| --- | --- | --- | --- |
| 1 | Beta On-Call (primary) | First responder for every alert. Owns triage + comms until handed off. | TODO |
| 2 | Eng Lead | SEV-2+ code/deploy/data issues, or any rollback. | TODO |
| 3 | Founder / CEO | SEV-1, customer-facing statements, refunds, takedown sign-off, legal/privacy. | TODO (`ohstnhunt@gmail.com`) |

Rules:

- One **Incident Owner** at a time. Default is Beta On-Call until explicitly handed off.
- Escalate up a tier if not contained within: SEV-1 15 min, SEV-2 60 min, SEV-3 same business day.
- Slack DM to the Founder is the fast interrupt path; email to `ohstnhunt@gmail.com` is the
  durable record for any decision (refund, takedown, external statement).
- No external/customer statement goes out without Tier-3 (or delegated) approval.

## 1. Severity (aligned to `docs/company/incident-response-and-escalation.md`)

- **SEV-1** — buyer-facing outage or false claim: site down, checkout/entitlement broken,
  hosted site-world sessions failing, confirmed data exposure, or wrong/fabricated readiness
  shown to a buyer. Page Tier 1 + Tier 2 immediately; notify Tier 3.
- **SEV-2** — degraded but not down: one blocker class active (upload failures, packages stuck
  in review, provider/Pipeline intake down, payout exceptions queuing), elevated error rate,
  Redis or a single dependency degraded with a working fallback.
- **SEV-3** — contained: cosmetic, single-user, or a documentation/monitoring gap with an owner.

## 2. Detection sources

- **Health endpoints** (canonical): `GET /health` → `{status:"healthy"}`, `GET /health/ready`
  → 200 `{status:"ready"}` or 503 `{status:"not_ready"}` with `blockers`. Render health check
  path is `/health/ready` (`render.yaml`). `/health/status` gives uptime + error-rate metrics.
- **Launch smoke**: `ALPHA_BASE_URL=https://tryblueprint.io npm run smoke:launch` exercises
  `/health`, `/health/ready`, CSRF, the structured-automation provider, inbound qualification,
  and post-signup.
- **Ops alerts**: `server/utils/ops-alerts.ts` posts launch-readiness transitions to Slack
  (`SLACK_WEBHOOK_URL`).
- **Sentry** (`VITE_SENTRY_DSN`) for client/runtime errors.
- **Provider dashboards**: Render (deploy + service health), Stripe (payments/Connect/webhooks),
  Firebase/Firestore console, Upstash/Redis, Backblaze (if storage provider is `backblaze`).
- **User reports**: buyer support inbox, capturer/field-ops reports, `BLUEPRINT_SUPPORT_EMAIL`.

## 3. First response (first 30 minutes)

1. **Stop the harm if safe**: for a bad deploy, roll back (section 4). For a bad
   secret/integration, rotate/disable it. For data exposure, restrict access first.
2. **Declare severity + Incident Owner** and open a restricted incident record (Paperclip issue
   for ownership; keep secrets/PII out of it per the company policy).
3. **Capture evidence**: timestamps, Render deploy id + commit SHA, `/health/ready` `blockers`,
   Sentry ids, Stripe event ids, affected user ids. Screenshot with secrets redacted.
4. **Classify the blocker** into one of the four playbooks in section 6 and follow it.
5. **Post the holding comms** (section 7) if any buyer or capturer is affected — approved by
   Tier 3 or delegate.

## 4. Rollback procedure (Render-managed)

Blueprint-WebApp deploys through Render (`render.yaml`, `autoDeploy: false` — deploys are
CI-gated via `.github/workflows/deploy.yml`); there is **no manual `deploy.sh`**. Roll back by
redeploying the last known-good git commit on the same Render service, gated by a health check,
using `scripts/rollback-deploy.sh` (see also the Rollback section of `DEPLOYMENT.md` and
`docs/runbooks/CI_GATED_DEPLOY_AND_RELEASE.md`). The current live SHA is readable at
`GET /version.json`.

Preconditions: `RENDER_API_KEY` and `RENDER_SERVICE_ID` (the beta web service, `srv_...`),
and the target commit fetched locally (`git fetch --all`).

```bash
# 1. Find the last known-good commit (the deploy before the bad one).
#    Render dashboard -> service -> Events, or `git log --oneline` on the release branch.

# 2. Dry-run to confirm the plan (no API calls, no health checks):
scripts/rollback-deploy.sh --commit <known-good-sha> --service-id srv_xxxxxxxx --dry-run

# 3. Execute the rollback (redeploys the SHA on Render, then health-gates the result):
RENDER_API_KEY=rnd_xxx RENDER_SERVICE_ID=srv_xxxxxxxx \
  scripts/rollback-deploy.sh \
    --commit <known-good-sha> \
    --base-url https://tryblueprint.io \
    --yes
```

Behavior and safety:

- No destructive default — you must pass an explicit `--commit`. The script verifies the SHA
  exists in the checkout before calling Render.
- It records the current live commit, triggers the rollback deploy, polls until Render reports
  `live` (or fails), then verifies `/health` (200 `healthy`) and `/health/ready` (200 `ready`)
  with retries against `--base-url`.
- Exit `0` = rolled back and healthy. Exit `2` = the rollback deploy did **not** go live, or the
  rolled-back version is not serving/ready — the script never rolls forward to the broken build;
  **escalate to Tier 2/3.**

If Render itself is unreachable, roll back from the Render dashboard
(Service → Deploys → the known-good deploy → **Rollback**), then run the health checks manually:

```bash
curl -fsS https://tryblueprint.io/health | jq .
curl -fsS https://tryblueprint.io/health/ready | jq '.status, .blockers'
```

## 5. Data takedown / deletion drill

Use when a capture, site world, buyer record, or contact must be pulled for a rights, privacy,
takedown, or deletion request. Get Tier-3 (or delegated) sign-off first; log the request id.

1. **Freeze visibility first (reversible).** Unpublish/hide the affected site world so it stops
   serving to buyers before you delete anything. Confirm it no longer appears on public
   world-model pages (`/health/ready` and the marketplace listing should no longer surface it).
2. **Suspend hosted access.** Revoke live hosted-session entitlements for the item so active
   buyers are cut off. Live session state is in Redis (`REDIS_URL`) with a Firestore mirror —
   clearing the entitlement in Firestore and letting Redis sessions expire cuts access; force
   Redis key removal if immediate cutoff is required.
3. **Take down stored objects.** Remove the underlying capture/media from the active storage
   provider: Firebase Storage when `BLUEPRINT_STORAGE_PROVIDER=firebase`, or Backblaze B2 when
   `=backblaze` (objects written via `/api/storage/uploads`). Record object paths before delete.
4. **Purge datastore records.** Delete/redact the Firestore documents (capture submission,
   marketplace item, entitlement, inbound request; inbound contact/request fields are
   field-encrypted). Preserve a restricted, redacted evidence copy per the company policy —
   do **not** put PII/secrets in the Paperclip issue.
5. **Stop downstream propagation.** If the item was forwarded to the Pipeline intake / robot-eval
   lane (`ROBOT_EVAL_JOB_REQUEST_FORWARD_URL`), notify the Pipeline owner to purge/stop the
   corresponding job so the capture is not re-derived downstream.
6. **Verify + record.** Re-check public pages, marketplace, and storage show the item gone. Log
   what was removed, where, when, by whom, and the requester, in the restricted record.

Drill this quarterly against a disposable test capture so steps 1–6 are muscle memory.

## 6. Degraded-state playbooks (the R038 blocker classes)

Each playbook: **detect → contain → mitigate/roll back → what to say**. Comms copy is in section 7.

### 6a. Upload failure

- **Detect**: capturers/buyers cannot upload; `/api/storage/uploads` 5xx (Backblaze mode) or
  Firebase Storage SDK write errors (Firebase mode); spike in client upload errors in Sentry.
- **Contain**: confirm which provider is active (`BLUEPRINT_STORAGE_PROVIDER`). Check the
  provider dashboard (Firebase Storage or Backblaze B2 credentials/bucket). If a recent deploy
  changed storage config, **roll back** (section 4).
- **Mitigate**: if one provider is down and the other is configured and safe, failover is a
  **Tier-2 change**, not a default. Do not expose Backblaze keys via `VITE_*`.
- **Say**: capturer "capture upload delay" copy (7b). Tell them not to delete local originals.

### 6b. Package blocked / review-required

- **Detect**: site-world packages stuck in review/blocked and not reaching buyers; pipeline sync
  failing (`PIPELINE_SYNC_TOKEN`), or `/health/ready` `blockers` reference pipeline attachment.
- **Contain**: this is often **correct fail-closed behavior** (readiness/review gate), not an
  outage — do not force-publish to clear a queue. Confirm whether the block is a real
  readiness/rights gate or a sync fault. Never fabricate readiness to unblock.
- **Mitigate**: if it is a sync fault, verify the Pipeline intake is up and the token matches;
  keep `PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS` **unset** in production (fail closed). If a
  bad deploy broke the gate, roll back.
- **Say**: buyer "package still in review" copy (7a). Do not promise a delivery time you cannot
  back with real readiness.

### 6c. Provider down (world-model backend / Pipeline intake / core dependency)

- **Detect**: `/health/ready` = `not_ready` with dependency blockers; hosted sessions failing;
  Pipeline intake / robot-eval forwarding timing out (`ROBOT_EVAL_JOB_REQUEST_FORWARD_*`);
  Firestore, Redis, or Render degraded.
- **Contain**: identify the single failing dependency from `/health/ready` `dependencies`.
  Redis has an in-process fallback with a Firestore mirror — degraded, not down. Firestore or
  Firebase Admin down is SEV-1 (checkout, entitlements, persistence depend on it).
- **Mitigate**: recover the dependency (provider dashboard / status page). If a deploy caused it,
  roll back. Keep world-model backends swappable — do not hard-pin a new primary without
  `blueprint-cto` approval.
- **Say**: buyer + capturer "temporary service degradation" copy (7a/7b). Do not claim root
  cause or ETA until confirmed.

### 6d. Payout exception

- **Detect**: capturer payouts failing or held; Stripe Connect errors; payout-triage queue
  backing up (`BLUEPRINT_PAYOUT_TRIAGE_ENABLED`); Stripe webhook (`STRIPE_WEBHOOK_SECRET`)
  delivery failures.
- **Contain**: check the Stripe dashboard (Connect account `STRIPE_CONNECT_ACCOUNT_ID`, payout
  status, webhook deliveries). **Do not move funds or resolve a payout manually** — payouts and
  refunds are Tier-3 / finance decisions. The triage lane only flags; it does not release money.
- **Mitigate**: if webhooks are failing due to a deploy/config change, roll back and let Stripe
  redeliver. Preserve Stripe event ids.
- **Say**: capturer "payout delay" copy (7b). Never quote a payout date without finance sign-off.

## 7. Communication templates

Fill bracketed fields. Tier-3 (or delegate) approves anything customer-facing. Keep it honest —
no fabricated cause, ETA, or "resolved" claim before it is true.

### 7a. Buyer copy blocks

Degraded / temporary service issue:

```
Subject: Blueprint — temporary service issue

We're aware of an issue affecting [hosted access / checkout / <feature>] and are working on it
now. Your data and purchases are safe. We'll update you by [time]. Nothing is required from you.
— The Blueprint team
```

Package still in review (6b):

```
Your site world [<name>] is still completing readiness review and isn't published yet. We don't
release a package until its readiness checks pass, so it may take longer than expected. We'll
notify you the moment it's live. Thank you for your patience.
```

Resolved:

```
The earlier issue with [<feature>] is resolved as of [time]. [Optional: brief, factual note on
impact.] Thank you for bearing with us — reach us at [BLUEPRINT_SUPPORT_EMAIL] with any questions.
```

### 7b. Capturer copy blocks

Capture upload delay (6a):

```
Heads up: uploads are delayed right now and we're on it. Please keep your local capture files —
do not delete originals. You don't need to re-upload; we'll confirm here when uploads are flowing
again. Sorry for the hassle.
```

Payout delay (6d):

```
We've spotted a delay affecting some payouts and are investigating with our payments provider.
Your earnings are tracked and safe. We'll follow up with a status update; we won't have a payout
date until this is confirmed. Thanks for your patience.
```

### 7c. Internal status line (Slack / status record)

```
[SEV-x] [component] — [one-line impact]. Owner: [name]. Started: [ts]. Action: [rollback/…].
Next update: [ts]. Buyer/capturer impact: [yes/no]. Deploy: [commit/deploy id].
```

## 8. After the incident

Follow `docs/company/incident-response-and-escalation.md`: SEV-1/SEV-2 post-incident review
within five business days — timeline, root cause, corrective actions with owners in Paperclip,
and update this runbook/tests. If the response exposed a rollback or takedown gap, fix it here.

## 9. Cross-references

- Company policy (severity, evidence, legal): `docs/company/incident-response-and-escalation.md`
- Rollback tool: `scripts/rollback-deploy.sh`
- Deploy + rollback + env reference: `DEPLOYMENT.md`
- Render service definition: `render.yaml`
- Launch/health verification: `npm run smoke:launch`, `npm run alpha:preflight`
- Health routes: `server/routes/health.ts` (`/health`, `/health/ready`, `/health/status`)
