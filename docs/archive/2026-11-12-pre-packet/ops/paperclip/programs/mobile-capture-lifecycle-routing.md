# Mobile Capture Lifecycle Routing

Paperclip is the closure layer for mobile capture operations. The mobile app remains the truthful capture client; it must not claim payout, buyer readiness, package readiness, or field-ops closure until backend state supports that claim.

## Ledger Inputs

- `capture_submissions`
- `sessionEvents`
- `creatorProfiles`
- `capture_jobs`
- `creatorPayouts`
- `creatorCaptures`

## Routed Events

- `capture.upload_failed`, `capture.upload_stalled`, and `capture.raw_validation_failed` route to `capture-codex`.
- `capture.submitted` and `capture.qa_needed` route to `capture-qa-agent`.
- `capture.recapture_needed` routes to both `capture-qa-agent` and `capturer-success-agent`.
- `capturer.first_capture_uploaded`, `capturer.first_capture_failed`, and `capturer.inactive_after_approval` route to `capturer-success-agent`.
- `notification.device_sync_failed` routes to `capture-codex`.
- `payout.action_required` routes to `finance-support-agent`.
- `field_ops.assignment_needed` routes to `field-ops-agent`.

## Operating Rule

Do not add a separate mobile ops agent until the existing capture, QA, field ops, finance, and capturer-success owners prove they cannot close the routed issue families. The narrow org should absorb mobile lifecycle work through existing lanes first.
