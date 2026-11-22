# Requirements ledger: do we really need it?

First-principles audit, 2026-11-22. The owner asked, as the audit started, to
question every requirement: do we really need the step. Each agent therefore
kept a ledger: one row per step, screen, field, email, wait, rule, check,
stage or timer it examined, with who asked for it, what breaks if it goes, and
a verdict. The default answer was DELETE. Every KEEP had to name its source
and its reason. "The code does it" or "a test pins it" counted as nobody.

These are the agents' ledgers as written. A DELETE here is a proposal, not a
decision; the ones that matter are findings in `findings.md`, where they were
checked a second time, and are ordered in `delete-list.md`.

| Verdict | Rows |
|---|---|
| KEEP | 168 |
| DELETE | 160 |
| SIMPLIFY | 69 |
| MERGE | 25 |
| BUILD | 4 |
| FIX | 3 |
| **All rows examined** | **429** |

## The site's journey

Source: [`raw/journey-A.md`](raw/journey-A.md). Verdicts in this table: KEEP 25, SIMPLIFY 10, DELETE 9, MERGE 3.

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict (DELETE / MERGE / SIMPLIFY / KEEP) | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| Home title, sub-line, one button, "Free for sites." | `client/src/pages/Home.tsx:15-21`, `publicCopy.ts:15-16` | owner, home page line 2026-11-21 (#1373) | a site would not know what to do or what it costs | KEEP | It says what the site gets and what it costs in 22 words, above the fold at both widths. |
| Moving example card with 6 category buttons | `client/src/components/site/PilotPreview.tsx` (A-01) | nobody named | nothing a site needs; 7 extra controls | SIMPLIFY | |
| Header "Sign in" on public pages | A-01 header | nobody for sites (a site has no account; the link is the credential) | nothing for a site; companies still need it | SIMPLIFY | |
| How it works page | `client/src/pages/HowItWorks.tsx` | owner 2026-11-11 (bare-bones public pages) | the home page already lists the same three steps | MERGE | |
| Video field / "I have a video" | `SiteCaptureStart.tsx:857-891` | owner 2026-11-20 (a video is required to post) | no job packet | KEEP | Doctrine: the job starts with a video. |
| Film-later draft (no video at submit) | `SiteCaptureStart.tsx:508`, `inbound-request.ts:1283-1296` | owner 2026-11-20 (a private draft, film through the same link) | a site at a desk could not start | KEEP | Owner direction 2026-11-20. |
| The job in one sentence, required | `SiteCaptureStart.tsx:894-900` | owner 2026-11-20 | companies cannot judge a job with no sentence (`teamJobAccess.ts:252`) | KEEP | No sentence, no listing. |
| "Typing it confirms: …" quote under the sentence | `SiteCaptureStart.tsx:895`, recorded statement `taskConfirmation` | owner 2026-11-07 (task confirmation) | a recorded statement; the owner decides its wording | KEEP | Only the owner changes recorded wording. |
| "Where is the job?" free text with autocomplete | `SiteCaptureStart.tsx:902-926`, `LocationAutocomplete.tsx:49,76` | owner 2026-11-11 (country taken from the place) | only the country is needed for the privacy gate; companies see only the country before an introduction | SIMPLIFY | |
| Country select (shown when typed text has no suggestion) | `SiteCaptureStart.tsx:928-944` | privacy gate: US-only video (`captureResidency.ts:43`) | non-US video could arrive | MERGE | |
| Email | `SiteCaptureStart.tsx:947-954` | doctrine (email and video in) | no way back to the job, no introduction | KEEP | The job link and the introduction both go by email. |
| "Add details": What counts as success? | `SiteCaptureStart.tsx:963-967` | nobody now (the Pipeline drafts the success rule; the job page shows "Done means") | nothing; the site can edit the job later | DELETE | |
| "Add details": How often does it happen? | `SiteCaptureStart.tsx:968-972` | nobody; the quick question `perHour` asks it again (`jobFacts.ts:45`) | nothing | DELETE | |
| "Add details": Where are you in the process? (Planning a pilot / Ready to run a pilot) | `SiteCaptureStart.tsx:973-980` | nobody; retired pilot frame; the quick question `timing` overlaps | nothing (stored only, `inbound-request.ts:1644`) | DELETE | |
| Honeypot field | `SiteCaptureStart.tsx:986-990` | guard against bots (money: each job is paid preparation) | bot jobs spend preparation money | KEEP | It protects money at zero cost to people. |
| One-line consent under the button | `siteStartConsent.ts:47-49` | doctrine (recording statement v4; sharing is the service) | no recorded agreement to share | KEEP | It is the site's recorded agreement: a privacy and rights hard stop. |
| "What you're agreeing to" disclosure | `SiteCaptureStart.tsx:1005-1017` | owner 2026-11-12 (a drop-down, not a screen) | the full statements would not be one tap away | KEEP | It holds the full recorded wording, one tap away. |
| Development authoring consent fields accepted by the server | `inbound-request.ts:1341-1360`, `websiteSceneSponsorship.ts:351-362` | owner rule: development-only boxes never in production (decision 5) | nothing in production | DELETE (in production) | |
| "Recover saved job" button and the device draft store | `SiteCaptureStart.tsx:828-835`, `siteCaptureDraft.ts` | guard against a lost response creating a second job | a lost response would leave the site unsure; keep it, but fix the 409 loop | KEEP | Without it a lost answer can create duplicate jobs. |
| "Start a new job" only after acknowledgement | `SiteCaptureStart.tsx:833` | nobody named | with a 409 the site cannot leave | SIMPLIFY | |
| Done screen "Now film the job" with a QR code (desktop) | `SiteCaptureStart.tsx:776-791` (A-08-1280) | owner 2026-11-11 (the site films on its own phone) | a desktop user has no way to get to the phone | KEEP | It is the only hand-off from desk to phone. |
| Auto-jump to the camera on a phone | `SiteCaptureStart.tsx:672-679` (A-08-390) | nobody named; it saves a screen | one more tap | KEEP | It removes a screen on the main path. |
| In-page recorder: no microphone, parts, resume | `CaptureRecorder.tsx:49-61, 260-276` | privacy (no sound) and a flaky network | lost recordings on a bad connection | KEEP | Each part is saved as it lands, so a drop costs seconds. |
| File upload: a single request, 2 GiB server limit | `selfCaptureVideo.ts:115-165`, `self-capture-uploads.ts:128` | nobody chose 2 GiB against the 1 GB frame limit | 1–2 GB files are accepted and then dropped | SIMPLIFY | |
| 7-day wait on the site, then the job ends | `websiteJobWindowEnding.ts:110` | owner 2026-11-20 (a week) | drafts would wait forever, but nothing costs money while they wait | KEEP | Owner direction 2026-11-20. |
| Job window (7 days of paid work) | `websiteJobWindow.ts:26` | money: caps paid preparation per job | spend without a bound | KEEP | It bounds spend, a money hard stop. |
| "To try again, start a new job" on endings | `taskPreparationOutcome.ts:426,441` | nobody | the site would not be told to refilm for Blueprint's failure | DELETE | |
| Status headlines (39 strings, 13 decisions) | `taskStatusProjection.ts:380-746` | many reviews; doctrine asks for 3 plain states | nothing a site needs beyond ~5 states | SIMPLIFY | |
| Outlook phases "testing" and "result" (an AI robot scored) | `server/utils/jobOutlook.ts:11-14, 66-67, 105-113` | retired early trial (dropped 2026-11-14) | nothing; no robot software runs | DELETE | |
| "Check your job description and confirm it" state | `taskStatusProjection.ts:732-737` | owner 2026-11-07 (a confirmation for older jobs) | typing the sentence on the form already confirms | DELETE (for jobs started with a sentence) | |
| "Blueprint will update this job as the work progresses." | `NextTaskUpdate.tsx:5` (A-11) | nobody; a test pins it (`e2e/onboarding-p1.spec.ts:190`) | nothing | DELETE | |
| Quick questions on the job page (up to 5 of 15) | `client/src/lib/jobFacts.ts:17-19` (A-13 to A-15) | PACKAGE_E E1, no owner direction cited in the file | company answers might ask for them | SIMPLIFY | |
| Responses section with aliases, reasons, Introduce us | `SiteAnswer.tsx` (A-15) | doctrine | the core loop | KEEP | It is the site's answer: who will take the job and why. |
| Introduce us statement beside the button | `siteIntroductions.ts:14-15` | owner, recorded statement 2026-11-12 | no recorded agreement to give contact details | KEEP | Privacy: the one place contact details are released. |
| Billable event in the introduction transaction | `jobIntroductions.ts:150` | doctrine (each introduction is a billable event) | no record to bill | KEEP | Money record, written atomically with the introduction. |
| Email: job link (`task_received`) | `taskLifecycleNotifications.ts:49-56` | doctrine (the link is the way back) | the site cannot return | KEEP | It is the credential and the only way back. |
| Email: first-video reminder | `siteActionNeeded.ts:43-49` | owner 2026-11-20 | some drafts never get a video | KEEP | Owner direction 2026-11-20, sent once. |
| Email: "Your job is posted" (`job_sent`) | `taskLifecycleNotifications.ts:60-66` | PACKAGE_E E4 | the site learns of sharing it already agreed to | MERGE (into the job link email) | |
| Email: "A deployment company answered" | `taskLifecycleNotifications.ts:68-78` | doctrine (the site sees responses) | the site would have to poll its page | KEEP | Responses are the product, and the site is not on the page. |
| Email: "Meet {company}" | `taskLifecycleNotifications.ts:159-177` | doctrine (each side gets the other's details by email) | no introduction | KEEP | Doctrine names email as the channel. |
| Reply-To on introduction emails | stored `jobIntroductions.ts:157,167`, overridden `captureOutbox.ts:492-493` | owner question 6 (open) | replies reach Blueprint, a person in the loop | SIMPLIFY (use the stored value) | |
| Follow-up at 14, 45 and 90 days | `jobOutcomes.ts:1-13` | doctrine | no outcome record | KEEP | Doctrine names it. |
| Withdrawal path (4 taps behind Job settings) | `e2e/site-answer-journey.spec.ts:403-406` | doctrine (withdrawal) | the site cannot stop | SIMPLIFY | |
| Withdrawal: listing closed in the same transaction | `websiteCaptureWithdrawal.ts:83-117`, `teamJobAccess.ts:233` | doctrine (leaves every view at once) | companies keep seeing the job | KEEP | Privacy hard stop, verified by the core journey. |
| Withdrawal: deletion notice to every company sent the job | `withdrawalCompanyNotice.ts:44-78` | doctrine (the company is asked to delete) | the promise in Terms and Privacy is broken | KEEP | Privacy and rights promise. |
| Pipeline deletion gated on an owner standing approval | `pipeline:website_capture_withdrawal_automatic.py:24-31`; door status `approval_status: "absent"` | Pipeline design, not a doctrine line | nothing safer; copies stay | SIMPLIFY (sign the approval once) | |
| Non-US job page offers recording statement v4 | `descriptionAuthority.ts:14-19`, `captureUploadAuthorization.ts:154-157` | nobody (no region check) | nothing; it cannot lead to a video | DELETE (for non-US jobs) | |

## The deployment company's journey

Source: [`raw/journey-B.md`](raw/journey-B.md). Verdicts in this table: KEEP 28, DELETE 14, SIMPLIFY 10, MERGE 4, BUILD 2, FIX 1.

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

## The Pipeline, video to packet

Source: [`raw/journey-C.md`](raw/journey-C.md). Verdicts in this table: KEEP 15, DELETE 12, SIMPLIFY 7, MERGE 1.

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| Upload hand-off (Cloud Function, Pub/Sub, listener) | `functions/storage_trigger.py`; `deploy/systemd/blueprint-pubsub-handoff-listener.timer` (1 min) | owner mission (AGENTS.md "Mission") | nothing reaches the Pipeline | KEEP | It is the only door from upload to processing and costs under a minute. |
| Consent, withdrawal and rights check at every paid step | `job_retry_policy.py`; retry doc lines 24-27 | hard stop: privacy and rights | a withdrawn site keeps being processed | KEEP | Privacy and rights are hard stops. |
| Face blur of frames sent to World Labs, by Privacy version | `atlas_privacy_screen.py:49-50` (HEAD) | owner decision 2026-11-17; privacy hard stop | earlier-version jobs lose the blur they were promised | SIMPLIFY | (one rule "versions from 2026-11-17.1 are not blurred", not a hand-kept list; finding C-09) |
| Normalisation of the video before anything else | `website_company_clip.py:9-16` | nobody named; technical need for the clip and frames | clip and frames have no common source | SIMPLIFY | (keep, but run it first and alone so the clip does not wait for masks) |
| Clean plate (Gemini object removal analysis) | `pipeline/clean_plate/*`; `clean_plate_removal_analysis_gemini` | nobody named for website jobs; trial-era scene repair | the room scene keeps the job's object baked in; the object is then also placed separately | SIMPLIFY | (keep only what the room package needs; unverified whether a company sees any difference) |
| Candidate ranking and task target choices | `pipeline/website_candidate_ranking.json`, `website_task_target_choices/` | nobody named | object picked from the site's sentence alone | KEEP | The job's object must be found in the video for the package to hold it. |
| Recapture-coded hold (`website_registration_*`) | retry doc lines 239-248 | guard in `website_scene_handoff` | nothing: the real job was released by an operator replay on new code, not a new video | DELETE | (finding C-04) |
| Operator `selected-handoff` / held hand-off replay | `website_held_handoff_replay.py`; door requests (4 `selected-handoff` on 2026-11-20) | nobody; a workaround | a held job waits forever | DELETE | (goes with C-04) |
| Sound-free video built by the Pipeline | `website_company_clip.py` | owner decision 2026-11-12 | companies see no video | KEEP | It is one of the four things a company decides on, and it is ready in an hour. |
| Pipeline's own "Blueprint-owned capture" sharing basis | `sharing_statement.py:5,32-33` | nobody on the WebApp side | the Pipeline stops sending clips the WebApp refuses anyway | DELETE | (finding C-10) |
| Reconstruction with World Labs | `website_atlas_preview.py`; `website_atlas_pipeline.py` | owner direction 2026-11-12 (simulation is how a job is testable) | no room | KEEP | The room is the simulation's body and it is ready in about 6 h. |
| Release-admission check before each paid Atlas call | `paid_resource_allocator.py:350-352`; `website_atlas_pose.py:1159-1161` | guard, no named owner line; the door already deploys only commits on `origin/main` (runbook `cloud-scene-runs.md` step 6.3) | paid calls could start from an unpushed checkout on the host | SIMPLIFY | (move to deploy time; finding C-05) |
| Atlas planner and automation reviews (OpenAI) | `atlas/scene_planner`, `atlas/automation` | nobody named | unverified: the reviews pick views and catch bad frames | KEEP | They cost under $1 a job (cost model section 2) and steer a $5 splat. |
| Robot-fit table and precheck in the hand-off | `handoff.json` `robot_fit_table` (fits 0, unknown 29), `robot_fit_precheck` | commit `05acac655` "the first look says what each robot can do" | unverified whether a site or company sees it | DELETE | (finding C-13; unverified reader) |
| Scene intent intake (signed intent per job) | `task_evaluation_scene_intake.py`; WebApp `taskEvaluationSceneIntake.ts` | trial-era robot evaluation | the GPU build has no authority | DELETE | (from the critical path, with C-01) |
| $0 scene preparation bound to the release commit | progression `release_predecessors` | retry doc section 5.1 (known gap) | nothing: it is redone after each deploy anyway | DELETE | (finding C-02) |
| Simulation build on Vast + ARTISAN (OpenAI) | `task_evaluation_launch_*`; `vast_provider_adapter.py` | owner direction 2026-11-02 for ARTISAN cap; trial-era chain | the object is a scanned shape, not a modelled one | DELETE | (from the critical path; might come back as an upgrade, C-01) |
| Full $18 hold for a launch that rented nothing | `task_evaluation_terminal_scene_attempt_settlement.py:242-244` | nobody; conservative default | phantom spend ends jobs at the cap | DELETE | (finding C-03) |
| Three dollar figures per grant ($25 + $5 + $20) beside the one $40 cap | WebApp `websiteSceneSponsorship.ts:382-385`; `website_scene_sponsorship.json` of 11-19 jobs | retired multi-cap design | nothing: the $40 ledger already binds | MERGE | (finding C-11) |
| One $40 cap per job, the $400 month limit | `config/website_job_spend_cap.v1.json`; AGENTS.md lines 53-56 | owner decisions 2026-11-19, 2026-11-20 | uncapped spend | KEEP | Money is a hard stop. |
| Teardown proof (reconciler) | `task_evaluation_launch_reconciler.py` | money hard stop | a rented GPU could run on | KEEP | While anything rents a GPU, proof it stopped protects money. |
| Team scene half (robot-team packet) | `team_scene_packet_worker.py`; `website_company_simulation.py:7-8` | trial ("the simulation the trial itself runs") | the company package has no source today | DELETE | (finding C-01) |
| Company simulation package | `website_company_simulation.py` | owner decision 2026-11-12 | a company cannot test without a visit | KEEP | It is one of the four things a company decides on. |
| Rigid robot-free probe lane, timer every 5 min | `blueprint-rigid-robot-free-probe-runner.timer`; `rigid_robot_free_probe_lane.py` | trial-era check | nothing measured: queue 0, never ran (cost model section 7) | DELETE | (inventory finding; noted in C-13) |
| Company clip and simulation pass every 60 s, forever | `website_atlas_preview.py:1106,1121`; journal 400 passes in 7.6 h | nobody | packages appear a minute later | SIMPLIFY | (run on change, not on a clock; low value, not a finding) |
| Progression tick every 1 min writing an event each time | 1,164 event files for one job | nobody | less disk and noise | SIMPLIFY | (not a finding) |
| Deploy window: once a day at 15:00Z | AGENTS.md lines 138-153 (D-08, 2026-11-02) | owner delegation 2026-11-02 | releases retire in-flight work all day | KEEP | Until attempts survive a release, batching deploys is the only protection; finding C-02 shows it is not followed. |
| Deploy hold for work in flight | `deploy/operator-door/operator_door/activation_hold.py` | retry doc section 3 | a deploy retires a paid stage | KEEP | It protects money already committed. |
| Job window as the deadline (7 days) | WebApp `websiteJobWindowSweep.ts`; `outcome.json` `authority_expired` | retry doc section 4 | jobs never end | KEEP | A job must end by itself. |
| Disk-budget gates (`control_plane_disk_budget_exceeded`, preallocation capacity) | progression events 11-12, 11-18 | guard, host stability | host disk fills | SIMPLIFY | (keep the guard, delete what fills the disk; finding C-12) |
| Anthropic provider choice for object modelling | `artisan_provider_choice.py` (284 lines) | owner consent design 2026-09-24 | nothing in production: it can never choose Anthropic | DELETE | (finding C-06) |
| Six timed retries (15 min to 24 h) | `job_retry_policy.py`; retry doc line 22 | AGENTS.md "After a failed step a job retries by itself" | stuck jobs need a person | KEEP | It is what lets a job heal without a person. |
| GPU spend guard (RunPod still queried) | `scripts/gpu_spend_guard.py:2322-2337`; door `spend_guard.status: blocked` | money hard stop | the GPU fleet is unwatched | KEEP | Money guard; fix its RunPod failure (finding C-14). |
| Runbook step 13 "robot team picks its saved setup" and "raise the preparation cap" | WebApp `docs/runbooks/cloud-scene-runs.md:199-220, 285-296` | retired trial; manual amendment | agents follow dead steps | DELETE | (finding C-15) |
| `run_e2e` skipped stages (`robot_eval`, `agent_review`, …) in every ledger | `run_e2e.py:52-66` | kept only so old ledgers resume byte-identical | nothing | KEEP | Already trimmed to a frozen record; deleting it would break resume of old ledgers for no gain. |

## The owner and the operator

Source: [`raw/journey-D.md`](raw/journey-D.md). Verdicts in this table: DELETE 20, KEEP 15, SIMPLIFY 5, MERGE 3, FIX 1.

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

## The investor walkthrough

Source: [`raw/journey-E.md`](raw/journey-E.md). Verdicts in this table: KEEP 11, DELETE 11, SIMPLIFY 3, MERGE 2.

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| Home line and Start a job | `client/src/pages/Home.tsx:18-21` | owner 2026-11-21 (#1373) | the investor does not hear what Blueprint is | KEEP | It is the product in one sentence and loads in 0.2 s. |
| Home example card | `client/src/components/site/PilotPreview.tsx:6-17` | owner 2026-11-12 | the responses idea is not seen before beat 4 | KEEP | It previews the outcome in one glance and is labelled Example. |
| Tested answers on the example card | `PilotPreview.tsx:21,24` | nobody | nothing; no company can give them today | SIMPLIFY | |
| How it works page as a demo stop | `/how-it-works` | task step list | nothing; repeats the home page's three steps | DELETE | |
| Start form as a full demo step | `/contact/site-operator` | task step list | the investor does not see how little a site types | MERGE | |
| Submitting the start form live | live form | nobody | nothing in a demo; it would create a real job, emails and spend | DELETE | |
| Find jobs application form in the demo | `/jobs` top | owner 2026-11-20 (page), nobody (demo) | nothing; dead time before the sample | DELETE | |
| Sample job | `client/src/components/site/SampleJob.tsx` | owner 2026-11-20 | no packet can be shown truthfully on the live site | KEEP | It is the only public, honest picture of a packet. |
| `/jobs#sample-job` deep link | `Partners.tsx:19` | nobody | nothing once fixed; today it does not scroll | SIMPLIFY | |
| Separate simulation stop | task step 4 | task step list | nothing; it opens from the company view | MERGE | |
| Simulation from the staff console | `AdminJobConsole.tsx:162` | owner 2026-11-15 (test jobs stay internal) | no real simulation can be shown at all | KEEP | Until E-01 it is the only real simulation a presenter may open. |
| Viewer opening in a new tab | `CompanyJob.tsx:185` | nobody | nothing | DELETE | |
| WebGPU-first renderer | `splat-viewer/boot.js` | vendored default | unverified | KEEP | Changing a vendored default for one demo is not worth it; ?webgl=1 is the fallback. |
| Approved-company sign-in on stage | `/contact/robot-team` | approval gate (rights and privacy) | a company sees jobs without approval | KEEP | It protects sites' videos; on stage, sign in beforehand instead. |
| Admin sign-in on stage | `/admin/jobs` | role check | anyone sees staff tools | KEEP | It protects job data; open the tab beforehand. |
| Showing a real site's packet | any production job | nobody | nothing; it breaks the sharing agreement | DELETE | |
| Pressing Introduce us on a real job for show | `SiteAnswer.tsx:236` | nobody | nothing; it would send real details | DELETE | |
| Waiting for the introduction email live | outbox pump 60 s | nobody | nothing; show the recorded emails | DELETE | |
| "Introduction requested." line | `SiteAnswer.tsx:288` | nobody (wording) | the site gets no confirmation at all | SIMPLIFY | |
| Demo build (PR 1369) | GitHub #1369 | nobody | nothing true is lost | DELETE | |
| Invented counts and quotes | PR 1369 `Partners.tsx`, `DemoQuotes.tsx`, `Beta.tsx` | nobody | nothing | DELETE | |
| Dated fact sheet | none today | owner task (investor questions) | numbers said in the room are guesses | KEEP | Investors ask for counts and only a dated aggregate answers truthfully. |
| Retired sample files and proof reel | `client/public/samples/*`, `client/public/proof/*`, `build-output.test.ts:181-195` | nobody (retired hosted evaluation) | nothing | DELETE | |
| Live rehearsal script | `scripts/qa/live-rehearsal.mjs` | nobody | nothing; it is already broken | DELETE | |
| Cookie banner | site-wide | privacy law (analytics consent) | analytics without consent | KEEP | It is a privacy hard stop; answer it once in the presenter's profile. |
| Pre-flight checklist | `demo-script.md` | this audit | the demo stalls on a cold viewer or a banner | KEEP | Ten minutes of checks remove every stall found here. |
| Recorded core-journey run | none today (`e2e/site-answer-journey.spec.ts`) | this audit | steps 5 to 7 cannot be shown at all until E-01 | KEEP | It is the real code on test data, the only truthful stand-in. |

## Gates, approvals and checks

Source: [`raw/dim-gates.md`](raw/dim-gates.md). Verdicts in this table: KEEP 25, DELETE 21, SIMPLIFY 11, MERGE 5.

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict (DELETE / MERGE / SIMPLIFY / KEEP) | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| Honeypot | `inbound-request.ts:1032` | guard | bot jobs spend preparation money | KEEP | It protects money at no cost to people. |
| 15-minute intake limiter | `inbound-request.ts:330-335` | nobody named | nothing the daily cap does not cover | MERGE | |
| Daily intake cap, global 5 | `betaAbuseCaps.ts:46` | owner D-13 | one day of junk could use the month | KEEP | It is the cheapest bound on open-intake spend. |
| Daily intake cap per IP (20) and per email (5) | `betaAbuseCaps.ts:49-51` | nobody | nothing: they cannot trip before the global cap | DELETE | |
| Intake email caps | `betaAbuseCaps.ts:115-121` | Resend free plan | provider quota breach | KEEP | Provider term. |
| Upload cap per job | `betaAbuseCaps.ts:169` | nobody | nothing the global cap does not cover | MERGE | |
| Upload cap global | `betaAbuseCaps.ts:167` | nobody named | unbounded storage spend | KEEP | Money. |
| First-look caps $10 / $50 | `betaAbuseCaps.ts:221-231` | nobody named | first-look spend unbounded (it is not on the job ledger) | KEEP | Load-bearing until the first look is on the job ledger. |
| US-only capture | `captureResidency.ts:43` | Privacy Policy | collection without a transfer basis | KEEP | Privacy and law. |
| Recording statement v4 gate | `teamJobAccess.ts:249` | owner 2026-11-12 | sharing without the site's agreement | KEEP | Rights. |
| Shared listing record | `teamJobAccess.ts:250` | owner 2026-11-12 | duplicates the v4 grant | MERGE | |
| Job sentence (WebApp) | `teamJobAccess.ts:252` | owner 2026-11-20 | a packet with no job | KEEP | Doctrine. |
| Job sentence (Pipeline `require_task_named`) | `website_capture_preparation.py:15` | incident 2026-10-29 | paid reading of an unnamed job | KEEP | Money, and the form makes it unreachable for new jobs. |
| Brief confirmation step | `taskStatusProjection.ts:732` | owner 2026-11-07 | nothing for jobs typed on the form | DELETE | |
| `website_task_context_not_confirmed` as a revoking code | `taskEvaluationSceneIntake.ts:351` | nobody | a paid intent survives an unconfirmed brief | DELETE | |
| `/follow-up` success_target re-confirmation | `site-task-brief.ts:736-741` | owner 2026-11-07 | nothing (no client caller) | DELETE | |
| 7-day wait on the site | `websiteJobWindowEnding.ts:111` | owner 2026-11-20 | drafts wait forever (costs nothing) | KEEP | Owner direction. |
| Blueprint's 7-day window as a listing stop | `teamJobAccess.ts:237` | nobody | nothing; the $40 cap bounds money | DELETE | |
| Blueprint's 7-day window as a retry deadline | `websiteJobWindow.ts:26` | AGENTS.md (window is the deadline) | endless retries (bounded by $40 anyway) | KEEP | Doctrine names it as the retry deadline. |
| `consent_expired` code name for a time limit | `websiteSceneSponsorship.ts:327` | nobody | nothing | SIMPLIFY | |
| Window extension with owner approval | `sceneExecutionWindowExtension.ts:1` | nobody beyond approval | nothing; the cap is unchanged | DELETE | |
| Expired grant renewal by the owner | `websiteSceneSponsorship.ts:523` | nobody | nothing once the window no longer hides jobs | DELETE | |
| Pre-11-11 triage "qualified" | `teamJobAccess.ts:131` | owner 2026-11-11 (pending) | old jobs stay held | owner decides | |
| `website_scene_site_unclaimed` | `websiteSceneSponsorship.ts:349` | nobody (new jobs always have an owner id) | nothing | DELETE | |
| Operator listing hold | `teamJobAccess.ts:234` | nobody dated | nothing (0 uses) | DELETE | |
| Rights hold `blocked` | `teamJobAccess.ts:179` | Pipeline rights review | sharing a capture whose rights failed | KEEP | Rights. |
| Rights hold `needs_review` | `teamJobAccess.ts:180` | nobody named | an unreviewed state hides a job | SIMPLIFY | |
| Card "Ready" from runnable proof | `teamJobAccess.ts:136-162` | retired trial | a label | DELETE | |
| Company approval | `admin-robot-team-access.ts:65` | doctrine | sharing with anyone who signs up | KEEP | Privacy: what the site agreed to. |
| Email-bound invitation | `accountInvitations.ts:13` | privacy | a forwarded link opens jobs | KEEP | Privacy. |
| Company Terms + Privacy acceptance (signed in) | `companyTerms.ts:36-41` | planner 18:50Z | the Terms promise to the site is untrue | KEEP | Rights. |
| Re-acceptance on every new version by default | `legalAcceptance.ts:339-345` | nobody | companies keep jobs across a cosmetic change | SIMPLIFY | |
| Introduction dispatch re-check of Terms and listing | `jobIntroductionGate.ts:54-58` | planner H2 | an introduction the site pressed goes out | SIMPLIFY | |
| Introduction dispatch re-check of withdrawal | `jobIntroductionGate.ts:52-53` | doctrine | contact details sent after a withdrawal | KEEP | Privacy. |
| Paid-preparation grant before the company clip | `website_assessment_resume.py:154-206` | nobody for the clip | the free clip waits on a money admission | SIMPLIFY | |
| Company clip permission (Pipeline, 6 h recheck) | `company_share_permission.py:37-39` | owner 2026-11-12 | a taken-back basis lingers up to 12 h | KEEP | Rights; it also triggers take-back of stored copies. |
| WebApp per-request listing check on media | `teamJobAccess.ts:222` | doctrine | sharing after a withdrawal | KEEP | The load-bearing privacy layer. |
| Privacy post-processing gate | `site_package_orchestrator.py:135` | PIPE-03 | unverified processing reaches providers | KEEP | Privacy. |
| Face blur for older jobs | `atlas_privacy_screen.py:49` | owner 2026-11-17 | the promise to older sites breaks | KEEP | Privacy (simplify the list, C-09). |
| Recapture stops (8 codes) | `website_recapture_required.py:39-55` | nobody | nothing; the room is built | DELETE | |
| Hold until 2 h before window end | `website_scene_handoff.py:464,518-521` | owner 2026-11-17 | a fix gets the week | SIMPLIFY | |
| KEEP_HOLDING integrity suffixes | `website_scene_handoff.py:370-374` | nobody | a bookkeeping fault holds a job | SIMPLIFY | |
| Early task hold | `taskPreparationOutcome.ts:394-410` | review | room bought for an unsimulatable kind | owner decides | |
| Scene $40 room per intent | `internal-capture-worlds.ts:376` | owner 2026-11-19 | spend past the cap | KEEP | Money (load-bearing). |
| Trial policy capability gate | `task_evaluation_scene_progression.py:725` | retired trial | nothing | DELETE | |
| Stall alarm "rights" mapping by word | `control_plane_stall_alarm.py:160-169,547` | nobody | wrong counts | SIMPLIFY | |
| Revocation receipt without a reason | `task_evaluation_scene_intake.py:542-548` | nobody | the owner cannot tell a rights stop from bookkeeping | SIMPLIFY | |
| Account monthly limit | `config/account_monthly_spend_limit.v1.json` | owner 2026-11-07/12/20 | no cross-job bound | KEEP | Money (load-bearing). |
| GPU orphan reaper | `gpu_spend_guard.py` | AGENTS.md | runaway GPUs | KEEP | Money (load-bearing). |
| GPU fleet dollar caps | `blueprint-gpu-spend-guard.service` | AGENTS.md | nothing the monthly limit does not cover | DELETE | |
| Screening $30 / $4 | `screening_retained_ledger.py:33` | retired | nothing | DELETE | |
| Astra $5–25 | `task_evaluation_scene_configuration_runtime_budget.py:62-67` | backend not live | nothing | DELETE | |
| Rigid probe $1 | `rigid_robot_free_probe_lane.py:77` | lane unfed | nothing | DELETE | |
| ARTISAN $12, GPU attempt $6 / $0.80/h, Atlas review $5 | `AGENTS.md:93-98` | owner 2026-11-02 (ARTISAN) | one stage could use the job's $40 | MERGE into the $40 | |
| Grant dollar figures and attempt counts | `websiteSceneSponsorship.ts` (C-11) | none | nothing | DELETE | |
| GCP $100 guard | `gcp_monthly_budget_guard.py` | owner 2026-10-23 | duplicates the monthly limit | MERGE | |
| OpenAI $560 and World Labs $450 month pages | `provider_spend_alerts.py:93,95` | cost model | nothing (above the $400 limit) | DELETE | |
| Vast credit page and launch check | `provider_credit_admission.py` | AGENTS.md | a launch fails for credit | SIMPLIFY (alert only) | |
| Deploy activation hold | AGENTS.md `:141-147` | D-08 | a deploy retires a paid attempt | KEEP | Money in flight. |
| Deploy window 15:00 UTC | AGENTS.md `:141` | D-08 | nothing (D-06) | DELETE | |
| Chain preflight | preflight unit | D-04 | nothing: it gates nothing | DELETE | |
| Owner success contract | door kind | none | nothing (D-13) | DELETE | |
| Withdrawal deletion approval | `website_capture_withdrawal_automatic.py:24` | Pipeline design | deletion waits for a person | SIMPLIFY | |
| Note required for "Need more details" | `companyResponses.ts:58` | site's need | an empty answer | KEEP | The site can act only on words. |

## Promises against the code

Source: [`raw/dim-missing.md`](raw/dim-missing.md). Verdicts in this table: KEEP 12, DELETE 10, SIMPLIFY 6, MERGE 1.

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict (DELETE / MERGE / SIMPLIFY / KEEP) | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| Listing rule (sentence and clip, current statement, no withdrawal or hold) | `teamJobAccess.ts:214-262` | doctrine (sharing is the service, 2026-11-12) | jobs under older statements or withdrawn jobs would be shown | KEEP | It enforces the recorded agreement and the withdrawal, a privacy and rights hard stop. |
| `isRunnableTask` and `scene_not_runnable` in the listing answer | `teamJobAccess.ts:124-150, 258-260` | retired early trial | nothing: `evaluationAvailable` is "kept for older readers" | DELETE | |
| Legacy dossier restriction (`kept_private`, `restricted_to_named_teams`) | `teamJobAccess.ts:164-171` | retired dossier | jobs from the old dossier, which are not listed anyway (older statement) | DELETE | |
| One-time automatic send to companies current at listing | `jobAutoSend.ts:33-80` | owner 2026-11-12 (every step automatic) | no company is told about a new job | KEEP | It is the "sent to companies" step of the loop, with no person in it. |
| No email to companies approved later | `jobAutoSend.ts:10-11` | nobody | (it is a gap, not a guard) | DELETE (replace with an approval-time digest) | |
| Withdrawal notice only to companies with a send row | `withdrawalCompanyNotice.ts:3-5,54` | planner note "G6", not the owner | companies that never saw the job get no notice | SIMPLIFY (sent or viewed) | |
| Tested answers need a stored package | `site-worlds.ts:61-67` | Terms 1 and 4; launch copy 2026-11-20 | a company could claim a test on a simulation that does not exist | KEEP | A "Tested it" with no simulation would be a made-up result. |
| Sentence redaction before companies | `companyJobPage.ts:182` | privacy hard stop | a site's name in its own sentence reaches every company | KEEP | It is the last guard on the one free-text field companies read. |
| Silent, metadata-free company clip | `website_company_clip.py:395-425` | owner 2026-11-12; privacy | phone location tags and conversations reach companies | KEEP | It strips the two things a phone video leaks. |
| Package outbound scan and neutral names | `website_company_simulation.py:27-31,1423-1429` | privacy | an id or the site's name inside a file reaches companies | KEEP | Files are built from many sources; a scan is cheaper than proving each source clean. |
| Hand-kept Privacy versions for no-blur | `atlas_privacy_screen.py:49` | owner 2026-11-17 | (list missing) → footage blurred against the policy | SIMPLIFY (blur only versions before 2026-11-17.1) | |
| Library read capped at 200, unordered | `taskBrowse.ts:73-74` | nobody | nothing at 76 jobs | SIMPLIFY (order and page) | |
| Marketing cookie category and ad grants | `CookieConsent.tsx:195-205`, `analytics.ts:245-248` | nobody (no ads run) | nothing | DELETE | |
| Cookie banner while no analytics is configured | `CookieConsent.tsx` | the Privacy text, written for analytics that does not run | nothing; essential storage needs no consent | DELETE (until analytics exists) | |
| Notion in the processor list | `Privacy.tsx` processors | unknown | nothing in code | DELETE (after the owner answers) | |
| GA, PostHog, Sentry in the processor list | `Privacy.tsx` processors | written for configured analytics | nothing in production | DELETE (or configure; owner) | |
| Retention schedule in the policy | `Privacy.tsx` betaRetentionSchedule | legal text; CCPA retention disclosure | an unlawful policy | KEEP (and build the sweep) | A privacy policy must state how long it keeps each kind of data. |
| "Proposed 7 years" sentence for new recordings | `Privacy.tsx` retention notes | nobody decided it | nothing; it states no rule | DELETE (owner replaces it with one period) | |
| Retention sweep | not built | Privacy retention schedule | the policy is untrue from April 2027 | KEEP (build) | It is the least code that makes the stated periods true. |
| Account-notice script for policy changes | `accountNotice.ts`, inventory E13 | Terms 11, Privacy "Changes" | account holders are not told of material changes | KEEP (record runs) | The legal texts promise it. |
| Non-US site saves a job and agrees to sharing | A-02; `taskLifecycleNotifications.ts` non-US branch | nobody (an artefact of the residency gate) | nothing a site can use | DELETE (one sentence instead) | |
| Company country question at application | not built | Privacy transfer row | non-US companies approved without transfer terms | KEEP (build) | It is the one fact the transfer promise depends on. |
| Sample job line "to download and open in your own tools" | `publicCopy.ts:58` | owner 2026-11-20 (Find jobs) | nothing | SIMPLIFY (add "when it is ready") | |
| `out_of_scope` site sentence "We can't simulate this kind of job yet." | `taskStatusProjection.ts:241`; `jobConsoleData.ts:204` | nobody now (no Pipeline code emits it) | nothing | DELETE | |
| Package source limited to rigid or articulated team scene | `scene_packet.py:665-667` | retired early trial | other kinds get no simulation | SIMPLIFY (package from the room package) | |
| Billable event in the introduction transaction | `jobIntroductions.ts:150` | doctrine | no record to bill | KEEP | Money record, atomic with the introduction. |
| Outcome questions gated on the job being listed | `jobOutcomeGate.ts:71-76` | nobody | (it is a gap) | SIMPLIFY (gate on the introduction) | |
| 14/45/90-day questions | `jobOutcomes.ts` | doctrine | no record of what happened after | KEEP | Doctrine names it as part of the loop. |
| Withdrawal deletion approval file | Pipeline `blueprint-owner-approved-deletion*.service` | owner safety rule for deletes | deletion would run unattended | MERGE (approve once, standing) | |

Deletions I expect might come back: the cookie banner, if the owner configures analytics; the Notion row, if support records do live there; the "proposed 7 years" period, if counsel wants longer retention for the simulation business later.

## Fragility and retries

Source: [`raw/dim-fragile.md`](raw/dim-fragile.md). Verdicts in this table: DELETE 11, KEEP 8, SIMPLIFY 6, MERGE 2.

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| WebApp job-window sweep | webapp:server/utils/websiteJobWindowSweep.ts | doctrine "everything else is flagged and keeps going"; owner 2026-11-19/20 | jobs wait for ever when the Pipeline goes quiet | KEEP | It is the only thing that guarantees every site gets an ending. |
| Upload first-status watch (2 h) | webapp:server/utils/websitePreparationWatch.ts:62 | beta L3/L6 | a lost upload is noticed only when a site complains | KEEP | It is the only monitor of extractFrames, Pub/Sub and the host from outside. |
| Automatic send sweep | webapp:server/utils/jobAutoSend.ts:106 | owner 2026-11-12 (package E4) | a job missed at listing time is never sent | KEEP | It is the catch-up for the one send the loop needs. |
| Outcome questions: listing condition | webapp:server/utils/jobOutcomeGate.ts:71-76 | nobody | nothing; questions would also reach closed jobs | DELETE | |
| Outcome sweep (14/45/90) | webapp:server/utils/jobOutcomes.ts:134 | doctrine | no follow-up | KEEP | It is in the core loop. |
| Outbox 36-hour age limit | webapp:server/utils/captureOutboxRetry.ts:29 | Resend quota reasoning in the comment | rows would retry for ever | KEEP | It bounds retries; the fix is to let an introduction be asked again (F-03), not the limit. |
| "Introduction never made again after a cancel" | webapp:server/utils/jobIntroductions.ts:118-121 | nobody (key reuse convenience) | a site could retry after Blueprint's email failure | DELETE | |
| One worker heartbeat | webapp:server/utils/workerHeartbeat.ts | comment worker.ts:57 | worker death unseen | SIMPLIFY | Replace with one record per loop (F-11). |
| `BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER` | webapp:render.yaml:53, server/worker.ts:22-45 | nobody | nothing | DELETE | |
| Single-request picked-file upload | webapp:client/src/lib/selfCaptureVideo.ts:115 | nobody | nothing; the parts route exists | MERGE | |
| `GET /:token/parts` with no caller | webapp:server/routes/self-capture-uploads.ts:1010 | nobody today | nothing | KEEP | It is the cheapest resume for F-05 and F-06; use it or delete it. |
| Control-plane state backup unit | pipeline:deploy/systemd/blueprint-control-plane-state-backup.service | AGENTS.md money records; runbook | host loss erases money and job records | KEEP | It is the only copy of the money records off the host. |
| Stall alarm "not_configured is quiet" | pipeline:src/blueprint_pipeline/control_plane_state_backup.py:556 | nobody | nothing; the owner would see the gap | DELETE | |
| 4xx = "cannot succeed" for 401/402/403 | pipeline:src/blueprint_pipeline/job_retry_policy.py:192 | nobody for 401/402 | jobs would wait as for an outage | SIMPLIFY | |
| Atlas per-job operator reopen | pipeline:docs/runbooks/beta-operations.md:64-73 | nobody (doctrine forbids it) | nothing once automatic retries exist | DELETE | |
| Scene execution window extension | pipeline door `extend-scene-execution-window` | owner approval reference | an expired job would end with what it has | DELETE | |
| Preparation "six retries, then left as it is" | pipeline:docs/runbooks/beta-operations.md:138 | nobody | nothing; the outage schedule runs to the grant end | SIMPLIFY | |
| Company package pass with no deadline | pipeline:src/blueprint_pipeline/website_atlas_preview.py:1121 | owner (packet has a simulation) | the package is never built | SIMPLIFY | Stop at the job window and say so (F-17). |
| RunPod required while its key exists | pipeline:scripts/gpu_spend_guard.py:2322-2337 | nobody since 2026-11-05 | an invisible RunPod orphan (none can be launched) | DELETE | |
| Hand-copied Privacy version lists (two) | pipeline:atlas_privacy_screen.py:49, artisan_provider_choice.py:39 | owner 2026-11-17 (the rule, not the list) | nothing once the grant carries the decision | DELETE | |
| Deploy rebuilds every in-flight attempt | pipeline:scripts/operator_door.py:98; release-binding.md | D-08 / release binding | a stale release could buy work; only for runtime files | SIMPLIFY | Keep for runtime files; exempt tests and docs (F-09). |
| Door parks a deploy during paid work | pipeline:deploy/operator-door/operator_door/activation_hold.py | money | a deploy could strand paid work | KEEP | It protects money already spent. |
| Nightly full test lane schedule | pipeline:.github/workflows/full-test-lane.yml:21 | nobody (production deploy uses workflow_call) | nothing; iteration deploys skip it | DELETE | |
| Three intake browser suites outside CI | webapp:playwright.intake*.config.ts | nobody runs them | nothing; one has already rotted | MERGE | Into CI or delete (F-13). |
| cookie-consent spec in the default config | webapp:playwright.config.ts | nobody (the privacy config runs it) | nothing | DELETE | |
| Core journey "queued" email assertions | webapp:e2e/site-answer-journey.spec.ts:359-390 | the journey's purpose | weaker coverage | SIMPLIFY | Assert sent payloads (F-15). |
| `extractFrames` in BlueprintCapture | webapp:README.md:11 | nobody (kept from the capture app) | the WebApp would write the hand-off itself | DELETE | |

Deletions I expect might come back: the execution-window extension, if the owner wants to rescue a
valuable job by hand; the nightly full lane, if regressions slip past the impacted set; and the
`GET /parts` route, if F-05 and F-06 are built another way.

## Observability and billable events

Source: [`raw/dim-observe.md`](raw/dim-observe.md). Verdicts in this table: DELETE 14, KEEP 13, SIMPLIFY 8, MERGE 3, BUILD 2, FIX 1.

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| Billable event per introduction | webapp:server/utils/billableEvents.ts:36-46 | doctrine ("each introduction is recorded as a billable event"), owner 2026-11-12 | No money record | KEEP | The doctrine requires it, and it is the only record a future invoice can stand on. |
| Event id fixed per job and company, created once | billableEvents.ts:28, 44-46 | money hard stop | Double billing | KEEP | Exactly once protects money. |
| Event `priceUsd: null` field | billableEvents.ts:21 | doctrine "no price is stated" | Nothing (a null says nothing) | DELETE | |
| Event `status: void` on cancellation | jobIntroductionGate.ts:132,172,195 | money | A cancelled introduction would look billable | KEEP | It stops billing for an introduction that never reached the company. |
| Event time = press (`atIso`) | jobIntroductions.ts:151 | nobody | n/a | SIMPLIFY | Add `madeAtIso` at company-email send (O-07). |
| Terms version on the event | absent | money (Terms bind the company) | No proof of terms at billing | BUILD (O-05) | |
| Legal entity and billing contact | absent | money | Cannot invoice | BUILD (O-05) | |
| Outcomes array on the introduction | jobOutcomes.ts:229 | doctrine 14/45/90 | No outcome evidence | KEEP | The doctrine names the 14/45/90 question. |
| Outcomes refused after withdrawal | jobOutcomes.ts:213 | privacy guard | Unclear | needs owner (O-08) | |
| Per-job event list in admin | jobCompanies.ts:646, jobConsoleData.ts:375 | package E | Owner cannot see events | MERGE into the daily email and export | |
| Admin job list, 25 per page, no total | jobConsoleData.ts:34,112 | nobody for "no total" | n/a | SIMPLIFY | Add totals per stage (O-06). |
| "What it has cost so far" (WebApp ledgers only) | AdminJobConsole.tsx:257 | owner 2026-11-19 cap | Owner loses per-job cost | SIMPLIFY | Join with the Pipeline meter on request id (O-09). |
| Screening runs counted in job cost | websiteJobCeiling.ts:54-62 | retired trial | Old jobs' cost undercounted | KEEP until retired rows age out | It counts money already spent. |
| `growth_events` collection and writers | growth-events.ts; inbound-request.ts:1501; internal-pipeline.ts:1307 | nobody (capture-era proof motion) | Nothing: no reader | DELETE | |
| `/api/analytics/ingest` | analytics-ingest.ts | nobody named | Nothing reads it | DELETE | |
| 56 client event definitions (2 used) | client/src/lib/analytics.ts:373+ | nobody | nothing | DELETE (54) | |
| GA, PostHog, Sentry loaders | analytics.ts, errorTracking.ts | nobody (unconfigured in live build) | nothing today | DELETE or configure (owner) | |
| Cookie consent banner | client consent UI | law, only while analytics cookies exist | Nothing, if no analytics runs | needs owner | |
| `/api/errors` client error log | server/routes/errors.ts | nobody named | Lose client error lines in logs | KEEP | Errors from the site's job page are the only signal of client breakage. |
| Request log path redaction | blueprintWorkLogPrivacy.ts | privacy (PR 1316) | Signed links in logs | KEEP + FIX unsubscribe (O-03) | It keeps bearer links out of logs. |
| Unsubscribe link with email in query | email-suppression.ts:39-44 | provider term (unsubscribe), not the email-in-query form | n/a | SIMPLIFY | Use a signed token (O-03). |
| Resend webhook: suppressions | resend-webhook.ts:82-98 | provider term / law (unsubscribe, complaints) | Emails keep going to people who unsubscribed or complained | KEEP | Law and the provider's terms require suppression. |
| Resend webhook: full payload store | resend-webhook.ts:50-79 | nobody (growth studio, retired) | nothing | DELETE (O-01) | |
| Outbox bodies kept after send | captureOutbox.ts:136-147 | nobody | Nothing after send | DELETE (O-02) | |
| `agentRuns` unredacted input/output | runtime.ts:825-848 | nobody for non-redacted lanes | Replay/debug of model runs | SIMPLIFY (O-04) | |
| `opsActionLogs` | agents/ops-action-logs.ts | nobody found (no reader) | unverified | DELETE (verify via aggregate 8) | |
| Intake ops notice | intakeOpsNotice.ts | nobody named; useful | Owner not told of new jobs | MERGE into the daily email, keep a link-only ping | |
| Beta monitor: outbox failed/unknown, backlog | betaOpsMonitor.ts checks 2, 4 | money/privacy (emails that carry the introduction) | A failed introduction email goes unseen | KEEP | Introductions are the billable event and must not fail silently. |
| Beta monitor: worker heartbeat | betaOpsMonitor.ts check 5 | founder 2026-10-14 | Auto-send and outcome loops die unseen | KEEP | The worker runs every company-facing loop. |
| Beta monitor: preparation quiet | betaOpsMonitor.ts check 6 | nobody named | Stuck jobs unseen | MERGE with the Pipeline stall alarm | |
| Beta monitor: no-grant wait, over-budget extension | betaOpsMonitor.ts checks 7, 8 | retired (grants and extension gone) | nothing | DELETE (O-14) | |
| Slack screening call needed | slack.ts:93-120 | retired (screen gate ended 2026-11-11) | nothing for new jobs | DELETE | |
| Slack footage needs review | slack.ts:122-136 | nobody (contradicts "no person in between") | nothing | DELETE | |
| Slack company application | slack.ts:138-165 | doctrine (approve each company once) | Owner not told an approval waits | SIMPLIFY (link only, O-15) | |
| Slack privacy escalation | slack.ts:58-83 | privacy | A held capture waits unseen | KEEP | It serves a privacy stop. |
| Unit failure notifier | pipeline:unit_failure_notifier.py | AGENTS.md | Crashes unseen | SIMPLIFY | Post once per new cause, then daily (O-10). |
| Capacity warnings `usage_*` as alerts | control_plane_capacity_controller.py:869 | nobody | nothing | DELETE from alerts | |
| Money alerts (50%, forecast) | capacity alerts | owner spend limits 2026-11-19 | Overspend unseen | KEEP | Money is a hard stop. |
| Stall alarm | stall_alarm | AGENTS.md | Stuck jobs unseen | KEEP | It is the only Pipeline stuck-job signal. |
| State backup, silent when not configured | control_plane_state_backup.py:556-562 | money records | Ledger loss | FIX (O-11) | |
| Preflight 108 blockers | door preflight | nobody acts | nothing | DELETE from status or fix (IP-17) | |
| 206 stale failed units | door failed_units | nobody | nothing | DELETE (reset-failed) (IP-03) | |
| Admin `/admin/leads/:id` links in alerts | slack.ts, betaOpsMonitor.ts | nobody | none (redirect works) | SIMPLIFY to `/admin/jobs/:id` | |

## Retired systems and scale

Source: [`raw/dim-vestigial.md`](raw/dim-vestigial.md). Verdicts in this table: DELETE 38, KEEP 16, SIMPLIFY 3, MERGE 1.

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict | if KEEP: the one-sentence reason |
|---|---|---|---|---|---|
| Remote episode-compilation timer, path, service | pipeline:deploy/systemd/blueprint-task-evaluation-episode-compilation-remote.* | nobody (lane deleted; "armed to drain") | nothing: rows 0 on every run | DELETE | |
| Host episode-compilation units (disarmed each release) | pipeline:deploy/systemd/blueprint-task-evaluation-episode-compilation.* | nobody | nothing | DELETE | |
| Rigid robot-free probe units | pipeline:deploy/systemd/blueprint-rigid-robot-free-probe-runner.* | AGENTS.md spend line (lane kept) | nothing on the website path (SYSTEM_MAP:59) | DELETE | |
| Rigid probe withdrawal reader | pipeline:website_capture_withdrawal_rigid_probe | privacy hard stop | a withdrawn site's probe outputs would not be deleted | KEEP | Must outlive any probe output that still exists. |
| Team-scene Cloud Run collector units | pipeline:deploy/systemd/blueprint-team-scene-packet-remote.* | nobody (SYSTEM_MAP calls it off) | nothing; skipped by condition about 1,440 times a day | DELETE | |
| Terminal resource release units | pipeline:deploy/systemd/blueprint-task-evaluation-terminal-resource-release.* | nobody (queue empty since 2026-08-12) | nothing | DELETE | |
| Chain preflight timer | pipeline:deploy/systemd/blueprint-control-plane-preflight.timer:5,12 | nobody ("not a health signal yet", D-04) | nothing anyone acts on (IP-17) | DELETE | |
| GPU spend guard | pipeline:deploy/systemd/blueprint-gpu-spend-guard.* | money hard stop, AGENTS.md Spend limits | orphan GPUs could run unbounded | KEEP | It is the money stop; fix its RunPod read (IP-02), do not delete it. |
| RunPod inventory read in the guard | pipeline:scripts/gpu_spend_guard.py:2322-2337 | money (while a key exists) | a live orphan pod could go unseen | SIMPLIFY | Owner closes the account and deletes the key; the read then stops by itself. |
| Withdrawal deletion timer | pipeline:deploy/systemd/blueprint-website-withdrawal-deletion.* | privacy hard stop | withdrawn sites keep their data | KEEP | Withdrawal is in the core loop. |
| screening_retained_ledger | pipeline:src/blueprint_pipeline/screening_retained_ledger.py | money (AGENTS.md) | past screening spend could not be accounted | KEEP | Money accounting still reads it. |
| website_capture_withdrawal_screening | pipeline:src/blueprint_pipeline/website_capture_withdrawal_screening.py | privacy (AGENTS.md) | screening copies of a site's data would survive withdrawal | KEEP | Withdrawal still reads it. |
| Scene policy capability gate | pipeline:task_evaluation_scene_progression.py:725 | nobody (trial) | nothing for website intents (returns []) | DELETE | |
| Paired policy campaign manifest on activation | pipeline:task_evaluation_launch_activation_worker.py:1251 | nobody (trial) | nothing a site or company sees | DELETE | |
| wam_provider_object_store | pipeline:src/blueprint_pipeline/wam_provider_object_store.py | the simulation build (stages bundles) | scene configuration cannot stage to B2 | KEEP | It is live staging under a trial name; rename it (T1). |
| Policy-canary official billing reader | pipeline:vast_official_billing_extractor.py:23 | money | past Vast invoices could not be reconciled | KEEP | Until every trial-era Vast line is settled, then delete. |
| config/trial, config/policy_runtimes, config/beta_policy_candidates.v1.json | pipeline:config/ | nobody | nothing (no production reader) | DELETE | |
| RunPod and Lambda console scripts | pipeline:pyproject.toml:278,281 | nobody | nothing | DELETE | |
| G1 console scripts (6) | pipeline:pyproject.toml:288-293 | nobody (paused 2026-11-12) | nothing | DELETE | |
| policy_model_cpu extra in PR CI | pipeline:.github/workflows/ci.yml:210 | nobody | a test of dead code stops running | DELETE | |
| groot-libero-cpu extra in nightly and wide lanes | pipeline:full-test-lane.yml:293, impacted-wide-lane.yml:271 | nobody | retired G1/GR00T tests stop running | DELETE | |
| json-numpy base dependency | pipeline:pyproject.toml:58 | nobody | nothing (no importer) | DELETE | |
| 54 test-only / unimported modules (minus 4) | pipeline:testonly.json | nobody | nothing | DELETE | |
| _sam_parser_js, isaacsim_nurec_601 rendering_setup, pytest_full_lane_evidence, qualification_control_admission | pipeline (dynamic use) | live stage, CI, paid allocator check | SAM decode, Isaac render, CI evidence, allocator verification | KEEP | Each has a non-import user (package data, path read, workflow, verifier). |
| Host failed transient units and hold-expiry units | door units | nobody | nothing; status gets readable | DELETE | |
| Retired-lane disk roots | door usage | nobody | nothing; disk gates stop firing | DELETE | |
| Screening attempts folder (9.4 GiB) | /mnt/blueprint-work/beta-policy-screening-work | privacy and money | possible site data and spend evidence | KEEP | Until withdrawal confirms its contents and the ledger is exported, then delete through withdrawal. |
| /health/ready beta cohort check | webapp:server/utils/launch-readiness.ts:222-232 | nobody | a deploy can no longer fail on unused settings | DELETE | |
| beta-cohort-policy.ts and 7 env names | webapp:server/utils/beta-cohort-policy.ts | nobody (pre-beta 2026-07) | nothing (gate never called) | DELETE | |
| Experiments framework and route | webapp:client/src/lib/experiments.ts, server/routes/experiments.ts | nobody | nothing | DELETE | |
| Growth-campaign writes in the email webhook | webapp:server/routes/resend-webhook.ts:50-79 | nobody | nothing | DELETE | |
| Suppression branch in the email webhook | webapp:server/routes/resend-webhook.ts:84-99 | provider terms (bounces, complaints) and unsubscribe law | Blueprint keeps mailing people who complained or bounced | KEEP | Required to honour complaints and unsubscribes. |
| ops-action-logs writer | webapp:server/agents/ops-action-logs.ts | nobody (no write since 2026-04-08) | nothing | DELETE | |
| codex_local, acp_harness, openclaw providers | webapp:server/agents/provider-config.ts:17-27 | nobody | nothing (no adapter files) | DELETE | |
| Launch-forward worker lane | webapp:server/utils/taskEvaluationLaunchForwardWorker.ts:215 | nobody (#1300) | nothing (no forward_* records) | DELETE | |
| Job-evidence worker lane | webapp:server/utils/taskEvaluationLaunchForwardWorker.ts:213 | nobody | nothing (0 requests ever) | DELETE | |
| Scene-intake worker lane | webapp:server/utils/taskEvaluationLaunchForwardWorker.ts:214 | owner direction 2026-11-12 (website job path) | scene intents never reach the Pipeline; no simulation | KEEP | It forwards every website job's scene intent. |
| Capture coverage worker lane | webapp:server/utils/taskEvaluationLaunchForwardWorker.ts:206-211 | first look on paper (core packet) | no first look | KEEP | It reads the video for the first look. |
| Launch submission and preparation routes | webapp:server/routes/internal-task-evaluation-launch-{submissions,preparations}.ts | nobody | nothing (callers not live) | DELETE | |
| Launch receipt route (A93) | webapp:server/routes/internal-task-evaluation-launches.ts:110 | simulation build status | the job page loses launch status | KEEP | The Pipeline posts launch receipts to it. |
| Owner success proposal route (A82) | webapp:server/routes/internal-owner-success-proposal.ts | nobody (D-13: changes no threshold) | nothing | DELETE | |
| Job-evidence panel link to /app/captures | webapp:client/src/components/admin/JobWorkflowPanel.tsx:142 | nobody | nothing (no evidence question ever) | DELETE | |
| /app/captures page | webapp:client/src/app/routes.tsx:336 | launch copy f-103 2026-11-20 kept it as staff tool, no need named | nothing | DELETE | |
| capture-uploads routes A31-A48 and owned-capture-atlas A167-A169 | webapp:server/routes/capture-uploads.ts, owned-capture-atlas.ts | nobody | nothing found; check internal test jobs first | DELETE | |
| captureUploadSessions collection | webapp:server (42 files) | packet (company simulation record) | company simulation status is lost | KEEP | Records the company simulation package. |
| captureLifecycleForwarding.ts | webapp:server/utils/websiteCaptureWithdrawal.ts | privacy (withdrawal) | withdrawal cannot tell the Pipeline | KEEP | Withdrawal uses it. |
| Retired capturer 410 routes | webapp:server/utils/retiredCapturerRoutes.ts:13 | owner 2026-11-11 | old app clients get a confusing 404 or worse | KEEP | Cheap explicit refusal. |
| beta-policy-screening-holds route (name) | webapp:server/routes.ts:71 | held-job sentences (live) | held jobs lose their sentence | SIMPLIFY | Live; rename to job holds, do not delete. |
| betaPolicyScreeningContract.ts (name) | webapp:server/utils/betaPolicyScreeningContract.ts | money (job ceiling uses it) | job ceiling breaks | SIMPLIFY | Live; rename. |
| 6 unreferenced WebApp files | webapp:server/utils/web-search.ts etc. | nobody | nothing | DELETE | |
| World Labs client chain and robot-match chain | webapp:server/utils/worldlabs.ts etc. | nobody | nothing at runtime | DELETE | |
| evaluationPricing.ts | webapp:client/src/lib/evaluationPricing.ts | nobody (protected references) | claims guard and a Terms comment name it | DELETE | |
| framer-motion, node-fetch, react-avatar, react-dropdown-menu | webapp:package.json | nobody | nothing | DELETE | |
| Ten unrouted legal pages in app source | webapp:client/src/pages/*Announced/Earlier/Former/Older/Prior.tsx | legal record | proof of what earlier users accepted, if not archived | MERGE | Move to an archive with digests (owner). |
| Three unrun intake Playwright configs | webapp:playwright.intake*.config.ts | nobody | nothing (not in CI) | DELETE | |
| result-consumer Playwright config | webapp:playwright.result-consumer.config.ts | nobody | nothing (duplicate) | DELETE | |
| AGENTS.md lines naming deleted modules | pipeline:AGENTS.md:90-91 | nobody | agents stop chasing deleted files | DELETE | |
| Retired Firestore collections | Firestore (V-08 list) | nobody | nothing on the job path | DELETE | |
