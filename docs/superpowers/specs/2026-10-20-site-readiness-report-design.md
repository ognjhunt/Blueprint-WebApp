# Site readiness report: an expert's first read of a site's job

Status: approved by the founder on 2026-10-20 ("do all of these and implement
in full"), then cut down the same day: "keep the UI/UX as simple as possible",
"too much text", and finally "they literally should ONLY have to submit the
video and that's it". It builds on robot fit (`2026-10-20-robot-fit-design.md`).

## Why

A site that has never bought a robot has questions it does not know to ask:
will it work here, what has to change, is it safe, what could go wrong, and how
to convince someone else. An integrator answers them on day one. This report
answers them from the site's video, so Blueprint reads as the expert that knows
what it takes, and the site does nothing but send the video.

## The site sends its video and nothing else

Founder direction (2026-10-20): no friction for the site. Blueprint infers what
it needs and makes educated guesses where it must. The founder chose what goes:

| Removed from the site's job page | Instead |
| --- | --- |
| The measurements step and its printer-paper sheet | The video reader estimates sizes, weights, distances and heights |
| Item photos | The video reader names the items the station probably also handles |
| Follow-up questions, and the assessment's open questions and proposed next steps | Blueprint resolves them; staff still see them in the job console |
| The how-it-runs form, the next steps and the hours worked | Nothing to answer; the speed check uses the timed or estimated cycle |

The brief confirmation stays: it is the site's one attestation, and teams
evaluate only a confirmed job.

## What Blueprint infers from the video

Every uploaded walkthrough gets one Gemini reading in the capture-first flow:
its coverage review (`capture_coverage`). That review now also returns
`job_estimates`. A link the site shares at intake gets the footage reader
(`site_video_evidence`), which returns the same estimates beside its timed
cycles and people nearby. The estimates are:

- the main object, its largest side and a weight range;
- its surface (matte, shiny, see-through or mixed);
- how far it moves, and the heights of the surfaces it moves between;
- the open floor in front of the starting surface, zero included;
- up to five other kinds of item the station probably handles that the clip
  did not show, as plain nouns, never a brand, company or robot;
- a cycle time;
- what it sized things against, such as a pallet or a door.

The estimates are walled off. They never change a coverage verdict, stance,
gate, timed cycle or footage status. A malformed estimate reads as null rather
than failing the review it rides on. A linked supplement, which shows only part
of the work, estimates nothing, and nothing is kept from an unreadable clip.

The walkthrough's estimates are kept on the job as `walkthrough_job_estimates`,
written beside the coverage finding under the same consent and source checks.
Robot fit reads each estimate from the walkthrough first, then from the intake
link's reading. A timed cycle and people nearby come only from the intake
link's reader. The coverage review never describes people.

Source order for every figure: what the site measured, then what it told us,
then the video's estimate. Every figure carries its source in the site's words:
"you measured this", "you told us", "seen in your video" or "estimated from
your video".

An estimate is a guess the site has no step to correct, so it never rules
anything out on its own. An estimated distance too far for a robot that stays in
one place reads "likely too far" and leaves that form "possible", not "not a
fit". Estimated floor space is never "Looks ready"; it is confirmed with the
robot team.

Both readers run only with `BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED=true` and a
Gemini key. That flag also turns on the upload privacy screen and the site
assessment, which already depended on it. The estimates add no model call:
they ride on the coverage review each walkthrough already gets.

## What the owner's job page shows

Nothing until Blueprint shares the report. Then one folded section, **Your
robot readiness report**, whose title carries the one number worth seeing, for
example "· 6 kinds of robot fit". It holds:

- What the job needs, and every form of robot with its verdict and reasons
  (robot fit).
- Getting your site ready, matched to the forms that fit. Each item either
  "Looks ready" or is one to "Confirm with the robot team":
  - floor space at the station, from a reading on file or the estimated
    clearance; only a reading on file can make it "Looks ready";
  - where a robot stands, or parks and charges;
  - power, and Wi-Fi for robots that move;
  - a safe working zone, from people nearby;
  - how objects arrive, from the confirmed screening answers. It is left out
    when there are none.
- What decides success here: up to three things, by fixed triggers in this
  order. They are a speed shortfall, more items than the video shows, placement
  drift, shiny or see-through items, jams and damage, tight space, a large or
  heavy object, a high reliability target, then people. Each says whether the
  simulation tests it or the pilot checks it.
- Safety in plain English: ask the robot team for its risk assessment of the
  job. Robot safety follows ISO 10218 (adopted in the US as ANSI/A3 R15.06),
  and ANSI/A3 R15.08 for robots that drive between spots. Standards for walking
  robots are still being written. It also covers how robots work near people,
  and what Blueprint does not certify.
- Jobs like this on the public record: matching documented deployments from the
  curated, sourced `deployedEnvironments`, by environment name and source only,
  with the footnote that none is a Blueprint customer. The evidence text names
  robot companies, and a site never weighs teams, so it is not shown. Emerging
  environments with no operating site on record are left out.
- A link to print or save the brief.

## The printable brief, by its own read-only link

The brief is made to be printed or saved as a PDF, and browsers print a page's
address on it. The owner's job link cannot be that address: it confirms the
brief, books the pilot and withdraws consent. So the brief opens at
`/readiness-brief/:briefToken`, outside `/capture-upload/*`, which the capture
app claims as its universal link. The token is signed with the capture
link's secret under its own `kind` (`readiness_brief`), lasts 14 days and reads
one job's brief. A brief link opens nothing else, and no other link opens the
brief. Withdrawn consent closes it.

The brief carries where the job stands (video, brief, the 3D scene, the
evaluation, the recommendation and booking) and the report, once shared.

## Rules and copy

- Everything is deterministic: fixed sentences filled with the job's own data.
  The report adds no model call; the estimates come from the existing footage
  reader.
- Screening bands describe the job, never a robot's specification. Open floor
  of at least 1.0 m in front of the starting surface is ready; 0.6–1.0 m is
  tight; less than 0.6 m reads "only"; under 0.4 m above the surface is tight.
- The tracker calls a recommendation bookable only as the booking route does: a
  recorded recommendation, not awaiting review, on qualified evidence. A job
  out of scope says so instead of promising robot teams.
- Nothing claims a check that no process runs. There is no "Blueprint checks
  this" state.
- A cycle the reader timed reads "timed from your video". A cycle it estimated
  reads "estimated from your video".
- No team names, counts, prices or "match". Every answer is a first read, not a
  promise.
- What the simulation tests is stated only where the evaluation contract tests
  it:
  - variation of the object's start position and turn, the light and the grip;
  - your fixtures in the rebuilt scene;
  - cycle time against your target;
  - your pass mark.

  Everything else, including items the video did not show, says it is checked in
  the pilot.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `GET /api/site-task-brief/:token/readiness` | owner link | Where the job stands, the report while shared, and the brief's read-only link |
| `GET /api/site-task-brief/readiness-brief/:briefToken` | brief link | The same read, for the printable brief; it mints no further link |
| `GET /api/admin/jobs/:requestId/robot-fit` | admin | Also returns the full report preview |

The owner's `GET /:token/robot-fit` and `PUT /:token/operations` routes are
removed. Withdrawn consent closes the link routes, as before.

## Open decision: who measures the rebuilt scene

Qualification compares the rebuilt scene with independent source measurements
(`docs/runbooks/qualified-site-evaluation.md`), and a bookable recommendation
needs a qualified evaluation. Since 2026-10-19 the site produced those readings
on its job page. The site is no longer asked, and video estimates can never
stand in: they come from the same footage the scene is built from. Readings
already on file still export. For new jobs, the founder decides who produces
the source measurements, for example Blueprint staff on a site visit.

## Not in this change

- **Marking the pick and place spots in the 3D scene.** WebApp holds no scene
  coordinates; the Pipeline's task grounding would have to publish them.
- **A clip of a robot in the site's scene.** Rendering it is Pipeline work, and
  it must be labelled as an illustration, not an evaluation.
