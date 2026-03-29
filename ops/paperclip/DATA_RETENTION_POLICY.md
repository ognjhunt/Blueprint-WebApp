# Blueprint Data Retention & Privacy Policy

> For autonomous-org agents operating against the current `Blueprint-WebApp` Firestore model.

## Retention Periods

| Collection | PII Fields | Retention | Legal Basis |
|-----------|-----------|-----------|-------------|
| `waitlistSubmissions` | email, phone, location, device | 12 months from creation; 30 days after explicit rejection | Legitimate interest |
| `inboundRequests` | buyer contact info, site context, message details | 12 months from creation; 30 days after close if not converted | Legitimate interest / pre-contract |
| `contactRequests` | name, email, company, message | 24 months from last resolution activity | Legitimate interest |
| `capture_jobs` | site/operator context, assignment details | 24 months after closure unless converted into a longer-lived buyer record | Legitimate interest / operational necessity |
| `creatorCaptures` | creator id, address, earnings context | Indefinite while commercially active; 90 days after delisting or rejection unless needed for disputes | Contractual / operational necessity |
| `creatorPayouts` | creator id, payout amounts, Stripe references | 7 years | Legal and tax obligation |

## Deletion Protocol

1. Run a monthly retention review and identify documents past their retention window.
2. Flag those documents for deletion review. Do not hard-delete automatically in Phase 1.
3. Route the deletion batch to a human approver with collection, count, and justification.
4. Log the approved deletion batch with timestamp, scope, and operator.
5. Confirm deletion outcome in the follow-up note or Paperclip issue.

## Subject Access Requests

If an agent receives a data-access, correction, or deletion request:

1. Escalate immediately using the handoff protocol in [HANDOFF_PROTOCOL.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/HANDOFF_PROTOCOL.md).
2. Do not attempt to fulfill the request autonomously in Phase 1.
3. Log the requester identity, request type, received timestamp, and relevant document ids.
4. Acknowledge receipt only if the workflow already allows that communication and keep the response factual.

## Agent Data Handling Rules

### Reports and Digests

- Do not paste raw PII into Slack digests or broad Notion summaries.
- Prefer document ids, request ids, capture ids, or anonymized handles.
- Include direct contact details only when the assigned resolver needs them for the current task.

### Paperclip Issues and Handoffs

- Minimize copied PII in issue comments.
- Reference Firestore document ids and collection names instead of duplicating full user data.
- If PII is operationally necessary, mark the comment clearly with `[CONTAINS-PII]`.

### Notion

- Work Queue items should prefer anonymized labels and internal ids.
- Knowledge entries must not preserve individual user histories.
- Aggregate counts, rates, and trends are acceptable.

### Logs

- Do not write email addresses, full names, postal addresses, or payment details into generic logs.
- Use ids and collection references for traceability.
- `activity.log.write` output from the plugin must stay free of raw PII.

## Compliance Notes

- Assume US operations with CCPA exposure and GDPR exposure where EU resident data is present.
- Data minimization and purpose limitation apply to all agent-authored artifacts.
- `creatorPayouts` may be exempt from deletion when financial retention obligations apply.
- The founder remains the human escalation point for SARs and irreversible privacy decisions.
