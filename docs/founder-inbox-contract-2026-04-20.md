# Founder Inbox Contract

Date: 2026-04-20
Status: Phase 0 canonical contract
Control-plane owner: `Blueprint-WebApp`

## Purpose

This document defines the universal founder inbox for Blueprint's autonomous organization.

Its job is to ensure every true founder-facing interrupt across WebApp, Capture, Pipeline, and Paperclip automation uses one:

- packet shape
- blocker id
- channel policy
- watcher/correlation rule
- reply-resolution rule
- resume contract

If a founder-facing interrupt does not follow this contract, it is incomplete and should not be treated as a valid human gate.

## Scope

This contract applies to founder-facing asks for:

- non-standard pricing or payout exceptions
- rights, privacy, consent, commercialization, or lawful-access exceptions
- legal or contract exceptions
- posture-changing public or buyer-facing claims
- irreversible budget or commitment decisions
- production-only irreversible actions without a safe preview path

This contract does not apply to:

- routine reversible implementation work
- ordinary technical diagnosis
- standard quotes inside written policy
- routine queue routing
- internal preview or test approvals

Those stay `repo_local_no_send` and should be handled by the owning lane without a founder packet.

## Source documents

This contract refines and unifies the current repo guidance in:

- [Human Blocker Packet Standard](../ops/paperclip/programs/human-blocker-packet-standard.md)
- [Human Reply Handling Contract](../ops/paperclip/programs/human-reply-handling-contract.md)
- [Autonomous Org Cross-Repo Operating Graph Contract](./autonomous-org-cross-repo-operating-graph-2026-04-20.md)

## Universal founder inbox model

The founder inbox is not a mailbox product. It is a durable decision system with these required parts:

1. one packet per blocker
2. one durable `blocker_id`
3. one routing owner
4. one execution owner after reply
5. one exact response needed
6. one resume action payload
7. one durable reply record

## Routing classes

Every human-involved stop must be classified as exactly one of:

- `universal_founder_inbox`
- `repo_local_no_send`

`universal_founder_inbox` means the system must prepare a founder packet, dispatch it through an approved channel, watch for the reply, and resume execution from durable state.

`repo_local_no_send` means the system must not create a founder-facing packet. It should route within the repo, Paperclip, CTO, Ops Lead, or other non-founder owner instead.

## Canonical packet shape

Every founder packet must carry these fields in durable state:

| Field | Required meaning |
|---|---|
| `blocker_title` | One-line description of the exact decision. |
| `blocker_id` | Stable correlation id shared across Paperclip, Firestore, email, Slack, and reports. |
| `decision_type` | Short category such as `pricing_exception`, `rights_exception`, `legal_exception`, `public_claim_exception`, or `budget_exception`. |
| `irreversible_action_class` | The irreversible class being approved, if any. |
| `routing_class` | Must be `universal_founder_inbox` for packets in this contract. |
| `why_blocked` | Why the system cannot proceed safely alone. |
| `recommendation` | The answer the system recommends approving now. |
| `alternatives` | Realistic other branches still available. |
| `downside_risk` | Main risk of the recommendation. |
| `exact_response_needed` | The precise approval, answer, or boundary needed from founder. |
| `execution_owner_after_reply` | Named lane that resumes immediately after a resolved reply. |
| `resume_action` | Concrete next action the execution owner will take. |
| `deadline_checkpoint` | When a response is needed or when it will be revisited. |
| `evidence_refs` | Minimal durable evidence supporting the recommendation. |
| `non_scope` | What the approval does not authorize. |
| `repo_refs` | Repo, issue, report, or artifact links needed for traceability. |
| `channel_target` | Slack DM, email, or both, using approved rules below. |

If any of these fields are missing, the packet is incomplete.

## Approved channels and identities

Default fast path:

- Slack DM to `Nijel Hunt`

Default durable path:

- email to `ohstnhunt@gmail.com`

Identity rules:

- approved org-facing email identity: `ohstnhunt@gmail.com`
- disallowed identity: `hlfabhunt@gmail.com`

Slack is currently a notification or mirror path only.

Email to `ohstnhunt@gmail.com` is the only durable founder resume path until Slack has real inbound correlation, durable reply ingest, and resume handoff implemented end to end.

## Ownership contract

Default owners:

- watcher owner: `blueprint-chief-of-staff`
- technical escalation owner: `blueprint-cto`
- technical execution owner: `webapp-codex`
- non-technical execution owner: `ops-lead`, unless a narrower lane already owns the case

Responsibilities:

- `blueprint-chief-of-staff` owns packet dedupe, dispatch, watcher correlation, reply classification, and delegation
- `blueprint-cto` is involved only when the reply changes technical diagnosis, cross-repo routing, or platform-contract judgment
- the execution owner performs the actual resumed work and writes closeout evidence

## Correlation contract

The founder inbox must keep one durable thread per `blocker_id`.

Minimum correlation fields:

- `blocker_id`
- outbound channel
- outbound subject or Slack root-thread reference
- recipient or channel target
- routing owner
- execution owner
- resume action descriptor
- Paperclip issue id when available
- report path when available

Correlation priority:

1. explicit `blocker_id`
2. recorded email thread id or Slack thread id
3. normalized subject/body match against the existing outbound record

## Durable record of truth

The reply system must persist to durable stack surfaces rather than chat memory.

Current repo contract:

- Firestore `humanBlockerThreads`
- Firestore `humanReplyEvents`
- Firestore `opsActionLogs`
- Firestore `opsWorkItems`

When known, the thread must also carry:

- owning Paperclip issue id
- owning report path
- repo name
- decision type

## Reply classification

### Resolved reply

A reply is resolved only when it provides enough information to execute the named `resume_action` without another founder round-trip.

Examples:

- approval to proceed with the recommended option
- a concrete answer selecting one alternative
- a confirmation that a needed credential or external artifact is now present

### Ambiguous reply

A reply is ambiguous when it does not safely unblock the `resume_action`.

Examples:

- partial answer with no selected branch
- a new exception with no explicit approval
- a question that asks the agent to restate the same packet without deciding

Ambiguous replies do not count as resolved. They must update the same blocker thread, not create a new founder packet.

## Resume-immediately contract

"Resume immediately" means all of the following occur in one ingest pass:

1. the reply is persisted in `humanReplyEvents`
2. the thread is updated in `humanBlockerThreads`
3. the reply is classified as resolved or ambiguous
4. the `opsWorkItems` delegate record is created or updated with the exact next step
5. the named execution owner can continue from durable state without an operator retyping the reply in chat

It does not require automatic repo markdown edits by the watcher itself.

## Dedupe and aging rules

- one real blocker gets one active founder thread
- do not create separate founder packets for the same blocker across WebApp, Capture, Pipeline, and Paperclip
- aging and escalation stay on the same `blocker_id`
- follow-up reminders must reference the original packet rather than replacing it

## Success criteria

This contract is successful only when:

- every founder-facing interrupt carries one durable `blocker_id`
- every founder-facing interrupt is resumable from email without relying on Slack visibility
- every reply is persisted before execution resumes
- every resumed action has one named execution owner
- no routine reversible work is misrouted into the founder inbox

## References

- [Autonomous Org Cross-Repo Operating Graph Contract](./autonomous-org-cross-repo-operating-graph-2026-04-20.md)
- [Company Metrics Contract](./company-metrics-contract-2026-04-20.md)
- [Human Blocker Packet Standard](../ops/paperclip/programs/human-blocker-packet-standard.md)
- [Human Reply Handling Contract](../ops/paperclip/programs/human-reply-handling-contract.md)
