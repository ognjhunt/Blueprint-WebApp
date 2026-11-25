/**
 * The owner's totals on the staff job page (`/admin/jobs`), one line, and the billable events as CSV (finding O-06).
 * Read only. Site jobs only: an internal test job and a company's workspace evaluation are not counted.
 *
 * Where a number is a plain count, it is a Firestore count query (introductions made). The billable events are read with
 * their status and made time only: one counts only once its introduction is made; one recorded but not made is counted
 * apart (owner, 2026-11-23). The per-job
 * numbers (with a video, shown to companies, with an answer) and the outcome answers need to know which job a record
 * belongs to, so they read the records with only the fields they need. Each number is best effort: one that cannot be
 * read is null, never the line.
 *
 * The CSV carries ids and times only: no site name, address or contact, and no price.
 *
 * A test introduction (Blueprint's internal test company on an internal test job, owner 2026-11-25) is never counted:
 * its event is a test event (`isTestBillableEvent`), outside every billable number and the CSV, and its sent company
 * email is taken out of the introductions made (as the test events made, read with the billable events).
 */
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { listAllBillableEvents, tallyBillableEvents } from "./billableEvents";
import { CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";
import { COMPANY_RESPONSES_COLLECTION, COMPANY_SENDS_COLLECTION, INTRODUCTIONS_COLLECTION } from "./jobCompanies";
import { INTRODUCTION_COMPANY_KIND } from "./jobIntroductionGate";
import { INTERNAL_TEST_FIELD, isInternalTestJob } from "./internalTestJob";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { iso } from "./workspace-projection";
import type { AdminJobTotals } from "../../client/src/types/jobConsole";

type Data = Record<string, any>;
type Store = FirebaseFirestore.Firestore;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const JOBS = "inboundRequests";

/** The job id a subcollection record belongs to, when it sits under `inboundRequests/{id}`. */
function jobIdOf(doc: FirebaseFirestore.QueryDocumentSnapshot): string | null {
  const job = doc.ref.parent.parent;
  return job && job.parent.id === JOBS ? job.id : null;
}

async function best<T>(work: () => Promise<T>): Promise<T | null> {
  try { return await work(); } catch { return null; }
}

function hasVideo(session: Data | undefined): boolean {
  return Boolean(session?.browser_stored_upload?.completed_at_iso || session?.browser_pending_delivery?.completed_at_iso
    || session?.site_capture_bundle?.recorded_at_iso);
}

export async function loadJobTotals(now: Date = new Date(), store: Store | null = dbAdmin): Promise<AdminJobTotals> {
  if (!store) throw new Error("job_totals_store_unavailable");
  const db = store;
  const jobDocs = await db.collection(JOBS).where("request.buyerType", "==", "site_operator")
    .select("createdAt", INTERNAL_TEST_FIELD, "workspace_evaluation", "active_capture_id").get();
  const jobs = jobDocs.docs.filter(doc => { const record = doc.data(); return !record.workspace_evaluation && !isInternalTestJob(record); });
  const ids = new Set(jobs.map(doc => doc.id));
  const weekStart = now.getTime() - WEEK_MS;
  const thisWeek = jobs.filter(doc => { const at = Date.parse(iso(doc.data().createdAt) ?? ""); return at >= weekStart && at <= now.getTime(); }).length;
  const jobsWith = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => new Set(docs.map(jobIdOf).filter((id): id is string => Boolean(id && ids.has(id)))).size;

  const [withVideo, shownToCompanies, answered, introductions, introductionsMade, billable] = await Promise.all([
    best(async () => {
      if (!jobs.length) return 0;
      const refs = jobs.map(doc => db.collection("captureUploadSessions").doc(siteWalkthroughIdentity(doc.id, doc.data()).captureId));
      const sessions = await db.getAll(...refs, { fieldMask: ["browser_stored_upload", "browser_pending_delivery", "site_capture_bundle"] });
      return sessions.filter(session => hasVideo(session.data())).length;
    }),
    best(async () => jobsWith((await db.collectionGroup(COMPANY_SENDS_COLLECTION).select("voidedAtIso").get()).docs
      .filter(doc => !doc.data().voidedAtIso))),
    best(async () => jobsWith((await db.collectionGroup(COMPANY_RESPONSES_COLLECTION).select().get()).docs)),
    best(async () => (await db.collectionGroup(INTRODUCTIONS_COLLECTION).select("outcomes").get()).docs
      .filter(doc => { const id = jobIdOf(doc); return Boolean(id && ids.has(id)); })),
    best(async () => (await db.collection(CAPTURE_OUTBOX_COLLECTION).where("kind", "==", INTRODUCTION_COMPANY_KIND)
      .where("status", "==", "sent").count().get()).data().count),
    best(() => tallyBillableEvents(db)),
  ]);
  // The company emails sent, less the test introductions' (read with the billable events): null when either is unread.
  const realIntroductionsMade = introductionsMade === null ? null : billable ? Math.max(0, introductionsMade - billable.testMade) : null;
  return {
    siteJobs: jobs.length,
    siteJobsThisWeek: thisWeek,
    withVideo,
    shownToCompanies,
    answered,
    introductionsAsked: introductions ? introductions.length : null,
    introductionsMade: realIntroductionsMade,
    outcomeAnswers: introductions
      ? introductions.reduce((sum, doc) => sum + (Array.isArray(doc.data().outcomes) ? doc.data().outcomes.length : 0), 0) : null,
    billableEvents: billable ? billable.made : null,
    billableEventsNotMade: billable ? billable.notMade : null,
  };
}

/** One CSV cell: quoted, and a leading formula character neutralised so a spreadsheet does not run it. */
function cell(value: unknown): string {
  let out = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(out)) out = `'${out}`;
  return `"${out.replace(/"/g, '""')}"`;
}

export const BILLABLE_EVENTS_CSV_HEADER = ["event_id", "job_id", "company_id", "recorded_at", "made_at", "status"];

/** Every billable event, oldest first: ids, times and status only. One recorded but not made has an empty made_at. */
export async function billableEventsCsv(store: Store | null = dbAdmin): Promise<string> {
  const rows = (await listAllBillableEvents(store))
    .sort((a, b) => String(a.atIso ?? "").localeCompare(String(b.atIso ?? "")));
  return [BILLABLE_EVENTS_CSV_HEADER, ...rows.map(row => [row.id, row.requestId, row.companyId, row.atIso, row.madeAtIso, row.status])]
    .map(line => line.map(cell).join(",")).join("\r\n") + "\r\n";
}
