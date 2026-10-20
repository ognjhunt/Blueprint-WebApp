# Site readiness report: an expert's first read of a site's job

Status: approved by the founder on 2026-10-20 ("do all of these and implement
in full"). It builds on robot fit (`2026-10-20-robot-fit-design.md`).

## Why

A site that has never bought a robot has questions it does not know to ask:
will it work here, what has to change, is it worth it, is it safe, what could go
wrong, what next, and how to convince someone else. An integrator answers them on
day one. This report answers them from the site's own numbers, so Blueprint reads
as the expert that knows what it takes.

## What the owner's job page shows

Always, for the owner, once footage has arrived (the layout with the measurements step):

1. **Steps to a pilot.** A tracker:
   - Video received; job brief confirmed; measurements, n of 6 key readings; how the job runs today; success target; access window.
   - Blueprint's steps: the site rebuilt in 3D, robot teams evaluate, one team recommended, pilot booked.
   - One line on what Blueprint is doing meanwhile, only from real states: a rebuild in progress, a recommendation on file, or a booking.
2. **Your next three things.** The three most useful missing facts, in priority order. Each says why it matters and opens the step on the page where it is answered.
3. **How the job runs today.** One small optional form: how many times a day the job is done, on how many days a week, and whether people work near it. It is stored apart from the digest-bound brief, in `siteTaskOperations/{requestId}`.
4. **What this job takes today.** Its own numbers only:
   - Workload: times a day × the time per cycle measured from its video (`site_video_evidence.measured_cycle_seconds`) gives person-hours a day, and a week when days are given.
   - Speed check: that measured pace against its target time per cycle.
   - No prices and no market figures.
5. **Your site, rebuilt.** The 3D scene already built from its video, front and centre, when it exists.

Once an admin shares it (the robot-fit sharing switch now shares the whole
report), the **robot readiness report**:

6. **What the job needs, and every form of robot rated** (robot fit).
7. **Getting your site ready.** A checklist matched to the forms that fit:
   - floor space at the station, from the measured clearance;
   - where a robot stands, or parks and charges;
   - power, and Wi-Fi for robots that move;
   - a safe working zone, from people nearby;
   - how objects arrive, from the confirmed screening answers.
8. **What decides success here.** Up to three things that make this job hard, chosen by fixed triggers in this priority order:
   - speed shortfall;
   - item variety;
   - placement drift;
   - shiny or see-through packaging;
   - jams and damage;
   - tight space;
   - a large or heavy object;
   - a high reliability target;
   - people.

   Each is paired with what the simulation tests, or says plainly that it is checked in the pilot instead.
9. **Safety in plain English.**
   - The robot team's risk assessment follows ISO 10218 (adopted in the US as ANSI/A3 R15.06), and ANSI/A3 R15.08 for robots that drive between spots. Standards for walking robots are still being written.
   - How robots work near people.
   - What Blueprint does not certify.
10. **Robots already do jobs like this.** Matching examples from the curated, sourced `deployedEnvironments`. They carry their status, evidence and sources, and the footnote that none is a Blueprint customer.

A **one-page robot readiness brief** (`/capture-upload/:token/brief`) prints or
saves as PDF everything above, for the person who has to convince someone else.

People nearby now comes from the site's answer in the new form, else its earlier
answers, else what the video shows (`people_relationship_to_work`: people working
in the space or passing nearby, labelled "seen in your video").

## Rules and copy

- Everything is deterministic: fixed sentences filled with the site's own data. No model call is added.
- Screening bands describe the job, never a robot's specification. The new ones are: open floor of at least 1.0 m in front of the starting surface is ready; 0.6–1.0 m is tight; under 0.4 m above the surface is tight.
- No team names, counts, prices or "match". Every answer is framed as a first read, not a promise.
- What the simulation tests is stated only where the evaluation contract tests it:
  - variation of the object's start position and turn, the light and the grip;
  - your fixtures in the rebuilt scene;
  - cycle time against your target;
  - your pass mark.

  Everything else says it is checked in the pilot.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `GET /api/site-task-brief/:token/readiness` | owner link | Tracker, next three things, how the job runs, workload, speed check, and the report while shared |
| `PUT /api/site-task-brief/:token/operations` | owner link | Save how the job runs today |
| `GET /api/admin/jobs/:requestId/robot-fit` | admin | Now also returns the full report preview |

Withdrawn consent closes the link routes, as before.

## Not in this change

- **Marking the pick and place spots in the 3D scene.** WebApp holds no scene
  coordinates; the Pipeline's task grounding would have to publish them.
- **A clip of a robot in the site's scene.** Rendering it is Pipeline work, and
  it must be labelled as an illustration, not an evaluation.
