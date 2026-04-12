# Alpha Launch Checklist

Last updated: 2026-03-22

This checklist is the concrete launch gate for `Blueprint-WebApp`.

For autonomous-org launch specifically, also use [autonomous-org-launch-checklist.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/autonomous-org-launch-checklist.md). That file is the current source of truth for Hermes/Paperclip readiness.

It is based on the repo's current deployment contract, alpha scripts, and the current implementation state.

## 1. Code Gate

- [ ] `npm run check`
- [ ] `npm run build`
- [ ] `npm run alpha:check`
- [ ] `npm run test:e2e`

Current status on 2026-03-22:

- `check`: passing
- `build`: passing
- `test:e2e`: passing
- `alpha:check`: passing
- `alpha:preflight`: failing because the launch environment is not configured in this workspace

Release rule:

- Do not launch while `alpha:check` is red.

## 2. Environment Gate

The launch environment must satisfy `npm run alpha:preflight`.

Use [`.env.example`](/Users/nijelhunt_1/workspace/Blueprint-WebApp/.env.example) as the source of truth for the required keys and example variable names.
Run `npm run alpha:env` for a grouped view of the currently missing launch env categories.
For Render import specifically, start with [render.required.env.example](/Users/nijelhunt_1/workspace/Blueprint-WebApp/render.required.env.example) and [render.optional.env.example](/Users/nijelhunt_1/workspace/Blueprint-WebApp/render.optional.env.example).

- [ ] Firebase Admin configured
  Required: `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
- [ ] Field encryption configured
  Required: `FIELD_ENCRYPTION_MASTER_KEY` or `FIELD_ENCRYPTION_KMS_KEY_NAME`
- [ ] Agent runtime configured
  Required: `OPENAI_API_KEY`
  Optional: `OPENAI_DEFAULT_MODEL` and per-lane `OPENAI_*_MODEL` overrides
- [ ] Stripe configured
  Required: `STRIPE_SECRET_KEY`, `STRIPE_CONNECT_ACCOUNT_ID`, `STRIPE_WEBHOOK_SECRET`, `CHECKOUT_ALLOWED_ORIGINS`
- [ ] Alpha automation flags enabled
  Required: `BLUEPRINT_WAITLIST_AUTOMATION_ENABLED=1`, `BLUEPRINT_INBOUND_AUTOMATION_ENABLED=1`, `BLUEPRINT_SUPPORT_TRIAGE_ENABLED=1`, `BLUEPRINT_PAYOUT_TRIAGE_ENABLED=1`, `BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED=1`
- [ ] Post-signup Google auth configured
  Required: `GOOGLE_CALENDAR_ID` plus either `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY`, or `FIREBASE_SERVICE_ACCOUNT_JSON`, or `GOOGLE_APPLICATION_CREDENTIALS`
- [ ] Post-signup sheet configured
  Required: `POST_SIGNUP_SPREADSHEET_ID` or `SPREADSHEET_ID`
- [ ] Slack notifications configured
  Required: `SLACK_WEBHOOK_URL`
- [ ] SMTP configured
  Required: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- [ ] Redis configured
  Strongly recommended: `REDIS_URL`

Release rule:

- Do not launch while `alpha:preflight` is red.

## 3. Deployment Gate

- [ ] Render service is using the expected build and start commands from `render.yaml`
- [ ] Render health check points at `/health/ready`
- [ ] All production secrets are set in Render, not in source files
- [ ] Production domain and origin settings are correct
- [ ] Demo-only site world flags are unset unless the launch explicitly includes a demo world

## 4. Live Smoke Gate

Run these against the deployed alpha environment:

- [ ] `npm run smoke:launch`
- [ ] or use a preview/sandbox target for `npm run smoke:launch` when you need full write-path verification without creating production artifacts
- [ ] `npm run smoke:agent`
- [ ] `curl -i https://<alpha-domain>/health`
- [ ] `curl -i https://<alpha-domain>/health/ready`
- [ ] `curl -i https://<alpha-domain>/health/status`

Must verify:

- [ ] OpenAI agent runtime accepts and completes a real smoke request
- [ ] Inbound request creation succeeds end to end
- [ ] Post-signup workflow succeeds end to end with real integrations
- [ ] Readiness stays `200` with launch-critical services enabled

Local parity note:

- `npm run smoke:launch:local` is the preferred local production-mode smoke path.
- It starts the built server on a clean local port and disables the known live-only local blockers for Stripe and autonomous research outbound, so the smoke can validate the webapp runtime without requiring full paid-production credentials in the local workspace.
- Do not treat `smoke:launch:local` as a replacement for deployed smoke. It is a local parity gate, not a public launch gate.

Live write policy:

- `npm run smoke:launch` now blocks write-path smoke against non-local targets unless `ALPHA_SMOKE_ALLOW_LIVE_WRITE=1` is set.
- For non-local write smoke, provide explicit values for:
  - `ALPHA_SMOKE_EMAIL`
  - `ALPHA_SMOKE_COMPANY`
  - `ALPHA_SMOKE_SITE_NAME`
- Prefer a preview/sandbox target over production whenever possible.
- If production write smoke is truly required, define a cleanup owner and use a clearly tagged smoke identity.

Human reply path:

- For true human-gated launch blockers, pair the blocker packet with the reply-handling contract in [human-reply-handling-contract.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/programs/human-reply-handling-contract.md).
- The approved durable email identity is `ohstnhunt@gmail.com`.
- Do not treat a Gmail or Slack connector bound to `hlfabhunt@gmail.com` as a valid org-facing reply watcher.
- Slack Events API request URL for this repo should be `https://tryblueprint.io/api/slack/events` after the route is deployed.

## 5. Product Flow Gate

These are the minimum truthful product flows for alpha:

- [ ] Home page routes and messaging are correct
- [ ] Contact/inbound request submission works
- [ ] Waitlist submission works
- [ ] Checkout session creation works against live Stripe config
- [ ] Stripe webhook fulfillment works and writes the expected downstream records
- [ ] Hosted session launch works for a real pipeline-backed site world
- [ ] Public world-model pages resolve pipeline-backed inventory in production

Current gap:

- Existing Playwright coverage now proves core public routes, the capture-app handoff page, and hosted-session entry routing.
- It does not yet prove live checkout, webhook fulfillment, entitlement delivery, hosted session launch, or OpenAI-backed ops.

## 6. Ops Safety Gate

The alpha may be highly automated, but it is not truly zero-touch.

Human-supervised lanes that must remain owned after launch:

- [ ] Payout exception handling and any funds movement
- [ ] Buyer-facing qualification transitions that materially change commitments
- [ ] Rights, privacy, licensing, and compliance interpretation
- [ ] Blocked post-signup workflows
- [ ] Blocked support/billing issues

Required operator posture:

- [ ] Someone is assigned to watch Slack/log alerts during launch week
- [ ] Someone is assigned to review blocked automation items at least daily
- [ ] Someone is assigned to review payout-related queues before any financial follow-up

## 7. Monitoring Gate

- [ ] Uptime monitoring is pointed at `/health/ready`
- [ ] 5xx alerting is configured from `/health/status` or logs
- [ ] Render logs are being watched for crash loops and missing env vars
- [ ] Sentry is configured if launch requires browser error visibility

## 8. First 72 Hours

- [ ] Check Render logs for restart loops and missing-secret errors
- [ ] Check blocked automation queues
- [ ] Check agent runtime connectivity and error rate
- [ ] Check Stripe webhook success/failure logs
- [ ] Check inbound request persistence and follow-up drafts
- [ ] Check hosted session failures and preview diagnosis output

## 9. Go / No-Go Rule

Launch only when all of these are true:

- `alpha:check` passes
- `alpha:preflight` passes
- `smoke:launch` passes against the deployed service
- payout and buyer-commitment lanes still fail closed to human review
- pipeline-backed hosted access works in production

If any one of those is false, the launch is not ready.
