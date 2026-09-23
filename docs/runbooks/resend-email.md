# Resend application email runbook

Owner identity: `ohstnhunt@gmail.com`. Sending domain: `tryblueprint.io`.
This runbook covers application outbound mail and delivery events. Human replies to
`hello@` and `support@` stay on the existing Google mailbox route. The apex MX
currently points to Google; do not replace it with Resend receiving MX records.

## Account and DNS

1. The owner signs in to Resend, creates the team, and enables MFA. Start on the
   free transactional plan; upgrade only when send volume or the daily cap needs
   it. No seat or sender-address purchase is needed for multiple addresses on
   the verified domain.
2. Add `tryblueprint.io` as a **sending** domain. Copy the exact DKIM TXT and
   sending CNAME records displayed by Resend into the authoritative DNS zone.
   Keep the existing Google apex MX and SPF records. Resend receiving stays off.
   The initial DMARC record is `v=DMARC1; p=none;`; review alignment before
   moving to an enforcement policy. Do not guess DNS values.
3. Wait for Resend to report sending verification for the domain. Set
   `BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified` only after that
   provider-side proof is visible for the chosen city-launch From address.

## Runtime secrets and addresses

Use a Resend API key restricted to **sending access** and, when rotated, to
`tryblueprint.io`. Store the local copy in
`~/.blueprint-secrets/resend_api_key` with a `0700` parent directory and `0600`
file; store the deployment copy only in Render's secret environment as
`RESEND_API_KEY`. Set `RESEND_FROM_EMAIL=noreply@tryblueprint.io` and
`RESEND_FROM_NAME=Blueprint`. Callers may select another sender on the same
verified domain when a replyable flow requires it. Set `replyTo` to the real
human-monitored inbox for conversations; never route replies to `noreply@`.
Local development automatically reads the protected key file when no environment
key is set. For other file-backed deployments, set `RESEND_API_KEY_FILE` to an
explicit protected path.

Create one Resend webhook endpoint at
`https://<production-host>/api/growth/webhooks/resend`, selecting at least
`email.sent`, `email.delivered`, `email.bounced`, `email.complained`,
`email.failed`, and `email.suppressed`. Store its `whsec_...` signing secret as
`RESEND_WEBHOOK_SECRET` in Render. The endpoint verifies the original request
body with Svix headers, records events idempotently, and applies complaint
suppression to lifecycle and growth campaigns.

Remove `SENDGRID_*` and `SMTP_*` variables from Render only after the Resend
release is live and a controlled send plus webhook delivery proof has passed.
The new application code never reads those variables or falls back to another
sender, so a Resend failure stays visible as a failed dispatch. Keep the Google
OAuth configuration for the approved human-reply watcher; it is an inbox path,
not an automated outbound transport.

## Cutover proof

- Run the local TypeScript check and focused email/growth tests before deploy.
- Verify the deployed release identity and `getEmailTransportStatus()` reports
  `provider=resend`. Configuration alone does not establish DNS verification.
- Send one controlled message to an approved internal recipient or Resend's
  documented test recipient. Match the returned Resend email ID to an
  `email.delivered` event in the signed webhook ledger. An API acceptance ID
  alone does not prove inbox delivery.
- Confirm `hello@` and `support@` still receive mail through Google and the
  existing human reply watcher still resolves to `ohstnhunt@gmail.com`.
- Check bounce and complaint handling before enabling any governed growth send.
  Existing recipient evidence, approval, suppression, and human gates remain
  required; provider configuration grants no new send authority.

## Initial setup evidence (2026-09-23)

- Resend account owner: `ohstnhunt@gmail.com`; free transactional plan.
- `tryblueprint.io` showed **Verified** in Resend with sending on and receiving off.
- Namecheap authoritative DNS served the Resend DKIM TXT, `rsend` and `send`
  CNAMEs, and `_dmarc` TXT (`p=none`). The Google apex MX and SPF remained in
  place.
- A controlled message from `noreply@tryblueprint.io` to the owner was accepted
  as Resend email `01a0cf1c-0c93-77bb-98ab-3cc48af0bf99` and then showed
  **Delivered** in the Resend dashboard.
- The web service has masked `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
  `RESEND_FROM_NAME`, and `RESEND_WEBHOOK_SECRET` entries saved in Render.
  The webhook is enabled at the production URL for sent, delivered, bounced,
  complained, failed, and suppressed events.

## Production cutover evidence (2026-09-23)

- PR #684 merged as `9ca5f3d07ae5a702ab8acda75056efdff913ecd7`.
  The exact `main` CI run `35893255893` passed check, build, tests, e2e,
  and Firebase rules. The CI-gated Render run `35894105989` succeeded, and
  `https://tryblueprint.io/version.json` reported that exact SHA.
- A controlled message from `Blueprint <noreply@tryblueprint.io>` to the owner
  was accepted as Resend email `01a0cf45-438d-72c8-a4af-0749515658ab` and
  showed **Delivered**. The signed `email.sent` and `email.delivered` webhook
  records for that email ID each received HTTP 202 with `{ "ok": true }` from
  the live route. An unsigned request to the route received HTTP 401.
- Render's saved web-service environment now has the three `SENDGRID_*`
  entries removed and `BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified` set
  against the provider-verified default sender. A subsequent CI-gated deploy
  applies this saved environment to the running process. Verify that deploy
  before claiming the runtime environment is clean.
