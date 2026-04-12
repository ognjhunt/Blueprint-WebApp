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
