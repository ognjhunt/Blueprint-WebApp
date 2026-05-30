# Autonomous KPI Live Source Status

Generated: 2026-05-30T12:00:00.000Z
Contract: 2026-05-30.kpi-live-source-contract.v1

This artifact is repo-local and Notion-mirror-ready. It does not write Notion, Firestore, Stripe, providers, sends, or Paperclip.

Summary: 4 sourced, 4 source needed, 8 total.

| KPI row | Status | Reportable value | Evidence | Source-needed reason | Blocked live source |
|---|---|---:|---|---|---|
| Captures | Sourced | 1 | capture_submissions/cap-fixture-1 | none | none |
| Proof packages | Sourced | 1 | operatingGraphEvents/package-fixture-1 | none | none |
| Hosted starts | Source needed |  | none | hosted_session_proof_drift, missing_source:hostedSessions, unsupported_metric_claim | hosted_starts: Firestore hostedSessions runtime/session evidence, hosted_starts: Hosted-review operatingGraph event correlated to hostedSessions |
| Contacts | Sourced | 2 | inboundRequests/buyer-fixture-1, contactRequests/support-fixture-1 | none | none |
| Sends / replies / calls | Source needed |  | none | missing_source:humanReplyEvents, missing_source:callEvents, unsupported_metric_claim | sends_replies_calls: Firestore humanReplyEvents reply records, sends_replies_calls: Qualified call event ledger or repo-local call snapshot |
| Buyer support | Sourced | 1 | contactRequests/support-fixture-1 | none | none |
| CI failures | Source needed |  | none | missing_source:githubWorkflowRuns, missing_source:paperclipIssues, unsupported_metric_claim | ci_failures: GitHub workflow polling snapshot, ci_failures: Paperclip managed CI issue/source mapping snapshot |
| Revenue / payments | Source needed |  | none | missing_source:stripeEvents, missing_source:checkoutSessions, stripe_payment_source_missing, unsupported_metric_claim | revenue_payments: Stripe checkout/webhook/payment event evidence, revenue_payments: Stripe checkout session evidence |

## Source Contracts

### Captures
- Owner system: Firestore capture projections backed by BlueprintCapture run truth
- Freshness: 168 hours
- Blocker behavior: Keep the Notion KPI row as Source needed until a capture_submissions or creatorCaptures record carries fresh capture/upload provenance.
- Source: capture_submissions (capture_submissions)
  - Allowed fields: capture_id, site_submission_id, buyer_request_id, capture_job_id, lifecycle.capture_uploaded_at, operational_state.upload_state, submitted_at, updated_at
- Source: creatorCaptures (creatorCaptures)
  - Allowed fields: id, capture_job_id, buyer_request_id, site_submission_id, captured_at, status, updated_at

### Proof packages
- Owner system: BlueprintCapturePipeline package output projected into WebApp
- Freshness: 168 hours
- Blocker behavior: Keep proof-package KPI values Source needed until package-ready evidence links back to capture or request ids.
- Source: operatingGraphEvents where entity_type=package_run (operatingGraphEvents)
  - Allowed fields: entity_type, entity_id, stage, source_repo, source_kind, metadata.capture_id, metadata.site_submission_id, metadata.buyer_request_id, metadata.package_id, recorded_at_iso

### Hosted starts
- Owner system: WebApp hosted-session runtime and Firestore hostedSessions
- Freshness: 72 hours
- Blocker behavior: Keep hosted-start values Source needed unless hostedSessions contains fresh runtime/session evidence. OperatingGraph text alone is proof drift.
- Source: hostedSessions (hostedSessions)
  - Allowed fields: sessionId, status, sessionMode, site.siteWorldId, site.capture_id, createdBy.uid, createdAt, updatedAt, runtimeHandle.runtime_base_url, presentationRuntime.status, presentationRuntime.uiBaseUrl, latestEpisode.episodeId
- Source: operatingGraphEvents where stage=hosted_review_started (operatingGraphEvents)
  - Allowed fields: entity_type, entity_id, stage, source_kind, metadata.hosted_session_id, metadata.session_id, metadata.hostedReviewRunId, metadata.package_id, recorded_at_iso

### Contacts
- Owner system: Firestore inbound/contact request records
- Freshness: 168 hours
- Blocker behavior: Keep contact KPIs Source needed when contact rows are absent or only exist as narrative target research.
- Source: inboundRequests (inboundRequests)
  - Allowed fields: requestId, status, qualification_state, opportunity_state, contact.email_normalized, contact.company, context.buyerChannelSource, createdAt, updatedAt
- Source: contactRequests (contactRequests)
  - Allowed fields: requestSource, company, email_normalized, summary, ops_automation.intent, createdAt, updatedAt

### Sends / replies / calls
- Owner system: Action ledger, human reply events, and qualified call ledger
- Freshness: 168 hours
- Blocker behavior: Keep the grouped GTM KPI Source needed until sends, replies, and calls each have a fresh ledger-backed source.
- Source: action_ledger send records (action_ledger)
  - Allowed fields: idempotency_key, lane, action_type, source_collection, source_doc_id, status, provider_reference, created_at, updated_at
- Source: humanReplyEvents (humanReplyEvents)
  - Allowed fields: blocker_id, thread_id, channel, approved_email, created_at, received_at
- Source: qualified call event artifact (callEvents)
  - Allowed fields: call_id, request_id, status, started_at, completed_at, artifact_path

### Buyer support
- Owner system: Firestore contactRequests plus support-triage action ledger
- Freshness: 168 hours
- Blocker behavior: Keep buyer-support KPIs Source needed unless support triage rows come from contactRequests or action_ledger support records.
- Source: contactRequests where ops_automation.intent=support_triage (contactRequests)
  - Allowed fields: requestSource, summary, queue, priority, human_review_required, automation_confidence, ops_automation.intent, ops_automation.status, createdAt, updatedAt
- Source: action_ledger support records (action_ledger)
  - Allowed fields: idempotency_key, lane, action_type, source_collection, source_doc_id, status, created_at, updated_at

### CI failures
- Owner system: GitHub workflow polling mirrored through Paperclip/plugin snapshots
- Freshness: 72 hours
- Blocker behavior: Keep CI failure KPIs Source needed unless a GitHub workflow run snapshot or Paperclip source mapping names the failing run.
- Source: GitHub workflow run snapshot (githubWorkflowRuns)
  - Allowed fields: repo, workflow, run_id, status, conclusion, html_url, created_at, updated_at
- Source: Paperclip managed issue with sourceType=github-workflow (paperclipIssues)
  - Allowed fields: sourceType, sourceId, issueId, status, title, updatedAt

### Revenue / payments
- Owner system: Stripe checkout/webhook truth, optionally mirrored into Firestore
- Freshness: 168 hours
- Blocker behavior: Keep revenue and payment values Source needed until Stripe evidence exists. Entitlements or request text alone are not payment truth.
- Source: Stripe webhook/event snapshot (stripeEvents)
  - Allowed fields: event_id, type, created, amount_total, currency, payment_status, checkout_session_id, payment_intent
- Source: Stripe checkout session snapshot (checkoutSessions)
  - Allowed fields: id, payment_status, status, amount_total, currency, created, updated_at

## Blocked Live Sources

- ci_failures: GitHub workflow polling snapshot
- ci_failures: Paperclip managed CI issue/source mapping snapshot
- hosted_starts: Firestore hostedSessions runtime/session evidence
- hosted_starts: Hosted-review operatingGraph event correlated to hostedSessions
- revenue_payments: Stripe checkout session evidence
- revenue_payments: Stripe checkout/webhook/payment event evidence
- sends_replies_calls: Firestore humanReplyEvents reply records
- sends_replies_calls: Qualified call event ledger or repo-local call snapshot

## Notion Mirror Rule

- allowed_to_write_notion: false
- instruction: This repo-local artifact is safe for Notion Manager to mirror later. This generator must not write Notion.
