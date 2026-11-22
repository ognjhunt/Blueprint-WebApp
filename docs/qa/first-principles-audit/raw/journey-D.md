# Journey D: the owner and the operator, seeing and running the business

Agent `journey-D`, 2026-11-22. WebApp at 0ee5df6 (the live site). Pipeline HEAD 7d8b532; the control plane runs release `cbff06b4` (door status, `active_release`).

What I did: read the runbooks and doors named in the task; read the saved door status (2026-11-22T15:01Z) and, with read-only door commands, `requests`, `ls` of deploy receipts and `cat` of the unit-failure records (no site data, no media); started the WebApp locally on port 4340 with fake operator sign-in and every API mocked, and took 16 screenshots (`screenshots/D-0*-1280.png`, `-390.png`). Production counts come only from the orchestrator's aggregate collection counts. No paid call, no write, no email.

## The answer in six lines

1. **One place?** No. The staff job list shows the job sentence, a standing phrase and the date. Cost, company answers, introductions and billable events are each inside one job. Nothing counts anything.
2. **Manual steps:** about a dozen kinds remain. Five protect nothing and should go. Two that protect privacy and money were never switched on.
3. **When something is wrong:** the status says 18 alerts, 207 failed units, a hold and seven locks. In truth nothing pages, no job is stalled, no lock is held, the hold expired on 2026-10-03, and 206 of the failed units are finished experiments. The one real fault, the money guard failing every run since 2026-11-13, is buried among them.
4. **Approving a company:** seven steps (Slack, sign-in, find, Approve, confirm box, note box, saved). It should be one press from an email.
5. **/app/captures:** a retired staff upload page for 360 cameras. Its API is open to any invited account. Delete it.
6. **The business has not started billing:** production holds 76 job records, one company record, zero sends and zero introductions.

## 1. The journey today

### D-a. The owner: "how is the business doing?"

| # | Screen or email | What the owner does | Wait (source) | Failure modes | Friction 0-5 |
|---|---|---|---|---|---|
| 1 | `/sign-in` | Signs in with an admin or ops account | unverified | none seen | 1 |
| 2 | `/admin/jobs` list (D-01) | Reads 25 rows: sentence, standing, date | each row reads the job outlook with an 8 s deadline (`jobConsoleData.ts:36,135`); real time unverified | no counts, no filter, no cost, no answers | 4 |
| 3 | "Show older jobs" | Clicks to load 25 more, counts rows by hand to get "this week" | unverified | counting by hand | 4 |
| 4 | Job page (D-02) | Opens each job for cost, timeline, answers, introductions, billable lines | unverified | cost covers WebApp ledgers only | 4 |
| 5 | Staff tools, Deployment companies (D-03) | Opens the tool to see which companies answered | none | the tool is mostly manual forms | 3 |
| 6 | `/admin/robot-team-access` (D-04) | Types the address (no link from step 2); reads waiting companies | none | other design, other words | 3 |
| 7 | Terminal | Runs `door status` for spend and failures | about 10 s (my calls) | 135 KB JSON; red lists are mostly history | 5 |
| 8 | nothing | Funnel, response times, outcome answers | n/a | no page answers it | 5 |

Totals: 8 steps; about 3 + 2 per job clicks (with 76 jobs, more than 150 clicks to see everything); 0 fields; 1 sign-in; 0 emails; one terminal session. Steps 7 and 8 cannot be done on a phone.

### The owner's real questions

| Question | Which page answers it | Clicks |
|---|---|---|
| How many jobs came in this week? | none; count list rows by hand | 1 + "Show older" per 25 |
| Where is each job stuck? | `/admin/jobs` list, standing phrase | 1 |
| What did each job cost? | job page "What it has cost so far", WebApp ledgers only (`jobConsoleData.ts:319-333`) | 2 per job |
| Which companies answered what? | job page, Deployment companies tool | 3 per job |
| Which introductions happened, what is billable? | job page timeline lines only (`jobConsoleData.ts:366-378`) | 2 per job; no list |
| Which companies wait for approval? | `/admin/robot-team-access` | separate address |
| What is failing? | `door status` in a terminal | not on a page |
| Funnel, response times, outcome answers at 14/45/90 days | none | n/a |

### D-b. The operator: keeping jobs moving

| # | Trigger | What the operator does | How often (source) | Friction |
|---|---|---|---|---|
| 1 | Alert on the webhook | Reads `door status`, then the runbook section | spend guard posts about hourly since 11-13 (unit-failure record) | 5 |
| 2 | Deploy | `door deploy`, read receipts, "record in the tracker" | 153 deploys in November, about 7 a day (receipts) | 3 |
| 3 | Stuck job | `door selected-handoff --resume-preparation` or `--atlas-retry` | 4 of the last 20 requests | 3 |
| 4 | Disk | `door retire-scene-workspace`, `purge-experiment-folder` | 3 of the last 20 requests | 2 |
| 5 | Timer off | `door unit start`, `door hold` | 2 of the last 20 requests | 2 |
| 6 | Company applies | approve (D-c) | 1 company record ever | 4 |
| 7 | Company emailed an answer | "Record an answer a company sent by email" | 0 sends ever | 4 |

### D-c. Approving a company today

1. The company applies on `/jobs` (or `/partners`). 2. If `SLACK_INBOUND_WEBHOOK_URL` or `SLACK_WEBHOOK_URL` is set, Slack gets a message with the fields and a link (`slack.ts:138-165`). Otherwise there is only a log line saying the application "has no bell". 3. The owner opens the link and signs in. 4. The owner finds the card on "Partner applications". 5. The owner presses Approve. 6. A browser confirm box: "I reviewed the team's capabilities, task fit, and prerequisites and approve its invitation." 7. A browser prompt box for an optional internal note. 8. The record is saved and the approval email is queued.

Fields the owner sees: name, email, company, website, role, capabilities, jobs they can deliver, region, applied date, supported systems, pilot notes, test site, fit checklist. The last four come from retired forms.

## 2. The journey as proposed

| # | Screen or email | What the owner does | Wait | Friction |
|---|---|---|---|---|
| 1 | `/admin/jobs` (signed in) | Reads one line of numbers: jobs this week and all time, with video, shown to companies, with an answer, introductions asked, introductions sent, outcome answers; month spend and the forecast | Firestore count queries | 1 |
| 2 | Same page | Reads "Needs you": companies waiting, money or rights stops, a failing guard; each is one line | none | 1 |
| 3 | Same page | Billable events list with a count and a CSV link | none | 1 |
| 4 | Email | Company applied: one Approve link | none | 0 |
| 5 | Phone | Paged only for money, privacy, rights or a stalled paid job | none | 0 |

Before: 8 owner steps, a terminal and two addresses. After: 3 steps on one page, plus one-press approval from email. Operator manual kinds: about 12 now; 6 after the deletions below.

Deletions I expect may come back: the per-job hold (as a privacy-only takedown), and some form of the deploy window if jobs get much busier.

## Manual steps, counted

Frequencies: last 20 door requests (2026-11-19T14:20Z to 11-20T17:50Z; the door lists only 20), 363 door deploy receipts, and the unit-failure records.

| Manual step | How often | Time each (source) | Verdict | Hard stop it protects |
|---|---|---|---|---|
| Company approval | 1 company record ever | 7 steps (D-c) | AUTOMATE to one press from email (D-08) | money (who sees jobs and later pays) |
| Deploy in the 15:00 UTC window | 129 deploys from 11-03 to 11-20, 100 outside the window | unverified | DELETE the window; keep the door's own hold (D-06) | money (paid stage in flight), via the hold only |
| Record the deploy in the tracker | every deploy | unverified | DELETE; the door receipt is the record | none |
| Stuck-job nudge (`selected-handoff`) | 4 of 20 requests | unverified | KEEP as an override; retries are already automatic (`website_preparation_retry.py`) | none; it is a speed-up |
| Holds and their release | 1 hold listed, expired 2026-10-03 (founder stop, explicit release) | n/a | owner releases or keeps it once; hide expired holds (D-07) | money |
| Vast credit top-up | pages below 11 USD (`provider_credit_admission.py`); no credit alert on 11-22 | minutes | KEEP | money |
| Spend-limit change | 2 owner decisions in November (11-12, 11-20) | minutes | KEEP; owner only | money |
| Scene execution window extension | runbook table row | unverified | DELETE in time; a job's window is its deadline (`job_retry_policy`) | money |
| Success-threshold confirmation | 0 needed; it changes no threshold | preview + apply + evidence | DELETE (D-13) | none |
| Withdrawal deletion approval | 0 withdrawals; approval absent | one file, once | KEEP; install once (D-14) | privacy |
| Disk reclaim (`retire-scene-workspace`, purge) | 3 of 20 requests; 14 disk warnings | minutes | AUTOMATE the retirement of finished workspaces; keep the purge on the owner's word | rights (retained data) |
| Record send, answer or hold by hand | 0 sends in production | form | DELETE (D-09) | none |
| Spend-guard alert triage | about hourly since 11-13 | each read | FIX the cause (D-01) | money |
| Screening call and footage-review Slack bells | per job when triggered | n/a | DELETE (D-11) | none |

## 3. What the operator sees when something is wrong

Saved status, taken apart (`door-status.json`):

- **18 capacity alerts, all `warn`, none `page`.** 4 money: 50% of the month used (296.58 of 400 USD), a forecast to reach 400 USD on 2026-11-30, reconciliation outside tolerance, and World Labs partly unverifiable. 14 disk accounting: storage classes over budget, 64 GB of orphan scratch in 61 folders, and 10 unclassified roots. Free space is 102 GB of 316 GB on the work volume. That is noise today, except the money forecast.
- **207 failed units.** 137 carry a date: 25 in September, 112 in October, none in November. 70 more have undated one-off names (diagnostic, canary, `-r2`). All are finished experiments, except `blueprint-gpu-spend-guard.service`, which is real. That unit has failed 4,850 times since 2026-11-13 on `runpod_inventory_query_failed`. The door lists it under `historical_diagnostics`. That is real trouble, hidden.
- **One hold:** a founder stop on agent-run dispatch. It expired on 2026-10-03 but needs an explicit release.
- **Seven paid launch locks:** all `held: false`. Nothing is held.
- **Stall checks:** 52 scene intents examined, 0 stalled (30 parked on rights, 9 on the execution window, 13 finished). 5 Atlas jobs, 0 stalled. State backup is `not_configured`.
- **Other unit-failure records:** the capacity controller was OOM-killed 7 times (11-13 to 11-20). Scene progression failed 345 times (11-12 to 11-15).

Can a person tell the difference in a minute? No. The one real problem looks exactly like 206 dead ones.

What pages a person, and through what channel: the Pipeline posts every alert, page or warn, to `BLUEPRINT_OPERATOR_ALERT_WEBHOOK_URL` (`control_plane_capacity_controller.py:1028-1058`; warnings also post when a new target appears). The WebApp rings Slack webhooks (`slack.ts`), and the uptime probe posts to `SLACK_WEBHOOK_URL` (`render.yaml:70-81`). Where these land is not recorded in either repo. On-call people are "TBD" (`beta-ops-incident-response.md:20-31`).

## 5. /app/captures

It is a staff upload page from the filming and capture-app era. It handles 360 video, Insta360 `.insv`, splats and 3D models. It asks for a scene id. Rights and consent are two self-attested ticks, then reconstruction plan, authorize and execute (D-05). Only the Evidence questions tool links to it (`JobWorkflowPanel.tsx:142`). The page is admin-gated, but `/api/capture-uploads` checks only sign-in and the invitee allowlist (`server/routes.ts:138-143`, `capture-uploads.ts:815-820`). Sites use a separate router. Nobody needs it: delete it (D-10).

## 6. What the owner cannot see at all

Job counts by state, funnel counts, company response times, a billable-events list, outcome answers across jobs, per-job cost that includes Pipeline providers, running costs, failures. The money data exists in the spend report (`spend_guard.account_monthly_spend`): 296.58 USD counted, 59.75 USD attributed to 10 job ids, and 34.52 USD of that to the retired screening trial. The owner only sees it in a terminal.

## Firestore aggregates wanted

Counts and durations only. No names, addresses, emails, sentences or free text.

| Count | Collection | Filter | Fields to read |
|---|---|---|---|
| Jobs started, by ISO week | `inboundRequests` | site jobs (the `isSiteJobRecord` rule), excluding internal tests | `createdAt` |
| Jobs with video | `captureUploadSessions` joined by capture id | upload completed | `createdAt`, completion time; median upload-to-complete duration |
| Packet shown to companies | `inboundRequests` | listed under the sharing rule (`loadCompanyJobAccess(...).access.listed`) or the first-shown time field | first-shown time; median received-to-shown duration |
| Jobs with at least one response | company responses per job (subcollection the job companies panel reads) | state not null | count per job; first response time; median shown-to-first-response duration |
| Introductions requested | `inboundRequests/*/introductions` (collection group) | all | `requestedAtIso`, `cancelledAtIso`, `cancelReason` |
| Introductions sent | `captureOutbox` | kind `introduction_made_company` and `introduction_made_site`, status sent | status, created and sent times |
| Billable events | `billableEvents` | kind `introduction` | `status` (recorded_no_price or void), `atIso` |
| Outcome answers | outcome records on the job (the 14/45/90-day follow-ups; `siteTaskFollowups` holds 7) | by day mark | day mark, answered yes/no, answered time |
| Companies applied, approved, declined | `robotTeamAccess` | by `status` | `status`, `appliedAtIso`, `decidedAtIso`; median applied-to-decided |
| Companies active | `robotTeamAccess` approved with Terms accepted (`companyMaySeeJobs`) and at least one response in 30 days | | count only |
| Job emails | `captureOutbox` | group by kind and status | count |

## 3. Requirements ledger

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| Admin job list | `AdminJobConsole.tsx:292-334` | owner need; doctrine | the owner cannot find a job | SIMPLIFY (add counts on top) | |
| Standing phrase per row | `jobConsoleData.ts:77-92` | doctrine: where the job stands | the owner cannot see where a job is stuck | KEEP | It is the one-word answer to "where is it stuck". |
| 25-row pages and "Show older jobs" | `jobConsoleData.ts:33-34` | nobody | nothing, if counts exist | SIMPLIFY | |
| Job page: what it has cost | `AdminJobConsole.tsx:251-258` | money hard stop | the 40 USD cap cannot be checked by eye | KEEP (FIX scope, D-04) | It is the only per-job money view. |
| Job page: what stopped it | `AdminJobConsole.tsx:260-270` | doctrine: privacy, rights, money only | stops are invisible | KEEP | It shows only hard stops. |
| Job page: what happened (timeline) | `AdminJobConsole.tsx:272-283` | nobody named | the history of a job is lost | KEEP | It is the only record of sends, answers and introductions in time order. |
| Download simulation package / viewer | `AdminJobConsole.tsx:243-249` | doctrine: the simulation is in the packet | staff cannot check what companies get | KEEP | It is how staff see what companies get. |
| Record a send made by hand | `JobCompaniesConsole.tsx:145-160` | package C1 2026-11-12 | nothing (0 sends) | DELETE | |
| Void a send | `JobCompaniesConsole.tsx:172-173` | package C1 | nothing | DELETE | |
| Record an answer a company emailed | `JobCompaniesConsole.tsx:191-210` | package C1 | nothing (0 sends) | DELETE | |
| Stop showing this job to companies | `JobCompaniesConsole.tsx:136-142` | package C1; contradicts "no pause" | a staff pause; privacy cases go through withdrawal | DELETE | |
| Site measurements tool | `SiteMeasurementsConsole.tsx` | founder decision 2026-10-19 (qualification requests) | measurement exports for retired qualification runs | DELETE (verify use first) | |
| Evidence questions tool | `JobWorkflowPanel.tsx`; `jobEvidenceRequests` 0 | nobody | nothing (0 records) | DELETE | |
| Robot fit console on staff pages | `RobotFitConsole.tsx` | screening era ("whom to ask to evaluate") | the first look stays on the site page | MERGE into the first look, or DELETE | |
| Account deletion queue | `AccountDeletionQueue.tsx` | privacy hard stop | deletion requests go unseen | KEEP | Privacy requests need a place to be seen. |
| Approvals page | `AdminRobotTeamAccess.tsx` | doctrine: approve each company once | no one can approve | MERGE into `/admin/jobs` | |
| Approve confirm box | `AdminRobotTeamAccess.tsx:198` | nobody | nothing | DELETE | |
| Approve note prompt | `AdminRobotTeamAccess.tsx:199-205` | nobody | nothing | DELETE | |
| "Not yet" decline | `AdminRobotTeamAccess.tsx:325` | owner 2026-11-19 (no email for decline) | an application stays pending forever | KEEP | It is one press and it closes the item. |
| Invite a team you spoke with | `AdminRobotTeamAccess.tsx:73-120` | doctrine: Blueprint approves | owner-led outreach has no path | KEEP (one line) | Approved outreach needs a way in. |
| Review an existing job (recommendation) | `AdminRobotTeamAccess.tsx:283-330` | screening era | nothing named | DELETE | |
| Early-access Render hint | `AdminRobotTeamAccess.tsx:56-60` | nobody | nothing | DELETE | |
| Fit checklist on an application | `robot-team-access.ts:80-81` | nobody | nothing; admission is manual | DELETE | |
| Slack bell for an application | `slack.ts:138-165` | nobody named | the owner does not hear of applications | MERGE into one approval email with a link | |
| Slack bell: screening call | `slack.ts:93-114` | retired | nothing | DELETE | |
| Slack bell: footage review by hand | `slack.ts:122-136` | retired lane | nothing | DELETE | |
| `/app/captures` page and `/api/capture-uploads` | `routes.tsx:336`; `capture-uploads.ts` | retired filming visits | nothing | DELETE | |
| Deploy window 15:00 UTC | pipeline `AGENTS.md` D-08 | D-08 2026-11-02 | nothing (not followed) | DELETE | |
| Door activation hold during paid work | pipeline `AGENTS.md` D-08 | D-08; money | in-flight paid work retired by a deploy | KEEP | It protects money already spent on a job. |
| Record each deploy in the tracker | pipeline `AGENTS.md` | D-08 | nothing; the receipt exists | DELETE | |
| Spend guard requires RunPod inventory | pipeline `AGENTS.md` RunPod row | retirement transition | a constant false alarm | FIX | |
| Spend guard itself | `scripts/gpu_spend_guard.py` | money hard stop | orphaned GPUs bill silently | KEEP | It is the proof no machine is left running. |
| `beta_screening` section of door status | door status | retired 2026-11-14 | nothing | DELETE | |
| `failed_units` list with old experiments | door status | nobody | nothing | SIMPLIFY | |
| Expired holds and unheld locks in the default view | door status | nobody | nothing | SIMPLIFY | |
| Disk usage warnings posted to the alert route | `control_plane_capacity_controller.py` | capacity runbook | nothing urgent | SIMPLIFY (digest) | |
| Stall alarm | `control_plane_stall_alarm.py` | job retry policy | stuck paid jobs go unseen | KEEP | It found 0 stalls correctly on 11-22. |
| Success-threshold confirmation | `OPERATOR_DOOR.md:794-822` | made redundant by owner 2026-11-07 | nothing | DELETE | |
| Withdrawal deletion standing approval | `beta-operations.md:853` | privacy; owner approves deletions | deletions wait on a person | KEEP (install) | The owner's word is required to delete retained data. |
| Scene execution window extension | `beta-operations.md` section 1 | money | a job past its window | DELETE in time | |
| Vast credit page | `provider_credit_admission.py` | money | instances stop when credit runs out | KEEP | Vast stops every machine at zero balance. |
| Account monthly limit and its alerts | `account_monthly_spend_limit.v1.json` | owner 2026-11-12, 11-20 | spend runs past the budget | KEEP | Money hard stop set by the owner. |
| `/admin/company-metrics` redirect to `/` | `minimalPublicSite.ts` | nobody | nothing | DELETE | |
| `/admin/leads`, `/ops` redirects | `routes.tsx:90-93, 315-320` | old alert links | old links break | KEEP | Old alerts still link there. |

## 4. Findings with evidence

The full set, with evidence, is in `raw/journey-D.findings.json` (17 findings). The most important:

- **D-01 (P0, fragile).** The money guard has failed every run since 2026-11-13. It is `blocked` on `runpod_inventory_query_failed`, with 4,850 failures, and posts about hourly. RunPod was retired on 2026-11-05. The door files the unit under history. Fix: drop RunPod from the required providers or remove its key (owner).
- **D-02 (P1, business).** Billable events have no list across jobs (`billableEvents.ts:48-52` is per job only).
- **D-03 (P1, unseen).** No counts or funnel anywhere. `/admin/company-metrics` sends the owner to the home page.
- **D-04 (P1, unseen).** 236.83 of 296.58 USD this month belongs to no job. The job page shows WebApp ledgers only. Forecast: the 400 USD limit is reached on 2026-11-30.
- **D-05 (P1, vestigial).** The screening trial still appears: 34.52 USD booked to screening, and a worker reporting 28,642 blocked preparations.
- **D-06 (P1, over-gated).** Deploy window: 129 deploys in 18 days, 100 outside it.
- **D-07 (P1, unseen).** The status is mostly dead experiments. A person cannot find the real fault in a minute.
- **D-08 (P1, friction).** Company approval takes seven steps and two browser dialogs.
- **D-09 (P1, over-gated).** Hand-recorded sends, answers and a staff hold, never used in production.
- **D-10 (P1, fragile).** `/app/captures`: the page is staff-only, but its API is open to any invited account, including reconstruction execute. Rights come from the uploader's ticks.
- **D-12 (P1, fragile).** The alarm process was OOM-killed 7 times. State backup is not configured.
- **D-14 (P1, missing).** The withdrawal deletion approval was never installed.
- **D-16 (P1, fragile).** Alerts go to webhooks of unknown destination. On-call names are TBD.
- **D-17 (P1, business).** One company record, 0 sends, 0 introductions in production.
- D-11, D-13 and D-15 are P2.

Screenshots: `screenshots/D-01-jobs-list-{1280,390}.png`, `D-02-job-detail-*`, `D-03-job-companies-tool-*`, `D-04-company-approvals-*`, `D-05-app-captures-*`, `D-06-app-overview-*` (all APIs mocked to 503, so it shows the error state), `D-07-admin-leads-redirect-*`, `D-08-company-metrics-redirect-*`. The first Deployment companies screenshot crashed with "Something went wrong". The cause was my fixture (an object where the type says string), not the product. It was retaken with the correct shape.

## 5. What works well and should be left alone

- **The admin job page's honesty rule.** Each part shows only when a record backs it (`AdminJobConsole.tsx:1-8`). It reads cleanly at 390 px.
- **Old alert links still land on the right job.** `/admin/leads/:id` goes to `/admin/jobs?job=` (D-07 screenshot).
- **The spend report already knows the answers.** It has the counted month, the forecast date, per-provider reconciliation and per-job meters. Show it; don't rebuild it.
- **The stall alarm's skip rules.** 52 intents were examined, 0 false stalls, and intended holds do not page.
- **The billable event is written in the same transaction as the introduction** and is voided, never deleted (`jobIntroductions.ts:118-151`, `jobIntroductionGate.ts`). That is what a future invoice needs.
- **Retries are automatic** (`website_preparation_retry.py`). The operator's nudge is an override, not the path.

## Not covered

Production funnel counts (listed above for the orchestrator). Where the alert webhooks land (a host secret). The measurements, robot fit and evidence tools were not exercised with data. The real load time of the job list against Firestore was not measured. Other journeys' pages.
