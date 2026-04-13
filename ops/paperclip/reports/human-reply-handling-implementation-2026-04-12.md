# Human Reply Handling Implementation

Date: 2026-04-12

Owner: `webapp-codex`

## Goal

Implement the missing reply-handling system for human responses to blocker emails or Slack messages, make watcher ownership explicit, and preserve a durable trail from outbound blocker packet through execution handoff.

## What Was Implemented

1. Added a durable human-reply correlation and storage layer in Firestore:
   - `humanBlockerThreads`
   - `humanReplyEvents`
   - `opsActionLogs` entries for reply activity
   - `opsWorkItems` delegation updates for resumed execution
2. Added repo-native Gmail polling support for the approved blocker inbox using existing Google tooling:
   - Gmail OAuth mailbox identity check
   - fail-closed behavior if the mailbox is not `ohstnhunt@gmail.com`
   - polling path: `npm run human-replies:poll`
   - scheduler worker: `human_reply_email`
3. Added a normalized internal ingest route for future upstreams:
   - `POST /api/internal/human-replies/ingest`
   - shared downstream classification and routing path for email or Slack inputs
4. Added reply classification and routing rules:
   - approval
   - credential/env confirmation
   - logs/evidence
   - clarification
   - ambiguous
5. Added durable blocker-id correlation to the human blocker packet format.

## Watcher Ownership And Handoff

- Watcher owner: `blueprint-chief-of-staff`
- Technical routing escalation owner: `blueprint-cto`
- Technical execution owner: `webapp-codex`
- Ops or commercial execution owner: `ops-lead` unless a narrower buyer, rights, or pricing lane already owns the case

Resume semantics:

- the reply is persisted
- the blocker thread is updated
- the system decides resolved versus ambiguous input
- the next delegated work item is written with the execution owner and next action

## Current Channel Reality

Email:

- Live path is implemented in repo, but it is live only when Gmail OAuth is configured for `ohstnhunt@gmail.com`.
- The current connected Gmail tool in this session is not an approved watcher path for org email.

Slack:

- The inbound Events API route is live at `https://tryblueprint.io/api/slack/events`.
- Slack replies are resumable only when the bot can actually see the conversation:
  - DM support requires `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOW_DMS=1`
  - channel support requires the channel id in `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOWED_CHANNELS`
  - channel replies must be thread replies, not root posts
- Incoming webhook mirrors remain send-only. If the bot is not in the DM or thread, Slack still fails closed and email remains the durable path.

## Real Current Blocker Check

Observed on 2026-04-12:

- The current blocker subject exists in Gmail:
  `[Blueprint Blocker] Production inbound write smoke returned 500 on tryblueprint.io`
- The visible draft/thread evidence in this session shows the message in a mailbox authenticated as `hlfabhunt@gmail.com`, not `ohstnhunt@gmail.com`.
- That means the existing Gmail connector path is explicitly disallowed for org-facing reply watching under the repo contract.
- No verified human reply was visible in that thread during this run.

Follow-up verification completed later on 2026-04-12:

- Gmail OAuth was configured for `ohstnhunt@gmail.com`.
- The watcher successfully authenticated as `ohstnhunt@gmail.com` and passed `users/me/profile`.
- A real reply was sent to `ohstnhunt@gmail.com` with blocker id `bpb-prod-live-smoke-2026-04-12`.
- The watcher recorded the reply in durable state with:
  - `last_human_reply_event_id: email:19d83eb4eb3a78e2`
  - `last_classification: credential_env_confirmation`
  - `last_resolution: resolved_input`
  - `last_routed_owner: webapp-codex`
  - `status: routed`

This confirms the missing operational capability is now live for Gmail-based blocker replies.

It also proved the intended resume workflow end to end:

1. the reply landed in `ohstnhunt@gmail.com`
2. the watcher correlated it to blocker id `bpb-prod-live-smoke-2026-04-12`
3. the system classified it as `credential_env_confirmation`
4. the execution lane resumed automatically
5. the production live-write smoke was rerun after the reply
6. after the field-encryption env fix, the rerun returned `201`

## Remaining Blockers

1. Configure a real inbound Slack read path if Slack replies should also resume work automatically.
2. Record the Gmail OAuth publishing state explicitly as `testing` or `production`; unknown state must continue to fail closed for production-grade autonomy claims.
3. Rotate the Gmail and Slack secrets that were exposed during setup and update Render with the rotated values.
4. Keep the blocker-thread registration step wired into future outbound blocker sends so manual registration is not needed for the next human-gated incident.

## Validation

- targeted unit tests for reply routing and Gmail identity gating
- packet-render tests updated for blocker-id correlation
- scheduler tests updated for the new watcher lane
- full repo validation pending final typecheck/test run after code integration
