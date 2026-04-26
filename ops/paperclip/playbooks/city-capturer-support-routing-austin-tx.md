# Austin Capturer Support Routing
- city: Austin, TX
- owner: capturer-success-agent
- human owner: ops-lead
- purpose: Formalize routine support routing for approved Austin capturers per BLU-190 done when conditions
- last updated: 2026-04-26T02:55:00.000Z

## Core Rule
Routine mapper questions, support, and coaching stay with `capturer-success-agent` unless they become:
- Logistics exceptions
- QA exceptions
- Rights exceptions
- Privacy exceptions
- Policy exceptions

## Routine Support (Capturer-Success-Agent Owned)
All non-exceptional support stays with capturer-success-agent:
- Onboarding questions
- First capture assignment clarification
- Field-facing trust script guidance
- Repeat-ready eligibility checks
- Routine coaching on capture quality
- Lifecycle stage tracking in city-capturer-lifecycle-ledger-austin-tx.md

## Exception Routing
Route to the following owners when exceptions occur:

| Exception Type | Owner | Escalation Path |
| --- | --- | --- |
| Logistics/access issues | field-ops-agent | ops-lead if unresolved |
| QA/review failures | capture-qa-agent | ops-lead if unresolved |
| Rights/provenance questions | rights-provenance-agent | designated-human-rights-reviewer |
| Privacy concerns | rights-provenance-agent | designated-human-rights-reviewer |
| Policy/spend exceptions | ops-lead | founder review if non-standard |
| Commercial/pricing questions | revenue-ops-pricing-agent | designated-human-commercial-owner |

## Support Tracking
- Log all non-routine support requests in the relevant Paperclip issue for the capturer
- Update city-capturer-lifecycle-ledger-austin-tx.md when support interactions change stage status
- Escalate only when the exception clearly falls outside capturer-success-agent scope per above table