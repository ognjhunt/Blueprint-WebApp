# Plan: three waves of small PRs

2026-11-22. Nothing here is done yet. The audit changed nothing. Each row is
one small PR, or one owner step. Ids in brackets are in `findings.md`.

**Checks.** "WebApp checks" means `npm run check`, `npx vitest run
client/tests`, the tests named in the row, and `npm run test:core-journey`
for anything on the loop. "Pipeline checks" means `python -m
blueprint_pipeline.impacted_test_selection` and the project's ruff
(`$BLUEPRINT_PIPELINE_PYTHON -m ruff check <changed files>`). Before any
Pipeline fix for a stopped job is deployed, replay the job's next step on the
branch (`python -m blueprint_pipeline.task_evaluation_stage_replay --child
<id> --isolate`). It pays for nothing.

**Owner OK** is marked where a PR touches a recorded statement, a legal page,
money, privacy or outreach. No PR below edits a recorded statement, a legal
page or a guard without it.

## Wave 0: owner steps, this week, no code

| # | Step | Why | Finding |
|---|---|---|---|
| O1 | Ask the one approved company to sign in and accept the Terms. Approve or invite three to five more. Post one US job under the current sharing statement. | Today no company can see a job, and no existing US job could be shown to one: every US job is under an older statement. Outreach only to companies Blueprint has approved or the owner chooses. | D-17 |
| O2 | Close the RunPod account and delete its key file on the host. | The money guard turns green by itself. No code change. | D-01 |
| O3 | Install the standing approval for deletion after a withdrawal. | Privacy: today nothing is deleted on the Pipeline side after a withdrawal. | A-08 |
| O4 | Set up the backup bucket and key for the control plane. | Money and job records on the one host have no backup. | F-01 |
| O5 | Close PR 1369 unmerged. | It holds invented quotes and counts. | E-04 |
| O6 | Decide December's account limit before the outreach. | It returns to $300 on 1 December. Costs with no job behind them ran about $9.30 a day in November, about $288 a month. That leaves about $12 for jobs; one job used $8.46. Once the limit is reached every paid step is refused until January. | K-01 |
| O7 | Answer the questions in `owner-questions.md`. | They unblock waves 1 to 3. | |

## Wave 1: this week. Make the loop able to run once, safely

| PR | Repo | Scope | Checks beyond the standard set | Owner OK | Finding |
|---|---|---|---|---|---|
| 1.1 Reply reaches the other side | WebApp | For the two introduction emails, send with the row's stored Reply-To. Update the test that pins hello@. | `npx vitest run server/tests/capture-outbox.test.ts`; core journey | yes (launch-copy owner question 6) | A-01 |
| 1.2 A window ending never unlists a job | WebApp | In `teamJobAccess`, close a listing only for a withdrawal, a source revocation or an owner close. A window ending keeps the job listed and Introduce us working. Then drop "start a new job" from window endings. | tests for `teamJobAccess`, `jobIntroductionGate`; core journey | no | G-01, A-07 |
| 1.3 A launch's hold matches what it spent | Pipeline | Corrected on 2026-11-22: five of the seven launches did rent a machine briefly, so "settle at $0" was wrong for them. Let the existing $0 rule read its proof after a run's folder is moved off the host; settle a torn-down launch at the amount its records prove. | replay; settlement tests | yes (money path) | C-03 |
| 1.4 Admin role on the captures API | WebApp | Add the admin check to the `/api/capture-uploads` mount. | route tests | no | D-10 |
| 1.5 An introduction survives an outage | WebApp | Let a site ask again when the company email failed. Key the emails and event by attempt. Keep the void on the old event. | `jobIntroductions`, `jobCompanies` tests; core journey | no | F-03 |
| 1.6 The billable event records "made" | WebApp | When the company's email is sent, write `madeAtIso` on the event. | billable event tests | no | O-07 |
| 1.7 Follow-ups outlive a closed job | WebApp | Keep the 14, 45 and 90 day questions going after a site closes its job. Not after a withdrawal. | `jobOutcomes` tests | no | F-04 |
| 1.8 "Posted" only when a company can see it | WebApp | The job page says "Posted for approved deployment companies" only when at least one company may see jobs. Otherwise one honest line. | `siteAnswer` tests; public claims guard untouched | yes (site-facing wording) | L1-N1 |
| 1.9 Long uploads are not cut | WebApp | Lift the 300 second request limit on the upload route. Then send a picked file through the existing parts route. | upload tests; `playwright.intake-durability.config.ts` | no | F-05 |
| 1.10 "Recover saved job" stops looping | WebApp | On the already-in-use answer, open the saved job instead of asking again. | `e2e/site-intake-durability.spec.ts`; fix the stale A-IDB-04 test in the same PR | no | A-03, F-13 |
| 1.11 Non-US: no sharing agreement offered | WebApp | A non-US job page offers no sharing agreement and says the video cannot be taken yet. | start form and job page tests | yes (privacy; recorded statement untouched) | A-02 |
| 1.12 Production refuses the development consent fields | WebApp | The server ignores the two authoring consent fields outside development. | `inbound-request` tests | yes (privacy; two production records carry them) | A-04 |
| 1.13 Deploy the Pipeline | Pipeline | Request the window deploy of `main`. It carries the Privacy version fix already merged. | door status before and after | no | IP-07 |

Demo, same week: record the core journey once with video on, and make the
dated fact sheet (`demo-script.md`). No repository change.

## Wave 2: the next two weeks. A packet in hours, and an owner who can see

| PR | Repo | Scope | Checks beyond the standard set | Owner OK | Finding |
|---|---|---|---|---|---|
| 2.1 Find out why the room fallback did not fire | Pipeline | For the captures with `company_simulation_no_source`, trace which rule returned nothing. Replay only. Write down the cause before changing code. | replay; `tests/test_website_company_simulation.py` | no | C-01 |
| 2.2 Ship the room as the simulation, flagged | Pipeline | Make the room package the source as soon as the room is ready. The GPU object build no longer gates it. | replay; the 495 package tests | yes (what a company is given changes) | C-01 |
| 2.3 Sound-free video first (do this first in wave 2) | Pipeline | Build the clip right after hand-off, before paid preparation is admitted, with the same rights check. A wait for money then holds back only the simulation, not the listing. | `tests/test_website_company_clip.py`; replay | no | G-02 |
| 2.4 No "film it again" for a fit code | Pipeline | Ship the room flagged instead of asking for a new video. | `website_scene_handoff` tests; replay | no | C-04 |
| 2.5 Ship flagged after one failed retry cycle | Pipeline | Replace "wait until two hours before the window ends". | same | no | G-04 |
| 2.6 Parked jobs retry by themselves | Pipeline | Retry parked room builds after a deploy; keep retrying a preparation until its grant ends; page on a lost dispatcher. Money that cannot be proven stays a hand settlement. | retry policy tests; replay | no | F-10, F-02 |
| 2.7 Deploys stop retiring work | Pipeline | A preparation finishes on the release that started it. Until then, the door's hold also covers a preparation in flight. Then delete the once-a-day rule from `AGENTS.md`. | door tests | yes (the deploy policy is the owner's) | C-02 |
| 2.8 Totals and a billable list | WebApp | One line of counts on `/admin/jobs` and a CSV of billable events. | admin console tests; `npm run qa:operator` | no | O-06 |
| 2.9 Approve in one press | WebApp | The application email to the owner carries one Approve link. Remove the confirm text that names a retired review. | admin route tests | yes (who may see jobs) | D-08, B-18 |
| 2.10 Applicants are told | WebApp | One fixed email to a declined applicant, and a stated reply time on the receipt. | email tests | yes (reverses the 2026-11-19 decision) | B-08 |
| 2.11 Shorter way in for a company | WebApp | The invitation link signs the address in. One Terms press. No password step. | workspace specs | no | B-07 |
| 2.12 Tell companies when a simulation is ready | WebApp | One email per job when the package is ready, and a list of open jobs at approval. | outbox tests | no | B-03 |
| 2.13 Ask later companies to delete too | WebApp | The withdrawal notice goes to every company that opened the job. | withdrawal tests; core journey | yes (Terms promise) | M-01 |
| 2.14 Stop keeping email copies | WebApp | Remove the delivery-event store. Clear address, link and body from sent outbox rows. Redact job text in model-run records. | webhook and outbox tests | yes (privacy; deleting stored data) | O-01, O-02, O-04 |
| 2.15 Remove unused upload rules | both | Drop the client write rules for retired folders, in both repositories together. Confirm the deployed rules first. | `npm run test:rules`; `npm run rules:parity` | yes (money) | IW-04 |
| 2.16 One heartbeat per worker loop | WebApp | Alert when the send, outcome, withdrawal or deletion loop stops. | worker tests | no | F-11 |
| 2.17 Clear the host's dead units | host | Door requests to reset the stale failed units and remove the host-only ones. | door status after | yes (operate request) | IP-03 |
| 2.18 Record what an invoice needs | WebApp | Ask each company once for its legal name and billing email at the Terms step. Freeze them and the Terms version on each event. No price. | company Terms tests | yes (money) | O-05 |

## Wave 3: the next month. Subtract

Each row is a series of small PRs in the order given in `delete-list.md`.

| Series | Repo | Scope | Owner OK | Finding |
|---|---|---|---|---|
| 3.1 The trial leaves the Pipeline | Pipeline | The seven-PR cut. Rename the 17 shared helpers first, then delete. Keep the withdrawal and money readers. | no | IP-05 |
| 3.2 The trial leaves the WebApp | WebApp | Start from each caller. Keep the routers that carry today's job. | no | IW-02 |
| 3.3 Idle lanes and their timers | Pipeline | Episode compilation, rigid probe, retired console scripts, units nobody reads. | yes for the rigid probe and Astra | V-01, IP-16 |
| 3.4 Retired disk | host | Delete the retired-lane trees after a withdrawal-record check. Record role and bytes on every disk refusal. | yes (deleting retained data) | C-12 |
| 3.5 Dead WebApp surface | WebApp | The staff captures page and its API, the routes nothing calls (not the two launch routes), about 9,000 lines that never run, the old onboarding checklist, unused packages. | yes for supply-agreement and marketplace routes | D-10, IW-01, IW-05, IW-08 |
| 3.6 Retired data | WebApp | Export counts, then delete the retired collections. | yes (deleting retained data) | IW-11 |
| 3.7 Retention | WebApp | One period for recordings and one sweep. | yes (legal text and privacy) | M-02 |
| 3.8 Legal text matches the product | WebApp | Cookie wording, the processor list, non-US terms. The owner edits; nobody else changes these pages. | yes (legal pages) | M-03, O-12 |
| 3.9 Fewer status sentences, emails and fields | WebApp | About 70 status sentences to 5. Drop the filler line and its test pin. Shorten the new-video request. | yes for emails and site-facing wording | A-06, A-10, A-11, A-12 |
| 3.10 Spend limits | Pipeline | Delete the limits of retired lanes and the two alert lines above the account limit. Keep every limit that does real work. | yes (money) | G-07 |
| 3.11 Join the two cost ledgers | both | One cost per job on the staff page. | no | D-04 |
| 3.12 Documents that name deleted files | both | Fix or delete them. | no | IP-09 |

## Order inside the plan

Wave 0 first: without a company, nothing else can be seen working. In wave 1,
PRs 1.1 to 1.3 come first. In wave 2, 2.1 comes before 2.2. Deletions wait
for wave 3 so that they do not collide with the fixes.
