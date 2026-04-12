# Autonomy Lane Status And Human-Blocker Adoption

Date: 2026-04-12

Owner: `webapp-codex`

## Purpose

Make the remaining autonomy state explicit after the human-blocker dispatch and reply-resume system went live, and record which lanes now default to the standard blocker sender versus which ones are still intentionally human-gated or blocked by configuration.

This report is repo-verifiable. It reflects code, docs, and env contracts in this repo. It does not claim live production enablement for secrets or flags that cannot be proven from source control alone.

## Standard Sender Adoption

Adopted in code this session:

- generic agent runtime approval gates in `server/agents/runtime.ts`
- phase-2 action executor human-review branches in `server/agents/action-executor.ts`
- post-signup direct-action human-review branches in `server/utils/post-signup-actions.ts`
- workflow-level human-review branches that never reach phase 2:
  - `waitlist`
  - `inbound`
  - `support`
  - `payout`
  - `preview`

Still not uniformly repo-native:

- Paperclip-native blocked issue flows under `ops/paperclip/` still rely on Paperclip issue blocking and follow-up issue creation, not `dispatchHumanBlocker(...)`
- gap registry and launch-readiness detectors in `server/utils/gap-closure.ts` and `server/utils/launch-readiness.ts` intentionally remain detection/delegation surfaces, not direct blocker-packet senders

Interpretation:

- true human gates in the WebApp runtime now default to the standard sender path
- detector surfaces still open durable work, but they are not themselves the human-gate packet emitter

## Lane Matrix

| Lane | Repo status | Human gate posture | Standard sender adoption | Main blocker / note |
| --- | --- | --- | --- | --- |
| `waitlist` | Autonomous with gates | decline / blocked outcomes still require human review | Yes | Direct dispatch when phase 2 is off; action-ledger dispatch when phase 2 is on |
| `inbound qualification` | Autonomous with gates | buyer-commitment-changing recommendations require human review | Yes | Direct dispatch when phase 2 is off; action-ledger dispatch when phase 2 is on |
| `support triage` | Autonomous with gates | billing, high-priority, technical, blocked issues require human review | Yes | Direct dispatch when phase 2 is off; action-ledger dispatch when phase 2 is on |
| `payout triage` | Enabled but intentionally human-gated | payout and financial follow-through stay human-reviewed | Yes | Phase 2 always stops at human review; direct dispatch covers phase-2-off cases |
| `preview diagnosis` | Autonomous with technical gates | provider escalation / blocked release risk requires technical review | Yes | This lane does not use phase 2; direct workflow dispatch is now the default |
| `buyer lifecycle` | Enabled but intentionally human-gated | lifecycle outreach uses `LIFECYCLE_POLICY` and queues human review | Yes | Action executor now emits standard blocker packets |
| `post-signup path` | Autonomous with gates | blocked schedule/contact/config and explicit human review still fail closed | Yes | Direct post-signup action ledger now emits standard blocker packets |
| `onboarding sequence` | Autonomous now | no default human gate in the current support-policy path | N/A | Still depends on email transport and queue health |
| `experiment autorollout` | Autonomous now if enabled | no default human gate in the rollout evaluator | N/A | Live status still depends on growth-event ingest and production flagging |
| `autonomous research outbound` | Draft-first with human send gate | campaign send is intentionally human-reviewed | Yes for send gate | Also blocked by Firehose + delivery config if missing |
| `creative factory` | Autonomous artifact generation, not autonomous publish | no default human gate for asset generation itself | N/A | Still blocked by Google image + Runway config if missing |
| `growth campaign send` | Intentionally human-gated | all campaign sends use `GROWTH_CAMPAIGN_POLICY` | Yes | Standard sender now covers the approval stop |
| `Slack human-blocker reply path` | Conditionally live | only resumable in bot-visible DMs or allowlisted channel threads | N/A | Technical route is live, but visibility must be explicit |
| `email human-blocker reply path` | Live if Gmail watcher is correctly configured | durable default path | N/A | Production-grade only when mailbox is `ohstnhunt@gmail.com` and OAuth publishing state is explicitly `production` |
| `gap closure` | Autonomous detector/delegator | not a direct human-gate sender | No by design | Opens durable work and escalates stale items |
| `launch readiness` | Autonomous detector | not a direct human-gate sender | No by design | Surfaces blockers; does not send human packets directly |
| `notion sync` | Config-dependent | no default human gate in sync loop | N/A | Still blocked if Notion token/database ids are missing |

## Slack Validity Contract

Slack is no longer “not wired,” but it is not universally resumable either.

Valid resumable Slack surfaces:

- DMs only when `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOW_DMS=1`
- channel replies only when:
  - the bot is actually in the channel
  - the reply lands in a thread
  - the channel id is listed in `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOWED_CHANNELS`

Fail-closed cases:

- root-channel replies
- channels where the bot is not present
- mirrors sent through incoming webhooks where the reply lands in a conversation the bot cannot read

Operational conclusion:

- Slack can be a fast path
- email to `ohstnhunt@gmail.com` remains the durable default

## Gmail OAuth Durability

Repo support added this session:

- `npm run human-replies:audit-gmail`
- mailbox identity check against `ohstnhunt@gmail.com`
- explicit durability state via `BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS`

Production-grade Gmail OAuth now means all of the following are true:

- `BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID` is set
- `BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET` is set
- `BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN` is set
- the authenticated mailbox resolves to `ohstnhunt@gmail.com`
- `BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS=production`

Fail-closed states:

- missing OAuth credentials
- mailbox mismatch
- `BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS=testing`
- unknown OAuth publishing state

## Truthful Autonomy Claim

Are we at “few questions per day” autonomy now?

Not yet as a truthful org-wide claim.

What is true now:

- the repo has a working durable human-blocker dispatch/reply-resume system
- the default WebApp runtime paths that hit real human review now emit the standard blocker packet
- email-based resume is operational when Gmail is correctly configured

What still prevents a strong “few questions per day” claim:

1. Slack resume is conditional, not universal. The bot must actually see the DM or thread.
2. Gmail OAuth may still be operationally risky until the OAuth publishing state is explicitly recorded as `production`.
3. Several important lanes remain intentionally human-gated:
   - payout follow-through
   - growth campaign sends
   - buyer lifecycle sends
   - non-standard pricing, policy, rights/privacy, legal, and irreversible commitments
4. Some lanes are autonomous only when production config exists, and repo truth cannot prove those secrets or flags are currently live:
   - research outbound
   - creative factory
   - Notion sync
   - some operator-facing notification paths
5. Paperclip-native blocked issue flows still use Paperclip issue blocking rather than the repo-native sender, so org-wide adoption is stronger inside WebApp runtime paths than inside every Paperclip routine.

## Next Real Blockers

1. Confirm and record `BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS=production` in the live env, then rerun `npm run human-replies:audit-gmail`.
2. Decide which Slack reply surfaces are truly allowed in production and set:
   - `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOW_DMS`
   - `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOWED_CHANNELS`
3. Keep email as the required durable fallback for any blocker that must be resumable.
4. Decide whether Paperclip-native blocked issue flows should stay Paperclip-only or should also bridge into the repo-native blocker sender for founder-facing human gates.
