# Job pass mark and robot fit

The pilot recommendation and booking API this runbook used to describe is
retired (owner decision 2026-10-28). Its routes return 404: `GET
/api/admin/robot-teams/jobs/:requestId/evaluations`, `POST
/recommendations/:requestId` (with `/reconcile` and `/coordination`) and the
site's `POST /api/task-listings/owner/:token/book`. Blueprint shows the site a
bounded simulation estimate and works with a deployment company; the site and
that company agree any pilot directly. Stored `pilot_recommendation` and
`pilot_booking` fields on older records are left untouched, and any queued `pilot_recommended`, `pilot_booked`, `pilot_scheduled` or
`team_pilot_*` email is cancelled at dispatch, never sent.

What remains in use is below. Evaluation results are simulation estimates and
never certify physical performance or safety. Code:
`server/utils/pilotRecommendationEvidence.ts` (the pass mark and result checks,
still used by the job console and evaluation scoring), `server/utils/siteRobotFit.ts`
and `server/utils/robotTeamIdentity.ts`.

## Robot fit: whom to ask

The job console and the job decision review both show **Robot fit**
(`server/utils/siteRobotFit.ts`, routes under `/api/admin/jobs/:requestId/robot-fit`;
design: `docs/superpowers/specs/2026-10-20-robot-fit-design.md`).

- **What the job needs, and every robot form's rating** (one arm, two arms, an arm
  on a wheeled base, wheeled and walking humanoids, a legged robot with an arm) are
  rules over the site's own measurements and answers, computed on every read.
  They use Blueprint's screening bands, which describe the job, not any robot.
- **Researched teams** come from one model run over every research note in the
  registry (**Rank researched teams**). Each reason is the model's reading of a
  quote the server found word for word in one field of the team's research; judge
  the claim against the quote. A team whose robot form is rated not a fit is a
  weak fit at most. A ranking is flagged stale once the job or the notes change,
  and a failed run never hides the last good ranking. Ranking is refused after
  recording consent is withdrawn, and it never writes to `robotTeams`.
- **What the site sees** is fixed sentences and the job's own data, never a
  team, and it asks the site nothing: the site sends its video and nothing else.
  Until you **Share the readiness report with the site**, the owner's job page
  shows no robot read. Sharing adds the robot readiness report, folded: the
  robot forms, getting the site ready, what decides success, safety in plain
  English, and jobs like this on the public record, plus a printable brief by
  its own read-only link. Most figures are the video reader's estimates and say
  "estimated from your video". The console previews all of it before you share.
  Design: `docs/superpowers/specs/2026-10-20-site-readiness-report-design.md`.

Use the ranking to choose which teams to invite to evaluate the job. A prospect
has agreed to nothing.

## Pass mark

Set before any run, read from the job in this order:

1. `inboundRequests/{jobId}.workspace_task.terms.successRate` (percent) — `source: "job_terms"`
2. `siteTaskBriefs/{jobId}.successCriteria.successRate` (percent) — `source: "site_task_brief"`
3. `0.9` — `source: "blueprint_default"` (lowest band the confidence policy states)

A run passes when it is a site evaluation (`evaluationPurpose` `pilot` or
historical unset) of this job (`run.sceneId === jobId`), `state: "completed"`
with a qualified, simulator-scored result that accounts for all 200 prescribed
episodes exactly once. At least 190 episodes must be scored (success or
failure); at most 10 may be void. A retry within one prescribed cell is not
another evidence episode. The observed
`episodesSucceeded / episodesRun` must meet `passMark.successRate`. When the job
has a cycle-time target, a finite, positive measured median at or below that
target is required; missing or invalid cycle time means the run does not pass.

Qualified evidence retains the admitted simulator scoring bindings and the
Pipeline registration and fidelity-review receipts for the exact capture and
scene revision. `development_only`, unqualified scenes, and incomplete or
inconsistent episode accounting cannot count as a pass. The 95%
Wilson interval and confidence band describe uncertainty alongside the
observed-rate pass rule; they are not an additional pass threshold or proof of
physical performance.

## Site-reported follow-through

A run a site selected before the booking flow was retired keeps its
follow-through: the site records start, completion and deployment through the
existing workspace pilot actions, with notes and `source: "site_reported"`.
A site can no longer select a run for a pilot.

## Identity splits

`npx tsx scripts/ops/report-robot-team-identity-splits.ts [--json]` lists
registry rows that resolve to one team, read-only. New workspace intakes link
`team_<company>` to the account-bound team (`canonicalTeamId` /
`linkedIntakeTeamIds`); older rows resolve by verified account email.
