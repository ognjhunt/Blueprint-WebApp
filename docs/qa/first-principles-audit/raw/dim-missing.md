# Missing features against doctrine and copy (agent dim-missing)

Date 2026-11-22. WebApp `0ee5df6` (the live site runs this commit). Pipeline HEAD `7d8b532`. Pipeline active release `cbff06b`: I re-read it through the door at 15:51Z (`operator_door.py status` → `active_release.commit cbff06b4…`).

Finding ids start with `M-`. Findings file: `raw/dim-missing.findings.json` (validator: OK, 9 findings). Build list: `raw/build-candidates.md`.

## How I worked

- I read the shared doctrine (`pipeline:doctrine/platform-context.md`), `client/src/lib/publicCopy.ts`, the sample job, the live Terms (`client/src/pages/Terms.tsx`) and Privacy Policy (`client/src/pages/Privacy.tsx`), the email builders, and the inventories and journey reports A to D.
- I traced each promise to the code that keeps it and the test that proves it.
- I ran five targeted test files with credentials blanked: `npx vitest run server/tests/company-facing-site-identity.test.ts server/tests/withdrawal-company-notice.test.ts server/tests/money-introduction-billable-events.test.ts server/tests/job-outcomes.test.ts server/tests/job-sharing-state.test.ts` → 5 files, 59 tests passed, 9 s.
- I loaded the live home page once in Chromium at 390 px, opened the cookie banner's Customize panel and saved nothing (`screenshots/M-03-cookie-banner-390.png`). The page asked only `tryblueprint.io` and Google Fonts; there were 0 requests to Google Analytics, PostHog or Sentry.
- Production truth comes from the orchestrator's document counts (2026-11-22), the door status copy and journey C's door reads. I read no site's video, name, address, contact details or sentence.

## The answer in short

- **Privacy promises hold in code and tests.** Nothing a company receives names the site before an introduction. The company video is silent and stripped of metadata. Jobs under older statements are shown to nobody. No price appears anywhere.
- **The core loop is built and tested, but has never run in production.** That covers the send, the answers, Introduce us, the billable event and the 14/45/90-day questions. Counts across every job: companySends 0, robotTeamInterest 0, introductions 0. One company record exists (D-17).
- **Four promises are kept only in part, or are untrue, and nobody had flagged them before:**
  - A company approved after the send is never asked to delete a saved copy (M-01).
  - The retention schedule has no code (M-02).
  - The cookie wording disagrees three ways (M-03).
  - Find jobs promises a simulation download that no live job has ever had (M-04).
- **Recommendation.** Fix the two small code gaps (M-01, M-04). Have the owner settle the two legal texts (M-02 period, M-03 marketing). Build the retention sweep before April 2027. The rest is already in other agents' findings; I cite them by id.

## Promise matrix

Verdicts: **kept** (code, test and, where it can be seen, production agree); **partly**; **not built**; **untrue** (the code does something else).

"Prod" says what production shows: **ran** means seen working in production; **never ran** means the path has no production record; **unverified** means the aggregate under "Firestore aggregates wanted" would settle it.

| # | Promise and where it is said | Code that keeps it | Test that proves it | Prod | Verdict | Cheaper fix: build, or delete the promise? |
|---|---|---|---|---|---|---|
| P1 | A job reaches approved companies once it has a description and a playable, sound-free video (doctrine, "Approved companies can review…"; Terms 1; llms.txt) | `server/utils/teamJobAccess.ts:214-262` (sentence and clip required; first look and simulation not required); `jobAutoSend.ts:33-80` | `server/tests/job-sharing-state.test.ts` (13 passed), `company-job-automation.test.ts` | never ran: companySends 0. The only November job the Pipeline got was Blueprint's own capture, and its clip was refused (journey C, C-10). Two more gates sit in the way: paid preparation must be admitted first (G-02), and the 7-day window hides a finished job (G-01) | partly | Build: remove G-01 and G-02 so the clip is made first (journey C P.2). Deleting the promise is not an option; it is the product. |
| P2 | Each approved company is emailed about each new job unless it turned job emails off (doctrine, "When a job is ready…") | `jobAutoSend.ts:44-78`: only companies that are approved and have accepted the current Terms at the moment the job is first listed | `company-job-automation.test.ts` | never ran (companySends 0) | partly: a company approved later, or one that has not yet accepted the Terms, is never emailed about open jobs (B-03) | Build (S): at approval, send one email listing all open jobs. Cheaper still: change the doctrine line to "each company approved when the job is posted". I recommend the build: with one company record today, every future company would miss every existing job. |
| P3 | The first look and the simulation appear in the same job as soon as they are ready (doctrine; HOW_STEPS `publicCopy.ts:68`) | `companyJobPage.ts:146-190` reads the stored first look and package on every page load | `company-facing-site-identity.test.ts` covers the fields | the simulation never existed for any capture (C-01, IP-01); first-look count unverified | partly: appears on the page; no email tells the company (B-03) | Keep the page behaviour. The email can wait until the first package exists. |
| P4 | The five answers, the two "Tested it" ones only once the simulation can be downloaded (Terms 1 and 4; brief; `publicCopy.ts:25-29`) | `server/routes/site-worlds.ts:61-67` refuses a tested answer without a stored package; `CompanyJob.tsx:208` | `company-job-automation.test.ts`, `site-companies-plant-and-prove.test.ts` | the tested answers have never been offered (no package) | kept in code; in production only three answers exist | Nothing to change in code. M-04 hedges the copy. |
| P5 | Introduce us is one press per company, with no limit (doctrine; Terms 3) | `jobIntroductions.ts:108-170` (one transaction, one per company per job, no cap) | `money-introduction-billable-events.test.ts` (13 passed) | never ran (introductions 0) | kept in code | — |
| P6 | Both sides then get the other's name and contact details by email (doctrine; Terms 3; sample job `publicCopy.ts:60`) | `jobIntroductions.ts:155-167`; `robotTeamAccessEmails.ts:169-190`; `taskLifecycleNotifications.ts:159-173` | `company-facing-site-identity.test.ts` ("only the introduction email to that company carries the site's details") | never ran | partly: a reply goes to Blueprint, not the other side (A-01, B-01); the address is promised but only an email and a typed place are held (A-15). An email outage over 36 hours cancels the introduction (F-03) | Fix Reply-To (S, A-01). Delete "address" from the promise, or keep the typed place as it is (owner, A-15). |
| P7 | Both sides are asked at 14, 45 and 90 days, and the answer is recorded on the job (doctrine; Terms 1; Privacy annex) | `jobOutcomes.ts:146-183`, `jobOutcomeGate.ts:71-76` | `server/tests/job-outcomes.test.ts` (21 passed), `e2e/job-outcomes.spec.ts` | never ran | partly: no question once the site closes the job or the authority ends (F-04); answers refused after a withdrawal (O-08) | Fix (S): ask whenever an introduction exists and was not cancelled. |
| P8 | Each introduction is recorded as a billable event (doctrine; WebApp CLAUDE.md) | `jobIntroductions.ts:150` → `billableEvents.ts` | `money-introduction-billable-events.test.ts` | never ran | kept in code. Gaps for a future invoice: O-05, O-07. Nothing lists the events: D-02 | — |
| P9 | A withdrawal removes the job from every company's view at once (doctrine; Terms and Privacy WITHDRAWAL_SENTENCE; emails `taskLifecycleNotifications.ts:30-35`) | `teamJobAccess.ts:229` (checked first, on every company read and every media byte range, `websiteCompanyClip.ts:6-10`) | `website-capture-withdrawal.test.ts`, `self-capture-owner-withdrawal.test.ts` | no withdrawal yet (door: withdrawals 0) | kept | — |
| P10 | The company is asked to delete a saved copy (same sentences) | `withdrawalCompanyNotice.ts:47-79` (companies with a companySends row only) | `withdrawal-company-notice.test.ts:104` pins "never to a company the job was not sent to" | no withdrawal yet | **partly (M-01)**: a company approved after the send can open and download the job but is never asked | Fix (S): also notify every company in `companyViews`. |
| P11 | After a withdrawal the footage is deleted through the deletion process (Privacy retention notes) | `websiteCaptureDeletion.ts`; Pipeline `blueprint-website-withdrawal-deletion.timer` | `website-withdrawal-transport.test.ts` | the Pipeline deletion waits for an approval file that is absent (A-08, D-14) | partly | Fix (S): install the approval file (owner decision). |
| P12 | A site's name, address and contact details are never shared before an introduction: API answers (doctrine; Terms 3; Privacy; sample job) | `companyJobPage.ts:4-6,179-190` reads no identity field; `taskBrowse.ts:16-27` card is category and stage only; `taskListingDetails.ts:67-75` rebuilds the title from a closed category | `company-facing-site-identity.test.ts` (7 passed: library, card, job page, every signed link and its headers, viewer files, access state) | unverified per job; no company has ever read a real job | kept | — |
| P13 | …the site's own free-text sentence | `companyJobPage.ts:182` `removeNamesNotHeld(removeIdentifyingDetails(...))`; clarification answers the same (`jobClarifications.ts:60`) | `client/tests/lib/contactRedaction.test.ts`, `contactRedaction.attack.test.ts` | — | kept. What remains: redaction is pattern-based, so a name the record does not hold and that does not look like a name could pass | — |
| P14 | …the clip and its metadata | Pipeline `website_company_clip.py:395-425`: video stream only, `-map_metadata -1`, no chapters, captions or SEI, every frame checked (`frames_clean`, :416-424); WebApp re-validates `has_audio: false` (`websiteCompanyClip.ts:44`) | `pipeline:tests/test_website_company_clip.py` (journey C: 495 passed in a combined run) | ran: 3 clips built, 2 accepted (test jobs) | kept. What remains: signage the camera films is visible, and the Privacy Policy says so ("Companies see your video as you filmed it") | — |
| P15 | …file names, the simulation package, its README and success rule | `website_company_simulation.py:16-31` (neutral names, outbound scan of every file, refuses on a site-identity finding, :1423-1429); fixed download name `websiteCompanySimulation.ts:184` | Pipeline package tests | no package was ever built | kept in code | — |
| P16 | …signed URLs and bucket paths | company URLs use the opaque request id and capture id (`siteWalkthrough.ts:18-20`; `companyJobPage.ts:157-161`); 15-minute tickets bound to viewer, job and capture | `company-facing-site-identity.test.ts` ("every signed link and its headers") | — | kept | — |
| P17 | The video's sound is removed on every company-facing path, and before any automated review (Privacy "Site footage"; Terms 3) | Company clip `-an` with an ffprobe proof (`website_company_clip.py:481`). WebApp Gemini gets only a stripped copy (`server/agents/adapters/gemini-video.ts:94-99`). Pipeline provider uploads (`capture_audio_minimization.py:1-17`). World Labs gets still frames (`atlas_video_inputs.py`) | clip and audio-strip tests | ran for clips | kept. The internal normalized copy keeps sound (`website_source_video.py:166`); it is internal and covered by "we keep the original … including any sound" | — |
| P18 | A job under an older statement is shown to no company (doctrine; Terms/Privacy OLDER_JOB_SENTENCE) | `teamJobAccess.ts:184-189, 246`; `taskBrowse.ts:73-74` reads only current-listing jobs | `job-sharing-state.test.ts`, `site-footage-brief-confirmation-journey.test.ts` | unverified (aggregate A1) | kept | — |
| P19 | A stuck job retries by itself (doctrine "Everything else keeps going"; AGENTS) | some loops retry; several states exit only by an operator command or a deploy | — | parked states seen (F-10; C-04: a hold ended only when a person replayed it) | partly | See F-10. |
| P20 | At the cap a job ships what it has, flagged (doctrine) | listing needs no simulation (`teamJobAccess.ts:12-13`); but a window end hides the job (G-01), and a launch that rented nothing still holds its $18 (C-03) | — | the real job ended `authority_expired` with no simulation (pipeline-timing) | partly | Fix G-01; build the package from what exists (M-07). |
| P21 | No job is refused by kind (doctrine; Questions page `JOBS_THAT_FIT`) | listing: no kind check. Build choice accepts every job (`website_build_choice.py:1-25`) | — | — | **partly (M-07)**: the package source refuses all but rigid and articulated builds (`scene_packet.py:665-667`). A dead site sentence says "We can't simulate this kind of job yet." (`taskStatusProjection.ts:241`) | Fix within the C-01 rebuild. |
| P22 | Faces are blurred only for jobs under a Privacy Policy before 2026-11-17.1 (doctrine hard stops; Privacy; Terms 3) | `atlas_privacy_screen.py:49` at HEAD lists 2026-11-17.1 to 2026-11-22.1. The active release `cbff06b` lists only up to 2026-11-20.1 (`git show cbff06b:…:49`). The live policy is 2026-11-21.1 (`legalAcceptance.ts:198`; tryblueprint.io/privacy "Effective November 21, 2026") | Pipeline privacy screen tests | **untrue in production today**: a job started under the current policy is blurred, and the decision is sealed for that job (IP-07, F-08, C-09). This is the safe direction for privacy | untrue (confirmed against the active release at 15:51Z) | Fix (S): deploy HEAD. Then turn the rule round to "blur only versions before 2026-11-17.1", so a new policy needs no Pipeline edit (F-08). |
| P23 | No price is stated anywhere (doctrine; CLAUDE.md) | `taskBrowse.ts:24`; `jobCompanies.ts:659` `priceUsd: null` | `client/tests/money/no-price-copy.guard.test.ts`, `server/tests/money-emails-no-price.test.ts` | live bundle: the only dollar figure is the Terms' $100 liability cap (`grep` over `dist/public/assets/*.js`) | kept | — |
| P24 | The site pays nothing (Free for sites; Terms 3) | no payment code is reachable (`grep -rln stripe server` → only `retiredCapturerRoutes.ts`) | `server/tests/money-site-flows-reach-no-payment.test.ts` | — | kept | — |
| P25 | No person at Blueprint stands between a site's video and an introduction (doctrine; CLAUDE.md) | send, answers and introduction are automatic | core journey test (baseline 2 passed) | never ran end to end | partly: a "film it again" hold needed a person (C-04); window extensions need an approval (G-10); staff can still record sends and answers by hand (D-09); withdrawal deletion waits for the owner's file (D-14). Approving a company is allowed by doctrine (D-08 is friction only) | See the cited findings. |
| P26 | The site is told plainly where the job stands: not yet sent, sent and waiting, no response yet (doctrine) | `taskStatusProjection.ts:380-746` | `e2e/site-answer.spec.ts` | — | partly: up to 74 sentences where the doctrine names three (A-06) | Simplify (A-06). |
| P27 | Ask at most one question at a time, inside the job (doctrine hard stops) | `client/src/lib/jobFacts.ts:1-10` asks one at a time; "Not sure" on each; skipping never holds | — | — | kept | — |
| P28 | The site can correct the job description we draft (Terms 1) | `server/routes/site-task-brief.ts:947` task-statement, `:971` confirm | site brief tests | — | kept | — |
| P29 | Retention schedule: a job closes after 12 months idle; videos are deleted 180 days after close; contact details when the job closes; simulations after 365 days; support requests after 90 days (Privacy "How long we keep it") | none | none | no deadline has passed yet (aggregate A5) | **not built (M-02)**. Videos collected under policies since 2026-10-13 have no stated period | Build (M) after the owner picks one period. Deleting the promise is not lawful as it stands; counsel decides. |
| P30 | Cookies: "Marketing cookies let Google Analytics measure whether our outreach works" (Privacy) | the banner says "Personalized ads and content" (`CookieConsent.tsx:198-199`); the code grants `ad_personalization` (`analytics.ts:245-248`); the live build runs no analytics (O-12; my live load: 0 analytics requests) | `client/tests` cookie test (F-14) | ran: the banner shows on every first visit | **untrue (M-03)** | Delete the Marketing toggle and the ad grants (S); the owner edits the policy text. |
| P31 | Processors named in the Privacy Policy actually receive data: Notion; Google Analytics, PostHog, Sentry; Twilio | Notion: no sender; the Pipeline's `notion_spend_projection.py:1-4` "never calls Notion" (M-06, IW-09). GA/PostHog/Sentry: not configured live (O-12). Twilio: `filmLinkHandoff.ts:98` is reachable from `FilmLinkHandoff.tsx`; configuration unknown | — | unverified | untrue for Notion, GA, PostHog and Sentry | Delete the rows (owner, legal text). |
| P32 | "We work with a site or company outside the United States only under signed transfer terms" (Privacy) | the site path offers sharing to a non-US site (A-02); the company application has no country field (`robot-team-access.ts:46`) | — | unverified (aggregate A7) | **partly (M-05)** | Fix (S): one question on each side. |
| P33 | We email account holders before a material change takes effect (Terms 11; Privacy) | operator script only (`accountNotice.ts`, inventory E13) | — | unverified (aggregate A4) | unverified (M-09) | Owner decides. |
| P34 | Find jobs shows every open job (doctrine "shown to every approved deployment company") | `taskBrowse.ts:73-74` reads at most 200, in no order | — | latent at 76 jobs | partly (M-08) | Fix (S). |

Count, 34 rows:

- Kept: 15 (P4, P5, P8, P9, P12 to P18, P23, P24, P27, P28). P4, P5 and P8 are kept in code only and have never run.
- Partly: 14 (P1, P2, P3, P6, P7, P10, P11, P19, P20, P21, P25, P26, P32, P34).
- Not built: 1 (P29).
- Untrue: 3 (P22 in production, P30, P31).
- Unverified: 1 (P33).

## Loose ends, settled

### (a) Video retention

- **What the Privacy Policy says.** Recordings under the 2026-10-13 policy keep "180 days after the job closes". For later recordings a period of at least 7 years is "proposed" and needs legal review. The policy also says: "Our storage does not currently delete originals automatically on a schedule."
- **What the code does.** No code computes when a job closes or deletes on a timer. My grep found only an 8-day cleanup of rate-limit counters (`durableDailyCaps.ts:34`). The Pipeline's workspace retention reclaims disk and keeps everything restorable (`website_scene_workspace_retention.py:1-36`).
- **Is building it needed?** Yes. The policy states periods and the law expects one per category. The first deadline has not arrived: a job closed by its site in mid-October is due no earlier than mid-April 2027, and an idle job closes after 12 months. The deadline is still unverified; see aggregate A5.
- **The least that makes the policy true:**
  1. The owner picks one period for every recording. I recommend the existing "180 days after the job closes".
  2. One daily loop in the existing worker computes `closedAt` (site close, withdrawal, or 12 months idle) and, after 180 days, puts the job on the existing withdrawal deletion queue and clears its contact fields.
  3. The Pipeline's deletion approval file is installed (D-14), so the queue runs without a person.
- **What can wait.** Simulations and answers at 365 days can wait until the first is due. Effort M. Finding M-02.

### (b) Marketing cookies (finding M-03)

| Source | Exact words or behaviour |
|---|---|
| Privacy Policy, Cookies | "Marketing cookies let Google Analytics measure whether our outreach works." Neither category is pre-selected; Global Privacy Control keeps both off. |
| Privacy Policy, California row | "If you turn on marketing cookies, Google Analytics may use them to measure whether our outreach and ads work … can treat that as sharing … for cross-context behavioral advertising." |
| Cookie banner (`CookieConsent.tsx:198-199`, live screenshot `M-03-cookie-banner-390.png`) | "Marketing — Personalized ads and content". |
| Code (`analytics.ts:245-248`) | With both Analytics and Marketing ticked: `ad_storage`, `ad_user_data` and `ad_personalization` granted. With Marketing alone: nothing granted. |
| Live site | No measurement id, no PostHog token, no Sentry DSN (O-12). My load sent 0 analytics requests. |

Recommendation: delete the Marketing toggle and the ad grants. Show no banner while no analytics id is configured. The owner then rewrites the two policy passages. That is legal text: I flag it and do not edit it.

### (c) Notion (finding M-06, builds on IW-09)

- No WebApp or Pipeline code sends anything to Notion. The WebApp has only unused env names (`server/config/env.ts:85-88`).
- The Pipeline's `notion_spend_projection.py` builds a spend summary and says it "never calls Notion". It holds provider spend rows, not personal data.
- One owner question remains: does a person copy support records into Notion by hand? If not, remove the row at the next policy edit.

### (d) Outside the US (finding M-05, builds on A-02)

- **Site side.** A non-US site is offered, and has recorded, the sharing agreement, although its video can never be taken (A-02).
- **Company side.** Nothing at all checks where a company is. The application has an optional free-text "region" and the approval has no country check (`robot-team-access.ts:46`).
- The policy's sentence ("only under signed transfer terms") is therefore kept only by luck.
- Fix (S): on the site side, one sentence and no save. On the company side, one yes/no field shown on the approval row. The owner declines or holds non-US companies until transfer terms exist.

## The other kind of missing: what the core loop needs and does not have

I tested each candidate from journeys A and B against the brief's list: sentence and video in, agreement recorded, a judgeable packet, the company's answer, Introduce us, two contact emails, the billable event, the 14/45/90-day question, withdrawal.

| Candidate | From | Core loop needs it? | Verdict |
|---|---|---|---|
| Reply-To on introduction emails goes to the other side | A-01, B-01 | Yes: "the two contact emails" are the hand-off | build now (S) |
| Companies approved later hear about open jobs | B-03 | Yes: without it, no company approved after a job is posted is ever emailed about it | build (S) |
| The job's city for companies (not the street address) | B-04 | Arguably yes: "a packet a company can judge"; travel decides fit | owner decision (privacy text) |
| Email when the simulation becomes ready | B-03 | Only once a package exists; it is the trigger for "Tested it" | later, with C-01 |
| A simulation package that opens outside USD tools; a success-rule explanation | B-10 | Nice extra until a package exists at all | later |
| Declined or waiting applicants are told | B-08 | No for the loop; yes for a customer's first impression | small build (S) |
| One page of totals and a list of billable events for the owner | O-06, D-02, D-03 | Yes for the owner: "the billable event" is useless if nobody can list it | build (S) |
| The 14/45/90-day questions after the site closes its job | F-04 | Yes: part of the loop | fix (S) |
| An introduction not cancelled by stale company Terms or an email outage | G-06, F-03 | Yes | fix (S) |
| The job stays listed when Blueprint's own window ends | G-01 | Yes: P0 | fix (S) |
| Five site states instead of 74 sentences | A-06 | Not a missing feature; simplification | simplify |
| What happens next after a company answers | B-13 | Small, real; one sentence | build (S) |
| Withdrawal deletion without the owner's file | D-14 | Yes: withdrawal is in the loop | owner installs the file |

## Requirements ledger

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

## Firestore aggregates wanted

Only counts and timestamps; no names, emails, sentences or addresses.

- **A1.** `inboundRequests` where `request.buyerType == "site_operator"` and not an internal test job (`internal_test != true`):
  - the count;
  - counts by `request.consent_attestation.statement_version`;
  - the count with `public_task_listing.consentVersion == "job-shared-2026-11-12"`;
  - the count with `company_auto_send.sentAtIso` set.
- **A2.** `captureUploadSessions`:
  - counts by `company_clip.permission_basis`;
  - the count with a valid `company_simulation`;
  - the count where `website_preparation` holds a completed robot-fit v2 table (`status == "completed"`), i.e. jobs with a first look.
- **A3.** `robotTeamAccess`:
  - counts by `status` and `partnerRole`;
  - the count whose accepted Terms version equals the current one;
  - the count with a non-empty `region` (presence only).
- **A4.** `captureOutbox`:
  - counts by `kind` and `status`;
  - for `kind == "account_notice"`, counts per `createdAt` day since 2026-11-17.
- **A5.** `inboundRequests` with any `website_run_closures` entry, `workspace_task.archived == true` or `capture_withdrawal` set: the count and the earliest closure or withdrawal timestamp, to give the first retention due date.
- **A6.** Collection group `companyViews`: the count, and the count of view rows whose company has no `companySends` row on the same job. That is the exposure behind M-01.
- **A7.** `inboundRequests` with a non-US capture region or country and a v4 or later consent: the count.

## Good things to leave alone

- The company-facing identity test (`server/tests/company-facing-site-identity.test.ts`) is the right shape: one test that walks every surface. Keep it as the guard for any new company field.
- The clip builder and the package scan in the Pipeline are careful and cost nothing to run.
- The introduction transaction (`jobIntroductions.ts:108-170`) writes the introduction, the encrypted details, the billable event and both emails in one place.
- "No price anywhere" holds in the built bundle and has a guard test.
