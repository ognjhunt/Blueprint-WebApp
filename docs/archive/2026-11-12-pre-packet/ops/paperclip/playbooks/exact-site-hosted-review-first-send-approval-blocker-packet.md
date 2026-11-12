# Blocker Title

Exact-Site first-send batch needs row-level founder/operator approval before any live buyer sends.

# Blocker Id

`human-blocker:exact-site-first-send-approval:2026-05-09`

Repo-local no-send packet generated at `2026-05-28T19:58:17.300Z`.

# Why This Is Blocked

The Exact-Site Hosted Review GTM ledger is recipient-backed and approval-ready, but it is not send-ready.

- target rows: 30
- recipient-backed targets: 30
- approval-ready targets: 30
- founder/operator approval needed targets: 30
- reply-durability blocked targets: 12
- stale next-action targets: 0
- stale blocker projection targets: 0
- human-approved targets: 0
- sent targets: 0
- replies: 0
- hosted-review starts: 0
- qualified calls: 0

Proceeding without row-level decisions would bypass the documented first-send human gate for external buyer outreach. Reply durability remains a separate downstream live-send gate and approval alone does not authorize dispatch.

# Local Dry-Run Gate Summary

- recipient-backed targets: 30
- approval rows: 30
- proof-ready outreach rows: 3
- demand-sourced capture rows: 27
- proof-source rows: 30
- blocked-claim rows: 30
- approval blockers: 30
- reply-durability blockers: 12

These are local approval and dry-run facts only. They do not prove founder approval, real dispatch, Gmail or SendGrid watcher durability, hosted-review starts, buyer replies, or operational launch readiness.

# Recommended Answer

Review `ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval.template.json` and approve, edit, or reject each reviewed row.

Default recommendation: approve only rows where recipient evidence, proposed subject/body, draft angle, CTA, landing-page handoff, objection plan, proof source, and blocked claims are acceptable without inventing pricing, rights, readiness, traction, hosted-review starts, or reply proof.

# Approval Rows

- approval rows: 30
- approvals recorded: 0
- proof-ready outreach rows: 3
- demand-sourced capture rows: 27
- rows with public/general inbox review flags: 28
- rows with prefilled contact handoff URLs: 27

# Exact Response Needed

For each reviewed row, set `decision` to `approve`, `edit`, or `reject`. `approvedBy` is required for approvals. `approvalNote` is required for edits or rejection and recommended for approvals with review flags. Leave unreviewed rows at `decision=null`.

# Execution Owner After Reply

`growth-lead` owns applying explicit first-send decisions to the GTM ledger. `webapp-codex` owns repo validation after the reply is recorded. `blueprint-chief-of-staff` owns reply correlation and resume routing.

# Immediate Next Action After Reply

Only after explicit decisions are recorded with this blocker id, apply the approval packet and rerun local audit/report checks. Do not send email, poll Gmail, mutate live Paperclip, call providers, or touch payment setup from this packet.

```bash
npm run gtm:first-send-approval:apply -- --write --allow-blocked
npm run gtm:hosted-review:audit
npm run gtm:hosted-review:buyer-loop -- --write --allow-blocked
npm run human-replies:audit-durability -- --allow-not-ready
```

# Do Not Run Without Explicit Live Authorization

```bash
npm run gtm:send -- --write --dry-run 0
npm run human-replies:poll
npm run human-replies:send-test-blocker
npm run human-replies:prove-production
```

# Evidence

- `ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json`
- `ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval.template.json`
- `ops/paperclip/programs/human-blocker-packet-standard.md`
- `ops/paperclip/programs/human-reply-handling-contract.md`

# Non-Scope

This packet does not authorize fake contacts, inferred emails, live sends, reply claims, hosted-review starts, city readiness claims, paid spend, pricing commitments, rights/privacy commitments, generated buyer proof, provider calls, Stripe changes, Gmail polling, or live Paperclip mutation.

# Channel Target

Repo-local no-send artifact. When live human-gate dispatch is configured, use Slack DM to `Nijel Hunt` for speed and email to `ohstnhunt@gmail.com` for a durable trail. Never use `hlfabhunt@gmail.com`.

# Watcher / Resume Owner

`blueprint-chief-of-staff` owns reply watching and correlation. Resume execution only after the response is recorded with blocker id `human-blocker:exact-site-first-send-approval:2026-05-09`.
