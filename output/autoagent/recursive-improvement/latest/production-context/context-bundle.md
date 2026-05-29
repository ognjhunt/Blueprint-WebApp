# AutoAgent Production Context Bundle

Generated: 2026-05-29T21:31:23.467Z
Default mode: dry_run
Registry: server/agents/autoagent-production-action-registry.ts
Owner system: paperclip_hermes
Target record: recursive-agent-improvement-loop
Proof source: paperclip_issue_metadata_snapshot
Proof path: /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/production-context/paperclip-issue-metadata-snapshot.json
Rollback snapshot: /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/production-context/rollback-snapshot.json
Candidate path: /Users/nijelhunt_1/workspace/Blueprint-WebApp/labs/autoagent/promotion-candidates/autoagent-to-paperclip-hermes-2026-05-28.json

## Allowed Live Action Types

- paperclip_hermes_internal_metadata_update

## Registered Live Action Types

- paperclip_hermes_internal_metadata_update
- paperclip_internal_report_pointer_update

## Action Constraints

### paperclip_hermes_internal_metadata_update

Owner system: paperclip_hermes
Proof source: paperclip_issue_metadata_snapshot
Rollback strategy: restore_previous_metadata_snapshot
Mutation surface: paperclip_hermes.internal_metadata
Requires prior live action proof: none
Allowed target fields:
- metadata.autoagent.production_decision_loop

## Proven Live Action Types

- none

First live lane proof: /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/production-canary/execution.json
First live lane proven: false

## Blocked Action Types

- queue_state_update
- internal_note_or_report_write
- external_send
- payment_or_entitlement
- provider_execution
- hosted_session_fulfillment
- rights_privacy_legal
- city_launch

## Constraints

- default command remains dry-run
- production execution requires --execute-production-canary
- AI proposal is report/proposal only and never executes directly
- deterministic validator may reject any proposal
- only registry-approved production actions can execute
- paperclip_internal_report_pointer_update is allowed only after paperclip_hermes_internal_metadata_update has a committed execution proof
- external sends, payments, providers, hosted sessions, rights/legal, city-launch, and customer claims remain blocked
- every execution writes audit proof and uses an idempotency key
- rollback snapshot must exist before canary execution
