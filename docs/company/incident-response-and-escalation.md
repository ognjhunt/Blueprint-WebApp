# Incident Response And Escalation

Status: Draft, requires counsel/security review before operational use.
Owner: Security Procurement Agent with `blueprint-cto`, Ops Lead, and Founder/CEO.
Scope: Security, privacy, data, production, legal/HR, finance, and customer-impact incidents.
Review cadence: After every incident, quarterly tabletop, and before new regulated workflows.

## Purpose

Blueprint needs a plain incident path that protects people, data, customers, capture truth, rights/privacy, hosted-session access, and company systems without overstating readiness or hiding gaps.

## Incident Types

- Security: account compromise, secret exposure, unauthorized access, lost device, malware, suspicious login.
- Privacy/data: customer, capture, employee, buyer, site, rights, or consent information exposed or mishandled.
- Production: outage, deployment failure, data corruption, hosted-session failure, entitlement/payment error.
- AI/agent: unsafe tool use, fabricated proof, unauthorized send, runaway loop, source-of-truth violation.
- Legal/HR: harassment, discrimination, retaliation, wage/hour, safety, immigration, protected leave, or counsel-sensitive concern.
- Finance: payment, payroll, Stripe, reimbursement, fraud, or banking issue.

## Severity

### SEV-1

Active compromise, material data exposure, payment/payroll impact, legal/HR emergency, production outage affecting buyers, or public-facing false claim.

### SEV-2

Potential exposure, limited production impact, failed external send control, high-risk vendor issue, or repeated agent/runtime failure affecting operations.

### SEV-3

Contained issue, policy violation without confirmed exposure, non-critical outage, or documentation gap with clear owner.

## First 30 Minutes

1. Stop the harm if safe: revoke token, pause routine, disable send, isolate device, stop deployment, or restrict access.
2. Preserve evidence: timestamps, run ids, logs, affected systems, screenshots with secrets redacted, issue ids, commit ids.
3. Notify owner:
   - security/privacy: Security Procurement Agent and CTO;
   - production/code: CTO and owning engineering lane;
   - Paperclip/agent: Chief of Staff and owning agent;
   - legal/HR: founder plus counsel/PEO;
   - finance/payroll: Finance Support Agent and founder.
4. Create restricted incident record. Use Paperclip for operational ownership, but avoid exposing sensitive personal or secret details.
5. Decide severity and next owner.

## Containment

Actions may include:

- rotate secrets;
- revoke access;
- pause routines;
- disable vendor integration;
- block external send path;
- rollback deployment;
- isolate affected data;
- notify counsel/PEO;
- preserve legal hold material.

## Communication Rules

- Do not speculate externally.
- Do not claim legal review, breach status, customer notification, or root cause until counsel/owner confirms.
- Customer-facing communication must be approved by founder/CEO or delegated owner.
- Security details should be need-to-know.
- Notion can show status and next action, but sensitive facts belong in restricted records.

## Investigation

Capture:

- what happened;
- when it started and ended;
- systems affected;
- data classes affected;
- people/accounts involved;
- root cause or current hypothesis;
- containment actions;
- customer/legal/HR/finance implications;
- owner and deadline for fixes.

## Post-Incident Review

Within five business days for SEV-1/SEV-2:

- document timeline;
- identify root cause;
- record corrective actions;
- assign owners in Paperclip;
- update policy/runbook/tests;
- update Notion visibility if useful;
- review whether evidence belongs in repo, Paperclip, Notion, or restricted HR/security record.

## Evidence Paths

- Operational ownership: Paperclip issue.
- Code fix: GitHub/repo with tests.
- Sensitive records: counsel/HR/security-controlled system.
- Visibility: Notion incident summary with restricted detail removed.
- Policy: `docs/company/incident-response-and-escalation.md`.

## External Source Notes

This draft is informed by FTC incident/security-program guidance and NIST security practices:

- FTC Cybersecurity for Small Business: https://www.ftc.gov/business-guidance/small-businesses/cybersecurity
- FTC Safeguards Rule overview: https://www.ftc.gov/business-guidance/resources/ftc-safeguards-rule-what-your-business-needs-know
- NIST IR 7621 Rev. 1: https://csrc.nist.gov/pubs/ir/7621/r1/final

Legal notification duties depend on facts, data class, affected people, contracts, and jurisdictions.
