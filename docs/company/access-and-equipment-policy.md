# Access And Equipment Policy

Status: Draft, requires counsel/PEO/security review.
Owner: Security Procurement Agent with `blueprint-cto` and hiring manager.
Scope: Company account access, hardware, software, AI tooling, repos, production systems, and offboarding access removal.
Review cadence: Monthly access review for restricted systems; quarterly policy review.

## Purpose

Access should be fast enough for new hires and agents to work, but narrow enough that a single mistake cannot damage capture truth, rights/privacy data, live buyer workflows, payment systems, or production runtime state.

## Access Principles

- Least privilege by role.
- Manager-sponsored requests.
- Paperclip records execution ownership.
- Notion records workspace visibility, not execution truth.
- Production, payment, payroll, legal, and security access require explicit approval.
- Access must be removed promptly at offboarding.

## Standard Access Groups

### Human New Hire

Initial access may include:

- company email and calendar;
- Slack or approved chat;
- Notion workspace;
- GitHub repo access matching role;
- local development setup;
- Paperclip visibility if their role owns or reviews execution;
- approved design/support/vendor systems needed for the role.

### Engineering

Additional access may include:

- repo write access;
- local env setup;
- Render/Firebase/Firestore/Stripe read or write access only when required;
- error tracking and runtime logs;
- Paperclip issue and run access.

### Ops/Growth

Additional access may include:

- Work Queue and Knowledge editing;
- governed outreach/CRM/send-provider access;
- analytics read access;
- buyer/support surfaces.

### AI Agents

AI agents receive only the repo, tool, and Notion/Paperclip capabilities needed for their lane. Broad workspace mutation and external sends require explicit policy and human gates.

## Equipment

Blueprint may issue company equipment or approve personal-device use. The equipment record must list:

- person;
- role;
- device type and serial/asset identifier;
- issue date;
- expected return condition;
- security controls in place;
- manager and security owner.

If company MDM, SSO, or device-management tooling is not yet configured, the security owner must document the compensating control in a restricted work item before granting restricted data access.

## Software And Tools

New tools require approval when they touch:

- source code or repositories;
- capture or customer data;
- employee data;
- payment, payroll, or tax data;
- production infrastructure;
- AI-agent execution;
- external sends or publishing.

Use `docs/company/vendor-and-procurement-policy.md` for review.

## Access Request Procedure

1. Manager defines the role need and data class.
2. Security owner confirms system, permission level, and approval requirement.
3. Request is recorded in the approved tracker or Paperclip issue.
4. Access is granted with MFA and least privilege.
5. New hire confirms they can sign in and understands source-of-truth boundaries.
6. Manager records completion in the onboarding checklist.

## Access Review

Restricted systems must be reviewed at least monthly:

- GitHub admin/write access;
- Render/Firebase/Firestore/Stripe;
- payroll/PEO and benefits systems;
- Notion databases with employee or sensitive operational data;
- Paperclip admin or mutation access;
- email/send-provider systems;
- production secrets and env stores.

## Offboarding Access Removal

Access removal follows `docs/company/offboarding-checklist.md`. High-risk access should be revoked before or at the separation meeting, depending on legal/HR guidance and risk.

## Evidence Paths

- Access request: Paperclip issue or restricted access tracker.
- Equipment record: HR/PEO/security-controlled tracker.
- Offboarding record: restricted Paperclip/HR evidence.
- Policy: `docs/company/access-and-equipment-policy.md`.
