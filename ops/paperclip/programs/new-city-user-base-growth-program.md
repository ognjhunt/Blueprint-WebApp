# New City User-Base Growth Program

## Mission

Grow Blueprint from zero in a new city without turning the city launch into generic marketing.

The city growth loop must create real user motion around Blueprint's current product truth:

- capturers who can produce useful real-site capture supply
- robot-team buyers who can evaluate exact-site hosted review or request demand-sourced capture
- site operators only when access, rights, commercialization, or a specific site workflow makes that lane useful
- onboarding and conversion paths that move people into structured intake, capture review, hosted review, or a named follow-up

## Operating Shape

Growth Lead owns the city user-base loop. Specialist agents own their lane outputs.

The loop has five stages:

1. **Pick the wedge**
   - name one city, one first ICP, one first proof motion, and one target outcome
   - default proof motion is Exact-Site Hosted Review
   - use `demand_sourced_capture` when the city lacks review-ready exact-site proof
2. **Build the addressable map**
   - capturer-growth-agent maps lawful, quality-weighted capturer supply channels and indoor/common-access candidate sources
   - demand-intel-agent and robot-team-growth-agent map robot-team buyer signals, proof needs, and recipient-backed contact paths
   - city-demand-agent keeps the city/site opportunity context tied to robot workflows, not generic city enthusiasm
3. **Open the intake path**
   - conversion-agent checks the city landing or entry surface, CTA, event coverage, and no-PII analytics
   - intake-agent verifies structured-intake-first routing for capturers and buyers
   - no Calendly-first or broad "join the marketplace" path counts as onboarding completion
4. **Run draft-first distribution**
   - all public posts, first-batch outbound, community posts, paid spend, and commercial commitments remain gated
   - first reversible work is target packaging, recipient evidence, draft copy, asset briefs, send ledger updates, and follow-up queues
   - image-heavy or visual campaign execution routes to `webapp-codex`
5. **Close the first-user loop**
   - every weekly run must report real movement in at least one user-motion field:
     target, recipient-backed contact, approved draft, sent touch, reply, structured intake, approved capturer, capture ask, hosted-review start, qualified call, capture completed, blocker, or stop/change decision

## Day-Zero Checklist

Before a new city growth issue can be called active, Growth Lead must attach or link:

- focus city and city slug
- selected track: `proof_ready_outreach` or `demand_sourced_capture`
- first ICP: capturer, robot-team buyer, or operator-linked access
- one current proof artifact, or a clearly labeled proof gap and capture ask
- city-facing CTA path and structured intake route
- analytics events expected for the CTA and intake path
- source policy for allowed and disallowed channels
- send/post approval state
- owner for reply and onboarding follow-through
- stop/change threshold for the first run

If any item is missing, the city can stay in planning or draft-prep, but it is not active growth.

## First 14 Days

Use a two-week clock so the city does not sprawl.

Required weekly evidence:

- target ledger or city-opening send ledger changed
- capturer prospect, buyer target, or operator/access row gained evidence or a named blocker
- structured intake, hosted-review, or capture-target route was inspected for the city
- next action is assigned to one owner and one artifact

Allowed decisions at day 14:

- continue the same ICP
- change ICP
- change offer
- change proof artifact
- change CTA or onboarding path
- stop the city loop

The default is a decision, not an automatic extension.

## Lane Responsibilities

### Growth Lead

- owns the city objective, active/paused lane posture, and weekly decision
- keeps one focus city active unless the founder explicitly approves a broader bounded expansion
- wakes paused lanes only through this program, `city-launch-activation-program.md`, or the Exact-Site Hosted Review GTM pilot program
- escalates only spend, public posture changes, live send/post approval, non-standard commercial commitments, or policy exceptions

### City Launch Agent

- keeps the city activation/playbook surfaces current
- ensures city-opening distribution, CTA routing, response tracking, and launch-surface coverage are explicit
- does not mark city growth active when addressability, onboarding, or proof gaps are still unresolved

### Capturer Growth Agent

- owns capturer channel map, source policy input, invite/referral draft posture, and first-capture activation handoff
- prioritizes supply quality, activation, and repeat-readiness over signup volume
- never promises payout, availability, rights clearance, or guaranteed jobs

### Robot-Team Growth Agent

- owns buyer offer packaging around one site or site type, one workflow, one proof artifact, and one next step
- keeps recipient-backed contact evidence separate from target research
- uses the GTM enrichment/audit loop before reporting send readiness

### Demand Intelligence Agent

- supplies real buyer-signal evidence, not generic TAM or broad account lists
- hands off only targets with workflow evidence and a clear proof or capture angle

### City Demand Agent

- translates city/site opportunity into robot-team demand context
- keeps buyer motion tied to exact-site hosted review or demand-sourced capture
- does not use city plans as proof that a city is live

### Conversion Agent

- owns the CTA, landing/entry surface, funnel instrumentation, and experiment guardrails
- runs measurement-first checks before proposing city-specific conversion changes
- routes visual asset execution to `webapp-codex`

### Intake Agent

- owns structured-intake-first onboarding review for capturers and buyers
- routes incomplete records to missing-fact follow-up instead of pretending onboarding is complete
- keeps qualification supportive, not the product story

## Required Artifacts

Use existing artifacts before creating new ones:

- `ops/paperclip/playbooks/city-launch-<city-slug>.md`
- `ops/paperclip/playbooks/city-demand-<city-slug>.md`
- `ops/paperclip/playbooks/city-opening-<city-slug>-send-ledger.md`
- `ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json`
- `ops/paperclip/playbooks/capturer-supply-playbook.md`
- `ops/paperclip/playbooks/robot-team-demand-playbook.md`
- generated buyer-loop, daily review, coverage, or city-launch reports when those scripts apply

Do not create a parallel growth CRM, contact database, or marketing stack.

## Commands

Use these commands when the relevant artifact exists:

```bash
npm run gtm:hosted-review:audit
npm run gtm:hosted-review:daily -- --write --allow-blocked
npm run gtm:hosted-review:buyer-loop -- --write --allow-blocked
npm run gtm:enrichment:run -- --write
npm run city-launch:coverage:audit -- --city "<City, ST>"
npm run city-launch:coverage:plan -- --city "<City, ST>"
npm run city-launch:coverage:run -- --city "<City, ST>"
npm run city-launch:activate -- --city "<City, ST>" --founder-approved
```

If a command cannot run because credentials, ledgers, or live provider state are missing, record the exact missing input and keep reversible draft/onboarding work moving.

## Hard Gates

Do not claim the city has an active user base from:

- a city plan
- an internal report
- generated content
- a target list without recipient-backed contacts
- a draft without approval/send state
- signup interest without structured-intake or onboarding follow-through
- capturer volume without quality, first-capture, or repeat-readiness evidence
- buyer interest without proof artifact, hosted-review start, exact-site request, qualified call, or capture ask

Live sends, public posting, paid acquisition, pricing, rights/privacy exceptions, and non-standard commercialization commitments remain human-gated.

## Done Condition

A new-city growth run is done only when the closeout names:

- the focus city
- the selected track
- the active ICP
- what changed in the target/contact/intake/onboarding/proof ledger
- the next owner and next action
- the first hard blocker, if any
- whether the decision is continue, change, stop, or still within the first 14-day window
