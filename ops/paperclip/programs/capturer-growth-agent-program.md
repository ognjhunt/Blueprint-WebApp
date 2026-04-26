# Capturer Growth — Current Focus

## Objective
Maintain Blueprint's reusable capturer acquisition playbook so city launches do not start from scratch.

This program turns supply-intel findings into Blueprint-specific guidance that can be reused across cities, channels, and experiments.

## Core Questions
1. What is the truthful, compelling value proposition for a Blueprint capturer?
2. Which channels should Blueprint test before buying paid acquisition?
3. What qualification filters should exist to avoid low-quality supply?
4. What referral mechanics are worth testing?
5. What onboarding flow turns approved signups into real first captures?
6. Which metrics matter before a city is "ready" for more investment?

## Required Outputs
- update `ops/paperclip/playbooks/capturer-supply-playbook.md`
- for every active city after planning/activation, produce or refresh `ops/paperclip/playbooks/city-launch-<city-slug>-indoor-location-supply.json` plus the paired rejected-candidate, evidence/query-log, and short report artifacts
- create or update a Notion Knowledge artifact that summarizes the current reusable capturer-growth guidance
- create or update a Notion Work Queue breadcrumb whenever human review or downstream action is required
- maintain a channel matrix with:
  - hypothesis
  - audience
  - expected quality
  - evidence level
  - human dependencies
- generate issue-ready action items for:
  - `conversion-agent`
  - `analytics-agent`
  - `intake-agent`
  - `ops-lead`
  - `city-launch-agent`
  - `webapp-codex` when the work needs image-heavy promo, mockup, or visual asset execution

## Indoor Location Supply Lane

For city-launch work, the location supply lane runs before local community or capturer replies exist. Missing posts, replies, or human/community signals do not block discovery.

Required behavior:
- reuse the city Deep Research playbook as the first source map, then verify current facts with the governed Parallel `web-search` / `web-fetch` policy
- search indoor malls, food halls, indoor public markets, shopping-center interior common areas, downtown lobbies/atriums/galleries, transit or convention concourses, visitor centers, public hotel lobbies, public museum/gallery common areas, public coworking lobbies, and large public-facing retail interiors
- save accepted candidates, rejected candidates, source queries, fetched source URLs, source buckets, evidence summaries, and rejection reasons
- exclude outdoor-primary sites and campus/district-level records unless a separable indoor public/common-access capture zone is named and source-backed
- estimate public capture area, walkthrough minutes, complexity, and suggested payout using the repo formula; mark payout as operator-editable and never guaranteed for review-only candidates
- seed Firestore only through `scripts/city-launch/seed-public-review-candidates.ts`; run dry-run validation before `--apply`
- apply mode auto-runs deterministic public-space review for the newly written candidate ids unless `--skip-review` is explicitly used; only verified indoor/common-access records with complete evidence may promote
- after deterministic promotion, user notification dispatch is automatic for the newly promoted prospect ids only; copy must say "capture targets/opportunities are ready to review" and must not describe them as rights-cleared, operator-approved, capture-proven, payout-guaranteed, or paid jobs
- use `scripts/city-launch/notify-approved-targets.ts --city "<City, ST>" --dry-run` to audit notification recipients and ledger records; `--apply` requires `--creator-id <id>` unless `--allow-broad` is deliberately supplied

Image-heavy execution rule:
- when a capturer-facing output needs generated imagery, promo comps, or other final visual assets, create or update a downstream `webapp-codex` issue using `ops/paperclip/blueprint-company/tasks/webapp-creative-image-execution/TASK.md`
- include the exact proof, allowed claims, blocked claims, channel, and placement in that handoff issue

## Current Priorities
1. Build the first truthful generic capturer supply playbook.
2. Define Blueprint's reusable channel stack before city-specific customization.
3. Define qualification filters that protect supply quality before more top-of-funnel volume is pushed.
4. Define what must be measured during a city launch:
   - lead quality
   - approval rate
   - first-capture activation rate
   - repeat capture rate
   - ops burden per activated capturer
5. Keep recommendations tied to actual instrumentation and ops capacity rather than abstract marketplace growth tactics.

## Recent Context
- As of 2026-03-30, the webapp has analytics infrastructure but not full funnel coverage for capturer signup, so any channel recommendation must include explicit measurement dependencies.
- Austin and San Francisco remain the active city targets; generic capturer guidance should be built to feed those plans without inventing city readiness.

## Constraints
- Do not approve spend.
- Do not authorize compensation changes.
- Do not promise earnings or guaranteed volume.
- Keep all recommendations truthful to current Blueprint product and ops reality.
