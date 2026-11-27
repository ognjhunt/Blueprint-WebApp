# Outreach playbook

This is the process Blueprint follows every time it brings on deployment
companies and sites with jobs. The operator (a person or an agent) runs the
readiness gate, prepares each batch and reads the data. The owner gives the
go-ahead for each batch, and nothing is sent to an outside person without it
(`AGENTS.md:98-99`). It was written from an audit of both repos and the live
system on 2026-11-26; a second pass then checked each claim against its
source.

**State claims are as found on 2026-11-26 between 23:00Z and 24:00Z. The gate
was read again on 2026-11-27 at 00:08Z, and rows that had moved carry that
time. Re-read everything before each wave.** The host moves fastest: it was
deployed twice that evening (`adcf33b` by 22:59Z, `2d9de22` by 23:26Z) and a
third deploy (`f7d9d80`) was running at 00:08Z.

**Updated on 2026-11-27, about 04:00Z,** after a run that tackled four gaps:
the company path, targeting and tracking, the two privacy hard stops, and
what a site gets. Its fixes are commits on the WebApp branch
`claude/dreamy-planck-a9lx67`. **None is on main or live yet:** the live site
was still `e439731` at 03:54Z (`version.json`). A fix marked "done" below is
done on that branch and takes effect only once it is merged and deployed.
Rows changed in this update say so and carry their reading's time; C1 was
read again at 03:53Z.

Line numbers are for WebApp `e439731` and Pipeline `adcf33b`, except where a
row changed in the 2026-11-27 update cites a file the branch changed: those
cite the branch. The Pipeline's main has moved since (`439ebdb` locally; the
host ran `b22546f` at 02:56Z on 11-27). A path with no repo
name is in this repo. "Pipeline" means the sibling checkout
`BlueprintCapturePipeline`.
"Tracker" means Pipeline `docs/launch-readiness/2026-11-beta-launch-tracker.md`.
"First-run log" means `docs/qa/first-job-run/README.md` on the open WebApp
pull request 1413 (not on main). It is the only run with a written log, and it
used a test company and stock footage. A second run, on Blueprint's internal
test job with the internal test company, also reached an introduction on
2026-11-25.

## 1. Readiness gate

Run the gate before every wave. It only reads.

**Hard stops are privacy, rights and money only** (`AGENTS.md:73-96`). A hard
stop that fails stops the wave it protects: every hard stop below protects a
site wave, because only a site's job brings a video, a consent and paid work.
Every other row is a **flag**. A flag does not stop a wave. Write it in the
batch note the owner sees, and carry on.

A company wave has no hard stop in this table. It needs the owner's go-ahead
(section 2), which is a rule of its own and not a readiness check.

### Commands

Run them from the WebApp root in a cloud session
(`docs/runbooks/cloud-scene-runs.md`).

**C1, counts.** Read-only Firestore counts. It prints counts, states and dates,
never a name, an email, an address or a phone number. It is committed as a
script (fix 16, `scripts/ops/outreach-counts.ts`, on the branch). It prints
what the inline script of 2026-11-26 printed, then four readings added on
2026-11-27: `owner_application_emails` (the owner's email about a waiting
application, by status), `rule_trials_today` (the owner's trial runs of the
rule), `outreach_log` (contacted, do not contact, contacted with no go-ahead
date) and `account_deletion_age_alerts` (the 25- and 30-day notices). The
playbook and the script reach main together.

```bash
. ~/.blueprint-cloud/env.sh
npx tsx scripts/ops/outreach-counts.ts
```

**C2, host reading.** One read through the operator door (Pipeline
`docs/OPERATOR_DOOR.md`).

```bash
. ~/.blueprint-cloud/env.sh
(cd "$BLUEPRINT_PIPELINE_ROOT" && python3 scripts/operator_door.py status) | python3 -c '
import json, sys, datetime
d = json.load(sys.stdin)
a = d["spend_guard"]["account_monthly_spend"]; w = d["capacity"]["website_withdrawal_deletion"]; g = d["spend_guard"]
t = lambda e: datetime.datetime.fromtimestamp(e, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
print("read_at", d["generated_at"])
print("release", d["active_release"]["commit"][:7], "commit_proven", d["deployed"]["commit_proven"], "blockers", d["deployed"]["blockers"], "deploy_in_progress", d["deploys"]["active_units"])
print("failed_units", d["failed_units"], "door_queue", d["door_requests"])
print("money", "counted", round(a["counted_usd"], 2), "limit", a["limit_usd"], "headroom", round(float(a["limit_usd"]) - a["counted_usd"], 2), "held", a["held_usd"], "admission_allowed", a["admission_allowed"], "limit_reached", a["limit_reached"])
print("forecast", a["forecast"]["status"], a["forecast"].get("reaches_limit_on"), "per_day", round(a["forecast"]["daily_rate_usd"], 2), "measured_days", a["forecast"]["measured_days"], "gaps", a["gaps"])
print("fixed_so_far", {k: v["unattributed_usd"] for k, v in a["reconciliation"]["providers"].items() if (v.get("unattributed_usd") or 0) > 0})
print("highest_job_usd", max(j["metered_usd"] for j in a["jobs"] if j["job_id"] != "unattributed" and not j["job_id"].startswith("overhead:")))
print("unattributed", [(j["admissions"], j["held_usd"]) for j in a["jobs"] if j["job_id"] == "unattributed"])
print("spend_guard", g["status"], g["blockers"], "provider_zero_verified", g["provider_zero_verified"], "live_gpu", g["live_instance_count"])
print("withdrawal", "approval", w["approval_status"], w["approval_source"], "seen_at", t(w["observed_at_epoch"]), {k: v for k, v in w["withdrawals"].items() if v})
print("backup", d["capacity"]["stall"]["checks"]["state_backup"])
print("stalls", {k: v.get("stalled", v.get("stuck")) for k, v in d["capacity"]["stall"]["checks"].items() if isinstance(v, dict) and ("stalled" in v or "stuck" in v)})
print("alerts", [(x["code"], x["severity"]) for x in d["capacity"]["alerts"]])
m = d["memory"]["meminfo"]; print("memory_gb", round(m["MemAvailable"] / 1e9, 2), "of", round(m["MemTotal"] / 1e9, 2), "oom_24h", d["memory"]["oom_reports"]["count"])
print("disk_gb_over_floor", [(x["mount"], x["level"], round((x["available_bytes"] - x["floor_bytes"]) / 1e9, 1)) for x in d["capacity"]["mounts"]])
'
```

**C3, website and host liveness. C4, CI on both main branches.**

```bash
. ~/.blueprint-cloud/env.sh
# C3
for p in version.json health/ready health/worker health/outbox; do curl -s https://tryblueprint.io/$p; echo; done
curl -s https://paperclip.tryblueprint.io/api/live-pipeline/operator/v1/healthz; echo
curl -s https://tryblueprint.io/api/public/live-jobs; echo
curl -s -o /dev/null -w 'sign-in %{http_code}\n' https://tryblueprint.io/sign-in
git ls-remote origin refs/heads/main
(cd "$BLUEPRINT_PIPELINE_ROOT" && git ls-remote origin refs/heads/main)
# C4
gh run list --branch main --limit 6 --json name,conclusion,headSha,createdAt
(cd "$BLUEPRINT_PIPELINE_ROOT" && gh run list --branch main --limit 6 --json name,conclusion,headSha,createdAt)
```

**C5, versions and limits in code.** Seven greps, numbered in order.

```bash
. ~/.blueprint-cloud/env.sh
grep -n 'RECORDING_RIGHTS_STATEMENT_V6_VERSION =' client/src/lib/recordingRightsStatement.ts
grep -n 'consentLine =' client/src/components/site/SiteCaptureStart.tsx
grep -n 'NO_TESTED_ANSWER_VERSION =' client/src/lib/legalAcceptance.ts
grep -n 'SHARING_STATEMENT_VERSIONS:' "$BLUEPRINT_PIPELINE_ROOT/src/blueprint_pipeline/sharing_statement.py"
grep -n 'per_job_cap_usd' contracts/pipeline/website-job-spend-cap.v1.json "$BLUEPRINT_PIPELINE_ROOT/config/website_job_spend_cap.v1.json"
grep -n -A2 'monthly_limit' "$BLUEPRINT_PIPELINE_ROOT/config/account_monthly_spend_limit.v1.json"
grep -n 'global: 5,' server/utils/betaAbuseCaps.ts
```

**C6, the two withdrawal checks** (gate check P3; from the 2026-11-27 privacy
report). Read-only door calls, from the Pipeline root. They read the one
withdrawal on record.

```bash
. ~/.blueprint-cloud/env.sh
cd "$BLUEPRINT_PIPELINE_ROOT"
S=/var/lib/blueprint/pubsub-handoffs/blueprint-8c1ca.appspot.com/scenes/site-capture-ceba4511-bfca-4a22-8fdc-0ffae40d27c3/website_withdrawal
# Check 1: after the plan due at 2026-11-27 16:21:13Z. First worth reading at 17:50Z; if `scanning`, again after each hourly pass.
python3 scripts/operator_door.py journal blueprint-website-withdrawal-deletion.service -n 30
python3 scripts/operator_door.py cat $S/automatic_deletion_state.json
python3 scripts/operator_door.py ls /var/lib/blueprint/pipeline-control-plane/website-withdrawal-deletion/run-scan-cache
python3 scripts/operator_door.py cat $S/automatic_deletion_plan.json | python3 -c "import json,sys,collections as c; p=json.load(sys.stdin); print(len(p['unresolved']), dict(c.Counter(r['reason'] for r in p['unresolved'])), len(p['runs']), len(p['objects']), p['cloud_bucket'] is not None, p['legal_hold'])"
# Check 2: after the cool-off ends at 2026-11-28 02:25:31Z. First worth reading at 03:45Z.
python3 scripts/operator_door.py cat $S/automatic_deletion_state.json
python3 scripts/operator_door.py ls $S/deletion_receipts
python3 scripts/operator_door.py cat $S/deletion_receipts/<the one file listed>.json | python3 -c "import json,sys; r=json.load(sys.stdin); a=r.get('authorization',{}); print(r['deletion_status'], a.get('kind'), a.get('approval_source'), a.get('approval_digest'), [x['holder'] for x in r['incomplete_reasons']], sorted({x['holder'] for x in r['remaining']}))"
python3 scripts/operator_door.py status | python3 -c "import json,sys; w=json.load(sys.stdin)['capacity']['website_withdrawal_deletion']; print(w['approval_status'], w['approval_source'], {k:v for k,v in w['withdrawals'].items() if v}, w['alert_codes'])"
```

- **Check 1 passes** when the state reads `status planned`, `waiting_on
  ["cool_off"]`, `unresolved_count 0`, `failure_count 0` and
  `cool_off_ends_at_epoch` 1795832731.29, and the plan's `unresolved` is
  empty (`cloud_bucket` not null means the source bucket is set). **Still
  moving:** `status scanning`, `failure_count 0`, `run_scan.runs_kept` above 0
  and a growing `run-scan-cache/`. **Fails:** `status unresolved` with
  `website_withdrawal_deletion_offloaded_run_binding_undetermined` (expected
  until fix 20 lands), or `status failed` with `failure_count 5` (a timeout or
  out-of-memory kill in the journal).
- **Check 2 passes** when the state reads `status applied`; there is exactly
  one receipt; `deletion_status` is `complete` or
  `complete_provider_retention_remains`; `authorization.kind` is
  `standing_owner_approval`, `approval_source` `release` and
  `approval_digest` `sha256:405712cf…`; `incomplete_reasons` is empty; and
  door status shows `completed 1`, `waiting 0`, `failing 0` and no alert
  codes. **Partial:** `status incomplete` with `capture_source_bucket` (the
  source bucket is unset; the pass repeats every 6 hours). **Fails:** no
  receipt, and the state is `unresolved` or `failed`.

### Privacy

| # | Check | Proof | Pass when | 2026-11-26 | Kind |
| --- | --- | --- | --- | --- | --- |
| P1 | The website can tell the host about a withdrawal | C1 `withdrawal_notice`; C3 `health/ready` | Both booleans true; `ready`, `blocker_count` 0 | **pass.** Both true; ready, 0 blockers (23:19Z) | Hard stop, site wave |
| P2 | The website deletes its own copy after a withdrawal | C1 `withdrawals`, `website_deletion_receipts` | Every withdrawal is `acknowledged=true` and has a `complete` receipt | **pass.** 1 withdrawal (the first-run job), acknowledged, 1 `complete` receipt | Hard stop, site wave |
| P3 | The host can delete after a withdrawal | C2 `withdrawal`; C6 | `approval valid`, and no `failing` or `overdue` | **fail.** At the 23:36Z pass the approval read `valid`, source `release` (door journal of `blueprint-website-withdrawal-deletion.service`); until then it read `absent` (tracker:280-285). `failing 1` stays, also at 00:08Z on 11-27: the one withdrawal's last plan was interrupted on an older release. Its next plan is the first pass after 2026-11-27 16:21:13Z (about 17:00Z by the timer's drift), and its cool-off ends 2026-11-28 02:25:31Z. No plan has run on the cache release yet: `run-scan-cache/` does not exist (0 of 59 run directories kept). As the code stands that plan ends `unresolved`. 144 readable offloaded runs name no site, and the pass never reads archives (Pipeline `website_capture_withdrawal_deletion.py:665-669`, `website_capture_withdrawal_automatic.py:868-884`; proved offline in the 2026-11-27 privacy report). So no deletion will apply until that is fixed (fix 20). No deletion has ever been applied on the host. **Two later checks (C6):** check 1 at 2026-11-27 17:50Z, after the plan; check 2 at 2026-11-28 03:45Z, after the cool-off. Each passes as C6 says | Hard stop, site wave |
| P4 | No account deletion request is past the promised time | C1 `account_deletion_requests`, `account_deletion_age_alerts` | None past 30 days without a completion record (runbook `account-data-deletion.md` step 7). `in_review` alone does not pass: "Start privacy review" deletes nothing, and no completed state exists (`client/src/types/accountDeletion.ts:4`) | **fail.** 1 request, `requested`, 37 days old, no reviewer (38 at the 03:53Z reading on 11-27, which counts whole days to the reading). Its email is at a reserved test domain. The account was made by the WebApp sign-up, has 1 session, never finished onboarding, and requested deletion in the minute it was created. No record but its user doc names it. A test account (inferred, high confidence). From fix 11 (on the branch), the owner is told once at 25 days and once at 30 (`server/utils/accountDeletionAgeAlerts.ts`) | Hard stop, site wave |
| P5 | Contact details in an introduction are encrypted at rest | C3 `health/ready` (field encryption is a required check, `server/utils/launch-readiness.ts:157-159`) | `ready`, 0 blockers | **pass** | Hard stop, site wave |
| P6 | Firestore backups and point-in-time recovery | `bash scripts/ops/verify-firestore-backups.sh --project blueprint-8c1ca` (the owner; needs credentials) | Recovery on, a schedule present | **unknown.** Run from a cloud session it exits 2: the session's credentials cannot describe the database | Flag |

### Rights

| # | Check | Proof | Pass when | 2026-11-26 | Kind |
| --- | --- | --- | --- | --- | --- |
| R1 | The statement a site accepts at Send is the current sharing statement, and the host accepts it | C5 greps 1, 2 and 4 | The start form records a version listed in the Pipeline's `SHARING_STATEMENT_VERSIONS` | **pass.** `2026-11-23.v6` (`client/src/lib/recordingRightsStatement.ts:55`, shown at `client/src/components/site/SiteCaptureStart.tsx:823`); the Pipeline lists v4 and v6 (`src/blueprint_pipeline/sharing_statement.py:21`) | Hard stop, site wave |
| R2 | The Terms and Privacy Policy in force are the ones the outreach copy quotes | C5 grep 3; https://tryblueprint.io/terms and https://tryblueprint.io/privacy | The version in code is the version each page prints | **pass.** `2026-11-25.2` (`client/src/lib/legalAcceptance.ts:465-467`); both live pages print "Version 2026-11-25.2." | Hard stop, site wave |
| R3 | The live website is the code that was read | C3 `version.json`, `git ls-remote origin refs/heads/main` | The two SHAs are equal | **pass.** Both `e439731`, built 2026-11-26T08:14Z | Hard stop, site wave |
| R4 | A job under an older statement is not shown to companies | C1 `site_jobs_by_state` | No `LISTED` job has a statement before `2026-11-12.v4` | **pass.** 0 listed; 42 are held back as `older_statement` (rule: `server/utils/teamJobAccess.ts:6-17,214`) | Hard stop, site wave |

### Money

| # | Check | Proof | Pass when | 2026-11-26 | Kind |
| --- | --- | --- | --- | --- | --- |
| M1 | The account's monthly limit is set and not reached | C2 `money`; C5 grep 6 | `admission_allowed True`, `limit_reached False` | **pass.** $350.88 counted of $400 at 00:08Z on 11-27 (87.7%); November's $400 is an override on a $300 limit. Alerts: the 80% page, and a forecast that reaches the limit on 2026-11-30 at $12.67 a day, a lower bound | Hard stop, site wave |
| M2 | The headroom covers the wave | C2 `money`, `fixed_so_far`; arithmetic in section 4 | Headroom, less fixed spend to the month's end, is at least the wave size times $16.20. Report how many fit at the $40 cap | **fail for a site wave.** $49.12 headroom at 00:08Z on 11-27, about $34 of fixed spend to come, about $15 left: 0 jobs at $16.20 or at $40. Not needed for a company wave | Hard stop on the size of a site wave |
| M3 | The job cap is $40 in both repos and no job passed it | C5 grep 5; C2 `highest_job_usd` | Both files read `"40"`; every job at or under 40 | **pass.** Both `"40"` (`contracts/pipeline/website-job-spend-cap.v1.json:3`); highest job $26.63 | Hard stop, site wave |
| M4 | The intake cap is 5 new jobs a day | C5 grep 7; C1 `intake_today` | Code default 5, and the day's counter shows `limit=5` | **pass.** `server/utils/betaAbuseCaps.ts:47`; the last counter written, for 2026-11-23, reads `limit 5` (`durableDailyCaps`) | Hard stop, site wave |
| M5 | The invitee allowlist is in the state the owner chose | The Render web service's Environment page or its start-up log line `invitee_allowlist_unset` (`server/index.ts:58-66`); the owner reads it | Unset by decision, or set and holding every invited site's email or domain (`server/utils/inviteeAllowlist.ts:20-32`) | **unknown.** No public endpoint shows it | Hard stop, site wave |
| M6 | The spend guard can see every provider | C2 `spend_guard` | `passed`, `provider_zero_verified True` | **fail.** `blocked`, `runpod_inventory_query_failed`: the retired RunPod key is still on the host (tracker:252). The unit exits with status 2 on every run (door journal, 23:20Z). Admission stays allowed and 0 GPU instances are live | Flag |
| M7 | The month's count is complete | C2 `forecast … gaps`, `unattributed` | No gaps; nothing unattributed | **fail.** World Labs is partial and held at its last count; 345 admissions with no job hold $18.00. The true headroom is unknown | Flag |
| M8 | The video reading's daily cap is in force | `server/utils/betaAbuseCaps.ts:226-228` ($10 a review, $50 a day) | Code defaults unchanged | **pass.** The last counter written, `durableDailyCaps/model_review_spend_micro_usd__2026-11-24`, reads `limit 50000000` micro-USD | Flag |

### The service works

All flags.

| # | Check | Proof | Pass when | 2026-11-26 |
| --- | --- | --- | --- | --- |
| S1 | Website build and CI | C3; C4 | The live SHA is main's head; `CI` and the deploy run succeeded on it | **pass.** `e439731`; CI 08:07Z and the CI-gated deploy 08:13Z both `success` |
| S2 | Host release and CI | C2 `release`; C4 | The commit is on main, `commit_proven True`, `blockers []`, CI `success` | **pass.** `2d9de22`, `commit_proven`, no blockers; CI, CodeQL and Python Compatibility `success` on it (23:04Z). Earlier readings that day were on `adcf33b` (deploy receipt 22:59Z); `2d9de22` followed at 23:26Z. Main's tracker records both deploys (its section "The host's state backup needs no hand-installed secret"). At 00:08Z on 11-27 a deploy of `f7d9d80` (Pipeline pull request 3764) was running and its CI had not finished: read this row again |
| S3 | At least one real approved deployment company can see jobs | C1 `companies_that_may_see_jobs` (the rule is `companyMaySeeJobs`, `server/utils/companyTerms.ts:69-72`) | 1 or more | **fail.** 0. The 3 application records are 1 approved internal test company and 2 declined test records. At 03:53Z on 11-27: still 0; 4 records, the fourth waiting for the owner (0 days, `not_a_robot_company`). Whether it is a real company was not read |
| S4 | The automatic approval rule can run in production | C1 `rule_model_runs` after one press of "Run the rule" on `/admin/robot-team-access` (fix 1, on the branch: counts against its own 10 a day, records nothing; a trial does not move `rule_check_days`); or C1 `rule_check_days`, `rule_model_runs` from a real application; or the owner reads `OPENAI_API_KEY` on the Render web service | A rule check has reached the model, or the owner confirms the key | **unknown** on 11-26: 0 and 0. **Pass at 03:53Z on 11-27:** `rule_check_days 1`, `rule_model_runs 1`, and the waiting application's reason is `not_a_robot_company`, which only the model's "no" gives (`server/utils/companyCheck.ts:237`). So the live rule reached the model once. Whether it approves a real robot company is unproven: no check has said yes. The 2026-11-27 pre-check ran the rule's plain steps on 46 researched websites, and 44 would reach the model (section 2) |
| S5 | The owner hears that an application waits | The Render Environment page (`CONTACT_TO`, default ops@tryblueprint.io; Slack webhooks optional); C1 `applications_waiting`, `owner_application_emails` | The owner reads the inbox `CONTACT_TO` names: each application and each 3-working-day wait is emailed there once (`server/utils/ownerApplicationNotice.ts`, fix 2, on the branch), beside Slack; nothing waits past 3 working days | **unknown.** On the live code the bell and the reminder are still Slack only, and the webhook is unverified; readiness does not require it (`server/utils/launch-readiness.ts:117`). At 03:53Z on 11-27 one application waits, 0 days old. `CONTACT_TO` on Render was not read |
| S6 | Sign-in works | C3 `sign-in`; C1 `sign_in_links_used` | The page answers 200 and a link has been redeemed | **pass at 03:53Z on 11-27:** `sign-in 200`, `sign_in_links_used 2` (0 on 11-26; the first redemption was read at 02:19Z by the company proof run, not made by the audit; who made them was not read). The invitation link worked once, for the test company (first-run log, 13:23Z row). On the branch (fix 3) a link is spent only on the company's press of "Sign in with this link" (`client/src/pages/Login.tsx:83`); the live page still redeems on load |
| S7 | Worker heartbeat and email are moving | C3 `health/worker`, `health/outbox`; C1 `outbox` | `fresh`; `moving`; no new `failed` | **pass.** `fresh`, `moving`; 145 sent, 10 failed (all created 2026-09-19 to 2026-09-22; their failure alerts were recorded on 2026-10-24), 1 cancelled |
| S8 | Alerts reach a person | The Render Environment page (`SLACK_WEBHOOK_URL`); `.github/workflows/uptime.yml` runs in C4; C1 `ops_alerts` | The webhook is set; the last `Uptime` run succeeded; no stale open alert | **unknown.** Webhook unverified. `Uptime` succeeded at 23:09Z. 4 alerts are open, opened in 2026-07 and 2026-09 (`opsAlerts`) |
| S9 | Host health | C2 `stalls`, `memory_gb`, `disk_gb_over_floor`, `door_queue`, `failed_units`; C3 `healthz` | All stalls 0; no out-of-memory report; disks `ok`; `{"ok": true}`; no failed unit beyond those M6 and S10 already name | **pass.** 0 stalls, about 6 of 8.33 GB of memory free (it moved between 5.9 and 6.5 GB over 15 minutes), 0 reports, both disks `ok`, queue empty. `failed_units` names two units, the spend guard (M6) and the state backup (S10) (00:08Z on 11-27) |
| S10 | The host's state is backed up | C2 `backup`, `failed_units`; door journal of `blueprint-control-plane-state-backup.service` | `complete_generation_seen True`, and the backup unit is not in `failed_units`. The word `fresh` alone is not a pass | **fail.** `not_configured` until the `2d9de22` release. The first backup run started at 23:33:18Z, on the release that carries Pipeline pull request 3763, and ended at 23:43:28Z `incomplete` (`control_plane_backup_time_bound_reached`; 34,010 files, 3.33 GB read). The unit exited with status 2 and is in `failed_units`. At 00:08Z on 11-27 the status still read `fresh` with `complete_generation_seen False`: no complete generation exists. Pipeline pull request 3764 (the backup packs faster and runs hourly) was deploying at that time. No restore drill has run |
| S11 | Email volume fits the plan | `docs/runbooks/resend-email.md:101-106`; the owner reads the Resend dashboard | The day's planned email is under the plan's daily cap | **unknown.** The runbook says 100 a day and 3,000 a month on the free plan and asks the reader to confirm |

**Result on 2026-11-26, read again on 2026-11-27 at 00:08Z.** A company wave
may go once the owner says so, with S3, S4, S5 and S6 written in the batch
note. A site wave may not go: P3, P4 and M2 fail and M5 is unknown. Flags
that fail or are unknown: P6, M6, M7, S3, S4, S5, S6, S8, S10 and S11.

**Rows read again on 2026-11-27 at 03:53Z (C1) and 03:54Z (C3).** S4 and S6
now pass. P3 and P4 still fail; P3 cannot pass before check 2 of C6
(2026-11-28 03:45Z), and as the code stands not until fix 20 lands. A company
wave may go once the owner says so, with S3 and S5 written in the batch note.
Flags that fail or are unknown: P6, M6, M7, S3, S5, S8, S10 and S11. M2, M6,
M7 and the host rows were not read again.

## 2. Company outreach

Contacting a company that Blueprint has not approved is outreach and needs the
owner's word first (`AGENTS.md:98`).

### Target selection

Pick by criteria. Never name a target in a document, a pull request or a
report. The list is the research collection `robotTeams` (114 records: 107
`prospect`, 7 `self_registered`). The seed says what it is: "real companies
that have not agreed to anything", and nothing in it "may be presented to
anyone as a relationship" (`server/data/robotTeamSeed.ts:6-9`). Counts below
were read from `robotTeams` on 2026-11-26 and recounted on 2026-11-27, when
criteria 4, 6 and 7 were judged from each company's own pages and criterion 8
by a written rule (the 2026-11-27 targets report). By `updatedAt`, 107 records
are from 2026-10, 6 from 2026-09 and 1 from 2026-11.

| # | Criterion | Field or source | Count |
| --- | --- | --- | --- |
| 1 | A real company, not a test record | `status == "prospect"` | 107 |
| 2 | Has a website, the rule's first input | `website` | 107 (106 distinct hosts) |
| 3 | The researched address is at the website's domain, by the rule's own `domainMatch` (`server/utils/companyCheck.ts:72-79`). A proxy only: the rule checks the applicant's own work email | `contactEmail` against `website` | 42 match, 2 do not, 63 have no address |
| 4 | Deploys physical robots; not software-only and not a technology partner (the rule never approves one, `server/utils/companyCheck.ts:233`) | `capabilityDescription` (no structured field); each company's own pages | 15 of the 18 that meet criteria 3 and 5, from each company's own pages read 2026-11-27 (2 software suppliers, 1 sells an arm platform to builders) |
| 5 | Fits the kind of job whose route is on record as having run live, moving one captured object (Pipeline `docs/test-footage/clip-mix-v1.json:354`): an arm or a mobile manipulator | `capability.embodiment` | 46 overall; 18 of the 42 (class is the text before the first `;`, lowercased; it equals `fixed arm` or starts with `mobile manipulator`; the stored text is `mobile manipulator (arm on a driving base)`). After criterion 4 (own pages read 2026-11-27): 15 of the 18 |
| 6 | Its own website shows customer deployments, the rule's second test | Its home page, read fresh on the day | 7 of the 18, read 2026-11-27 (home page and up to three linked pages) |
| 7 | Deploys in the United States, where sites are taken (`client/src/pages/Beta.tsx:25`) | `deploymentRegions` (empty on every record); its own pages | 6 of the 18 show a US deployment or US customer base on their own pages, read 2026-11-27 (a US office alone does not count); `deploymentRegions` is on no record |
| 8 | A named person, not a role inbox | The local part of `contactEmail` | 16 of the 42 (3 of the 18), by the written role-word rule in the 2026-11-27 targets report (the local part split on `. _ - +` and digits; a role inbox if any piece is a role word such as info, sales or contact) |

The pool after criteria 3 and 5 is 18. After criteria 4, 6 and 7, read on
each company's own pages on 2026-11-27, 4 are ready for a first batch (1 with
a named person, 3 with role inboxes; 1 shows the US only as "North America").
12 more that meet criteria 4 to 7 have no researched address; finding one is
by hand or by the paid lookup (a money decision). 30 were dropped: no US
deployment shown (12, of which 6 the owner could keep if US work is
confirmed), no customer deployment shown (8), software-only or technology
partner (5), robots only in its own operations (2), home page unreadable to
the rule (2), no website of its own (1). No prospect's website or address
domain matches any of the 4 `robotTeamAccess` records. The list of 46 with
the reasons is kept for the owner only and is never committed. Re-read each
page on the day of the batch. Before each batch:

1. Read each candidate's home page that day. The list is stale: 107 of 114
   records were last updated in October.
2. Keep a candidate only if its own page shows it deploys robots for
   customers. Copy the sentence and its URL into the batch note.
3. Never quote a field marked `inferred`. The registry calls it "Useful for
   prioritising outreach, never quotable to a site"
   (`server/types/robot-team-registry.ts:39-40`).
4. Drop any company that already applied, was declined, or asked not to be
   contacted (marked "Do not contact" on `/admin/outreach`).
5. Run the rule's plain steps on each website with curl (the 2026-11-27
   pre-check passed 44 of 46; 1 page has no text without scripts and 1
   answers 403 to the rule's User-Agent). curl is not the rule's guarded
   fetch, so a pass means "likely passes". Whether the rule's model step
   approves any of them is unproven: the live rule has answered once, a "no"
   (gate check S4).

Whether a researched address still works is unknown; none was checked. A paid
contact lookup exists (Pipeline `tools/daily_research/contact_lookup.py:1-13`).
Using it is a money decision for the owner.

### The owner's go-ahead, per batch

The owner is shown one batch note:

- how many companies, and for each: its record id, website, the criterion
  numbers it meets, the sentence from its own page with the URL, and the
  address the message would go to (the note stays with the owner and is never
  committed);
- the exact first message and the one follow-up, with every placeholder filled;
- who presses send. Until the owner says otherwise, the owner sends
  (`AGENTS.md:99`);
- the gate's results from that day, with every flag;
- the state line the message will carry (whether any job is open, from C1
  `listed_for_companies`).

"Yes" covers that list, that wording, one follow-up to those who did not
answer, and nothing else. A new company, a changed sentence or a second
follow-up needs a new yes.

Where it is recorded: no place for outreach decisions exists today. The owner's
words on deploys are kept as dated entries in the Pipeline tracker
(`docs/launch-readiness/2026-11-beta-launch-tracker.md:225,257,282`). Do the
same: one dated entry with the owner's words, the batch size and the message
version, and no company name. Put the entry's date in each contact's log row:
the outreach log's "Go-ahead entry dated" field (`/admin/outreach`, fix 8, on
the branch). A contact recorded without it is flagged there, not refused.

### DRAFT: first message to a deployment company

> Subject: Job packets from sites, for robot deployment companies
>
> Hello [FIRST NAME],
>
> I work on Blueprint. I am writing because [COMPANY]'s website says:
> "[SENTENCE FROM THEIR OWN PAGE]" ([URL OF THAT PAGE]).
>
> Blueprint is how a site sends a job to deployment companies. Someone at the
> site films one full round of a recurring job on a phone and says what
> counts as done. We turn that into a job packet:
> the site's description, the video with its sound removed, the site's answers
> on weight, size, rate and hours, and a simulation of the site to open in your
> own tools when it is ready.
>
> Approved deployment companies see each job and answer Apply, Not a fit or
> Need more details. If you apply and the site accepts you, we email you both
> each other's details. Until then you see no site name, address or contact
> details.
>
> What is true today:
>
> - [STATE LINE. If C1 `listed_for_companies` is 1 or more: "Jobs are open
>   today." If it is 0: "No job is open today. Once approved, you get an
>   email when one is posted."]
> - Nothing is charged today. Deployment companies will pay for this service.
>   How is not decided, so there is no price I can give you.
> - The simulation is an estimate that helps you review a job. Blueprint runs
>   no robot software in it, and it does not certify performance or safety.
> - I can't promise that a job will fit you or that a site will accept you.
>
> You can see a sample job, made from stock footage, and apply at
> https://tryblueprint.io/jobs. The form asks for your name, work email,
> company and website. [RULE LINE. If gate check S4 passed: "We approve a
> company at once when its work email is at its website's domain and the
> website shows it deploys robots. Otherwise we look ourselves." If not: "We
> check each application against a published rule and email our answer within
> three working days."]
>
> If you would rather not hear from us again, reply and say so, and I will
> not write again.
>
> [SENDER FIRST NAME], Blueprint
>
> [LEGAL BUSINESS NAME], [VALID POSTAL ADDRESS: street, USPS box or
> registered private mailbox]. [THE OWNER'S WORDING THAT THIS MESSAGE IS AN
> ADVERTISEMENT]. To stop all messages from us, reply "stop".

Proof for each sentence: the packet's contents (`client/src/pages/CompanyJob.tsx:33-37`);
the answers (`client/src/lib/companyResponses.ts:158-161`); the introduction
(`client/src/lib/publicCopy.ts:62`); "Nothing is charged today"
(`client/src/pages/Terms.tsx:76`); companies will pay and how is not decided
(`PLATFORM_CONTEXT.md:70-73`); no robot software and no certification
(`PLATFORM_CONTEXT.md:111-113,209-211`); the sample (`client/src/lib/publicCopy.ts:50`);
the form (`client/src/components/site/PartnerApplication.tsx:65-73`); the rule
and the three working days (`client/src/lib/companyCheck.ts:15`,
`client/src/components/site/PartnerApplication.tsx:9-10`). The subject says
what the message is about whether or not a job is open, and the footer is the
sender's identity, postal address, advertisement notice and opt-out the FTC's
CAN-SPAM guide asks of a commercial email, business to business included
(risk 17). Send from a Blueprint address that names Blueprint.

Two lines wait on the owner. The three-working-days line holds only if the
owner hears of each application, so settle owner decision 5 before the first
batch; the form makes the same promise to every applicant. Whether the first
message carries "Deployment companies will pay for this service", or only the
cost reply does, is part of owner decision 11: the doctrine supports the
sentence (`PLATFORM_CONTEXT.md:70-73`), but no public page says it yet.

### DRAFT: follow-up to a deployment company

Send once, five working days after the first message, only if there was no
reply and no application.

> Subject: Re: Job packets from sites, for robot deployment companies
>
> Hello [FIRST NAME],
>
> I wrote on [DATE] about jobs on Blueprint. In one line: a site films a
> recurring job, and approved deployment companies review its job packet and
> answer without a visit. [STATE LINE, as in the first message.]
>
> The sample job and the application are at https://tryblueprint.io/jobs.
> Nothing is charged today.
>
> This is my last message unless you reply. If you would rather not hear from
> us again, reply and say so.
>
> [SENDER FIRST NAME], Blueprint
>
> [LEGAL BUSINESS NAME], [VALID POSTAL ADDRESS: street, USPS box or
> registered private mailbox]. [THE OWNER'S WORDING THAT THIS MESSAGE IS AN
> ADVERTISEMENT]. To stop all messages from us, reply "stop".

### DRAFT: reply to a company that asks what it costs

> Thanks for asking. Nothing is charged today. Deployment companies will pay
> for this service. How is not decided, so there is no price I can give you.
> Our Terms say that a change that asks something new of you applies to you
> only once you agree to it: https://tryblueprint.io/terms.

Say no more than this. Do not say what it might cost, when a price will come
or that it is free for companies (`PLATFORM_CONTEXT.md:70-73`;
`client/src/pages/Terms.tsx:122`). Whether to tell companies that each
introduction is recorded is owner decision 11.

### From application to first answer, as the company sees it

| Step | What the company sees | URL | Proof |
| --- | --- | --- | --- |
| 1. Apply | A sample job and "Apply to see jobs". Four fields: name, work email, company, website. Then "Your application is saved." No receipt email | https://tryblueprint.io/jobs, or the gate on a job link `https://tryblueprint.io/jobs/<id>` | `client/src/components/site/PartnerApplication.tsx:57-73`; `server/routes/robot-team-access.ts:124` |
| 2. The rule | Nothing on screen. In order: the email domain against the website, the home page fetched and still on that domain, at least 40 characters of text, the model's yes, and its quote found on the page | none | `server/utils/companyCheck.ts:177-201` |
| 3. Approval | An email, "Your company is approved to see jobs on Blueprint", with a link that works for that address for 7 days. Anything the rule does not settle waits for the owner's one press, promised within three working days | `https://tryblueprint.io/signup/business?invitation=…`; the owner's page is `/admin/robot-team-access` | `server/utils/robotTeamAccessEmails.ts:38-53`; `client/src/app/routes.tsx:310`; `server/routes/admin-robot-team-access.ts:61` |
| 4. Account and Terms | Tick "I agree to the Terms and Privacy Policy" (now `2026-11-25.2`) and press Create account; no password is needed (first-run log, 13:23Z row). One email follows if jobs were already open | https://tryblueprint.io/contact/robot-team (Find jobs) | `server/routes/robot-team-access.ts:204-218` |
| 5. Find jobs | The open jobs, or "No jobs yet. New jobs appear here when their video is ready." | https://tryblueprint.io/contact/robot-team | `client/src/components/site/TaskBrowse.tsx:109-112` |
| 6. Later sign-in | "Email me a sign-in link": 15 minutes, one use. On the branch (fix 3), opening the link spends nothing; the press of "Sign in with this link" does | https://tryblueprint.io/sign-in | `client/src/pages/Login.tsx:237`; `server/utils/companySignInLink.ts:4-8` |
| 7. First job | An email, "New job on Blueprint", for each new job, with a one-use link that lasts 7 days. It can be turned off in Settings | `https://tryblueprint.io/jobs/<id>` | `server/utils/robotTeamAccessEmails.ts:157-161`; `server/utils/request-review-auth.ts:92`; `server/utils/jobAutoSend.ts:1-15` |
| 8. The job page | The site's sentence, the video without sound, its answers, the city, state and country, and the simulation to download once it is ready. The first look is not shown | `https://tryblueprint.io/jobs/<id>` | `client/src/pages/CompanyJob.tsx:33-37`; `client/src/pages/Privacy.tsx:54`; `PLATFORM_CONTEXT.md:82-84` |
| 9. First answer | Apply, Not a fit or Need more details, with a note. The site is emailed | the same page | `client/src/lib/companyResponses.ts:158-161`; `server/routes/site-worlds.ts:83` |
| 10. Introduction | If the site presses Accept: an email, "A site accepted your application", with the site's details. The introduction is recorded as a billable event with no price | by email | `server/utils/robotTeamAccessEmails.ts:231-243`; `server/utils/billableEvents.ts:1-6` |
| 11. Follow-ups | At 14, 45 and 90 days, one email with five answers as links. The linked page records nothing until one press | `https://tryblueprint.io/api/job-outcomes/<token>` | `server/utils/jobOutcomeGate.ts:26`; `server/utils/jobOutcomes.ts:69-91`; `server/routes/job-outcomes.ts:51,66` |

How long each step takes for a real company is unknown: no real company has
applied. In the first run the owner's press came 3 min 49 s after the test
application (first-run log, 13:17Z and 13:21Z rows).

Never run in production on 2026-11-26: the automatic rule, the emailed sign-in
link, "Need more details" and an outcome answer (C1: `rule_check_days 0`,
`sign_in_links_used 0`, `jobClarifications 0`,
`introductions_with_an_outcome_answer 0`). At 03:53Z on 11-27: the rule had
run once and its model answered "no" (`rule_check_days 1`, `rule_model_runs
1`, gate check S4); the emailed sign-in link had been redeemed twice; one
introduction had an outcome answer; "Need more details" still never
(`jobClarifications 0`). Who made these was not read. No reminder to the owner
has been recorded (`opsAccessApplicationReminders` 0), and no decline email
has ever been sent, though the code holds one. The company path was proved
locally on 2026-11-27 on the branch (fixes 1, 2, 3 and 14, with the Firebase
emulators and Playwright); the live proofs that remain need a test record
and the owner's word: the trial's model call, the owner's email in a real
inbox, the press on a sign-in link through a provider that scans links, and
the new-job link in the production build.

### Follow-up cadence

| What | When | Who | Proof |
| --- | --- | --- | --- |
| Outreach follow-up | Once, 5 working days after the first message; then stop | Whoever the go-ahead names | This playbook |
| Answer to an application the rule did not settle | Within 3 working days | The owner, one press | `client/src/components/site/PartnerApplication.tsx:9-10` |
| Reminder to the owner | Once, after 3 working days without a decision, by Slack and by one email to `CONTACT_TO` (fix 2, on the branch; Slack only on the live code) | The system | `server/utils/accessApplicationReminder.ts:1-9` |
| Re-check of an unchecked application | After 10 minutes; a momentary failure, the next day | The system | `server/utils/companyCheck.ts:215-220,280-291`; `server/utils/betaOpsMonitor.ts:414` |
| New-job email | When each job is first listed | The system | `server/utils/jobAutoSend.ts:1-15` |
| What happened? | 14, 45 and 90 days after an introduction, to both sides | The system | `server/utils/jobOutcomeGate.ts:26` |
| Approved company with no job to see | No message. Do not write again until a job is listed; the system emails it then | nobody | `server/utils/jobAutoSend.ts:11-12` |

### Where each contact is tracked

Until 2026-11-27 nothing existed. `robotTeams` had no contacted, reply or
outcome field (`server/types/robot-team-registry.ts:134-194` at `e439731`). The
old outreach collections (`cityLaunchTouches` 37, `cityLaunchSendActions` 12,
`outboundProspects` 4) are from April to October and no code reads them
(`git grep` over `server`, `client/src` and `scripts`: 0 files each).

**For companies, the outreach log on the research record (fix 8, on the
branch).** The staff page `/admin/outreach` lists every `robotTeams` record
with its log and a form. Each record holds: contacted on, channel, message
version, the go-ahead entry's date, the answer (no reply yet, replied,
applied, not interested, asked us to stop), next step and its date, and do
not contact with its date (`server/types/robot-team-registry.ts`,
`server/utils/robotTeamOutreach.ts`; routes in
`server/routes/admin-robot-teams.ts`, admin only). Every change names the
operator and is kept in the record's `outreachEvents`. "Asked us to stop"
sets do not contact, and do not contact cannot be removed. A contact with no
go-ahead date or message version is flagged, never refused. The log never
leaves the admin routes: registry reads drop it, so no match, site page,
company page or public response carries it, and it never changes a record's
status. Recording a contact is not a relationship
(`server/data/robotTeamSeed.ts:6-9`). C1 `outreach_log` counts it. Until the
branch is live, keep the table below.

**For sites, and until fix 8 is live: one table**, one row per contact, kept
where the owner already works (Notion is in the stack, `AGENTS.md:111`).
Columns: record id (the `robotTeams` id, or the site's job id), kind (company
or site), date sent, channel, message version, the go-ahead entry's date,
answer, next step and date, do not contact, and the opt-out date. Fill the
row before the message is sent. A reply asking to stop is honoured within 10
business days and is never removed (FTC CAN-SPAM guide, risk 17).

## 3. Site outreach

Sending email by hand to a site also needs the owner's word (`AGENTS.md:99`).
The batch note and the go-ahead work as in section 2.

### Selection

Where sites come from is unknown: no current channel exists. What the repos
hold:

- Daily research's site list, last run 2026-10-12 (Firestore
  `blueprintDailyResearch/sites-first/runs`: 8 documents, 6 completed). 20
  candidate rows across 6 run outputs: 0 qualified, 4 `needs_review`, 16
  `unqualified`, 18 in the US. None has a contact field. Its "outreach ready"
  tier is "a hypothesis label for drafting, never verification or send
  authority" (Pipeline `tools/daily_research/verification.py:7-8`), and its
  outreach direction expired 2026-10-17. Its paid allowance ($10 per run, to
  2027-01-03) is still in force, so a restart spends money (2026-11-27
  targets report).
- 21 existing site jobs with a video under an older statement (C1
  `site_jobs_by_state`: 42 `older_statement`, 21 with an upload session: 19
  on statement 2026-09-18.v1, 2 on 2026-11-02.v2). 9 belong to an admin and
  ops account (internal); at most 12 could be real sites, which is unknown
  without decrypting their details. None has a company clip or a simulation,
  so none would be listed before its clip is ready, even after the site agrees
  (`server/utils/teamJobAccess.ts:219`). Their page already offers "Agree and
  send my job" (`client/src/components/site/SiteAnswer.tsx:63-65`). Writing to
  them is owner decision 8.
- The doctrine's fallback: offer the video intake to deployment companies for
  their own leads (`PLATFORM_CONTEXT.md:150-152`). 0 companies may see jobs
  today, so none can carry it yet. The site intake records no referrer
  (`client/src/components/site/SiteCaptureStart.tsx` has no referral field), so
  a job a company brings is shown to every approved company. Tell the company
  so.

Criteria for the first sites:

| # | Criterion | Why | Proof |
| --- | --- | --- | --- |
| 1 | The site is in the United States | Videos are taken only from US sites | `client/src/pages/Beta.tsx:25`; `server/utils/captureDispatch.ts:126-127` |
| 2 | One recurring job that moves one rigid object from one surface to another | The captured-object route is the one on record as having run live. Only 2 of 8 test packages hold an object and a success rule; the other 6 are the room only. The 2 are internal test jobs: one labelled `move-the-lamp-2` (moving one object), one labelled `proof-2026-11-15` (kind not stated) | Pipeline `docs/test-footage/clip-mix-v1.json:354`; `captureUploadSessions` and `inboundRequests`, read 2026-11-26 |
| 3 | A small or medium room, good light | Large rooms, dim footage and tours over 5 minutes are untried on a real job | Pipeline `docs/test-footage/clip-mix-v1.json:130-200` |
| 4 | Someone who works there can film on their own phone | Nobody else films for a site | `PLATFORM_CONTEXT.md:174-178` |
| 5 | The site may film and share the place, and can keep faces, screens and paperwork out of shot | Footage is not blurred | `PLATFORM_CONTEXT.md:190-193` |
| 6 | The site accepts that companies are told its city and state | Statement v6 shares them | `client/src/lib/siteStartConsent.ts:42-44` |

No job is refused by its kind (`PLATFORM_CONTEXT.md:167-168`). The criteria
choose whom to invite first; a site that sends another kind of job is served
as far as the job goes, and its page says where it stands.

### DRAFT: first message to a site

Send it only when C1 `companies_that_may_see_jobs` is 1 or more, unless the
owner decided otherwise (owner decision 2). In that case keep the state line.

> Subject: One phone video of a job you do every day
>
> Hello [FIRST NAME],
>
> I work on Blueprint. I am writing because [REASON THIS SITE WAS CHOSEN, IN
> ONE PLAIN SENTENCE].
>
> Blueprint helps a site find out which robot deployment companies would take
> one of its recurring jobs. It is free for sites.
>
> 1. Someone who works at your site films one full round of the job on a
>    phone and writes one sentence about it.
> 2. We turn the video into a job packet: your description, the video with
>    its sound removed, a first look at which kinds of robot could fit, and a
>    simulation of your site when it is ready. The first look stays with you;
>    companies do not see it.
> 3. We share the job with the deployment companies we have approved. Each
>    can answer Apply, Not a fit or Need more details. Any response appears
>    on your job page, and you choose which companies to meet.
>
> What you should know first:
>
> - We can't promise that any company will answer, or say yes. [STATE LINE,
>   always, with the day's number from C1 `companies_that_may_see_jobs`. If
>   it is 0: "No deployment company is approved yet. Your job page will say
>   so until one is." Otherwise: "Today [N] deployment compan[y is / ies
>   are] approved."]
> - The first look and the simulation are estimates. They do not certify that
>   a robot can do the job or that it is safe. Blueprint runs no robot
>   software in the simulation.
> - Companies see your city and state. Your name, address and contact details
>   go to a company only if you press Accept beside it.
> - You can withdraw the job from its page at any time. It then leaves every
>   company's view. A copy a company already saved cannot be taken back; we
>   ask the company to delete it.
> - We take videos only from sites in the United States.
>
> If you are interested, reply and I will send the link and a short note on
> what to film. If you would rather not hear from us again, reply and say so,
> and I will not write again.
>
> [SENDER FIRST NAME], Blueprint
>
> [LEGAL BUSINESS NAME], [VALID POSTAL ADDRESS: street, USPS box or
> registered private mailbox]. [THE OWNER'S WORDING THAT THIS MESSAGE IS AN
> ADVERTISEMENT]. To stop all messages from us, reply "stop".

Proof: free for sites (`client/src/lib/publicCopy.ts:35`); the three steps
(`client/src/lib/publicCopy.ts:67-69`); no promise of a yes, and Accept
(`client/src/pages/Beta.tsx:33-34`); estimates and no certification
(`client/src/pages/Beta.tsx:29-30`; `client/src/pages/Terms.tsx:37,40`); city
and state, and contact details (`client/src/pages/Privacy.tsx:54`;
`client/src/pages/Terms.tsx:10`); withdrawal (`client/src/pages/Terms.tsx:12`).

### DRAFT: follow-up to a site

Send once, five working days later, only if there was no reply.

> Subject: Re: One phone video of a job you do every day
>
> Hello [FIRST NAME],
>
> I wrote on [DATE]. In one line: you film one round of a recurring job on a
> phone, and we show the job to robot deployment companies we have approved
> and show you any response. It is free for sites, and we can't promise that
> any company will answer, or say yes. [STATE LINE, as in the first message.]
>
> If you would like the link and the filming note, reply to this message.
> This is my last message unless you reply. If you would rather not hear from
> us again, reply and say so.
>
> [SENDER FIRST NAME], Blueprint
>
> [LEGAL BUSINESS NAME], [VALID POSTAL ADDRESS: street, USPS box or
> registered private mailbox]. [THE OWNER'S WORDING THAT THIS MESSAGE IS AN
> ADVERTISEMENT]. To stop all messages from us, reply "stop".

### DRAFT: what to send once the site says yes

> Subject: Your link, and what to film
>
> Hello [FIRST NAME],
>
> Thank you. Here is everything you need.
>
> **Start here:** https://tryblueprint.io/contact/site-operator
> [IF THE ALLOWLIST IS SET: "Please use this email address on the form:
> [THE ADDRESS WE INVITED]. The form takes jobs from invited addresses
> only."]
>
> The form asks for the job in one sentence, where the job is, your email and
> the video. Pick the place from the suggestions as you type.
>
> **What to film**
>
> [THE NINE INSTRUCTIONS FROM "WHAT TO FILM" BELOW, AS A LIST.]
>
> **What you agree to when you press Send video**
>
> You confirm you are allowed to film and share the site. We share your job
> with the robot deployment companies we have approved: your description,
> the video without its sound, the simulation, what counts as the job done,
> and your city and state. There is no separate share setting. Your name,
> address and contact details are not shared unless you press Accept beside a
> company. The full text is at https://tryblueprint.io/terms and
> https://tryblueprint.io/privacy.
>
> **What happens next**
>
> - You get an email with a private link to your job page soon after you
>   send the video. Please don't forward that link.
> - We add a first look to your job page when we have enough detail from the
>   video.
> - Approved companies can see your job once its sound-free video is ready.
>   In our two most recent test runs that took about 50 minutes. [STATE
>   LINE, as in the first message.]
> - The simulation of your site takes longer: from several hours to several
>   days. So far most have been the room without the job's object in it (7
>   of the 9 built, all in our own test runs).
> - If a company answers, its response appears on your job page and we email
>   you. We can't promise that any company will answer, or say yes.
> - If you press Accept beside a company, we email you both each other's
>   details. We then ask you both what happened, 14, 45 and 90 days later.
>
> **How to stop**
>
> Open your job page and press "Stop using my video". Your job leaves every
> company's view, and we ask each company it was sent to to delete any copy
> it saved. We cannot take back a copy a company has already saved. We keep
> a copy of the video and any results already made, as our Privacy Policy
> describes.
>
> [SENDER FIRST NAME], Blueprint

### What to film

Send the left column as it stands. The right column is why.

| Instruction to the site | Ground |
| --- | --- |
| Use a phone. Send a .mov or .mp4 file, under 1 GB if you can. | Other formats are refused. Over 2 GiB is refused when the file is chosen (`client/src/lib/captureVideoLimit.ts`, on the branch; the route answers 413 `video_too_large`). By default frames are read only from videos up to 1,000,000,000 bytes (`server/utils/websiteLargeVideoBlock.ts:4-7`); the deployed value is unread |
| Film one full round of the job, from start to finish, in one shot. | The start form's own words, "One full round of the job." (`client/src/components/site/SiteCaptureStart.tsx:887`); the one end-to-end job was one continuous shot (first-run log, "Footage") |
| Hold the phone sideways if you can. | That job was filmed sideways (1920x1080). An upright phone video was read upright in a $0 check; the rest of the chain has not seen one (Pipeline `docs/test-footage/clip-mix-v1.json:63-85`) |
| Walk slowly in a half circle around where the job happens, and keep it in view. | `client/src/lib/footageNotice.ts:31`. The one end-to-end job was seen from one side, got no measured scale and shipped without its object (first-run log, "The simulation package") |
| Keep the object the job moves in view the whole time. | In that job, 3 objects were taken out of the room scan and are not in the package (first-run log, "The simulation package") |
| Use good light and a steady hand. Keep it under five minutes. | Over 300 seconds the video analysis takes another path, and the result for dim footage is unknown (Pipeline `docs/test-footage/clip-mix-v1.json:154-200`) |
| Tell people nearby that the video goes to Blueprint and to deployment companies we approve. Avoid conversations: we remove the sound. | `client/src/lib/footageNotice.ts:11-12` |
| Keep faces, screens and paperwork out of the shot. We do not blur the video. | `PLATFORM_CONTEXT.md:190-193` |
| Film only where you are allowed to film and share. | The statement the site accepts (`client/src/lib/siteStartConsent.ts:42-44`) |

On the form, the site should pick its place from the suggestions: a typed
place stores the state only, a picked one the city and state (first-run log,
gap 1).

### What the site gets, and when

Only what is true today.

| What | When | Evidence |
| --- | --- | --- |
| A private job page and an email with its link | 2 min 24 s after Send, in the one run timed | first-run log, 15:23:44Z row; page route `client/src/app/routes.tsx:216` |
| The upload itself | 12 s for a 77 MB file, in that run | first-run log, 15:21:32Z row |
| The first look, on the job page | About 1.5 minutes for a reading, since the fix for videos over 64 MB. On a real site's job: unknown | first-run log, 19:39:03Z row; `server/agents/adapters/gemini-video.ts:57-64` |
| The job in front of approved companies | 50 minutes after Send on the two jobs timed since 2026-11-23. Earlier test jobs: 7 minutes to 21 hours. Today no company can see it at all (gate check S3) | first-run log, 16:11:48Z row; stored clip times less creation times in `captureUploadSessions`, read 2026-11-26 |
| The simulation of the site | 10 h 33 min on the first-run job, part of it waiting for a fix. Test jobs: 19 hours to 7 days (upper bounds). 6 of 8 test packages are the room without the job's object, and so is the first-run job's: 7 of the 9 built. The site's page says which kind it got (fix 6, on the branch) | first-run log, 01:54:34Z row; stored package times in `captureUploadSessions`, read 2026-11-26 |
| The job's object and the success rule | 0 real jobs. 2 test jobs, at 3 and 6.6 days (upper bounds) | `captureUploadSessions` and `inboundRequests`, read 2026-11-26 |
| Paid work on the job | Stops 7 days after it starts; the job stays posted | Pipeline `src/blueprint_pipeline/website_job_window.py:21`; `server/utils/teamJobAccess.ts:196-200` |
| Responses | unknown. None is promised. No real company has ever answered | C1 `answers_by_state` (2, both from test runs) |
| An introduction | About 13 s after the site pressed Accept, in the first run; 58 s on the internal test job of 2026-11-25 | first-run log, 18:00:15Z and 18:00:28Z rows; `billableEvents` `atIso` and `madeAtIso` |
| Questions about what happened | 14, 45 and 90 days after an introduction | `server/utils/jobOutcomeGate.ts:26` |
| The cost to the site | Nothing | `client/src/lib/publicCopy.ts:35` |

On the branch, the site's page says when the simulation is the room without
the job's object: "It shows your room without the job's object in it, so it
does not check what counts as done." (`client/src/lib/simulationContents.ts`,
fix 6). It decides from `object_included` or the package's files, as the
company's page now does too. A delivered simulation stays "ready" after the
job's time runs out (fix 22). On the live code the page still reads only "The
simulation of your site is ready." (`client/src/lib/jobOutlook.ts:28`): until
the branch is live, tell the site by hand.

### Consent and withdrawal in plain words

**What the site agrees to, once, by pressing Send video** (statement
`2026-11-23.v6`, `client/src/lib/siteStartConsent.ts:42-44`; Terms and Privacy
Policy `2026-11-25.2`):

- It is allowed to film and share the site.
- Blueprint shares the job with every deployment company it approves: the
  description, the video without its sound, the simulation, what counts as
  done (`client/src/pages/Terms.tsx:9`), and the city and state
  (`client/src/pages/Privacy.tsx:54`). There is no
  share button, no setting and no pause (`PLATFORM_CONTEXT.md:120-121`).
- The first look stays with the site (`PLATFORM_CONTEXT.md:82-84`).
- Companies may use the job only to decide whether they can do it. They may
  not pass it on or train on it (`client/src/pages/Terms.tsx:11`).
- A draft saved with no video records `2026-11-11.v3`, which has no sharing
  line (`client/src/components/site/SiteCaptureStart.tsx:522-523`). It is not
  shared until its video is sent under v6.

**What is not shared:** the site's name, street address and contact details.
They go to one company only when the site presses Accept beside it
(`client/src/lib/siteIntroductions.ts:11`). For a job from the start form the
company gets the site's email and the place it gave
(`client/src/lib/siteIntroductions.ts:23`; `server/utils/jobIntroductions.ts:113-116`).

**What withdrawal does:**

- The job leaves every company's view at once (53 s in the one run; first-run
  log, 02:02:23Z row).
- New uploads stop, and Blueprint stops using the video.
- Every company the job was sent to or opened by is emailed and asked to
  delete any copy (`server/utils/withdrawalCompanyNotice.ts:25-32`).
- The website deletes its own stored copy. For the one withdrawal on record
  that took about 2 hours (C1 `website_deletion_receipts`; the receipt was
  requested at 02:01:30Z and completed at 04:02:14Z).

**What withdrawal does not do:**

- It cannot take back a copy a company already saved
  (`client/src/pages/Terms.tsx:12`).
- It does not delete Blueprint's copy at once: "We keep a copy of the video
  and any results already made"
  (`client/src/components/site/OwnerRecordingWithdrawal.tsx:47-49`). The host
  is meant to delete later, under the owner's standing approval with a 72-hour
  cool-off (Pipeline `config/website_withdrawal_deletion_standing_approval.v1.json`).
  **No deletion has ever completed on the host, and the first one is blocked
  until a fix lands** (gate check P3, fix 20).
- It does not reopen the job. Posting again needs a new job
  (`client/src/components/site/OwnerRecordingWithdrawal.tsx:143-144`).
- Whether it recalls details already given in an introduction: nothing says
  so. Assume it does not (inferred).

Never tell a site that a withdrawal deletes everything at once.

## 4. Wave plan

### Wave 0: companies first

Companies go first so that a site's job is never posted to nobody. Today no
company can see a job (gate check S3), and a site would read "Your job is
ready for deployment companies, but no approved company can see it yet."
(`client/src/components/site/SiteAnswer.tsx:58`).

- **Size: at most 15 companies a batch, and only those that pass the day's
  reading.** On 2026-11-27 that was 4 of the 18 (section 2). 12 more meet
  criteria 4 to 7 but have no researched address. Widening the pool means
  finding an address for them, or for the other prospects that have none: by
  hand, or with the paid lookup, which is a money decision for the owner.
- Arithmetic: each listed job emails every approved company once
  (`server/utils/jobAutoSend.ts:5-7`). With 15 companies, a day with 3 new
  jobs is 45 emails. Add 2 for each introduction and about 2 for each new
  site (`docs/runbooks/resend-email.md:103-104`), and the day stays under the
  free plan's 100 (`docs/runbooks/resend-email.md:101-102`, unconfirmed).
- The rule's caps do not bind: 100 checks a day and 5 per email domain
  (`server/utils/companyCheck.ts:33,38`).
- The owner's time binds if the rule cannot run (gate check S4): every
  applicant then waits for one press, promised within three working days.
- Wave 0 spends no job money. Each rule check is one small model call.
- The message must carry the true state line. Today that is "No job is open
  today. Once approved, you get an email when one is posted."

### Wave 1: sites

- **Size: 2 sites, or 3 if the reading on 12-01 allows it. No site wave
  before December unless the owner raises November's limit.**
- November (C2 at 00:08Z on 11-27): $400 − $350.88 = $49.12 of headroom.
  Fixed spend so far is $221 (`fixed_so_far`: the host, Google Cloud, and
  OpenAI not tied to a job) over 26.0 days (`measured_days`), about $8.50 a
  day (inferred,
  linear). Over the 4.0 days left that is about $34, so about $15 is left
  for jobs: 0 jobs at $16.20 and 0 at $40. The guard's own forecast agrees: the month reaches its
  limit on 11-30 with no new job.
- December at $300 (Pipeline `config/account_monthly_spend_limit.v1.json:3`):
  fixed spend of $221 to $264 leaves $36 to $79 for jobs. At $16.20 a job
  that is 2 to 4 jobs. At the $40 cap it is 0 to 1.
- $16.20 is the costliest of the ten jobs with a ledger since 2026-11-15 on
  the website's ledger
  (`inboundRequests/<job>.website_preparation_reservations`, settled: $2.02
  to $16.20; nine of the ten settled at $7.44 or more). $40 is the most one
  job can spend.
- If the month's money runs out mid-wave, nothing is overspent: the host
  refuses new paid work at the limit (Pipeline `AGENTS.md:89`), and the job
  keeps its video and what it has. No job has yet gone out that way, so how
  it looks to the site is unknown.
- Start no more than 5 jobs on one UTC day (gate check M4). The sixth site
  reads "We have reached today's limit for new jobs."
  (`server/utils/betaAbuseCaps.ts:110`).
- The host prepares one job at a time (Pipeline
  `deploy/systemd/blueprint-pubsub-handoff-listener.service:51`). The one job
  timed had its sound-free video 48 min 28 s after hand-off (first-run log,
  16:11:19Z row). How long it held the listener is unknown. Ask sites to send
  on different days if you can.
- Later site waves: size = (limit − counted − fixed spend to the month's end)
  ÷ $16.20, rounded down, and never more than 5 a day.

### Go or no-go between waves

Each condition is read from the commands in section 1.

**Before wave 0 (and before each further company batch):**

| Condition | Read from | Kind |
| --- | --- | --- |
| The owner said yes to this batch | The dated tracker entry | Rule |
| No company in the batch is marked do not contact, and none asked to stop | `/admin/outreach` (on the branch) or the contact table; C1 `outreach_log` | Rule: an opt-out is honoured |
| No application has waited more than 3 working days | C1 `applications_waiting` | Flag: write it in the batch note |
| The state line in the message is today's | C1 `listed_for_companies` | Correct the line before sending |
| Flags S3, S4, S5 and S6 that do not pass are written in the batch note | Section 1 | Flag |

**Before wave 1 (and before each further site wave):**

| Condition | Read from | Kind |
| --- | --- | --- |
| The owner said yes to this batch | The dated tracker entry | Rule |
| P1 to P5 pass. For P3: `approval valid`, `failing` and `overdue` both absent, and the first deletion receipt has been read: C6 check 1 (from 2026-11-27 17:50Z) shows the plan `planned` with 0 unresolved rows, and C6 check 2 (from 2026-11-28 03:45Z) shows one receipt, `complete` or `complete_provider_retention_remains`, under `standing_owner_approval` | C1, C2, C6 | Hard stop |
| R1 to R4 pass | C1, C3, C5 | Hard stop |
| M1, M3 and M4 pass; M5 is known; the wave is cut to the size M2 allows | C2, C5 | Hard stop |
| At least one real company can see jobs | C1 `companies_that_may_see_jobs` ≥ 1 | Order of the plan. The owner may decide otherwise (decision 2); the message then keeps its state line |
| The previous site wave has settled: `held` is back to what it was before the wave, and no job passed $40 | C2 `money`, `highest_job_usd` | Hard stop |
| Every job of the previous wave that has a video is `LISTED`, withdrawn or closed by its site | C1 `site_jobs_by_state` | Flag |
| No withdrawal is failing or overdue | C2 `withdrawal` | Hard stop |

Responses are not a condition. A wave with no response is a result to record,
not a reason to stop: no response is promised (`PLATFORM_CONTEXT.md:95-96`).

## 5. What to measure

Read these after each wave and weekly while a wave is open. The owner's page
`/admin/jobs` shows one line of the same totals for site jobs
(`server/utils/ownerTotals.ts:1-16`; fields at `client/src/types/jobConsole.ts:30-43`).

| Measure | Read from | 2026-11-26 |
| --- | --- | --- |
| Applications | C1 `applications`, `applications_waiting` (`robotTeamAccess`) | 3 records, all test: 1 approved internal test company, 2 declined. Real applications: 0 |
| Approvals | C1 `companies_that_may_see_jobs`, `approved_by_rule`, `rule_checked` | 0 companies can see jobs; 0 approved by the rule; 0 checked by it |
| Why the rule passed a company to the owner | C1 `applications_waiting` (`companyCheck.reasons`) | none yet |
| Jobs sent | C1 `listed_for_companies`, `companySends`, `companyJobViews`; `curl -s https://tryblueprint.io/api/public/live-jobs` | 0 of 62 non-test site jobs listed; 2 send rows, both from test runs; 0 views; `{"jobs":[]}` |
| Responses | C1 `robotTeamInterest`, `answers_by_state`, `jobClarifications` | 2, both `interested`, both from test runs; 0 "Need more details" |
| Introductions | C1 `introductions`, `billable_events` | 2, both from test runs. Billable events: 1 `void`, 1 `test_no_charge`, both `priceUsd=null`; 0 that count |
| Outcome answers | C1 `introductions_with_an_outcome_answer`; outbox kind `job_outcome_question` | 0 answers; 2 questions sent, to the internal test pair |
| Cost per job | C2 `highest_job_usd` and the host's per-job meter (`spend_guard.account_monthly_spend.jobs[]`); the website's ledger `inboundRequests/<job>.website_preparation_reservations` | Website ledger, ten jobs since 2026-11-15: $2.02 to $16.20. The first-run job: $9.81 on the host, $9.79 on the website; the 2 cents are unexplained. Highest on the host's meter this month: $26.63, an older job |
| Month's money | C2 `money`, `forecast` | $350.88 of $400; $49.12 headroom (00:08Z on 11-27); the forecast reaches the limit on 11-30 |
| Email | C1 `outbox`; C3 `health/outbox` | 145 sent, 10 failed, 1 cancelled; `moving` |
| Withdrawals | C1 `withdrawals`, `website_deletion_receipts`; C2 `withdrawal` | 1, acknowledged; website copy deleted; host deletion not applied |
| Outreach itself: sent, replied, applied, said no | `/admin/outreach` and C1 `outreach_log` (on the branch), or the contact table (section 2) | Nothing sent |

**C1 read again at 03:53Z on 11-27** (counts only; who made the changes was
not read): applications 4 (1 approved, 2 declined, 1 waiting for 0 days with
`not_a_robot_company`); `rule_check_days 1`, `rule_model_runs 1`;
`companies_that_may_see_jobs 0`; `sign_in_links_used 2`; 0 of 62 site jobs
listed; `companySends 4`, `companyJobViews 0`, `robotTeamInterest 3`
(`interested` 2, `needs_something` 1), `jobClarifications 0`, `introductions
2`, 1 with an outcome answer; billable events unchanged (1 `void`, 1
`test_no_charge`, both `priceUsd=null`); outbox 153 sent, 10 failed, 1
cancelled; 1 account deletion request, `requested`, 38 whole days; 4 open
alerts; no job started that day; the outreach log empty.

Two rates to compute once numbers exist: applications ÷ companies contacted,
and jobs listed ÷ sites that said yes. A number said outside Blueprint must be
that day's reading, never an estimate (`PLATFORM_CONTEXT.md:206-208`). The
drafts say none.

## 6. Risks and what we do about each

| # | Risk | What we do |
| --- | --- | --- |
| 1 | A site's job is posted to nobody (0 companies can see jobs) | Wave 0 goes first. The site's page already says so (`client/src/components/site/SiteAnswer.tsx:58`). If the owner invites sites first, the message keeps its state line |
| 2 | An approved company finds nothing to see | The first message says "No job is open today." Find jobs says "No jobs yet." (`client/src/components/site/TaskBrowse.tsx:111-112`). Write to no approved company again until a job is listed |
| 3 | The rule cannot run, so "at once" is false for every applicant | Use the three-working-days rule line until S4 passes; one press of "Run the rule" settles S4. S4 passed at 03:53Z on 11-27 (the live rule's model answered once), but no check has yet approved a company. Fix 1 done on the branch (b29e42dd7) |
| 4 | The owner never hears that an application waits: on the live code the bell and the reminder are Slack only (`server/utils/slack.ts:96-100`); on the branch each is also emailed once to `CONTACT_TO` | Fixed on the branch by 57326da1e. Confirm `CONTACT_TO` on Render names the owner's inbox before wave 0. Until the branch is live, the owner opens `/admin/robot-team-access` daily while a batch is out |
| 5 | A mail scanner spends a one-use sign-in link before the person clicks (inferred; the live page redeems the link on load, `client/src/pages/Login.tsx:71-82` at `e439731`) | Fixed on the branch by 99314af0f: the sign-in page and the job page redeem a link only on the company's press (`e2e/outreach-company-links.spec.ts` tests 4 and 5). Until it is live, a company that reports a dead link asks for a new one at `/sign-in` |
| 6 | A real company's website fails the plain steps: a parent-company email domain, a redirect to another domain, a page built by scripts | It goes to the owner with its reason (`server/utils/companyCheck.ts:178-190`). Read the reason counts after the batch; decision 17 |
| 7 | The month's money runs out during a site wave | Size the wave by M2. The limit is enforced in code. Owner decision 3 |
| 8 | The true headroom is unknown (World Labs partial, $18 held with no job) | Treat the headroom as smaller by the open amounts. Fix 9 |
| 9 | A withdrawal's deletion never completes on the host | P3 is a hard stop for a site wave. First the plan must have no unresolved rows. Today 144 offloaded runs that name no site block it (2026-11-27 privacy report; fix 20). Then read the first receipt (C6 check 2). Without `BLUEPRINT_WEBSITE_WITHDRAWAL_SOURCE_BUCKET` it reads `incomplete`, and the pass applies again every 6 hours without finishing (proved offline). The door cannot read the environment file (`secret_name_refused`). The owner sets the variable after confirming that the unit can authenticate to Google Cloud Storage. The overdue alert posts 2026-12-16 02:25Z, and the 30-day promise ends 2026-12-25 02:25Z |
| 10 | A site expects a full simulation and gets the room only (7 of the 9 packages built so far) | The yes-message says so, and on the branch the site's page says it for each job (fix 6, done in 5afd7589f). Tell the site by hand until it is live |
| 11 | A site expects minutes and waits hours or days | The yes-message gives the times observed. Time every wave-1 job and replace the numbers in section 3 |
| 12 | The email plan's daily cap is reached and customer email backs off | Keep to the wave sizes. Watch `health/outbox`. Owner decision 15 |
| 13 | A stale document is sent to a site | Fix 5 is done on the branch (df457eff4): the site guide and the beta README describe today's service. The guide may be sent with the yes-message once the branch is on main |
| 14 | The same company is written to twice, or after it said stop | Record each contact before sending, in `/admin/outreach` (fix 8, on the branch) or the contact table. Check "do not contact" for every batch; once set it cannot be removed |
| 15 | Outreach copy drifts from what is true | Use the drafts as written. A changed sentence needs a new yes and its proof beside it |
| 16 | The research list is stale and mostly inferred | Read each home page on the day. Quote only the company's own page |
| 17 | Unsolicited business email breaks US rules. The FTC's "CAN-SPAM Act: A Compliance Guide for Business" (https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business, read 2026-11-27; a summary, not legal advice) says: "The law makes no exception for business-to-business email"; the header must identify who sent it; "the subject line must accurately reflect the content"; the message must say it is an advertisement; "Your message must include your valid physical postal address" (a street address, a USPS box or a registered private mailbox); it must explain clearly how to opt out, and an opt-out must work for at least 30 days after sending and be honoured "within 10 business days"; no fee or extra information to opt out, and an opted-out address is never sold or passed on; the sender stays responsible if someone else sends; "each separate email in violation" can cost up to $53,088 | Drafts 1, 2, 4 and 5 now carry a footer with placeholders for the legal business name, a postal address and the advertisement notice, and a plain opt-out; draft 1's subject no longer suggests jobs exist when none is open. The owner fills the placeholders (never a made-up address) and chooses the notice's wording. Drafts 3 and 6 answer the recipient's own question or request; the guide reads that category narrowly, so keeping the footer there is the safe reading (the owner decides). The follow-ups' "Re:" on a message never answered may read as a reply: the guide does not name it; drop it if in doubt. Replies are read for 30 days after each send and an opt-out is recorded at once (`/admin/outreach` or the contact table). The owner may still ask counsel (decision 1) |
| 18 | A site is refused at the door: the sixth job of a day, or an address not on the allowlist | At most 5 starts a day. Settle M5 and tell the site which address to use |
| 19 | The host is lost and its state with it (no complete backup is on record; the first run ended incomplete) | Flag S10. Read S10 again after Pipeline pull request 3764 is live, then run a restore drill (Pipeline `docs/runbooks/beta-operations.md`, "Control-plane state backup and host rebuild") |
| 20 | Details given in an introduction cannot be recalled by a withdrawal (inferred) | Say only what section 3 says about withdrawal |
| 21 | A banned word or an old promise is copied from the repo: "integrator" in the live Terms (`client/src/pages/Terms.tsx:66`); "OEM" and "vendor" in `client/src/data/deploymentMarket.ts` | Copy sentences only from the drafts here. Owner decision 10 |
| 22 | A figure is quoted without its source | The drafts use none. If one is wanted, use only a `published` figure from `client/src/data/deploymentMarket.ts` with its source beside it, for example 542,000 industrial robots installed worldwide in 2024 and 34,200 in the United States (IFR World Robotics 2025, `client/src/data/deploymentMarket.ts:31-35,135-152`). Whether the source link still resolves is unknown |

## 7. Owner decisions

No decision here sets a price. Deployment companies will pay; how is not
decided (`PLATFORM_CONTEXT.md:70-73`).

| # | Decision, with the facts | Options | Recommendation |
| --- | --- | --- | --- |
| 1 | **Go-ahead for wave 0, and who sends.** 0 real companies are approved; the live rule has answered once, a "no" (gate check S4); 4 researched companies were ready on 2026-11-27 and 12 more need an address; the FTC's guidance on commercial email is summarised in risk 17, and nobody has given legal advice | (a) Approve a first batch of the 4 ready (and any of the 12 once an address is found) and send it yourself. (b) Approve it and name an operator to send. (c) Wait for companies to apply by themselves | (a), after decision 4, with the drafts' footer placeholders filled (risk 17), and a word from counsel if you want one |
| 2 | **Companies first, or sites first.** | (a) Companies first. (b) Sites first, each told that no company is approved yet. (c) Both at once | (a). It spends no job money, and November has none to spare |
| 3 | **December's account limit** (Pipeline `config/account_monthly_spend_limit.v1.json`). Google Cloud's month so far is almost all untied to any job ($73.25 at 00:08Z on 11-27), and so is $72.71 of OpenAI (C2 `fixed_so_far`) | (a) Keep $300: 2 to 4 jobs at $16.20 a job, 0 to 1 at the $40 cap. (b) Add a December override, as was done for November. (c) Cut fixed spend first | (c), then decide (b) from the 12-01 reading. Size any override by sites wanted × $40 |
| 4 | **The model key for the approval rule** (gate check S4) | (a) Confirm `OPENAI_API_KEY` on the Render web service now. (b) Accept that every applicant waits for your press, within three working days | (a). It makes the published sentence true |
| 5 | **How you are told an application waits** (gate check S5) | (a) Confirm the Slack webhook is set and watched. (b) The email is built on the branch (57326da1e); confirm `CONTACT_TO` names your inbox. (c) Open the approvals page daily | (b) once the branch is live; (a) optional; (c) until then |
| 6 | **The invitee allowlist** (`BLUEPRINT_INVITEE_ALLOWLIST`). If set, any other address is refused with a plain line (`server/utils/inviteeAllowlist.ts:38-41`); a malformed value refuses every job (`server/utils/inviteeAllowlist.ts:47-50`) | (a) Set it to the invited sites' addresses for wave 1. (b) Leave intake open | (a) for wave 1. Each job spends Blueprint's money and the month is tight |
| 7 | **The intake cap of 5 jobs a day** | (a) Keep it. (b) Raise it on Render (`BLUEPRINT_INTAKE_DAILY_LIMIT`) | (a). Money allows far fewer than 5 a day |
| 8 | **The 42 jobs under an older statement**, 21 of them with a video. Writing to them is email to outside people | (a) Email the 21 once, asking each site to open its job page and agree. (b) Leave them. (c) Close them | (b) until a company can see jobs, then (a) |
| 9 | **WebApp pull request 1424** (open; conflicts with main). It asked that every admission that checks a job's $40 cap also count the job's video readings. Main has done that since commit `a5132d4` of 2026-11-24 (`server/utils/websiteJobCeiling.ts:296-306`), under the owner's decision of 2026-11-20: video readings count on the job's cap, the first look and the brief reading do not (`server/utils/accountSpendOverhead.ts:6-11`). The figures in its test (readings holding $39.40, then a $0.61 preparation let through) were measured on the main of 2026-11-23. Whether its four tests pass on today's main has not been run | (a) Run its four tests on today's main and close it if they pass. (b) Rebase it if one fails | (a) |
| 10 | **The Terms sentence on fees, and its banned word** (`client/src/pages/Terms.tsx:66`). `VISION.md:75-77` says the sentence stands until you replace it. Agents may not edit the Terms (`client/src/AGENTS.md:36`) | (a) Keep it. (b) Publish a new Terms version that says "the deployment company contracts", and decide the fee sentence then | (b) for the word, in the next Terms version. Keep the fee sentence until how companies pay is decided |
| 11 | **Telling companies that each introduction is recorded, and that companies will pay.** The company Terms say only "Nothing is charged today." (`client/src/pages/Terms.tsx:76`). No public page says that deployment companies will pay; the doctrine does (`PLATFORM_CONTEXT.md:70-73`), and the first-message draft carries it | (a) Say nothing until a price is set, and keep "Deployment companies will pay" to the cost reply. (b) Keep that sentence in the first message, and add one with no price: "We record each introduction; nothing is charged today." | (b). Both are true, and a company should not learn either later |
| 12 | **The wording of statement v6.** It names the video, the simulation and the city and state, but not "without its sound" or the success rule; the Terms it points to cover both (`client/src/pages/Terms.tsx:9`). Only you change this wording (`PLATFORM_CONTEXT.md:132`) | (a) Keep v6. (b) Publish a v7 | (a) for wave 1 |
| 13 | **The retired RunPod key on the host** (gate check M6). A root step only you can take | (a) Delete it. (b) Remove RunPod from the guard's required providers | (a) |
| 14 | **The account deletion request, 37 days old** (gate check P4) | (a) Carry out runbook steps 1-8 (`docs/runbooks/account-data-deletion.md`): "Start privacy review" in /admin/jobs, then delete `users/{uid}` and the Auth user by hand, and keep the request as the completion record. (b) There is no "close" action in the app. Treating it as a test account still means deleting that account by hand. No reply can be delivered (reserved domain) | Decide this week. It blocks a site wave |
| 15 | **The email plan before a company wave** (gate check S11) | (a) Confirm the plan's real limits and stay on it. (b) Upgrade first | (a) while a batch is at most 15 companies and a wave at most 3 sites |
| 16 | **Telling a site that its simulation is the room only** | (a) Say it on the site's page (fix 6). (b) Keep the general "ready" line | (a). A page says only what is true (`PLATFORM_CONTEXT.md:206-208`). Implemented as (a) on the branch in 5afd7589f; revert it if (b) |
| 17 | **Parent-company and brand domains in the rule.** Widening it changes the published sentence | (a) Keep the rule strict; you decide each case. (b) Widen it | (a) for wave 0. Decide again from the reason counts |
| 18 | **Refreshing the research list** | (a) Read each home page by hand for the batch, at no provider cost. (b) Resume paid research in December. (c) No refresh | (a) |
| 19 | **Where the contact table lives** | (a) A table in Notion now. (b) The outreach log on `robotTeams` (fix 8, built on the branch: `/admin/outreach`) | (b) for companies once the branch is live; (a) for sites, and for companies until then |

## 8. Fixes outreach needs first

S is under an hour, M is half a day, L is more than a day. None of these
belongs to the paused work.

**No fix here is a gate.** The hard stops of section 1 are cleared by owner
decisions and by data (decisions 3, 6 and 14, and the first deletion
receipt), not by these fixes. As the code stands, the first deletion receipt
cannot exist until fix 20 lands (gate check P3). "Do first" marks the fixes outreach most needs:
the wave goes better with them. A batch the owner approved does not wait for
one. If a fix is not done, its limitation goes in the batch note and the last
column says what we do instead (`AGENTS.md:93-96`).

| # | Fix | File | Size | Do first? | If it is not done |
| --- | --- | --- | --- | --- | --- |
| 1 | **Done on the branch: b29e42dd7.** An admin-only "Try the automatic rule" action on `/admin/robot-team-access` runs the rule once and records no application, approval or email (its own cap, 10 a day) | `server/routes/admin-robot-team-access.ts:131`, `server/utils/companyCheck.ts:262` (`tryCompanyRule`) | done | Yes, for wave 0, unless the owner confirms the key (decision 4) | Until the branch is live: flag S4 goes in the batch note if it does not pass. The message uses the three-working-days line and the owner decides each application by hand (risk 3) |
| 2 | **Done on the branch: 57326da1e.** An email to `CONTACT_TO` beside the new-application bell and the three-working-day reminder, once per application per notice | `server/utils/ownerApplicationNotice.ts`, `server/utils/accessApplicationReminder.ts` | done; no new variable, relies on `CONTACT_TO` | Yes, for wave 0, unless the Slack webhook is confirmed (decision 5) | Until the branch is live: flag S5 goes in the batch note. The owner opens `/admin/robot-team-access` daily while a batch is out (risk 4) |
| 3 | **Done on the branch: 99314af0f.** One press before a one-use sign-in link is redeemed, on the sign-in page and the job page | `client/src/pages/Login.tsx:83`, `client/src/pages/CompanyJob.tsx:183` | done | Yes, for wave 0 (inferred risk) | Until the branch is live: a company that reports a dead link asks for a new one at `/sign-in` (risk 5) |
| 4 | **Done on the branch: df5617f26.** The monitoring runbook's intake cap reads 5, not 50, and "at most 5 intake ops notices", not "50"; every other number in it was checked against the code | `docs/runbooks/beta-monitoring.md:196,212-215` | done | Yes | Read the cap from C5 grep 7, not from the runbook |
| 5 | **Done on the branch: df457eff4.** The site guide and the beta README describe today's service: no early trial, approval by the rule, "Stop using my video", sharing as the service | `docs/beta/SITE_OPERATOR_BETA_GUIDE.md`, `docs/beta/README.md` | done | Yes, for wave 1 | Until the branch is live: send the yes-message, not the guide (risk 13) |
| 6 | **Done on the branch: 5afd7589f** (the site's page, and the company's page for unflagged room packages). Tell the site when its simulation is the room without the job's object | `client/src/lib/simulationContents.ts`, `client/src/components/site/SiteAnswer.tsx`, `server/routes/site-task-brief.ts` | done | Yes, for wave 1, after decision 16 | Until the branch is live: tell the site by hand (risk 10) |
| 7 | **Done on the branch: 7c6098d84.** While none is approved the site's video email reads "Your job goes to the deployment companies we approve. None is approved yet, so no company can see your job yet; your job page shows when one can." | `server/utils/taskLifecycleNotifications.ts`, `server/routes/inbound-request.ts` | done | Only if sites go before companies | Until the branch is live: the messages to the site keep their state line |
| 8 | **Done on the branch: d716400e5.** The outreach log on the research record: contacted on, channel, message version, go-ahead entry date, answer, next step and date, do not contact (sticky), on the staff page `/admin/outreach`; admin only, never in a registry read | `server/types/robot-team-registry.ts`, `server/utils/robotTeamOutreach.ts`, `server/routes/admin-robot-teams.ts`, `client/src/pages/AdminOutreach.tsx` | done | No | Until the branch is live: the contact table (section 2) |
| 9 | Complete the month's count: the World Labs reading, and the 345 admissions with no job that hold $18 | Pipeline `src/blueprint_pipeline/account_monthly_spend_report.py`, Pipeline `src/blueprint_pipeline/paid_spend_meter.py` | M | Yes, for wave 1 (money) | Treat the headroom as smaller by the open amounts when sizing the wave (risk 8) |
| 10 | Run pull request 1424's four tests on main; close it if they pass (decision 9) | `server/tests/site-assessment-preparation.test.ts`, `server/tests/website-job-ceiling.test.ts` | S | No | Nothing changes: main already counts the readings |
| 11 | **Done on the branch: 604318b9d.** The owner is told once at 25 days and once at 30 about each account deletion request, through the ops monitor (Slack and one email to `CONTACT_TO`) | `server/utils/accountDeletionAgeAlerts.ts`, `server/utils/betaOpsMonitor.ts` | done | No | Decision 14 clears today's case. Gate check P4 catches the next only once its pass condition stops counting `in_review` as done (it now does). Nothing else in `server/` reads `accountDeletionRequests` besides its route, its util and this alert |
| 12 | **Done on the branch: 8cc79c99b.** A plain empty state on the public jobs page | `client/src/components/site/LiveJobs.tsx:44` | done | No | The signed-in Find jobs page already says "No jobs yet." |
| 13 | **Done on the branch: 21fa5708b.** It reads "We measured your spots in the simulation of your site and compared them with the robot's published reach." | `client/src/components/site/SiteAnswer.tsx`, `server/utils/siteAnswer.ts` | done | No | Nothing; the drafts do not use the phrase |
| 14 | **Done on the branch: 5d0ecd4de.** The approval email's "Find jobs" link goes through `/sign-in?next=%2Fcontact%2Frobot-team` | `server/utils/robotTeamAccessEmails.ts:59` | done | No | The email's invitation link still works; point a company to it if it asks |
| 15 | Close the 4 stale open alerts, and close old ones automatically | `server/utils/betaOpsMonitor.ts` | S | No | Gate check S8 reads the open alerts by their dates |
| 16 | **Done on the branch: b90688327.** Command C1 is the read-only script `scripts/ops/outreach-counts.ts`, with four readings added | `scripts/ops/outreach-counts.ts` | done | No | Until the branch is on main, run the script from the branch |
| 17 | This repo's guide still says the site "presses Introduce us"; the live button is "Accept" | `AGENTS.md:44-46` (outside the shared block) | S | No | The playbook and the drafts say "Accept" |
| 18 | Remove "OEM" and "vendor" from the figures file, or archive it | `client/src/data/deploymentMarket.ts` | S | No | The drafts quote no figure |
| 19 | Filming advice on the upload page: length, light, steadiness | `client/src/lib/footageNotice.ts` | S | No | The yes-message carries it |
| 20 | Withdrawal plan: do not count as undetermined an offloaded run that predates the withdrawn site (its sealed pointer's `offloaded_at_epoch` earlier than the site's first record on the host). Add a drill case with an unrelated no-site pointer. Rejected: reading every archive from B2, which spends money and is not bounded by the plan's reading budget | Pipeline `src/blueprint_pipeline/website_capture_withdrawal_deletion.py:665-670` | M | Yes. Hard stop: privacy. It must land before 2026-11-28 02:25Z for the first apply to run on time | The plan ends `unresolved` and the first deletion does not apply; the overdue alert posts 2026-12-16 02:25Z (risk 9) |
| 21 | **Done on the branch: ad46dd933, 06690ee8a.** A video over the upload limit is told before it uploads, and the done screen offers a smaller video | `client/src/lib/captureVideoLimit.ts`, `server/routes/self-capture-uploads.ts`, `client/src/components/site/SiteCaptureStart.tsx` | done | No | Until the branch is live, the yes-message's "under 1 GB if you can" |
| 22 | **Done on the branch: 8cf85a6ee.** A delivered simulation stays ready on the site's page after the job's time runs out | `server/utils/jobOutlook.ts` | done | No | Tell the site by hand that its simulation can still be downloaded |
| 23 | **Done on the branch: f13c7bbc7, 51632d381, 2f65abd7e.** The tracker reads "No approved company can see it yet."; the account-limit hold says building the simulation is paused, not the job; companies read "There is no simulation for this job." for an ending with none | `client/src/lib/jobTracker.ts`, `server/utils/taskPreparationOutcome.ts`, `server/utils/taskBrowse.ts`, `client/src/lib/companyJobPage.ts` | done | No | The messages keep their state line |
