# Ledger actions: what happens to every verdict

2026-11-22. The owner said: go with the verdict in the ledger. The ledger gave 254 delete, merge and simplify
verdicts (160, 25 and 69). This file says what happens to each one. Ledger ids are a letter for the
report (A site, B company, C Pipeline, D owner, E demo, G gates, M promises, F fragile, O observability,
V vestigial), then L and the row number in that report's ledger (`requirements-ledger.md`).

Rules kept while doing it: nothing that protects privacy, rights or money is removed; where the second
check overturned a verdict, the thing stays and the reason is given; legal pages and recorded statements
are the owner's to write; nothing is written to production.

| Status | Rows |
|---|---|
| In a pull request now | 29 |
| Done | 3 |
| Partly done | 1 |
| Ledger lane, started | 54 |
| Ledger lane, queued | 123 |
| Owner writes it | 4 |
| Owner step on the host | 5 |
| Owner step | 2 |
| Kept: checking overturned the verdict | 13 |
| Waits for a decision or an earlier step | 12 |
| Demo practice, no code | 8 |
| **All** | **254** |

## In a pull request now (29)

| Row | Verdict | Thing | Where it goes |
|---|---|---|---|
| AL18 | DELETE | Development authoring consent fields accepted by the server | listing and site wording lane |
| AL24 | SIMPLIFY | File upload: a single request, 2 GiB server limit | intake lane |
| AL27 | DELETE | "To try again, start a new job" on endings | listing and site wording lane |
| AL41 | SIMPLIFY | Reply-To on introduction emails | hand-off lane |
| AL47 | DELETE | Non-US job page offers recording statement v4 | listing and site wording lane |
| CL04 | SIMPLIFY | Normalisation of the video before anything else | Pipeline: sound-free video first |
| CL15 | DELETE | Scene intent intake (signed intent per job) | Pipeline: $0 settlement and room as simulation (taken off the path to a company; the code itself leaves with the retired lanes) |
| CL16 | DELETE | $0 scene preparation bound to the release commit | Pipeline: $0 settlement and room as simulation (taken off the path to a company; the code itself leaves with the retired lanes) |
| CL17 | DELETE | Simulation build on Vast + ARTISAN (OpenAI) | Pipeline: $0 settlement and room as simulation (taken off the path to a company; the code itself leaves with the retired lanes) |
| CL22 | DELETE | Team scene half (robot-team packet) | Pipeline: $0 settlement and room as simulation (taken off the path to a company; the code itself leaves with the retired lanes) |
| DL01 | SIMPLIFY | Admin job list | owner totals lane |
| DL03 | SIMPLIFY | 25-row pages and "Show older jobs" | owner totals lane |
| GL18 | DELETE | Blueprint's 7-day window as a listing stop | listing and site wording lane |
| GL34 | SIMPLIFY | Paid-preparation grant before the company clip | Pipeline: sound-free video first |
| ML21 | DELETE | Non-US site saves a job and agrees to sharing | listing and site wording lane |
| ML27 | SIMPLIFY | Outcome questions gated on the job being listed | hand-off lane |
| FL04 | DELETE | Outcome questions: listing condition | hand-off lane |
| FL07 | DELETE | "Introduction never made again after a cancel" | hand-off lane |
| FL10 | MERGE | Single-request picked-file upload | intake lane |
| OL05 | SIMPLIFY | Event time = press (`atIso`) | hand-off lane |
| OL09 | MERGE | Per-job event list in admin | owner totals lane |
| OL10 | SIMPLIFY | Admin job list, 25 per page, no total | owner totals lane |
| VL18 | DELETE | RunPod and Lambda console scripts | Pipeline dead-code lane |
| VL23 | DELETE | 54 test-only / unimported modules (minus 4) | Pipeline dead-code lane |
| VL30 | DELETE | Experiments framework and route | WebApp dead-code lane |
| VL50 | DELETE | 6 unreferenced WebApp files | WebApp dead-code lane |
| VL51 | DELETE | World Labs client chain and robot-match chain | WebApp dead-code lane |
| VL52 | DELETE | evaluationPricing.ts | WebApp dead-code lane |
| VL53 | DELETE | framer-motion, node-fetch, react-avatar, react-dropdown-menu | WebApp dead-code lane |

## Done (3)

| Row | Verdict | Thing | Where it goes |
|---|---|---|---|
| EL20 | DELETE | Demo build (PR 1369) | pull request 1369 closed unmerged |
| EL21 | DELETE | Invented counts and quotes | pull request 1369 closed unmerged |
| OL40 | DELETE | 206 stale failed units | 206 stale failed units cleared through the operator door on 2026-11-22 |

## Partly done (1)

| Row | Verdict | Thing | Where it goes |
|---|---|---|---|
| VL25 | DELETE | Host failed transient units and hold-expiry units | the 206 failed units are cleared; the 22 hold-expiry units and the expired hold are not |

## Ledger lane, started (54)

| Row | Verdict | Thing | Where it goes |
|---|---|---|---|
| BL02 | SIMPLIFY | Order: application above the sample job | company way in: Find jobs, application, sign-up, job page |
| BL07 | DELETE | Application field: "What jobs can you deliver?" | company way in: Find jobs, application, sign-up, job page |
| BL08 | DELETE | Application field: "Which robots do you deploy?" | company way in: Find jobs, application, sign-up, job page |
| BL09 | DELETE | Application field: "Where can you deploy?" | company way in: Find jobs, application, sign-up, job page |
| BL10 | SIMPLIFY | Application field: website (hidden, optional) | company way in: Find jobs, application, sign-up, job page |
| BL11 | MERGE | Optional "Blueprint updates" box, asked on application and again at sign-up | company way in: Find jobs, application, sign-up, job page |
| BL12 | DELETE | "By applying, you agree to our Terms" | approving a company, and staff tools and bells |
| BL13 | DELETE | Terms version check on the application | approving a company, and staff tools and bells |
| BL14 | SIMPLIFY | Fit checklist on the review page and in Slack | approving a company, and staff tools and bells |
| BL17 | SIMPLIFY | Confirm text "capabilities, task fit, and prerequisites" | approving a company, and staff tools and bells |
| BL18 | MERGE | `prerequisitesReviewed` flag on the decision | approving a company, and staff tools and bells |
| BL19 | DELETE | "In review" and "declined" status screens | company way in: Find jobs, application, sign-up, job page |
| BL20 | DELETE | `BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS` switch and `gated` field | company way in: Find jobs, application, sign-up, job page |
| BL22 | DELETE | Approval email: "book a call" line | company way in: Find jobs, application, sign-up, job page |
| BL24 | DELETE | Password at sign-up | company way in: Find jobs, application, sign-up, job page |
| BL25 | DELETE | "Review account details" (name, company again) | company way in: Find jobs, application, sign-up, job page |
| BL27 | MERGE | Separate Terms prompt in the library and job page | company way in: Find jobs, application, sign-up, job page |
| BL29 | SIMPLIFY | Library cards: category title and country only | company way in: Find jobs, application, sign-up, job page |
| BL30 | SIMPLIFY | Library filters: job type, region, Ready to test, search | company way in: Find jobs, application, sign-up, job page |
| BL37 | DELETE | Client branch for video state "none" | company way in: Find jobs, application, sign-up, job page |
| BL38 | MERGE | Two answer forms ("Respond", "Report simulation result") | company way in: Find jobs, application, sign-up, job page |
| BL39 | SIMPLIFY | "Add details": what you checked, question, earliest start | company way in: Find jobs, application, sign-up, job page |
| BL43 | SIMPLIFY | Saved message after an answer | company way in: Find jobs, application, sign-up, job page |
| BL49 | SIMPLIFY | New-job email body with no job type or place | company way in: Find jobs, application, sign-up, job page |
| BL52 | DELETE | Stored targeting fields (interests, categories, requirements) | company way in: Find jobs, application, sign-up, job page |
| BL53 | DELETE | Legacy application fields kept (supportedSystems, pilotPackage, testSite) | approving a company, and staff tools and bells |
| CL18 | DELETE | Full $18 hold for a launch that rented nothing | the first fix was wrong (five of the seven launches did rent a machine); a corrected money fix is in progress (C-03) |
| DL08 | DELETE | Record a send made by hand | approving a company, and staff tools and bells |
| DL09 | DELETE | Void a send | approving a company, and staff tools and bells |
| DL10 | DELETE | Record an answer a company emailed | approving a company, and staff tools and bells |
| DL12 | DELETE | Site measurements tool | approving a company, and staff tools and bells |
| DL13 | DELETE | Evidence questions tool | approving a company, and staff tools and bells |
| DL14 | MERGE | Robot fit console on staff pages | approving a company, and staff tools and bells |
| DL16 | MERGE | Approvals page | approving a company, and staff tools and bells |
| DL17 | DELETE | Approve confirm box | approving a company, and staff tools and bells |
| DL18 | DELETE | Approve note prompt | approving a company, and staff tools and bells |
| DL21 | DELETE | Review an existing job (recommendation) | approving a company, and staff tools and bells |
| DL22 | DELETE | Early-access Render hint | approving a company, and staff tools and bells |
| DL23 | DELETE | Fit checklist on an application | approving a company, and staff tools and bells |
| DL24 | MERGE | Slack bell for an application | approving a company, and staff tools and bells |
| DL25 | DELETE | Slack bell: screening call | approving a company, and staff tools and bells |
| DL26 | DELETE | Slack bell: footage review by hand | approving a company, and staff tools and bells |
| DL43 | DELETE | `/admin/company-metrics` redirect to `/` | approving a company, and staff tools and bells |
| EL09 | SIMPLIFY | `/jobs#sample-job` deep link | company way in: Find jobs, application, sign-up, job page |
| EL12 | DELETE | Viewer opening in a new tab | company way in: Find jobs, application, sign-up, job page |
| ML12 | SIMPLIFY | Library read capped at 200, unordered | company way in: Find jobs, application, sign-up, job page |
| OL25 | MERGE | Intake ops notice | approving a company, and staff tools and bells |
| OL28 | MERGE | Beta monitor: preparation quiet | approving a company, and staff tools and bells |
| OL29 | DELETE | Beta monitor: no-grant wait, over-budget extension | approving a company, and staff tools and bells |
| OL30 | DELETE | Slack screening call needed | approving a company, and staff tools and bells |
| OL31 | DELETE | Slack footage needs review | approving a company, and staff tools and bells |
| OL32 | SIMPLIFY | Slack company application | approving a company, and staff tools and bells |
| OL41 | SIMPLIFY | Admin `/admin/leads/:id` links in alerts | approving a company, and staff tools and bells |
| VL42 | DELETE | Job-evidence panel link to /app/captures | approving a company, and staff tools and bells |

## Ledger lane, queued (123)

| Row | Verdict | Thing | Where it goes |
|---|---|---|---|
| AL02 | SIMPLIFY | Moving example card with 6 category buttons | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| AL03 | SIMPLIFY | Header "Sign in" on public pages | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| AL04 | MERGE | How it works page | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| AL13 | DELETE | "Add details": How often does it happen? | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| AL14 | DELETE | "Add details": Where are you in the process? (Planning a pilot / Ready to run a pilot) | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| AL20 | SIMPLIFY | "Start a new job" only after acknowledgement | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| AL28 | SIMPLIFY | Status headlines (39 strings, 13 decisions) | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| AL29 | DELETE | Outlook phases "testing" and "result" (an AI robot scored) | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| AL30 | DELETE | "Check your job description and confirm it" state | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| AL31 | DELETE | "Blueprint will update this job as the work progresses." | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| AL32 | SIMPLIFY | Quick questions on the job page (up to 5 of 15) | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| AL38 | MERGE | Email: "Your job is posted" (`job_sent`) | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| AL43 | SIMPLIFY | Withdrawal path (4 taps behind Job settings) | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| BL56 | DELETE | Package: `timing` (physics 120 Hz, control 15 Hz) | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| CL03 | SIMPLIFY | Face blur of frames sent to World Labs, by Privacy version | Pipeline: alarms that mean something, and one rule for face blur |
| CL07 | DELETE | Recapture-coded hold (`website_registration_*`) | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| CL08 | DELETE | Operator `selected-handoff` / held hand-off replay | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| CL10 | DELETE | Pipeline's own "Blueprint-owned capture" sharing basis | Pipeline: retired lanes, their timers, limits and documents |
| CL12 | SIMPLIFY | Release-admission check before each paid Atlas call | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| CL24 | DELETE | Rigid robot-free probe lane, timer every 5 min | Pipeline: retired lanes, their timers, limits and documents |
| CL25 | SIMPLIFY | Company clip and simulation pass every 60 s, forever | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| CL26 | SIMPLIFY | Progression tick every 1 min writing an event each time | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| CL30 | SIMPLIFY | Disk-budget gates (`control_plane_disk_budget_exceeded`, preallocation capacity) | Pipeline: alarms that mean something, and one rule for face blur |
| CL31 | DELETE | Anthropic provider choice for object modelling | Pipeline: retired lanes, their timers, limits and documents |
| CL34 | DELETE | Runbook step 13 "robot team picks its saved setup" and "raise the preparation cap" | Pipeline: retired lanes, their timers, limits and documents |
| DL27 | DELETE | `/app/captures` page and `/api/capture-uploads` | worker, tests and retired WebApp lanes |
| DL33 | DELETE | `beta_screening` section of door status | Pipeline: alarms that mean something, and one rule for face blur |
| DL34 | SIMPLIFY | `failed_units` list with old experiments | Pipeline: alarms that mean something, and one rule for face blur |
| DL35 | SIMPLIFY | Expired holds and unheld locks in the default view | Pipeline: alarms that mean something, and one rule for face blur |
| DL36 | SIMPLIFY | Disk usage warnings posted to the alert route | Pipeline: alarms that mean something, and one rule for face blur |
| DL38 | DELETE | Success-threshold confirmation | Pipeline: retired lanes, their timers, limits and documents |
| DL40 | DELETE | Scene execution window extension | Pipeline: retired lanes, their timers, limits and documents |
| EL03 | SIMPLIFY | Tested answers on the example card | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| EL19 | SIMPLIFY | "Introduction requested." line | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| EL23 | DELETE | Retired sample files and proof reel | worker, tests and retired WebApp lanes |
| EL24 | DELETE | Live rehearsal script | worker, tests and retired WebApp lanes |
| GL02 | MERGE | 15-minute intake limiter | gates in the WebApp (after the listing pull request) |
| GL04 | DELETE | Daily intake cap per IP (20) and per email (5) | gates in the WebApp (after the listing pull request) |
| GL06 | MERGE | Upload cap per job | gates in the WebApp (after the listing pull request) |
| GL11 | MERGE | Shared listing record | gates in the WebApp (after the listing pull request) |
| GL14 | DELETE | Brief confirmation step | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| GL15 | DELETE | `website_task_context_not_confirmed` as a revoking code | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| GL16 | DELETE | `/follow-up` success_target re-confirmation | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| GL21 | DELETE | Window extension with owner approval | Pipeline: retired lanes, their timers, limits and documents |
| GL22 | DELETE | Expired grant renewal by the owner | Pipeline: retired lanes, their timers, limits and documents |
| GL23 | DELETE | `website_scene_site_unclaimed` | gates in the WebApp (after the listing pull request) |
| GL26 | SIMPLIFY | Rights hold `needs_review` | gates in the WebApp (after the listing pull request) |
| GL27 | DELETE | Card "Ready" from runnable proof | gates in the WebApp (after the listing pull request) |
| GL31 | SIMPLIFY | Re-acceptance on every new version by default | gates in the WebApp (after the listing pull request) |
| GL32 | SIMPLIFY | Introduction dispatch re-check of Terms and listing | gates in the WebApp (after the listing pull request) |
| GL39 | DELETE | Recapture stops (8 codes) | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| GL40 | SIMPLIFY | Hold until 2 h before window end | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| GL41 | SIMPLIFY | KEEP_HOLDING integrity suffixes | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| GL43 | DELETE | Trial policy capability gate | Pipeline: retired lanes, their timers, limits and documents |
| GL44 | SIMPLIFY | Stall alarm "rights" mapping by word | Pipeline: alarms that mean something, and one rule for face blur |
| GL45 | SIMPLIFY | Revocation receipt without a reason | Pipeline: alarms that mean something, and one rule for face blur |
| GL49 | DELETE | Screening $30 / $4 | Pipeline: retired lanes, their timers, limits and documents |
| GL50 | DELETE | Astra $5–25 | Pipeline: retired lanes, their timers, limits and documents |
| GL51 | DELETE | Rigid probe $1 | Pipeline: retired lanes, their timers, limits and documents |
| GL55 | DELETE | OpenAI $560 and World Labs $450 month pages | Pipeline: retired lanes, their timers, limits and documents |
| GL59 | DELETE | Chain preflight | Pipeline: retired lanes, their timers, limits and documents |
| GL60 | DELETE | Owner success contract | Pipeline: retired lanes, their timers, limits and documents |
| ML02 | DELETE | `isRunnableTask` and `scene_not_runnable` in the listing answer | gates in the WebApp (after the listing pull request) |
| ML03 | DELETE | Legacy dossier restriction (`kept_private`, `restricted_to_named_teams`) | gates in the WebApp (after the listing pull request) |
| ML05 | DELETE | No email to companies approved later | gates in the WebApp (after the listing pull request) |
| ML06 | SIMPLIFY | Withdrawal notice only to companies with a send row | gates in the WebApp (after the listing pull request) |
| ML11 | SIMPLIFY | Hand-kept Privacy versions for no-blur | Pipeline: alarms that mean something, and one rule for face blur |
| ML13 | DELETE | Marketing cookie category and ad grants | analytics, cookies and stored copies |
| ML14 | DELETE | Cookie banner while no analytics is configured | analytics, cookies and stored copies |
| ML23 | SIMPLIFY | Sample job line "to download and open in your own tools" | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| ML24 | DELETE | `out_of_scope` site sentence "We can't simulate this kind of job yet." | site: start form, job page, emails (after the wave 1 pull requests that touch the same files) |
| ML25 | SIMPLIFY | Package source limited to rigid or articulated team scene | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| FL08 | SIMPLIFY | One worker heartbeat | worker, tests and retired WebApp lanes |
| FL09 | DELETE | `BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER` | worker, tests and retired WebApp lanes |
| FL13 | DELETE | Stall alarm "not_configured is quiet" | Pipeline: alarms that mean something, and one rule for face blur |
| FL14 | SIMPLIFY | 4xx = "cannot succeed" for 401/402/403 | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| FL15 | DELETE | Atlas per-job operator reopen | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| FL16 | DELETE | Scene execution window extension | Pipeline: retired lanes, their timers, limits and documents |
| FL17 | SIMPLIFY | Preparation "six retries, then left as it is" | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| FL18 | SIMPLIFY | Company package pass with no deadline | Pipeline: ship flagged instead of holding; parked jobs retry by themselves |
| FL20 | DELETE | Hand-copied Privacy version lists (two) | Pipeline: alarms that mean something, and one rule for face blur |
| FL21 | SIMPLIFY | Deploy rebuilds every in-flight attempt | Pipeline: alarms that mean something, and one rule for face blur |
| FL24 | MERGE | Three intake browser suites outside CI | worker, tests and retired WebApp lanes |
| FL25 | DELETE | cookie-consent spec in the default config | analytics, cookies and stored copies |
| FL26 | SIMPLIFY | Core journey "queued" email assertions | worker, tests and retired WebApp lanes |
| OL13 | DELETE | `growth_events` collection and writers | analytics, cookies and stored copies |
| OL14 | DELETE | `/api/analytics/ingest` | analytics, cookies and stored copies |
| OL15 | DELETE | 56 client event definitions (2 used) | analytics, cookies and stored copies |
| OL16 | DELETE | GA, PostHog, Sentry loaders | analytics, cookies and stored copies |
| OL19 | SIMPLIFY | Unsubscribe link with email in query | analytics, cookies and stored copies |
| OL21 | DELETE | Resend webhook: full payload store | analytics, cookies and stored copies |
| OL22 | DELETE | Outbox bodies kept after send | analytics, cookies and stored copies |
| OL23 | SIMPLIFY | `agentRuns` unredacted input/output | analytics, cookies and stored copies |
| OL24 | DELETE | `opsActionLogs` | analytics, cookies and stored copies |
| OL34 | SIMPLIFY | Unit failure notifier | Pipeline: alarms that mean something, and one rule for face blur |
| OL35 | DELETE | Capacity warnings `usage_*` as alerts | Pipeline: alarms that mean something, and one rule for face blur |
| OL39 | DELETE | Preflight 108 blockers | Pipeline: retired lanes, their timers, limits and documents |
| VL01 | DELETE | Remote episode-compilation timer, path, service | Pipeline: retired lanes, their timers, limits and documents |
| VL02 | DELETE | Host episode-compilation units (disarmed each release) | Pipeline: retired lanes, their timers, limits and documents |
| VL03 | DELETE | Rigid robot-free probe units | Pipeline: retired lanes, their timers, limits and documents |
| VL05 | DELETE | Team-scene Cloud Run collector units | Pipeline: retired lanes, their timers, limits and documents |
| VL06 | DELETE | Terminal resource release units | Pipeline: retired lanes, their timers, limits and documents |
| VL07 | DELETE | Chain preflight timer | Pipeline: retired lanes, their timers, limits and documents |
| VL13 | DELETE | Scene policy capability gate | Pipeline: retired lanes, their timers, limits and documents |
| VL14 | DELETE | Paired policy campaign manifest on activation | Pipeline: retired lanes, their timers, limits and documents |
| VL17 | DELETE | config/trial, config/policy_runtimes, config/beta_policy_candidates.v1.json | Pipeline: retired lanes, their timers, limits and documents |
| VL19 | DELETE | G1 console scripts (6) | Pipeline: retired lanes, their timers, limits and documents |
| VL20 | DELETE | policy_model_cpu extra in PR CI | Pipeline: retired lanes, their timers, limits and documents |
| VL21 | DELETE | groot-libero-cpu extra in nightly and wide lanes | Pipeline: retired lanes, their timers, limits and documents |
| VL22 | DELETE | json-numpy base dependency | Pipeline: retired lanes, their timers, limits and documents |
| VL28 | DELETE | /health/ready beta cohort check | worker, tests and retired WebApp lanes |
| VL29 | DELETE | beta-cohort-policy.ts and 7 env names | worker, tests and retired WebApp lanes |
| VL31 | DELETE | Growth-campaign writes in the email webhook | analytics, cookies and stored copies |
| VL33 | DELETE | ops-action-logs writer | analytics, cookies and stored copies |
| VL34 | DELETE | codex_local, acp_harness, openclaw providers | worker, tests and retired WebApp lanes |
| VL35 | DELETE | Launch-forward worker lane | worker, tests and retired WebApp lanes |
| VL36 | DELETE | Job-evidence worker lane | worker, tests and retired WebApp lanes |
| VL39 | DELETE | Launch submission and preparation routes | worker, tests and retired WebApp lanes |
| VL43 | DELETE | /app/captures page | worker, tests and retired WebApp lanes |
| VL44 | DELETE | capture-uploads routes A31-A48 and owned-capture-atlas A167-A169 | worker, tests and retired WebApp lanes |
| VL55 | DELETE | Three unrun intake Playwright configs | worker, tests and retired WebApp lanes |
| VL56 | DELETE | result-consumer Playwright config | worker, tests and retired WebApp lanes |
| VL57 | DELETE | AGENTS.md lines naming deleted modules | Pipeline: retired lanes, their timers, limits and documents |

## Owner writes it (4)

| Row | Verdict | Thing | Where it goes |
|---|---|---|---|
| ML15 | DELETE | Notion in the processor list | a legal page; nobody but the owner changes this text |
| ML16 | DELETE | GA, PostHog, Sentry in the processor list | a legal page; nobody but the owner changes this text |
| ML18 | DELETE | "Proposed 7 years" sentence for new recordings | a legal page; nobody but the owner changes this text |
| VL54 | MERGE | Ten unrouted legal pages in app source | a legal page; nobody but the owner changes this text |

## Owner step on the host (5)

| Row | Verdict | Thing | Where it goes |
|---|---|---|---|
| AL46 | SIMPLIFY | Pipeline deletion gated on an owner standing approval | the withdrawal deletion approval file; the operator door cannot write it |
| GL61 | SIMPLIFY | Withdrawal deletion approval | the withdrawal deletion approval file; the operator door cannot write it |
| ML29 | MERGE | Withdrawal deletion approval file | the withdrawal deletion approval file; the operator door cannot write it |
| FL19 | DELETE | RunPod required while its key exists | the RunPod key file; the operator door cannot delete it |
| VL09 | SIMPLIFY | RunPod inventory read in the guard | the RunPod key file; the operator door cannot delete it |

## Owner step (2)

| Row | Verdict | Thing | Where it goes |
|---|---|---|---|
| VL26 | DELETE | Retired-lane disk roots | deletes stored data in production; needs the owner's word and a production write |
| VL58 | DELETE | Retired Firestore collections | deletes stored data in production; needs the owner's word and a production write |

## Kept: checking overturned the verdict (13)

| Row | Verdict | Thing | Where it goes |
|---|---|---|---|
| AL12 | DELETE | "Add details": What counts as success? | the job and the company page read this field |
| CL14 | DELETE | Robot-fit table and precheck in the hand-off | the robot-fit table is the first look on paper |
| DL11 | DELETE | Stop showing this job to companies | the only staff stop for a privacy or rights problem; it will require a reason |
| GL20 | SIMPLIFY | `consent_expired` code name for a time limit | a rename with no effect for a user |
| GL24 | DELETE | Operator listing hold | the only staff stop for a privacy or rights problem; it will require a reason |
| GL48 | DELETE | GPU fleet dollar caps | these limits do real work protecting money |
| GL52 | MERGE | ARTISAN $12, GPU attempt $6 / $0.80/h, Atlas review $5 | these limits do real work protecting money |
| GL54 | MERGE | GCP $100 guard | these limits do real work protecting money |
| GL56 | SIMPLIFY | Vast credit page and launch check | these limits do real work protecting money |
| FL23 | DELETE | Nightly full test lane schedule | the only full test run, and green again on 2026-11-22 |
| VL41 | DELETE | Owner success proposal route (A82) | this router carries today's job |
| VL48 | SIMPLIFY | beta-policy-screening-holds route (name) | a rename with no effect for a user |
| VL49 | SIMPLIFY | betaPolicyScreeningContract.ts (name) | a rename with no effect for a user |

## Waits for a decision or an earlier step (12)

| Row | Verdict | Thing | Where it goes |
|---|---|---|---|
| AL09 | SIMPLIFY | "Where is the job?" free text with autocomplete | what a company may see of the site's place (owner question 11) |
| AL10 | MERGE | Country select (shown when typed text has no suggestion) | what a company may see of the site's place (owner question 11) |
| BL35 | SIMPLIFY | Job page: country only | what a company may see of the site's place (owner question 11) |
| CL05 | SIMPLIFY | Clean plate (Gemini object removal analysis) | its value to a company is not measured; needs one paid job to tell |
| CL19 | MERGE | Three dollar figures per grant ($25 + $5 + $20) beside the one $40 cap | the grants' dollar figures are sealed in digests in both repositories; a money change (owner question 19) |
| DL28 | DELETE | Deploy window 15:00 UTC | after a deploy no longer retires work in flight (plan 2.7) |
| DL30 | DELETE | Record each deploy in the tracker | after a deploy no longer retires work in flight (plan 2.7) |
| GL53 | DELETE | Grant dollar figures and attempt counts | the grants' dollar figures are sealed in digests in both repositories; a money change (owner question 19) |
| GL58 | DELETE | Deploy window 15:00 UTC | after a deploy no longer retires work in flight (plan 2.7) |
| FL27 | DELETE | `extractFrames` in BlueprintCapture | lives in a third repository that is not checked out |
| OL03 | DELETE | Event `priceUsd: null` field | harmless field; no user effect |
| OL11 | SIMPLIFY | "What it has cost so far" (WebApp ledgers only) | a build, not a deletion: one cost per job (plan 3.11) |

## Demo practice, no code (8)

| Row | Verdict | Thing | Where it goes |
|---|---|---|---|
| EL04 | DELETE | How it works page as a demo stop | in demo-script.md |
| EL05 | MERGE | Start form as a full demo step | in demo-script.md |
| EL06 | DELETE | Submitting the start form live | in demo-script.md |
| EL07 | DELETE | Find jobs application form in the demo | in demo-script.md |
| EL10 | MERGE | Separate simulation stop | in demo-script.md |
| EL16 | DELETE | Showing a real site's packet | in demo-script.md |
| EL17 | DELETE | Pressing Introduce us on a real job for show | in demo-script.md |
| EL18 | DELETE | Waiting for the introduction email live | in demo-script.md |
