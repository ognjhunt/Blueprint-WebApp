# Growth Lead Program

## Mission
Run a smaller growth control surface that keeps the founder out of routine city, referral, and channel approvals.

Growth Lead owns prioritization across the active core only. Everything else stays paused or event-driven until evidence justifies restart.

Within approved policy, Growth Lead is the human operator lane for:
- channel posture and source policy
- referral mechanics inside written guardrails
- invite/access-code distribution posture for Austin and San Francisco alongside Ops Lead

Founder escalation from Growth Lead is reserved for:
- city launch / no-launch or gated-versus-expand decisions
- new spend envelopes
- public claims or posture shifts that change company-level positioning
- policy changes that affect trust, legality, or irreversible external commitments

## Active Core
- `analytics-agent`
  KPI contract owner across Firestore, Stripe, PostHog/GA4, and Paperclip.
- `conversion-agent`
  Measurement-backed WebApp funnel work only.
- `market-intel-agent`
  Weekly external market and competitor signal synthesis.
- `demand-intel-agent`
  Weekly technical-buyer demand research tied to exact-site hosted review.
- `city-demand-agent`
  One city-planning loop only, using the current city playbooks as internal planning documents.

## Paused By Default
- `metrics-reporter`
- `community-updates-agent`
- `workspace-digest-publisher`
- `supply-intel-agent`
- `capturer-growth-agent`
- `city-launch-agent`
- `robot-team-growth-agent`
- `site-operator-partnership-agent`

## Event-Driven Or Manual-Only
- `outbound-sales-agent`
  Wake only when demand or market work produces a named prospecting angle with real product proof.
- ship-broadcast and content-feedback refresh loops
  Wake only when there is a real shipped artifact worth approval review.
- any paused lane above
  Wake only when Growth Lead opens a concrete Paperclip issue with a reason the core cannot absorb.

Image-heavy execution rule:
- when a growth issue needs generated imagery, landing-page comps, social cards, thumbnails, hero visuals, or other image-heavy assets, Growth Lead must create or update a concrete downstream issue for `webapp-codex`
- use `ops/paperclip/blueprint-company/tasks/webapp-creative-image-execution/TASK.md` as the default downstream definition
- the downstream issue must carry the brief, proof links, allowed claims, blocked claims, and target asset placement instead of leaving the handoff implicit in comments

Focused-city activation exception:
- after founder approval of the bounded launch posture for the current focus city, Growth Lead may wake `supply-intel-agent`, `capturer-growth-agent`, `city-launch-agent`, `robot-team-growth-agent`, and `site-operator-partnership-agent` only through the city activation bundle in `ops/paperclip/programs/city-launch-activation-program.md`
- the exception is scoped to the current focus city only and does not reopen the broader city tree

Exact-Site Hosted Review GTM pilot exception:
- Growth Lead may run the 14-day pilot defined in `docs/exact-site-hosted-review-gtm-pilot-2026-04-26.md` and `ops/paperclip/programs/exact-site-hosted-review-gtm-pilot-program.md`
- the pilot may wake `demand-intel-agent`, `robot-team-growth-agent`, `city-demand-agent`, and `site-operator-partnership-agent` only for targets recorded in `ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json`
- every outbound-ready target must pass `npm run gtm:hosted-review:audit` before Growth Lead reports it as ready
- every daily pilot pass must run `npm run gtm:hosted-review:daily -- --write --allow-blocked`
- every buyer-loop pass must run `npm run gtm:hosted-review:buyer-loop -- --write --allow-blocked` and use that report as the sales status page
- founder review should be limited to first-batch recipient-backed draft approval, trusted contact supply, qualified calls, and irreversible exceptions
- live sends, public posts, paid spend, and commercial or rights/privacy commitments remain human-gated
- city launches must carry the exact-site buyer-loop artifact alongside the city-opening send ledger and execution report
- after 100 recipient-backed touches or day 14, Growth Lead must record a continue/change/stop decision instead of extending the same motion by default
- the exception ends after the 14-day closeout unless Growth Lead records ledger evidence that justifies a narrower next run

New-city user-base growth exception:
- when the objective is to grow from scratch in one new city, Growth Lead must run the loop in `ops/paperclip/programs/new-city-user-base-growth-program.md`
- this exception may wake `city-launch-agent`, `capturer-growth-agent`, `robot-team-growth-agent`, `demand-intel-agent`, `city-demand-agent`, `conversion-agent`, and `intake-agent` only for the named focus city and selected track
- every run must name the first ICP, proof motion, CTA/intake path, owner for onboarding follow-through, and the stop/change threshold before calling the city active
- city growth status must be based on user-motion fields such as recipient-backed contact, approved draft, sent touch, reply, structured intake, approved capturer, capture ask, hosted-review start, qualified call, completed capture, blocker, or decision
- do not treat a city plan, generated content, target list, or signup interest as an active user base unless it reaches the structured intake, proof, reply, hosted-review, or capture evidence named in the program

## Operating Rule
Before starting or restarting any paused lane, Growth Lead must answer:
1. What live decision or revenue path does this lane unblock now?
2. Why can the active core not absorb it?
3. What routine or issue will be paused in exchange so the tree does not sprawl again?

If those three answers are not concrete, keep the lane paused.

## City Planning Rule
- keep only one standing city-planning loop active: `city-demand-agent`
- city plans remain internal scorecards, not public launch claims
- city work must stay subordinate to proof-path truth, instrumentation truth, and hosted-review readiness
- city plans must name the split between founder-only, human operator-owned, agent-prepared, and exception-only work
- routine Austin/SF referral, invite, and source-policy execution should route to Growth Lead and Ops Lead inside approved guardrails, not to the founder

## Priority Order
1. analytics integrity
2. conversion changes grounded in live measurement
3. Exact-Site Hosted Review buyer loop: targets, contacts, approvals, sends, replies, calls, hosted-review starts, and blockers
4. one new-city user-base growth loop when a focus city is explicitly opened
5. market and demand intelligence that sharpens the current wedge
6. one city loop that exposes blockers clearly
7. everything else only when triggered by evidence
