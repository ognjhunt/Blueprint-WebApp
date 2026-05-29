# Blueprint Public Marketing Audit Report

Date: 2026-05-24

Status: Current internal audit closeout for the public WebApp marketing surface.

## Current QA Truth

Use `output/qa/brand-polish/latest/report.md` as the latest local QA evidence snapshot for this audit. The current snapshot reports:

- `npm run qa:polish`
- 24/24 route viewport checks passed.
- 82/82 internal link checks passed.
- No blocking issues found.

The report is generated evidence, not product doctrine. Product positioning remains governed by `AGENTS.md`, `PLATFORM_CONTEXT.md`, `WORLD_MODEL_STRATEGY_CONTEXT.md`, and `docs/architecture/public-display-ready-claims-matrix.md`.

## Current Positioning

Blueprint should read as a capture-first, world-model-product-first company:

- Blueprint sells site-specific world-model packages and hosted review paths built from real capture provenance.
- Robot teams request, inspect, and evaluate exact-site outputs with proof, rights, access, and fulfillment reviewed per site or request.
- Capturer and operator flows support the supply and rights loop, but they do not replace the core product story.
- Qualification, readiness, and provider review are trust layers. They should not become the center of the public positioning.

## Covered Public Routes

The active brand-polish harness covers the following route and viewport matrix:

| Route | Public role | Expected primary posture |
|---|---|---|
| `/` | Home and first impression | Site-specific world models from real capture. |
| `/product` | Exact-site hosted review product | Turn one real site into a decision-ready world model. |
| `/world-models` | Public world-model catalog | Browse exact-site world models with request-scoped access. |
| `/agents` | Robot-team agent access | Request OpenAPI, CLI, MCP, and hosted-session access without implying automatic entitlement. |
| `/pricing` | Pricing and package paths | Choose the first step for one real site. |
| `/proof` | Proof and evidence framing | Show what is attached before a robot team commits. |
| `/capture` | Capturer path | Get paid to capture indoor places, with assignment and payout truth reviewed through the operating stack. |
| `/contact` | Buyer and operator intake | Request the site-specific world model a robot team needs. |
| `/careers` | Hiring | Build the systems behind exact-site world models. |
| `/faq` | Buyer fit questions | Explain fit, proof, rights, access, and fulfillment boundaries. |
| `/about` | Company narrative | Make one real site legible earlier. |
| `/updates` | Public notes | Notes on exact-site world models. |

## Audit Findings

| Area | Result | Notes |
|---|---|---|
| Public QA surface | Pass | The latest local QA report shows all route/viewport and internal link checks passing. |
| Stale brand language | Fixed in docs | The previous audit report described an older simulation/data-exchange positioning and should no longer guide agents. |
| Route inventory | Fixed in docs | The QA harness doc now mirrors the active route list from `scripts/qa/brand-polish.ts`, including `/agents`. |
| Public page redesign | Not required | This audit did not find a current QA-surface reason to redesign public pages. |
| Live operations claims | Guarded | Public routes may look complete and present-tense, but live payments, payouts, provider execution, rights clearance, package access, and hosted-session fulfillment require proof from their owning systems. |

## Disallowed Drift

Future agents should not reintroduce:

- simulation-first or generic dataset-exchange framing as the lead story;
- route plans centered on removed or legacy public pages instead of the current `/world-models` and `/product` surface;
- CTAs that imply completed purchase, open entitlement, cleared rights, live payout, or fulfilled hosted access before the owning system proves it;
- provider-completed or deployment-ready claims when only a request path, sample, local artifact, or generated preview exists;
- broad apology, not-launched, placeholder, or operationally-not-ready copy on public first screens when a claim-level qualifier would be more accurate.

## Safe Public Language

Safe public-page language includes:

- site-specific world models;
- real capture provenance;
- request world model;
- browse world models;
- request hosted review;
- inspect proof;
- request agent access;
- rights, access, availability, and fulfillment reviewed per site or request.

## Agent Instructions

When working on marketing or buyer-facing docs:

1. Start from `scripts/qa/brand-polish.ts` for the current QA route list and expected public headings.
2. Use `output/qa/brand-polish/latest/report.md` only as a generated evidence snapshot.
3. Preserve Public Launch Ready posture unless a specific sentence invents an unsupported fact.
4. Qualify only the unsupported fact: real customers, traction metrics, cleared rights, completed provider execution, live payments, live payouts, active city coverage, open package access, or guaranteed hosted-session fulfillment.
5. Do not redesign public pages from this audit alone while `npm run qa:polish` is green.

## Verification

Required closeout commands for this doc family:

```bash
npm run check
npm run qa:polish
git diff --check
```
