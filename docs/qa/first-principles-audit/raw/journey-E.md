# Journey E: the five-minute investor walkthrough

Agent journey-E, 2026-11-22. WebApp at `0ee5df63` (the live commit, per `https://tryblueprint.io/version.json`).
Findings: `journey-E.findings.json` (E-01 to E-17). Demo script: `demo-script.md`.

## In one breath

The public half is ready and fast. The other half has nothing real behind it.
Production has never sent a job to a company: 0 sends, 0 introductions, 1 approved company.
The only simulations belong to internal test jobs, and companies may never see those.
A real site's packet may not be shown to investors: the site agreed to share with approved deployment companies.
The unmerged demo build (PR 1369) adds invented quotes and counts and nothing for steps 3 to 7.
**Readiness: red today. Amber in about a day with a hybrid walkthrough. Green after one real job runs end to end.**

## How this was measured

- Live site, public pages only, Playwright through the session proxy, a fresh browser context per run, 3 runs per page per width (1280 x 800 and 390 x 844). No form submitted, no sign-in. Script: scratchpad `agents/journey-E/scripts/live.js`; raw numbers: scratchpad `agents/journey-E/live-timings.json`.
- "Heading visible" = wall time from navigation start to the page's main heading being visible. TTFB, FCP and LCP come from the browser's own timing entries. All numbers include the proxy hop.
- Local site on port 4350 (`BLUEPRINT_E2E=1`, scheduler off, Firebase credentials blanked, `VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH=1`), every API answer mocked with `page.route`, using the same shapes as `e2e/site-answer.spec.ts:192-218` and `e2e/job-companies.spec.ts:108-145`. Spec: scratchpad `agents/journey-E/pw/rehearsal.spec.ts` -> 4 passed. Fixture sentences say "Fixture".
- The simulation viewer was loaded locally with a synthetic 3,000-splat PLY written by a Pipeline unit test (no site data).
- Production counts: the orchestrator's read-only baseline (`scratchpad/baseline/firestore-*.json`), aggregate only. Door status: the 15:01Z copy.

### Live timings (ms, run 1 / run 2 / run 3)

| page | width | TTFB | heading visible | FCP | LCP | load | console errors | failed requests | sideways scroll |
|---|---|---|---|---|---|---|---|---|---|
| / | 1280 | 142/81/75 | 198/127/120 | 296/272/232 | 1116/736/624 | 633/975/728 | 0 | 0 | no |
| /how-it-works | 1280 | 80/72/78 | 127/121/119 | 212/200/200 | 1980/1972/200 | 640/686/472 | 0 | 0 | no |
| /jobs | 1280 | 64/79/65 | 116/139/121 | 216/212/264 | 216/468/264 | 502/536/697 | 0 | 0 | no |
| /jobs#sample-job | 1280 | 61/70/66 | 122/121/117 | 208/232/192 | 352/488/520 | 542/466/500 | 0 | 0 | no |
| /contact/site-operator | 1280 | 79/66/70 | 132/106/118 | 224/288/200 | 940/788/2004 | 505/647/1026 | 0 | 0 | no |
| /beta (Questions) | 1280 | 65/73/64 | 121/124/103 | 192/216/164 | 192/612/164 | 407/507/387 | 0 | 0 | no |
| /contact/robot-team | 1280 | 69/68/75 | 104/102/110 | 172/196/204 | 1984/696/652 | 582/615/369 | 0 | 0 | no |
| /jobs/:id signed out | 1280 | 80/78/173 | 1406/901/1001 | 552/520/660 | 2044/2020/2156 | 511/484/617 | 0 | 0 | no |
| / | 390 | 67/67/123 | 105/126/167 | 188/208/276 | 1988/1980/736 | 598/496/613 | 0 | 0 | no |
| /how-it-works | 390 | 73/133/108 | 113/170/148 | 196/252/236 | 196/252/236 | 661/670/532 | 0 | 0 | no |
| /jobs | 390 | 64/79/63 | 121/135/111 | 212/228/192 | 212/384/192 | 425/465/455 | 0 | 0 | no |
| /jobs#sample-job | 390 | 67/64/68 | 117/119/120 | 236/212/216 | 356/496/396 | 404/488/510 | 0 | 0 | no |
| /contact/site-operator | 390 | 61/114/68 | 107/153/109 | 200/228/172 | 1992/2092/1968 | 902/960/487 | 0 | 0 | no |
| /beta | 390 | 115/81/74 | 161/124/123 | 264/208/208 | 408/208/208 | 305/457/483 | 0 | 0 | no |
| /contact/robot-team | 390 | 67/90/66 | 112/128/106 | 204/224/204 | 632/2000/476 | 296/678/412 | 0 | 0 | no |
| /jobs/:id signed out | 390 | 73/68/64 | 898/893/900 | 248/364/344 | 1752/1864/1844 | 386/330/298 | 0 | 0 | no |

The sample video played 2.5 s within 2.6 s of pressing play at both widths (readyState 4).
LCP near 2 s on some runs is a late paint (likely the cookie banner or a web font); the heading is visible within 0.2 s on every public page.

### Local timings (mocked answers, ms)

| screen | 1280 | 390 |
|---|---|---|
| Site job page until Introduce us is visible | 1185 | 477 |
| Company library until the job row is visible | 610 | 464 |
| Company job page after "View job" | 409 | 339 |
| Simulation viewer, synthetic scene, until the canvas is up | 664 (WebGPU default), 544 (WebGL) | not run |

## 1. The journey today (presenter on the live site)

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

## 2. The journey as proposed (five beats, 7 steps -> 5)

| # | beat | screen | what the presenter does | wait | failure modes left | friction |
|---|---|---|---|---|---|---|
| 1 | Home, with a 15-second glance at the start form | live `/`, then Start a job | Says the line; shows the one form; does not submit | 0.2 s each (measured) | none if the banner was answered beforehand | 0 |
| 2 | A packet | live `/jobs`, "See a sample job", play | Says it is stock footage | 0.1 s + 2.6 s (measured) | none | 1 |
| 3 | A company answers, simulation opened from the packet | pre-opened tab: recorded real-code run on test data (amber), or the real job (green); simulation tab pre-warmed | Shows the job, the video, presses View the simulation, picks Interested | 0.3-0.6 s (local, measured); simulation pre-warmed | must be said as test data until E-01 | 1 |
| 4 | The site's responses | pre-opened tab, same run | Shows Company A Interested, Company B Need more details with its words | 0.5-1.2 s (local, measured) | same | 1 |
| 5 | Introduce us | same tab; then the two emails from the recorded run | Presses it; shows "Introduction requested" and the emails | instant locally | line is thin (E-14) | 1 |

After: 5 beats, about 6 clicks, 0 fields, 0 sign-ins on stage (tabs opened beforehand), 0 live email waits.

Deletions I expect might come back: the start form glance (an investor may ask to see the full form) and the separate simulation stop (if the simulation becomes the headline).

## 3. Requirements ledger

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

## 4. Findings with evidence

Ranked. Full fields in the JSON.

- **E-01 (P0, demo-risk) The loop has never run in production.** `firestore-collection-counts.json`: companySends 0, introductions 0, robotTeamAccess 1 (approved 2026-09-28). 61 site jobs since April, 17 shared, none sent. Fix: one real job end to end before the demo.
- **E-02 (P0, privacy) No real site's packet in front of investors.** The recorded statement shares a job with "robot deployment companies we've approved" (`e2e/site-answer.spec.ts:24`; `publicCopy.ts:7-11`). Investors are not that audience.
- **E-03 (P0, privacy/money) Introduce us is irreversible.** The billable event is created in the introduction's transaction and never rewritten (`billableEvents.ts:1-10`); the emails go out with the 60 s outbox pump. Press it only on test data.
- **E-04 (P0, untrue, not live) PR 1369.** Invented "42 open jobs · 18 approved deployment companies" (production: 1), an invented "first response within 5 business days", two invented quotes. `git apply --check` against HEAD: applies cleanly. It covers none of steps 3 to 7. Close it.
- **E-05 (P1) No simulation in a company's view.** 6 company simulations, all `internal_test`; test jobs never reach companies (`internalTestJob.ts:5-6`). Door: 4 scene previews ready. Use the staff viewer for one internal test job, pre-warmed.
- **E-06 (P1) Steps 5 to 7 exist only as test-runner mocks.** Rendered fine locally (screenshots E-10 to E-14); the real-code core journey passes in 25 s but records nothing. Record it once with video.
- **E-07 (P1, slow) Cold simulation open is unmeasured.** Up to 32 MiB pulled from the Pipeline on first view (`websiteScenePreview.ts:38,247`). Warm it an hour before.
- **E-08 (P1, unseen) Investor numbers.** None on screen. True today: 61 jobs, 17 shared, 1 company, 0 sends, 0 introductions; created-to-shared median 0.03 h (n=3); upload-to-simulation never measured (n=0).
- **E-09 (P2) Retired hosted-evaluation samples are public** (`/samples/sample-hosted-review-report.md` 200; proof reel 3.1 MB 200), pinned by `build-output.test.ts:181-195`.
- **E-10 (P2, money) `scripts/qa/live-rehearsal.mjs` posts to production** through the public form (not marked internal) and fills labels that no longer exist.
- **E-11 (P2) `/jobs#sample-job` does not scroll** (scrollY 0, sample at 1188 px / 1536 px). Clicking the link works.
- **E-12 (P2) Cookie banner** covers about a third of the 390 screen on first visit (E-01-home-390, E-05-start-390).
- **E-13 (P2) Example card leads with "Tested it: can do".**
- **E-14 (P2) "Introduction requested." says nothing about the emails.**
- **E-15 (P2) Three dead screens in the seven-step plan.**
- **E-16 (P2) Simulation opens in a new tab; back goes to /app.**
- **E-17 (P2, unverified) Viewer asks for WebGPU first;** untested on Safari, Firefox or a screen-share.

### What an investor will ask, step by step

| step | question | on screen today? | truthful answer exists? |
|---|---|---|---|
| Home | How many sites have posted? | no | yes: 61 non-internal site jobs Apr-Nov 2026, 17 shared (baseline aggregate) |
| Start | How long until a site sees something? | no | partly: shared within a median 0.03 h (n=3); first look and simulation times never measured |
| Packet | Is this a real job? | yes, says stock footage | yes: no real packet may be shown (E-02) |
| Simulation | How long and how much per simulation? | no | no: never measured per job (D-04; n=0) |
| Company view | How many companies? | no | yes: 1 approved |
| Responses | How fast do companies answer? | no | no: 0 sends, so nothing to measure |
| Introduce us | What is billable, and how many so far? | no | yes: each introduction is one recorded billable event with no price (`billableEvents.ts`); count 0 |

### Firestore aggregates wanted

Read-only, counts and durations only, no free text, no names, no emails.

1. `inboundRequests`, non-internal (`internal_test` absent): count by `public_task_listing` enabled, by month created; count withdrawn.
2. `inboundRequests` where `internal_test` present: count, and the opaque `requestId`s whose capture has a ready scene preview (for picking the pre-flight job).
3. `companySends` (top level or per-job subcollection): count, by month. Per-job `robotTeamInterest` subcollections (collection group): count by `state`.
4. `introductions` and `billableEvents`: count by `status`.
5. Durations per non-internal job: created -> listed, listed -> first send, first send -> first answer, first answer -> introduction (median, p90, n).
6. `robotTeamAccess`: count by `status`; for approved ones, a boolean "email domain is tryblueprint.io" (never the address).

## 5. What works well and should be left alone

- **The public pages.** 48 loads, heading in 0.10-0.20 s, no errors, no failed requests, no sideways scroll. Do not touch them for the demo.
- **The sample job.** Honest labels, credited stock video, names what a live job adds instead of faking it (`SampleJob.tsx:11-14`). It is the right step 3 until a real job exists.
- **The core-journey test.** Real handlers, start to introduction to withdrawal, 25 s. It is the demo's safety net and its best recording.
- **The site's job page.** Responses first, each by alias with the company's words, Introduce us with its one sentence on the first screen at both widths (E-10).
- **The company job page.** The job in the site's words, what counts as done, the video, the answer form beside it (E-13).
- **One copy file.** `publicCopy.ts` keeps every page saying the same thing, with no price.
- **The internal-test marker.** It is why test footage can never reach a company by accident.
- **The viewer's plain failure message** instead of a black scene (`boot.js`).

## Screenshots

Live: `E-01-home`, `E-02-how`, `E-03-jobs`, `E-04-sample`, `E-05-start`, `E-06-questions`, `E-07-company-signedout`, `E-08-companyjob-signedout`, `E-09-sample-scrolled` (each -1280 and -390).
Local, mocked: `E-10-site-responses`, `E-11-introduced`, `E-12-company-library`, `E-13-company-job`, `E-14-sim-viewer-noscene` (each -1280 and -390); `E-15-sim-viewer-webgpu-default-1280`, `E-15-sim-viewer-webgl-1280` (synthetic scene).
