# Blueprint Security and Procurement Current Posture

Date: 2026-04-23

This is a bootstrap summary for buyer security and procurement review. It is grounded in repo evidence only and does not claim certifications, pen tests, or legal/compliance posture that the repo does not explicitly document.

## Evidence Reviewed

- [Blueprint Deployment](/Users/nijelhunt_1/workspace/Blueprint-WebApp/DEPLOYMENT.md)
- [Platform Context](/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md)
- [World Model Strategy Context](/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md)
- [Data Retention & Privacy Policy](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/DATA_RETENTION_POLICY.md)
- [Firestore Schema Reference](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/FIRESTORE_SCHEMA.md)
- [Hosted session routes](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/site-world-sessions.ts)
- [Hosted session UI auth](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/hosted-session-ui-auth.ts)
- [Inbound request encryption](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/field-encryption.ts)
- [Inbound request route](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/inbound-request.ts)
- [Launch readiness checks](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/launch-readiness.ts)
- [Health routes](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/health.ts)
- [Rights provenance agent guidance](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/agents/rights-provenance-agent/Soul.md)
- [Security procurement agent guidance](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/agents/security-procurement-agent/AGENTS.md)

## Strongest Buyer-Security Answers

### Hosted session and access control

- Hosted sessions require authenticated Firebase users.
- Non-admin access is limited to users whose Firestore user profile has `buyerType === "robot_team"`.
- Admin users bypass that buyer-type gate.
- Public demo hosted sessions are restricted to explicitly allowlisted demo site-world IDs.
- Presentation demo UI access uses a signed, short-lived token and an HTTP-only cookie scoped to the session UI path.

### Data handling, retention, and encryption

- Inbound request storage encrypts contact and request fields before writing to Firestore.
- Encryption uses AES-256-GCM with a wrapped data key.
- The code supports either `FIELD_ENCRYPTION_MASTER_KEY` or `FIELD_ENCRYPTION_KMS_KEY_NAME`.
- The repo-retained policy documents explicit collection-level retention windows for waitlist, inbound requests, contact requests, capture jobs, creator captures, and creator payouts.
- The policy instructs agents not to paste raw PII into broad logs or issue comments unless operationally necessary.

### Deployment and runtime posture

- The repo documents a single build pipeline and a launch preflight.
- `health/ready` fails closed when launch-critical dependencies are missing.
- Readiness explicitly checks Firebase Admin, field encryption, Redis/live-session storage, Stripe, email, pipeline sync, and automation prerequisites.
- Hosted-session live state uses Redis when configured and falls back to in-memory storage when Redis is not configured.
- Hosted session records are mirrored to Firestore.

### Operational ownership

- Security/procurement responses are owned by the security-procurement-agent lane.
- Rights/provenance decisions remain with the rights-provenance-agent and human reviewer gate.
- The repo docs explicitly separate product security evidence from legal or policy commitments.

## Current Gaps

These are not claimed as present because the repo does not currently provide explicit evidence for them:

- certifications or audit attestations
- pen-test results
- formal legal/privacy interpretations
- a public incident-response policy
- a subprocessor or vendor security packet
- a buyer-facing DPA or contract security addendum
- explicit MFA/SSO policy documentation

## Buyer-Facing Response Shape

Use the following posture in DDQs and procurement threads:

1. state the current control from repo evidence
2. cite the specific runtime or policy source
3. note any missing artifact as a blocker or human-review item
4. avoid claiming maturity or compliance beyond what the repo shows

## Blocked Until More Evidence Exists

- Any request that depends on legal interpretation, rights scope, privacy commitments, certification status, or pen-test validation
- Any request that asks Blueprint to claim controls not explicitly documented in repo evidence

## Follow-Up Evidence Needed

- founder or legal owner confirmation for any contract, certification, or policy commitment
- rights-provenance clearance for scope-sensitive buyer use cases
- explicit incident-response and vendor/security packet material if buyers ask for it
- any third-party assurance artifact that should be referenced in procurement responses

## Note For Future Runs

If a buyer questionnaire is attached to a future issue, translate the questionnaire line-by-line into:

- supported answer
- unsupported / missing evidence
- owner to ask
- blocker severity

Do not widen the answer beyond the evidence in this repo.
