# Notion Information Architecture

Status: Active plan and audit record.
Owner: Notion Manager Agent with Founder/CEO and `blueprint-cto`.
Last live audit: 2026-05-15.
Review cadence: Monthly and after any major repo doctrine or onboarding change.

## Purpose

This document defines how Blueprint onboarding should appear in Notion while keeping repo/Paperclip as execution truth.

## Source-Of-Truth Contract

- Repo: canonical docs, policies, architecture, and implementation contracts.
- Paperclip: execution state, blockers, delegated ownership, closeouts, and run evidence.
- Notion: human-facing workspace, review, dashboards, onboarding journey, and visibility.
- Live systems: Firebase/Firestore, Stripe, Render, Redis, GitHub, payroll/PEO, and provider consoles own their respective operational facts.

## Live Pages Fetched

Fetched with the Notion connector on 2026-05-15:

- Blueprint Hub: `https://www.notion.so/16d80154161d80db869bcfba4fe70be3`
- Company Handbook & Onboarding: `https://www.notion.so/36080154161d81ab9f5ae762a9e7f0e5`
- Human New Hire: `https://www.notion.so/36080154161d8168a491e470d7e37e9e`
- AI Agent Onboarding: `https://www.notion.so/36080154161d818a9c0cd8eff1a37093`
- Company Policies: `https://www.notion.so/36080154161d8187b2a8e0f0482da757`
- Systems & Access: `https://www.notion.so/36080154161d81089471e8588f4a83e8`
- Source of Truth: `https://www.notion.so/36080154161d8160bcf9fe160ebc55d2`
- Role Scorecards: `https://www.notion.so/36080154161d8133ae92d10e78da0a51`
- Manager Checklist: `https://www.notion.so/36080154161d812a84c0d2a4823eb18d`
- Legal/Compliance Packet: `https://www.notion.so/36080154161d813dbc6ae0a57875de73`
- Security & Incident Response: `https://www.notion.so/36080154161d8126beeeec34d7e6d5d2`
- Operating Center: `https://www.notion.so/31f80154161d81e58a90dc553d85d4a2`
- Hiring: `https://www.notion.so/31f80154161d81d199fcdbeb9ac4b1b7`
- KPI Dashboard: `https://www.notion.so/31f80154161d8113a5c2e8ed412bd47f`
- Blueprint Knowledge database: `https://www.notion.so/7c729783c3774342bf005555b88a2ec6`
- Blueprint Work Queue database: `https://www.notion.so/f83b6c53a33a47909ca4786dddadad46`
- Blueprint Agents database: `https://www.notion.so/c6021156679642c5bef458d2eb12d6ab`
- Blueprint Skills database: `https://www.notion.so/4e37bd7ae4484f81aa3eb8860826e98c`
- Blueprint Agent Runs database: `https://www.notion.so/bce59b924cf6446d9e07e026c824563b`
- Security page: `https://www.notion.so/31f80154161d81eca8d1ef84b935276e`
- User Onboarding page: `https://www.notion.so/31f80154161d81ceb6c8f0ae23269f10`
- Security Procurement Agent page: `https://www.notion.so/33d80154161d812db05cc6194d512a1e`

## Current Findings

### Healthy Existing Structure

- Blueprint Hub already links the core command databases.
- Blueprint Hub now links Company Handbook & Onboarding as the first-class entrypoint for humans, managers, and AI agents.
- Company Handbook & Onboarding now has child pages for the human path, AI-agent path, manager checklist, role scorecards, source-of-truth rules, systems/access, company policies, legal/compliance, and security/incident response.
- Hiring now routes role work back into Company Handbook & Onboarding instead of standing alone as a thin hiring note.
- Operating Center correctly states that Paperclip is execution truth, repo/app data own product state, and Notion is review/visibility.
- KPI Dashboard marks missing live sources as `Source needed` instead of inventing values.
- Blueprint Agents, Skills, and Agent Runs databases exist with useful schema for status, runtime, tool access, and run proof.

### Remaining Watchpoints

- Security exists but is a short category page, not a security/acceptable-use or incident-response policy.
- User Onboarding exists but is product/user activation oriented, not employee onboarding.
- Older pages still contain qualification-first or scene-memory-era phrasing in search highlights; they should not become onboarding doctrine without refresh.
- Notion pages intentionally summarize repo docs; they are not legal, HR/payroll, benefits, IP, or execution authority.
- If a page body and database/run status disagree, check Paperclip and the database properties before trusting page prose.

### Duplicate Or Ambiguous Pages

- `User Onboarding` is not an employee onboarding replacement. Preserve it for product activation.
- `Security` is not a policy replacement. Preserve it as an infrastructure category unless the owner chooses to merge later.
- Multiple city launch system duplicates exist in search results, but they are unrelated to company onboarding. Do not move or archive them in this run.

## Target First-Screen Journey

Blueprint Hub should expose a clear path:

1. Company Handbook & Onboarding.
2. Human New Hire Start Here.
3. AI Agent Onboarding.
4. Company Policies.
5. Systems & Access.
6. Source of Truth.
7. Role Scorecards.
8. Manager Checklist.
9. Legal/Compliance Packet.
10. Security & Incident Response.

Hiring should link the same path and explain that role/hiring work starts there. Product/user activation pages such as `User Onboarding` should remain separate from employee onboarding.

## Page Content Model

| Notion page | Repo source | Page job |
|---|---|---|
| Company Handbook & Onboarding | `README.md`, `docs/onboarding/`, `docs/company/` | First-screen entrypoint and navigation hub. |
| Human New Hire | `docs/onboarding/human-new-hire-start-here.md` | Day-one/week-one path and first-task pattern. |
| AI Agent Onboarding | `docs/onboarding/ai-agent-onboarding-runbook.md` | Safe mutation rules, read order, Notion/Paperclip boundaries, and evidence closeout. |
| Company Policies | `docs/company/` | Draft policy index with counsel/PEO warning. |
| Systems & Access | `docs/company/access-and-equipment-policy.md`, `docs/company/security-and-acceptable-use-policy.md`, `docs/company/vendor-and-procurement-policy.md` | Access model, restricted systems, and command-safety link. |
| Source of Truth | `docs/architecture/source-of-truth-map.md` | Repo/Paperclip/Notion/live-system boundaries. |
| Role Scorecards | `docs/onboarding/role-scorecards-and-30-60-90.md` | Scorecard fields, ramp outcomes, metrics, and source-needed gaps. |
| Manager Checklist | `docs/onboarding/manager-onboarding-checklist.md` | Pre-start, first-week, and 30/60/90 manager actions. |
| Legal/Compliance Packet | `docs/company/new-hire-paperwork-checklist.md`, `docs/company/confidentiality-and-ip-template.md`, `docs/company/pto-benefits-payroll-guide.md` | Review index only; not approval or legal advice. |
| Security & Incident Response | `docs/company/security-and-acceptable-use-policy.md`, `docs/company/incident-response-and-escalation.md`, `docs/company/vendor-and-procurement-policy.md`, `docs/company/offboarding-checklist.md` | First response, triggers, escalation, and agent-specific risk. |

## KPI And Live-Source Rule

KPI Dashboard already uses `Source needed` for missing live sources. Keep that posture. Do not add invented KPI values during onboarding work.

## Maintenance Rule

Repo changes to onboarding/policy docs should be mirrored into Notion by the Notion Manager Agent or an authorized Notion run. Notion edits that change doctrine or policy should be reconciled back into repo docs before they are treated as canonical.
