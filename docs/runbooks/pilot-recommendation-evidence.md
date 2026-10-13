# Pilot recommendation evidence — API contract

Beta rule (founder decision, 2026-10-13): Blueprint recommends ONE robot team
whose evaluation of THAT site job passed; the site books in one step; the beta
is free (booking records `amountUsd: 0`, `commercialBasis: "invited_beta_free"`).
Evaluation results are simulation estimates and never certify physical
performance or safety. Code: `server/utils/pilotRecommendationEvidence.ts`,
`server/utils/robotTeamIdentity.ts`, `server/routes/admin-robot-teams.ts`.

All routes below are under `/api/admin/robot-teams`, admin/ops only.

## Pass mark

Set before any run, read from the job in this order:

1. `inboundRequests/{jobId}.workspace_task.terms.successRate` (percent) — `source: "job_terms"`
2. `siteTaskBriefs/{jobId}.successCriteria.successRate` (percent) — `source: "site_task_brief"`
3. `0.9` — `source: "blueprint_default"` (lowest band the confidence policy states)

A run passes when it is a site evaluation (`evaluationPurpose` `pilot` or
historical unset) of this job (`run.sceneId === jobId`), `state: "completed"`
with a recorded result of at least 10 episodes, observed
`episodesSucceeded / episodesRun >= passMark.successRate`, and — when the job
has a cycle-time target and the run measured a median — median <= target.

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
| 400 | `evaluation_run_required`, `evaluation_run_missing`, `evaluation_run_other_job`, `evaluation_run_private`, `evaluation_result_missing`, `evaluation_result_changed`, `evaluation_too_few_episodes`, `evaluation_below_pass_mark`, `evaluation_cycle_time_missed` |
| 400 | `evaluation_team_mismatch`, `team_not_registered`, `team_identity_ambiguous`, `team_declined`, `team_not_recommendable` |
| 409 | `capture_consent_withdrawn`; booked pilot; brief changed; site contact missing |

Team eligibility: registry status `applied`/`engaged` with approved access, or
`self_registered` bound to a verified account whose email has approved access.
No row of the team's identity may be `declined`.

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
