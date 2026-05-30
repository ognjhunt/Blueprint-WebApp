# Local Operator Provider And Worker Readiness

Generated: 2026-05-25
Refreshed: 2026-05-30 after routine `status: paused` handling and the `browse` desired-skill alias were reconciled against local config.

Scope: local env/config inspection only. This report did not configure providers, call paid APIs, deploy, send, write Notion/Firebase/Stripe/Paperclip state, or mutate live systems.

## Provider Runtime Readiness

Command: `npm run alpha:env`

### Required-ready

- Firebase Admin: env path present through `FIREBASE_SERVICE_ACCOUNT_JSON | GOOGLE_APPLICATION_CREDENTIALS`.
- Structured runtime provider: env path present through `DEEPSEEK_API_KEY | OPENAI_API_KEY | ANTHROPIC_API_KEY | ACP_HARNESS_URL`.
- Stripe checkout + payout wiring: `STRIPE_SECRET_KEY`, `STRIPE_CONNECT_ACCOUNT_ID`, `STRIPE_WEBHOOK_SECRET`, and `CHECKOUT_ALLOWED_ORIGINS` present.
- Autonomous alpha lane enables: required `BLUEPRINT_*_ENABLED=1` lane flags present.
- Post-signup Google auth: Google auth plus calendar/sheet ids present.
- Slack notifications: `SLACK_WEBHOOK_URL` present.
- Email delivery: SendGrid or SMTP transport env present.
- Research outbound prerequisites: Firehose token/base URL and research topics present.

### Blocked-by-env

- None in the current local shell.

### Recommended-missing

- Redis live session state: missing `REDIS_URL`.
- Web voice concierge: missing `ELEVENLABS_API_KEY` and/or `ELEVENLABS_VOICE_ID`.
- PSTN voice intake: missing `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and/or `TWILIO_PHONE_NUMBER`.

### Needs-human

- City-launch sender verification: sender env is present, but local env cannot prove provider-side sender/domain verification.
- Provider billing/OAuth/live-call verification: local env includes provider credentials, but this report intentionally does not make paid provider calls. Account, billing, OAuth, and quota state remain human/provider-dashboard verification items before any Operational Launch Ready claim.

## Worker And Routine Readiness

Command: `npm run paperclip:control-room:inventory`

- Agents: 46.
- Adapters: 10 `codex_local`, 36 `hermes_local`.
- Routines: 62.
- Routine status: 36 active, 26 paused.
- Routine readiness classes: 36 `required-ready`, 26 `blocked-by-env`, 0 `recommended-missing`, 0 `needs-human`.
- Routine concurrency/catch-up: all 62 use `coalesce_if_active` and `skip_missed`.
- Codex `/goal` enabled lanes: `capture-codex`, `capture-review`, `conversion-agent`, `docs-agent`, `pipeline-codex`, `pipeline-review`, `webapp-codex`, `webapp-review`.
- Codex `/goal` disabled lanes: `beta-launch-commander`, `blueprint-cto`.
- Desired skills: 2 local alias mappings (`browse` -> `control-in-app-browser`, `vercel-react-best-practices` -> `react-best-practices`), 51 intentional non-local company-library/runtime/tooling deferrals, 0 true missing desiredSkills, 0 ambiguous candidate gaps.

## Truth Boundary

This report proves local readiness classification and checked-in worker/routine configuration only. It does not prove live Paperclip process health, provider account health, Redis connectivity, voice/PSTN readiness, live sender verification, successful payments, provider execution, Notion sync, or operational launch completion.
