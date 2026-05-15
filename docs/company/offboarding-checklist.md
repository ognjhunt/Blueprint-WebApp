# Offboarding Checklist

Status: Draft, requires counsel/PEO/security review before employee use.
Owner: Manager with HR/PEO, Security Procurement Agent, and Finance Support Agent.
Scope: Employee, contractor, advisor, vendor, and AI-agent access offboarding.
Review cadence: After every offboarding event and quarterly.

## Purpose

Offboarding must protect people, company data, capture/provenance truth, source code, buyer relationships, and operational continuity.

## Trigger Events

- Resignation.
- Termination.
- Contract end.
- Role transfer.
- Vendor termination.
- Access reduction.
- AI-agent pause, decommission, or lane transfer.

## Immediate Risk Assessment

Before the separation time, manager/security owner should determine:

- whether access should be removed before notice;
- whether legal hold applies;
- whether the person has restricted data, production access, payment/payroll access, or customer/capture data;
- whether the separation touches harassment, retaliation, wage/hour, security, or legal concerns;
- whether customer, buyer, site, or vendor handoff is required.

Sensitive people details belong in HR/PEO/counsel systems, not public Notion pages.

## Access Removal

Revoke or transfer:

- company email/calendar;
- Slack/chat;
- Notion;
- GitHub and repo access;
- local dev credentials;
- Render/Firebase/Firestore/Stripe/Redis/provider consoles;
- Paperclip user/admin permissions;
- Gmail/SendGrid/outbound tooling;
- payroll/benefits admin access;
- vendor systems;
- device management and recovery access;
- shared documents and drives.

Rotate secrets when the person had access to shared credentials or unmanaged tokens.

## Equipment And Data Return

Collect:

- laptop and accessories;
- phones/tablets if issued;
- capture devices or field equipment;
- keys, badges, or access codes;
- company files on personal drives or devices;
- physical notes containing restricted data.

The person must return or delete company data as directed by HR/PEO/counsel and preserve anything subject to legal hold.

## Knowledge Transfer

Manager records:

- active projects and owners;
- open Paperclip issues;
- buyer/site/vendor commitments;
- credentials or systems that need transfer;
- docs and repos owned;
- recurring routines or dashboards owned;
- deadlines and risks.

Execution state stays in Paperclip. Notion may mirror the handoff for visibility.

## Payroll, Benefits, And Final Pay

HR/PEO/payroll/counsel must handle:

- final pay timing and method;
- expense reimbursement;
- benefits continuation or termination;
- equity or option administration;
- unemployment and separation notices;
- PTO or leave treatment;
- contractor final invoice.

Rules vary by state and role type.

## AI-Agent Offboarding

For an AI agent:

- pause or disable routines;
- remove or narrow tools;
- record replacement owner;
- preserve run artifacts;
- close or reassign open issues;
- update Blueprint Agents and Agent Runs if Notion is used as the visibility surface;
- keep Paperclip as the execution record.

## Evidence Paths

- HR/separation file: HR/PEO/counsel-controlled system.
- Access removal: restricted tracker or Paperclip issue.
- Handoff: Paperclip issues and repo docs.
- Notion mirror: onboarding/ops surface without sensitive personal details.

## Closeout

The manager and security owner should confirm all required access and equipment steps are complete, with exceptions explicitly owned and dated.
