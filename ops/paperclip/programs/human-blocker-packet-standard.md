# Human Blocker Packet Standard

Purpose:

- keep autonomous execution moving until a true human gate is reached
- force every human escalation into a short, decision-ready packet
- make Slack DM and email escalations reusable across Codex, Claude, Hermes, and Paperclip lanes
- ensure the agent can resume immediately after the human responds

Use this standard when a case is truly human-gated, including:

- rights, privacy, consent, or commercialization ambiguity
- legal or compliance interpretation
- non-standard pricing, contract, or capability commitments
- irreversible budget allocation or company-level strategic change
- production smoke approval when the run would create real external artifacts and no preview/sandbox target exists
- any case where proceeding would require inventing truth the system does not have

Automation rule:

- any Blueprint agent may invoke the shared `blueprint-dispatch-human-blocker` contract when it reaches a true human gate
- use chief-of-staff review when the packet itself needs a second pass before delivery, but do not fall back to a passive blocked issue when the standard packet should be sent

Do not create a blocker packet for routine work already inside documented guardrails, including:

- reversible product or code changes
- standard quotes inside approved bands
- standard ops routing and queue handling
- internal testing and preview verification
- routine launch validation where the target is local or preview-only

Hard rules:

- one blocker per packet
- one durable blocker id per packet
- one recommended answer per packet
- one exact ask per packet
- one named execution owner after reply
- one next action that happens immediately after the reply
- include the channel target: Slack DM or email
- if a field is missing, the packet is incomplete and should not be sent

Required field order:

1. Blocker Title
- one-line name for the blocked decision

1a. Blocker Id
- stable correlation id carried into email subject/body, Slack body, Firestore thread state, and the owning report or issue when available

2. Why This Is Blocked
- what is blocked
- why this is genuinely human-gated
- why the agent cannot safely proceed alone

3. Recommended Answer
- the default answer the human should approve now

4. Alternatives
- realistic alternatives still available

5. Downside / Risk
- what could go wrong with the recommended answer

6. Exact Response Needed
- the precise permission, answer, credential, or boundary needed

7. Execution Owner After Reply
- the agent or human lane that moves immediately once the response arrives

8. Immediate Next Action After Reply
- the exact action that will be taken

9. Deadline / Checkpoint
- when the response is needed or when the issue will be revisited

10. Evidence
- the minimum proof supporting the recommendation

11. Non-Scope
- what this reply does not authorize

Credential, sender, OAuth, approval, and resume blockers:

- These blockers must not stop at "credentials missing", "approval missing", or "blocked".
- The packet must include:
  - durable blocker id
  - owner responsible for collecting the input
  - exact env var, account action, approval artifact, or human input needed
  - safe proof command that does not send email, poll Gmail, wake live Paperclip, mutate Notion, or change provider state
  - retry/resume condition
  - disallowed workaround
- Safe proof command default:

```bash
npm run human-replies:audit-durability -- --allow-not-ready
```

Common exact asks:

| Blocker | Durable blocker id | Owner | Exact input needed | Safe proof | Retry/resume condition | Disallowed workaround |
|---|---|---|---|---|---|---|
| Sender/domain verification | `human-blocker:city-launch-sender-verification` | `blueprint-chief-of-staff` | Confirm the active provider sender/domain is verified and set `BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified`. | `npm run human-replies:audit-durability -- --allow-not-ready` | Rerun the audit after provider verification and the live env flag are in place. | Do not treat configured SendGrid/SMTP credentials, Slack status, dry-run sends, or first-send approval as sender proof. |
| Gmail OAuth | `human-blocker:gmail-oauth-<reason>` | `blueprint-chief-of-staff` | Provide `BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID`, `BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET`, `BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN` for `ohstnhunt@gmail.com`, and `BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS=production`. | `npm run human-replies:audit-durability -- --allow-not-ready` | Rerun the audit after OAuth resolves the mailbox as `ohstnhunt@gmail.com` and production publishing state is explicit. | Do not poll `hlfabhunt@gmail.com`, scrape Gmail, use browser cookies, or claim outbound delivery proves reply resume. |
| Approved reply identity | `human-blocker:approved-reply-identity` | `blueprint-chief-of-staff` | Set `BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=ohstnhunt@gmail.com` explicitly. | `npm run human-replies:audit-durability -- --allow-not-ready` | Rerun the audit after the live env explicitly names the approved mailbox. | Do not rely on code defaults, alternate Gmail connectors, Slack mirrors, or `hlfabhunt@gmail.com`. |
| First-send approval | `human-blocker:exact-site-first-send-approval:<date-or-run-id>` | `blueprint-chief-of-staff` | Founder approves, edits, or rejects the rows in `ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval.template.json`; then apply with the documented GTM approval command. | `npm run gtm:send -- --dry-run --allow-blocked` | Resume GTM send only after approval decisions are recorded and durability audit is ready. | Do not send recipient-backed first touches from dry-run rows, generic approval language, inferred recipient evidence, or approval of the product page alone. |
| City-launch resume | `city-launch-approval-<city-slug>` or `city-launch-deep-research-<city-slug>` | `city-launch-agent` with `blueprint-chief-of-staff` watching | Reply must approve the named launch action or confirm the named Deep Research/provider credential; resume metadata must name city, budget tier, budget max, and window. | `npm run city-launch:preflight -- --city "<City, ST>" --allow-blocked --no-write-report --no-write-deep-research-blocker --format markdown` | Resume only after the reply is recorded with the blocker id and the safe preflight or planning audit reaches the next stage. | Do not wake live Paperclip, run live sends, spend provider budget, or mark the city live from a vague approval or missing-credential note. |

Channel rule:

- use Slack DM to `Nijel Hunt` when speed matters and the ask can fit in a concise message
- use email to `ohstnhunt@gmail.com` when a durable approval trail matters, the packet needs more context, or the response may arrive asynchronously
- if the same blocker needs both speed and a durable trail, send Slack first and mirror the same packet by email

Email identity rule:

- the only approved org-facing email identity for this use-case is `ohstnhunt@gmail.com`
- do not draft from, send from, reply from, or configure org escalation through `hlfabhunt@gmail.com`
- if the active Gmail connector or mail tool is authenticated as `hlfabhunt@gmail.com`, do not use it for org email; use the approved sender path or stop and surface the identity mismatch explicitly

Resume rule:

- once the human replies, record the answer in the owning issue/report/run artifact
- write the blocker id into the packet so the reply watcher can correlate the answer back to the right blocker thread
- continue immediately with the named next action
- do not reopen the same blocker unless the answer is still ambiguous against the current evidence
