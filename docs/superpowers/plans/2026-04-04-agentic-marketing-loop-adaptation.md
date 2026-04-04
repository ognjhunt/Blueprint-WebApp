# Agentic Marketing Loop Adaptation Plan

**Date:** 2026-04-04  
**Status:** Proposed  
**Scope:** Adapt the "skills + routines + feedback loop" Paperclip marketing pattern into Blueprint's existing Hermes/Paperclip autonomous org without breaking capture-first, world-model-product-first doctrine.

## Recommendation

Adopt the structure, not the stack.

The external pattern is directionally good because it gets three things right:

1. agent capabilities are explicit
2. recurring routines turn capabilities into output
3. feedback is attached to concrete work items so the next cycle can improve

But a direct clone would be a bad fit for Blueprint.

Blueprint is not a broad consumer content engine, and its current wedge is not "trend content at volume." The current wedge is **Exact-Site Hosted Review** built on truthful capture, packaging, provenance, rights, and one real site / one workflow question / one concrete next step.

So the right move is:

- keep Paperclip as the execution record
- keep Hermes as the persistent research/manager runtime
- keep Notion as the durable artifact and review surface
- adapt the loop around **buyer-demand proof content**, **ship communication**, and **search/discovery documentation**
- reject any tactics that reward hype, fake urgency, fake traction, or commodity social volume

## What Already Exists

Blueprint already has most of the infrastructure that the external example is trying to assemble:

- `AUTONOMOUS_ORG.md`: established Paperclip/Hermes org, issue-driven routing, specialist agents, and human gates
- `ops/paperclip/BLUEPRINT_AUTOMATION.md`: plugin tools, webhook intake, deterministic reporting, Notion writes, Slack mirroring, and manager-state tooling
- `ops/paperclip/blueprint-company/tasks/community-updates-weekly/TASK.md`: weekly draft-only community publishing loop
- `ops/paperclip/blueprint-company/tasks/market-intel-daily/TASK.md` and `ops/paperclip/blueprint-company/tasks/demand-intel-daily/TASK.md`: recurring signal collection loops
- `ops/paperclip/blueprint-company/tasks/robot-team-growth-weekly/TASK.md`: buyer-playbook synthesis loop
- `server/utils/autonomous-growth.ts`: research-to-outbound draft generation
- `server/utils/creative-factory.ts`: creative asset factory tied to experiment winners, research signals, and buyer objections
- `server/utils/experiment-ops.ts`: evaluation and winner selection for growth experiments
- `server/utils/growth-ops.ts`: draft campaigns, human approval gates, lifecycle/retention outreach
- `server/utils/opsAutomationScheduler.ts`: always-on worker scheduling for buyer lifecycle, creative factory, outbound research, and experiments

This means Blueprint does **not** need a fresh marketing operating system.

It needs a tighter content/feedback layer on top of the current one.

## What The External Approach Would Improve

### 1. Stronger unit-of-work memory

The smartest part of the external pattern is not trend scanning or posting. It is the rule that every artifact gets tracked and reviewed as a durable work item.

Blueprint already uses Paperclip issues well, but the current growth loops are more:

- report-centric
- playbook-centric
- campaign-centric

and less:

- asset-centric
- outcome-review-centric

That is the main gap worth fixing.

### 2. Tighter ship-to-distribution loop

Blueprint has weekly community updates and daily/weekly research loops, but it does not yet appear to have a strong **ship event -> draft distribution asset -> review -> publish -> measure -> learn** loop tied to GitHub/webapp shipment events.

### 3. Better closed-loop creative learning

The creative factory already reads:

- latest research run
- experiment rollouts
- recent buyer objections

That is good.

The missing piece is structured post-distribution outcome review that gets attached to the originating content issue and then summarized back into reusable playbooks/creative inputs.

## What Should Not Be Copied

### 1. TikTok-trend-first content as the core growth loop

For Blueprint, that would likely be a distraction.

The correct discovery surfaces are more likely:

- robotics communities
- operator and deployment conversations
- buyer objections from inbound and hosted review flows
- search intent around exact-site review, digital twins, capture-backed simulation, deployment proof, and facility-specific robotics workflows
- ship updates that sharpen trust and proof

Not generic consumer trend velocity.

### 2. Single-agent "marketing brain"

Blueprint already has a better structure:

- `blueprint-chief-of-staff` for continuous orchestration
- `growth-lead` for prioritization
- `market-intel-agent` and `demand-intel-agent` for input collection
- `robot-team-growth-agent` for buyer playbook updates
- `community-updates-agent` for publishing drafts
- `conversion-agent` and `analytics-agent` for measurement and experiments

Do not collapse that into one social-media operator.

### 3. Auto-publishing across channels without strong truth gates

Blueprint's doctrine requires:

- no fake traction
- no unsupported capability claims
- no fake providers or fake supply
- no product framing that drifts into qualification-first or model-checkpoint-first narratives

So any public send/publish path must stay draft-first with explicit approval on public channels until the lane graduates.

## Customized Blueprint Version

Blueprint should implement a three-loop adaptation:

### Loop A: Demand Content Loop

Purpose:

- turn demand/market signals plus buyer objections into proof-oriented content drafts and creative assets

Inputs:

- `market-intel-agent`
- `demand-intel-agent`
- buyer objections from `contactRequests`
- hosted-review and proof-path friction
- experiment winners
- recent creative factory outputs

Outputs:

- campaign briefs
- one issue per meaningful public asset or campaign
- draft landing-page creative
- draft email/social/blog cutdowns

Owner stack:

- `growth-lead` prioritizes
- `robot-team-growth-agent` defines the message/proof structure
- `community-updates-agent` or a new `content-seo-agent` drafts distribution artifacts
- `analytics-agent` tracks outcome quality

### Loop B: Ship Broadcast Loop

Purpose:

- convert real shipped work into truthful distribution artifacts fast

Inputs:

- GitHub merge/deploy signals
- Paperclip issue closures
- closed engineering/review issues with proof

Outputs:

- product update draft
- newsletter draft
- internal Slack digest
- optional external social draft

Owner stack:

- trigger enters through the Blueprint Paperclip plugin
- `community-updates-agent` drafts the artifact
- `growth-lead` checks channel priority
- human approves public send

This is the closest Blueprint match to the external "retention on commit" loop.

### Loop C: Search / Discovery Documentation Loop

Purpose:

- convert shipped work plus research into search-oriented, proof-backed long-form content

Inputs:

- ship events
- recurring market/demand intel
- reusable KB pages
- buyer objections and proof-pack questions

Outputs:

- long-form exact-site articles
- FAQ / explainer pages
- comparison pages
- documentation/blog drafts for a CMS

Owner stack:

- `robot-team-growth-agent` supplies the positioning and proof architecture
- a new `content-seo-agent` or extended `community-updates-agent` drafts the article
- `truthful-quality-gate` verifies claims
- human approves publication

## Core Design Decision: The Unit Of Learning

Do **not** use "one issue per video" exactly as written in the external example.

For Blueprint, the better unit is:

- one issue per meaningful content asset
- or one issue per tightly related asset bundle/campaign

Examples:

- one issue for a hosted-review explainer article + its companion email draft
- one issue for a buyer-objection creative reel and its landing-page variant
- one issue for a shipped-feature update package across newsletter + social + blog

Reason:

- Blueprint volume is lower and stakes are higher
- each asset carries doctrine/truth risk
- feedback quality matters more than raw content count

## New Operating Objects

Add a lightweight content-ops layer with four explicit objects:

### 1. Content Brief

Stored in Notion and linked from Paperclip.

Fields:

- wedge
- audience
- channel
- source evidence
- proof links
- allowed claims
- blocked claims
- CTA
- owner

### 2. Content Asset Issue

Paperclip issue representing the asset lifecycle.

Fields:

- originating brief
- asset type
- channel
- status
- draft links
- approval state
- distribution state
- feedback summary

### 3. Distribution Event

Stored in Firestore and/or the campaign tables already used by growth ops.

Fields:

- channel
- published or draft
- send time
- creative context
- experiment variant
- linked asset issue

### 4. Outcome Review

Structured follow-up attached to the asset issue and summarized to Notion/Hermes KB.

Fields:

- what worked
- what did not
- confidence
- evidence source
- next recommendation
- whether the lesson should update a playbook, prompt, or experiment

## Recommended Repo Changes

### Phase 1: Create the content-ops contract

Add a spec and shared schemas for:

- content brief
- content asset issue metadata
- outcome review
- channel result summary

Suggested locations:

- `docs/superpowers/specs/`
- `server/utils/`
- `ops/paperclip/plugins/blueprint-automation/src/`

### Phase 2: Add a ship-event publishing lane

Extend the Blueprint Paperclip plugin so GitHub merge/deploy events can:

1. identify shippable user-facing changes
2. create or update a "ship broadcast" Paperclip issue
3. hand the issue to `community-updates-agent`
4. generate draft artifacts in Notion and the current email/send path
5. optionally create social-draft records

Do not auto-send at first.

### Phase 3: Add a dedicated SEO/content drafting lane

Create either:

- a new `content-seo-agent`

or:

- expand `community-updates-agent` with a separate weekly/ship-triggered SEO routine

Recommendation:

- start by extending `community-updates-agent`
- split into `content-seo-agent` only after the lane proves high enough volume

### Phase 4: Add structured feedback ingestion

Create a feedback path where:

- campaign metrics
- manual operator comments
- buyer replies
- experiment outcomes
- objection patterns

can be attached back to the originating content issue and summarized into:

- playbook updates
- creative-factory inputs
- channel recommendations

### Phase 5: Route lessons into the right canonical stores

Use this rule:

- Paperclip = execution record
- Notion = durable artifact/review surface
- Hermes KB = reusable synthesized knowledge
- Firestore = operational metrics/events

Never let Hermes memory or a Slack thread become the only place a learning exists.

## Recommended Agent/Routine Changes

### Reuse existing agents first

Do not add a large new department.

Start with:

- `growth-lead`
- `community-updates-agent`
- `market-intel-agent`
- `demand-intel-agent`
- `robot-team-growth-agent`
- `analytics-agent`
- `conversion-agent`
- `blueprint-chief-of-staff`

### Add only two new routines initially

#### 1. `ship-broadcast-refresh`

Trigger:

- GitHub merge/deploy event

Behavior:

- create/update one Paperclip issue for the ship broadcast package
- draft newsletter/update/social artifacts
- require human approval before public send

#### 2. `content-feedback-refresh`

Trigger:

- daily or every 6 hours

Behavior:

- inspect distributed assets and campaign results
- attach structured review notes to the linked asset issues
- open follow-up work for growth/creative/SEO only when a real learning exists

### Keep existing routines

Keep:

- `community-updates-weekly`
- `market-intel-*`
- `demand-intel-*`
- `robot-team-growth-*`
- experiment autorollout
- creative asset factory
- buyer lifecycle

But connect them more tightly through issue links and shared content briefs.

## Suggested Integrations

### Immediate

- GitHub webhook -> Paperclip issue creation/update
- existing SendGrid delivery and event flow
- existing creative factory and experiment logs

### Near-term

- CMS draft adapter for blog/SEO publishing
- social draft adapter for selected channels only

### Defer

- TikTok/Reels trend automation
- auto-publishing to many channels
- high-volume short-form content
- any channel with weak attribution or weak buyer fit

## Channel Strategy For Blueprint

Default channel priority should be:

1. website / landing pages
2. blog / documentation / explainers
3. newsletter
4. LinkedIn / X draft-only distribution
5. direct buyer outreach support

Do not prioritize TikTok-style trend loops unless real evidence says Blueprint's current buyer wedge is actually moved by them.

## Success Metrics

Measure the adapted system on:

1. time from shipped work to draft distribution artifact
2. percentage of public assets linked to a Paperclip issue and evidence-backed brief
3. percentage of assets with a structured outcome review
4. increase in qualified buyer conversations, not just impressions
5. improvement in objection handling on exact-site hosted-review motions
6. reduction in repeated copy/positioning mistakes across weeks

Avoid vanity metrics as the primary success test.

## Phased Rollout

### Phase 1: Draft-only, internal

- ship-event broadcast issues
- draft newsletter/update assets
- no auto-publish
- manual outcome reviews

### Phase 2: Draft-first, selected external channels

- website/blog/newsletter drafts
- human approval on all public sends
- structured feedback captured every cycle

### Phase 3: Graduated semi-autonomy

- routine low-risk sends can be approved through narrower human gates
- channel-specific playbooks become reusable
- content-feedback loop updates prompts/playbooks automatically, but not public sends

## Final Decision

This approach is worth adopting **as a Blueprint-native adaptation**.

It would improve the current system if and only if Blueprint does these three things:

1. use Paperclip issues as the asset-level memory and feedback unit
2. tie ship events and campaign outcomes back into the existing growth and creative loops
3. keep all content truth-bound to exact-site, provenance-grounded product reality

It should **not** be adopted as:

- a generic trend-chasing social factory
- a one-agent marketing brain
- a multi-channel auto-posting system optimized for volume over truth

## Immediate Implementation Order

1. Add a repo spec for content briefs, content asset issues, and outcome reviews.
2. Add a GitHub-triggered `ship-broadcast-refresh` routine through the Blueprint plugin.
3. Extend `community-updates-agent` to draft ship-triggered artifacts, not just weekly recaps.
4. Add structured outcome-review storage linked to the originating Paperclip issue.
5. Feed those reviews into `robot-team-growth-agent`, `growth-lead`, `creative-factory`, and experiment selection.
6. Only after the above works, add CMS/social adapters for selected channels.
