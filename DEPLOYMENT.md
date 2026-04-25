# Blueprint Deployment

## Build and Runtime

Blueprint uses a single build pipeline:

```bash
npm ci
npm run check
npm run test:coverage
npm run build
```

Release gate:

```bash
npm run alpha:check
```

Launch preflight:

```bash
npm run alpha:preflight
```

Live alpha smoke:

```bash
npm run smoke:launch
```

- Client build: Vite (`dist/public`)
- Server build: esbuild bundle from `server/index.ts` (`dist/index.js`)
- Runtime start command:

```bash
npm start
```

## Render Blueprint

The repo now includes [render.yaml](/Users/nijelhunt_1/workspace/Blueprint-WebApp/render.yaml) for the primary alpha deployment path.

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/health/ready`

Render should hold all secrets in the service environment, not in `render.yaml`.

## Required Environment Variables

### Firebase (client)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- Optional: `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_MEASUREMENT_ID`

Launch-critical note:
- The client no longer falls back to source-level Firebase values. These variables must be present in the runtime environment used for builds and tests.

### Firebase Admin (server)
Provide one of the following, or run on Cloud Run / Cloud Functions with an attached service account:
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_APPLICATION_CREDENTIALS`

Launch-critical note:
- Buyer checkout auth, marketplace entitlements, pipeline attachment sync, creator ledgers, and inbound request persistence all depend on Firebase Admin being live in production.

### Field Encryption (server)
- one of:
  - `FIELD_ENCRYPTION_MASTER_KEY`
  - `FIELD_ENCRYPTION_KMS_KEY_NAME`

Launch-critical note:
- Inbound request persistence encrypts contact and request fields before storage.
- If neither field-encryption env is configured, `/api/inbound-request` can fail even when `/health/ready` would otherwise look healthy.

### Contact + Signup Links
- `VITE_PUBLIC_APP_URL` (canonical public origin used for generated links)
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_APP_ID`
- Optional: `VITE_GOOGLE_MAPS_API_KEY`

### Stripe (server)
- `STRIPE_SECRET_KEY`
- `STRIPE_CONNECT_ACCOUNT_ID`
- `STRIPE_WEBHOOK_SECRET`
- `CHECKOUT_ALLOWED_ORIGINS`
- Optional: `STRIPE_PUBLIC_BASE_URL`, `STRIPE_ONBOARDING_REFRESH_URL`, `STRIPE_ONBOARDING_RETURN_URL`

### Agent Runtime (server)
- one of:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `ACP_HARNESS_URL`
- Optional provider selection:
  - `BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER`
  - `BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER`
- Optional: `OPENAI_DEFAULT_MODEL`
- Optional: `ANTHROPIC_DEFAULT_MODEL`
- Optional: `ACP_DEFAULT_HARNESS`
- Optional analytics mirror:
  `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1`
- Optional per-lane overrides:
  `OPENAI_WAITLIST_AUTOMATION_MODEL`,
  `OPENAI_INBOUND_QUALIFICATION_MODEL`,
  `OPENAI_POST_SIGNUP_MODEL`,
  `OPENAI_SUPPORT_TRIAGE_MODEL`,
  `OPENAI_PAYOUT_EXCEPTION_MODEL`,
  `OPENAI_PREVIEW_DIAGNOSIS_MODEL`,
  `OPENAI_OPERATOR_THREAD_MODEL`
- Anthropic per-lane overrides are also supported:
  `ANTHROPIC_WAITLIST_AUTOMATION_MODEL`,
  `ANTHROPIC_INBOUND_QUALIFICATION_MODEL`,
  `ANTHROPIC_POST_SIGNUP_MODEL`,
  `ANTHROPIC_SUPPORT_TRIAGE_MODEL`,
  `ANTHROPIC_PAYOUT_EXCEPTION_MODEL`,
  `ANTHROPIC_PREVIEW_DIAGNOSIS_MODEL`,
  `ANTHROPIC_OPERATOR_THREAD_MODEL`
- Optional Gemini Deep Research overrides:
  `BLUEPRINT_DEEP_RESEARCH_AGENT`
  `BLUEPRINT_CITY_LAUNCH_DEEP_RESEARCH_AGENT`
  `BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE`
  `BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE`
  `BLUEPRINT_DEEP_RESEARCH_MCP_SERVERS_JSON`
  `BLUEPRINT_CITY_LAUNCH_DEEP_RESEARCH_MCP_SERVERS_JSON`
- Optional Parallel Search MCP-backed agent web tools:
  `SEARCH_API_PROVIDER=parallel_mcp`
  `PARALLEL_API_KEY` only when using an authenticated Parallel account for higher rate limits/account attribution

Deep Research notes:
- The repo defaults async Deep Research harnesses to Gemini Deep Research Max (`deep-research-max-preview-04-2026`).
- Use `BLUEPRINT_DEEP_RESEARCH_AGENT=standard` only when you deliberately want the lower-latency Deep Research agent instead of Max.
- `*_MCP_SERVERS_JSON` must be a JSON array of remote MCP server configs with `name`, `url`, optional `headers`, and optional `allowed_tools`.
- The Blueprint automation plugin registers `web-search` without a key when `SEARCH_API_PROVIDER=parallel_mcp`; it also registers `web-fetch` for specific public URL extraction through Parallel Search MCP.

### Internal Marketplace + Pipeline
- `PIPELINE_SYNC_TOKEN`
- `BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET`
- Optional internal-only fallback: `PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS=true`
- Optional internal demo flags: `BLUEPRINT_ENABLE_DEMO_SITE_WORLDS=1`, `BLUEPRINT_DEMO_BUNDLE_PIPELINE_ROOT=/abs/path`, `BLUEPRINT_HOSTED_DEMO_SITE_WORLD_ID=<id>`

Launch-critical note:
- Leave `PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS` unset in paid/production flows so pipeline sync fails closed when inbound request bootstrap is missing.
- Leave demo site-world flags unset in production unless you explicitly want the internal demo world exposed.

### Redis (server, recommended for live hosted sessions)
- Optional but recommended: `REDIS_URL`
- Optional: `RATE_LIMIT_REDIS_URL` if you want rate limiting isolated from session live-state storage

For Upstash, use the TLS Redis URL from the Connect panel, for example:

```bash
REDIS_URL=rediss://default:<token>@active-phoenix-39183.upstash.io:6379
```

### Error Tracking
- Optional: `VITE_SENTRY_DSN`
- Optional: `VITE_ENABLE_ERROR_TRACKING_SMOKE_TEST=true`

### Growth Ops
- Optional PostHog client vars:
  `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN`
  `VITE_PUBLIC_POSTHOG_HOST`
- Optional GA4 override:
  `VITE_GA_MEASUREMENT_ID`
  `VITE_FIREBASE_MEASUREMENT_ID` as the documented fallback alias when the GA-specific key is not set
- Optional first-party growth event mirror:
  `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1`
- Optional SendGrid email delivery:
  `SENDGRID_API_KEY`
  `SENDGRID_FROM_EMAIL`
  `SENDGRID_FROM_NAME`
  `SENDGRID_EVENT_WEBHOOK_SECRET`
- Optional city-launch outbound sender overrides:
  `BLUEPRINT_CITY_LAUNCH_FROM_EMAIL`
  `BLUEPRINT_CITY_LAUNCH_FROM_NAME`
  `BLUEPRINT_CITY_LAUNCH_REPLY_TO`
  `BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION`
- Optional governed external city-launch contact discovery:
  `BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_ENABLED=1`
  `BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_ALLOWED_HOSTS`
  `BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_ENABLED=1`
  `BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_URL`
  `BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_ALLOWED_HOSTS`
- Optional human-reply ingest and email watcher:
  `BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN`
  `BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_QUERY`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED=1`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_INTERVAL_MS`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_BATCH_SIZE`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_STARTUP_DELAY_MS`
- Optional Slack human-reply watcher policy:
  `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOW_DMS=1`
  `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOWED_CHANNELS`
- Optional operating-graph evidence projection worker:
  `BLUEPRINT_OPERATING_GRAPH_PROJECTION_ENABLED=1`
  `BLUEPRINT_OPERATING_GRAPH_PROJECTION_INTERVAL_MS`
  `BLUEPRINT_OPERATING_GRAPH_PROJECTION_BATCH_SIZE`
  `BLUEPRINT_OPERATING_GRAPH_PROJECTION_STARTUP_DELAY_MS`
- Optional Notion operational mirror:
  `NOTION_API_KEY` or `NOTION_API_TOKEN`
  `NOTION_GROWTH_STUDIO_SHIP_BROADCAST_DB_ID`
  `NOTION_GROWTH_STUDIO_CAMPAIGN_DRAFTS_DB_ID`
  `NOTION_GROWTH_STUDIO_CREATIVE_RUNS_DB_ID`
  `NOTION_GROWTH_STUDIO_INTEGRATION_CHECKS_DB_ID`
  `NOTION_GROWTH_STUDIO_CONTENT_REVIEWS_DB_ID`

Important:
- For the Growth Studio mirror vars above, use the Notion data source UUIDs for each database, not the outer database page UUIDs.
- The Growth Studio sync path can be run by scheduler, by `POST /api/admin/growth/notion/sync`, or from the shell with `npm run notion:sync:growth-studio`.
- The human-reply Gmail watcher is valid only when the authenticated mailbox is the approved org-facing identity `ohstnhunt@gmail.com`. If Gmail OAuth resolves to another mailbox, the watcher must fail closed.
- Outbound/reply durability is production-ready only when `npm run human-replies:audit-durability` passes: sender transport is configured, the city-launch sender is marked verified, `BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN` is set, `BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=ohstnhunt@gmail.com`, Gmail OAuth is production-ready, and `BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED=1`.
- Slack remains a notification or mirror surface only for founder interrupts. The Slack human-reply env vars do not create a durable resume path by themselves.
- City-launch direct outreach is outwardly launchable only when at least one direct-outreach action has a real recipient and the active sender address is truthful.
- `BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION` is a manual mirror of sender/domain verification state for outbound city-launch mail. Use `verified` only after confirming the configured sender/domain is actually verified in the live provider; leave it unset if verification is unknown, and treat `unverified` as fail-closed for real sends.
- Governed external city-launch contact discovery is opt-in. It only fetches explicit public contact evidence from hosts listed in `BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_ALLOWED_HOSTS`, and it only accepts email addresses that appear explicitly on those pages. It does not guess, derive, or synthesize emails.
- Governed search discovery is also opt-in. When enabled, it may query only the search provider configured in `BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_URL`, only if that provider host is allowlisted in `BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_SEARCH_ALLOWED_HOSTS`, and it will only keep result URLs whose hosts are already allowed by `BLUEPRINT_CITY_LAUNCH_CONTACT_DISCOVERY_ALLOWED_HOSTS`. Search only discovers candidate public contact pages; the same explicit-email extraction rules still apply.
- `BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN` also authorizes the internal human-blocker dispatch route used by Blueprint automation tools to queue or send standard blocker packets from Paperclip agent lanes.
- `BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS` is a manual mirror of the Google OAuth consent-screen publishing state. If it is unset, treat Gmail OAuth durability as unknown rather than production-grade.
- `BLUEPRINT_OPERATING_GRAPH_PROJECTION_ENABLED=1` promotes first-party capture submissions and city-launch supply targets into append-only operating graph events. Leave disabled only when intentionally running projections by `npm run operating-graph:project` or a closure drill.
- Slack reply-watching env vars are forward-looking configuration only. Until inbound correlation and resume handoff are fully implemented, Slack replies are non-authoritative mirrors and email remains the only durable founder reply path.

### Creative Pipeline
- Codex-executed image generation is the default lane for image-heavy brand, marketing, and frontend work.
- Server-side autonomous workers no longer use paid image APIs.
- Optional OpenRouter video generation:
  `OPENROUTER_API_KEY`
  `OPENROUTER_BASE_URL`
  `BLUEPRINT_OPENROUTER_VIDEO_MODEL`

### Voice Concierge
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- Optional:
  `ELEVENLABS_TTS_MODEL_ID`
  `ELEVENLABS_AGENT_ID`
  `ELEVENLABS_WEBHOOK_SECRET`
  `BLUEPRINT_VOICE_BOOKING_URL`
  `BLUEPRINT_SUPPORT_EMAIL`
  `TWILIO_ACCOUNT_SID`
  `TWILIO_AUTH_TOKEN`
  `TWILIO_PHONE_NUMBER`
  `BLUEPRINT_VOICE_FORWARD_NUMBER`

### Autonomous Alpha Automation

These should be enabled for the no-human-in-the-loop alpha configuration:

- `BLUEPRINT_WAITLIST_AUTOMATION_ENABLED=1`
- `BLUEPRINT_INBOUND_AUTOMATION_ENABLED=1`
- `BLUEPRINT_SUPPORT_TRIAGE_ENABLED=1`
- `BLUEPRINT_PAYOUT_TRIAGE_ENABLED=1`
- `BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED=1`
- `BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED=1`
- `BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED=1`
- `BLUEPRINT_CREATIVE_FACTORY_ENABLED=1`
- `BLUEPRINT_BUYER_LIFECYCLE_ENABLED=1`

Optional review-watchdog workers that only flag overdue human queues:

- `BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_ENABLED=1`
- `BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_ENABLED=1`

These watchdogs do not send outreach, grant permissions, submit disputes, or move funds. They only mark overdue review state in Firestore so operators can work the queue.
- Optional field-ops reminder worker:
  `BLUEPRINT_CAPTURER_REMINDER_ENABLED=1`
- Optional buyer lifecycle cadence overrides:
  `BLUEPRINT_BUYER_LIFECYCLE_INTERVAL_MS`,
  `BLUEPRINT_BUYER_LIFECYCLE_BATCH_SIZE`,
  `BLUEPRINT_BUYER_LIFECYCLE_STARTUP_DELAY_MS`,
  `BLUEPRINT_BUYER_LIFECYCLE_DAYS_SINCE_GRANT`
- Optional experiment autorollout cadence and thresholds:
  `BLUEPRINT_EXPERIMENT_AUTOROLLOUT_INTERVAL_MS`,
  `BLUEPRINT_EXPERIMENT_AUTOROLLOUT_LOOKBACK_DAYS`,
  `BLUEPRINT_EXPERIMENT_AUTOROLLOUT_MIN_EXPOSURES`,
  `BLUEPRINT_EXPERIMENT_AUTOROLLOUT_MIN_RELATIVE_LIFT`
- Optional autonomous research-to-outbound configuration:
  `BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_INTERVAL_MS`,
  `BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS`,
  `BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS`,
  `BLUEPRINT_AUTONOMOUS_OUTBOUND_CHANNEL`,
  `FIREHOSE_API_TOKEN`,
  `FIREHOSE_BASE_URL`
- Optional creative factory configuration:
  `BLUEPRINT_CREATIVE_FACTORY_INTERVAL_MS`,
  `BLUEPRINT_CREATIVE_FACTORY_SKU`,
  `BLUEPRINT_CREATIVE_FACTORY_AUDIENCE`,
  `BLUEPRINT_CREATIVE_FACTORY_SITE_TYPE`,
  `BLUEPRINT_CREATIVE_FACTORY_WORKFLOW`,
  `BLUEPRINT_CREATIVE_FACTORY_CTA`

Post-signup automation also requires:

- one of:
  `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`
  or `FIREBASE_SERVICE_ACCOUNT_JSON`
  or `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_CALENDAR_ID`
- `POST_SIGNUP_SPREADSHEET_ID` or `SPREADSHEET_ID`
- `SLACK_WEBHOOK_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

## Notes

- Firestore is the active datastore.
- In production, public world-model pages should surface pipeline-backed site worlds only. Static fixture cards are for non-production and explicit demo mode.
- Live hosted-session state now prefers Redis when `REDIS_URL` is configured, then falls back to in-process memory, with Firestore acting as async mirroring/trail storage.
- Marketplace checkout and artifact entitlement flows are only truthful when Firebase Admin, Stripe checkout, and Stripe webhooks are all configured together.
- Marketplace search and checkout now fail toward live `marketplace_items` inventory in production instead of silently relying on static sample content.
- Growth telemetry can now mirror experiment exposures, page views, and campaign events into Firestore when `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1`, which gives Paperclip and the analytics agent a first-party event stream even before PostHog/GA4 are fully live.
- Experiment winners can now roll themselves into production overrides through the first-party event stream when the autorollout worker is enabled.
- Autonomous research can now turn configured Firehose demand topics into draft outbound campaigns and queue them for human send approval.
- The creative pipeline now supports both the protected campaign-kit builder and a background creative factory that generates proof-led prompt packs and routes image-heavy execution to `webapp-codex` without paid image APIs. OpenRouter video remains an explicit provider path.
- The voice concierge now supports both web voice and Twilio-compatible PSTN intake. Pricing, legal, privacy, rights, contract, and irreversible commitments remain human-gated, and phone handoff can forward to a live operator when configured.
- Legacy manual deployment scripts were removed; deployment should always run through project scripts.
- `client/public/robots.txt` must exist at build time and be served in production.
- `npm run alpha:preflight` is the launch-environment validator for Render and should pass before promoting the service.
- `npm run smoke:launch` is the live alpha smoke runner for `/health`, `/health/ready`, the selected structured automation provider, inbound qualification, and post-signup workflows.
