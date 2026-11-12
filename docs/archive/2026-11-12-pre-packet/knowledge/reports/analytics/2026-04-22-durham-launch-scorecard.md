---
authority: draft
source_system: paperclip
source_urls:
  - "paperclip://issue/3008f970-c9d6-4e81-a769-83b701946889"
  - "repo:///ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/city-launch-durham-nc.md"
  - "repo:///ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/city-opening-durham-nc-execution-report.md"
  - "repo:///ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/city-opening-durham-nc-response-tracking.md"
  - "repo:///ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/city-opening-durham-nc-send-ledger.md"
  - "repo:///ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/city-launch-contact-enrichment-durham-nc.md"
  - "repo:///ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/city-launch-research-materialization-durham-nc.md"
  - "repo:///ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/city-capture-target-ledger-durham-nc.md"
  - "repo:///ops/paperclip/playbooks/city-launch-durham-nc-activation-payload.json"
last_verified_at: 2026-04-22
owner: analytics-agent
sensitivity: internal
confidence: 0.85
---

# Durham Launch Scorecard and Blocker View

## Summary

Durham is publishable as a scorecard plus blocker view, but the city is still blocked on proof motion, live buyer contacts, and widening.

## Evidence

- The Durham launch system is activation-ready with `planning-state: refresh in progress`, `recommended-posture: gated cohort pilot`, and `launch_policy_state: autonomous_execution_ready`.
- The current Durham execution report shows `4` channels ready or created, `2` sends ready or sent, `2` sends marked sent, `0` blocked sends, and `0` routed responses.
- The Durham response-tracking view shows `warehouse-facility-direct` and `professional-capturer` activated, while `buyer-linked-site` and `public-commercial-community` remain created but not yet activated in the automated launch path.
- The Durham send ledger records two direct outreach rows to `madison.jones@lovettindustrial.com`, both marked `sent` and both still awaiting response.
- Contact enrichment recovered `0` buyer-target contacts and `0` capture-candidate contacts, so the named Durham buyer targets remain unresolved.
- Research materialization upserted `3` prospects, `2` buyer targets, `2` touches, and `2` budget recommendations, but it still warns that no explicit `contact_email` evidence exists for the activation-ready buyer direct-outreach lanes.
- The Durham target ledger keeps `Durham Logistics Center` as the top proof target, with `Welcome Venture Park` still only a candidate.
- The activation payload still blocks Durham on a sub-10,000 sq ft first-site scope, recipient-backed buyer contacts, and pre-dispatch export-control screening.
- The current issue snapshot is checked out to this run and remains `in_progress`, so the scorecard work is now owned rather than speculative.

## Scorecard

| Dimension | Status | Source truth |
| --- | --- | --- |
| Launch posture | On track | Durham launch system and activation payload |
| Channel readiness | On track | city-opening channel registry |
| Direct outreach | Blocked on response | city-opening send ledger and response tracking |
| Buyer contact evidence | Blocked | contact enrichment and research materialization |
| Proof motion | Blocked | activation payload and target ledger |
| Widening eligibility | Blocked | activation payload and launch system |

## Blocker View

- Missing routed Durham responses.
- Missing explicit buyer contact_email evidence for the named buyer targets.
- Missing proof-pack delivery, hosted-review start, hosted-review follow-up, and human commercial handoff stamps in the live path.
- Missing first lawful access path and first approved capturer in the canonical milestone path.
- Missing rights-cleared proof asset and first hosted review, so widening stays prohibited.
- Missing proof-motion evidence must remain blocked instead of being treated as progress.

## Recommended Follow-up

- Keep Durham blocked until proof-pack delivery, hosted-review start, and hosted-review follow-up are stamped in the live path.
- Keep the buyer lane research-only until recipient-backed contacts are verified for the named targets.
- Preserve the zero-budget posture and keep all Durham movement grounded in canonical repo truth.

## Linked KB Pages

- [Durham launch system](../../../docs/city-launch-system-durham-nc.md)
- [Durham execution issue bundle](../../../ops/paperclip/playbooks/city-launch-durham-nc-execution-issue-bundle.md)

## Authority Boundary

This report is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
