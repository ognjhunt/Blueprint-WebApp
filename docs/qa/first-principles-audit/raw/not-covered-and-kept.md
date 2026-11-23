# What each agent said it did not cover

Collected from every report, as written. The completeness check starts from this list.


## dim-fragile

- The extractFrames code (BlueprintCapture repository is not checked out); its failure modes are inferred from WebApp and Pipeline references only.
- Real-device behaviour of locked phones and backgrounded tabs (F-06): code reading only.
- Render's proxy timeouts in front of the web service (F-05): measured on bare Node 22 only.
- Vast provider error handling beyond the runbook's recovery classes: not traced in vast_provider_adapter (10,327 lines).
- The three Pipeline nightly failures were not reproduced locally; evidence is from GitHub run metadata and the inventory.
- site-intake-recovery and site-intake-backend-reliability suites were not run (they need the Firestore and Storage emulators on fixed ports); only the durability suite's A-IDB cases were run.
- Whether Slack and the ops email route are configured in production (betaOpsMonitor delivery): env values not read.

## dim-gates

- Production counts that need Firestore (intake cap trips, listings closed per reason, older statements): listed as aggregates in the report
- The reason code of the one Atlas needs_input job (would need reading its state file)
- Whether the spend guard's blocked status also blocks reconciler teardown proofs
- Deployed values of Render and host env overrides for the caps
- No tests or servers were run; code and door reads only
- Journey E had not reported

## dim-missing

- Production counts beyond the orchestrator's document counts: I wrote the aggregates I need under 'Firestore aggregates wanted' in the report.
- The Pipeline's 14-day deletion of temporary processing files: I did not find or test it; unverified.
- Whether Twilio is configured in production for the film-link text message the Privacy Policy lists.
- Rendering every email body: I read the builders, not rendered output, except where tests ran.
- Journey E (investor demo) was not yet written when I finished, so demo ranking rests on journeys A to D.

## dim-observe

- Production Firestore contents: only the orchestrator's document counts were used; field-level questions are listed under 'Firestore aggregates wanted'.
- Render request logs, Slack channel contents and Resend dashboard settings (click tracking on or off): no access; O-01's click-link exposure depends on that setting.
- Whether BLUEPRINT_ANALYTICS_INGEST_ENABLED, SLACK_WEBHOOK_URL and BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED are set in production: not visible from the repo or the live bundle.
- Capacity alert delivery history: door cat of capacity/latest.json and history.jsonl was refused (open_failed); delivery was confirmed only through the unit-failure records.
- Admin pages were not rendered in a browser (Journey D walks them); this report reads the code and data under them.
- Firestore and Storage backup status for the WebApp (DATA_BACKUP_AND_DR_RUNBOOK.md says a schedule is not established); not verified.

## dim-vestigial

- No request logs from Render were read, so redirect and route deletions rest on code callers, not traffic.
- Host env files were not read, so the production value of commented Pipeline switches is unknown.
- CI minutes are estimated from six sampled runs per workflow over 7 days, not from billing.
- Journey E (investor demo) was not yet written when this report was finished; its findings are not cross-referenced.
- Cloud Run, GCP and B2 objects held by retired lanes were not inventoried (door only sees the host).
- I did not run any test suite; deletion safety claims rest on the import graph and string search, not on a green build after deletion.
- The spend guard costs about 35 CPU-seconds per run (about 8.7 CPU-hours a day); I did not measure how much of that is the RunPod query.

## inventory-pipeline

- Did not open any site state file, frames or media; why 4 captures lack a team-scene half is not traced (privacy rule).
- Did not run test suites; durations are from GitHub run metadata.
- Host env files were not read, so production values of commented switches are unknown.
- Import graph is static; dynamic imports, subprocess workers and remote images can add edges.
- Flags were not re-classified one by one; the 2026-11-05 inventory is cited.
- Cloud Run, GCP and B2 resources were not inventoried beyond door output.

## inventory-webapp

- Per-row owner for every flag and collection: most have no owner comment; I recorded 'nobody found' rather than guess.
- Production values of server env flags: dashboard-managed in Render, not readable from the repo; marked unknown.
- Render request logs: not read, so 'no caller' means no caller in code, not no traffic.
- Deployed Firebase Storage and Firestore rules: not compared with the repo files.
- Screen states were enumerated from code and the launch-copy inventory, not walked in a browser; no local server was started.
- Pipeline-side callers were matched by path strings; a path built from parts in the Pipeline could be missed (marked unverified where the last path word is generic).
- Default values for env names were extracted by pattern for 73 of 249; the rest show '-'.

## journey-A

- Real iOS Safari and Android Chrome devices (camera, codecs, backgrounding); Chromium with an iPhone user agent only
- Forms on the live site (not allowed); only public pages were loaded there
- Wall-clock waits between Pipeline stages (see journey C)
- The account/claim path and the signed-in site's /app
- I did not rerun the core-journey spec under the emulators; I relied on the baseline pass
- Company-side emails except where they reach the site (journey B)

## journey-B

- Real approval durations, company counts and email delivery (need the Firestore aggregates in the report)
- The in-browser simulation viewer (mocked)
- A real job's simulation package and its physics schemas (privacy rule; fixture only)
- The admin approval page rendered (read in code only)
- HTML rendering of emails
- Google sign-in path (needs live Firebase)

## journey-C

- The six test scenes retired on 2026-11-21 and captures 447ae4f4 and 5b067498: the door refused their retirement receipts (secret scan), so they are not in any timing.
- First look timing and packet publication timing: WebApp Firestore; aggregates listed in raw/pipeline-timing.md.
- Per-job Gemini and Meta SAM spend: lives in the WebApp ledger (Firestore), not read.
- The blockers of the seven blocked launches: their launch folders are offloaded; door pull was not used.
- No real-job replay was run: replaying needs the job's raw video pulled, which the privacy rule forbids. Fixture tests only.
- Whether the first look renders the robot-fit table (C-13).
- No screenshots: this journey has no screen of its own; the site and company screens are journeys A and B.

## journey-D

- Firestore production funnel counts beyond the orchestrator's collection totals (listed under Firestore aggregates wanted)
- Live door journal reading of each alert post (where alerts land is a host secret)
- /settings, /onboarding and the company pages (other journeys)
- Site measurements, robot fit and evidence questions tools were not opened with data (no fixtures for their shapes); judged from code headers only
- The account deletion queue was shown empty only
- Timing of the admin job list against real Firestore (one outlook read per row, 8 s deadline each) not measured

## journey-E

- The site's start form was not submitted anywhere (live: forbidden; local: not needed for the demo).
- The real simulation of an internal test job was not opened: that needs the owner's admin sign-in on production and would read real scene data.
- First-open time of a real simulation scene (E-07) and the viewer on Safari, Firefox or a screen-share (E-17).
- Email arrival time after Introduce us on production (no email may be sent).
- Whether staff accounts can open a company job page as a company would.
- The core-journey test was not rerun (fixed port 4183 and emulator ports belong to others); the baseline log was used.
- The /app account pages and the /admin/jobs console were not rendered.

## verify-L1

- A-03 and E-06: did not rerun the Playwright walks; verdicts rest on code reads.
- A-05: the deployed BlueprintCapture extractFrames limit is not in either repository.
- G-02: door journal clip counts were not re-read through the operator door.
- M-02: how many site-closed jobs exist (contact details due for deletion at close) is not in the production count files.
- E-04: did not rerun git apply --check of PR 1369 against HEAD.

## verify-L2

- D-10: whether the WebApp production env sets RECONSTRUCTION_PIPELINE_BASE_URL and whether the control plane mounts the reconstruction execute route (would need the door's read commands; not run, to stay economical).
- D-08: whether a Slack webhook is configured in production.
- B-08: whether a signed-in applicant can reach the in-review and declined screens (no live sign-in allowed).

## verify-L3

- C-12: the disk-budget refusal of 2026-11-18T15:32Z does not record its role or bytes in the progression event; the disk-budget ledger for that time would settle whether retired-lane data or declared retired footprints caused it.
- D-16: where BLUEPRINT_OPERATOR_ALERT_WEBHOOK_URL and SLACK_WEBHOOK_URL deliver is set on the host and in Render and is not readable from the repos.
- IP-07: how many jobs since 2026-11-21 carry Privacy 2026-11-21.1 (production counts show privacy_version absent on all 61 job records).

## verify-L4

- The deployed Firebase Storage rules (IW-04) were not read; no firebase CLI read was attempted, so production state is unknown.
- The 35-route and 10,514-line counts (IW-01, IW-02) were sampled, not fully recomputed.
- The three intake Playwright suites (IW-06) were not run, so whether they pass is unknown.

## Good things the agents said to leave alone

- [dim-fragile] The WebApp ends every job itself when its window passes, with no email and a page that says so Why: No job waits for ever on the Pipeline: the site always gets an ending. (webapp:server/utils/websiteJobWindowSweep.ts:1-32)
- [dim-fragile] The email outbox: fixed idempotency keys, provider idempotency, 'unknown outcome' rows never re-sent Why: A worker or web restart never sends an email twice. (webapp:server/utils/captureOutbox.ts:380-470, captureOutboxRetry.ts:23-47)
- [dim-fragile] Automatic send and outcome questions are idempotent and catch up after downtime Why: A marker on the job (company_auto_send) and fixed outbox ids per job, company, side and day mean a day of worker downtime delays sends but neither skips nor duplicates them. (webapp:server/utils/jobAutoSend.ts:37-86; jobOutcomes.ts:130-160)
- [dim-fragile] The leader lease falls back to Firestore when there is no Redis Why: Two processes never run the same loop at once even without Redis. (webapp:server/utils/automationLeaderLease.ts:148-171)
- [dim-fragile] The upload watch: no Pipeline status within 2 h pages ops, and the site page says only that it is taking longer Why: It catches extractFrames, Pub/Sub and host outages from outside the Pipeline. (webapp:server/utils/websitePreparationWatch.ts:1-13,62-63)
- [dim-fragile] The door parks a deploy while paid work is in flight, and each paid call keeps its receipt Why: A deploy never wastes money already spent. (pipeline:docs/runbooks/beta-operations.md:655-666)
- [dim-gates] One predicate decides company visibility on every surface Why: Fixing G-01 and G-06 is a small change because teamJobAccess is the single rule, also checked inside the introduction transaction (webapp:server/utils/teamJobAccess.ts:222)
- [dim-gates] The $40 cap is enforced in one transaction and ships flagged at the cap Why: No owner grants, no extensions; the job waits for no one at the cap (webapp:server/routes/internal-capture-worlds.ts:376; pipeline:src/blueprint_pipeline/website_scene_handoff.py:542)
- [dim-gates] Face blur fails safe for unknown versions Why: Any doubt blurs, so a privacy promise to older sites cannot be broken by a missing list entry (pipeline:src/blueprint_pipeline/atlas_privacy_screen.py:178)
- [dim-gates] Owner success thresholds hold nothing Why: The team packet compiles at once on assumed thresholds; nothing waits for a person (pipeline:src/blueprint_pipeline/website_owner_success_confirmation.py:1)
- [dim-missing] Company-facing identity protection Why: A test walks every company surface (library, card, job page, signed links and headers, viewer files) and finds nothing naming, placing or reaching the site before an introduction; the site's own sentence and clarification answers are redacted. (webapp:server/tests/company-facing-site-identity.test.ts (7 passed, run 2026-11-22); server/utils/companyJobPage.ts:179-182; server/utils/jobClarifications.ts:60)
- [dim-missing] The silent company clip Why: Video stream only, metadata, chapters, captions and SEI removed, every frame checked, audio count proven zero before publishing. (pipeline:src/blueprint_pipeline/website_company_clip.py:395-425,481)
- [dim-missing] The simulation package's outbound scan Why: Neutral file names, every file scanned for ids, links and site identity before zipping; a fixed download file name. (pipeline:src/blueprint_pipeline/website_company_simulation.py:27-31,1423-1429; webapp:server/utils/websiteCompanySimulation.ts:184)
- [dim-missing] No price anywhere Why: Only the Terms' $100 liability cap matches a dollar pattern in the built bundle; a guard test checks emails and pages. (cmd: grep dollar amounts in dist/public/assets/*.js -> only ' $100.' (liability); client/tests/money/no-price-copy.guard.test.ts)
- [dim-missing] Introduction and billable event in one transaction Why: One press writes the introduction, the encrypted details, the billable event and both emails atomically, one per company per job. (webapp:server/utils/jobIntroductions.ts:108-170; server/tests/money-introduction-billable-events.test.ts (13 passed))
- [dim-missing] Withdrawal closes every company surface at once Why: Every media byte range and every company route re-reads teamJobAccess, which checks withdrawal first. (webapp:server/utils/teamJobAccess.ts:229; server/utils/websiteCompanyClip.ts:6-10)
- [dim-observe] Billable event written once in the introduction's own transaction, created not set, voided not deleted Why: Exactly once protects money; 13 offline tests plus the emulator journey pin it (webapp:server/utils/billableEvents.ts:28-46; server/tests/money-introduction-billable-events.test.ts)
- [dim-observe] Intake and ops notices are link-only Why: Ops alerts carry ids and admin links, never names or emails (webapp:server/utils/intakeOpsNotice.ts:17-20; betaOpsMonitor.ts:240-246)
- [dim-observe] Email send logs keep only the recipient's domain Why: No address enters the log on send (webapp:server/utils/email.ts:106-132)
- [dim-observe] Introduction outbox rows are cleared on send and the introduction record is encrypted Why: The one place both sides' details meet is protected; extend the same rule (O-02) (webapp:server/utils/captureOutbox.ts:136-147; jobIntroductions.ts:146-150)
- [dim-observe] Client telemetry sanitizer and request-log link redaction Why: Signed links and emails are stripped before telemetry and logs (webapp:client/src/lib/invitationPrivacy.ts:1-55; server/utils/blueprintWorkLogPrivacy.ts:14-22)
- [dim-observe] Door status and Pipeline journals hold no personal data Why: grep found 0 email addresses in door status, and 0 signatures, tokens or emails in five unit journals (9,000+ lines) (cmd: door journal <unit> -n 2000 | grep -ciE 'Signature=|token=|@' -> 0)
- [dim-observe] Company first-answer time is kept when an answer changes Why: Time-to-answer is measurable (webapp:server/utils/jobCompanies.ts:230,377-386)
- [dim-vestigial] The 2026-11-15 trial removal (#3598) deleted 412 files and 109,638 lines in one go, and every release disarms retired triggers by name Why: Shows deletion at scale works here; the remaining work is the edges it could not cut (pipeline:scripts/deploy_control_plane_commit.py:639-664 (DEFAULT_PAUSED_LANE_DISARM_UNITS, DEFAULT_RETIRED_TRIGGER_UNITS))
- [dim-vestigial] Retired capture-app routes answer 410 before any auth Why: Cheap, explicit, and stops old clients without keeping their code (webapp:server/utils/retiredCapturerRoutes.ts:13)
- [dim-vestigial] Withdrawal deletion has a named reader per retired lane (screening, G1, team scene, rigid probe) Why: It tells exactly which readers must outlive each lane's data, which makes a safe removal order possible (pipeline:docs/SYSTEM_MAP.md:69)
- [dim-vestigial] The outbox kinds list was cut from 43 to 13 and retired kinds are cancelled at dispatch Why: The right pattern for emails: one list, one owner date (webapp:server/utils/captureOutbox.ts:58,126)
- [inventory-pipeline] Paid call sites are inventoried and checked by a verifier Why: 71 API-priced call sites each name their admission; adding an unadmitted one needs an explicit test edit (pipeline:scripts/paid_api_call_sites.json; scripts/verify_paid_resource_allocator.py)
- [inventory-pipeline] Face-blur decision fails safe Why: Any doubt, unknown or later Privacy version blurs; only listed versions skip it (pipeline:src/blueprint_pipeline/atlas_privacy_screen.py:178-196)
- [inventory-pipeline] Company simulation package is free, deterministic and outbound-scanned Why: Local CPU only, same inputs give the same digest, every file scanned for ids and links before zipping (pipeline:src/blueprint_pipeline/website_company_simulation.py:1-45)
- [inventory-pipeline] The 2026-11-15 removal (#3598) cut 109,638 lines of trial, canary and agent-run code Why: Shows retired systems can be removed in one reviewed PR (cmd: git show --stat 45a99fbeb -> 412 files changed, 1254 insertions(+), 109638 deletions(-))
- [inventory-pipeline] Deploy disarms paused lanes and retired triggers and records it in the receipt Why: Retired timers stay off after every release (pipeline:scripts/deploy_control_plane_commit.py:639,657; door-status.json deploys.recent_receipts paused_lane_disarm)
- [inventory-webapp] Retired capture-app routes answer 410 before any auth, store read or provider call Why: Old clients get a clear answer and nothing is bought or stored; this is the right pattern for retiring a route (webapp:server/utils/retiredCapturerRoutes.ts:13-60)
- [inventory-webapp] Frozen legal versions are pinned by hash Why: The record of what earlier users accepted cannot drift; the unrouted Privacy*/Terms* pages are intentional (webapp:client/src/lib/legalAcceptance.ts:249-260)
- [inventory-webapp] The email outbox was cut to 13 kinds and retired kinds are cancelled at dispatch Why: A stored row of a retired email can never go out (webapp:server/utils/captureOutbox.ts:58-90,126,437)
- [inventory-webapp] Introduction email bodies are cleared after sending Why: The outbox keeps the record without keeping both sides' contact details (webapp:server/utils/captureOutbox.ts:144-147)
- [journey-A] Home page: one title, one sub-line, one button and 'Free for sites.' above the fold at 390 and 1280 Why: A site knows what it gets and what it costs in under 10 seconds (client/src/pages/Home.tsx:15-21; screenshots/A-01-home-390.png)
- [journey-A] Phone path: 'Next: film the job' lands straight on the in-page camera; no microphone, parts upload while filming, resume after a drop Why: Fewest taps on the main path and robust on a bad connection (client/src/components/site/SiteCaptureStart.tsx:672-679; client/src/components/site/CaptureRecorder.tsx:49-61)
- [journey-A] No sign-in from start to introduction; the private link is the credential Why: Removes the biggest drop-off for a phone user (client/src/components/site/SiteCaptureStart.tsx:475-479)
- [journey-A] Responses section: aliases, the company's reason in its words, one Introduce us with its sentence Why: It is the site's answer and reads well at 390 px (screenshots/A-15-job-responses-390.png)
- [journey-A] Introduction is one transaction with the billable event and both emails, site email held until the company's is sent Why: All-or-nothing money and privacy record with no person in the loop (server/utils/jobIntroductions.ts:103-170)
- [journey-A] WebApp withdrawal closes every company's view in the same transaction and plans the deletion notices there Why: Privacy promise kept and verified end to end (server/utils/websiteCaptureWithdrawal.ts:83-117; e2e/site-answer-journey.spec.ts:401-418)
- [journey-B] 'What this job packet does not show' list on the job page Why: Says plainly there was no site test, no safety review, no route measured; saves a question email. (webapp:server/utils/companyJobPage.ts:96)
- [journey-B] Site identity never reaches a company Why: Sentence and done rule are redacted; the payload builder never reads name, address or contacts. (webapp:server/utils/companyJobPage.ts:170)
- [journey-B] Deterministic, scanned simulation zip Why: Same inputs give the same digest; every file scanned; all references resolve inside the zip (pxr: 0 unresolved). (pipeline:tests/test_website_company_simulation.py:315)
- [journey-B] Outcome questions with a confirm press Why: Email scanners cannot record answers; questions stop after a final answer. (webapp:server/utils/jobOutcomes.ts:55)
- [journey-B] Job-email opt-out checked at dispatch Why: Turning job emails off works and is tested (3 targeted tests passed). (webapp:server/utils/newJobAlerts.ts:45)
- [journey-B] Invited accounts start verified Why: No verify-your-email detour on the normal path. (webapp:server/utils/accountInvitations.ts:56)
- [journey-C] One retry policy with timed retries and the job window as the deadline Why: Jobs heal and end by themselves; the real job ended at its window without anyone acting (pipeline:src/blueprint_pipeline/job_retry_policy.py; pipeline:docs/architecture/job-retry-and-deadlines.md:13-27)
- [journey-C] Retained receipts for paid calls Why: Across 26 release supersessions the real job bought nothing twice (door cancelled-unstarted-controls/*.json provider_mutation_performed false)
- [journey-C] Room reconstruction Why: Ready in 5.9 h for $6.02 on the real job, one SAM retry handled by itself (door .../atlas/preview_job.json)
- [journey-C] Sound-free clip builder Why: Video only, metadata and side data stripped, every frame checked (pipeline:src/blueprint_pipeline/website_company_clip.py:17-22)
- [journey-C] Deploy receipts with timings and paused triggers Why: They make deploy cost measurable (door deploy-receipts/iteration_cbff06b4409c_door.json stage_timings_seconds)
- [journey-C] Company package builder: outbound scan and deterministic zip Why: Safe to point at a new source; 495 fixture tests pass (pipeline:src/blueprint_pipeline/website_company_simulation.py:31-37)
- [journey-D] Admin job page shows only true lines: where it stands, what was built, cost, stops, what happened Why: Each part renders only when a record backs it; it worked at 390 px with no horizontal scroll (webapp:client/src/pages/AdminJobConsole.tsx:1-8, screenshots/D-02-job-detail-390.png)
- [journey-D] Old operator addresses (/admin/leads, /ops) land on the job console Why: Alert links from older bells still open the right job (webapp:client/src/app/routes.tsx:90-93, screenshots/D-07-admin-leads-redirect-1280.png)
- [journey-D] Account spend report with forecast and per-provider reconciliation Why: It already holds the numbers the owner needs (counted, forecast date, unattributed); it only needs showing (door-status.json spend_guard.account_monthly_spend)
- [journey-D] Stall alarm skips intended holds and scheduled waits Why: No stalled job paged on 2026-11-22; 52 scene intents examined, 0 stalled (door-status.json capacity.stall.checks)
- [journey-D] Billable event written in the same transaction as the introduction and voided, never deleted, if the introduction fails Why: The money record cannot drift from the introduction (webapp:server/utils/jobIntroductions.ts:118-151, server/utils/jobIntroductionGate.ts:1-20)
- [journey-E] Public pages are fast and clean Why: 48 timed live loads: time to first byte 61-173 ms, heading visible 0.10-0.20 s (company sign-in page 0.9-1.4 s), zero console errors, zero failed requests, no sideways scroll at 390 px. Nothing to fix for the demo. (scratchpad/agents/journey-E/live-timings.json; raw/journey-E.md section 1)
- [journey-E] The sample job is honest and plays Why: Labelled 'Sample job' and 'Stock footage, not a live job', credited, licence on file, names the simulation and first look instead of faking them; the video reached readyState 4 and played 2.5 s within 2.6 s at both widths. (webapp:client/src/components/site/SampleJob.tsx:11-14; webapp:client/public/licenses/sample-job/README.txt)
- [journey-E] The real loop is tested end to end Why: The core-journey test runs the real handlers on emulators from start to introduction, follow-ups and withdrawal in 25 s; it is the best source for a recorded demo. (scratchpad/baseline/core-journey.log; webapp:e2e/site-answer-journey.spec.ts:1-22)
- [journey-E] The site's job page leads with responses and Introduce us Why: Companies first, each answer by alias with the company's words and what would make an introduction possible; the button and its one sentence sit on the first screen at 1280 and 390. (screenshots/E-10-site-responses-1280.png; webapp:client/src/components/site/SiteAnswer.tsx:254-290)
- [journey-E] Public copy is consistent and states no price Why: Home, How it works, Find jobs, Questions and the company page say the same three answers, 'Free for sites' and 'Nothing is charged today', from one file. (webapp:client/src/lib/publicCopy.ts)
- [journey-E] Internal test jobs cannot leak to companies Why: One marker, written once, refused first by the company predicate; it is why the demo cannot accidentally show test footage to a company. (webapp:server/utils/internalTestJob.ts:1-19)
- [journey-E] The viewer fails with words, not a black screen Why: boot.js turns a refused or broken scene into one plain sentence and a way back. (webapp:client/public/splat-viewer/boot.js:5-22; screenshots/E-14-sim-viewer-noscene-1280.png)

## Questions that only spending money would answer

- [dim-fragile] Does a real phone upload of a 500 MB to 1.2 GB file through Render reach the server and extractFrames? Estimated cost: under 1. Basis: GCP Storage and one Cloud Function run on a staging bucket; no paid model call
- [dim-fragile] What exactly do World Labs and Gemini return when the key is revoked or the account is out of credit (401, 402 or 403)? Estimated cost: 0 to 5. Basis: A revoked test key returns an error without work; checking the out-of-credit answer may need a near-empty account
- [dim-gates] Is a room-as-filmed useful to a company for jobs under the early task hold or a recapture code? Estimated cost: about 1.30 per job. Basis: World Labs November: 9 attempts, $11.85 (door capacity.provider_spend.world_labs); recapture-coded rooms are already paid for, so they cost $0
- [dim-missing] Does a real site job, end to end, produce a downloadable simulation package once the package source is rebuilt from the room package? Estimated cost: about 10 to 40 per job (World Labs reconstruction plus Gemini and SAM calls, under the $40 job cap). Basis: pipeline-timing.md: real job spent $8.46 before stopping; job cap $40
- [inventory-pipeline] Does a fresh website job run end to end today and produce a company simulation package? Estimated cost: up to 40 (the per-job cap); 15-30 typical. Basis: config/website_job_spend_cap.v1.json per_job_cap_usd 40; November metered per-job totals 8.4-26.6 in door spend_guard.jobs
- [journey-A] End-to-end wall-clock time from a real phone upload to first look, shared job and simulation for one synthetic job Estimated cost: up to 40. Basis: the per-job preparation cap cited in server/utils/siteActionNeeded.ts:6 ($40 cap); journey C measures from recorded runs first
- [journey-C] Does an Anthropic-modelled object cost less or look better than OpenAI ARTISAN for a website job? Estimated cost: about 12 to 25 per object per provider (ARTISAN cap 12 on OpenAI; capture-447 used 17.02). Basis: AGENTS.md Spend limits; cost model section 2
- [journey-C] Is a scanned-shape object in the room package good enough for a company to judge a job? Estimated cost: 0 extra if built from an existing room package; one new reconstruction is about 6 to 9. Basis: real job World Labs 6.02; cost model Atlas 5.50 completed operations
- [journey-C] What does one GPU scene-configuration attempt really cost today when it rents a machine? Estimated cost: 0.16 to 0.60 Vast billed plus up to 12 ARTISAN. Basis: cost model section 3, n=5 GPU attempts (October)
- [journey-D] Does a job's real cost per provider (including host share) stay under 40 USD end to end? Estimated cost: 0 (answerable from existing ledgers once D-04 is built); a fresh measured run would be about 20-40. Basis: pipeline AGENTS.md per-job cap 40 USD; capture-447 spent 26.63 on screening alone
- [journey-E] What does one fresh real packet with a simulation cost to produce for the demo job (E-01)? Estimated cost: unknown; not attributable per job today. Basis: raw/journey-D.findings.json D-04 (spend not per job); door-status.json capacity.provider_spend.lines shows world_labs_24h_usd 60 and openai_24h_usd 75, whether limits or spend is unverified
- [journey-E] How long does a real job take from upload to a ready simulation? Estimated cost: one job's provider spend (unknown, as above). Basis: firestore-funnel created_to_company_simulation_hours n=0: never measured; only a real run answers it
