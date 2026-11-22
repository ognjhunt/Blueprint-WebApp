# Journey B: the deployment company, from "Find jobs" to taking the job

Agent: journey-B. Date: 2026-11-22. WebApp at 0ee5df6 (the live site reports the same `git_sha` in `/version.json`, read 2026-11-22). Pipeline HEAD 7d8b532; the control plane's active release is `cbff06b4` (door status copy of 2026-11-22T15:01Z), 6 commits behind HEAD.

How I walked it. A business-development lead who has never heard of Blueprint, at 1280 px and 390 px. Two local servers (ports 4320 and 4321, the second with `VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH=1`), Firebase credentials blanked, every `/api/` answer mocked in the browser with `page.route` the way `e2e/job-companies.spec.ts` does. The live site: the public `/jobs` page only (loaded, screenshotted, nothing submitted). The simulation package: built from the Pipeline's own test fixture (`tests/test_website_company_simulation.py`, class `Job`) into my scratch folder, never from a real site. No paid call, no email, no write to production.

Scripts and logs (scratch, not in the repo): `/tmp/claude-0/-home-user/e3989091-e008-5b78-a9cb-b7c31a5efdb8/scratchpad/agents/journey-B/walk.cjs`, `walk-log.json`, `build_pkg.py`, `open_pkg.py`, `live.cjs`.

Screenshots: `docs/qa/first-principles-audit/screenshots/B-01` to `B-16`, at 1280 and 390.

## The short version

The company side mostly works and is honest. The job page tells a company what the packet does not show, marks the site's answers as unchecked, and never leaks the site's identity. The simulation package opens cleanly in USD tools.

Four things stand between a company and a confident yes:

1. A reply to the introduction email goes to Blueprint, not to the site. The code sets the site as Reply-To and the sender throws it away.
2. The packet says "United States" and nothing finer, while the application asks the company which cities and states it covers. The state is stored on the job and not shown.
3. The new-job email says nothing about the job, goes once, and never says when the simulation becomes ready to test.
4. The simulation package is USD only. MuJoCo and trimesh, both installed here, cannot open any file in it.

The approval step is the one human step, and it should stay: the site agreed to share with companies Blueprint approved. Everything around it can shrink. The application asks three free-text questions no rule reads. The sign-up asks for a password the email-bound invitation already makes unnecessary. A declined company is never told.

## 1. The journey today

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

## 2. The journey as proposed

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

## 3. Requirements ledger

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| Find jobs page with one sample job and one application | `client/src/pages/Partners.tsx:11-30` | owner direction 2026-11-20 (`publicCopy.ts:36-37`) | a stranger has no door in | KEEP | It is the only door for the customer. |
| Order: application above the sample job | `Partners.tsx:16-27`, B-01-390 | nobody | nothing | SIMPLIFY | |
| Sample job, stock footage, marked "not live" | `publicCopy.ts:47-62` | owner direction 2026-11-20 | a stranger cannot see what a packet is before applying | KEEP | Shows the product without exposing a real site. |
| Application field: name | `PartnerApplication.tsx:69` | approval and introduction email | introduction has no contact name | KEEP | The introduction gives it to the site. |
| Application field: work email | `PartnerApplication.tsx:70` | approval is bound to the email (`accountInvitations.ts:13-16`) | no account, no approval | KEEP | Identity and the address every email goes to. |
| Application field: company | `PartnerApplication.tsx:72` | introduction email gives the site the company name | the site does not know who it meets | KEEP | The site is told this name at introduction. |
| Application field: "What jobs can you deliver?" | `PartnerApplication.tsx:73-75` | nobody (no rule reads it; `robotTeamAccessFit.ts` uses email, website, region only) | the owner reads one fewer line; doctrine shows every job to every approved company | DELETE | |
| Application field: "Which robots do you deploy?" | `PartnerApplication.tsx:76-78` | nobody (no rule reads it) | same | DELETE | |
| Application field: "Where can you deploy?" | `PartnerApplication.tsx:79-81` | fit check "open jobs in region" (`robotTeamAccessFit.ts:92-101`) | a check that compares against countries only (cards carry the country) | DELETE | |
| Application field: website (hidden, optional) | `PartnerApplication.tsx:82-86` | fit check "website matches email" (`robotTeamAccessFit.ts:84-91`) | the one automatic signal that this is a real company | SIMPLIFY (make it visible and required) | |
| Optional "Blueprint updates" box, asked on application and again at sign-up | `PartnerApplication.tsx:88`, `RobotTeamSignUpFlow.tsx:94` | marketing consent law (opt-in) | asked twice | MERGE (ask once, in Settings) | |
| "By applying, you agree to our Terms" | `PartnerApplication.tsx:89` | planner G2 (versions recorded) | nothing: the server says this tick never lets a company see a job (`companyTerms.ts:31-41`) | DELETE (replace with a Privacy Policy notice) | |
| Terms version check on the application | `robot-team-access.ts:67-69` | planner G2 | an application refused when Terms change mid-form | DELETE with the line above | |
| Fit checklist on the review page and in Slack | `robotTeamAccessFit.ts:66-112`, `slack.ts:155` | nobody now (built for invited matching) | the owner loses two hints (work email, website match) | SIMPLIFY (keep those two, drop region) | |
| Slack bell for each application | `robot-team-access.ts:93`, `slack.ts:138-165` | owner needs to know someone applied | applications sit unseen | KEEP | The approver must learn there is something to approve. |
| Human approval of each company | `admin-robot-team-access.ts:65-97` | doctrine: "Blueprint approves a company once"; privacy: the site agreed to share with companies Blueprint approved | sites' videos go to anyone who signs up | KEEP | Protects privacy: it is what the site agreed to. |
| Confirm text "capabilities, task fit, and prerequisites" | `AdminRobotTeamAccess.tsx:92,174` | nobody now (retired matching) | nothing | SIMPLIFY ("Is this a real robot deployment company?") | |
| `prerequisitesReviewed` flag on the decision | `admin-robot-team-access.ts:71` | guard | a mis-click approves | MERGE into the one confirm | |
| No email on decline | `robotTeamEarlyAccess.ts:211` | owner direction 2026-11-19 | a declined company waits forever | needs owner (I recommend one "not yet" email) | |
| "In review" and "declined" status screens | `RobotTeamEarlyAccess.tsx:118-136` | nobody reachable: an applicant has no account | nothing; nobody sees them | DELETE (or make the answer an email) | |
| `BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS` switch and `gated` field | `robotTeamEarlyAccess.ts:115-119` | retired (the switch "no longer opens anything", line 17) | nothing | DELETE | |
| Approval email | `robotTeamAccessEmails.ts:24-65` | doctrine (company learns it was approved) | company never learns | KEEP | The only way a company learns it may come in. |
| Approval email: "book a call" line | `robotTeamAccessEmails.ts:52-57` | nobody named | nothing | DELETE | |
| Invitation link, 7-day expiry, email-bound | `accountInvitations.ts:13-16` | privacy: binds the approval to the approved address | a forwarded link opens jobs for someone else | KEEP | Protects privacy at a cost of one click. |
| Password at sign-up | `RobotTeamSignUpFlow.tsx:97` | nobody named | company signs in by emailed link instead | DELETE | |
| "Review account details" (name, company again) | `RobotTeamSignUpFlow.tsx:89-95` | nobody | nothing; prefilled from the application | DELETE | |
| Sign-up Terms checkbox (the signed-in agreement) | `RobotTeamSignUpFlow.tsx:98` | planner 18:50Z: the site's Terms promise a company "may not pass it on" | that promise to the site is untrue | KEEP (as a one-press "I agree" on first visit) | Makes the promise to the site true; it is the one agreement that counts. |
| Separate Terms prompt in the library and job page | `CompanyTermsPrompt.tsx` | same planner line | a company is never asked after a Terms change | MERGE with the sign-up agreement (one component) | |
| Email verification step | `RobotTeamSignUpFlow.tsx:44`, `RobotTeamEarlyAccess.tsx:105-117` | privacy (unverified address is "anyone's to type") | already skipped for invited accounts, which start verified (`accountInvitations.ts:56-58`) | KEEP as is | Already invisible on the normal path. |
| Library cards: category title and country only | `taskBrowse.ts:16-27`, `types/taskBrowse.ts:131-160`, B-08 | E2 anonymised listing | nothing; the job page shows the redacted sentence anyway | SIMPLIFY (show the redacted sentence on the card) | |
| Library filters: job type, region, Ready to test, search | `TaskBrowse.tsx:117-140` | nobody named | with under a few dozen jobs, nothing | SIMPLIFY (keep search and Ready to test) | |
| Job page: site's sentence, done rule, site's answers, video | `CompanyJob.tsx:134-156` | doctrine packet items 1, 2, 5 | no packet | KEEP | They are the packet. |
| Job page: "What this job packet does not show" | `companyJobPage.ts:96-107` | "Don't make things up" | a company assumes a site test or safety review happened | KEEP | Honest and saves a question email. |
| Job page: object facts, measured and estimated | `companyJobPage.ts:118-133` | doctrine packet ("its constraints") | size and weight unknown | KEEP | The figures a company decides on. |
| Job page: first look | `CompanyJob.tsx:182-192` | doctrine packet item 3 | a company loses the robot-on-paper hint | KEEP | Doctrine packet item; cheap. |
| Job page: country only | `companyJobPage.ts:82-94` | privacy (no address) | a company cannot tell if the job is in its area | SIMPLIFY (add the state, needs owner) | |
| Job page: in-browser simulation viewer and download | `CompanyJob.tsx:194-203` | doctrine "the simulation is core" | no testing | KEEP | Doctrine names it core. |
| Client branch for video state "none" | `CompanyJob.tsx:22-26,154,262` | retired (description-only jobs; video required since 2026-11-20) | nothing; the server never sends it (`companyJobPage.ts:181-182`) | DELETE | |
| Two answer forms ("Respond", "Report simulation result") | `CompanyJob.tsx:122-125,215-280` | E9 wording | nothing; one form can show five answers | MERGE | |
| "Add details": what you checked, question, earliest start | `CompanyJob.tsx:262-274` | package C1 | the site reads less | SIMPLIFY (keep earliest start and question) | |
| Note required for Need more details and tested answers | `companyResponses.ts:58-60` | site needs to know what is missing | "Need more details" with no detail is useless to the site | KEEP | The site can act only on words. |
| Response statement line under the form | `companyResponses.ts:72-76` | the company's consent to share its details at introduction | company details shared without its agreement | KEEP | Protects the company's privacy. |
| Answer can be changed (overwrite) | `site-worlds.ts:77-95` | owner (site told "if it changes its answer") | a mistaken "Not a fit" sticks | KEEP | Lets a company correct itself. |
| Saved message after an answer | `site-worlds.ts:96` | nobody named | company does not know what happens next | SIMPLIFY (say what comes next) | |
| Introduction email to the company | `robotTeamAccessEmails.ts:169-200` | doctrine (the two contact emails) | no introduction | KEEP | Core loop. |
| Reply-To of introduction emails | `jobIntroductions.ts:157,167` vs `captureOutbox.ts:492` | doctrine "each side the other's contact details"; "No person at Blueprint stands between" | replies go to Blueprint | FIX | |
| Outcome questions at 14, 45, 90 days | `jobOutcomes.ts`, `jobOutcomeGate.ts:53-62` | doctrine | no record of what happened | KEEP | Core loop and the future invoice's evidence. |
| Outcome confirm page (second press) | `jobOutcomes.ts:55` (review S2) | email scanners follow links | false answers recorded by scanners | KEEP | Without it the record is wrong. |
| New-job email on first listing | `jobAutoSend.ts:38-86` | doctrine ("each is emailed about it unless it turned job emails off") | companies must check the site | KEEP | Doctrine line. |
| New-job email body with no job type or place | `robotTeamAccessEmails.ts:153` | package E4 "Nothing about the site" | nothing: job type and state do not identify a site | SIMPLIFY | |
| No email when a job becomes Ready to test | `jobAutoSend.ts` (sends once) | nobody | companies miss the moment they can answer "Tested it" | BUILD (one email) | |
| Job-email switch in Settings | `UpdatePreferencesForm.tsx:19-20`, `workspace.ts:613-625` | doctrine ("unless it turned job emails off") | no way to stop | KEEP | Doctrine line; tested (`company-job-automation.test.ts:607,665`). |
| Stored targeting fields (interests, categories, requirements) | `UpdatePreferencesForm.tsx:3-6` | nobody (no screen, no effect) | nothing | DELETE | |
| Legacy application fields kept (supportedSystems, pilotPackage, testSite) | `robot-team-access.ts:72-76` | retired forms | nothing | DELETE | |
| Package: `scene.usda` and parts | `website_company_simulation.py:16-21` | doctrine "the simulation is core" | no test | KEEP | It is the simulation. |
| Package: `success_rule.json` | same | doctrine packet item 5 | no number to test against | KEEP (explain each field) | The done rule, as numbers. |
| Package: `timing` (physics 120 Hz, control 15 Hz) | `success_rule.json` from the plan's cadence | retired trial runner | nothing for a company | DELETE | |
| Package: splat PLY of the look | `website_company_simulation.py:23-27` | splat viewers that do not open USD | some companies cannot see the look | KEEP | Cheap, opens in common splat viewers. |
| Package: no mesh (OBJ/GLB) or MJCF/URDF | absent | nobody asked | MuJoCo, Gazebo, PyBullet users cannot open it | BUILD (one mesh export) | |
| Package README "Terms" paragraph | `website_company_simulation.py:1275-1277` | Terms promise to the site | nothing extra (already agreed) | KEEP | Reminds the holder of the no-sharing promise inside the file. |

## 4. Findings with evidence

The findings JSON (`raw/journey-B.findings.json`) holds all 18; here are the ones that matter, with the evidence.

### B-01 (P1, broken). A reply to the introduction email reaches Blueprint, not the site

The introduction queues the company's email with the site's address as Reply-To, and the site's email with the company's (`server/utils/jobIntroductions.ts:157` and `:167`). The outbox ignores that field at send time and always sends with `CUSTOMER_JOB_EMAIL_IDENTITY` (`server/utils/captureOutbox.ts:492-493`), whose `replyTo` is hello@ (`server/utils/emailLayout.ts:26-30`).

A test pins the override: a row queued with `replyTo: "ops@…"` must be sent with `replyTo: "hello@tryblueprint.io"` (`server/tests/capture-outbox.test.ts:209-217`). The introduction test checks only the stored row (`company-job-automation.test.ts:707,718`), so both pass while the product does the opposite of the row. The comment in the company email even says so: "A reply to this email reaches Blueprint" (`robotTeamAccessEmails.ts:194`).

What the company email says: "Write to them at the email above." A lead who presses Reply writes to Blueprint. Then a person at Blueprint stands between the two sides, against doctrine.

Fix: for the two introduction kinds, send with the row's `replyTo`. Live: yes.

### B-02 (P1, friction). The new-job email says nothing about the job

The body is fixed: "A site has posted a new job. Open it to see the job packet and respond." (`robotTeamAccessEmails.ts:153`). There is no job type, place or Ready-to-test state. A company that only palletizes in Texas must open every email and sign in to learn it is a dish job in Ohio. The category title and the country already appear on the card every approved company sees, so adding them reveals nothing new.

### B-03 (P1, missing). No email when the simulation becomes ready to test, and companies approved later are never told about open jobs

The automatic send runs once per job, when the job is first listed (`jobAutoSend.ts:3-13,46`). The header says it: "A company approved later sees listed jobs in its library; it is not emailed about them." A company counts only if it has already accepted the Terms signed in (`jobAutoSend.ts:50-52`). So a company approved but not yet signed up when a job goes out is never emailed about that job. Nothing emails anyone when the simulation package appears, which is the moment "Tested it: can do" becomes possible.

### B-04 (P1, missing). The packet gives the country only, while the application asks for cities and states

The job page and the cards show `countryOf(record)`, a country name only (`companyJobPage.ts:82-94`, `taskBrowse.ts:63`). The job stores `city`, `state` and `postalCode` (`server/types/inbound-request.ts:141-151`). The application asks "Where can you deploy? Cities, states or countries you cover" (`PartnerApplication.tsx:79-81`).

A deployment company's first question is "Is it in our area?" Today the answer is "United States". A state is not a street address, but the sharing statement lists what is shared and does not list a region. So this needs the owner.

### B-05 (P1, friction). Cards in the job list look alike

Card titles are a fixed category picked by a regex over the description ("Move materials", "Pack items", "Automation job"; `types/taskBrowse.ts:131-160`). The card adds the country. With six mocked jobs, three cards read "Move materials · Material handling · United States" (B-08 at both widths). The site's sentence, already redacted for companies (`companyJobPage.ts:176`), is on the job page but not on the card. A lead has to open each job to tell them apart.

### B-06 (P1, over-gated). The application asks three questions nothing reads

Six fields are required, three of them free text: jobs you deliver, robots, where you deploy (`PartnerApplication.tsx:69-81`). The automatic checklist reads the email, the website and the region only (`robotTeamAccessFit.ts:66-112`). The region check compares against cards whose region is a country, so "Texas and Oklahoma" never matches. Doctrine shows every job to every approved company, so "what jobs" and "which robots" change nothing a company sees. The website, the one field that makes the "website matches email" check pass, is the optional one, hidden under "Add your website" (`PartnerApplication.tsx:82-86`).

Proposal: four fields (name, work email, company, website), website visible and required. It touches privacy only in that the approver must still judge "a real deployment company", and email domain plus website is what they would check anyway.

### B-07 (P1, friction). After approval: a password, a second Terms agreement and a details review before the first job

From "approved" to the first job: 1 email, 1 link, 1 screen (password, Terms box, collapsed name and company), 1 click, then the list (B-06). The invitation is bound to the address and expires in 7 days (`accountInvitations.ts:13-16`). The account it creates starts verified because the link was delivered to that address (`accountInvitations.ts:56-58`). The same proof can sign the company in without a password. The "Review account details" disclosure re-asks name and company already given on the application.

The application's "By applying, you agree to our Terms" is a second agreement that the server says never counts (`companyTerms.ts:31-41`, `robotTeamEarlyAccess.ts:72-73`).

Proposal: the link signs in; first visit shows one "I agree to the Terms and Privacy Policy" press (the one that counts, as `CompanyTermsPrompt` already does). Delete the password, the details review and the application's Terms line. Risk: a company without access to its inbox on a new device; "Email me a new link" already exists (`RobotTeamEarlyAccess.tsx:17-52`).

### B-08 (P1, friction). A declined or waiting applicant is never told anything

Only an approval is emailed (owner, 2026-11-19; `robotTeamEarlyAccess.ts:211`, `robotTeamAccessEmails.ts:20`). The "in review" and "declined" screens (`RobotTeamEarlyAccess.tsx:118-136`) show only to a signed-in account whose email has an application. Accounts for companies are created only from an invitation, which comes only with approval. So an applicant can never see them. The receipt promises "We'll email you if your company is approved" (B-04): silence means no, or not yet, or not read. Needs the owner because it reverses a dated direction.

### B-09 (P1, unseen). Nobody can see how long approval takes, and nothing reminds the owner

There is no timer, reminder or stale-application alert. The Slack bell fires once on a new application (`robot-team-access.ts:93`). The time from applying to a decision is the slowest human link on this journey and is unmeasured. The Firestore aggregate below would measure it.

### B-10 (P1, missing). The simulation package opens only in USD tools

Built from the Pipeline fixture: `README.txt, object.usdz, scene.usda, scene/files/file-001.png, scene/room.usdc, scene/room_collision.usdc, success_rule.json`. Command and output (`open_pkg.py`, Pipeline virtualenv):

```
pxr open ok; deps unresolved: []
mujoco 3.11.0
mujoco cannot open scene.usda -> ValueError XML parse error 8:
mujoco cannot open object.usdz -> ValueError XML parse error 8:
trimesh 4.12.2
trimesh cannot load scene/room_collision.usdc -> NotImplementedError file_type 'usdc' not supported
trimesh cannot load object.usdz -> NotImplementedError file_type 'usdz' not supported
mjcf/urdf/obj/stl/glb in package: []
```

The README says what to open first ("scene.usda: open this one") and states units and axes, in words a robotics engineer would accept. It does not explain the success rule's fields (`destination_containment.position_bounds_world_m`, `settling.position_tolerance_m`, `motion.minimum_lift_m`) beyond "what counts as done, as numbers". `success_rule.json` also carries `timing` (`physics_frequency_hz: 120`, `control_frequency_hz: 15`), the cadence of Blueprint's retired trial runner.

Proposal: export the collision room and the object once more as GLB or OBJ with `pxr` (no paid resource). Add one README line per rule field. Delete `timing`. The fixture has no physics schemas, so I could not check mass and collision on a real object: unverified.

### B-11 (P2, vestigial). The package is still made from the dropped trial's scene, and its newer README is not live

The source is "the job's compiled team scene half, the simulation the trial itself runs" (`website_company_simulation.py:8-15`), whose plan carries the robot runner's cadence. The plain-words README (builder v4, Pipeline commit 917685148, 2026-11-20) is not in the active release `cbff06b4`. Live packages use builder v3, whose "could not prepare" note prints internal codes (`NOT_PREPARED = "… ({codes})."` in `git show cbff06b44:src/blueprint_pipeline/website_company_simulation.py`).

### B-12 (P2, broken). After an answer, the simulation-result form shows the previous answer's "Saved" message

Steps: answer Interested, Send, then press "Report simulation result". The new form shows "You answered 'Interested'" and "Saved. The site sees this answer…" before anything is sent (B-12-tested-form-1280). Cause: one `message` state shared by both modes (`CompanyJob.tsx:201,236`).

### B-13 (P1, friction). After answering, nothing says what happens next

The reply is "Saved. The site sees this answer, without your company's name." (`site-worlds.ts:96`). What comes next is in grey small print under the button ("If you answer Interested … and the site asks for an introduction…"). There is no "we'll email you if the site asks to meet". There is also no word that the site may not answer at all.

### Other findings in the JSON

- B-14 (P2): two answer forms where one would do.
- B-15 (P2): sample job below the form at 390.
- B-16 (P2): dead "no video" branch.
- B-17 (P2): dead preference and application fields.
- B-18 (P2): the approval confirm text names a retired capability-matching review.

### Firestore aggregates wanted

Read-only, counts and durations only, no personal fields.

1. `robotTeamAccess`: count by `status` and `source`. For `status in (approved, declined)`, the distribution (median, p90, max) of `decidedAtIso - appliedAtIso` in hours. Count with `status == "applied"` and `appliedAtIso` older than 3 and 7 days.
2. `robotTeamAccess` with `status == "approved"`: count with no `termsAcceptedByUid` (approved, never signed in), with the median age of `decidedAtIso`. Count with `newJobAlertsOptIn == false`.
3. `captureOutbox`: count by `status` for `kind == "robot_team_access_approved"`, `"robot_team_new_task"`, and the two introduction kinds.
4. `inboundRequests/*/robotTeamInterest`: count by `state`. Count where `updatedAtIso != firstAnsweredAtIso` (answers changed). Median of `firstAnsweredAtIso - inboundRequests.public_task_listing.approvedAtIso`.
5. `inboundRequests/*/introductions`: count, and count of `outcomes` entries by `by` and `state`.

## 5. What works well and should be left alone

- The job page's "What this job packet does not show" list (`companyJobPage.ts:96-107`). It says plainly that there was no site test, no safety assessment, no route measured and no safety rules asked. It saves a question email and keeps Blueprint honest.
- The site's answers are labelled "The site's own answers. Blueprint has not checked them." (`CompanyJob.tsx:29`). It is clear and true.
- Identity never reaches a company. The sentence and the done rule go through `removeIdentifyingDetails` and `removeNamesNotHeld` (`companyJobPage.ts:170-176`). The payload builder never reads the site's name, address or contact details (`companyJobPage.ts:4-8`), and tests plant and prove it.
- The simulation package is deterministic and scanned. The same inputs give the same digest, every file is scanned for ids, keys and links before zipping, and every reference resolves inside the zip. pxr reports zero unresolved dependencies in my build.
- The README starts with what to open and states metres, radians and +Z up. It says what was not measured and that no robot is included. A robotics engineer can work with that.
- The answer route checks approval, Terms, listing and simulation existence inside one transaction (`site-worlds.ts:42-97`). An answer can be changed.
- The outcome questions use two presses, so an email scanner cannot record an answer. They stop after a final answer (`jobOutcomeStates.ts:17`).
- Turning job emails off works and is tested at dispatch (`newJobAlerts.ts:45-71`; `company-job-automation.test.ts:607,665`; I ran the three relevant tests: 3 passed).
- The invited account starts verified, so the old "verify your email" detour is gone on the normal path (`accountInvitations.ts:56-58`).
- The live `/jobs` page loads in 1.1 to 3.1 s with no horizontal scroll at 390.

## Not covered

- Real approval timings, real company counts and real email delivery: these need the Firestore aggregates above.
- The in-browser simulation viewer: mocked, not rendered.
- A real job's simulation package (privacy rule). Physics schemas on a real object are unverified.
- The admin approval page itself was read in code, not rendered.
- Email rendering (HTML layout) was read from code, not sent.
- Google sign-in path: needs live Firebase.
