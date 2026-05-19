---
authority: derived
source_system: repo
source_urls:
  - "repo:///knowledge/reports/city-launch-execution/durham-nc/2026-04-23-durham-closure-pilot-status.md"
last_verified_at: 2026-04-23
owner: city-launch-agent
sensitivity: internal
confidence: 0.86
---

# Durham Closure Pilot Status

## Current Verdict

Durham is the active closure pilot, but it is not closed end to end.

What moved on 2026-04-23:

- The live Blueprint Paperclip automation plugin was restored and proved through a fresh webhook-to-managed-issue smoke.
- BotBuilt now has a verified official company-level contact path: `info@botbuilt.com`.
- ROI Industries now has a verified official company-level contact path: `info@roiindustries.com`.
- Summit Design and Engineering Services is queued as a Triangle AEC-grade capturer candidate for trust review only.
- The Durham operating graph was updated with explicit closure blockers and next actions.

## Closure Checklist

| Requirement | Status | Evidence |
| --- | --- | --- |
| Real response or explicit no-response outcome | Waiting | `cityLaunchSendActions` has two sent Lovett rows from 2026-04-22 and `responses_routed: 0`; the follow-up/no-response window has not expired. |
| Verified buyer contact path or no-contact finding | Partially satisfied | BotBuilt and ROI Industries official company-level contact paths are now recorded in `cityLaunchBuyerTargets`; no named human buyer response exists. |
| Approved capturer signal | Blocked | `waitlistSubmissions` contains only test/founder Durham rows; `capture_submissions` has no Durham rows; Summit is only a candidate for trust review. |
| Rights-cleared proof asset | Blocked | Current Durham proof-pack/right-clearance notes still show no cleared proof asset. |
| Hosted-review start | Blocked | No `hosted_review_started` graph event exists for Durham. |
| Recorded buyer outcome | Blocked | `buyerOutcomes` has no Durham outcome and should stay empty until a real disposition exists. |

## Operating Boundary

Do not launch another city until this pilot produces a real closure branch:

- positive branch: response -> proof asset -> hosted review -> buyer outcome
- no-response branch: follow-up window expires -> explicit no-response outcome -> next city-learning issue

Do not count official generic contact paths as buyer intent. They only unblock the next researched outreach decision.

## Next Actions

- `city-launch-agent`: keep Lovett response tracking open until the bounded follow-up window expires or a real reply lands.
- `city-demand-agent`: use the verified BotBuilt and ROI Industries contact paths for the next buyer-lane decision, without claiming named-human buyer readiness.
- `capturer-growth-agent`: run Summit through trust review as a candidate; do not mark it approved without an actual applicant/confirmation.
- `rights-provenance-agent`: keep proof-pack/listing work blocked until a concrete Durham proof asset exists and can be cleared.
- `buyer-solutions-agent`: do not start hosted review for Durham until proof and buyer-response evidence exist.

## Source Notes

- BotBuilt source: https://botbuilt.com/
- ROI Industries source: https://roiindustries.com/contact/
- Durham send state: `ops/paperclip/playbooks/city-opening-durham-nc-send-ledger.md`
- Durham response state: `ops/paperclip/playbooks/city-opening-durham-nc-response-tracking.md`
- Durham scorecard: `knowledge/reports/analytics/2026-04-22-durham-launch-scorecard.md`

## Summary

Legacy report section backfilled for Hermes KB schema compliance. Use the existing report body above as the substantive summary and verify current state in Paperclip or repo truth before reuse.

## Evidence

Legacy report section backfilled for Hermes KB schema compliance. Evidence remains the source links, issue references, artifact paths, and report body above; no new runtime proof was added by this cleanup.

## Recommended Follow-up

- Promote reusable findings into `knowledge/compiled/` before treating this historical report as current guidance.
- Verify current Paperclip issue state, rights/provenance state, and repo artifacts before acting on this report.

## Linked KB Pages

- No additional linked KB page was added during schema cleanup; use existing links in the report body and canonical repo/Paperclip references above.

## Authority Boundary

This report is a historical Hermes KB support artifact. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, package manifests, or hosted-runtime truth.
