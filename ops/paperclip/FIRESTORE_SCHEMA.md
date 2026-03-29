# Blueprint Firestore Schema Reference

This is the operational Firestore reference for the current Phase 2 autonomous ops implementation in `Blueprint-WebApp`.

## Core Collections

### `waitlistSubmissions`
- Waitlist and capturer-beta intake.
- Key fields: `email`, `market`, `role`, `device`, `status`, `queue`, `ops_automation`, `human_review_required`, `automation_confidence`.

### `inboundRequests`
- Buyer and site-operator inbound requests.
- Key fields: `requestId`, `qualification_state`, `opportunity_state`, `contact`, `request`, `ops`, `ops_automation`, `buyer_review_access`.

### `contactRequests`
- Support/contact submissions and fallback Help-page reschedule requests.
- Key fields: `name`, `email`, `company`, `message`, `requestSource`, `summary`, `ops_automation`.

### `bookings`
- Mapping/session bookings created during signup.
- Key fields:
  - `date`, `time`, `blueprintId`, `businessName`, `address`, `email`, `contactName`, `status`
  - `reschedule_request`
    - `status`
    - `current_date`, `current_time`
    - `requested_date`, `requested_time`
    - `requested_by`
    - `reason`
    - `ledger_doc_id`

### `blueprints`
- Buyer-facing blueprint records.
- Key fields: `businessName`, `address`, `email`, `phone`, `postSignupWorkflowStatus`.

### `capture_jobs`
- Contributor-facing capture opportunities and field-ops coordination state.
- Key fields:
  - `title`, `address`, `lat`, `lng`, `status`, `marketplace_state`
  - `buyer_request_id`, `site_submission_id`, `rights_status`, `capture_policy_tier`
  - `field_ops.capturer_assignment`
  - `field_ops.last_communication`
  - `field_ops.reminders`
  - `site_access.permission_state`
  - `site_access.operator_contact`

### `creatorCaptures`
- Capturer-submitted capture records.
- Key fields: `creator_id`, `capture_job_id`, `status`, `rights_profile`, `quality`, `earnings`, `timeline`.

### `creatorPayouts`
- Finance/payout review queue.
- Key fields:
  - `creator_id`, `capture_id`, `status`, `stripe_payout_id`, `failure_reason`
  - `ops_automation`
  - `finance_review.review_status`
  - `finance_review.next_action`
  - `finance_review.notes`
  - `finance_review.response_draft`

### `action_ledger`
- Durable Phase 2 action log.
- Key fields:
  - `idempotency_key`, `lane`, `action_type`
  - `source_collection`, `source_doc_id`
  - `status`
  - `action_payload`, `draft_output`, `action_result`
  - `execution_attempts`, `last_execution_error`
  - `provider_reference`
  - `created_at`, `updated_at`, `sent_at`

## Operational Notes

- Low-risk reversible actions route through `action_ledger` before hitting email, calendar, Slack, or internal Firestore updates.
- Payouts and disputes remain human-gated. `finance_review` is the operator-owned decision surface, not an autonomous execution path.
- Public Help-page reschedule submissions first try to resolve a real booking by email and business name. Unmatched requests fall back into `contactRequests` for support review.
