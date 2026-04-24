# Security Procurement Buyer Questionnaire Response

**Date:** 2026-04-24  
**Response Based On:** Blueprint Security and Procurement Current Posture (2026-04-23)  
**Questionnaire Type:** Generic Security & Procurement Due Diligence  

## Questionnaire Responses

### 1. Access Control & Authentication
**Q:** Describe access controls and authentication mechanisms  
**A:** Hosted sessions require authenticated Firebase users. Non-admin access is limited to users with `buyerType === "robot_team"` in Firestore profiles. Admin users bypass this gate. Presentation demo UI uses signed short-lived tokens and HTTP-only cookies scoped to session paths.

**Source:** `/server/routes/site-world-sessions.ts`, `/server/utils/hosted-session-ui-auth.ts`

### 2. Data Protection & Encryption
**Q:** How is sensitive data protected and encrypted?  
**A:** Inbound request storage encrypts contact and request fields before Firestore writes using AES-256-GCM with wrapped data keys. Supports either `FIELD_ENCRYPTION_MASTER_KEY` or `FIELD_ENCRYPTION_KMS_KEY_NAME`.

**Source:** `/server/utils/field-encryption.ts`

### 3. Data Retention & Privacy
**Q:** What are data retention policies?  
**A:** Explicit collection-level retention windows documented for waitlist, inbound requests, contact requests, capture jobs, creator captures, and creator payouts. Policy instructs agents to avoid pasting raw PII into broad logs.

**Source:** `/ops/paperclip/DATA_RETENTION_POLICY.md`

### 4. System Monitoring & Health
**Q:** How is system health monitored?  
**A:** `health/ready` endpoint fails closed when launch-critical dependencies are missing. Readiness checks include Firebase Admin, field encryption, Redis, Stripe, email, pipeline sync, and automation prerequisites.

**Source:** `/server/utils/launch-readiness.ts`, `/server/routes/health.ts`

### 5. Runtime Architecture
**Q:** Describe deployment and runtime architecture  
**A:** Single build pipeline with launch preflight. Hosted session live state uses Redis (when configured) with fallback to in-memory storage. Session records mirrored to Firestore.

**Source:** `/server/utils/launch-readiness.ts`

## Unsupported Questions

The following categories cannot be answered with current repo evidence:

- **Certifications & Audit Attestations** - No certifications or audit results documented
- **Penetration Testing** - No pen-test results available
- **Incident Response** - No public incident-response policy documented  
- **Vendor/Subprocessor Security** - No vendor or subprocessor packets available
- **Legal/Privacy Interpretations** - No formal legal or privacy commitments documented
- **MFA/SSO Policies** - No explicit MFA/SSO policy documentation
- **DPAs/Contract Addendums** - No buyer-facing DPAs or contract security addendums

## Request for Additional Evidence

To provide complete procurement responses, the following evidence is needed:
- Founder/legal confirmation for contractual commitments
- Rights-provenance clearance for scope-sensitive use cases  
- Explicit incident response and vendor security documentation
- Any third-party assurance artifacts for reference

## Response Guidelines

1. **Supported answers** cite specific code or policy sources from repo evidence
2. **Unsupported items** are acknowledged as missing evidence
3. **Legal/rights questions** are escalated to human owners
4. **Claims are limited** to what the repository explicitly documents

---

*This response is grounded solely in repository evidence and does not claim controls, certifications, or compliance beyond what is explicitly documented.*