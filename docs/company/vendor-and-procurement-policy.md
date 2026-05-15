# Vendor And Procurement Policy

Status: Draft, requires counsel/finance/security review before broad rollout.
Owner: Security Procurement Agent with Finance Support Agent and `blueprint-cto`.
Scope: Software, services, contractors, data providers, AI tools, hosting/provider systems, consultants, and equipment purchases.
Review cadence: Quarterly and before any vendor touches restricted data or production systems.

## Purpose

Blueprint should adopt tools that strengthen capture supply, site-specific world-model products, hosted access, buyer operations, and reliability without creating uncontrolled source-of-truth sprawl.

## Procurement Principles

- Use the existing stack by default: Vite/Express/TypeScript, Firebase/Firestore, Stripe, Render, Redis, Notion, Paperclip, approved AI provider paths.
- Do not introduce a new primary service without `blueprint-cto` approval and an architecture decision.
- Treat vendors as support layers, not product authority.
- Record purpose, owner, data class, cost, risk tier, and renewal date.
- Security and legal review scale with data sensitivity and operational impact.

## Risk Tiers

### Tier 0 - Low

No customer, employee, capture, payment, or production data. Short-lived reference use or public information only.

### Tier 1 - Internal

Internal docs, project management, or collaboration data. No restricted data and no production mutation.

### Tier 2 - Sensitive

Customer, buyer, capturer, site, employee, source code, private repo, operational metric, or non-public GTM data.

### Tier 3 - Restricted/Production

Secrets, payment/payroll, raw capture bundles, rights/privacy/consent data, production infrastructure, external sends, AI-agent execution, or legal records.

Tier 2 and Tier 3 require security owner review. Tier 3 also requires founder/CTO or counsel/finance review as appropriate.

## Required Review Questions

- What business problem does this solve?
- Why existing tools are insufficient?
- What data will the vendor access?
- Will it become source of truth for anything?
- Can data be exported and deleted?
- Does it support MFA, SSO if needed, audit logs, role-based access, and contract controls?
- Does it process AI prompts, customer data, capture data, employee data, or payment data?
- Who approves spend and renewal?
- What is the offboarding path?

## AI Vendors And Tools

AI tools require extra scrutiny when they receive non-public inputs or produce external-facing outputs.

Rules:

- no restricted data in unapproved tools;
- generated outputs are support artifacts, not proof;
- public claims require human review and source evidence;
- AI tools must not bypass Paperclip, Notion access rules, or human gates;
- model/backend choices must remain swappable unless `blueprint-cto` approves otherwise.

## Contract Requirements

Counsel/finance/security should review:

- data processing and confidentiality terms;
- IP ownership and output rights;
- security commitments;
- breach notice terms;
- subprocessor lists where relevant;
- payment and renewal terms;
- termination and data return/deletion;
- service-level or support commitments if operationally critical.

## Approval Matrix

- Low-cost, Tier 0: manager approval.
- Tier 1: manager plus finance owner if recurring spend.
- Tier 2: manager, finance owner, security owner.
- Tier 3: founder/CEO or CTO, security owner, finance owner, and counsel where legal/privacy/payment/payroll risk exists.
- New primary service: `blueprint-cto` explicit approval and repo architecture decision.

## Evidence Paths

- Procurement request: Paperclip issue or approved vendor tracker.
- Security review: Security Procurement Agent record.
- Contract: counsel/finance-controlled system.
- Notion: workspace visibility only.
- Repo architecture decision: docs/architecture or approved doctrine file when required.
