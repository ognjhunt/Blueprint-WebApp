# Journeys

First-principles audit, 2026-11-22. Each journey was walked end to end as a
first-time user, at 1280 px and 390 px where there is a screen. Each has the
journey as it is today, then the journey as proposed, with the step count
before and after. Friction is scored 0 (none) to 5 (the journey stops).

Waits come from real records where they could be read safely. Anything not
measured says "unverified". The Pipeline's numbers rest on three jobs (one real,
two internal tests), so they are observations, not averages.

## Before and after, at a glance

| Journey | Today | Proposed | What else changes |
|---|---|---|---|
| A. Site, landing to introduction | 14 steps (12 to the first introduction) | 10 steps (8) | Required fields stay at 3; the conditional country field and 3 optional fields go. Emails before the first introduction: 4 to 3. Stopping: 4 taps to 2. Status sentences a site can be shown: about 74 to 5. |
| B. Deployment company, Find jobs to answer | 17 steps (12 to the first answer) | 12 steps (7) | Application fields: 8 and a password, to 4 and no password. Terms agreements: 2 to 1. Clicks to the first answer: 7 to 5. |
| C. Pipeline, video to packet | 14 steps, one of them a wait for a person | 5 steps, none waiting for a person | A simulation a company can open: never produced today; about 6 to 7 hours after upload as proposed (an estimate from one real job's reconstruction time). |
| D. Owner and operator | 8 owner steps, a terminal and two web addresses | 3 steps on one page, plus approval in one press from an email | Kinds of manual operator step: about 12 to 6. |
| E. Investor walkthrough | 7 steps, 2 sign-ins; steps 4 to 7 cannot be shown truthfully today | 5 beats, no sign-in on stage | See `demo-script.md`. |

The one fact that shapes every journey: in production no job has been sent to a
deployment company, no company has answered, and no introduction has been made
(`evidence/production-counts/`). Journeys A and B describe what the code does,
proven by tests and the emulator run, not by a real company.

## Corrections after checking

A second agent tried to refute every P0 and P1 finding. Where it corrected a
number or a fact in a journey table below, this list is right and the table
is as the walking agent wrote it:

- **A, step 7.** The job page has 35 status headlines, about 70 sentences in all, not 74. The dropped trial's phases show to a site as "simulation ready", not in trial words.
- **A, step 6b.** There is no separate reminder email; the four-email list was the owner's choice on 2026-11-19.
- **A, step 12, and B, step 15.** The introduction emails say to write to the address shown. A reply still goes to Blueprint. Friction, not an untrue sentence.
- **B, step 3.** The approver does read the application's robot, jobs and region answers. The narrower defects: the website field is optional and hidden, and the region check cannot match a state or city.
- **B, step 7.** The password is optional (Google sign-in is offered) and the application's Terms line is a notice, not a second tick. The one approved company in production stopped at this step.
- **B, step 17.** Jobs sent to nobody, because no company had accepted the Terms, wait and go out when the first one does. A company that accepts after a job's send is never emailed about it.
- **C, steps C.3 and C.9 to C.12.** The operator replay is history: such a hold now re-runs once per release. A fallback from the built scene to the room already exists and did not fire.
- **C, deploys.** 153 deploy receipts in November; about 4 a day after 11-13; none since 11-20.
- **D, manual steps.** The deploy count is 153, not 129. The worker runs six loops, not seven. The staff hold must stay as a privacy and rights stop.
- **E.** Introduce us on a real job needs a company answer first, and none exists. PR 1369 is unmerged and behind a flag that is off.

## A. The site: from landing to an introduction

Full report, requirements ledger and evidence: [`raw/journey-A.md`](raw/journey-A.md).

### The journey today

The persona is a US cafe or warehouse manager on a phone. They take the default path: start the job, then film it.

| # | Step | Screen or email | What the user does | Wait (source) | Failure modes | Friction 0–5 |
|---|---|---|---|---|---|---|
| 1 | Arrive | `/` (A-01) | Reads the title, the sub-line and "Free for sites." | 0 | Cookie banner covers the lower quarter on a first visit (A-01-390) | 1 |
| 2 | Optional: How it works | `/how-it-works` (A-02) | Reads three steps | 0 | none | 0 |
| 3 | Start | `/contact/site-operator` (A-03) | Taps "Start a job" | 0 | none | 0 |
| 4 | The form | A-04 to A-07 | Types the job in one sentence, where the job is (and the country when no suggestion is picked, A-06), and an email; optional "Add details" (3 more fields). Scrolls, then taps "Next: film the job" | 0 | Typed text with no suggestion picked brings up a second field for the country (A-04, A-06). Outside the US, "Save my job" saves a draft that can never be posted (A-06). "Recover saved job" can loop (A-09, finding A-03) | 2 |
| 5 | Film | Job page, camera (A-08-390, A-10-390) | On a phone the browser goes straight to the job page. Taps "Open the camera", allows the camera, records one round, stops | Upload time unmeasured; parts upload while filming (`CaptureRecorder.tsx:49-61`) | Camera blocked gives a clear message (`CaptureRecorder.tsx:268-276`). Chrome without mp4 recording falls back to the camera app plus upload (`CaptureRecorder.tsx:14-23`). A file over 1 GB is accepted and then goes nowhere (finding A-05) | 2 |
| 6 | Email 1 | "Your Blueprint job link" (`taskLifecycleNotifications.ts:50`) | Nothing, unless it is used later as the way back | immediate (outbox) | A site that filmed already gets "A video is required to post your job" anyway | 1 |
| 6b | Email (only without a video) | "Your job is waiting for its video" (`siteActionNeeded.ts:45`) | Films | a day after the start (`FIRST_VIDEO_REMINDER_AFTER_SECONDS = 86400`) | The job ends after 7 days without a video (`websiteJobWindowEnding.ts:110`) | 1 |
| 7 | Wait for the packet | Job page (A-11, A-13, A-14) | Reads where the job stands. May answer up to 5 "quick questions" | see journey C | Up to 39 different status headlines, plus filler (finding A-06, A-10) | 2 |
| 8 | Email 2 | "Your job is posted" (`taskLifecycleNotifications.ts:61`) | Nothing | once the job is shared | Repeats what the site agreed to when it sent | 1 |
| 9 | Wait for responses | Job page (A-14): "Viewed by 0 companies · 0 responses" | Nothing | unbounded; no promise is made (correct) | none | 1 |
| 10 | Email 3…n | "A deployment company answered", one per company and answer | Taps "Open your job" | per answer | none | 1 |
| 11 | Introduce us | Job page (A-15) | Taps "Introduce us" beside an Interested company | 0 | none in the code (one transaction, `jobIntroductions.ts:103-170`) | 0 |
| 12 | Email n+1 | "Meet {company}" (site); the company gets "A site wants to talk about its job" | Writes to the company | after the company's email is sent (`jobIntroductions.ts:162-168`) | A reply goes to Blueprint, not to the other side (finding A-01) | 2 |
| 13 | Days 14, 45, 90 | "How did it go with {company}?", five links, then a confirm page | Two taps | timed (`jobOutcomes.ts:1-13`) | none seen; the core journey covers day 14 | 1 |
| 14 | Leaving | Job settings › Stop using my video › Stop using my video… › Yes, stop using my video | 4 taps (`e2e/site-answer-journey.spec.ts:403-406`) | the site's view changes at once | The Pipeline deletes nothing without an owner approval that is absent (finding A-08) | 2 |

Totals from landing to the first introduction:

- Steps: 12 (14 with follow-ups and leaving).
- Clicks: about 9: Start a job; the cookie banner; Next: film the job; Open the camera; allow the camera; record; stop; the email link; Introduce us. Scrolling on the form comes on top.
- Fields: 3 required (sentence, place, email), plus 1 country select whenever no suggestion is picked. There are 3 optional fields under "Add details", and up to 5 optional quick questions on the job page (`client/src/lib/jobFacts.ts:17`). There are 15 question keys in all.
- Waits: 2 unbounded ones (packet, responses), plus the upload.
- Emails to the site: at least 4 before the first introduction (job link, job posted, one answer, Meet). Add 1 reminder if there is no video after a day, one more per extra answer, and 3 follow-ups per introduction.
- Sign-ins: 0. The private link is the credential. That is good.
- Dead ends found: 3. They are the 409 recovery loop (A-03), the non-US sharing agreement (A-02) and "start a new job" on endings that were Blueprint's fault (A-07).

Step 1, measured (`agents/journey-A/public-metrics.json`):

- At 390 px, 74 words are visible above the fold. About 24 of them are the cookie banner and 6 the header. The message itself is the 5-word title, the 12-word sub-line, "Start a job" and "Free for sites.".
- At 1280 px there are 115 words, because the moving example card and the footer fit too.
- There is one primary call to action, "Start a job". Competing links: 3 in the header (How it works, Find jobs, Sign in), 6 example category buttons with a pause button, and 4 footer links.
- What it costs is clear inside 10 seconds: "Free for sites." sits right under the button at both widths.
- What the site gets is clear: "find out who wants to deploy robots for it".
- There is no sideways scroll (`scrollWidth` 390 at 390).

The start form is 1,204 px tall at 1280 and 1,314 px at 390. Its button and the sentence the site agrees to are below the first screen at both widths (A-03).

### The journey as proposed

| # | Step | Screen or email | What the user does | Wait | Friction |
|---|---|---|---|---|---|
| 1 | Arrive | `/` (unchanged) | Reads, taps Start a job | 0 | 1 |
| 2 | One screen | Start form: "Film it now" / "I have a video", the job in one sentence, "Is the job in the United States? Yes / No", email; the button and the agreement line on the first screen | 3 inputs, 1 button | 0 | 1 |
| 3 | Film | In-page camera (unchanged). A file over the real limit is refused at selection, in one sentence | Films | upload | 1 |
| 4 | Email 1 | Job link. It also says the job goes to approved companies once the video is in, and how to stop (it absorbs "Your job is posted") | none | 0 | 0 |
| 5 | Wait | Job page in one of 5 states: we're watching your video / we need one thing from you / sent, no response yet / responses / stopped | none | see journey C | 1 |
| 6 | Email per response | One email per company answer | Taps link | per answer | 1 |
| 7 | Introduce us | Unchanged | 1 tap | 0 | 0 |
| 8 | Email | "Meet {company}" with Reply-To set to the company (and the reverse) | Replies | 0 | 0 |
| 9 | Days 14/45/90 | Unchanged | 2 taps | timed | 1 |
| 10 | Leaving | "Stop using my video" on the job page, then one confirm | 2 taps | 0 | 1 |

That is 14 steps before and 10 after. To the first introduction: 12 steps before, 8 after. Fields drop from 3 required plus up to 1 conditional plus 3 optional to 3 required. Emails before the first introduction drop from 4 to 3.

Deletions I expect might come back:

- The "Your job is posted" email. The owner may want it as a privacy notice at the moment of sharing.
- The free-text place. A company may want a city before it says Interested; today it sees only the country (`taskBrowse.ts:63`).
- The quick questions. Companies answering "Need more details" may ask for exactly these facts.

## B. The deployment company: from Find jobs to taking the job

Full report, requirements ledger and evidence: [`raw/journey-B.md`](raw/journey-B.md).

### The journey today

Wait sources: live load times measured with Playwright on 2026-11-22 (`live.cjs`). Local timings are with mocked server answers, so they measure the browser only.

| # | Step | Screen or email | What the user does | Wait (source) | Failure modes | Friction 0-5 |
|---|---|---|---|---|---|---|
| 1 | Land on Find jobs | `/jobs` (B-01, B-16 live) | Reads the heading and the form | Live load to network idle: 3.1 s at 1280, 1.1 s at 390 (measured) | None seen. No horizontal scroll at 390 (scrollWidth 390) | 1 |
| 2 | Look at the sample job | `/jobs#sample-job` (B-02) | 1 click "See a sample job" | none | At 390 the sample sits below a 6-field form (B-01-390), so the stranger is asked to apply before seeing what they get | 2 |
| 3 | Apply | Form "Apply to see jobs" (B-03) | Types 6 required fields (name, work email, company, jobs you deliver, robots, where you deploy); website hidden under "Add your website"; optional updates box; 1 click Apply | Typing: unverified (6 fields, three of them free text; a guess of 2 minutes is not a measurement). Save round trip mocked: 243 ms | Terms "agreed" by applying, though the server says this tick never counts (`companyTerms.ts:31-41`) | 3 |
| 4 | Receipt | "Your application is saved." (B-04) | Reads | none | No email receipt (owner, 2026-11-19, `robot-team-access.ts:91`) | 1 |
| 5 | Wait for approval | nothing | Waits | Unverified: no measurement exists. See "Firestore aggregates wanted" | No status page an applicant can reach: `/contact/robot-team` shows "in review" only to a signed-in account, and an applicant cannot have one (sign-up is invitation-only). Declined: never told (`robotTeamEarlyAccess.ts:211` "Only an approval is emailed") | 4 |
| 6 | Approval email | "Your company is approved to see jobs on Blueprint" (`robotTeamAccessEmails.ts:24-65`) | Opens; 3 links (set up account, Find jobs, book a call) | Outbox delivery: unverified | Link expires in 7 days | 2 |
| 7 | Create account | `/signup/business?invitation=…` (B-06) | Password (8+), ticks Terms box, clicks Create account (or Google) | none measured | A second Terms agreement; "Review account details" disclosure re-asks name and company already given | 2 |
| 8 | Terms prompt (only after a Terms change that asks again) | Find jobs (B-07) | 1 click "I agree" | none | Hidden cost: until then the company gets no new-job email either (`newJobAlerts.ts:63`) | 1 |
| 9 | Job list | `/contact/robot-team` (B-08) | Scans cards, 1 click "View job" | none | Every card is a category name and a country ("Move materials · United States"); several look identical | 3 |
| 10 | Job page | `/jobs/:id` (B-09, B-10) | Reads sentence, done rule, site answers, video, object estimates, "does not show", first look | none | Region is the country only; rate often "not stated"; no route or floor plan | 2 |
| 11 | Download and open the simulation | "Download the simulation" | Unzips; opens `scene.usda` | Zip build is Pipeline-side; size up to 512 MiB (`website_company_simulation.py:96`) | Only USD and an optional PLY; MuJoCo, trimesh cannot open it (command below) | 3 |
| 12 | Respond | Form "Your response" (B-11) | 1 radio + 1 click Send (note required for Need more details) | mocked | After saving: "Saved. The site sees this answer, without your company's name." Nothing says what happens next | 2 |
| 13 | Report simulation result | "Report simulation result" (B-12) | 1 link + 1 radio + a required note + 1 click | mocked | The old "Saved…" message and "You answered Interested" show inside the new form | 2 |
| 14 | Wait for the site to press Introduce us | nothing | Waits | Unverified | No notice that the site has looked or decided | 3 |
| 15 | Introduction email | "A site wants to talk about its job" (`robotTeamAccessEmails.ts:169-200`) | Reads the site's details, writes to the site | Outbox delivery: unverified | Pressing Reply writes to hello@tryblueprint.io, not the site | 3 |
| 16 | Outcome questions at 14, 45, 90 days | "How did it go with {site}?" (`jobOutcomes.ts:55-70`) | 2 presses (link, then confirm) | Timers 14/45/90 days | None found; stops after a final answer | 1 |
| 17 | New-job emails | "New job on Blueprint" (`robotTeamAccessEmails.ts:153-163`) | Opens each to learn what it is | Sent once, when the job is first listed | Says nothing about the job; no email when the simulation becomes ready | 3 |

Totals today, from a stranger to a first answer on a job (steps 1 to 12):

- Steps: 12 to the first answer, 17 in all.
- Clicks: 7 (sample, Apply, email link, Create account, View job, choose answer, Send).
- Fields typed: 6 required on the application (plus 2 optional), 1 password, 1 Terms box (2 more prefilled behind "Review account details"), 0 to 1 note on the answer.
- Waits: 1 human wait of unknown length (approval), 1 email delivery, then the site's decision.
- Emails: 1 approval, 1 per new job, 1 introduction, up to 3 outcome questions.
- Sign-ins: 1 (account creation signs in). Terms agreed: 2 times on the normal path, 3 after a Terms change that asks again.
- Dead ends: an applicant's status (unreachable), a declined applicant (never told), a reply to the introduction email (reaches Blueprint).

### The journey as proposed

| # | Step | Screen or email | What the user does | Wait | Friction 0-5 |
|---|---|---|---|---|---|
| 1 | Land on Find jobs, sample job first | `/jobs` | Reads the sample, then the form below it | as today | 1 |
| 2 | Apply | 4 fields: name, work email, company, company website | 1 click Apply | typing about a third of today's | 1 |
| 3 | Wait for approval | page and form say "We reply within N days" (owner sets N) | waits | approval; an alert to the owner if past N | 3 |
| 4 | Approval or "not yet" email | one email either way | 1 click "Open Find jobs" | delivery | 1 |
| 5 | First visit | the link signs the address in; one "I agree" press | 1 press | none | 1 |
| 6 | Job list | cards carry the site's sentence, state and country, and Ready to test | 1 click | none | 1 |
| 7 | Job page | as today plus state, with one answer form | reads | none | 1 |
| 8 | Download the simulation | USD plus a plain mesh (GLB or OBJ) of the room and object; README explains each rule number | opens | none | 2 |
| 9 | Respond | one form, five answers once the simulation is ready | 2 presses | none | 1 |
| 10 | Told what is next | "Saved. If the site asks to meet, we email you its details." | reads | none | 0 |
| 11 | Introduction email | Reply reaches the site | replies | delivery | 1 |
| 12 | Outcome questions; new-job emails that name the job type and state, plus one "ready to test" email | 2 presses each | | | 1 |

Step count before and after: 17 to 12 in all; 12 to 7 before the first answer. Clicks to first answer: 7 to 5. Fields: 8 application fields plus a password to 4 fields and no password. Terms agreements: 2 to 1.

Deletions I expect might come back, and why:

- The "Which robots do you deploy?" question. The owner may want it to judge borderline applicants. The website and the work email should usually be enough; if they are not, the owner can ask in the approval reply.
- The password. A company that wants to sign in from a new device without email access would want one. The "Email me a new link" form already exists and covers it.
- The second form for simulation results. If companies confuse "Interested" and "Tested it: can do" in one list, the split may return.

## C. The Pipeline: from video to packet

Full report, requirements ledger and evidence: [`raw/journey-C.md`](raw/journey-C.md).

### The journey today

One job, `capture-39ecdc97`, handed off 2026-11-11 18:44:49Z. Waits are measured from host records unless
marked. Friction is 0 (none) to 5 (job stops).

| # | Step | Screen or email | What the user (site, company, owner) does | Wait (source) | Failure modes seen | Friction |
|---|---|---|---|---|---|---|
| C.1 | Upload hand-off: Cloud Function -> Pub/Sub -> listener (every 1 min) | none (site already saw "uploaded") | nothing | under 1 min to `preflight`; preflight 0.9 s (`run_summary.json`) | none seen | 0 |
| C.2 | Frames, normalisation, privacy gate, masks and clean plate (Gemini, Meta SAM) | none | nothing | stage ran 16.3 h; about 10.5 h of it was a hold (`run_summary.json`, `held_handoff_replay.json`) | `meta_sam_http_413` retried once; recapture-coded hold `website_registration_ambiguous` | 4 |
| C.3 | Operator replay of the held hand-off | none | the owner or an agent replays it on a new release (`operator: true`, 2026-11-12 11:04Z) | 10.5 h waiting for a person | without a person the job would have waited for a new video | 5 |
| C.4 | Sound-free video (company clip) | none; WebApp would show it to companies | nothing | built 25.3 h after hand-off on this job (code shipped that day); 55 and 65 min on two test jobs (`company_clip.json`) | WebApp refused it `409 website_company_clip_not_permitted`; the Pipeline re-checks every window (last 2026-11-22 15:24Z) | 3 |
| C.5 | Reconstruction: World Labs pose, refined splat, mesh; OpenAI planner and reviews | the site's job page shows the scene preview | nothing | 5.9 h (`preview_job.json` enqueued 18:44Z, ready 00:36Z) | on test jobs: `website_atlas_pose_release_not_admitted` stopped one for 26.7 h and another for 3 days so far | 2 |
| C.6 | Object isolation and scene preparation (registration, collider, room package, robot-fit table) | none | nothing | 6.2 min of compute after the replay (`capture_pipeline`) | `needs_input` on both test jobs | 2 |
| C.7 | Scene intent: WebApp signs it, Pipeline intake stores it | none | nothing | 2 min (`intent.json` 11:10:36Z) | none | 0 |
| C.8 | Scene preparation, $0, every 1-2 min | none | nothing | 28 attempts over 6.3 days; 26 ended by a new release (`progression.json`) | release supersession; `control_plane_disk_budget_exceeded`; 11 h re-preparation loop | 4 |
| C.9 | Simulation build: Vast GPU, ARTISAN object modelling on OpenAI | none | nothing | 8 attempts in 26 h (11-12 11:17Z to 11-13 13:05Z) on 7 commits; never succeeded | 7 `blocked`, 1 never queued; `website_native_construction_budget_exceeds_authority` 4.3 h; `preallocation_capacity_not_recovered`; `scene_intake_spend_cap_exhausted` 11-16 07:27Z | 5 |
| C.10 | Teardown proof (reconciler every 2 min) | none | nothing | n/a here (nothing rented) | none | 0 |
| C.11 | Team scene half (robot-team packet) | none | nothing | never reached | queue empty (`stall.checks.team_scene_packets: {}`) | 5 |
| C.12 | Company simulation package (`scene.usda` + `success_rule.json` zip) | companies would download it | nothing | never made | `company_simulation_no_source: 4, not_permitted: 2` (atlas journal 15:30Z) | 5 |
| C.13 | First look on paper (WebApp Gemini) | site's job page | site reads it | unverified (Firestore) | unverified | ? |
| C.14 | Packet shown to companies (WebApp `teamJobAccess`) | company's Find jobs | company reads and answers | never: `companySends: 0` | | 5 |
| end | Job window closes | site's job page and one email (WebApp window sweep) | site learns the job ended | 7 days (`outcome.json` `authority_expired` 2026-11-18 18:44Z) | | 5 |

Totals for the Pipeline part: 14 steps (C.1 to C.14). Site clicks 0, fields 0, sign-ins 0 inside the
Pipeline. Waits: 7 automatic waits plus 1 wait for a person (C.3). Emails: 0 from the Pipeline; the WebApp
sends the window-end email. Paid providers touched: Gemini, Meta SAM, World Labs, OpenAI (Vast reserved,
never rented). Wall clock: 7 days, ending with no simulation and no company having seen anything.

### The journey as proposed

| # | Step | What happens | Wait (expected; basis) | Hard stop it carries |
|---|---|---|---|---|
| P.1 | Upload hand-off | as today | under 1 min (measured) | rights and privacy: consent and withdrawal, unchanged |
| P.2 | Sound-free video | made from the upload as soon as it lands, before any other stage | minutes (encode of a 10-15 s clip; today's 55-65 min is mostly waiting for normalisation, unverified split) | rights: the WebApp's sharing check, one authority |
| P.3 | Reconstruction | World Labs room, as today, no per-call release check | about 6 h (measured, n=1) | money: the job's $40 ledger; privacy: face blur by version, one shared rule |
| P.4 | Room package = company simulation package | the isolated object (SAM masks and points), the room mesh and splat, and the success rule written straight into `scene.usda` + `success_rule.json`; anything missing is flagged, never held | minutes after P.3 (the package build is local CPU) | rights: the same sharing check as the clip |
| P.5 | Packet published | WebApp shows sentence, clip, first look and the package to approved companies | as soon as P.4 lands | none new |

Step count: 14 before, 5 after. Upload to a simulation a company can open: never today; about 6 to 7 hours
proposed (the reconstruction time measured on the one real job, plus minutes). The first look stays in the
WebApp, in parallel.

Deleted from the critical path: C.3 (operator replay), C.7-C.11 (scene intent, $0 preparation, the Vast and
ARTISAN build, teardown proof, team scene half), the robot-fit table and the rigid robot-free probe.

Deletions I expect might come back, and why:

- ARTISAN object modelling, for jobs whose object moves in parts (a drawer, a door, a lid). A box or a
  scanned mesh may not be enough for a company to test such a job. Bring it back as an optional upgrade to
  a package that already exists, never as the gate in front of it.
- The scene intent hand-shake, if the WebApp needs a signed record of what the Pipeline will spend on a
  later upgrade. Today the job ledger and the $40 cap already carry that.

## D. The owner and the operator: seeing and running the business

Full report, requirements ledger and evidence: [`raw/journey-D.md`](raw/journey-D.md).

### The journey today

#### D-a. The owner: "how is the business doing?"

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

#### The owner's real questions

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

#### D-b. The operator: keeping jobs moving

| # | Trigger | What the operator does | How often (source) | Friction |
|---|---|---|---|---|
| 1 | Alert on the webhook | Reads `door status`, then the runbook section | spend guard posts about hourly since 11-13 (unit-failure record) | 5 |
| 2 | Deploy | `door deploy`, read receipts, "record in the tracker" | 153 deploys in November, about 7 a day (receipts) | 3 |
| 3 | Stuck job | `door selected-handoff --resume-preparation` or `--atlas-retry` | 4 of the last 20 requests | 3 |
| 4 | Disk | `door retire-scene-workspace`, `purge-experiment-folder` | 3 of the last 20 requests | 2 |
| 5 | Timer off | `door unit start`, `door hold` | 2 of the last 20 requests | 2 |
| 6 | Company applies | approve (D-c) | 1 company record ever | 4 |
| 7 | Company emailed an answer | "Record an answer a company sent by email" | 0 sends ever | 4 |

#### D-c. Approving a company today

1. The company applies on `/jobs` (or `/partners`). 2. If `SLACK_INBOUND_WEBHOOK_URL` or `SLACK_WEBHOOK_URL` is set, Slack gets a message with the fields and a link (`slack.ts:138-165`). Otherwise there is only a log line saying the application "has no bell". 3. The owner opens the link and signs in. 4. The owner finds the card on "Partner applications". 5. The owner presses Approve. 6. A browser confirm box: "I reviewed the team's capabilities, task fit, and prerequisites and approve its invitation." 7. A browser prompt box for an optional internal note. 8. The record is saved and the approval email is queued.

Fields the owner sees: name, email, company, website, role, capabilities, jobs they can deliver, region, applied date, supported systems, pilot notes, test site, fit checklist. The last four come from retired forms.

### The journey as proposed

| # | Screen or email | What the owner does | Wait | Friction |
|---|---|---|---|---|
| 1 | `/admin/jobs` (signed in) | Reads one line of numbers: jobs this week and all time, with video, shown to companies, with an answer, introductions asked, introductions sent, outcome answers; month spend and the forecast | Firestore count queries | 1 |
| 2 | Same page | Reads "Needs you": companies waiting, money or rights stops, a failing guard; each is one line | none | 1 |
| 3 | Same page | Billable events list with a count and a CSV link | none | 1 |
| 4 | Email | Company applied: one Approve link | none | 0 |
| 5 | Phone | Paged only for money, privacy, rights or a stalled paid job | none | 0 |

Before: 8 owner steps, a terminal and two addresses. After: 3 steps on one page, plus one-press approval from email. Operator manual kinds: about 12 now; 6 after the deletions below.

Deletions I expect may come back: the per-job hold (as a privacy-only takedown), and some form of the deploy window if jobs get much busier.

### Manual steps, counted

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

## E. The five-minute investor walkthrough

Full report, requirements ledger and evidence: [`raw/journey-E.md`](raw/journey-E.md).

### The journey today (presenter on the live site)

| # | step | screen | what the presenter does | wait (source) | failure modes | friction 0-5 |
|---|---|---|---|---|---|---|
| 1 | Home | `/` | Points at the line and the example card | heading 0.10-0.20 s (measured) | Cookie banner over the card at 390 (E-12); card shows "Tested it: can do" (E-13) | 1 |
| 2 | Start a job | `/contact/site-operator` | Taps Start a job, shows the form, must not submit | 0.11-0.15 s (measured) | Submitting creates a real job, emails and paid processing; a stale script would do the same (E-10) | 3 |
| 3 | A packet | `/jobs` -> "See a sample job" -> play | Two taps and a scroll | 0.12 s page, 2.6 s video (measured) | Deep link opens on the form (E-11); the sample has no first look and no simulation, by design; no real packet may be shown (E-02) | 2 |
| 4 | The simulation | none public; `/admin/jobs` for staff | Sign in as admin, find an internal test job, open the viewer | first open unmeasured (E-07) | Companies can never see test jobs (E-05); WebGPU untested on presenter browser (E-17); new tab (E-16) | 5 |
| 5 | A company's view | `/contact/robot-team` -> `/jobs/:id` | Sign in as an approved company | 0.9-1.4 s to the sign-in wall (measured) | No job has ever been sent (E-01); any job shown belongs to a real site (E-02) | 5 |
| 6 | Responses | the site's private link `/capture-upload/:token` | Open a site's link | unverified | No real job has a response (E-01); a real site's page is private (E-02) | 5 |
| 7 | Introduce us | same page | Press the button | emails within about 60 s (outbox pump, inventory T1) | Irreversible on a real job: details sent, billable event written (E-03) | 5 |

Totals today: 7 steps, about 8 clicks, 0 fields (nothing may be submitted), 2 sign-ins (admin, approved company), 1 email wait, 0 emails shown. Steps 4 to 7 cannot be completed truthfully.

### The journey as proposed (five beats, 7 steps -> 5)

| # | beat | screen | what the presenter does | wait | failure modes left | friction |
|---|---|---|---|---|---|---|
| 1 | Home, with a 15-second glance at the start form | live `/`, then Start a job | Says the line; shows the one form; does not submit | 0.2 s each (measured) | none if the banner was answered beforehand | 0 |
| 2 | A packet | live `/jobs`, "See a sample job", play | Says it is stock footage | 0.1 s + 2.6 s (measured) | none | 1 |
| 3 | A company answers, simulation opened from the packet | pre-opened tab: recorded real-code run on test data (amber), or the real job (green); simulation tab pre-warmed | Shows the job, the video, presses View the simulation, picks Interested | 0.3-0.6 s (local, measured); simulation pre-warmed | must be said as test data until E-01 | 1 |
| 4 | The site's responses | pre-opened tab, same run | Shows Company A Interested, Company B Need more details with its words | 0.5-1.2 s (local, measured) | same | 1 |
| 5 | Introduce us | same tab; then the two emails from the recorded run | Presses it; shows "Introduction requested" and the emails | instant locally | line is thin (E-14) | 1 |

After: 5 beats, about 6 clicks, 0 fields, 0 sign-ins on stage (tabs opened beforehand), 0 live email waits.

Deletions I expect might come back: the start form glance (an investor may ask to see the full form) and the separate simulation stop (if the simulation becomes the headline).
