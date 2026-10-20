# Pilot recommendation evidence — API contract

Beta rule (founder decision, 2026-10-13): Blueprint recommends ONE robot team
whose evaluation of THAT site job passed; the site books in one step; the beta
is free (booking records `amountUsd: 0`, `commercialBasis: "invited_beta_free"`).
Evaluation results are simulation estimates and never certify physical
performance or safety. Code: `server/utils/pilotRecommendationEvidence.ts`,
`server/utils/robotTeamIdentity.ts`, `server/routes/admin-robot-teams.ts`.

All routes below are under `/api/admin/robot-teams`, admin/ops only.

## Robot fit: whom to ask, never whom to recommend

The job console and the pilot proposal review both show **Robot fit**
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
- **What the site sees** is fixed sentences and the site's own data, never a
  team. It reaches the owner's job page only after **Share with the site**.

Use the ranking to choose which teams to invite to evaluate the job, and as
reference while writing "why the evidence supports it". A prospect has agreed
to nothing. The recommendation itself still names the team whose evaluation of
the job passed, picked below.

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
target is required; missing or invalid cycle time prevents a recommendation.

Qualified evidence retains the admitted simulator scoring bindings and the
Pipeline registration and fidelity-review receipts for the exact capture and
scene revision. `development_only`, unqualified scenes, and incomplete or
inconsistent episode accounting cannot support a recommendation. The 95%
Wilson interval and confidence band describe uncertainty alongside the
observed-rate pass rule; they are not an additional pass threshold or proof of
physical performance.

## GET `/jobs/:requestId/evaluations`

```ts
{
  ok: true,
  requestId: string,
  passMark: { successRate: number /* 0..1 */, source: "job_terms" | "site_task_brief" | "blueprint_default",
              minimumEpisodes: number, cycleTimeSeconds: number | null },
  consentWithdrawn: boolean,          // true: nothing is recommendable
  boundary: string,                   // simulation boundary sentence
  currentRecommendation: { id: string, evaluationRunId: string | null, booked: boolean } | null,
  evaluations: Array<{
    runId: string, resultId: string | null /* sha256 of the stored result */,
    state: string, evaluationPurpose: "private" | "pilot" | null,
    teamId: string, teamName: string | null,
    recommendedTeamId: string | null, recommendedTeamName: string | null, // canonical registry team, when eligible
    checkpointId: string, requestedAtIso: string | null, evaluatedAtIso: string | null,
    episodesRun: number | null, episodesSucceeded: number | null, successRate: number | null,
    medianCycleSeconds: number | null, confidenceBand: string | null,
    evidenceScope: "development_only" | "simulation" | null,
    cycleTimeMet: boolean | null, passed: boolean | null,
    refusals: Array<{ code: EvidenceRefusal, error: string }>,
    teamRefusal: { code: string, error: string } | null,
    recommendable: boolean,           // pick only these
  }>  // recommendable first, newest first
}
```

404 `{ ok: false, error }` when the job does not exist.

## POST `/recommendations/:requestId`

Request (strict JSON):

```ts
{
  evaluationRunId: string,            // REQUIRED: a recommendable runId from the list
  resultId?: string,                  // optional sha256 from the list; binds the exact result reviewed
  teamId?: string,                    // optional; must resolve to the run's team (any linked registry row)
  briefRevision?: string,             // as before
  purpose: string, siteProvides: string, teamProvides: string,
  pilotCost: string /* set by the robot team */, window: string,
  successCondition?, exclusions?, costBasis?, sitePreparation?, humanWork?,
  capabilityBasis?,                   // blank: stated from the evidence
  providerCommitment?, uncertainties?, alternative?
}
```

Success: `{ ok: true, id: "rec_…", teamId: string, evidence: PilotRecommendationEvidence, teamNotified: boolean }`.

The stored `inboundRequests/{jobId}.pilot_recommendation` adds `evaluationRunId`,
`evidenceScope`, `registryTeamIds` and an immutable `evidence` snapshot:
`{ schemaVersion: "pilot_recommendation_evidence.v1", runId, resultId, teamId, checkpointId, sceneId,
episodesRun, episodesSucceeded, successRate, medianCycleSeconds, confidenceBand, confidencePolicyVersion,
passMark, cycleTimeMet, passed: true, evaluatedAtIso, evidenceScope, boundary }`.
Replacing a recommendation creates a new id; a booked pilot is not replaced (409).

Refusals (`{ ok: false, code, error }`):

| status | code |
| --- | --- |
| 400 | `evaluation_run_required`, `evaluation_run_missing`, `evaluation_run_other_job`, `evaluation_run_private`, `evaluation_result_missing`, `evaluation_result_changed`, `evaluation_too_few_episodes`, `evaluation_below_pass_mark`, `evaluation_cycle_time_missed`, `evaluation_cycle_time_missing`, `evaluation_not_simulator_scored`, `evaluation_development_only`, `evaluation_scene_not_qualified`, `evaluation_episode_accounting_invalid`, `evaluation_criteria_changed` (the job's targets moved after the run's evaluation request froze them in `workspace_evaluation.targetSnapshot`) |
| 400 | `evaluation_team_mismatch`, `team_not_registered`, `team_identity_ambiguous`, `team_declined`, `team_not_recommendable`, `team_supply_agreement_missing` (no recorded agreement to run on the supported interface, accept a free evaluation and take the pilot; see `docs/beta/ROBOT_TEAM_SUPPLY_AGREEMENTS.md`) |
| 409 | `capture_consent_withdrawn`; booked pilot; brief changed; site contact missing |

Team eligibility: registry status `applied`/`engaged` with approved access, or
`self_registered` bound to a verified account whose email has approved access.
No row of the team's identity may be `declined`.

## Booking and site-reported follow-through

A new owner booking rechecks the exact qualified recommendation and commits
`pilot_booking`, the associated contact-exchange notice intents, and
`workspace_task.pilot.selectedResultId` together. The selected result is the
recommendation's `evaluationRunId`; its initial state is `selected` with
`source: "site_booking"`. The workspace displays “Pilot booked” and offers
“Record pilot start”. Booking does not assert that physical work started.

The site records start, completion, and deployment through the existing
workspace pilot actions, with notes and `source: "site_reported"`. Booking
retries preserve recorded outcomes and historical booking terms. A new booking
that would replace a different pilot selection is refused with
`pilot_selection_conflict`; Blueprint must review that conflict first.

## Notifications

Written to `captureOutbox` in the same transaction as the record they describe:
`team_pilot_recommended` (recommendation), `team_pilot_booked` (site booking,
`POST /api/task-listings/owner/:token/book`), `team_pilot_scheduled`
(`POST /recommendations/:requestId/coordination`). Key:
`{jobId}:{kind}:{sha256([teamId, recommendationId|calendarEventId, email])}`;
the dispatch guard cancels a notice whose recommendation, booking, schedule or
recipient is no longer current. Slack (ids and an admin link only, once per
event via `pilotOpsAlerts/{key}`): a booked pilot, and a robot team's
`POST /api/workspace/evaluations` request awaiting founder admission.

## Identity splits

`npx tsx scripts/ops/report-robot-team-identity-splits.ts [--json]` lists
registry rows that resolve to one team, read-only. New workspace intakes link
`team_<company>` to the account-bound team (`canonicalTeamId` /
`linkedIntakeTeamIds`); older rows resolve by verified account email.
