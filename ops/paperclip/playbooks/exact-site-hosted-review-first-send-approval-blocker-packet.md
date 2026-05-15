# Blocker Title

Exact-Site first-send batch needs founder approval before any live buyer sends.

# Blocker Id

`human-blocker:exact-site-first-send-approval:2026-05-09`

# Why This Is Blocked

The Exact-Site Hosted Review GTM ledger has 30 target rows and 30 recipient-backed contacts, but every row is still `draft_ready` with `approvalState=pending_first_send_approval`.

The current send dry run found 0 eligible sends and skipped all 30 rows for approval. Proceeding would bypass the documented first-send human gate for live external buyer outreach.

Reply durability is also blocked downstream by sender verification and Gmail watcher env gaps. Founder approval is the earliest hard stop, but approval alone does not authorize dispatch.

# Recommended Answer

Review `ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval.template.json` and approve, edit, or reject the first-send rows that should move forward.

Default recommendation: approve only rows where all of the following are true:

- the public inbox or named address is acceptable for a first touch
- the draft angle matches the row track
- the CTA points to either inspecting a labeled review or naming a site/workflow to capture
- the landing-page handoff matches the CTA
- the objection plan can be answered from ledger evidence and public pages without inventing proof

Leave broad support/community inboxes as `edit` if the ask should be narrowed, and reject any row that should not receive outbound.

# Alternatives

- Keep all 30 rows draft-only while message copy or recipient fit is reviewed.
- Approve a smaller first batch by target id, then rerun send preflight for only those target ids.
- Reject public-inbox rows that are too broad and request named buyer or partnership contacts with explicit source evidence.

# Downside / Risk

Approving public inboxes may produce low reply rates or route to support/community teams instead of deployment buyers.

Approval does not authorize pricing, legal, privacy, rights, permission, paid spend, readiness claims, or live sends before sender and reply durability pass.

# Exact Response Needed

Provide a first-send approval packet using:

`ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval.template.json`

For each reviewed row, inspect:

- `recipientEmail`, `recipientRole`, `recipientEvidenceSource`, and `recipientEvidenceType`
- `draftAngle`
- `cta`
- `landingPage`
- `objectionPlan`
- `reviewFlags`

Then set:

- `decision`: `approve`, `edit`, or `reject`
- `approvedBy`: required for `approve`
- `approvalNote`: required when edits or rejection are needed; recommended for approvals when the row has review flags

Leave unreviewed rows at `decision=null`.

# Execution Owner After Reply

`growth-lead` owns applying the approval packet to the GTM ledger.

`webapp-codex` owns repo validation and send preflight after the reply is recorded.

`blueprint-chief-of-staff` owns reply correlation and resume routing.

# Immediate Next Action After Reply

After the approval reply is recorded on the owning issue or report with blocker id `human-blocker:exact-site-first-send-approval:2026-05-09`, run:

```bash
npm run gtm:first-send-approval:apply -- --write --allow-blocked
npm run gtm:hosted-review:audit
npm run gtm:recipient-evidence:validate
npm run gtm:send -- --dry-run --allow-blocked
npm run human-replies:audit-durability
```

If the dry run reaches the durability gate, do not send live until `npm run human-replies:audit-durability` passes and live dispatch is explicitly authorized with `npm run gtm:send -- --write --dry-run 0`.

# Deadline / Checkpoint

Next Exact-Site Hosted Review buyer-loop pass.

# Evidence

- `ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json`
- `ops/paperclip/playbooks/exact-site-hosted-review-human-recipient-evidence.public-inboxes.json`
- `ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval.template.json`
- `ops/paperclip/reports/exact-site-hosted-review-buyer-loop/global/2026-05-09/buyer-loop.md`
- `ops/paperclip/reports/exact-site-hosted-review-buyer-loop/global/2026-05-09/buyer-loop-manifest.json`
- `ops/paperclip/reports/exact-site-hosted-review-gtm-pilot/2026-05-09.md`
- `ops/paperclip/reports/gtm-enrichment/2026-05-09/enrichment-waterfall-manifest.json`
- `ops/paperclip/reports/gtm-send-executor/2026-05-09/send-executor-manifest.json`
- `npm run gtm:recipient-evidence:validate -- --human-recipient-evidence-path ops/paperclip/playbooks/exact-site-hosted-review-human-recipient-evidence.public-inboxes.json` reported 30 selected rows, 30 valid selected rows, and 0 blockers.
- `npm run gtm:recipient-evidence:validate` also validated the selected ledger recipient evidence directly with 30 valid selected rows and 0 blockers.
- `npm run gtm:enrichment:run -- --write --select-recipients --human-recipient-evidence-path ops/paperclip/playbooks/exact-site-hosted-review-human-recipient-evidence.public-inboxes.json --allow-blocked` refreshed all 30 targets and kept 30 contact-found targets. It also recorded 30 provider-level blockers for the optional governed public-contact discovery allowlist.
- `npm run gtm:hosted-review:audit` reported `ready_with_warnings`, 30 recipient-backed targets, 30 founder approvals needed, 0 sent targets, and a warning that no send ledger exists yet.
- `npm run gtm:send -- --dry-run --allow-blocked` reported 0 eligible sends, 30 skipped for approval, 0 skipped for recipient evidence, 0 skipped for message, and 0 sent.
- `npm run human-replies:audit-durability` remains blocked by sender/domain verification, explicit approved identity env, and Gmail OAuth production watcher credentials.

Current blocker snapshot:

```text
target rows: 30
recipient-backed targets: 30
founder approval needed: 30
eligible sends: 0
skipped approval: 30
sent touches: 0
reply durability: blocked
```

# Non-Scope

This reply does not authorize fake contacts, inferred emails, live sends, reply claims, hosted-review starts, city readiness claims, paid spend, pricing commitments, rights/privacy commitments, or generated buyer proof.

# Channel Target

Repo-local no-send artifact until the approved org-facing sender and reply watcher path are production-ready.

When live human-gate dispatch is configured, use Slack DM to `Nijel Hunt` for speed and email to `ohstnhunt@gmail.com` for a durable trail. Never use `hlfabhunt@gmail.com`.

# Routing Surface

Repo-local no-send artifact plus the owning Paperclip issue or buyer-loop report. Email/Slack dispatch should only happen after the approved org-facing sender and reply watcher path are configured.

# Watcher / Resume Owner

`blueprint-chief-of-staff` owns reply watching and correlation. Resume execution only after the response is recorded with blocker id `human-blocker:exact-site-first-send-approval:2026-05-09`.
