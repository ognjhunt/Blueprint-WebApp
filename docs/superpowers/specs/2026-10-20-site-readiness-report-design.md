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

Founder direction (2026-10-20): keep the UI as simple as possible, and show the
site exactly what it needs and no more. The panel sits above the measurements
step and appears for the owner once footage has arrived. It shows three things
by default.

1. **Your next steps.** Up to three missing facts, in priority order. Each says
   why it matters and opens the step on the page where it is answered. When
   nothing is missing, the panel says nothing is needed.
2. **One line on what Blueprint is doing**, only from a recorded state: a rebuild
   in progress, a recommendation on file, or a booking.
3. **Two short lines, once known:**
   - the hours the job takes, from the site's answers × the time per cycle
     measured from its video (`site_video_evidence.measured_cycle_seconds`);
   - once shared, the kinds of robot that fit.

Two sections stay folded until the site opens them:

- **How the job runs today (optional).** One small form: how many times a day
  the job is done, on how many days a week, and whether people work near it. It
  is stored apart from the digest-bound brief, in `siteTaskOperations/{requestId}`.
  Beside it sit what the hours rest on, and the speed check (today's measured
  pace against the target time per cycle). There are no prices and no market figures.
- **Your robot readiness report**, once an admin shares it (the robot-fit sharing
  switch shares the whole report):
  - **What the job needs, and every form of robot rated** (robot fit).
  - **Getting your site ready.** A checklist matched to the forms that fit: floor
    space at the station from the measured clearance; where a robot stands, or
    parks and charges; power, and Wi-Fi for robots that move; a safe working zone
    from people nearby; and how objects arrive, from the confirmed screening answers.
  - **What decides success here.** Up to three things, by fixed triggers in this
    order: speed shortfall, item variety, placement drift, shiny or see-through
    packaging, jams and damage, tight space, a large or heavy object, a high
    reliability target, then people. Each says what the simulation tests, or that
    it is checked in the pilot.
  - **Safety in plain English.** The robot team's risk assessment under ISO 10218
    (adopted in the US as ANSI/A3 R15.06), and ANSI/A3 R15.08 for robots that drive
    between spots. Standards for walking robots are still being written. It also
    covers how robots work near people, and what Blueprint does not certify.
  - **Robots already do jobs like this.** Matching examples from the curated,
    sourced `deployedEnvironments`, with their status, evidence, sources and the
    footnote that none is a Blueprint customer.
  - A link to **print or save a one-page brief**.

The one-page brief (`/capture-upload/:token/brief`) is the full picture, for the
person who has to convince someone else. It covers the complete steps to a pilot
(video, brief, measurements n of 6, how the job runs, success target, access
window, then Blueprint's steps), what the job takes today, the report, and what
is left to check. The 3D scene stays where it already is: the status card's
"View your scene" link.

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
