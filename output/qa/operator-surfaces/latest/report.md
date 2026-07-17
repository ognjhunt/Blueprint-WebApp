# Blueprint Operator Surface QA Report

Generated: 2026-07-17T14:26:21.406Z
Base URL: http://127.0.0.1:37931
Command: `npm run qa:operator`
Boundary: local Playwright dev server with mocked API responses and disabled ops scheduler

## Summary

Routes: 14/14 route/viewports passed.
Issues: 0
Blocked live endpoints: 0
Stubbed external static assets: 1

## What this proves

- Protected operator routes can render through the local React app with fixture-backed API responses.
- The internal screens preserve capture provenance, rights, provider, payment, and fulfillment boundaries in local UI copy.
- Screenshots and route checks are reproducible from one repo-local command without live credentials.
- Known shared static font requests are fulfilled with local empty responses so screenshots do not depend on Google Fonts.

## What this does not prove

Does not prove: live Firebase, Stripe, Notion, Paperclip, Render, Redis, provider execution, email/Slack sends, payments, payouts, or production mutation readiness.

## Fixture Hits

- CSRF token: 14 hit(s). Client security header plumbing can run without live session state.
- Analytics ingest: 22 hit(s). Page-view and private-surface telemetry calls are intercepted locally.
- Company metrics: 2 hit(s). The CEO operating screen renders from a local scoreboard fixture.
- Growth Studio: 8 hit(s). Growth Studio read lanes render without Notion writes, provider calls, or sends.
- Request console ready state: 6 hit(s). Buyer review overview, evidence, and qualification views render from protected request fixtures.
- Request console provider-blocked state: 2 hit(s). Provider-blocked preview copy remains explicit about rights and provider boundaries.
- Admin leads: 8 hit(s). The admin queue and scene readiness detail render from local operator fixtures.

## Route Results

### Company Metrics - desktop

- Path: `/admin/company-metrics`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/admin-company-metrics-desktop.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 3930 visible text characters |
| Visible H1 exists | pass | What is moving, what is blocked, and what needs one human answer. |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: CEO Operating Screen | pass | Found |
| Expected text: Founder/operator truth map | pass | Found |
| Expected text: Capture To Hosted Review | pass | Found |
| Expected text: Local checks do not prove Operational Launch Ready | pass | Found |
| Fixture used: company-metrics | pass | Hits: 1 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |

### Company Metrics - mobile

- Path: `/admin/company-metrics`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/admin-company-metrics-mobile.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 3827 visible text characters |
| Visible H1 exists | pass | What is moving, what is blocked, and what needs one human answer. |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: CEO Operating Screen | pass | Found |
| Expected text: Founder/operator truth map | pass | Found |
| Expected text: Capture To Hosted Review | pass | Found |
| Expected text: Local checks do not prove Operational Launch Ready | pass | Found |
| Fixture used: company-metrics | pass | Hits: 2 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |

### Growth Studio - desktop

- Path: `/admin/growth-studio`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/admin-growth-studio-desktop.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 3902 visible text characters |
| Visible H1 exists | pass | Build proof-led campaign kits from real Blueprint surfaces |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: Growth Studio | pass | Found |
| Expected text: Growth truth boundary | pass | Found |
| Expected text: Ship-broadcast approval queue | pass | Found |
| Expected text: Ad Studio | pass | Found |
| Fixture used: growth-studio | pass | Hits: 4 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |

### Growth Studio - mobile

- Path: `/admin/growth-studio`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/admin-growth-studio-mobile.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 3799 visible text characters |
| Visible H1 exists | pass | Build proof-led campaign kits from real Blueprint surfaces |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: Growth Studio | pass | Found |
| Expected text: Growth truth boundary | pass | Found |
| Expected text: Ship-broadcast approval queue | pass | Found |
| Expected text: Ad Studio | pass | Found |
| Fixture used: growth-studio | pass | Hits: 8 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |

### Request Console Ready Overview - desktop

- Path: `/requests/op-qa-ready`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/requests-op-qa-ready-desktop.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 2810 visible text characters |
| Visible H1 exists | pass | Harborview Grocery Annex |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: Harborview Grocery Annex | pass | Found |
| Expected text: Private review truth map | pass | Found |
| Expected text: Firestore request record | pass | Found |
| Expected text: Access Boundary | pass | Found |
| Fixture used: request-console-ready | pass | Hits: 1 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |

### Request Console Ready Overview - mobile

- Path: `/requests/op-qa-ready`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/requests-op-qa-ready-mobile.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 2796 visible text characters |
| Visible H1 exists | pass | Harborview Grocery Annex |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: Harborview Grocery Annex | pass | Found |
| Expected text: Private review truth map | pass | Found |
| Expected text: Firestore request record | pass | Found |
| Expected text: Access Boundary | pass | Found |
| Fixture used: request-console-ready | pass | Hits: 2 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |

### Request Console Ready Evidence - desktop

- Path: `/requests/op-qa-ready/evidence`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/requests-op-qa-ready-evidence-desktop.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 2531 visible text characters |
| Visible H1 exists | pass | Harborview Grocery Annex |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: Harborview Grocery Annex | pass | Found |
| Expected text: Evidence bundle | pass | Found |
| Expected text: Operating constraints | pass | Found |
| Expected text: approved operator hours | pass | Found |
| Fixture used: request-console-ready | pass | Hits: 3 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |

### Request Console Ready Evidence - mobile

- Path: `/requests/op-qa-ready/evidence`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/requests-op-qa-ready-evidence-mobile.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 2517 visible text characters |
| Visible H1 exists | pass | Harborview Grocery Annex |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: Harborview Grocery Annex | pass | Found |
| Expected text: Evidence bundle | pass | Found |
| Expected text: Operating constraints | pass | Found |
| Expected text: approved operator hours | pass | Found |
| Fixture used: request-console-ready | pass | Hits: 4 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |

### Request Console Ready Qualification - desktop

- Path: `/requests/op-qa-ready/qualification`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/requests-op-qa-ready-qualification-desktop.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 2448 visible text characters |
| Visible H1 exists | pass | Harborview Grocery Annex |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: Harborview Grocery Annex | pass | Found |
| Expected text: Readiness review | pass | Found |
| Expected text: Buyer trust score | pass | Found |
| Expected text: Why this score exists | pass | Found |
| Fixture used: request-console-ready | pass | Hits: 5 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |

### Request Console Ready Qualification - mobile

- Path: `/requests/op-qa-ready/qualification`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/requests-op-qa-ready-qualification-mobile.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 2434 visible text characters |
| Visible H1 exists | pass | Harborview Grocery Annex |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: Harborview Grocery Annex | pass | Found |
| Expected text: Readiness review | pass | Found |
| Expected text: Buyer trust score | pass | Found |
| Expected text: Why this score exists | pass | Found |
| Fixture used: request-console-ready | pass | Hits: 6 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |

### Request Console Provider Blocked Preview - desktop

- Path: `/requests/op-qa-provider-blocked/preview`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/requests-op-qa-provider-blocked-preview-desktop.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 2474 visible text characters |
| Visible H1 exists | pass | Riverbend Cold Storage Cell |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: Riverbend Cold Storage Cell | pass | Found |
| Expected text: Preview and provenance | pass | Found |
| Expected text: Provider preview state | pass | Found |
| Expected text: Provider package is blocked pending rights clearance. | pass | Found |
| Fixture used: request-console-provider-blocked | pass | Hits: 1 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |

### Request Console Provider Blocked Preview - mobile

- Path: `/requests/op-qa-provider-blocked/preview`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/requests-op-qa-provider-blocked-preview-mobile.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 2460 visible text characters |
| Visible H1 exists | pass | Riverbend Cold Storage Cell |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: Riverbend Cold Storage Cell | pass | Found |
| Expected text: Preview and provenance | pass | Found |
| Expected text: Provider preview state | pass | Found |
| Expected text: Provider package is blocked pending rights clearance. | pass | Found |
| Fixture used: request-console-provider-blocked | pass | Hits: 2 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |

### Admin Leads - desktop

- Path: `/admin/leads`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/admin-leads-desktop.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 5151 visible text characters |
| Visible H1 exists | pass | Qualification submissions |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: Qualification submissions | pass | Found |
| Expected text: Durham Facility | pass | Found |
| Expected text: Scene readiness | pass | Found |
| Expected text: Request path: Site operator claim | pass | Found |
| Expected text: Whole-home | pass | Found |
| Fixture used: admin-leads | pass | Hits: 4 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |

### Admin Leads - mobile

- Path: `/admin/leads`
- Status: pass
- Screenshot: `output/qa/operator-surfaces/latest/screenshots/admin-leads-mobile.png`

| Check | Status | Detail |
| --- | --- | --- |
| HTTP document status | pass | 200 OK |
| Nonblank body | pass | 5048 visible text characters |
| Visible H1 exists | pass | Qualification submissions |
| No framework error overlay | pass | No overlay detected |
| No large horizontal overflow | pass | 0px overflow |
| Expected text: Qualification submissions | pass | Found |
| Expected text: Durham Facility | pass | Found |
| Expected text: Scene readiness | pass | Found |
| Expected text: Request path: Site operator claim | pass | Found |
| Expected text: Whole-home | pass | Found |
| Fixture used: admin-leads | pass | Hits: 8 |
| No console errors | pass | No console errors |
| No page errors | pass | No page errors |
| No failed document/assets | pass | No failed document/assets |
