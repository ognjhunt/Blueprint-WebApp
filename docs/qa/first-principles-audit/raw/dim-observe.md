# Observability and billable events (agent `dim-observe`, finding ids `O-`)

Audit of WebApp `0ee5df6` (live, `/version.json` git_sha `0ee5df63…`, built 2026-11-21T14:27Z) and
Pipeline HEAD `7d8b532` (control plane active release `cbff06b`, door `preflight.active_sha`).
Date 2026-11-22. Read-only. No paid call, no email, no write to production. Production data was read
only as counts, ids, states and timestamps.

## The short version

1. **The billable event exists and is recorded once.** It is written in the same transaction as the
   introduction, under a fixed id, and never rewritten. Tests prove this on a fake Firestore (13 tests
   pass) and on the emulator (the core journey). Production has 0 events, so no real event has tested it.
2. **An invoice cannot stand on it yet.** The event names the company by an internal id only. Blueprint
   holds no legal entity and no billing contact for any company. It does not keep the Terms version the
   company accepted. Its time is the press, not the moment the company got the details. Its outcome
   answers live elsewhere, and nothing lists events across jobs.
3. **Three places built for watching hold a site's personal data.** These are the Resend webhook store
   `growth_campaign_events`, sent `captureOutbox` rows, and the unsubscribe link in request logs. The
   first two hold a site's email, its signed private job link or its name in plain text, with no reader
   and no purge, also after withdrawal. This is a privacy hard stop.
4. **The owner cannot answer simple questions without paging.** How many jobs, how many sends,
   answers and introductions, what a job cost: there is no total anywhere. Job cost is split across two
   ledgers that share a key but are never joined. Only 20% of the month's counted spend
   ($59.75 of $296.58) is attributed to any job.
5. **Real failures drown.** The one real Pipeline failure (the spend guard) has posted to the operator
   webhook about every hour since 2026-11-13, about 227 times. It sits beside 18 standing warnings and 206
   stale failed units.
6. **The public funnel is not measured.** The live build configures no Google Analytics, no PostHog and
   no Sentry. The Privacy Policy names all three. The client tracks page views and one form event, and
   only after consent. The `growth_events` collection (1,247 docs) is written by capture-era code and read
   by nothing.

---

## 1. Billable events

### What the code records

| Step | Where | What is written |
|---|---|---|
| Site presses Introduce us | `server/utils/jobIntroductions.ts:95-173` (one transaction) | `inboundRequests/{job}/introductions/{companyId}`: alias, `requestedAtIso`, `by:"site"`, `statementVersion`, both sides' details sealed (encrypted), `outcomes: []` |
| Same transaction | `jobIntroductions.ts:151`, `billableEvents.ts:36-46` | `billableEvents/introduction-{job}-{companyId}`: `{kind:"introduction", requestId, companyId, atIso, priceUsd:null, status:"recorded_no_price"}`, made with `tx.create` |
| Same transaction | `jobIntroductions.ts:152-168` | Two outbox rows: the company email (pending) and the site email (held) |
| Company email cancelled or failed before it was sent | `jobIntroductionGate.ts:118-137, 168-175, 191-201` | Introduction marked `cancelledAtIso`/`cancelReason`, details removed, event `status:"void"` + `voidedAtIso` + `voidReason` (merge write) |
| 14 / 45 / 90 days | `jobOutcomes.ts:204-231` | `{by, state, atIso, link}` appended to the introduction's `outcomes` array |
| Admin page | `jobCompanies.ts:644-666`, `jobConsoleData.ts:374-378` | One job's events, listed with the company's **current** name |

Exactly once holds. A second press, two presses at once, and a retry all leave one event. The press
first reads `billableEventRef` and refuses a pair already on record (`jobIntroductions.ts:118-122`).
Client access is denied by the default rule (`firestore.rules:173-175`). Command run:

```
FIREBASE_SERVICE_ACCOUNT_JSON= GOOGLE_APPLICATION_CREDENTIALS= npx vitest run server/tests/money-introduction-billable-events.test.ts
 ✓ server/tests/money-introduction-billable-events.test.ts (13 tests) 483ms
```

The emulator journey `e2e/site-answer-journey.spec.ts:346-381` asserts that the press creates one event
with no price. This is the baseline `core-journey.log`: 2 passed. Production: `billableEvents` is absent from
the collection counts (0 documents), and `introductions` is 0 across all jobs.

**Proven only by tests:** exactly once, void on cancellation, no price anywhere. Real Firestore contention
and a real Resend `unknown` outcome have never happened in production.

### What a future invoice needs, against what exists

| Invoice needs | Today | Gap |
|---|---|---|
| Stable id | `introduction-{requestId}-{companyId}` | none |
| Which job | `requestId` | none |
| Which company | `companyId` (the `robotTeamAccess` doc id) | Name, contact and email are live fields on `robotTeamAccess` that anyone can change. The sealed `companyShared` snapshot sits on the introduction, not on the event. |
| Legal entity, billing contact, billing address | nothing (`RobotTeamAccessApplication`, `robotTeamEarlyAccess.ts:37-53`: name, email, company, website, robot, workWanted, region) | **missing everywhere** |
| Terms version the company accepted | `robotTeamAccess.termsAcceptance` is **overwritten** on each new acceptance (`companyTerms.ts:69, 102`). The press requires *current* Terms (`companyMaySeeJobs`), but the event does not copy the version. | After the next Terms change, nobody can show which version the company held at the press |
| When the introduction was made | `atIso` = the press (`requestedAtIso`). The company email's send time sits on the outbox row only. | The event reads "recorded" before the company has the details, and stays so forever if that row never settles (O-07) |
| A record that cannot be silently changed | Created, not set. Later changed only by the void path (merge). Any admin-SDK script could still edit it, and there is no history or digest. | Acceptable for a start. A content digest on create would make tampering visible. |
| Outcome answers at 14/45/90 | Mutable array on the introduction document, not tagged with the question day. Refused once the site withdraws (`jobOutcomes.ts:213`, `jobOutcomeGate.ts:74`). | Hard to tie to the event. Lost after withdrawal (O-08). |
| List or export | `listJobBillableEvents(requestId)`, per job only (`billableEvents.ts:49`) | **No list across jobs, no count, no export** (O-06) |

**The least that is missing before the owner can start charging, whatever pricing he picks** (no price
is proposed here):

1. On the company record, a legal entity name and a billing email, asked once at approval.
2. On the event at creation, a frozen copy of the Terms version, the company's legal name and billing
   email, and the introduction statement version.
3. A `madeAtIso` written when the company's email is marked sent. An invoice counts only events that
   have it.
4. One admin export of events across jobs: id, job, company, made time, status, latest outcome.

Everything else (a price, a balance, Stripe) is the owner's pricing decision and stays out of scope.

---

## 2. What the owner can and cannot observe

| Question | Where the data lives | Screen or command | Steps |
|---|---|---|---|
| How many jobs came in | `inboundRequests` (76 docs) | `/admin/jobs` lists 25 per page, newest first, with **no total** and no filter (`jobConsoleData.ts:34, 112-152`) | 4 pages, counted by hand. Internal tests are mixed in (marked per row). |
| Where each job stands | Outlook phase per job (`readOutlook`) | `/admin/jobs` row "standing" | 1 per page. No count per stage. |
| What each job cost | WebApp: reservations on the job record, `taskEvaluationSceneIntakes`, `taskEvaluationPolicyRuns` (retired screening) (`websiteJobCeiling.ts:186-207`). Pipeline: `spend_guard.account_monthly_spend.jobs`, keyed by the same request id (`capture-<uuid>`, `client/src/lib/siteCaptureDraft.ts:35`; `paid_spend_meter.py:57`). | WebApp: the job detail section "What it has cost so far" (`AdminJobConsole.tsx:257-264`), "spent or held". Pipeline: `door status`, per job, this month only. | Two systems, **never joined** (O-09) |
| Which companies applied, were approved, answered what | `robotTeamAccess` (1 doc), `companyResponses` subcollections | `/admin/robot-team-access`. Answers appear per job only. | One job at a time |
| How long companies take to answer | `companySends.sentAtIso`, `companyResponses.firstAnsweredAtIso` (`jobCompanies.ts:230, 377-386`) | Job detail shows `startedAtIso` and `firstAnswerAtIso` | Per job. No median anywhere. |
| How long approval takes | `robotTeamAccess.appliedAtIso`, `decidedAtIso` | Not shown as a duration (Journey B-09) | Not answered |
| Which introductions happened | `introductions` subcollection, `billableEvents` | Job detail timeline (`jobConsoleData.ts:366-378`) | Per job. No list. |
| Which jobs are stuck or failed, and why | Outlook phase, `ops` stops, Pipeline stall alarm (`capacity.stall`) | `/admin/jobs` "standing". Ops emails. Door status. | 3 places |
| Whether emails were delivered | `captureOutbox.status`: "sent" means Resend accepted it. Delivery events land in `growth_campaign_events`, which nothing reads. | none | Not answered (O-16) |

Measured 2026-11-22 from the saved door status (`spend_guard.account_monthly_spend`):

- Counted for November: $296.58 of the $400 limit. Metered to sources: $59.75. 351 of 354 admissions
  are unpriced. OpenAI is counted at $85.25 but metered at $13.25. World Labs is counted at $52.31 but
  metered at $11.85.
- Per-job rows: 3 site jobs ($26.63 and $7.89, both retired screening on Vast; $8.46 Atlas plus OpenAI),
  2 `itest-*` jobs ($8.41, $2.31), and the first look as overhead (`overhead:webapp.site…` $6.01), which
  is never put on the job.

---

## 3. Alerts and noise

| Alert | Source | Goes to | Noise today |
|---|---|---|---|
| Unit failed (hourly repeat) | `pipeline:src/blueprint_pipeline/unit_failure_notifier.py:1-16`, repeat 3600 s (`control_plane_capacity_controller.py:118`) | `BLUEPRINT_OPERATOR_ALERT_WEBHOOK_URL` (Slack per `deploy/systemd/pipeline-control-plane.env.example:16`). Configured: the records hold `last_alert_epoch` and `alert_error: null`. | Spend guard: `failure_count 4855`, first `2026-11-13T04:39Z`, last alert `1795359170` (2026-11-22T14:52Z). About 227 hours, so about 227 hourly posts of one known cause. Other records: scene progression 345, intake 44 (both 2026-11-15). |
| Capacity, spend and stall report (every ~11 min) | `control_plane_capacity_controller.py:1028-1180` | Same webhook. Posts on a level change or a new actionable code. Repeats hourly only for page or critical. | 18 alerts, all `warn` (journal 14:43-15:27Z): 4 money, 3 storage, 1 orphan scratch, 10 `usage_unclassified_root` |
| Stall alarm | `capacity.stall` | Same webhook, as a page | `stalled: 0` in every check. `state_backup: not_configured`, treated as quiet (O-11). |
| Failed units list | door `status.failed_units` | Door only | 207, of which 206 are stale experiments (IP-03) |
| Preflight | door `preflight` | Door only | 108 blockers, 305 warnings, never acted on (IP-17) |
| WebApp intake notice | `server/utils/intakeOpsNotice.ts:17-20, 106-125` | Slack + `CONTACT_TO` (default `ops@tryblueprint.io`) | Link only. Good. One per job. |
| WebApp beta ops monitor (8 checks) | `server/utils/betaOpsMonitor.ts:17-38` | Slack, then ops email | Checks 7 and 8 serve the grant and the automatic budget extension, which `websiteJobCeiling.ts:12-15` says are gone (O-14) |
| Worker failure, launch readiness | `server/utils/ops-alerts.ts:150-246` | Slack | unverified volume |
| Screening call needed, footage needs review, privacy escalation, company application | `server/utils/slack.ts:58-165` | Slack | The screening-call and footage-review messages serve retired steps (O-14). The application message carries personal data (O-15). |
| Uptime probe | `render.yaml:66`, GitHub `uptime.yml` | Slack, GitHub email | not measured |

**Can a real failure be told from noise in a minute?** No. The webhook repeats one known failure every
hour. The door lists 207 failed units. The capacity report carries 10 disk-usage rows that need no action.
A new real failure looks the same as the spend guard's post. The fix is subtraction (O-10).

---

## 4. The public funnel

- **Live build:** the inlined environment object in `/assets/index-IUZGgzws.js` holds only `BASE_URL, DEV,
  MODE, PROD, SSR`, six `VITE_FIREBASE_*` keys and `VITE_GOOGLE_MAPS_API_KEY`. There is no
  `VITE_GA_MEASUREMENT_ID`, no `VITE_FIREBASE_MEASUREMENT_ID`, no PostHog token or host and no
  `VITE_SENTRY_DSN`. Command: `curl -s https://tryblueprint.io/assets/index-IUZGgzws.js | grep -oE '_n=\{BASE_URL[^}]*\}'`
  (values masked). So **Google Analytics, PostHog and Sentry do not run on the live site.**
- The Privacy Policy names all three as processors (`client/src/pages/Privacy.tsx:161-163, 237-239`). The
  cookie banner asks for consent to them (O-12, a legal page for the owner).
- **What the client measures** after consent: page views (`components/Analytics.tsx:72`) and
  `contact_form_submit` / `contact_form_error` from the start form (`SiteCaptureStart.tsx:590, 616`). These
  are 2 of the 56 events defined in `client/src/lib/analytics.ts:373+`. They go only to
  `/api/analytics/ingest`, which persists only when `BLUEPRINT_ANALYTICS_INGEST_ENABLED` is set (unknown).
- **`growth_events` (1,247 docs).** Writers: the ingest route, `inbound-request.ts:1501`
  (`robot_team_fit_checked`), and `internal-pipeline.ts:1307-1339` (capture-era "proof path" stamps and
  `proof_motion_stalled`). **Readers: none** (grep of `growth_events` finds only the writer). Last code
  change 2026-04-02.
- **One funnel (visit → start → video → shown to companies → answered → introduced) does not exist.**
  Everything after "start" is server state, which already lives in Firestore: `inboundRequests.createdAt`,
  the upload session, `companySends`, `companyResponses`, `introductions`. The funnel needs no analytics.
  It needs one read of those records (see Firestore aggregates and section 7).

---

## 5. Personal data in places built for observation (privacy hard stop)

| Place | What lands there | Evidence | Finding |
|---|---|---|---|
| `growth_campaign_events` (403 docs), written by the Resend webhook for **every** email the account sends | `recipient` and the whole Resend `payload` (`resend-webhook.ts:53-63`). Per Resend's documented event shape this holds `data.to`, `data.from`, `data.subject` and, for clicks, `data.click.link`, `ipAddress` and `userAgent` (resend.com/docs/webhooks/emails/clicked). Subjects include `How did it go with {site name}?` (`jobOutcomes.ts:52`) and `Meet {company}` (`taskLifecycleNotifications.ts:176`). A click on a site's email is the signed private job link. | No reader, no purge, not cleared by withdrawal | **O-01** |
| `captureOutbox` (143 docs) after a row is sent | `to`, `subject` and `body` stay for every kind except the two introduction kinds (`captureOutbox.ts:136-147`). Bodies carry the site's signed private job link (`taskLifecycleNotifications.ts:53-82`, `captureUploadUrlFor`). The company's outcome question carries the site's name in its subject. | No TTL (`firestore.indexes.json` `fieldOverrides: []`). Withdrawal and deletion do not touch the outbox (grep of `websiteCaptureWithdrawal.ts`, `websiteCaptureDeletion.ts`, `accountDeletion.ts`). | **O-02** |
| Request logs | `/api/growth/email/unsubscribe?email=…&scope=…` is logged as is | `email-suppression.ts:39-44` puts the recipient's email in the query. `privateWorkLogPath` passes it through. Ran: `privateWorkLogPath("/api/growth/email/unsubscribe?email=person%40example.com&scope=optional_updates")` returns the same string unchanged. | **O-03** (the PR 1316 mistake in another place) |
| `agentRuns` (2,478 docs) | Task `input` and `output` stored whole, except the one lane marked `persist_content: "redacted"` (`site-task-follow-up.ts:42`; `runtime.ts:825-848`). The brief-reading lane is classed `site_job_text` (`agents/provider-privacy.ts:57`). | Not purged at withdrawal | **O-04** (content in production unverified) |
| Slack, company application | Applicant name, email, and `testSite` ("a site or customer the team would want to test at") | `slack.ts:138-165` | **O-15** |
| Slack, screening call | Model-written `open_questions` about the site's job | `site-task-brief.ts:1066-1075` | covered by O-14 (delete) |

Clean, and to be left alone:

- Intake and ops notices carry ids and links only (`intakeOpsNotice.ts:17-20`).
- Email send logs keep only the recipient's domain (`email.ts:106-132`).
- The request log hides signed links on the six owner routes (`blueprintWorkLogPrivacy.ts:14-22`).
- Client telemetry is sanitized (`client/src/lib/invitationPrivacy.ts:1-55`).
- The door status holds no email address and no name or description fields (grep: 0 matches).
- Five Pipeline journals hold no signed URL and no email: 2,000 lines each from intake, atlas-preview,
  handoff-listener and scene-progression, and 124 from team-scene-packet, all 0 matches for signatures,
  tokens, owner-link paths or email addresses.

---

## 6. Firestore aggregates wanted

Counts and durations only. No personal field is read or returned.

1. `growth_campaign_events`: count; count where `payload.data.subject` exists; count where
   `payload.data.click.link` exists; count by `event_type`; min/max `received_at_iso`. (Sizes O-01 without
   reading any value.)
2. `captureOutbox`: count by `kind` × `status`; for `status=="sent"`, count where `body != ""`; for
   `sent`, median and p90 of `sentAtIso − createdAt`; count with `status in (failed, unknown)`. (O-02, O-16)
3. `inboundRequests` where it is a site job (`isSiteJobRecord`, excluding `internal_test`): count; by month of
   `createdAt`; count with `active_capture_id` set; count with `company_auto_send.sentAtIso` set; count with
   `introductions_used > 0`.
4. **Timings per site job** (join on the job id, return durations only):
   - start → video: `captureUploadSessions/{captureId}` first-complete time − `inboundRequests.createdAt`
     (median, p90, n);
   - video → shown to companies: `inboundRequests.company_auto_send.sentAtIso` (else min
     `companySends.sentAtIso`) − video time;
   - shown → first answer: min `companyResponses.firstAnsweredAtIso` (recordedBy company or operator) −
     first send;
   - answer → introduction: min `introductions.requestedAtIso` − the first answer that allows an
     introduction;
   - also the count of jobs reaching each step (the funnel).
5. `robotTeamAccess`: count by `status`; median of `decidedAtIso − appliedAtIso`; count with
   `termsAcceptedByUid` set.
6. `agentRuns`: count by `task_kind` × whether `input` is a digest object; sum of any recorded cost field by
   `task_kind` for 2026-11. (O-04, O-09)
7. `growth_events`: count by `source` and `event`; max `created_at_iso` per source. (Shows whether the
   ingest flag is on and whether the capture-era stamps still fire.)
8. `opsActionLogs`: count by month and `task_kind`; max timestamp. (Whether anything still writes it.)

---

## 7. What the owner decides, and the smallest thing that answers it

| Decision | Number that drives it |
|---|---|
| Is the loop working at all? | Jobs in, videos in, jobs shown to companies, answers, introductions: this week and in total |
| Where is it slow? | Median time per step (start→video, video→shown, shown→answer, answer→introduction) |
| What needs me today? | Jobs waiting on Blueprint, with how long and why. Company applications waiting, with age. Emails that failed or bounced. Real Pipeline failures (not noise). |
| Can I afford this month? | Month spend against the limit; cost per job that reached companies |
| Is there revenue to bill when I decide? | Introductions made (company email sent), with outcome answers |

**Proposal: one daily email to the owner, about 15 lines, built from Firestore and one door read.** It
replaces nothing the owner needs to click through. It lets these go:

- `growth_events` writers and collection (O-13);
- the payload copy in `growth_campaign_events` (O-01);
- 54 unused event definitions in `client/src/lib/analytics.ts`;
- the cookie banner, once no analytics runs (owner decision);
- beta ops monitor checks 7 and 8;
- the screening-call and footage-review Slack messages;
- the `usage_*` rows as alerts;
- the hourly repeat of a unit failure already reported (post once, then daily in the digest);
- `opsActionLogs`, if aggregate 8 shows no reader and no recent writer (unverified).

Keep `/admin/jobs` for one job's detail.

Deletions I expect might come back: the cookie banner (if the owner later turns on ads measurement) and
the hourly repeat (if the owner wants pages at night for money). Both are cheap to restore.

---

## Requirements ledger

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
