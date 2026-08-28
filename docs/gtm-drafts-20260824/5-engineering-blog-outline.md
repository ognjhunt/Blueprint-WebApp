# Engineering Blog + Demo Assets — outline DRAFT

**Working title:** *"Seventy-nine sealed runs to one grasp: debugging physics with
receipts."*

**Audience:** robotics/simulation engineers — the people who will evaluate us as vendors,
join us, or send us their robot team's candidates. The post sells *discipline*, not
results.

**Publication gate (do first, not last):** methods-and-mechanisms only, on the public
rehearsal scene; verify against the ADP claim boundaries (evidence-ladder doc) and the
public-scene dataset licenses before using any rendered imagery publicly; nothing that
elevates `development_only` evidence into a performance claim; no partner references. A
failed run is presented as evidence discipline (that framing is doctrine, and it is also
the most credible thing in the post).

---

## Outline

1. **The setup.** One fixed arm, one washer door, a sealed 11-phase scripted plan, and a
   rule that makes this post possible: every fix must land as code with a hermetic test,
   and every run seals its receipts — actions, states, torques, frames — whether it
   passes or fails. No hand-edits, no retries that overwrite evidence.

2. **The plateau.** Twenty-plus runs converging to the same ~15 mm miss under four
   different controllers. The lesson that opens the post: *when every controller fails
   identically, stop debugging controllers.*

3. **Layer one: the actuator was saturated the whole time.** Stiffness 400 against a
   12 N·m wrist limit clips at 0.03 rad; plans commanded 0.2. The torque telemetry had
   been in every receipt from the start — the fix was reading it. (Chart: effort
   utilization pinned at 1.000.)

4. **Layer two: the gauges lied.** The camera gate that passed on 90%-black frames;
   receipts asserting things nobody measured. The decorative-gate test we now apply to
   every gate: *what would this report if the thing it describes were entirely absent?*

5. **Layer three: the hand's model of itself.** A constant 13.556 mm open-vs-closed TCP
   frame offset — FK said the fingers were somewhere they weren't. Found by an A/B that
   ran both controllers reset-isolated inside one paid run. (Chart: the dead-flat
   30-attempt ladder, 40-micron spread.)

6. **Layer four: the authored point was a surface, the controller wanted a TCP.** The
   grasp target sat on the rim surface while the runtime graded the pad midpoint against
   it; the shipped pad geometry independently derives an 11.0 mm support offset — the
   measured residual was 11.65 mm. Geometry bugs masquerade as control bugs when they're
   constant.

7. **De-serializing discovery.** The reset-isolated downstream matrix: 134 configurations
   across the remaining phases measured inside one run, so one hard phase stops
   serializing everything behind it. Cost math: warm worker, ~17-minute cycles, cents per
   hypothesis.

8. **What this buys a customer.** The same receipts that debugged the grasp are the
   product: sealed decisions, margins with intervals, and gates that cannot pass on
   absent evidence. (One paragraph, no sales voice — the mechanism *is* the pitch.)

9. **Epilogue — honesty clause.** Where the campaign stands at publication time, stated
   exactly, including anything still unresolved. Per doctrine: a wrong or unfinished
   result is evidence, and it stays visible.

---

## Demo shot list (from already-sealed run artifacts)

| Asset | Source | Use |
|---|---|---|
| External-camera video: Franka at the washer inside the reconstructed room | C73+ run media (site now visibly renders) | Hero visual — "your site, in sim, with a real arm" |
| Wrist-camera terminal frame pressed against the door rim | C73 terminal observation | The "physics is real here" frame |
| 30-attempt ladder plot, error vs attempt (flat at 14.17 mm) | C73 episode receipt | The constant-error signature |
| Torque-utilization channel pinned at 1.000 | C30-era receipts | Layer-one chart |
| Downstream matrix table: per-phase cells / gate-passes / best error | C74 sealed matrix | De-serialization section |
| Screening-margin table mock (already on the site) | publicSiteCopy schematic data | Bridge to the product |

**Rights check before any public use of rendered imagery:** the rehearsal scene derives
from rights-admitted public datasets; re-publication of derived renders is a separate
question from internal use — confirm against the recorded dataset licenses first.

## Distribution

Personal + company blog, cross-post to the robotics/sim communities where this genre
travels; the post doubles as outreach collateral for integrator conversations (Draft 1)
and as the "how we work" link in design-partner emails.
