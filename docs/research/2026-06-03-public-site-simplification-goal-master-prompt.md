# Codex /goal Master Prompt: KISS Public-Site Revamp

Date: 2026-06-03

This handoff is for a fresh Codex session using `/goal`. It is intentionally implementation-oriented. The goal is to collapse Blueprint-WebApp's public website from a broad early-startup information maze into a simple, premium, proof-bounded buyer surface that explains:

- what Blueprint sells
- who it is for
- how it works
- what it costs
- what proof is real vs sample/request-gated
- how a robot team or site operator asks for the first readiness review

The next session should implement, test, inspect, and iterate until the revamp is actually complete locally. It should not stop after a plan.

## Start The Next Session

Start Codex in:

```bash
cd /Users/nijelhunt_1/workspace/Blueprint-WebApp
```

Paste this compact goal first:

```text
/goal Complete a KISS public-site revamp for Blueprint-WebApp. Read docs/research/2026-06-03-public-site-simplification-goal-master-prompt.md, collapse the public marketing surface to one core buyer story plus pricing/request/proof/legal routes, implement the route/nav/copy/UI/test/build/browser-verification loop, and do not stop until the local site is simple, premium, truthful, responsive, and verified.
```

Then paste:

```text
Use the full handoff in docs/research/2026-06-03-public-site-simplification-goal-master-prompt.md. If context gets long, use /compact and keep going. Work in checkpoints with short progress notes: current checkpoint, files touched, what was verified, what remains, and whether anything is blocked.
```

Why the prompt points at a file: official Codex CLI docs say `/goal` objectives must be non-empty and at most 4,000 characters, and longer instructions should live in a file referenced by the goal.

## Research Basis

Use current web research again before making specific new external claims, but the current research basis for this handoff is:

- OpenAI Codex "Follow a goal": `/goal` is best for long-running work with a clear success condition, validation loop, one objective, first-read files, proof commands/artifacts, checkpoints, progress logs, and pause/resume/clear controls.
- OpenAI Codex CLI slash commands: `/goal <objective>` sets the active goal, `/goal` views it, `/goal pause`, `/goal resume`, and `/goal clear` control it; goal objectives have a 4,000-character limit.
- OpenAI Codex best practices: keep one thread per coherent unit of work, use `/compact` as context grows, avoid one thread per project, use MCPs only when external context genuinely matters, and avoid running live threads on overlapping files without worktrees.
- Local machine check from this session: `codex-cli 0.130.0`; `/Users/nijelhunt_1/.codex/config.toml` already has `[features] goals = true`.
- OpenAI GPT Image 2 docs: `gpt-image-2` is the current state-of-the-art OpenAI image generation/editing model with text/image input and image output. Repo docs already route Codex-executed brand/frontend image work to Codex desktop OAuth-backed `gpt-image-2` by default.
- NVIDIA Cosmos 3 launch and technical docs: Cosmos 3 combines vision reasoning, world generation, and action prediction for physical AI; it is useful for synthetic data, post-training, closed-loop simulation, world action models, and vision reasoning, but it does not replace Blueprint's capture/provenance truth.
- Gartner's January 21, 2026 humanoid forecast says deployments through 2028 remain limited: fewer than 100 companies progress beyond experimentation, fewer than 20 go live in production for supply-chain/manufacturing humanoid use cases, and most production deployments are tightly controlled. This supports a focused concierge/service wedge, not a giant self-serve marketplace.
- Figure/BMW, Agility/Toyota, 1X world-model work, Agile Robots/Cosmos, and FieldAI/NVIDIA all support the thesis that serious robot teams need site/task-specific data, evaluation, and failure discovery. They do not support claiming Blueprint has already run live robot policies or proven deployment readiness.

## Current Repo Audit Summary

Start by verifying these because the repo may have changed:

- Worktree was clean at the time this handoff was written.
- `client/src/app/routes.tsx` currently has 67 `layout: "public"` entries, 11 protected entries, and 21 legacy redirect entries.
- `server/utils/public-artifacts.ts` currently has 23 static sitemap routes before help/category/site-world expansion.
- `scripts/prerender.tsx` prerenders the broad public surface, including Home, Capture, Product, Robot Teams, How It Works, Agents, World Models, Pricing, Sample Deliverables, Proof, Contact, Help, Launch Map, FAQ, Governance, About, Updates, Careers, auth/legal, and dynamic site-world detail/start pages.
- The header nav currently exposes 7 primary links: Readiness, Product, Robot teams, Site packages, Capture, Proof, Pricing.
- The footer currently exposes 10 product links, 6 company links, and 4 support links.
- High-word-count public pages create a bloated first impression: `Home.tsx` is about 1100 lines, `SiteWorlds.tsx` about 1000, `Pricing.tsx` about 650, `Proof.tsx` about 630, `ReadinessPack.tsx` about 575, `ExactSiteHostedReview.tsx` about 500, plus many supporting pages.
- Existing tests are coupled to public copy: `client/tests/pages/Home.test.tsx`, `Pricing.test.tsx`, `ExactSiteHostedReview.test.tsx`, `ReadinessPack.test.tsx`, `Proof.test.tsx`, `SiteWorlds.test.tsx`, and `e2e/brand-polish.spec.ts` will likely need updates.
- Existing visual assets are good enough to start from: `client/public/generated/humanoid-readiness-2026-06-03/`, `client/src/lib/editorialGeneratedAssets.ts`, and `client/src/lib/siteEditorialContent.ts`. Use `gpt-image-2` only if the current assets cannot carry the simplified story.
- The newest doctrine adds the public wedge: Blueprint may lead with "site-specific robot deployment readiness" as an advisory buyer workflow grounded in capture-backed site packages, task scope, robot profiles, thresholds, provenance, rights/privacy boundaries, hosted review, and missing-proof labels.

## Product Direction For The Revamp

The current public site is too broad for the stage. The simplified public story should be:

> Blueprint helps robot teams decide whether a robot is likely to work at one real facility, on one task, before an expensive pilot. We capture or package the site, define the task and pass bar, run a readiness workflow, show the evidence and gaps, and recommend the next proof step.

Lead with one buyer question:

> Will this robot work in my facility, on this task, at my required success rate, cycle time, intervention rate, and safety threshold?

Do not lead with:

- a public catalog marketplace
- a broad autonomous org story
- an agent-access platform
- generic world-model hype
- capturer earning flows
- internal proof/governance docs as standalone public pages
- city launch
- careers
- blog/updates
- a giant help center
- a broad "site package marketplace" if there is not enough live supply yet

The page should feel like a sharp early startup with one clear service, not a large enterprise platform pretending every surface is mature.

## KISS Public Information Architecture

Target public IA after the revamp:

1. `/`
   - The main public site.
   - Must explain the value prop, use case, offer, workflow, pricing preview, proof boundary, and CTA in one coherent page.
   - Use anchor sections for `#how-it-works`, `#pricing`, `#proof`, and `#request` instead of sending cold visitors through many routes.

2. `/pricing`
   - Keep if pricing deserves a direct URL.
   - Make it short and consistent with the home pricing section.
   - Consider making it a focused pricing page with 3 packages maximum.

3. `/contact`
   - Keep as the main structured intake path.
   - The form should default to robot-team readiness evaluation and still support site-operator/capturer direct links where needed.

4. `/proof`
   - Either keep as a short proof explainer or fold into the home page and redirect `/proof` to `/#proof`.
   - If kept, it must be concise and sample-labeled.

5. `/privacy` and `/terms`
   - Keep for legal needs, preferably no-friction and not in primary nav.

6. Auth/request/direct operational routes
   - Keep working but noindex and hidden from primary public marketing:
     `/sign-in`, `/portal`, `/signup/*`, `/forgot-password`, `/requests/*`, `/world-models/:slug/start`, `/world-models/:slug/workspace`.

7. Legacy or secondary marketing pages
   - Redirect, noindex, or hide from sitemap/header/footer unless a direct business reason exists:
     `/readiness`, `/product`, `/for-robot-teams`, `/how-it-works`, `/world-models`, `/agents`, `/capture`, `/sample-deliverables`, `/launch-map`, `/faq`, `/governance`, `/about`, `/updates`, `/careers`, `/help`, `/help/*`, `/contact/site-operator`, `/capture-app/launch-access`.
   - Prefer preserving old URLs through `MarketingRedirect` or lean pages rather than deleting routes and breaking inbound links.

Recommended final header:

- Logo
- How it works (`/#how-it-works`)
- Pricing (`/#pricing` or `/pricing`)
- Proof (`/#proof` or `/proof`)
- CTA: Request readiness review

Recommended final footer:

- One short product paragraph
- Product: How it works, Pricing, Proof
- Contact: Request readiness, Site operator boundaries, Capturer access only as direct/support link
- Legal: Privacy, Terms

## Copy System

Use compact, buyer-legible language.

Preferred public headline options:

- "Know what breaks before the robot pilot."
- "Pre-pilot readiness for one real site."
- "Test robot readiness against the real facility."

Preferred subcopy:

- "Blueprint turns a real facility, robot task, and pass bar into a readiness report for robot teams before they spend months on-site."
- "We package capture evidence, task thresholds, failure modes, missing proof, and next-step recommendations around one site."

Avoid:

- "We guarantee deployment readiness."
- "Safety validated."
- "Simulator execution completed."
- "The robot is ready to deploy."
- "We ran your actual robot policy."
- "Live marketplace."
- "Active city coverage."
- "Real customer proof" unless owner-system proof exists.
- Broad apology copy like "not launched yet", "coming soon", "demo only", or "we are still building."

Use exact caveats where needed:

- "Advisory until simulator traces, action logs, robot trials, safety review, rights proof, and hosted runtime proof support a stronger claim."
- "Requests do not grant package access, rights clearance, payment, fulfillment, or hosted-session availability by themselves."
- "Public samples show the product shape; request packets prove one site."

## Pricing Direction

Keep public pricing simple. Use ranges only if they are framed as planning ranges.

Recommended three-package model:

1. Site/Task Readiness Review
   - Early planning range: `$2,100 - $3,400`
   - What it answers: one site, one task suite, robot profile, thresholds, proof gaps, pilot recommendation.

2. Hosted Evaluation
   - Early planning range: `$16 - $29 / session-hour`
   - What it adds: managed browser review, reruns, observations, export framing, direct buyer room.

3. Custom Multi-Site or Vendor Benchmark
   - Planning range: `$50,000+ scoped`
   - What it adds: private/multi-site capture planning, vendor-neutral benchmark, custom data/eval package, operator boundaries.

If the next session finds better current repo-approved pricing in `Pricing.tsx`, `server/utils/accounting.ts`, or docs/research, use that. Do not invent payment success, active subscriptions, Stripe readiness, or customer outcomes.

## Visual Direction

Use existing generated assets first:

- `client/public/generated/humanoid-readiness-2026-06-03/humanoid-warehouse-readiness-hero.png`
- `client/public/generated/humanoid-readiness-2026-06-03/humanoid-hosted-readiness-dashboard.png`
- `client/public/generated/humanoid-readiness-2026-06-03/humanoid-proof-board.png`
- `client/src/lib/editorialGeneratedAssets.ts`

If these assets do not support the simplified site, use Codex desktop's OAuth-backed native image workflow with `gpt-image-2` by default, consistent with:

- `docs/ai-tooling-adoption-implementation-2026-04-07.md`
- `docs/ai-skills-governance-2026-04-07.md`
- `docs/codex-creative-routing-2026-04-16.md`

Image generation rules:

- Generate only polished illustrative public-site assets, not "proof" assets.
- Save assets under `client/public/generated/public-site-kiss-2026-06-03/`.
- Add a small source/readme note if new generated assets are added.
- Do not present generated robot scenes as live robot-trial proof, safety validation, customer deployment evidence, rights clearance, or proof that a specific robot is ready to deploy.
- If image generation fails or requires unavailable OAuth/tooling, do not block the revamp. Use existing assets and layout polish.

Visual style:

- Simple, premium, direct.
- Dense enough for a serious buyer, but not a long internal memo.
- Avoid decorative SaaS clutter, excessive cards, giant nav trees, or multiple competing CTAs.
- First viewport must say what Blueprint does and show a concrete robot/site/readiness visual.
- No generic landing-page hero that delays the product.

## Required First Steps In The Goal Run

1. Run:

```bash
git status --short
```

Inspect dirty/untracked files before editing. Preserve unrelated user work.

2. Read:

- `AGENTS.md`
- `README.md`
- `PLATFORM_CONTEXT.md`
- `WORLD_MODEL_STRATEGY_CONTEXT.md`
- `AUTONOMOUS_ORG.md`
- `DEPLOYMENT.md`
- `package.json`
- `docs/architecture/source-of-truth-map.md`
- `docs/architecture/command-safety-matrix.md`
- `docs/architecture/public-display-ready-claims-matrix.md`
- `docs/architecture/ai-onboarding-map.md`
- `docs/architecture/site-specific-robot-deployment-readiness-wedge-2026-06-02.md`
- `docs/ai-tooling-adoption-implementation-2026-04-07.md`
- `docs/ai-skills-governance-2026-04-07.md`

3. Read nested guides if editing under their folders:

- `client/AGENTS.md` if present
- `server/AGENTS.md`
- `scripts/AGENTS.md`

4. Use graphify as navigation, not truth:

- `graphify-out/GRAPH_REPORT.md`, if present
- otherwise `derived/graphify/webapp-architecture/corpus/graphify-out/GRAPH_REPORT.md`

5. Re-audit current route exposure:

```bash
rg -n 'layout: "public"|layout: "protected"|component: Legacy' client/src/app/routes.tsx
sed -n '1,260p' client/src/components/site/navigation.ts
sed -n '1,320p' scripts/prerender.tsx
sed -n '1,220p' server/utils/public-artifacts.ts
sed -n '1,220p' server/routes/site-content.ts
wc -l client/src/pages/Home.tsx client/src/pages/Pricing.tsx client/src/pages/Proof.tsx client/src/pages/ReadinessPack.tsx client/src/pages/ExactSiteHostedReview.tsx client/src/pages/SiteWorlds.tsx
```

## Implementation Plan

Work in checkpoints and update tests as you go.

### Checkpoint 1 - Freeze the target IA

Create a short local implementation note before editing code:

```text
docs/research/2026-06-03-public-site-simplification-implementation-notes.md
```

The note should record:

- current route counts
- public pages kept in primary nav
- public pages hidden/noindexed/redirected
- sitemap/prerender route changes
- copy decisions
- assets used or generated
- verification commands planned

Keep this note short. It is a live implementation scratchpad, not a strategy essay.

### Checkpoint 2 - Simplify navigation and public route exposure

Likely files:

- `client/src/components/site/navigation.ts`
- `client/src/components/site/Header.tsx`
- `client/src/components/site/Footer.tsx`
- `client/src/app/routes.tsx`
- `scripts/prerender.tsx`
- `server/utils/public-artifacts.ts`
- `server/routes/site-content.ts`
- possibly `client/src/components/SEO.tsx`, `client/src/lib/seoStructuredData.ts`, `client/public/robots.txt`, `client/public/llms.txt`, `client/public/llms-full.txt`

Target:

- Header primary nav has no more than 3 links plus CTA.
- Footer is compact.
- Sitemap prioritizes `/`, `/pricing`, `/contact`, maybe `/proof`, plus legal. Remove help/categories/careers/updates/about/capture/agents/catalog from high-priority public sitemap unless intentionally kept.
- Old marketing URLs remain reachable via redirects or short noindex pages, not broken.
- Direct operational routes still work but are hidden/noindex.

### Checkpoint 3 - Rebuild the home page as the core public website

Likely file:

- `client/src/pages/Home.tsx`

Target home sections:

1. Hero
   - Clear headline.
   - One sentence value prop.
   - One primary CTA: "Request readiness review".
   - One secondary CTA: "See pricing" or "See proof".
   - Concrete visual.

2. The buyer question
   - Success rate, cycle time, intervention rate, safety threshold.
   - Explain why failed pilots are expensive.

3. What Blueprint sells
   - Readiness report.
   - Capture-backed site package.
   - Hosted evaluation.
   - Optional custom benchmark/data package.

4. How it works
   - Capture or package one site.
   - Define task and pass bar.
   - Generate/readiness scenario evidence.
   - Show failure modes and missing proof.
   - Decide next step: short pilot, site modification, more data, or hold.

5. Pricing
   - Three packages max.
   - Link to full pricing or contact.

6. Proof boundary
   - Public samples vs request packets.
   - Generated/model-derived outputs are support signals.
   - No deployment verdict without owner-system proof.

7. Final CTA
   - Ask for one site/task readiness review.

Reduce copy aggressively. The home page should not read like the whole doctrine folder.

### Checkpoint 4 - Simplify pricing

Likely file:

- `client/src/pages/Pricing.tsx`

Target:

- Three plans max.
- Short "which should I choose?" section.
- Explicit "what pricing does not claim" caveat.
- No extra sections that feel like an internal memo.

Update tests:

- `client/tests/pages/Pricing.test.tsx`

### Checkpoint 5 - Decide proof route vs proof section

Likely files:

- `client/src/pages/Proof.tsx`
- `client/tests/pages/Proof.test.tsx`

Recommended:

- Keep `/proof` as a short, premium proof explainer if needed for credibility.
- Otherwise redirect `/proof` to `/#proof` and keep proof in Home.

If kept, proof page should be:

- 1 hero
- 1 sample-vs-request table
- 1 evidence hierarchy
- 1 CTA

### Checkpoint 6 - Collapse secondary public pages

Decide for each:

- `/readiness`
- `/product`
- `/for-robot-teams`
- `/how-it-works`
- `/world-models`
- `/agents`
- `/capture`
- `/sample-deliverables`
- `/launch-map`
- `/faq`
- `/governance`
- `/about`
- `/updates`
- `/careers`
- `/help`
- `/help/*`
- `/contact/site-operator`
- `/capture-app/launch-access`

For each, choose one:

- redirect to `/`, `/pricing`, `/contact`, or `/proof`
- noindex and remove from nav/sitemap
- keep only as direct operational/support page

Do not delete important direct flows without checking route users:

- `CaptureAppDock`
- `ContactForm`
- `RequestConsole`
- hosted-session links
- sample manifest/report links
- generated sitemap/prerender expectations

### Checkpoint 7 - Update tests and generated public metadata

Likely tests:

- `client/tests/pages/Home.test.tsx`
- `client/tests/pages/Pricing.test.tsx`
- `client/tests/pages/Proof.test.tsx`
- `client/tests/pages/ExactSiteHostedReview.test.tsx`
- `client/tests/pages/ReadinessPack.test.tsx`
- `client/tests/pages/SiteWorlds.test.tsx`
- route/prerender/sitemap/static-serving tests found by `rg`
- `e2e/brand-polish.spec.ts`

Use the rendered UI as truth. If tests fail because old copy was intentionally removed, update assertions. If tests reveal broken links or missing route behavior, fix code.

### Checkpoint 8 - Verify locally and visually

Run targeted tests first, then broader gates:

```bash
npx vitest run client/tests/pages/Home.test.tsx client/tests/pages/Pricing.test.tsx client/tests/pages/Proof.test.tsx
npm run check
npm run build
```

If route/sitemap/prerender files changed, run relevant tests found by:

```bash
rg -n "sitemap|prerender|static-serving|site-content|public-artifacts|routes" client/tests server tests scripts e2e
```

Because this is frontend work, start the local app and use browser verification:

```bash
npm run dev
```

Then inspect at least:

- `http://localhost:<port>/`
- `http://localhost:<port>/pricing`
- `http://localhost:<port>/contact?persona=robot-team`
- `http://localhost:<port>/proof` if kept

Use desktop and mobile widths. Check:

- no horizontal overflow
- first viewport communicates value prop and CTA
- nav is simple
- pricing is understandable
- proof boundaries are visible but not sales-killing
- old high-priority routes redirect or noindex as intended
- images load and are not falsely framed as proof

After code-file changes, run:

```bash
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

## Done Means

The goal is done only when all are true:

- Public primary nav is reduced to the core story.
- The home page clearly explains use case, value prop, offer, how it works, price ranges, proof boundary, and request CTA without requiring visitors to visit many pages.
- Sitemap/prerender/public-content exposure is simplified to the intended public IA.
- Secondary public pages are either redirected, hidden/noindexed, or kept with a clear direct purpose.
- Public copy remains confident and Public Launch Ready, without unsupported Operational Launch Ready claims.
- Pricing is easy to understand.
- Contact path still works for robot-team readiness requests.
- Tests have been updated to match the new IA.
- `npm run check` passes.
- `npm run build` passes.
- Browser verification on desktop and mobile confirms no broken layout, missing assets, or confusing first-screen messaging.
- Graphify refresh has run after code changes.
- Final closeout lists exact files changed, route exposure changes, test/build results, browser URLs checked, screenshots/artifact paths if any, and residual risks.

## Stop Or Ask Only If

Ask the user only if a decision cannot be made safely from repo doctrine and the handoff.

Stop as blocked if:

- required repo files are missing in a way that prevents safe route changes
- dependency install/build is impossible due machine state after reasonable repair attempts
- live/deploy/payment/provider actions would be needed to verify a claim
- user-owned dirty changes overlap so heavily with the target files that proceeding would overwrite unrelated work

Do not stop because:

- the revamp is large
- tests need updates
- old copy assertions fail
- a secondary page has sentimental value
- image generation is unavailable
- the first pass is not visually strong enough

Iterate until the local output is actually simple and coherent.

## Suggested Final Closeout Format

```text
Goal objective:
State claimed: done | blocked
Route/IA changes:
Primary public routes now:
Routes hidden/noindexed/redirected:
Core copy decision:
Pricing decision:
Proof-boundary decision:
Assets used/generated:
Files changed:
Verification:
Browser checks:
Residual risk:
Next action:
```

## Source Links Used For This Handoff

- OpenAI Codex Follow a goal: https://developers.openai.com/codex/use-cases/follow-goals
- OpenAI Codex CLI slash commands: https://developers.openai.com/codex/cli/slash-commands
- OpenAI Codex best practices: https://developers.openai.com/codex/learn/best-practices
- OpenAI GPT Image 2 model docs: https://developers.openai.com/api/docs/models/gpt-image-2
- NVIDIA Cosmos 3 launch: https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Launches-Cosmos-3-the-Open-Frontier-Foundation-Model-for-Physical-AI/default.aspx
- NVIDIA Cosmos product page: https://www.nvidia.com/en-us/ai/cosmos/
- NVIDIA Cosmos 3 technical blog: https://developer.nvidia.com/blog/develop-physical-ai-reasoning-world-and-action-models-with-nvidia-cosmos-3/
- Gartner humanoid forecast: https://www.gartner.com/en/newsroom/press-releases/2026-01-21-gartner-predicts-fewer-than-20-companies-will-scale-humanoid-robots-for-manufacturing-and-supply-chain-to-production-stage-by-2028
- Figure BMW deployment: https://www.figure.ai/news/production-at-bmw
- Agility Toyota commercial agreement: https://www.agilityrobotics.com/content/agility-robotics-announces-commercial-agreement-with-toyota-motor-manufacturing-canada
- 1X World Model: https://www.1x.tech/discover/redwood-ai-world-model
- Agile Robots Cosmos 3 early access: https://www.agile-robots.com/en/news/detail/simulating-worlds-agile-robots-early-access-to-nvidia-cosmos-3/
- FieldAI NVIDIA collaboration: https://www.fieldai.com/news/fieldai-accelerates-industrial-customers-adoption-of-ai-in-collaboration-with-nvidia
- Simon Willison on Codex CLI 0.128.0 `/goal`: https://simonwillison.net/2026/Apr/30/codex-goals/
- User-supplied Substack `/goal` article: https://mlearning.substack.com/p/codex-goal-beginner-guide-to-openai-new-autonomous-goal-feature-ralph-loop-official-practical-tips-trics
- User-supplied Towards AI `/goal` article: https://pub.towardsai.net/i-walked-away-from-openais-new-codex-goal-for-18-hours-it-shipped-14-of-18-features-solo-a280f8407707
- User-supplied Reddit `/goal` thread: https://www.reddit.com/r/codex/comments/1t3opdd/goal_is_the_best_thing_ever/
