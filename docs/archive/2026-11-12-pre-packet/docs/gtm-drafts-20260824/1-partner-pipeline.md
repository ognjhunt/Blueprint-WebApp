# Design-Partner Pipeline Plan — DRAFT for founder review

**Goal:** one signed design partner (plus 2–3 warm backups) ready the day the rehearsal
completes, so ADP-010 partner admission → ADP-020 protocol freeze → ADP-021 fresh capture
runs without a sourcing delay. Doctrine explicitly allows this now: *"Partner discovery and
protocol conversations may run in parallel as a small human lane."*

**Status note:** nothing in this doc claims the rehearsal is done. Every conversation uses
the claim boundaries at the bottom.

---

## 1. What a qualified partner is (from VISION.md, verbatim requirements)

A partner must be able to give Blueprint:

1. **One real fixed-arm workcell** — a specific arm at a specific station (not a mobile
   robot, not a humanoid, not a fleet).
2. **One rigid-object task** with definable success/failure ("open the door", "load the
   chuck", "place the tray") — the partner owns *task truth*.
3. **Two runnable candidates** — two policies or configurations genuinely under
   consideration (theirs, or their vendor's/integrator's). Two, not five.
4. **One capture day** — site access for a Raw V3.2 capture (clean-background pass +
   object-present pass).
5. **A physical holdout** — willingness to run randomized held-out physical trials of the
   same task and report outcomes honestly, including if the sealed decision was wrong.
6. **Rights signoff** — consent to capture, hosted-not-downloadable site files, takedown
   rights (our machinery already enforces all of this; Draft 4 is the customer-facing
   version).

Disqualifiers to screen out early: deformables-dominant tasks, no arm yet *and* no vendor
engaged (nothing to evaluate), site access requiring months of clearance, or a partner who
wants a "digital twin" deliverable (we do not sell one).

## 2. Segment ranking (fill the list to ~25 names total)

Ranked by: fixed-arm density × decision pain now × physical-trial feasibility × low rights
friction × one-day captureability.

| # | Segment | Why it fits | Where to find 5 names |
|---|---------|-------------|----------------------|
| 1 | **Appliance / durable-goods test & reliability labs** | Door/latch/lid cycling on rigid mechanisms is literally the rehearsal task class; labs already run counted physical trials, so the holdout is native to their culture | Appliance OEM test centers, UL/Intertek-style labs, warranty-test contractors |
| 2 | **CNC machine-tending job shops** | Fixed arms everywhere, tending decisions made shop-by-shop, integrator quotes in hand = a live two-candidate decision | A3/RIA integrator client lists, regional job-shop clusters, machine-tool dealers |
| 3 | **Packaging / kitting cells** | Rigid objects, high cell variance site-to-site, short pilots common | Co-packers, 3PL automation groups |
| 4 | **Lab automation (life sciences benches)** | Fixed arms, rigid labware, expensive pilot failures | Lab-automation integrators, pharma ops |
| 5 | **Electronics assembly / inspection cells** | Rigid trays and fixtures; fast decision cycles | EMS providers |

**The other side of the market — robot teams/OEMs/integrators.** The webapp already ships
the permissioned Pilot Opportunity Network (anonymized, claim-ceilinged opportunities;
`ForRobotTeams` page live). Every integrator conversation is therefore *also* supply
acquisition: they bring the two candidates and often bring the site. Target 5 integrators
alongside the 20 site owners.

## 3. The outreach angle (aligned to the locked public copy — do not improvise past it)

- Lead: **"Automate months 0–2 — the robot should arrive after the homework is done."**
- The screening hook is the opener, because it needs no sim-fidelity trust: *reach,
  clearance, footprint, and sightlines come off the capture itself — before a rollout is
  spent on a candidate the building will not take.* ("Misses the opening by 18 cm" is the
  demo line.)
- The ranking is the second beat: every ranking ships with its margin, its interval, and
  the smallest gap the design can separate.
- Vocabulary rules from the site copy: "candidate," not robot; "a benchmark for this
  site," never "our benchmark platform"; 12–24h turnaround is always **a target**; no
  published fixed price — pricing is a scoping conversation.

## 4. The design-partner ask (one paragraph, reusable in email)

> We're selecting one design partner for the first sealed Task Evaluation Run: you bring
> one real task at one station and the two candidates you're actually deciding between;
> we capture the cell in one visit, build the testbed, and commit to a selection (or a
> documented abstention) *before* any physical trial. Then you run a short randomized
> physical test of the same task, and we publish — jointly, only with your signoff —
> whether the sealed decision matched reality. Design-partner terms: heavily discounted
> run, veto over anything published, full takedown rights on the capture.

## 5. Protocol-research questions (each answer feeds the ADP-020 freeze)

1. What exactly counts as success on this task, and who is the authority when it's
   ambiguous? (task truth ownership)
2. What must never happen during a trial? (safety envelope, damage limits)
3. Who physically resets the cell between trials, and what does a reset include?
4. How many physical trials could you tolerate in a holdout — 10? 30? 100?
5. Which conditions actually vary day to day (parts, lighting, placement, operators)?
6. What does a failed pilot cost you today, in dollars and calendar time?
7. Which two candidates are genuinely on your table right now, and who controls them?
8. What in your facility can never appear in a capture (people, products, signage, IP)?
9. What access window is realistic for a capture day (hours, escorts, badging)?
10. If the run said "candidate B, and here is the failure boundary" — what would you do
    differently the following week? (the value question; VISION requires the partner to
    change or reduce its next physical-test allocation)

## 6. Funnel and cadence

- Week 1–2: build the 25-name list (20 site owners across segments 1–3, 5 integrators);
  draft the two-paragraph email off §3–§4.
- Weeks 2–5: 10 first conversations, using §5 as the agenda. Log every answer — the
  protocol conversations *are* ADP-020 research, not just sales.
- Target: 3 partners at "yes, pending terms" depth; 1 signed design-partner agreement
  (Draft 4's data-handling doc + a short terms letter) held ready for the moment the
  rehearsal completes.

## 7. Claim boundaries for every conversation (from VISION.md — non-negotiable)

- The proof, when it lands, establishes a useful prospective decision **for that exact
  partner, site, task, robot, candidates, and conditions** — never universal ranking,
  deployment readiness, safety, or cross-site transfer.
- A run may **abstain**; that is a designed outcome, not a failure of the service.
- A wrong sealed decision, if it happens, is retained as evidence — we do not market it
  away, and partners should hear that discipline as the reason to trust the number.
- Virtual evidence is never a physical or safety guarantee; onsite validation is still
  required.
