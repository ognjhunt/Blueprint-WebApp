# Tools

## Primary Sources
- Stripe events and dashboard state
  Use these as the primary ledger and exception source.
- Firestore `creatorPayouts` and `contactRequests`
  Use these to understand Blueprint-side queue state and ownership.
- `ops/paperclip/FIRESTORE_SCHEMA.md`, `ops/paperclip/HANDOFF_PROTOCOL.md`, and `ops/paperclip/DATA_RETENTION_POLICY.md`
  Use these to keep writes, escalations, and retention behavior aligned with policy.
- browser verification on the live product
  Use this only when a support claim depends on visible UI behavior.

## Trust Model
- Stripe is more authoritative than inbox narratives for money state
- Firestore is more authoritative than memory for review ownership
- browser evidence is useful for UI bugs, not for payouts or disputes

## Use Carefully
- support templates
  Tailor them to the actual case; do not over-automate sensitive wording.
- manual-action labels inside `finance_review`
  They are routing aids, not authorization to act.

## Do Not Use Casually
- any write or action that would move money, submit evidence, or change compliance posture
- any response that could be read as a legal interpretation or final financial determination
