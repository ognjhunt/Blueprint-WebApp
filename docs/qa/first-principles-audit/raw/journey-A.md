# Journey A: the site, from landing to an introduction

Agent: journey-A. Date: 2026-11-22. WebApp at `0ee5df6` (the live site runs this commit: `curl https://tryblueprint.io/version.json` → `"git_sha": "0ee5df63…"`). Pipeline HEAD `7d8b532`; its active release is `cbff06b` (door status copy, `active_release.commit`).

How I walked it:

- A local site on port 4310 (`BLUEPRINT_E2E=1 … FIREBASE_SERVICE_ACCOUNT_JSON= GOOGLE_APPLICATION_CREDENTIALS= PORT=4310 npx tsx server/index.ts`), in development mode.
- Chromium through Playwright at 1280 × 800 and at 390 × 844 with an iPhone user agent. Every server answer on the job page was mocked with `page.route`, in the style of `e2e/site-answer.spec.ts`. No form was sent anywhere real. My scripts are in the scratch folder (`agents/journey-A/public.cjs`, `pw/walk.spec.ts`).
- I read the code path for each step in both repositories.
- The real handlers end to end: the orchestrator's baseline run of `npm run test:core-journey` passed 2 of 2 (`baseline/core-journey.log`: "email and video in, shared automatically, a company answers, the site asks for an introduction, follow-ups, withdrawal (25.2s)"). I did not rerun it.
- Wall-clock waits between Pipeline stages come from journey C ("see journey C"). I measured none of them.

Screenshots are in `docs/qa/first-principles-audit/screenshots/A-*.png`.

## 1. The journey today

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

## 2. The journey as proposed

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

## 3. Requirements ledger

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

## 4. Findings with evidence

Ids match `journey-A.findings.json`.

### A-01 (P0, untrue): Introduction emails say "write to them", but a reply still goes to Blueprint

- The introduction stores the other side's address as Reply-To on each outbox row (`server/utils/jobIntroductions.ts:157` and `:167`).
- The sender drops it. `captureOutbox.ts:492-493` sends `{ to, subject, text, html, ...CUSTOMER_JOB_EMAIL_IDENTITY }`. That identity fixes `replyTo: COMPANY.emails.hello` (`emailLayout.ts:26-30`).
- A test pins the override: `server/tests/capture-outbox.test.ts:209-216` queues `replyTo: "ops@…"` and expects `replyTo: "hello@tryblueprint.io"` at send. I ran it: `npx vitest run server/tests/capture-outbox.test.ts -t "sends a pending message and marks it sent"` → 1 passed.
- The test named "…say exactly the introduced company's details and reply to it" (`server/tests/site-companies-plant-and-prove.test.ts:298-302`) checks only the stored row.
- So when a site presses reply on "Meet {company}", the reply lands at hello@tryblueprint.io. A person at Blueprint is then between the two sides, which doctrine forbids.
- Copy already works around it ("Write to them at the email above", `taskLifecycleNotifications.ts:172`). Loose end (d) is still open.
- Fix: for the two introduction kinds, send `entry.replyTo` when it is a valid address. That is one line plus the test change. Owner question 6 in the copy decisions is the only blocker.

### A-02 (P1, privacy): A non-US job's page offers the sharing agreement and records it

- `canGrantInitialRecordingConsent` (`server/utils/descriptionAuthority.ts:14-19`) does not check the region.
- `authorizeCaptureUpload` checks consent before the region rule (`captureUploadAuthorization.ts:154-157` against `:171-174`). So a non-US draft is held with `recordingConsentAvailable: true`.
- The page then shows "Record your job", recording statement v4 ("We share your job, including this video … with robot deployment companies we've approved") and "Agree and continue". See A-17-job-non-us-consent-390.png, rendered with the mocked status the server sends.
- Pressing it records the v4 grant and writes the shared listing record (`jobSharedListing.ts:117-121`, called from `self-capture-uploads.ts:595-601`). It then fires the automatic send (`:610-613`).
- The video is then refused by the region rule, and `teamJobAccess.ts:253` (`video_required`) keeps the job out of companies' view.
- The site has therefore agreed, on the record, to a cross-border sharing that has no data-transfer terms. It sees a button that leads nowhere. Its start screen had told it "please don't film or send a video yet".
- Loose end (b) is confirmed.
- Fix: return false from `canGrantInitialRecordingConsent` when `capture_region` is not approved, and show the US-only notice instead.
- How many non-US jobs hold a v4 grant today needs a Firestore count (aggregate 1 below).

### A-03 (P1, broken): "Recover saved job" loops on a 409 and the site cannot start another job

- I reproduced it at 390 px. The first send got a 503, so the browser kept the submission. After a reload, three presses of "Recover saved job" each got a 409. The button stayed. "Start a new job" never appeared. Recorded in `walk-metrics.json`: `statuses: [503, 409, 409, 409]`, `recoverButtonStill: 1`, `startNew: 0`. Screenshot: A-09-recover-409-loop-390.png.
- Cause: only 400, 401, 403 and 422 clear the saved submission (`SiteCaptureStart.tsx:587-589`). A 409 keeps it. The fieldset stays disabled while one is saved (`:838`). "Start a new job" shows only after an acknowledgement (`:833`).
- The server answers 409 whenever `mayRecoverSubmission` is false (`inbound-request.ts:1373-1377`, `:2052-2055`). One real case: a job saved while signed in, then retried while signed out, because the owner check at `inbound-request.ts:287` fails. Another case is a retry token that does not match.
- The copy points to the emailed link, but the form stays frozen on that browser.
- Fix: treat 409 as final. Clear the saved submission, keep the message, and offer "Start a new job".

### A-04 (P1, privacy): Production still accepts the development authoring consent fields

- The start form hides the boxes in production (`SiteCaptureStart.tsx:51`, `:182-189`).
- The server still accepts `claudeAuthoringConsent` and `solAgentsApiConsent` from any request (`inbound-request.ts:1341-1360`; `workspace.ts:586-589`). It checks only the version and that the site is a US self-capture.
- A stored Claude grant switches the job's authoring provider to Anthropic (`websiteSceneSponsorship.ts:351-352`). If Anthropic terms are not configured, the grant throws `website_anthropic_provider_terms_not_configured` (`:361-362`), which stalls the job.
- So one hand-made request routes a real site's frames to a different provider under a development statement. That touches privacy and money.
- Loose end (a): production should refuse them. Fix: reject both fields with a 400 unless the server is a development build (the same switch the client uses).

### A-05 (P1, fragile): Videos between 1 GB and 2 GiB are accepted, then go nowhere

- The upload route accepts up to 2 GiB (`self-capture-uploads.ts:128,147`).
- Frame extraction stops at 1,000,000,000 bytes by default (`websiteLargeVideoBlock.ts:4-9`). A bigger video gets "no frames, no delivery record and no hand-off".
- The site sees "We have your video" (A-11). It is asked for a smaller video only after the sweep notices. Then the job ends after the site's 7-day wait (`websiteJobWindowEnding.ts:110`, `JOB_NO_GRANT_LARGE_VIDEO_ENDING_MESSAGE` at `taskPreparationOutcome.ts:462`).
- The browser checks only the extension (`selfCaptureVideo.ts:24-27`), never the size.
- The file path from the start form is one request with a 15-minute timeout and no resume (`selfCaptureVideo.ts:126-132`). A 1 GB file over a 10 Mbit/s uplink needs about 13 minutes (arithmetic, not measured).
- Unverified: the deployed extractFrames limit (it can be overridden), and how real iOS Safari and Android Chrome behave with such files. A real-device upload of a 1.2 GB file against a staging bucket would settle both.
- Fix: refuse a file over the frame limit at selection, with one sentence ("Your video is over 1 GB. Trim it to one round of the job, or film it here."), and set the server limit to match.

### A-06 (P1, friction): A site can be shown about 74 different status sentences; it needs 5

Counted from the code:

- `projectTaskStatus` has 39 headline sites (`grep -c` on `taskStatusProjection.ts`) over 13 decision values.
- `taskPreparationOutcome.ts` adds 11 more outcome titles.
- The outlook adds 7 phases and 20 reason sentences (`client/src/lib/jobOutlook.ts:5-55`).
- The sharing block adds 4 lines (`SiteAnswer.tsx` constants).

What the site actually sees depends on which renderer wins. Before an answer it is the status card (A-11). After one it is the three sections (A-14, A-15).

Some of these states model the retired trial. The phases `testing` and `result` ("a published test result scored at least one AI robot") are in `server/utils/jobOutlook.ts:11-14` and `:66-67`. There is also a 6-hour live-run grace (`:67`). `taskStatusProjection.ts:503-513` still reads run records.

Doctrine asks for "not yet sent, sent and waiting, or no response yet" plus the responses. The proposal is 5 states:

- watching your video;
- we need one thing from you;
- sent, no response yet;
- responses;
- stopped.

### A-07 (P1, untrue): Endings caused by Blueprint tell the site "To try again, start a new job"

- The window-ending message (`taskPreparationOutcome.ts:441`) and `authority_ended` (`taskStatusProjection.ts:604`) end with `PREPARATION_ENDED_NEXT` ("To try again, start a new job.", `:426`). See A-16-job-ended-window-390.png.
- The window is Blueprint's spending window. It ends because Blueprint did not finish.
- The job stays listed for companies after a window ending, because `teamJobAccess.ts:222-260` does not check it. A new job would duplicate a job that companies can still answer.
- The same ended page still offers "Send a new video" and "Change my job description" (A-16).
- Fix: on endings that were Blueprint's fault, say "Your job is still with deployment companies. Nothing is needed from you." and drop the advice.

### A-08 (P1, privacy): After a withdrawal the Pipeline deletes nothing until the owner signs a standing approval, and none exists

What happens on the WebApp side:

- The withdrawal closes the job for every company in the same transaction (`websiteCaptureWithdrawal.ts:83-117`; `teamJobAccess.ts:233`).
- It plans the deletion notice to every company the job was sent to (`withdrawalCompanyNotice.ts:44-78`).
- The core journey verifies the company side: 404 and gone from the list (`e2e/site-answer-journey.spec.ts:401-418`).

What happens on the Pipeline side:

- The HTTP handoff "never deletes bytes" (`pipeline:src/blueprint_pipeline/website_capture_withdrawal.py:1-10`).
- The hourly timer applies deletions "only under the owner's standing approval" (`website_capture_withdrawal_automatic.py:24-31`).
- The door status copy (2026-11-22T15:01Z) shows `capacity.website_withdrawal_deletion.approval_status: "absent"` with `withdrawals.total: 0`.
- So no site is affected today. The next withdrawal would leave the Pipeline's copies (frames, scene, offload) in place until the owner acts. Provider and delivered copies are never verified (`websiteCaptureWithdrawal.ts:146-150`, receipt fields fixed to false).

Fix: the owner signs the standing approval once. Needs the owner.

### A-09 (P1, friction): The same facts are asked twice, and the form still speaks of pilots

- "Add details" on the start form asks for success, frequency and "Where are you in the process?" with "Planning a pilot" and "Ready to run a pilot" (`SiteCaptureStart.tsx:961-981`; A-07).
- The job page then asks up to 5 quick questions from 15 keys (`jobFacts.ts:17-19`), including per hour, hours and timing (A-13 to A-15).
- The form's readiness answer is only stored (`inbound-request.ts:1644`). I found no reader that shows it to a company. That is unverified beyond `siteRobotFit.ts:157` and `siteMatchRun.ts:55`, which read intake fields.
- Fix: delete "Add details" entirely. Keep the quick questions, one at a time, on the job page.

### A-10 (P2, untrue): "Blueprint will update this job as the work progresses." is filler, pinned by tests

- It renders under every status before an answer (`NextTaskUpdate.tsx:5`, A-11).
- Tests pin it on purpose (`e2e/onboarding-p1.spec.ts:190,213`; `client/tests/pages/SelfCaptureUpload.test.tsx:1631`).
- It promises an action without a time and says nothing the headline does not. Loose end (e).
- Fix: delete the component and the three pins.

### A-11 (P2, friction): Requests for a new video are long and say "rebuild"

- `RECAPTURE_SENTENCES` (`taskPreparationOutcome.ts:259-297`) give a reason of 20–30 words plus a next step of 25–40 words.
- Four use "rebuild" (`:236, :255, :264, :268`).
- The coverage-gap ask is 40 words: "Please film again in one slow, continuous pass that starts on the room around the job, moves to where the job happens and keeps both in view on the way. Then send us the new video." Loose end (f).
- Fix: one line each, such as "Film again, walking slowly around where the job happens."

### A-12 (P1, friction): The site gets at least 4 emails before its first introduction; "Your job is posted" can go

- The emails are listed in `taskLifecycleNotifications.ts:1-11` and `captureOutbox.ts:62-89`:
  - the job link;
  - a reminder (if there is no video after a day);
  - "Your job is posted";
  - one per company answer;
  - "Meet {company}";
  - three follow-ups per introduction.
- "Your job is posted" repeats the agreement the site accepted at sending (`siteStartConsent.ts:47-49`). Its only new content is how to withdraw.
- From and Reply-To on every site email: `Blueprint <hello@tryblueprint.io>`, Reply-To hello@ (`emailLayout.ts:26-30`).
- Fix: put the withdrawal sentence in the job link email and drop `job_sent`. Needs the owner, because it is a privacy notice.

### A-13 (P2, friction): Stopping takes 4 taps behind "Job settings"

- The path is Job settings ›, then Stop using my video, then Stop using my video…, then Yes, stop using my video (`e2e/site-answer-journey.spec.ts:403-406`).
- Fix: one link on the job page and one confirm.

### A-14 (P2, privacy): The place field asks for more than the privacy gate needs and sends typed text to a geocoder

- The form asks "Where is the job?" with autocomplete. Typed text with no suggestion picked brings up a second, country field (A-04, A-06).
- Typed text goes to Google Places or to `photon.komoot.io` (`LocationAutocomplete.tsx:49,76`). Which one production uses depends on a key: unverified.
- Before an introduction companies see only the country (`taskBrowse.ts:63`).
- Fix: replace both with one question, "Is the job in the United States? Yes / No".

### A-15 (P2, untrue): Introduce us promises "your name, address and contact details", but the form collects only an email and a city

- The statement is at `siteIntroductions.ts:15`. The form has no name field ("No name field", `SiteCaptureStart.tsx:469-471`) and stores the city as the site's name (`:484`).
- The company email prints the city as "Address: …" (`robotTeamAccessEmails.ts:189`).
- Shorter would be true: "We give {alias} your email and city, and give you theirs." This is a recorded statement, so it needs the owner.

### A-16 (P2, demo-risk): The start button is below the first screen and the cookie banner covers the bottom

- The form is 1,204 px tall at 1280 and 1,314 px at 390 (`public-metrics.json`).
- "Next: film the job" and its agreement line are not visible without scrolling at either width. The cookie banner sits over the lower quarter on a first visit (A-03, A-01-390).

## Firestore aggregates wanted

Read-only, non-personal fields only:

1. `inboundRequests` where `request.buyerType == "site_operator"`: count by `request.capture_region`. For `non_us`, count where `request.consent_attestation.granted == true`, and where `public_task_listing` exists. (A-02.)
2. `inboundRequests` where `request.claude_authoring_consent != null` or `request.sol_agents_api_consent != null`: count by month of `createdAt`. (A-04.)
3. `inboundRequests`: count where `website_job_window_ending` exists; count where `website_job_no_grant_ending` exists, grouped by `.waiting_on` and `.reason`. (A-05, A-07.)
4. `captureOutbox` where `kind` is in [`task_received`, `site_action_needed`, `job_sent`, `company_answered`, `introduction_made_site`, `job_outcome_question`, `fresh_link`]: count by `kind` and `status`. Also the distribution of rows per `requestId` for the site kinds. (A-12.)
5. Durations per site job (median and p90): `createdAt` to the first `companySends.sentAtIso`; to the first `companyResponses` time; to `introductions.requestedAtIso`. (Cycle time; complements journey C.)
6. `inboundRequests` where `capture_withdrawal` exists: count by `capture_withdrawal.webappDeletion.phase` and `capture_withdrawal.pipelineAcknowledged`. (A-08.)
7. `inboundRequests` where `request.descriptionOnly == true`: count of those with no video after 7 days. (Drafts abandoned.)

## 5. What works well and should be left alone

- **The home page.** One title, one sub-line, one button and "Free for sites." are above the fold at 390 and at 1280, with no sideways scroll (`public-metrics.json`, A-01). It answers "what do I get, what does it cost" in under 10 seconds.
- **The phone path after the form.** On a phone, "Next: film the job" lands straight on the in-page camera (`SiteCaptureStart.tsx:672-679`; A-08-390). The recorder asks for no microphone, uploads in parts as it films, and resumes after a drop (`CaptureRecorder.tsx:49-61, 260-276`). A blocked camera says exactly what to do.
- **No sign-in anywhere.** The private link is the credential from start to introduction.
- **The responses section.** Aliases until an introduction, the company's reason in its own words, and one "Introduce us" with its one-sentence statement (A-15). It reads well at 390 px.
- **The introduction transaction.** One Firestore transaction re-checks the sharing rule, the company's approval and its answer. It writes the introduction, the billable event and both emails, all or nothing (`jobIntroductions.ts:103-170`). The site's email waits until the company's has gone (`:162-168`).
- **Withdrawal on the WebApp side.** It is immediate and covered end to end by the core journey (`e2e/site-answer-journey.spec.ts:401-418`). The deletion notice to every company is planned inside the same transaction.
- **The start form's local draft.** It survives reloads and lost responses (apart from the 409 case). It never sends a submission under wording the site did not see (`SiteCaptureStart.tsx:416-422`).
- **Honest waits.** No page or email promises a response or a date. "Viewed by 0 companies · 0 responses" is plain (A-14).

## Not covered

- Real-device behaviour: iOS Safari and Android Chrome camera, codecs, wake lock and backgrounding. I used Chromium with an iPhone user agent only. A real phone against a staging bucket would verify A-05.
- The live site's forms. Per the rules I only loaded public pages there, and took no screenshots of it.
- Wall-clock times between stages: see journey C.
- The account (claim) path and the signed-in site's `/app`. The job link path is the main one.
- I did not rerun the core-journey spec under the emulators; I relied on the baseline pass.
- The company side of the emails (journey B), except where an email reaches the site.
