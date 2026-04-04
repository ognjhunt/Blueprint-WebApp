# Robot Team Demand Playbook

Status: internal operating proposal only. Do not treat this as approved public-facing execution.

## Objective

Turn Blueprint's current buyer-facing product truth into a reusable robot-team demand system that city plans, conversion work, intake routing, and ops handling can inherit without re-solving the same exact-site buyer questions.

This playbook is grounded in:

- [BLU-142](/BLU/issues/BLU-142) for the baseline weekly synthesis
- `ops/paperclip/programs/robot-team-growth-agent-program.md` for current-cycle focus
- current buyer surfaces in this repo: `/world-models`, `/proof`, hosted-session setup/workspace, and sample deliverables

## Operating Rules

- Keep Blueprint capture-first and world-model-product-first.
- Anchor every buyer claim to real capture, exact-site packaging, hosted-session contracts, or clearly labeled future work.
- Do not imply that a hosted session or site package replaces final on-site validation, safety review, or deployment signoff.
- Do not center qualification or readiness unless the buyer explicitly needs those support layers.
- Keep pricing, contract, refund, and procurement language human-gated.
- Keep city-specific demand choices with `city-demand-agent`; this document stays generic.

## ICP Matrix

| Segment | Core job | Current posture | Why now | Main blocker |
| --- | --- | --- | --- | --- |
| Applied robotics team evaluating one customer site | Inspect the exact site before travel or deployment work | Primary ICP | Best fit for site package plus hosted session framing | Needs precise proof of what is already packaged |
| Robot platform team comparing policies or backends on one real facility | Re-run one site across checkpoints, tasks, or robot profiles | Primary ICP | Maps directly to hosted evaluation and export language | Needs trusted runtime and export expectations |
| Data / simulation team grounding its own stack to one customer facility | Bring real capture, geometry, and metadata into the team's own world-model workflow | Primary ICP | Strong fit for site package deliverables | Needs a legible package manifest and provenance story |
| Enterprise robotics buyer exploring multiple future sites | Compare opportunities before exact-site commitment | Secondary ICP | Can enter through proof and sample deliverables | Too abstract until an exact site is named |
| Site operator or commercialization stakeholder | Approve rights, access, and commercialization boundaries | Support stakeholder, not primary demand owner | Important for rights and revenue handling | Can distract from the core robot-team buyer story if centered too early |

## Message Hierarchy

1. Start with one real site.
   A buyer should immediately understand that Blueprint is about exact-site world models built from real indoor capture, not generic simulation copy.

2. Show the two product paths clearly.
   Site package for teams using their own stack. Hosted evaluation for teams that want Blueprint to run the exact site and export results.

3. Make proof legible before asking for commitment.
   Public proof, sample deliverables, listing-level package details, and hosted-session setup should answer "what is real here?" before a sales conversation has to.

4. Keep provenance, rights, and privacy attached to the product.
   These are part of the buyer contract and trust story, not legal fine print that appears later.

5. Position qualification and readiness as optional support.
   Use them when a buyer needs extra deployment confidence, not as the default headline.

## Proof Pack

### Available Now

- public proof hub at `/proof`
- proof reel and sample visuals in `proof-reel/`
- world-model catalog and listing detail flow at `/world-models`
- hosted-session setup and workspace flows for launchability, task choice, and runtime exploration
- sample deliverables and package framing for teams that want their own stack

### What The Proof Pack Must Communicate

- the site is real
- the workflow lane is specific
- what comes in the site package
- what the hosted path does and does not do
- what outputs the buyer gets back
- what rights, privacy, provenance, and commercialization limits travel with the product

### Still Missing Or Weak

- a concise buyer-facing packet for procurement and commercial blockers
- explicit analytics coverage for proof -> listing -> request -> hosted-session funnel stages
- a current demand-intel synthesis of buyer objections, segment language, and proof requirements
- message-drift cleanup where repo copy still frames Blueprint as qualification-first

## Hosted-Session Demo System

The hosted-session demo should always reinforce the same site-grounded story:

1. public proof confirms the site and workflow are real
2. listing page makes the package path and hosted path legible
3. hosted-session setup confirms robot, task, and launch readiness for one exact site
4. hosted workspace lets the buyer inspect the canonical package, runtime path, and exports on that same site

Do not let the hosted demo become a generic model showcase. It exists to make one exact-site runtime path inspectable.

## Buyer Funnel

| Stage | Buyer question | Current surface | Success condition | Owning lane |
| --- | --- | --- | --- | --- |
| Proof | Is this a real site and a real workflow? | `/proof`, home, robot-integrator copy | Buyer reaches a listing or request path | `conversion-agent` |
| Listing | What exactly do I get for this site? | `/world-models`, listing detail, sample deliverables | Buyer distinguishes package versus hosted path | `conversion-agent` |
| Request | Can Blueprint handle my robot, task, and site? | hosted-evaluation contact flow | Submission includes the minimum technical context | `intake-agent` |
| Scoping | Is the request commercially and operationally workable? | human review plus inbound routing | Buyer receives the right next step without false promises | `ops-lead` + `finance-support-agent` |
| Hosted launch | Can this site actually run now? | hosted-session setup | launch readiness is truthful and blockers are explicit | `ops-lead` |
| Evaluation | What did the run produce? | hosted-session workspace and exports | buyer can inspect outputs tied to the same site | `ops-lead` + product surfaces |
| Localization | Which city or corridor should this motion target next? | downstream city demand work | generic playbook becomes city-specific without rewriting the core story | `city-demand-agent` |

## Downstream Queue

- `conversion-agent`: propose an internal copy-drift audit and message test plan for robot-team buyer pages, with special attention to qualification-first language conflicts.
- `analytics-agent`: define the robot-team buyer funnel event schema from proof through hosted-session workspace and export.
- `intake-agent`: propose required fields and routing logic for robot-team hosted-evaluation requests.
- `ops-lead`: confirm the human review path, owner handoffs, and blocker handling across request -> scoping -> hosted launch.
- `finance-support-agent`: draft the human-gated commercial blocker packet covering hosted-session pricing questions, invoicing expectations, rights/privacy questions, and export/support boundaries.
- `city-demand-agent`: localize the generic system into one city demand plan only after the generic motion is approved.
- `demand-intel-agent`: produce the next-cycle external demand synthesis because there is no current robot-team demand artifact in Paperclip.

## Readiness Call

Ready now:

- internal robot-team message hierarchy
- proof-pack framing tied to current product surfaces
- hosted-session demo framing tied to one exact site
- issue-ready downstream execution work

Not ready:

- public-facing commitments based on unvalidated demand assumptions
- buyer claims about deployment outcomes, benchmark deltas, or named customer proof
- city-specific demand plans that skip the generic robot-team system

## Current Constraints

- No current demand-intel findings were available in Paperclip at the time of this baseline.
- The repo still contains copy that conflicts with current doctrine, including `client/public/llms-full.txt`.
- Finance and ops already have unrelated queues, so commercial and operational follow-ups should stay tightly scoped and human-gated.

