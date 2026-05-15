# Security And Acceptable Use Policy

Status: Draft, requires counsel/security review before employee rollout.
Owner: Security Procurement Agent with `blueprint-cto`.
Scope: Employees, contractors, advisors, AI-agent operators, and vendors with Blueprint system access.
Review cadence: Quarterly, after any security incident, and before adding a new primary system.

## Purpose

Blueprint handles source code, customer and buyer context, capture/provenance data, rights/privacy metadata, hosted-session artifacts, finance flows, and autonomous-agent execution records. This policy defines minimum security behavior and acceptable use.

## Data Classes

- Public: approved public website content, published docs, approved marketing copy.
- Internal: repo docs, operating plans, Notion pages, Paperclip issues, routine reports.
- Confidential: source code, non-public strategy, buyer/capturer/site data, pricing, GTM targets, vendor details, agent instructions.
- Restricted: secrets, credentials, payment data, employee records, legal records, raw capture bundles, rights/privacy/consent data, security incident details, production admin access.

Restricted data must stay in approved systems with least-privilege access and must not be copied into unmanaged tools.

## Account Security

All company accounts must use:

- unique passwords;
- MFA where available;
- company-approved email identity;
- least-privilege permissions;
- immediate access review when a role changes or a person offboards.

Shared accounts are disallowed unless a vendor system has no viable alternative and the exception is documented with owner, purpose, access list, and rotation process.

## Secrets

Secrets include API keys, tokens, OAuth credentials, service account JSON, webhook secrets, database URLs, session cookies, recovery codes, and private keys.

Rules:

- never commit secrets to a repo;
- never paste secrets into Notion, Slack, email, screenshots, or Paperclip comments;
- use approved environment stores and encrypted secret flows;
- rotate suspected exposed secrets immediately;
- redact command output before sharing externally.

## Devices And Network

Company work must happen on secured devices with operating-system updates, disk encryption where available, screen lock, and trusted network practices. Public Wi-Fi should use secure transport and should not be used for high-risk admin work unless a secure network path is approved.

Lost or stolen devices must be reported immediately.

## Acceptable Use

Company systems may be used only for legitimate Blueprint work. Users must not:

- access data outside their role;
- test live sends, payments, production writes, or provider actions without authorization;
- bypass auth, CSRF, approval, or human-gate controls;
- scrape Notion HTML or private APIs with browser cookies;
- store capture, customer, employee, or rights data in unapproved tools;
- use AI tools in ways that expose restricted data or create unsupported product claims.

## AI Tooling

AI tools are support layers. They do not override repo doctrine, Paperclip execution state, Notion access rules, or source-of-truth maps.

Before using an AI tool with company information, confirm:

- the data class is allowed for the tool;
- the output will be reviewed before external use;
- generated outputs will not be treated as capture proof, legal review, buyer traction, or live-system proof;
- any code change follows repo verification rules.

## Capture, Rights, And Provenance

Capture truth and rights/privacy metadata are product-critical. Users must not:

- alter raw capture evidence to make a package appear more ready;
- infer rights clearance from public availability alone;
- publish, share, or sell a package without the required rights/privacy/provenance state;
- represent generated outputs as real capture.

## Incident Reporting

Report immediately if you suspect:

- account compromise;
- lost/stolen device;
- secret exposure;
- unauthorized access;
- privacy or customer data exposure;
- payment or payroll issue;
- production admin misuse;
- AI tool data leak.

Use `docs/company/incident-response-and-escalation.md`.

## Evidence Paths

- Access inventory: approved access tracker or restricted Notion/Paperclip surface.
- Secrets: approved env/secret stores only.
- Incidents: restricted incident record and Paperclip blocker with limited detail.
- Vendor security: `docs/company/vendor-and-procurement-policy.md`.

## External Source Notes

This draft is informed by:

- FTC Cybersecurity for Small Business: https://www.ftc.gov/business-guidance/small-businesses/cybersecurity
- FTC Safeguards Rule overview: https://www.ftc.gov/business-guidance/resources/ftc-safeguards-rule-what-your-business-needs-know
- NIST IR 7621 Rev. 1: https://csrc.nist.gov/pubs/ir/7621/r1/final

Applicability depends on Blueprint's actual data, customers, and regulatory posture.
