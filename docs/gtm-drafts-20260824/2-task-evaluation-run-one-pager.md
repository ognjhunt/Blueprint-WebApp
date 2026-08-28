# The Task Evaluation Run — one-pager DRAFT (external-safe except the marked appendix)

*Blueprint sells one service. This page is it.*

---

## The problem it removes

Robot pilots fail in month 3 for reasons that were knowable in month 0: the candidate
never fit the building, or the two finalists were never separable on that task in the
first place. The homework — measuring the site, ruling out what can't work, and putting a
margin on what might — usually happens *after* people and hardware are already onsite.

**The robot should arrive after the homework is done.**

## What it is

One real workflow at your site, captured once, rebuilt as a secure site-specific testbed,
and used to test candidate fit **before** anyone ships hardware:

1. **Screening — ruled out by measurement.** Reach, clearance, footprint, and sightlines
   are computed from the capture itself against each candidate's published envelope. A
   screening verdict names its cause and carries its tolerance: *"misses the opening by
   18 cm ± 2 cm."* No policy, no rollouts, no simulation trust required.
2. **Ranking — with its margin.** Surviving candidates run the same task under the same
   conditions on the testbed. Every ranking ships with the gap between candidates, the
   95% interval on that gap, and the smallest gap the design can resolve at all. When two
   candidates sit inside that resolution floor, the run says so — that is a measurement
   fact about the decision, not a hedge.
3. **A benchmark for this site.** The testbed is versioned and digest-pinned. Re-running a
   new candidate later is a re-run against the same fixed conditions, not a new project.

## What you bring

- One specific task at one station: what counts as success, what must never happen.
- The candidates genuinely on your table (yours, your vendor's, or your integrator's).
- One capture visit's worth of site access.

## What you receive

- The screening table with measured margins and tolerances, per candidate.
- The ranking with success rates, intervals, the gap, and the design's resolution floor.
- The identified failure boundary: the condition region where the leading candidate stops
  working.
- The versioned site testbed, hosted — your later re-runs are against the same benchmark.

## What you never do

Choose a simulator, world model, or compute provider. You describe the decision; the
method is our job.

## Boundaries (read these — they are the product's spine)

- Virtual evidence is never a physical or safety guarantee. Onsite validation is still
  required, and the run is designed to make that validation *smaller and better aimed*,
  not to replace it.
- A run can conclude the design cannot separate your candidates at the evidence
  available — reported as a resolution fact with what it would take to separate them.
- Results are specific to your site, task, robot, candidates, and conditions. We do not
  claim cross-site transfer, deployment readiness, or a general leaderboard.
- Site files are hosted, not downloadable; capture consent and takedown rights sit with
  you throughout (see the data-handling one-pager).

## Turnaround and price

- Turnaround **target** from capture to report: measured in days, with 12–24h as the
  design target we are engineering toward — stated as a target, not a service level.
- Pricing is scoped per run on a short call — one service, no tiers, no add-ons.

*Design partners for the first sealed runs receive discounted terms in exchange for a
short randomized physical trial of the same task afterward — the adjudication that turns
"our answer" into "our verified answer." Joint publication only with your signoff.*

---

## INTERNAL APPENDIX — pricing hypothesis (never publish; founder-only)

Anchors to test in scoping conversations, not to quote from:

- **Value anchor:** a failed or misaimed physical pilot costs the site owner weeks of
  calendar and five to six figures (integrator time, line disruption, travel). Question 6
  in the partner-conversation guide gets each prospect's real number — collect these; the
  distribution *is* the pricing study.
- **Cost floor:** one run ≈ capture visit + reconstruction + testbed build + evaluation
  compute (current GPU economics are trivially small: warm evaluation runs cost cents;
  the cost is skilled time). Target gross margin should assume heavy automation holds.
- **Working hypotheses to A/B in conversations (not quotes):**
  - Design-partner run: heavily discounted flat fee (e.g., low four figures) + the
    physical-trial commitment + publication option — priced to remove friction, paid to
    ensure skin in the game.
  - Standard run (post-proof): per-run flat fee in the low-to-mid five figures for
    capture → screening → ranking → report; re-runs of new candidates on the existing
    testbed priced an order of magnitude lower — this is where the benchmark's margin
    lives and what makes the testbed durable revenue.
  - Robot-team side (Pilot Opportunity Network): access/evaluation-request pricing per
    the deployment-network pricing already landing in the webapp (#461) — keep the two
    sides' pricing coherent so an integrator paying on one side isn't double-charged on
    the other.
- **Rule from the site copy that binds sales too:** no published fixed price; every
  number above is a hypothesis until three prospects react to it.
