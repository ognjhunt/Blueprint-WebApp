# Security Procurement Active Review Blockers

Date: 2026-04-23

Owner: `security-procurement-agent`

## Purpose

This is the compact reply-ready companion to [Blueprint Security and Procurement Current Posture](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/reports/security-procurement-current-posture-2026-04-23.md).

Use it when a buyer thread needs a short answer about what Blueprint can state today and what still blocks a stronger procurement response.

## What The Repo Currently Supports

- Hosted sessions require authenticated Firebase users and limit non-admin access to `buyerType === "robot_team"` in [site-world-sessions.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/site-world-sessions.ts).
- Hosted session UI access uses a signed short-lived token and cookie in [hosted-session-ui-auth.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/hosted-session-ui-auth.ts).
- Inbound request storage encrypts contact and request fields before Firestore write in [field-encryption.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/field-encryption.ts).
- Launch readiness explicitly gates Firebase Admin, field encryption, Redis, Stripe, email, pipeline sync, and automation prerequisites in [launch-readiness.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/launch-readiness.ts).
- `health/ready` returns `503` when readiness is not met in [health.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/health.ts).
- Retention windows for waitlist, inbound requests, contact requests, capture jobs, creator captures, and creator payouts are documented in [DATA_RETENTION_POLICY.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/DATA_RETENTION_POLICY.md).

## Reply-Ready Answers

- Yes, hosted session access is gated.
- Yes, inbound request fields are encrypted before storage.
- Yes, the repo documents explicit retention windows.
- Yes, readiness fails closed when launch-critical dependencies are missing.

## Still Missing

These items are not explicitly documented as present, so they must stay out of buyer-facing claims:

- certifications or audit attestations
- pen-test results
- a public incident-response policy
- a subprocessor or vendor security packet
- a buyer-facing DPA or contract security addendum
- explicit MFA/SSO policy documentation
- formal legal, privacy, or rights interpretation

## Blockers By Owner

- `founder`: contract, certification, legal, and policy commitments
- `rights-provenance-agent`: rights, consent, privacy, and commercialization boundaries
- `solutions-engineering-agent`: runtime or deployment behavior questions that need deeper technical verification
- `webapp-codex` or `webapp-review`: product gaps in auth, hosted sessions, or access-control implementation

## Buyer-Facing Wording

Use this shape in procurement threads:

1. State the current control from repo evidence.
2. Cite the specific code or policy source.
3. Name the missing artifact if the buyer asks for it.
4. Route legal, rights, or certification questions to a human owner.

## Next Action

- Reuse this blocker note as the short summary for any active security or procurement review that only needs a current-posture answer.
- Escalate any request that depends on legal interpretation, certification, or a vendor packet into the appropriate human-owner lane instead of padding the answer.
