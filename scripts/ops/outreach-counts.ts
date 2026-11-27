#!/usr/bin/env tsx
/**
 * Read-only counts for the outreach readiness gate: command C1 of
 * `docs/runbooks/outreach-playbook.md`, section 1.
 *
 * It prints counts, states and dates, never a name, an email, an address or a
 * phone number. It uses only get(), count() and select(); it writes nothing.
 * Run it from the WebApp root in a cloud session
 * (`docs/runbooks/cloud-scene-runs.md`):
 *
 *   . ~/.blueprint-cloud/env.sh
 *   npx tsx scripts/ops/outreach-counts.ts
 *
 * The lines up to `intake_today` are C1 as the playbook wrote it on
 * 2026-11-26. The lines after it are readings added since:
 * - `owner_application_emails`: the owner's email about a waiting deployment
 *   company application (outbox kind `ops_access_application`,
 *   `server/utils/ownerApplicationNotice.ts`), by status;
 * - `rule_trials_today`: the owner's trial runs of the automatic company rule
 *   today (`durableDailyCaps/company_rule_trial__<day>`,
 *   `server/utils/companyCheck.ts`); a trial moves `rule_model_runs`, never
 *   `rule_check_days`;
 * - `outreach_log`: the outreach log on `robotTeams` (`server/utils/robotTeamOutreach.ts`):
 *   records contacted, do not contact, and contacts with no go-ahead date;
 * - `account_deletion_age_alerts`: the owner's 25- and 30-day notices
 *   (`server/utils/accountDeletionAgeAlerts.ts`), by step and delivery.
 *
 * Exit 2 when the session has no Firebase credentials.
 */
import { createRequire } from "node:module";

const runtimePath = new URL("../cloud/runtime.ts", import.meta.url).pathname;
const { importFirebaseAdmin, reexecWithEnvProxy, WEBAPP_ROOT } = await import(runtimePath);
reexecWithEnvProxy();
const root: string = WEBAPP_ROOT;
const { dbAdmin: db } = await importFirebaseAdmin();
if (!db) { console.log("no-credentials"); process.exit(2); }
const req = createRequire(runtimePath);
const util = (name: string) => req(`${root}/server/utils/${name}.ts`);
const { companyMaySeeJobs } = util("companyTerms"), { teamJobAccess } = util("teamJobAccess"), { isInternalTestJob } = util("internalTestJob");
const { siteWalkthroughIdentity } = util("siteWalkthrough"), { storedCompanyClip } = util("websiteCompanyClip"), { storedCompanySimulation } = util("websiteCompanySimulation");
const tally = (keys: string[]) => JSON.stringify(keys.reduce((m: Record<string, number>, k) => (m[k] = (m[k] ?? 0) + 1, m), {}));
const count = async (q: any) => (await q.count().get()).data().count;
const days = (iso: unknown) => typeof iso === "string" ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null;
// The permission basis of an internal test job's own clip, only compared below. Named here so the one-writer scan of
// the job's test marker (`server/tests/internal-test-job-marker.test.ts`) does not read this script as a writer.
const INTERNAL_TEST_BASIS = "internal_test";

/* ------------------------------------------------- C1, as in the playbook */
const access = (await db.collection("robotTeamAccess").get()).docs.map((d: any) => d.data());
console.log("applications", access.length, tally(access.map((r: any) => `status=${r.status}`)));
console.log("applications_waiting", tally(access.filter((r: any) => r.status === "applied").map((r: any) => `age_days=${days(r.appliedAtIso)}|reasons=${(r.companyCheck?.reasons ?? ["unchecked"]).join("+")}`)));
console.log("approved_by_rule", access.filter((r: any) => r.decidedBy === "auto:company-check.v1").length,
  "rule_checked", access.filter((r: any) => r.companyCheck).length, "rule_check_days", await count(db.collection("opsCompanyChecks")),
  "rule_model_runs", await count(db.collection("agentRuns").where("task_kind", "==", "company_website_check")));
console.log("companies_that_may_see_jobs", access.filter((r: any) => companyMaySeeJobs(r)).length);
console.log("sign_in_links_used", await count(db.collection("companySignInLinkUses")));
const jobs = (await db.collection("inboundRequests").get()).docs;
const states: string[] = []; const withdrawals: string[] = [];
for (const d of jobs) {
  const r: any = d.data();
  if (r.capture_withdrawal) withdrawals.push(`acknowledged=${r.capture_withdrawal.pipelineAcknowledged === true}|deleted=${r.capture_withdrawal.deletionConfirmed === true}`);
  if (isInternalTestJob(r) || r?.request?.buyerType !== "site_operator") continue;
  const { captureId } = siteWalkthroughIdentity(d.id, r);
  const [briefS, sessS] = await Promise.all([db.collection("siteTaskBriefs").doc(d.id).get(), db.collection("captureUploadSessions").doc(captureId).get()]);
  const brief: any = briefS.data(); const session: any = sessS.data();
  const prep = session?.website_preparation;
  const preparationState = prep?.selector?.request_id === d.id && typeof prep?.status?.state === "string" ? prep.status.state : null;
  const clip = storedCompanyClip(session, captureId);
  const a = teamJobAccess(r, { brief: brief ? { summary: typeof brief.summary === "string" ? brief.summary : null, confirmedAtIso: brief.confirmedAtIso ?? null } : null,
    preparationState, companyVideoReady: Boolean(clip) && clip.permission_basis !== INTERNAL_TEST_BASIS, companySimulationReady: Boolean(storedCompanySimulation(session, captureId)) });
  states.push(`${a.listed ? "LISTED" : `not_listed:${a.reason}`}|statement=${r?.request?.consent_attestation?.statement_version ?? "none"}|video=${Boolean(session)}`);
}
console.log("site_jobs_not_test", states.length, "listed_for_companies", states.filter(x => x.startsWith("LISTED")).length);
console.log("site_jobs_by_state", tally(states));
console.log("withdrawals", withdrawals.length, tally(withdrawals));
console.log("website_deletion_receipts", tally((await db.collection("websiteCaptureDeletionReceipts").get()).docs.map((d: any) => String(d.data().outcome))));
const beat: any = (await db.collection("opsHeartbeats").doc("blueprint-webapp-worker").get()).data();
console.log("withdrawal_notice", JSON.stringify(beat?.withdrawal_notice ?? null), "worker_revision", String(beat?.revision ?? "").slice(0, 7));
for (const g of ["companySends", "companyJobViews", "robotTeamInterest", "jobClarifications", "introductions"]) console.log(g, await count(db.collectionGroup(g)));
console.log("answers_by_state", tally((await db.collectionGroup("robotTeamInterest").get()).docs.map((d: any) => String(d.data().state ?? d.data().status ?? "?"))));
console.log("introductions_with_an_outcome_answer", (await db.collectionGroup("introductions").get()).docs.filter((d: any) => (d.data().outcomes ?? []).length > 0).length);
console.log("billable_events", tally((await db.collection("billableEvents").get()).docs.map((d: any) => `status=${d.data().status}|made=${Boolean(d.data().madeAtIso)}|priceUsd=${d.data().priceUsd ?? null}`)));
console.log("outbox", tally((await db.collection("captureOutbox").select("status").get()).docs.map((d: any) => String(d.get("status")))));
console.log("account_deletion_requests", tally((await db.collection("accountDeletionRequests").get()).docs.map((d: any) => `status=${d.data().status}|age_days=${days(d.data().requestedAtIso)}`)));
console.log("ops_alerts", tally((await db.collection("opsAlerts").get()).docs.map((d: any) => `status=${d.data().status}`)));
const today = new Date().toISOString().slice(0, 10);
const cap: any = (await db.collection("durableDailyCaps").doc(`intake_global__${today}`).get()).data();
console.log("intake_today", today, cap ? `used=${cap.used} limit=${cap.limit}` : "no job started today (no counter yet)");

/* ------------------------------------------------- readings added since */
console.log("owner_application_emails", tally((await db.collection("captureOutbox").where("kind", "==", "ops_access_application").select("status").get())
  .docs.map((d: any) => String(d.get("status")))));
const trial: any = (await db.collection("durableDailyCaps").doc(`company_rule_trial__${today}`).get()).data();
console.log("rule_trials_today", today, trial ? `used=${trial.used} limit=${trial.limit}` : "none today (no counter yet)");
const outreach = (await db.collection("robotTeams").select("outreach").get()).docs.map((d: any) => d.get("outreach")).filter(Boolean);
console.log("outreach_log", "contacted", outreach.filter((o: any) => o.contactedOn).length, "do_not_contact", outreach.filter((o: any) => o.doNotContact).length,
  "contacted_without_go_ahead_date", outreach.filter((o: any) => o.contactedOn && !o.goAheadEntryOn).length);
console.log("account_deletion_age_alerts", tally((await db.collection("opsAccountDeletionAgeAlerts").get()).docs
  .map((d: any) => `level=${d.data().level}|delivered=${Boolean(d.data().delivered_at_iso)}`)));
process.exit(0);
