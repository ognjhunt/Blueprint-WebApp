# Blueprint Firestore Schema Reference

> This reflects the collections and field shapes currently used by `Blueprint-WebApp`.
> Firestore is schemaless, so treat this as an operational reference and verify against live documents before depending on optional fields.

## Primary Ops Collections

### `waitlistSubmissions`
Capturer and private-beta intake submissions created by [waitlist.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/waitlist.ts).

| Field | Type | Description |
|-------|------|-------------|
| `email` | string | Raw applicant email |
| `email_normalized` | string | Lowercased email |
| `email_domain` | string | Parsed domain |
| `location_type` | string | Site/location category |
| `market` | string or null | Market label from form |
| `role` | string or null | Capturer or other role |
| `device` | string or null | Capture device |
| `phone` | string or null | Contact phone |
| `source` | string | Submission source |
| `status` | string | Intake status |
| `queue` | string | Current queue lane |
| `intent` | string | Workflow intent |
| `filter_tags` | string[] | Search/filter tags |
| `ops_automation` | object | Automation state, next action, errors, and Phase 2 action state |
| `human_review_required` | boolean or null | Human gate flag |
| `automation_confidence` | number or null | Model confidence |
| `created_at` | timestamp | Creation time |
| `updated_at` | timestamp | Update time |

**Used by:** Intake Agent, Ops Lead, Analytics Agent

### `inboundRequests`
Buyer and site-operator inbound requests created by [inbound-request.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/inbound-request.ts).

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | string | Stable request identifier |
| `site_submission_id` | string | External/public submission id |
| `status` | string | Request lifecycle status |
| `qualification_state` | string | Qualification stage |
| `opportunity_state` | string | Commercial state |
| `priority` | string | Priority bucket |
| `owner` | object | Assigned owner metadata |
| `contact` | object | Buyer contact info |
| `request` | object | Budget, requested lanes, site info, constraints |
| `context` | object | Source URL, UTM, locale, referrer |
| `enrichment` | object | Company/domain enrichment |
| `events` | object | Email/slack/crm timestamps |
| `ops_automation` | object | Qualification automation state plus Phase 2 action history |
| `human_review_required` | boolean or null | Human gate flag |
| `automation_confidence` | number or null | Model confidence |
| `buyer_review_access` | object | Buyer review URL/token metadata |
| `ops` | object | Rights, capture, quote, proof-path milestone timestamps, and next-step state |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Update time when present |

**Used by:** Intake Agent, Field Ops Agent, Ops Lead, Analytics Agent

`ops.proof_path` milestone timestamps now include:
- `exact_site_requested_at`
- `qualified_inbound_at`
- `proof_pack_delivered_at`
- `proof_pack_reviewed_at`
- `hosted_review_ready_at`
- `hosted_review_started_at`
- `hosted_review_follow_up_at`
- `artifact_handoff_delivered_at`
- `artifact_handoff_accepted_at`
- `human_commercial_handoff_at`

These fields are the authoritative measurement layer for the robot-team 24-hour proof-path funnel. Some are auto-stamped from request lifecycle events, while operator-only milestones are set from the admin lead workflow.

### `contactRequests`
Support/contact-form submissions created by [contact.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/contact.ts) and triaged by the support automation loop.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Requester name |
| `email` | string | Requester email |
| `company` | string | Company name |
| `city` | string | City |
| `state` | string | State |
| `message` | string | Request text |
| `companyWebsite` | string | Website URL |
| `token` | string | Off-waitlist token |
| `offWaitlistUrl` | string | Generated access URL |
| `requestSource` | string | Contact source |
| `summary` | string | Summary or fallback routing context |
| `ops_automation` | object | Support-triage status and artifacts |
| `human_review_required` | boolean or null | Human gate flag |
| `automation_confidence` | number or null | Model confidence |
| `createdAt` | timestamp | Creation time |

**Used by:** Finance Support Agent, Ops Lead, Analytics Agent

### `bookings`
Scheduling records created during signup and post-signup workflow execution.

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | Scheduled mapping date |
| `time` | string | Scheduled mapping time |
| `blueprintId` | string | Related blueprint |
| `businessName` | string | Buyer/business label |
| `address` | string | Site address |
| `email` | string | Buyer contact email |
| `contactName` | string | Buyer contact name |
| `status` | string | Booking lifecycle state |
| `reschedule_request` | object or null | Requested date/time change plus approval/execution state |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Update time when present |

**Used by:** Field Ops Agent, Ops Lead

### `capture_jobs`
Capture-request jobs created from inbound requests by [admin-leads.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/admin-leads.ts).

| Field | Type | Description |
|-------|------|-------------|
| `buyer_request_id` | string | Upstream inbound request |
| `site_submission_id` | string or null | Related site submission id |
| `marketplace_state` | string | Claim/publish state |
| `availabilityStartsAt` | string or null | Availability window start |
| `availabilityEndsAt` | string or null | Availability window end |
| `region_id` | string or null | Assigned region |
| `rights_status` | string | Rights/commercialization state |
| `capture_policy_tier` | string | Capture policy tier |
| `status` | string | Capture job status |
| `field_ops` | object or null | Capturer assignment, comms history, reminder scheduling, and dispatch review state |
| `site_access` | object or null | Operator contact, permission state, outreach history, evidence requirements, overdue flags, and human-only boundary notes |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Update time |

**Used by:** Field Ops Agent, Ops Lead

### `site_access_contacts`
Site-scoped operator contact registry created from Blueprint-owned records or manual operator entry.

| Field | Type | Description |
|-------|------|-------------|
| `capture_job_id` | string | Related capture job |
| `site_title` | string or null | Site label |
| `site_address` | string or null | Site address |
| `email` | string | Operator contact email |
| `name` | string or null | Contact name |
| `company` | string or null | Operator company |
| `role_title` | string or null | Contact role or team |
| `phone_number` | string or null | Contact phone |
| `source` | string | Provenance such as `manual_entry`, `site_access_contact`, or `inbound_request_contact` |
| `verification_status` | string or null | Verification state for the contact |
| `permission_state` | string or null | Latest linked site-access state |
| `notes` | string or null | Operator notes on provenance or authority |
| `last_outreach_at` | timestamp or null | Most recent outreach time |
| `last_response_at` | timestamp or null | Most recent response time |

**Used by:** Field Ops Agent, Ops Lead

### `blueprints`
Buyer-facing blueprint records.

| Field | Type | Description |
|-------|------|-------------|
| `businessName` | string | Buyer/business label |
| `address` | string | Site address |
| `email` | string | Buyer contact email |
| `phone` | string | Buyer contact phone |
| `postSignupWorkflowStatus` | object | Post-signup execution state and results |

**Used by:** Ops Lead, post-signup workflows

### `creatorCaptures`
Creator-submitted capture records created by [creator.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/creator.ts).

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Capture id |
| `creator_id` | string | Creator identifier |
| `capture_job_id` | string or null | Linked capture job |
| `buyer_request_id` | string or null | Linked buyer request |
| `site_submission_id` | string or null | Linked site submission |
| `target_address` | string | Human-readable target |
| `captured_at` | string | Capture timestamp |
| `status` | string | Capture lifecycle state |
| `estimated_payout_cents` | number | Estimated payout |
| `rights_profile` | object or null | Rights metadata |
| `requested_outputs` | unknown[] | Requested outputs |
| `thumbnail_url` | string or null | Thumbnail URL |
| `rejection_reason` | string or null | Rejection reason |
| `quality` | object or null | Quality metadata |
| `earnings` | object | Payout breakdown |
| `timeline` | object[] | Capture timeline |
| `updated_at` | timestamp | Update time |

**Used by:** Capture QA Agent, Field Ops Agent, Analytics Agent

### `creatorPayouts`
Payout ledger records read by the payout exception automation loop in [workflows.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/agents/workflows.ts).

| Field | Type | Description |
|-------|------|-------------|
| `creator_id` | string | Creator identifier |
| `capture_id` | string | Related capture id |
| `status` | string | Payout lifecycle state |
| `stripe_payout_id` | string or null | Stripe payout id |
| `failure_reason` | string or null | Failure reason when present |
| `qualification_state` | string or null | Qualification state |
| `opportunity_state` | string or null | Opportunity state |
| `recommendation` | object or null | Recommendation payload |
| `human_review_required` | boolean or null | Human gate flag |
| `automation_confidence` | number or null | Model confidence |
| `ops_automation` | object | Payout exception triage state |
| `finance_review` | object or null | Operator-owned payout/dispute review state including owner, SLA, evidence, overdue flags, and human-only boundary notes |

**Used by:** Finance Support Agent, Capture QA Agent, Ops Lead, Analytics Agent

### `action_ledger`
Durable action-level execution log for Phase 2 autonomous ops.

| Field | Type | Description |
|-------|------|-------------|
| `idempotency_key` | string | Replay-safe action key |
| `lane` | string | Lane name (`waitlist`, `support`, `post_signup`, etc.) |
| `action_type` | string | Action executor type |
| `source_collection` | string | Firestore collection that produced the action |
| `source_doc_id` | string | Firestore document id that produced the action |
| `status` | string | Approval/execution state (`pending_approval`, `executing`, `sent`, `failed`, etc.) |
| `action_payload` | object | Normalized executor payload |
| `draft_output` | object or null | Draft/policy context when available |
| `execution_attempts` | number | Retry count |
| `last_execution_error` | string or null | Last execution failure |
| `provider_reference` | string or null | External system reference like Calendar event id |
| `created_at` | timestamp | Ledger creation time |
| `updated_at` | timestamp | Last update time |

**Used by:** Ops Lead, waitlist/inbound/support workflows, post-signup workflows, field ops automation

## Important Notes

- Low-risk reversible actions route through `action_ledger` before hitting email, calendar, Slack, or internal Firestore updates.
- `site_access_contacts` is intentionally site-scoped. Do not treat it as a universal operator directory or CRM until Blueprint has an external verified data source for that job.
- Capturer assignment remains heuristic until live calendar/travel integrations exist. `field_ops.dispatch_review` records that limitation explicitly.
- Overdue-review watchdogs may flag `site_access.overdue_review` and `finance_review.overdue_review`, but they do not send outreach, grant permissions, submit disputes, or move money.
- Payouts and disputes remain human-gated. `finance_review` is the operator-owned decision surface, not an autonomous execution path.
- `support_tickets`, `payout_records`, and `stripe_events` are not current top-level Firestore collections in this repo. Support triage currently uses `contactRequests`, and payout triage currently uses `creatorPayouts`.
- Stripe webhook exceptions are routed into Paperclip issues by the Blueprint automation plugin. They are not persisted here as a repo-owned `stripe_events` collection today.
- Buyer hosted-session state is stored in `hostedSessions`, but that collection is not part of the current autonomous-org ops queue set.
- Public Help-page reschedule submissions first try to resolve a real booking by email and business name. Unmatched requests fall back into `contactRequests` for support review.

## PII Notes

Collections that contain direct or indirect personal data:

- `waitlistSubmissions`
- `inboundRequests`
- `contactRequests`
- `bookings`
- `creatorCaptures`
- `creatorPayouts`
- `capture_jobs`
- `site_access_contacts`
