# Autonomous Spend Observability

Date: 2026-06-01
Status: repo-local setup for read-only spend snapshots; live mutation remains disallowed

## Purpose

Give Blueprint a repeatable way to see which parts of the `$500/month` autonomous-org budget have current owner-system evidence. The collector is intentionally read-only. It must not deploy, send, buy, launch providers, create ads, mutate billing, mutate infrastructure, write Notion/Firebase/Stripe/Render, or claim Operational Launch Ready.

## Dynamic Allocation Loop

Spend observability now feeds a repo-local allocator:

`observe -> outcome snapshot -> score -> recommend -> human approval packet -> proof reconciliation -> proof intake template -> proof intake validation -> next-goal queue -> owner delegation packet -> live-action gate -> control status -> pending launch approval packet -> suite verification -> approved repo-local diff -> live system handled separately`

The spend snapshot answers what budget proof exists. The outcome snapshot answers what worked, what did not, and what is still missing proof. The recommendation step joins both with `config/autonomy/budget-allocation-policy.yaml` and emits an advisory packet under `output/autonomous-org/budget/dynamic/latest/`. The reconciliation step then compares the live-proof backlog to the current redacted spend snapshot and keeps partial proof blocking until owner-system billing/export proof exists. The intake-template step gives humans and source-system owners one fillable, no-secret artifact shape for attaching that proof. The validation step checks filled intake rows locally and accepts them only for manual review; it does not count them as live billing proof. The next-goal step writes the ranked `/goal` queue as a machine-readable handoff artifact so future Codex sessions inherit the same budget boundaries. The delegation step turns the budget ledger and queue into owner work orders without granting spend authority. The live-action gate is the fail-closed check future agents must run before any spend-affecting live action; current output allows repo-local work and blocks live mutation. The status step gives agents one compact answer before acting: repo-local allocation and delegation are allowed, live spend mutation is not. The launch-approval step produces exact bounded approval text for the current `$500/month` plan, but keeps `approval_effective=false` until that text is captured with source metadata and the proof gates pass.

Commands:

- `npm run autonomy:outcomes:snapshot`
- `npm run autonomy:budget:recommend`
- `npm run autonomy:budget:dynamic:verify`
- `npm run autonomy:budget:live-proof:reconcile`
- `npm run autonomy:budget:live-proof:template`
- `npm run autonomy:budget:live-proof:validate`
- `npm run autonomy:budget:next-goals`
- `npm run autonomy:budget:delegate`
- `npm run autonomy:budget:live-action-gate`
- `npm run autonomy:budget:status`
- `npm run autonomy:budget:launch-approval`
- `npm run autonomy:budget:control-suite`

Allocation-grade outcome proof is limited to fresh `repo-local-export` or `live-performance` evidence named by policy. Missing, stale, fixture-only, unsupported, or `repo-local-config` proof can only produce advisory holds such as `no reallocation, improve proof first`. Repo-local exports can support a recommendation, but they are not live billing or live performance proof unless the owner system actually produced the export and the proof level says so.

Every spend-affecting recommendation remains human-approval required. The approval packet is repo-local and no-send by default. It must not mutate provider accounts, change budgets, create ads, send outreach, deploy, write live databases, clear rights/legal state, fulfill hosted sessions, activate cities, or make customer/traction claims.

## Commands

- `npm run autonomy:spend:snapshot`
  - Local inventory mode. Reads the source registry, checks which required env vars are present, and writes redacted artifacts.
- `npm run autonomy:spend:snapshot -- --live-read`
  - Calls configured read-only provider endpoints for sources that have credentials.
- `npm run autonomy:spend:snapshot -- --env-file .env.spend.local --live-read`
  - Loads a local ignored env file first. The file must not be committed.
- `npm run autonomy:spend:snapshot:keychain`
  - Loads credentials from macOS Keychain service `Blueprint-WebApp autonomous-spend` and runs local inventory mode.
- `npm run autonomy:spend:snapshot:keychain -- --live-read`
  - Loads credentials from macOS Keychain and calls configured read-only provider endpoints.
- `npm run autonomy:spend:snapshot -- --only digitalocean_billing,deepseek_balance --live-read`
  - Limits a live read to named source ids.
- `npm run autonomy:budget:live-proof:reconcile`
  - Reads the current live-proof backlog and redacted spend snapshot, writes a local reconciliation artifact, and makes no provider calls.
- `npm run autonomy:budget:live-proof:template`
  - Reads the current live-proof backlog and reconciliation artifact, writes a fillable proof intake template, and makes no provider calls.
- `npm run autonomy:budget:live-proof:validate`
  - Validates filled intake fields locally, reports missing or rejected proof rows, and still does not count artifacts as live billing proof.
- `npm run autonomy:budget:live-proof:validate -- --require-complete`
  - Same local validation, but exits non-zero when any proof row is missing or rejected. Use this only after a filled intake packet is expected.
- `npm run autonomy:budget:next-goals`
  - Writes the canonical five-item `/goal` handoff queue with owners, safe commands, success criteria, blocked claims, Codex OAuth/Pro exclusion, OpenAI API `$0` guardrail, and no-live-mutation gates.
- `npm run autonomy:budget:delegate`
  - Writes an owner-by-owner delegation packet that maps budget lines and queued work to owners while authorizing only repo-local proof, planning, and review work.
- `npm run autonomy:budget:live-action-gate`
  - Writes the fail-closed live-action gate. Default mode reports `live_action_allowed=false` while proof/approval is missing; `-- --require-live-action-ready` exits non-zero until all live-action gates clear.
- `npm run autonomy:budget:status`
  - Writes the compact pre-action status. Current state reports repo-local allocation/delegation allowed, live spend mutation blocked, live budget completion claim blocked, and Operational Launch Ready claim blocked.
- `npm run autonomy:budget:launch-approval`
  - Writes `output/autonomous-org/budget/latest/launch-now-approval-packet.json` and `.md` with exact bounded approval text. This is a pending approval artifact only; it makes no provider calls and does not authorize live action by itself.
- `npm run autonomy:budget:control-suite`
  - Runs the default safe local budget control suite and writes `output/autonomous-org/budget/control-suite/latest/summary.json` plus `.md`.
- `npm run autonomy:budget:control-suite -- --include-check --include-graphify`
  - Adds TypeScript and graphify refresh to the local suite. These remain local-only checks.

Outputs:

- `output/autonomous-org/budget/spend-snapshots/latest.json`
- `output/autonomous-org/budget/spend-snapshots/latest.md`
- `output/autonomous-org/budget/latest/live-proof-reconciliation.json`
- `output/autonomous-org/budget/latest/live-proof-reconciliation.md`
- `output/autonomous-org/budget/latest/live-proof-intake-template.json`
- `output/autonomous-org/budget/latest/live-proof-intake-template.md`
- `output/autonomous-org/budget/latest/live-proof-intake-validation.json`
- `output/autonomous-org/budget/latest/live-proof-intake-validation.md`
- `output/autonomous-org/budget/latest/next-goal-queue.json`
- `output/autonomous-org/budget/latest/next-goal-queue.md`
- `output/autonomous-org/budget/latest/budget-delegation-packet.json`
- `output/autonomous-org/budget/latest/budget-delegation-packet.md`
- `output/autonomous-org/budget/latest/live-action-gate.json`
- `output/autonomous-org/budget/latest/live-action-gate.md`
- `output/autonomous-org/budget/latest/control-status.json`
- `output/autonomous-org/budget/latest/control-status.md`
- `output/autonomous-org/budget/control-suite/latest/summary.json`
- `output/autonomous-org/budget/control-suite/latest/summary.md`

The output includes env var names and proof state, never secret values.

## First Authorized Live-Read Pass

Artifact:

- `output/autonomous-org/budget/spend-snapshots/provided-token-live-read-2026-06-01/summary.json`
- `output/autonomous-org/budget/spend-snapshots/provided-token-live-read-2026-06-01/summary.md`

Scope:

- `paperclip_declared_agent_envelope`
- `codex_oauth_pro_seat`
- `openai_api_costs`
- `digitalocean_billing`
- `deepseek_balance`
- `render_inventory`
- `sendgrid_credits`
- `github_billing_usage`
- `backblaze_b2_account`
- `runway_api_credits`
- `worldlabs_api_credits`

Findings:

- Paperclip repo config: `$173.00` declared budget, 46 agents, 62 routines, 26 active routines, 36 paused routines. Repo-local control proof only.
- Codex OAuth / Pro subscription: excluded from the $500/month launch/growth cash envelope as pre-existing tooling; it is not OpenAI API/model-spend proof.
- OpenAI API costs: project key was present, but `OPENAI_ADMIN_KEY` is still missing, so org Costs could not be read.
- DeepSeek direct: read-only balance succeeded; USD total balance was `$4.22`. This is credit-balance proof, not monthly usage proof.
- DigitalOcean: read-only billing endpoints succeeded; account balance was `$0.00`, but invoice preview amount was not present in the response, so the host line is not reconciled to current month actuals yet.
- Render: read-only service inventory succeeded; 5 web services were visible. This is usage inventory, not billing proof.
- SendGrid: read-only credits succeeded; 100 daily credits remained and 0 were used in the current credit window. This is credit proof, not invoice proof.
- GitHub: billing read returned `401 Bad credentials`; the supplied token path cannot currently prove GitHub billing.
- Backblaze B2: account authorization succeeded. This is account access proof, not billing proof.
- Runway and World Labs: credentials were present, but no live credit/billing adapter is wired, so they remain credential-presence only.

The temporary env file used for this pass was deleted after the command completed.

## Keychain Storage

Local service:

- `Blueprint-WebApp autonomous-spend`

Accounts are the env var names used by the registry, for example `OPENAI_ADMIN_KEY`, `OPENROUTER_API_KEY`, and `DIGITALOCEAN_TOKEN`. The collector can load those values with `--keychain` or through the npm alias `autonomy:spend:snapshot:keychain`.

Keychain mode records only which env var names were loaded or missing. It does not write secret values to JSON, Markdown, logs, or repo files.

## Keychain Live-Read Pass

Artifact:

- `output/autonomous-org/budget/spend-snapshots/keychain-live-read-2026-06-01/latest.json`
- `output/autonomous-org/budget/spend-snapshots/keychain-live-read-2026-06-01/latest.md`

Findings:

- Codex OAuth / Pro subscription: excluded from this budget; no subscription proof is needed for the $500/month launch/growth reconciliation.
- OpenAI API Costs: read-only org cost query succeeded; current bucket amount was `$0.00`; this is a `$0` API-spend guardrail, not a model budget.
- OpenRouter: read-only credit query failed with `401 User not found`; the stored key does not currently prove OpenRouter spend or credits.
- DeepSeek direct: read-only balance succeeded; USD total balance was `$4.22`.
- DigitalOcean: read-only account/billing query succeeded; account balance was `$0.00`, but invoice preview amount was not present, so the host line remains usage/account proof only.
- Render: read-only service inventory succeeded; 5 web services were visible. This is usage proof only.
- SendGrid: read-only credits succeeded; 100 daily credits remained and 0 were used in the current credit window.
- GitHub: billing read returned `401 Bad credentials`; the stored tokens cannot currently prove GitHub billing.
- Backblaze B2: account authorization succeeded. This is account access proof only.
- Runway and World Labs: credentials are present, but no read-only billing adapter is wired.

## Registry

Source registry:

- `config/autonomy/spend-sources.yaml`
- `config/autonomy/outcome-sources.yaml`

Each source declares:

- provider and owner system
- budget line and target amount
- adapter name
- required env vars
- proof kind
- stale-after window
- notes about whether the result is billing proof, credit-balance proof, usage-only proof, or still manual

Outcome sources additionally declare channel id, local artifact path, stale window, missing inputs, and whether the source can affect allocation.

## Proof Levels

- `live-billing`: current owner-system spend value can count against actuals.
- `live-credit-balance`: proves balance or total credit state, but not month-to-date spend by itself.
- `live-usage`: proves account/service usage, but not dollar spend by itself.
- `repo-local-export`: local billing export was loaded; quality depends on the export source.
- `repo-local-config`: env/config present only.
- `missing`: required credential, account id, export, or adapter proof is missing.

Only `live-billing` and suitable `repo-local-export` rows should move budget lines from estimate to actual.

## Current Credential Map

Provided token categories that map to registry env vars:

| Provider | Registry source | Env var names |
|---|---|---|
| Paperclip repo config | `paperclip_declared_agent_envelope` | none; reads `ops/paperclip/blueprint-company/.paperclip.yaml` |
| Codex OAuth / Pro subscription | `codex_oauth_pro_seat` | none; excluded from the $500/month launch/growth envelope |
| SendGrid | `sendgrid_credits` | `SENDGRID_API_KEY` |
| Runway | `runway_api_credits` | `RUNWAY_API_KEY` |
| DigitalOcean | `digitalocean_billing` | `DIGITALOCEAN_TOKEN` |
| DeepSeek direct | `deepseek_balance` | `DEEPSEEK_API_KEY` |
| OpenRouter | `openrouter_credits` | `OPENROUTER_API_KEY` |
| GitHub | `github_billing_usage` | `GITHUB_TOKEN` or `GITHUB_CLASSIC_TOKEN` |
| World Labs | `worldlabs_api_credits` | `WORLDLABS_API_KEY` |
| Render | `render_inventory` | `RENDER_API_KEY` |
| Backblaze B2 | `backblaze_b2_account` | `BACKBLAZE_B2_KEY_ID`, `BACKBLAZE_B2_APPLICATION_KEY` |
| Firebase project config | `firebase_project_config` | `FIREBASE_PROJECT_ID`, `FIREBASE_PROJECT_NUMBER`, `FIREBASE_WEB_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_DATABASE_URL`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_MEASUREMENT_ID` |
| OpenAI admin key | `openai_api_costs` | `OPENAI_ADMIN_KEY` |
| OpenAI project key | `openai_api_costs` alternate only | `OPENAI_API_KEY` |

Missing or still needed for full budget proof:

| Provider/line | Needed input | Why |
|---|---|---|
| OpenAI API costs | `OPENAI_ADMIN_KEY` | Organization Costs endpoint requires an admin key; a project key is not enough for billing reconciliation. Default allocation is `$0`; any API model spend needs explicit approval. |
| OpenRouter | `OPENROUTER_API_KEY` | Needed only if DeepSeek or other models route through OpenRouter. |
| DeepSeek direct | usage export or invoice proof | The default model cash reserve now belongs here, not in Codex Pro/OAuth. Balance proof alone does not prove month-to-date usage. |
| GitHub billing | `GITHUB_BILLING_OWNER`, `GITHUB_BILLING_OWNER_TYPE` | Needed to choose user vs organization billing endpoint. For this repo, the likely owner is `ognjhunt`, but the collector does not assume billing ownership. |
| Firebase/GCP | `GCP_BILLING_EXPORT_JSON` | Current implementation reads a local billing export; BigQuery live query support is not wired yet. |
| Upstash/Redis | `UPSTASH_API_KEY`, `UPSTASH_EMAIL` | Needed to attach Redis usage or billing proof. |
| Cloudflare/tunnel | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Needed before Cloudflare account/billing profile proof can be inspected. |
| PostHog | `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_HOST`, `POSTHOG_PROJECT_ID` | Usage proof can be read later; dollar spend still needs plan/pricing reconciliation. |
| Search/research APIs | one of `PARALLEL_API_KEY`, `PARALLEL_SEARCH_API_KEY`, `PERPLEXITY_API_KEY`, `TAVILY_API_KEY`, `SERPAPI_API_KEY` | Needed to identify which search provider should get a billing adapter or export path. |
| Recipient evidence enrichment | receipt, export, or provider usage proof | Needed before paid enrichment can count as actual spend. |
| Profiles/listings | receipt or provider export when paid | The default line is organic/manual; paid profile work needs an artifact before it counts as actual spend. |
| Meta Ads | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | Read-only insights can prove spend; this does not create or launch ads. |
| Google Ads | `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` | Adapter is not wired beyond credential inventory. |
| Slack | `SLACK_BOT_TOKEN` | Bot access is not billing proof; billing still needs admin/export evidence. |
| Render billing | invoice export or billing endpoint proof | Render service inventory is usage proof only until billing proof is attached. |
| Runway and World Labs | credit balance or usage endpoint/export | API keys alone are credential proof, not spend proof. |
| Backblaze B2 | billing export or usage pricing reconciliation | B2 authorization proves account access only. |

## Secret Handling

Do not commit provider tokens. Use macOS Keychain, environment variables, or an ignored local env file such as `.env.spend.local`. If a token was pasted into a chat, rotate it after the collector is wired into a safer secret path.

The collector redacts known token patterns and writes only env var names, endpoint hosts, account references, status, and safe numeric summaries.

## Current Adapters

Billing or credit-capable:

- `openai_costs`: OpenAI organization Costs endpoint.
- `openrouter_credits`: OpenRouter credits endpoint.
- `deepseek_balance`: DeepSeek account balance endpoint.
- `digitalocean_billing`: DigitalOcean balance and invoice preview endpoints.
- `sendgrid_credits`: SendGrid credit balance endpoint.
- `github_billing_usage`: GitHub billing usage endpoint when owner config and token allow it.
- `meta_ads_insights`: Meta read-only ads insights spend for a configured ad account.

Usage/account-only:

- `render_inventory`: Render service inventory; not billing proof.
- `backblaze_b2_authorize`: B2 account authorization; not billing proof.
- `paperclip_agent_config`: repo-local declared Paperclip budget; not live billing proof.
- `credential_presence`: records whether credentials/config exist, without claiming spend.
- `manual_export`: reads a local JSON billing export and extracts recognized amount fields.

## Boundaries

This setup does not:

- store secrets in repo artifacts
- mutate provider accounts
- change billing settings
- create or launch ads
- send email or Slack
- deploy or restart services
- write live databases
- clear rights/privacy/legal gates
- prove hosted-session fulfillment
- claim city activation, customer traction, or Operational Launch Ready
