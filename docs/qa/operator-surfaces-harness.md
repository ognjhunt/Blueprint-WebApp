# Operator Surfaces QA Harness

Status: Local QA harness.

Run:

```bash
npm run qa:operator
```

The command starts the Playwright local dev server on an available local port, enables the development-only fake operator auth gate, disables the ops automation scheduler, and checks selected internal/private routes at desktop and mobile sizes. No live Firebase, Stripe, Notion, Paperclip, Render, Redis, provider, Slack, email, payment, payout, or send actions are performed.

## Output

Latest artifacts are written to:

- `output/qa/operator-surfaces/latest/report.md`
- `output/qa/operator-surfaces/latest/summary.json`
- `output/qa/operator-surfaces/latest/screenshots/*.png`

The report separates local UI proof from live operational proof. It is generated evidence for local review, not a source of operational launch truth.
Known shared Google Fonts stylesheet/font requests are fulfilled by the harness with empty local responses so screenshots do not depend on external static assets.

## Covered Surfaces

- `/admin/company-metrics`
- `/admin/growth-studio`
- `/requests/op-qa-ready`
- `/requests/op-qa-ready/evidence`
- `/requests/op-qa-ready/qualification`
- `/requests/op-qa-provider-blocked/preview`
- `/admin/leads`

## What It Proves

- The covered private/internal routes render locally from fixture-backed API responses.
- The admin routes can be reached with `VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH=1`, a development-only fake operator identity.
- RequestConsole states can show ready, evidence, qualification, and provider-blocked preview states without live provider calls.
- AdminCompanyMetrics, AdminGrowthStudio, and AdminLeads can render their core operator panels without live credentials or money-gated systems.
- Any unmocked `/api/*` request is treated as a boundary violation and fails the harness.
- Non-local live service calls are blocked. Known static font requests are stubbed locally and reported separately from blocked endpoints.

## What It Does Not Prove

This harness does not prove live operational readiness. It does not prove live Firebase auth or Firestore state, Stripe payments, Notion sync, Paperclip issue state, Render deployment state, Redis state, provider execution, Slack/email sends, payouts, payment fulfillment, hosted-session fulfillment, cleared rights, or production mutation readiness.

## Fixture Boundary

Fixtures live in `scripts/qa/operator-surfaces.ts`. The Playwright spec intercepts local `/api/*` requests and fulfills only the endpoints declared there. It also blocks non-local HTTP(S) requests so the screenshots and report cannot depend on external services. The only exception is shared static Google Fonts asset URLs, which are stubbed locally with empty responses and reported as stubbed assets.

When a surface adds a new read endpoint that should be part of local QA, add a fixture entry and an expected text check. Do not add mutation actions, live sends, provider calls, payment flows, Notion writes, or production-side effects to this harness.
