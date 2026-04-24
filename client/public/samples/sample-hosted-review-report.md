# Sample Hosted Review Report

Example sample only. This is not a customer report, deployment guarantee, safety certification, permission certificate, or proof that every listing has the same outputs.

## Listing

- Packet: `BP-SAMPLE-PROOF-PACKET-0426`
- Site: `sample-public-capture-cedar-market-aisle-loop`
- Location type: Grocery store public aisles
- City: Austin, TX
- Review type: Hosted evaluation sample
- Workflow lane: Public aisle loop, endcap transition, refrigeration approach
- Robot setup: Sample shelf-scanning AMR with forward RGB camera
- Session scope: One public-facing route, four review runs, privacy and export notes attached

## Sample People

- Maya Ortiz, robotics deployment lead
- Jordan Lee, field operations reviewer
- Blueprint reviewer, rights and redaction pass

## Run Evidence

| Run | Scenario | Observation | Output |
| --- | --- | --- | --- |
| Run 01 | Baseline aisle navigation | Route is readable through endcap and mid-aisle transitions. | Keep lane in hosted review. |
| Run 02 | Busy public aisle | People and carts create occlusion risk; privacy redaction remains required. | Review only, no raw public export. |
| Run 03 | Refrigeration approach | Lighting and reflective glass need a dedicated perception note. | Add capture note to manifest. |
| Run 04 | Checkout-adjacent exclusion | Route should stop before payment and identifiable-customer zones. | Restricted zone attached. |

## Evidence Opened

- Observation frames: included in sample export layout
- Route review: example route replay and waypoint notes
- Redacted walkthrough reference: buyer-facing review artifact
- Action trace: example action-summary export
- Rights sheet: see `sample-rights-sheet.md`
- Export bundle: see `sample-export-bundle.json`

## Buyer Decision Notes

- The sample demonstrates how Blueprint presents one public-facing exact site, its capture provenance, and the hosted-review output shape.
- The buyer question was whether a grocery-specific hosted review was worth scoping before sending a field team.
- The sample answer was "yes, hosted review first," while raw-media export and commercial sharing stay review-gated.
- A real buyer report depends on the listing, available capture artifacts, requested robot setup, and scoped rights/export review.
- Hosted review reduces uncertainty before deeper deployment work; it does not replace safety validation, on-site signoff, or stack-specific testing.

## Public Capture Guardrails

- Capture only common aisles and customer-accessible circulation paths.
- Avoid checkout lanes, pharmacy counters, screens, receipts, employee-only doors, faces, children, and customer PII.
- Stop if staff objects or signage restricts recording.

## Follow-Up Questions

- Which robot setup or policy adapter should be scoped?
- Which areas of the site are in bounds for review and export?
- Does the buyer need package access, hosted review, recapture, or a custom private-site workflow?
