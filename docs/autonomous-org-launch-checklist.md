# Autonomous Org Launch Checklist

Last audited: 2026-04-02

This checklist is the execution-order runbook for deciding whether Blueprint's Hermes/Paperclip autonomous organization is ready for public alpha launch.

Use it in order. Do not skip ahead to Paperclip adapter checks and assume launch readiness if the product-side alpha gate is still failing.

## Launch Decision

### Internal launch

Good enough when all of these are true:

- `npm run alpha:check` passes
- local Paperclip company + plugin + routines verify
- the team understands which lanes remain permanently human-gated

### Public autonomous alpha launch

Good enough only when all of these are true:

- every internal-launch item passes
- `npm run alpha:preflight` passes with no required failures
- `npm run smoke:agent` passes
- `scripts/paperclip/verify-blueprint-paperclip.sh --smoke` passes
- GitHub webhook/plugin config and server-side Google Calendar wiring are complete
- paid buyer flows, ops notifications, and production automation lanes are backed by real credentials, not local fallbacks

## Current Status

Observed on 2026-04-02:

- Completed: `npm run alpha:check`
  Result: passed with `557` assertions and `0` skipped.
- Completed: `bash scripts/paperclip/validate-agent-kits.sh`
  Result: passed.
- Completed: local Paperclip API spot-check
  Result: company record resolved, `blueprint.automation` plugin exists, `436` routines found, `40` active.
- Blocked: `npm run alpha:preflight`
  Result: missing production env/secrets and required autonomous-lane enables.
- Blocked: `npm run smoke:agent`
  Result: Firebase Admin not configured and no primary structured agent runtime provider configured.
- Blocked: `bash scripts/paperclip/verify-blueprint-paperclip.sh`
  Result: GitHub prereq envs are present, but calendar-backed field-ops prerequisites and manual connector re-auth are still outstanding.

## Checklist

- [x] Product code gate passes
  Evidence: run `npm run alpha:check`
  Pass condition: no typecheck errors, no failed tests, no skipped assertions.

- [x] Paperclip agent kits are structurally valid
  Evidence: run `bash scripts/paperclip/validate-agent-kits.sh`
  Pass condition: `Agent kit validation passed.`

- [x] Local Paperclip company and plugin exist
  Evidence: `GET /api/companies`, `GET /api/plugins`, plugin dashboard returns successfully
  Pass condition: company `Blueprint Autonomous Operations` exists and plugin `blueprint.automation` is installed and `ready`.

- [ ] Firebase Admin is live for production
  Required env: `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
  Why it blocks launch: buyer checkout auth, entitlements, pipeline attachment sync, queue persistence, and Firestore-backed automations depend on it.

- [ ] One structured automation provider is live
  Required runtime: local Codex OAuth, or one of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `ACP_HARNESS_URL`
  Why it blocks launch: autonomous lanes cannot run real agent tasks without it.

- [ ] Stripe production wiring is complete
  Required env:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_CONNECT_ACCOUNT_ID`
  - `STRIPE_WEBHOOK_SECRET`
  - `CHECKOUT_ALLOWED_ORIGINS`
  Why it blocks launch: checkout, onboarding, and creator payout flows are not production-ready without it.

- [ ] Required autonomous alpha lanes are explicitly enabled
  Required env:
  - `BLUEPRINT_WAITLIST_AUTOMATION_ENABLED=1`
  - `BLUEPRINT_INBOUND_AUTOMATION_ENABLED=1`
  - `BLUEPRINT_SUPPORT_TRIAGE_ENABLED=1`
  - `BLUEPRINT_PAYOUT_TRIAGE_ENABLED=1`
  - `BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED=1`
  - `BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED=1`
  - `BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED=1`
  - `BLUEPRINT_CREATIVE_FACTORY_ENABLED=1`
  - `BLUEPRINT_BUYER_LIFECYCLE_ENABLED=1`
  Why it blocks launch: the repo's own preflight treats missing lane enables as a launch failure for the autonomous-alpha configuration.

- [ ] Post-signup automation path is wired
  Required env:
  - Google auth via `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`, or Firebase/GCP service-account reuse
  - `GOOGLE_CALENDAR_ID`
  - `POST_SIGNUP_SPREADSHEET_ID` or `SPREADSHEET_ID`
  - `SLACK_WEBHOOK_URL`
  - email transport via SendGrid or SMTP
  Why it blocks launch: post-signup scheduling, sheet updates, and ops notifications are part of the live automation path.

- [ ] Research outbound path is wired if that lane is enabled
  Required env:
  - `FIREHOSE_API_TOKEN`
  - `FIREHOSE_BASE_URL`
  - `BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS`
  - delivery path:
    - SendGrid/SMTP plus `BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS`, or
    - SendGrid plus the required `SENDGRID_*` configuration and recipient lists

- [ ] Creative factory path is wired if that lane is enabled
  Required env:
  - `GOOGLE_GENAI_API_KEY` or `GEMINI_API_KEY`
  - `RUNWAY_API_KEY`
  Recommended:
  - `RUNWAY_BASE_URL`

- [ ] Buyer lifecycle path is wired if that lane is enabled
  Required env:
  - email transport via SendGrid or SMTP
  Recommended:
  - `BLUEPRINT_VOICE_BOOKING_URL`

- [ ] GitHub webhook/plugin config is healthy
  Evidence: follow [paperclip-connector-recovery-runbook.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/paperclip-connector-recovery-runbook.md)
  Pass condition: GitHub-dependent lanes stop surfacing webhook/plugin failures.

- [ ] Server-side Google Calendar wiring is healthy
  Evidence: follow [paperclip-connector-recovery-runbook.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/paperclip-connector-recovery-runbook.md)
  Pass condition: field-ops agent can complete a real calendar-backed booking/reschedule path without calendar-config failures.

- [ ] Agent runtime smoke passes against the selected provider
  Evidence: run `npm run smoke:agent`
  Pass condition: smoke task completes successfully with the configured provider.

- [ ] Paperclip verification passes with smoke enabled
  Evidence: run `bash scripts/paperclip/verify-blueprint-paperclip.sh --smoke`
  Pass condition: shared instance, plugin, routines, adapter probes, and plugin smoke checks all pass.

- [ ] Optional but recommended live-service hardening is in place
  Recommended env:
  - `REDIS_URL`
  - `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
  Notes:
  - Redis is recommended for live hosted-session state.
  - Voice and telephony are not hard launch blockers in the current repo gate, but they should not be advertised as live if they are unset.

## Final Go / No-Go Rule

Call it launch-ready only if the following commands all pass in the target environment:

```bash
npm run alpha:check
npm run alpha:preflight
npm run smoke:agent
bash scripts/paperclip/verify-blueprint-paperclip.sh --smoke
```

If any one of those fails, the autonomous organization is still in assisted-launch mode rather than public autonomous-alpha mode.

## Render Import Files

For Render env setup, start from:

- [render.required.env.example](/Users/nijelhunt_1/workspace/Blueprint-WebApp/render.required.env.example)
- [render.optional.env.example](/Users/nijelhunt_1/workspace/Blueprint-WebApp/render.optional.env.example)

Use [`.env.example`](/Users/nijelhunt_1/workspace/Blueprint-WebApp/.env.example) as the superset reference when you need a key that is not part of the initial Render launch cut.
