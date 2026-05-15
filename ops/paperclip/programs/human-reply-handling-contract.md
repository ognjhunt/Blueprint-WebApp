# Human Reply Handling Contract

Purpose:

- define how a human reply to a blocker email or Slack message becomes agent-visible work
- keep watcher ownership, routing ownership, and execution ownership explicit
- preserve one durable record of truth instead of leaving reply state in chat memory

## Scope

This contract applies when Blueprint sends a human-gate blocker packet or equivalent escalation over:

- email
- Slack DM or Slack thread

The contract starts when the outbound blocker packet is created and ends only after the resumed execution owner records the closeout in the owning durable artifact.

## Lane Ownership

Default ownership model:

- Inbox or channel watcher owner: `blueprint-chief-of-staff`
- Technical routing owner: `blueprint-chief-of-staff` with technical escalation path to `blueprint-cto`
- Technical execution owner: `webapp-codex` for `Blueprint-WebApp` implementation and validation work
- Ops or commercial execution owner: `ops-lead` unless a more specific buyer, rights, or commercial lane already owns the issue

Interpretation rules:

- `blueprint-chief-of-staff` owns watching, deduping, correlation, and deciding whether the human reply is resolved or ambiguous input.
- `blueprint-cto` owns technical escalation only when the reply changes technical diagnosis, platform-contract judgment, or cross-repo routing.
- `webapp-codex` owns the concrete repo follow-through after a resolved technical reply.
- `ops-lead` owns resumed execution for non-technical ops, intake, field, or buyer-ops cases unless a narrower lane already owns that queue.

## Approved Channel And Identity Rules

Email:

- Approved org-facing human-gate identity: `ohstnhunt@gmail.com`
- Disallowed identity: `hlfabhunt@gmail.com`
- If the active Gmail connector, Gmail OAuth token, or other mailbox reader is authenticated as `hlfabhunt@gmail.com`, that path is not an approved org reply watcher and must fail closed.

Slack:

- Slack replies are valid only when they land in a Blueprint-managed Slack identity or thread with a real inbound read path.
- Outbound-only Slack incoming webhooks are not a valid reply watcher. They can send alerts, but they cannot observe replies.
- Slack reply watching for this repo now means:
  - the Events API route is live at `https://tryblueprint.io/api/slack/events`
  - `SLACK_SIGNING_SECRET` and `SLACK_BOT_TOKEN` are configured
  - the bot is actually present in the DM or channel thread that receives the reply
  - the conversation is explicitly enabled by repo config:
    - DMs only when `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOW_DMS=1`
    - channel replies only when the channel id is listed in `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOWED_CHANNELS`
  - channel replies must be thread replies, not root-channel messages

## Correlation Contract

Every blocker packet must carry a durable blocker id.

Minimum correlation fields:

- `blocker_id`
- channel: `email` or `slack`
- outbound subject or Slack thread reference
- recipient or channel target
- routing owner
- execution owner
- resume action descriptor
- report path and Paperclip issue id when available

Email correlation order:

1. explicit blocker tag in subject or body
2. known Gmail thread id if the mailbox exposes it
3. normalized subject match against the recorded outbound blocker subject

Slack correlation order:

1. explicit blocker tag in message body
2. known Slack thread id
3. known channel plus recorded root message id

## Record Of Truth Surfaces

The reply-handling system must write durable state to the current stack surfaces:

- Firestore `humanBlockerThreads`
- Firestore `humanReplyEvents`
- Firestore `opsActionLogs`
- Firestore `opsWorkItems` for delegated follow-through

When already known, the thread record should also carry:

- owning Paperclip issue id
- owning report path

Repo markdown reports remain execution closeout artifacts. The watcher records the reply event immediately; the resumed execution owner updates the repo report when the resumed work is completed or materially advanced.

## Reply Resolution Rules

Resolved input means the reply gives enough information to execute the named next action without another human round-trip.

Examples:

- approval to proceed
- confirmation that an env var or credential was added
- production logs or other requested technical evidence
- a concrete ops/commercial answer that selects one branch

Ambiguous input means the reply does not safely unblock the next action.

Examples:

- “What do you need exactly?”
- a partial answer that leaves the decisive variable unknown
- a reply that introduces a new exception without selecting an execution path

## Exact Blocker Ask Requirements

When a reply watcher or blocker audit records a missing sender, Gmail OAuth, first-send approval, or city-launch resume input, it must preserve the exact ask instead of a vague blocked state.

Minimum fields for these blockers:

- durable blocker id
- owner
- exact env var, account action, approval artifact, or input needed
- safe proof command
- retry/resume condition
- disallowed workaround

Current canonical blocker ids:

| Blocker | Blocker id | Exact resume input |
|---|---|---|
| Sender/domain verification | `human-blocker:city-launch-sender-verification` | Provider sender/domain verified and `BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified`. |
| Gmail OAuth missing or wrong mailbox | `human-blocker:gmail-oauth-<reason>` | OAuth credentials for `ohstnhunt@gmail.com`, production OAuth publishing state, and no `hlfabhunt@gmail.com` mailbox binding. |
| Approved reply identity | `human-blocker:approved-reply-identity` | `BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=ohstnhunt@gmail.com` explicitly configured. |
| First-send approval | `human-blocker:exact-site-first-send-approval:<date-or-run-id>` | Founder decisions recorded against the first-send approval template before live dispatch. |
| City-launch approval or Deep Research resume | `city-launch-approval-<city-slug>` or `city-launch-deep-research-<city-slug>` | Reply recorded with the blocker id plus city, budget tier, budget max, and resume action metadata. |

Safe proof defaults:

- durability: `npm run human-replies:audit-durability -- --allow-not-ready`
- first-send gate: `npm run gtm:send -- --dry-run --allow-blocked`
- city-launch preflight: `npm run city-launch:preflight -- --city "<City, ST>" --allow-blocked --no-write-report --no-write-deep-research-blocker --format markdown`

Disallowed workarounds:

- Do not use `hlfabhunt@gmail.com` for any org-facing sender, watcher, reply, draft, or escalation path.
- Do not treat outbound email delivery, Slack mirror visibility, Notion comments, dry-run output, or provider credential presence as proof that replies can resume agents.
- Do not wake live Paperclip, send test emails, poll Gmail, mutate Notion, or run live city-launch sends just to prove a missing input.

## Resume Immediately Definition

“Resume immediately” means all of the following happen in the same watcher or ingest pass:

1. the reply is persisted in `humanReplyEvents`
2. the owning blocker thread is updated in `humanBlockerThreads`
3. the system classifies the reply as resolved or ambiguous
4. the system writes or updates the delegated `opsWorkItems` row with the exact next action and owner
5. the execution owner can continue from durable state without waiting for an operator to restate the reply in chat

It does not require repo markdown files to be auto-edited by the watcher itself.

## Technical Versus Ops Or Commercial Routing

Technical blockers:

- route resolved replies to `webapp-codex`
- include `blueprint-cto` as the technical escalation owner when the reply changes diagnosis, includes logs, or could imply a platform-contract issue
- default next actions are implementation, verification, smoke rerun, or log inspection

Ops or commercial blockers:

- route resolved replies to `ops-lead` unless another buyer, rights, or pricing lane already owns the blocker
- keep founder escalation only for non-standard pricing, policy, legal, rights/privacy, or irreversible company decisions

## Current Live Watcher Reality

Email:

- Repo-native Gmail polling is the live supported watcher path when Gmail OAuth is configured for `ohstnhunt@gmail.com`.
- If Gmail OAuth is missing or bound to another mailbox, the email watcher is blocked and must record that blocker explicitly.

Slack:

- The repo has a live inbound Events API route, but Slack is resumable only for conversations the bot can actually see.
- A Slack mirror is not operationally valid by itself. If the bot is not in the DM or thread, the reply will never reach the watcher.
- DMs and allowlisted channel threads are supported; root-channel replies fail closed.
- If Slack visibility is uncertain, email to `ohstnhunt@gmail.com` remains the durable source of truth.
