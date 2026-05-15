# Blueprint Employee Handbook

Status: Draft, requires counsel/PEO review before use as a binding employee handbook.
Owner: Founder/CEO with `blueprint-cto`, Ops Lead, and Security Procurement Agent support.
Effective stage: Series-A readiness draft.
Last source refresh: 2026-05-14.
Review cadence: Quarterly, and before the first hire in any new state or country.

## Purpose

This handbook gives Blueprint humans and managers one operating baseline for how work gets done, how people are treated, and where company truth lives.

Blueprint is a capture-first, world-model-product-first company. We build the system that turns real-site capture evidence into site-specific world-model products, hosted access, licensing, and buyer/ops workflows. This handbook must not be used to rewrite product doctrine, promise legal terms that have not been reviewed, or treat Notion as the execution record.

## Source Of Truth

- Repo doctrine: `PLATFORM_CONTEXT.md`, `WORLD_MODEL_STRATEGY_CONTEXT.md`, `AUTONOMOUS_ORG.md`, `DEPLOYMENT.md`, and `AGENTS.md`.
- Employee policy drafts: `docs/company/`.
- Onboarding journeys: `docs/onboarding/`.
- Execution state, blockers, delegated ownership, and closure evidence: Paperclip.
- Human workspace, review, and visibility surface: Notion.
- Payroll, benefits, tax, and legal terms: the signed offer, PEO/payroll records, plan documents, and counsel-reviewed agreements.

When sources conflict, signed legal documents and applicable law govern employment terms. Repo doctrine governs Blueprint product meaning and system boundaries. Paperclip governs execution state.

## Operating System Navigation

Use the onboarding packet as the entrypoint before treating any policy or Notion page as complete:

- `docs/onboarding/human-new-hire-start-here.md`: first day, first week, systems, and first-task pattern.
- `docs/onboarding/manager-onboarding-checklist.md`: pre-start, day-one, week-one, and 30/60/90 manager actions.
- `docs/onboarding/role-scorecards-and-30-60-90.md`: role mission, outcomes, metrics, human gates, and evidence expectations.
- `docs/onboarding/ai-agent-onboarding-runbook.md`: agent read order, command safety, Notion rules, Paperclip rules, and evidence closeout.
- `docs/onboarding/notion-information-architecture.md`: Notion page hierarchy and review-surface rules.

Notion should mirror these paths for readability. It should not replace repo policy drafts, Paperclip execution truth, or counsel/PEO-approved employment systems.

## Scope

This draft applies to Blueprint employees, founders, interns, and managers. Contractors, advisors, vendors, and AI agents are covered only where a written agreement, policy, or assignment says so.

Nothing in this draft creates a contract for continued employment, a guaranteed benefit, or a commitment to hire. Employment classification, final pay, leave, restrictive covenants, equity, benefits, and location-specific rules require counsel/PEO review.

## Definitions

- Blueprint: the company and product system spanning `BlueprintCapture`, `BlueprintCapturePipeline`, `Blueprint-WebApp`, optional validation work, and the Paperclip autonomous-org control plane.
- Capture truth: raw capture bundles, timestamps, poses, device metadata, rights/privacy/consent metadata, and provenance.
- Site-specific world model package: a downstream product package produced from real capture evidence and surfaced to buyers through WebApp.
- Hosted access: an entitlement- and runtime-backed session for a buyer or operator to review or use a site-world/world-model package.
- Paperclip: Blueprint's execution and ownership record for issues, routines, runs, blockers, and closeouts.
- Notion: the workspace/review/visibility surface for humans and agents.
- Company systems: repo, Paperclip, Notion, Firebase/Firestore, Stripe, Render, Redis, GitHub, Slack, Gmail/SendGrid, and approved provider consoles.

## Employment Principles

Blueprint expects:

- truthful product language around capture, rights, privacy, provenance, and hosted sessions;
- respectful behavior in all work channels;
- secure handling of customer, capture, employee, and company information;
- evidence-backed decisions rather than invented status;
- clear escalation when work is blocked by legal, HR, finance, security, rights/privacy, or founder authority.

## Equal Opportunity And Anti-Harassment

Blueprint intends to provide equal employment opportunity and a workplace free from unlawful discrimination, harassment, and retaliation. Employees and managers must report concerns through the manager, founder, Ops Lead, or the designated HR/PEO channel once configured.

Managers must take reports seriously, preserve evidence, avoid retaliation, and escalate to counsel/PEO when the report involves protected-class harassment, threats, retaliation, wage/hour concerns, accommodation requests, or safety concerns.

Detailed conduct rules live in `docs/company/code-of-conduct.md`.

## Work Model

Blueprint is remote-first unless a role or project requires field capture, site review, travel, or in-person buyer/vendor work. Remote work must follow `docs/company/remote-work-policy.md`, including secure workspace expectations, timezone coordination, documentation hygiene, and incident reporting.

Employees are expected to:

- keep their calendar and manager informed about availability;
- use company-approved systems for company work;
- avoid storing company secrets in personal notes or unmanaged tools;
- document decisions and evidence in the right source of truth;
- escalate when a live system, customer claim, legal question, or security issue is beyond their authority.

## Confidentiality, IP, And Inventions

Blueprint's product depends on proprietary capture workflows, buyer data, site information, package artifacts, agent instructions, and operational know-how. Employees must protect confidential information and must not reuse it outside Blueprint without written authorization.

The draft confidentiality and IP assignment packet is in `docs/company/confidentiality-and-ip-template.md`. It is not a signed agreement and requires counsel review before use.

## Security And Acceptable Use

Employees must follow `docs/company/security-and-acceptable-use-policy.md` and `docs/company/access-and-equipment-policy.md`.

Minimum expectations:

- use unique passwords and MFA where available;
- keep secrets out of chat, screenshots, docs, and repo files;
- report suspected account compromise, data exposure, lost devices, or unauthorized access immediately;
- do not scrape Notion or private services with unsupported credentials;
- do not invent capture, buyer, rights, payment, or live-readiness proof.

## Payroll, Benefits, PTO, And Time Off

Payroll, benefits, PTO, final pay, tax withholding, and state-specific leave requirements must be administered through approved payroll/PEO/counsel-reviewed processes. The draft guide is `docs/company/pto-benefits-payroll-guide.md`.

Until counsel/PEO confirms the operating model, managers must avoid promising a specific benefit, leave entitlement, payroll cadence, equity term, or reimbursement rule that is not in a signed offer, plan document, or approved written policy.

## Expenses, Travel, Vendors, And Procurement

Expenses and travel follow `docs/company/expense-and-travel-policy.md`.

Vendor and procurement decisions follow `docs/company/vendor-and-procurement-policy.md`. Any vendor touching capture data, customer data, employee data, payment data, production infrastructure, or AI-agent execution requires security review before use.

## Performance And Feedback

Managers are accountable for role clarity, weekly feedback during ramp, 30/60/90 outcomes, and evidence-backed reviews. Role plans live in `docs/onboarding/role-scorecards-and-30-60-90.md`.

Performance feedback should connect to:

- role scorecard outcomes;
- quality and reliability of evidence;
- speed and judgment on blockers;
- respect for source-of-truth boundaries;
- product doctrine adherence.

## Complaints, Concerns, And Escalation

Employees may raise concerns to their manager, the founder, Ops Lead, Security Procurement Agent, or the HR/PEO channel once configured. Serious issues must be escalated immediately:

- harassment, discrimination, retaliation, or threats;
- wage, payroll, benefits, leave, or classification concerns;
- security incident or privacy exposure;
- suspected legal, finance, rights, or customer-misrepresentation risk;
- any request to fabricate evidence or overstate product readiness.

The incident path is in `docs/company/incident-response-and-escalation.md`.

## Acknowledgment

Before this becomes an employee-facing handbook, counsel/PEO must review it and provide an acknowledgment form. The acknowledgment should confirm that the employee received the handbook, understands the source-of-truth boundaries, and knows how to report concerns.

## External Source Notes

This draft is informed by current public guidance from:

- USCIS Form I-9: https://www.uscis.gov/i-9
- IRS Form W-4: https://www.irs.gov/forms-pubs/about-form-w-4
- ACF/OCSE new-hire reporting: https://acf.gov/css/employers/employer-responsibilities/new-hire-reporting
- U.S. Department of Labor workplace posters: https://www.dol.gov/general/topics/posters/
- EEOC harassment guidance: https://www.eeoc.gov/harassment
- FTC Cybersecurity for Small Business: https://www.ftc.gov/business-guidance/small-businesses/cybersecurity
- NIST IR 7621 Rev. 1: https://csrc.nist.gov/pubs/ir/7621/r1/final
- SHRM onboarding process guidance: https://www.shrm.org/topics-tools/topics/onboarding/process

It is not legal advice.
