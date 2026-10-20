# Robot fit: what a job needs, which robots suit it, and which teams to ask

Status: approved by the founder on 2026-10-20 ("build the robot-fit section
now"), revised the same day after founder review: rate every form of robot,
never only arms.

## Why

A site's video, brief and measurements, together with public information about
robot teams, can tell us what a job needs from a robot, which kinds of robot
can meet that, and which researched teams look right for it. That decides whom
Blueprint invites to evaluate a job and what we tell them. It also gives the
site an early, honest answer to "what kind of robot would do this?"

It does not decide whom Blueprint recommends. The beta recommends one team
whose evaluation of the job passed (founder decision, 2026-10-13). Public
information cannot show that a team's robot will do this job: a team's policy
is not public, and research notes are not measurements. Robot fit therefore
shapes who is asked, and is reference material beside the evaluation when a
recommendation is written, never its basis.

## Every form of robot

The forms are the ones a robot team declares for its own robot (`ROBOT_FORMS`
in `client/src/types/robotEmbodiment.ts`, PR #1049):

- one arm on a fixed stand;
- two arms on a fixed stand;
- an arm on a wheeled base;
- a wheeled humanoid;
- a walking humanoid;
- a legged robot with an arm.

"Other" is not rated, because it has no shape to rate.

What our simulation can score today (one rigid object picked up and put down)
decides which jobs are rated, never which robots a site hears about. The
project rule is explicit: fixed-arm engineering priorities do not narrow public
examples or team applications.

## What it produces

One report per site job, in three parts.

1. **What the job needs.** The sources are the site's tape-measure readings
   (`siteTaskMeasurements`), its answers, the weight it typed, and the
   instruction the Pipeline derived from the video (`teamEvaluationTerms`). The
   needs are stated as sentences in the site's own numbers: picking the object
   up, whether the robot can work from one place or has to move between spots,
   what it lifts, whether the object takes two hands, reaching low or high, and
   people nearby. Whatever is missing becomes an unknown, with the step that
   would resolve it.
2. **Every form, rated.** Fixed rules rate each form `fits`, `possible` or
   `not_a_fit` against the needs, with the reasons. No model is involved.
3. **Teams (internal).** A model reads every research note in the registry and
   ranks the teams that suit this job. Each reason must quote one field of that
   team's research word for word, and the server drops any reason whose quote it
   cannot find.

## Rules

Rated jobs are those screened (`site_task_scope`) as one rigid object picked up
and put down. An unscreened, unsupported or door, drawer and lid job is not
rated, says why, and has nothing to share.

| Need | From | Effect on forms |
| --- | --- | --- |
| Moving between spots | Span between the pick and place spots (the distance across the floor, plus the height difference when both heights are known) | Forms that stay in one place: fit up to 1.2 m, possible (long reach) up to 2.4 m, not a fit beyond. Forms that move fit at any span, with a note when moving is not needed. |
| Two hands | Largest side over 0.6 m or weight over 15 kg | One-armed forms are possible (wide gripper or suction cups); two-armed forms fit. A weight band that straddles 15 kg gives possible. |
| Heavy load | Weight over 25 kg | Every form is possible: check the robot can lift it. |
| Low or high spots | A pick or place surface below 0.3 m or above 1.6 m | Every form is possible: it has to reach that spot. |
| People nearby | `humanProximity`, when the site answered it | Stated as a need. It does not separate forms. |

A form is `not_a_fit` if any check fails, `possible` if any check is a caution
or unknown, and `fits` otherwise. A note that moving is not needed never lowers
a verdict.

The bands are conservative screening assumptions about the job. They are not
any robot's specification, and the site never sees them, only its own numbers
and a verdict.

A typed weight is read only when it is one number and one unit. A range, a
list, a fraction or a thousands separator stays unknown rather than read as its
first number.

## Why no embeddings

The registry holds about 107 research notes, roughly 37k tokens in all. That
fits in one model call, so retrieval would only add a step that can silently
drop the right team. Similarity between a job and a note is also a weak proxy
for fit: "we cannot handle heavy cartons" is close to a carton job.

The model reads every note instead. The task payload is `{ candidates, job }`,
and the prompt builder sorts keys, so the shared team corpus comes before the
job and the provider's prefix cache reuses it across jobs. Runs start only when
an admin asks for one.

Revisit this at a few hundred teams (over about 150k tokens of notes), or if
ranking ever runs automatically at volume. At that point a hybrid keyword and
embedding retrieval step ahead of this same read would make sense.

## The ranking's guards

- A quote must sit inside one field: the note, what goes wrong, or one recorded
  capability. Its longest part must be at least 20 characters. A quote that
  elides text is checked part by part, in order, within that field.
- A team whose robot form the rules rate `not_a_fit` for the job is a weak fit
  at most, with that reason added to its concerns.
- The model writes no free summary. Its output is the ranked teams only.
- The console labels each claim as the model's reading and shows the quote, so
  a person judges the claim against the quote.

## Storage and routes

`siteRobotFit/{requestId}` is server-only (Firestore's default deny). It holds
the latest good ranking, the last run attempt and the sharing state. Every run
is also kept in `siteRobotFit/{requestId}/rankings/{startMs-random}`.

A run is kept in one transaction, under three rules:

- a good ranking replaces the stored one;
- a failed run is recorded as the last attempt without hiding the last good ranking;
- a slower run that started earlier never replaces a newer one.

Needs and form ratings are computed on every read, so they never go stale. A
stored ranking carries the digest of the job and research notes it read, and is
flagged stale when either changes.

| Route | Who | What |
| --- | --- | --- |
| `GET /api/admin/jobs/:requestId/robot-fit` | admin | Report, ranking, last attempt, sharing and site preview |
| `POST /api/admin/jobs/:requestId/robot-fit/ranking` | admin | Run a ranking. Returns the run's attempt and its ranking. Refused after consent withdrawal or without job details. |
| `POST /api/admin/jobs/:requestId/robot-fit/sharing` | admin | Share or stop sharing the site version |
| `GET /api/site-task-brief/:token/robot-fit` | owner link | The site version, only while shared |

The ranking runs on the OpenAI lane by default (`robot_fit_ranking`).
`BLUEPRINT_ROBOT_FIT_RANKING_PROVIDER` and `<PROVIDER>_ROBOT_FIT_RANKING_MODEL`
override it.

## The site version

It is shown on the owner's job page, just above the measurements step, only
after an admin shares it and only while consent stands. It is built from fixed
sentences filled with the site's own data:

- What this job needs from a robot.
- Every form, its verdict, and the reasons that set it apart, such as "Walking
  between spots isn't needed: the object moves 90 cm (you measured this)."
  Passing checks are left out because they repeat the needs.
- What the site can still add under the measurements step. A question the page
  cannot answer, such as whether people work nearby, is not shown.
- A fixed note: Blueprint invites robot teams whose robots look right for the
  job; if Blueprint recommends a team, it will be one whose evaluation of the
  job passed; and this is a first read, not a promise that any robot can do the
  job.

It never names a team, counts teams, quotes a research note, gives a price or
says "match". It reads again when the measurements step saves.

## Where it appears

- Job console: a Robot fit section beside Site measurements.
- Pilot proposal review: the same section, so whoever writes "why the evidence
  supports it" sees the job's needs and each team's quoted reasons next to the
  evaluation.
- The owner's job page: the site version, once shared.

## Not in this change

- **Automatic ranking on new jobs.** Ranking spends model calls, so it stays an
  admin action.
- **Writing back to `robotTeams`.** Ranking never edits the registry or creates
  capability proposals.
- **Rating jobs other than one rigid object picked up and put down.** The rules
  have no measurements for them yet. Ranking still reads their task text, for staff.
- **Asking the site whether people work nearby.** The capture-first flow asks no
  spec question, so this is usually unknown and stays internal.
