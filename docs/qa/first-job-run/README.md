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

- 2026-11-23 13:35Z. The test company is approved, signed in and has
  accepted the Terms. Nothing is submitted yet. Two workers are running: one
  looks for a Mixkit clip under its free licence, one fixes gap 1 on branch
  `claude/dreamy-hamilton-qn8lm4-place-city-state`. A check-in is scheduled
  for 15:00Z. Next steps in order: deploy `origin/main` through the door at
  15:00Z and confirm it; answer the open review thread on pull request 1410
  and merge it; merge the gap 1 fix once its checks are green; confirm
  `/version.json`; recount companies and listable real jobs; submit the job,
  picking the place from the suggestions so the city and state are stored.
  The company's browser profile and the scripts are in the session's
  scratchpad and do not survive the session: a new session asks for a fresh
  sign-in link on `/sign-in` (read from the company test address).

## Test values

| What | Value |
|---|---|
| Site account | the owner's Gmail, plus-address `+bpsite1123` |
| Company account | the owner's Gmail, plus-address `+bpco1123` |
| Company name on the application | Test Deployment Co (Blueprint first-job run 2026-11-23) |
| Company website on the application | `https://example.com` (a reserved test domain) |
| Place | Austin, Texas. **A test value**: the clip's real place is not known. |
| Job sentence | "Scrape the cake batter from the mixing bowl into each baking pan on the counter." |

No real site and no real company is part of this run. Production data beyond
the test job is read as counts and timings only.

## Footage

**The clip for the job.** One clip, used as downloaded, not edited.

| | |
|---|---|
| Source page | `https://mixkit.co/free-stock-video/woman-pastry-chef-pouring-a-mixture-into-baking-molds-50033/` |
| File | `https://assets.mixkit.co/videos/50033/50033-1080.mp4`, downloaded 2026-11-23 13:35Z |
| sha256 | `9287a931b2f0448e1712b5437823386a72b6f69a1f00f3fe5e813cb3d0ce140b` |
| Size, length, format | 76,974,681 bytes; 21.4 s; 1920x1080 H.264 mp4, 23.976 frames a second; no sound track (`ffprobe`) |
| What it shows | A commercial kitchen. A worker in a white jacket, seen from the shoulders down, scrapes cake batter from a steel mixing bowl into round baking pans lined up on a steel counter. One continuous shot (`ffmpeg` scene filter at 0.3: 0 changes). |
| Faces | None: the worker is framed from the shoulders down in all 12 frames looked at. |
| Names, logos, text | None seen in those frames. |
| Job sentence | "Scrape the cake batter from the mixing bowl into each baking pan on the counter." True of what is on screen. |
| Place | Austin, Texas: a test value. The clip's real place is not known. |

**Licence.** Mixkit Stock Video Free License. The item's own page marks it
`data-license="videoFree"` and carries no "Restricted" or "Personal Use only"
wording. The licence text, read on `https://mixkit.co/license/` on 2026-11-23
at 13:28Z: "Items under the Mixkit Stock Video Free License can be used in your
commercial and non-commercial projects, for free. You're permitted to
download, copy, modify, distribute, publicly perform and broadcast the Items.
Your rights are non-exclusive, worldwide, sub-licensable and ongoing.
Attribution is not required". The limits it points to, read in section 9 of
`https://mixkit.co/terms/` at 13:29Z: no selling unaltered copies, no offering
items as stock, no competing service, no removing watermarks, no mass
download. That section names no limit on analysing a clip with software.

Not read: Envato's Acceptable Use Policy, which those terms also apply. Its
page answered automated requests with a challenge (HTTP 403) and was left
alone. The site's own public sample job already uses a Mixkit clip under this
licence.

**How well it fits the brief.** It is a repetitive manual job with no face,
which the brief asked for. It is not a handheld walk through a work area: the
camera only drifts, and the room is seen from one side. No clip found under a
clean licence had both.

Looked at and not used, 2026-11-23 13:20Z to 13:30Z:

- **Coverr** (two stockroom clips that show the job). Its licence page says
  "Nothing from Coverr may be used to train, fine-tune, distill or evaluate AI
  models, or go into a dataset for that purpose." This run sends frames to
  model providers and is itself a test. Not used, so that no rights question
  is open.
- **Mixkit items under its "Stock Video Restricted License"** ("720p Version
  for Personal Use only"): not a reuse licence.
- **Pexels, Pixabay, the Wikimedia Commons API**: each refused an automated
  request from this network (HTTP 403, 403, 429). Not retried; no bot check
  was worked around.
- **Internet Archive, "Baggage unloading"** (CC0): filmed through a terminal
  window, an airline's name on every cart.
- **Internet Archive, "Warehouse of Old Electronics Equipment"** (CC0,
  uploaded by its author in 2011): a real handheld walk through a packed
  warehouse, 640x480 and very shaky, nobody doing a job. Kept as the fallback.

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
| 2026-11-23 13:21:39 | The owner approved it in one press. | the invitation's `revision` time in the approval email; count over `robotTeamAccess`: `approved: 2` at 13:22:21 |
| 2026-11-23 13:21:43 | The approval email reached the company address: "Your company is approved to see jobs on Blueprint". 3 min 53 s after the application. | Gmail, the message's `date` |
| 2026-11-23 13:23:05 to 13:23:09 | The company opened the link in that email, ticked "I agree to the Terms and Privacy Policy", pressed Create account, and was signed in with no password and taken to Find jobs: "No jobs yet. New jobs appear here when their video is ready." | browser log of the visit: `POST /api/account-invitations/redeem` 200, `POST /api/workspace/setup` 200, `GET /api/site-worlds/tasks` 200; `evidence/company-find-jobs-empty-1280.png` |
| 2026-11-23 13:24 | The company's record holds a signed-in acceptance of Terms 2026-11-21.1 and Privacy 2026-11-21.1. Companies that may see jobs: 1, the test company. | count over `robotTeamAccess`: `approved_with_signed_in_terms_uid: 1` |

## Gaps

Each gap gets: what, evidence, the fix (pull request), how it was verified.

### Gap 1. The start form drops the place's city and state

Found by reading, before the job was sent.

- **What.** A company can be shown "City, State, United States" only from the
  job's stored city and state. No form stores them, so every job shows a
  company the country alone, whatever statement the site accepted. Pull
  request 1410 alone would not change that.
- **Evidence.** `companyPlaceOf` reads only
  `request.siteLocationMetadata.state` and `.city`
  (`server/utils/companyJobPage.ts:117-128`). The start form's payload carries
  `siteName`, `siteLocation` and `captureRegion` and no `siteLocationMetadata`
  (`client/src/components/site/SiteCaptureStart.tsx:481-497`);
  `git grep -l siteLocationMetadata origin/main -- client/src` lists only
  `client/src/lib/firebase.ts` and `client/src/types/inbound-request.ts`, and
  the same on the 1410 branch. On the live form, picking "Austin, Texas"
  already asks Google for the place's parts (`GetPlace`) and keeps only the
  country (`LocationAutocomplete.tsx:103-104`).
- **Fix.** In progress on `claude/dreamy-hamilton-qn8lm4-place-city-state`:
  the form sends the picked place's city, state and country; a typed place
  with no pick gives the state only, from a closed list, never a city from
  free text.
- **Verified.** Not yet.

## What still needs the owner

- Done 13:21Z: Approve on the test company's application.
- The upload hand-off function (`extractFrames`) lives in the
  `BlueprintCapture` repository, which this session may not read (adding it
  was refused by the session's permissions). If a job under the new statement
  stops at the hand-off, the cause may be there.
- One other company is approved and has never signed in. If it signs in and
  accepts the Terms while the test job is listed, it sees the test job and is
  emailed about it.
