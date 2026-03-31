# Tools

## Primary Sources
- Firestore `waitlistSubmissions` and `inboundRequests`
  Use these as the only source for classification and missing-data detection.
- `ops/paperclip/FIRESTORE_SCHEMA.md`
  Use it to avoid writing to the wrong fields or inventing state.
- `ops/paperclip/HANDOFF_PROTOCOL.md`
  Use it when handing capture-needing work to `field-ops-agent` or escalating to `ops-lead`.
- Notion Work Queue
  Use it to keep humans and adjacent agents aligned on next step and confidence.

## Trust Model
- the submission record is more trustworthy than memory or pattern-matching
- classification scores are advisory unless policy says otherwise
- message drafts are not approvals

## Use Carefully
- draft emails and follow-up language
  Keep them specific, truthful, and clearly non-final.
- market-device fit assumptions
  Use only when backed by current Blueprint constraints.

## Do Not Use Casually
- outbound send tools
- any field or tag that implies approval, rejection, budget certainty, site permission, or legal clearance
