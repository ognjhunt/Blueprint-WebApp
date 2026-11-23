# First job run: one new job, end to end

Started 2026-11-23. One new job is sent the way a site sends it, through the
live start form, and followed until an approved deployment company sees it,
answers, and the site asks for an introduction. The job is a probe: every gap
it finds is fixed at its cause, for every job.

This file is the run log. It is written as the run goes, so later sections
are empty until their step has happened. Every claim names its source: a
command and its output, a file and line, a screenshot of the test job, or a
measured number. Anything else is marked unverified.

The audit this follows is in pull request 1374
(`docs/qa/first-principles-audit/` on its branch): `what-shipped.md`,
`journeys.md` and `pipeline-timing.md`. It is not repeated here.

## Resume note

For a session that picks this up. Newest first.

- 2026-11-23 13:35Z. Waiting for: the owner's Approve press on the test
  company; the Pipeline deploy window at 15:00Z; the footage worker. Nothing
  is submitted yet. Next steps in order: deploy `origin/main` through the
  door at 15:00Z, confirm it, answer the open review thread on pull request
  1410 and merge it, confirm `/version.json`, recount companies and listable
  real jobs, then submit the job.

## Test values

| What | Value |
|---|---|
| Site account | the owner's Gmail, plus-address `+bpsite1123` |
| Company account | the owner's Gmail, plus-address `+bpco1123` |
| Company name on the application | Test Deployment Co (Blueprint first-job run 2026-11-23) |
| Company website on the application | `https://example.com` (a reserved test domain) |
| Place | Austin, Texas. **A test value**: the clip's real place is not known. |
| Job sentence | written from the clip; see "Footage" |

No real site and no real company is part of this run. Production data beyond
the test job is read as counts and timings only.

## Footage

Not chosen yet. This section will hold the clip's source page, its licence
with the line read on the source, the file's sha256, and whether any face is
recognisable.

## Before the job was sent (read-only checks)

Read 2026-11-23 between 13:11Z and 13:20Z.

| Check | Result | Source |
|---|---|---|
| Release on the host | `cbff06b4409c`, deployed 2026-11-20. `origin/main` is `8feb4e9`. The 16 Pipeline pull requests merged after the audit are not on the host. | `python3 scripts/operator_door.py status`: `active_release.commit`, `deployed.commit_proven: true`, `deploys.recent_receipts[0]`; `git log origin/main -1` |
| Deploys or paid work in flight | none: no active deploy unit, 0 pending door requests, every paid-launch lock unheld | same status: `deploys.active_units: []`, `door_requests`, `paid_launch_locks` |
| WebApp pull request 1410 | open, not merged; checks green on `fcca7ea`; one automated review thread open | GitHub pull request 1410 |
| Live website | `a2afb48` (`main`); the start form shows the v4 sentence, without "the city and state it is in" | `https://tryblueprint.io/version.json`; the start form's text read in headless Chromium |
| Companies that may see jobs | 0. Records: 1 approved (no signed-in Terms acceptance) and, after 13:17Z, the test company's application | count over `robotTeamAccess` by `status` and `termsAcceptedByUid` present; the rule is `companyMaySeeJobs`, `server/utils/companyTerms.ts:37` |
| Real jobs an approved company could be shown | 0: no capture has a company video that is not an internal test (34 capture records: 26 with no clip, 8 internal test) | count over `captureUploadSessions` by `company_clip.permission_basis`; a job with no company video is not listed (`video_required`, `server/utils/teamJobAccess.ts`) |
| Sends, views, answers, introductions, billable events | 0 of each | counts over `companySends`, `companyViews`, `companyResponses`, `introductions`, `billableEvents` |
| Month to date | $301.99 counted of the $400 limit for 2026-11 (75.5%); admission allowed; $0 held | status: `spend_guard.account_monthly_spend` (`counted_usd`, `limit_usd`, `admission_allowed`, `held_usd`) |
| Spend guard | `blocked`, one blocker: `runpod_inventory_query_failed` (the retired RunPod key, an owner step). 0 live machines, $0 an hour. Admission is not stopped by it. | status: `spend_guard.status`, `blockers`, `live_instance_count`, `spend_admission_lock.admission_allowed: true` |
| Rehearsal on the emulators | `npm run test:core-journey`: 2 passed (27.6 s) | run in this session, 13:13Z |

The forecast in the same status says the account reaches its limit on
2026-11-30 at $13.39 a day with no job behind it. One job at its full $40 cap
would bring the count to $341.99.

The counts were read with a script that calls only Firestore's two read
endpoints (`runAggregationQuery` and `runQuery` with a field mask) and selects
status strings, version strings, booleans and timestamps. It selects no name,
address, contact, job text or media link.

## Timeline

Times are UTC.

| When | What | Source |
|---|---|---|
| 2026-11-23 13:17:50 | The test company applied through the live `/jobs` form: HTTP 202, "Your application is saved." | the form's own POST to `/api/robot-team-access/apply` and its response `Date` header; `evidence/company-application-receipt-1280.png` |

## Gaps

None recorded yet. Each gap gets: what, evidence, the fix (pull request), how
it was verified.

## What still needs the owner

- Press Approve on the test company's application
  (`/admin/robot-team-access`, the one record in state `applied`).
- One other company is approved and has never signed in. If it signs in and
  accepts the Terms while the test job is listed, it sees the test job and is
  emailed about it.
