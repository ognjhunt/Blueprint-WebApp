# Security Procurement Evidence Factory

Status: draft-only operating design. Do not send externally without review.
Last repo evidence scan: 2026-05-31.
Owner: `security-procurement-agent`, with `blueprint-cto`, `solutions-engineering-agent`, `rights-provenance-agent`, and founder/legal review gates where required.

This factory turns buyer DDQs, security questionnaires, architecture reviews, and procurement checklists into draft packets grounded in Blueprint evidence. It is not a SOC 2 report, ISO 27001 statement, DPA, privacy assessment, legal opinion, penetration-test report, or live production proof.

The companion reusable evidence map is `ops/paperclip/playbooks/buyer-security-procurement-evidence-packet.md`.

## Hard Boundaries

- Drafts are repo-local artifacts until a human owner approves release.
- Source citations must stay attached to every supported answer.
- Missing evidence stays visible as `missing_evidence`, `not_supported`, or `human_legal_gate`.
- Repo docs and code can prove authored posture and code behavior. They do not prove current live production configuration.
- No Notion writes, external sends, production reads/writes, Render/Firebase/Stripe/Paperclip mutation, provider calls, legal commitments, certification claims, rights clearance, or hosted-session fulfillment claims are authorized by this factory.

## Factory Flow

1. **Bind the request**: record buyer, request id, questionnaire source, due date, and owner thread.
2. **Normalize questions**: split compound questions into one answer row per claim.
3. **Classify each row**: choose one domain from `auth_access`, `hosted_session`, `data_handling`, `encryption`, `retention`, `deployment_runtime`, `incident_response`, `vendor_procurement`, `rights_provenance`, `legal_contract`, `certification_assurance`, or `operational_live_state`.
4. **Attach sources**: link every supported row to source ledger entries.
5. **Run deterministic checks**: block unsupported commitments before the response reaches a reviewer.
6. **Draft narrowly**: answer only what current evidence supports, with explicit limits.
7. **Route gates**: assign human/legal/CTO/rights follow-up for rows that need owner judgment.
8. **Emit packet**: produce a draft packet outline plus blocker summary. External release remains out of scope.

## Questionnaire Response Schema

Use this schema shape for draft packet JSON or a table with equivalent fields:

```json
{
  "schemaVersion": "securityProcurementQuestionnaireResponse.v0.1",
  "draftOnly": true,
  "externalSendAuthorized": false,
  "request": {
    "requestId": "sp-ddq-YYYYMMDD-slug",
    "buyerName": "optional",
    "sourceArtifact": "path or issue id",
    "ownerAgent": "security-procurement-agent",
    "preparedAt": "YYYY-MM-DD",
    "preparedBy": "agent or human",
    "reviewState": "draft | blocked | awaiting_human_review | approved_for_human_reply"
  },
  "sourceLedger": [
    {
      "sourceId": "src-001",
      "sourceType": "repo_doc | code | test | config | generated_report | owner_artifact | live_system_proof | legal_artifact",
      "path": "relative/or/absolute/source",
      "lineRange": "start-end when available",
      "ownerSystem": "repo | Paperclip | Firestore | Render | Stripe | Redis | Capture | Pipeline | counsel | founder",
      "currentAsOf": "YYYY-MM-DD",
      "evidenceClass": "doctrine | code_behavior | test_evidence | deployment_requirement | runtime_state | rights_provenance | legal_review | support_context",
      "proves": ["specific supported facts"],
      "doesNotProve": ["specific facts this source must not be used to claim"],
      "verificationCommand": "local command if used, or none",
      "status": "accepted | stale | missing | human_gated"
    }
  ],
  "answers": [
    {
      "questionId": "q-001",
      "originalQuestion": "buyer text",
      "domain": "auth_access",
      "requestedCommitmentType": "control_description | legal_commitment | certification | live_operational_claim | rights_claim",
      "answerStatus": "supported | supported_with_limits | missing_evidence | not_supported | human_legal_gate",
      "draftAnswer": "narrow answer text",
      "sourceRefs": ["src-001"],
      "allowedClaims": ["exact claims allowed by cited sources"],
      "blockedClaims": ["claims that must not appear in the draft"],
      "humanGates": [
        {
          "gateType": "legal | cto_security | rights_provenance | founder | solutions_engineering | commercial_owner",
          "owner": "named role",
          "reason": "why this cannot be answered from current evidence"
        }
      ],
      "deterministicChecks": {
        "sourceRefsValid": true,
        "supportedAnswerHasSource": true,
        "noBlockedCommitments": true,
        "liveClaimHasOwnerProof": false,
        "humanGateRequired": false
      }
    }
  ],
  "packet": {
    "packetType": "standard_ddq | architecture_review | procurement_blocker | rights_sensitive_review | missing_evidence_escalation",
    "summary": "internal draft summary",
    "blockers": ["unresolved blockers"],
    "nextOwners": ["role list"],
    "externalRelease": "not_authorized"
  }
}
```

## Source Ledger Rules

| Source class | Can support | Cannot support |
|---|---|---|
| Repo doctrine and policy drafts | Product posture, source-of-truth boundaries, draft policy intent, public-claim limits | Legal enforceability, buyer-specific terms, current live production state |
| Code and tests | Auth checks, access gates, encryption behavior, route behavior, deterministic validations | Deployed configuration, uptime, customer outcome, external audit maturity |
| Deployment docs and `render.yaml` | Intended runtime topology, required env vars, health-check path, secret-location expectations | Current Render dashboard state, live secret presence, incident history |
| Paperclip playbooks and reports | Agent ownership, draft packet shape, internal blocker routing, prior repo-local posture scans | Legal approval, external release approval, live buyer facts |
| Firestore/Stripe/Render/Redis/provider exports | Operational state for the exact record and timestamp supplied | Any broader guarantee outside the exported scope |
| Capture/Pipeline rights and provenance artifacts | Request-specific capture, rights, privacy, provenance, package, or hosted artifact facts | General rights clearance for all captures or unrestricted commercial use |
| Counsel/founder artifacts | Legal, DPA, contract, certification, public-use, or commitment approval when explicitly supplied | Technical runtime behavior unless paired with owner-system evidence |

Every ledger entry must include `proves` and `doesNotProve`. If a source is useful but stale, mark it `stale` and keep any answer status at `missing_evidence` or `human_legal_gate`.

## Allowed Commitments

These are allowed only when the cited ledger source supports the exact wording:

| Area | Allowed draft posture |
|---|---|
| Product posture | Blueprint is capture-first and world-model-product-first, with hosted access and request-specific proof around site-specific world-model packages. |
| Auth/access | WebApp protected APIs use Firebase-authenticated bearer-token paths where the cited route/middleware shows that behavior. |
| Admin/ops access | Admin and ops checks can be described when grounded in role-check code and Firestore/token-claim behavior. |
| Hosted session | Hosted-session access is request/session scoped and must be confirmed per site/request when entitlement/runtime proof is required. |
| Encryption | Inbound request fields are encrypted before Firestore persistence where the cited code and tests cover those fields. |
| Retention | Repo-side retention windows exist, and Phase 1 deletion requires human-reviewed deletion unless newer owner proof says otherwise. |
| Deployment | The repo documents a Render Node service path with `/health/ready`; live configuration proof must come from Render or the owner system. |
| Rights/provenance | Rights, privacy, consent, and provenance are explicit request-specific evidence classes, not inferred from listing existence. |
| Missing control | `Not currently evidenced in repo material reviewed` is an allowed answer when a control or proof artifact is absent. |

## Blocked Commitments

Block these unless a current owner artifact and required human gate are attached:

- SOC 2, ISO 27001, HIPAA, GDPR, CCPA, or other certification/compliance claims.
- Completed penetration test, vulnerability-management program maturity, or external audit attestation.
- Signed DPA, MSA, SLA, insurance, indemnity, breach-notice, or contract security terms.
- Enterprise SSO, SAML, SCIM, MDM, audit-log, or admin-control support that code/docs do not evidence.
- Current production secret configuration, uptime, incident history, or live Render/Firebase/Stripe/Redis state from repo docs alone.
- Automatic deletion completion, subject access fulfillment, or privacy-law interpretation.
- All captures rights-cleared, unrestricted commercial use, or buyer-specific clearance without exact rights/provenance evidence.
- Guaranteed hosted-session availability, package access open, provider execution complete, payment success, payout success, customer proof, or deployment readiness without owning-system proof.
- Roadmap promises framed as current controls.

## Deterministic Claim Checks

Run these checks manually or in a future local validator before any packet leaves draft state:

| Check id | Rule | Failure status |
|---|---|---|
| `draft_only` | `draftOnly` must be `true` and `externalSendAuthorized` must be `false`. | `blocked` |
| `source_ref_integrity` | Every `sourceRefs[]` item must exist in `sourceLedger[]`. | `blocked` |
| `supported_requires_source` | `supported` and `supported_with_limits` answers must include at least one accepted source ref. | `blocked` |
| `missing_not_smoothed` | `missing_evidence`, `not_supported`, and `human_legal_gate` rows must not contain reassuring control language that implies support. | `blocked` |
| `blocked_phrase_scan` | Draft answers must not contain blocked certification, legal, live-state, rights-clearance, payment, payout, provider-completion, customer-proof, or hosted-fulfillment commitments unless the row is explicitly gated and not approved for external use. | `blocked` |
| `source_class_scope` | Repo docs/code/tests cannot be used as proof for live production configuration, buyer-specific rights, legal commitments, or formal certifications. | `blocked` |
| `rights_boundary` | Questions touching capture use, derived use, privacy, consent, or commercialization require `rights_provenance` source proof or a rights gate. | `blocked` |
| `legal_boundary` | DPA, MSA, SLA, indemnity, breach notice, privacy-law, certification, and contract language require legal/founder gate. | `blocked` |
| `runtime_boundary` | Hosted-session fulfillment, package access, entitlement, provider execution, and live runtime state require exact owner-system proof. | `blocked` |
| `review_state` | `approved_for_human_reply` is allowed only when no answer row has unresolved `blocked` checks or required gates. | `blocked` |

Suggested blocked-phrase scan terms:

```text
SOC 2 certified
ISO 27001 certified
HIPAA compliant
GDPR compliant
CCPA compliant
penetration test completed
DPA signed
guaranteed uptime
all data is encrypted
all captures are rights-cleared
hosted session will be live
package access is open
provider execution is complete
payment has succeeded
payout has succeeded
production secrets are configured
```

The scan is a guardrail, not a substitute for review. It should prefer false positives over letting a commitment through.

## Human And Legal Review Gates

| Gate | Trigger | Owner |
|---|---|---|
| Legal/contract | DPA, MSA, SLA, indemnity, insurance, breach notice, privacy-law interpretation, subprocessor terms, data processing terms | founder/legal owner |
| CTO/security | Certification posture, pen-test claims, enterprise SSO/SCIM, production security posture, architecture commitments, vulnerability-management maturity | `blueprint-cto` |
| Rights/provenance | Consent, derived use, commercialization, exact-site release, rights clearance, privacy processing, capture provenance | `rights-provenance-agent` plus human reviewer when policy requires |
| Solutions engineering | Hosted-session runtime, export, integration, deployment, buyer stack, package artifact compatibility | `solutions-engineering-agent` |
| Commercial/procurement | Pricing, invoices, vendor onboarding, procurement deadlines, quote terms, non-standard support commitments | `buyer-solutions-agent` plus human commercial owner |
| Founder/public claims | Customer logos, testimonials, traction, public-use approval, company-level security commitments | founder/CEO |

## Example Packet Outlines

### Standard DDQ Draft

1. Request summary and draft-only warning.
2. Source ledger table.
3. Answer table with `questionId`, `answerStatus`, `draftAnswer`, `sourceRefs`, and `blockedClaims`.
4. Missing-evidence table by owner.
5. Human/legal gates.
6. Final statement: `External release is not authorized by this draft.`

### Architecture Review Packet

1. Product and data-flow summary.
2. Auth/access-control evidence.
3. Hosted-session boundary evidence.
4. Encryption and retention evidence.
5. Deployment/runtime topology evidence.
6. Explicit non-proofs: no certification, no pen-test, no live dashboard proof unless attached.
7. Engineering follow-ups.

### Procurement Blocker Packet

1. Buyer procurement ask.
2. Required commitment requested by buyer.
3. Current evidence status.
4. Why the current packet cannot answer it.
5. Required owner/gate.
6. Safe interim wording.
7. Blocker id for Paperclip or human reply tracking.

### Rights-Sensitive Review Packet

1. Exact site/request/use case.
2. Security question that touches rights, privacy, consent, or commercialization.
3. Current rights/provenance evidence attached.
4. What security-procurement can answer.
5. What rights-provenance must answer.
6. Blocked claims that must not appear in buyer-facing text.

### Missing Evidence Escalation

1. Claim buyer asked Blueprint to make.
2. Why existing evidence does not support it.
3. Source ledger entries reviewed.
4. Needed artifact or owner response.
5. Risk if unanswered.
6. Next step and deadline.

## Safe Local Closeout Checks

For docs-only updates to this factory, use only safe local checks from the command safety matrix:

```bash
scripts/paperclip/validate-agent-kits.sh
rg -n "Status: draft-only|externalSendAuthorized|Blocked Commitments|Deterministic Claim Checks|Human And Legal Review Gates" ops/paperclip/playbooks/security-procurement-evidence-factory.md
```

Do not run live Paperclip reconciliation, Notion sync, outbound sends, Render env import, production smoke, provider jobs, Stripe, Firebase live mutation, or human-reply polling for this factory.
