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

- The repo still has outbound Slack webhook delivery only.
- Slack reply watching remains blocked until a real inbound Slack credential path exists.
- The normalized ingest route is ready for that future source, but the upstream watcher is not live yet.

## Real Current Blocker Check

Observed on 2026-04-12:

- The current blocker subject exists in Gmail:
  `[Blueprint Blocker] Production inbound write smoke returned 500 on tryblueprint.io`
- The visible draft/thread evidence in this session shows the message in a mailbox authenticated as `hlfabhunt@gmail.com`, not `ohstnhunt@gmail.com`.
- That means the existing Gmail connector path is explicitly disallowed for org-facing reply watching under the repo contract.
- No verified human reply was visible in that thread during this run.

## Remaining Blockers

1. Configure Gmail OAuth for `ohstnhunt@gmail.com` so the email watcher can run live.
2. Configure a real inbound Slack read path if Slack replies should also resume work automatically.
3. After the approved Gmail watcher is configured, register the current production blocker thread with its blocker id and rerun the watcher against that thread.

## Validation

- targeted unit tests for reply routing and Gmail identity gating
- packet-render tests updated for blocker-id correlation
- scheduler tests updated for the new watcher lane
- full repo validation pending final typecheck/test run after code integration
