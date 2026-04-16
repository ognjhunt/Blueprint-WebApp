# Autonomous Org Launch Checklist

Last audited: 2026-04-12

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

Observed on 2026-04-12:

- Completed: targeted city-launch and autonomy verification
  Result: city-launch planning and execution harnesses, autonomy scheduler, autonomous outbound, and creative factory tests are passing in-repo.
- Completed: `npm run check`
  Result: passing.
- Completed: `npm run smoke:agent`
  Result: passed locally against `codex_local` with `gpt-5.4-mini`.
- Completed with waivers: `npm run alpha:preflight`
  Result: passes in `local_test` mode, but only because Stripe and research-outbound requirements are waived in this workspace.
- Completed: generic city launcher architecture
  Result: the WebApp now supports generic city launch packet generation, Paperclip issue-tree dispatch, machine-readable budget policy, and canonical city ledgers for prospects, buyer targets, first touches, and spend.
- Still blocked for public autonomous alpha: production credentials, connectors, and live-service wiring
  Result: public launch still requires production Stripe, research-outbound credentials, Redis, connector health, and real operator-backed field execution.

Human-gate packet rule:

- When a launch blocker is truly human-gated, use `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/programs/human-blocker-packet-standard.md`.
- Use `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/programs/human-reply-handling-contract.md` for watcher ownership and execution handoff after the human reply lands.
- Default fast escalation channel: Slack DM to `Nijel Hunt`.
- Default durable escalation channel: email to `ohstnhunt@gmail.com`.
- Record the human response in the owning issue, report, or run artifact, then continue execution immediately.

## Checklist

- [x] Product code gate passes
  Evidence: run `npm run alpha:check`
  Pass condition: no typecheck errors, no failed tests, no skipped assertions.

- [x] Paperclip agent kits are structurally valid
  Evidence: run `bash scripts/paperclip/validate-agent-kits.sh`
  Pass condition: `Agent kit validation passed.`

- [x] Local production-mode smoke path exists
  Evidence: run `npm run smoke:launch:local`
  Pass condition: the built webapp can pass launch smoke locally under the documented local smoke profile without requiring full live Stripe or research-outbound credentials.

- [x] Local Paperclip company and plugin exist
  Evidence: `GET /api/companies`, `GET /api/plugins`, plugin dashboard returns successfully
  Pass condition: company `Blueprint Autonomous Operations` exists and plugin `blueprint.automation` is installed and `ready`.

- [ ] Firebase Admin is live for production
  Required env: `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
  Why it blocks launch: buyer checkout auth, entitlements, pipeline attachment sync, queue persistence, and Firestore-backed automations depend on it.

- [ ] Field encryption is live for production
  Required env: `FIELD_ENCRYPTION_MASTER_KEY` or `FIELD_ENCRYPTION_KMS_KEY_NAME`
  Why it blocks launch: inbound request storage encrypts contact and request fields before writing to Firestore, so buyer intake can fail even when broader readiness appears healthy.

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

- [ ] Human-reply watcher path is truthful for production human gates
  Evidence: run `npm run human-replies:audit-gmail`
  Required for durable email watcher: `BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID`, `BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET`, `BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN`
  Required identity: authenticated Gmail mailbox must equal `ohstnhunt@gmail.com`
  Required durability declaration: `BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS=production`
  Why it blocks autonomous follow-through: a blocker packet is not agent-resumable unless the human reply can be observed and routed back into the owning lane.

- [ ] Slack reply watcher policy is explicit if Slack is used as a resumable channel
  Required env for DM support: `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOW_DMS=1`
  Required env for channel-thread support: `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOWED_CHANNELS`
  Pass condition:
  - the bot is actually present in the DM or channel thread
  - channel replies happen in threads, not root posts
  - if those conditions are not true, Slack is treated as a mirror only and email remains the durable blocker path

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
  - `OPENROUTER_API_KEY`
  Recommended:
  - `OPENROUTER_BASE_URL`
  Notes:
  - final image execution should route to `webapp-codex` using Codex desktop OAuth image generation on `gpt-image-1.5`
  - no separate server-side image API key is required for that final image lane

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

- [x] Generic city launcher is implemented in-repo
  Evidence:
  - `server/utils/cityLaunchExecutionHarness.ts`
  - `server/utils/cityLaunchLedgers.ts`
  - `server/utils/cityLaunchScorecard.ts`
  Pass condition:
  - any city can produce a launch packet
  - the harness can create the routed Paperclip issue tree
  - scorecards can read canonical outreach and spend ledgers

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

When the target environment is a local workspace instead of a deployed service, use `npm run smoke:launch:local` as the local parity gate and reserve `npm run smoke:launch` for preview or production targets.

If any one of those fails, the autonomous organization is still in assisted-launch mode rather than public autonomous-alpha mode.

Additional rule:

- Do not widen beyond one active city until one city has real proof-ready listings, hosted reviews, and onboarded capturers recorded in the canonical city ledgers.

## Render Import Files

For Render env setup, start from:

- [render.required.env.example](/Users/nijelhunt_1/workspace/Blueprint-WebApp/render.required.env.example)
- [render.optional.env.example](/Users/nijelhunt_1/workspace/Blueprint-WebApp/render.optional.env.example)

Use [`.env.example`](/Users/nijelhunt_1/workspace/Blueprint-WebApp/.env.example) as the superset reference when you need a key that is not part of the initial Render launch cut.
