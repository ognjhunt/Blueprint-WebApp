# Blocker Title

Exact-Site first-send batch needs founder/operator approval and reply durability before any live buyer sends.

# Blocker Id

`human-blocker:exact-site-first-send-approval:2026-05-09`

Stable existing blocker id retained for reply correlation. Current evidence was refreshed on `2026-05-19T02:33Z`.

# Why This Is Blocked

The Exact-Site Hosted Review GTM ledger is target-ready but not send-ready.

Current safe audit results:

- target rows: 30
- proof-ready outreach rows: 3
- demand-sourced capture rows: 27
- proof artifacts or capture asks: 30
- recipient-backed targets: 30
- draft-ready targets: 30
- approval-needed targets: 30
- founder/operator approval needed targets: 30
- human-approved targets: 0
- eligible sends: 0
- sent targets: 0
- replies: 0
- hosted-review starts: 0
- qualified calls: 0
- decision touch goal: 100
- decision touch gap: 100
- open blockers: 12

The send dry run found `skipped_approval=30`, `eligible=0`, `sent=0`, and `dry_run_receipts=0`. Proceeding would bypass the documented first-send human gate for external buyer outreach.

Sender and reply durability are also blocked downstream. First-send approval is the earliest GTM hard stop, but approval alone does not authorize dispatch.

# Recommended Answer

Review `ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval.template.json` and approve, edit, or reject the first-send rows that should move forward.

Default recommendation: approve only rows where all of the following are true:

- the recipient email and evidence source are acceptable for a first touch
- the draft angle matches the row track
- the CTA points to either inspecting a labeled review or naming a site/workflow to capture
- the landing-page handoff matches the CTA
- the proof source does not overstate recipient-specific proof
- the objection plan can be answered from ledger evidence and public pages without inventing proof
- blocked claims remain preserved in the final draft

Leave public/general inboxes as `edit` if the ask should be narrowed before first send. Reject any row that should not receive outbound.

# Approval Rows

The refreshed approval template contains:

- approval rows: 30
- approvals recorded: 0
- decisions left null: 30
- proof-ready outreach approval rows: 3
- demand-sourced capture approval rows: 27
- rows flagged as public/general inbox: 28
- rows flagged as capture ask only, no hosted-review claim: 27
- rows flagged as draft opportunity brief: 27

The approval packet was refreshed with:

```bash
npm run gtm:first-send-approval:template -- --write
```

Output:

- `approval_rows: 30`
- `approvals_recorded: 0`
- `live_send_status: blocked until founder decisions are recorded and reply durability passes`

# Sender And Reply Blockers

Current durability status is `blocked`.

## Sender/domain verification

- blocker id: `human-blocker:city-launch-sender-verification`
- owner: `blueprint-chief-of-staff`
- current transport: SendGrid configured
- current from address: `ohstnhunt@gmail.com`
- current reply-to: `ohstnhunt@gmail.com`
- current verification status: `unknown`
- exact input needed: confirm the active provider sender/domain is verified and set `BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified` in the live WebApp environment
- safe proof command: `npm run human-replies:audit-durability -- --allow-not-ready`
- retry condition: rerun the safe audit after provider verification is complete and the live env has the verified flag
- disallowed workaround: do not treat configured SendGrid/SMTP credentials, Slack updates, dry-run sends, first-send approvals, or outbound delivery as sender/domain proof

## Approved reply identity

- blocker id: `human-blocker:approved-reply-identity`
- owner: `blueprint-chief-of-staff`
- current state: reply identity is relying on the code default
- exact input needed: set `BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=ohstnhunt@gmail.com` in the live environment
- safe proof command: `npm run human-replies:audit-durability -- --allow-not-ready`
- retry condition: rerun the safe audit after the live env explicitly names the approved mailbox
- disallowed workaround: do not rely on code defaults, alternate Gmail connectors, Slack mirrors, or `hlfabhunt@gmail.com`

## Gmail OAuth reply watcher

- blocker id: `human-blocker:gmail-oauth-missing_config`
- owner: `blueprint-chief-of-staff`
- current watcher gate: scheduler enabled
- current Gmail OAuth state: not configured
- current OAuth publishing status: `unknown`
- exact inputs needed:
  - `BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID`
  - `BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET`
  - `BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN` for `ohstnhunt@gmail.com`
  - `BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS=production`
- safe proof command: `npm run human-replies:audit-durability -- --allow-not-ready`
- retry condition: rerun the safe audit after OAuth credentials resolve the mailbox as `ohstnhunt@gmail.com` and publishing status is production
- disallowed workaround: do not poll `hlfabhunt@gmail.com`, use browser cookies, scrape Gmail, or treat outbound email delivery as proof that replies can resume agents

# Exact Response Needed

For each reviewed row in `ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval.template.json`, inspect:

- `recipientEmail`
- `recipientRole`
- `recipientEvidenceSource`
- `recipientEvidenceType`
- `draftAngle`
- `cta`
- `landingPage`
- `proofSource`
- `objectionPlan`
- `blockedClaims`
- `reviewFlags`

Then set:

- `decision`: `approve`, `edit`, or `reject`
- `approvedBy`: required for `approve`
- `approvalNote`: required for edits or rejection; recommended for approvals with review flags

Leave unreviewed rows at `decision=null`.

# Execution Owner After Reply

`growth-lead` owns applying explicit first-send decisions to the GTM ledger.

`webapp-codex` owns repo validation and send preflight after the reply is recorded.

`blueprint-chief-of-staff` owns reply correlation, watcher durability, and resume routing.

# Immediate Next Action After Reply

Only after explicit first-send decisions are recorded with this blocker id, run:

```bash
npm run gtm:first-send-approval:apply -- --write --allow-blocked
npm run gtm:hosted-review:audit
npm run gtm:send -- --dry-run --allow-blocked
npm run human-replies:audit-durability -- --allow-not-ready
```

If the send dry run reaches the durability gate, stop again unless `npm run human-replies:audit-durability -- --allow-not-ready` reports ready and live dispatch is separately authorized.

# Safe Proof Commands Run In This Refresh

```bash
npm run gtm:hosted-review:audit
npm run gtm:send -- --dry-run --allow-blocked
npm run human-replies:audit-durability -- --allow-not-ready
npm run gtm:first-send-approval:template -- --write
```

# Do Not Run Without Explicit Live Authorization

Do not run:

```bash
npm run gtm:first-send-approval:apply -- --write --allow-blocked
npm run gtm:send -- --write --dry-run 0
npm run human-replies:poll
npm run human-replies:send-test-blocker
npm run human-replies:prove-production
```

# Alternatives

- Keep all 30 rows draft-only while message copy, recipient fit, or proof framing is reviewed.
- Approve a smaller first batch by target id, then rerun send preflight for only those target ids.
- Mark broad public inbox rows as `edit` and request named buyer, partnerships, deployment, or field-operations contacts with explicit source evidence.
- Reject demand-sourced rows if they should not ask for capture/workflow input.

# Downside / Risk

Approving public or general inboxes may produce low reply rates or route to support/community teams instead of deployment buyers.

Approval does not authorize pricing, legal, privacy, rights, permission, paid spend, readiness claims, hosted-review starts, reply claims, or live sends before sender and reply durability pass.

# Evidence

- `ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json`
- `ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval.template.json`
- `ops/paperclip/playbooks/exact-site-hosted-review-human-recipient-evidence.public-inboxes.json`
- `ops/paperclip/programs/exact-site-hosted-review-gtm-pilot-program.md`
- `ops/paperclip/blueprint-company/tasks/exact-site-hosted-review-gtm-pilot/TASK.md`
- `ops/paperclip/blueprint-company/tasks/exact-site-hosted-review-buyer-loop/TASK.md`
- `ops/paperclip/programs/human-blocker-packet-standard.md`
- `ops/paperclip/programs/human-reply-handling-contract.md`

Current command evidence:

- `npm run gtm:hosted-review:audit` reported `ready_with_warnings`, 30 targets, 30 recipient-backed targets, 30 approval-needed targets, 30 founder approval needed targets, 0 human-approved targets, 0 sent targets, 0 replies, and 0 hosted-review starts.
- `npm run gtm:send -- --dry-run --allow-blocked` reported `eligible: 0`, `sent: 0`, `dry_run_receipts: 0`, `skipped_approval: 30`, `skipped_no_recipient: 0`, `skipped_no_message: 0`, `skipped_already_sent: 0`, and `failed: 1` because all 30 drafts lack founder/operator approval.
- `npm run human-replies:audit-durability -- --allow-not-ready` reported `ok: false` with blockers for sender/domain verification, explicit approved reply identity, and Gmail OAuth production credentials.
- `npm run gtm:first-send-approval:template -- --write` refreshed the approval template at `2026-05-19T02:33:45.032Z` with 30 approval rows and 0 recorded approvals.

# Non-Scope

This packet does not authorize fake contacts, inferred emails, live sends, reply claims, hosted-review starts, city readiness claims, paid spend, pricing commitments, rights/privacy commitments, generated buyer proof, or applying approvals without explicit row-level decisions.

# Channel Target

Repo-local no-send artifact until the approved org-facing sender and reply watcher path are production-ready.

When live human-gate dispatch is configured, use Slack DM to `Nijel Hunt` for speed and email to `ohstnhunt@gmail.com` for a durable trail. Never use `hlfabhunt@gmail.com`.

# Routing Surface

Repo-local no-send artifact plus the owning Paperclip issue or buyer-loop report. Email or Slack dispatch should only happen after the approved org-facing sender and reply watcher path are configured.

# Watcher / Resume Owner

`blueprint-chief-of-staff` owns reply watching and correlation. Resume execution only after the response is recorded with blocker id `human-blocker:exact-site-first-send-approval:2026-05-09`.
