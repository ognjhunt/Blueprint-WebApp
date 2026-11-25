/**
 * The internal test company's page of one internal test job, read without a browser (owner, 2026-11-25:
 * `internalTestCompany.ts`), so an engineering session can check what the company side shows on a real test job:
 * `POST /api/internal/pipeline/test-company/page` (`server/routes/internal-test-company.ts`).
 *
 * What a read does is what the test company's own page read does (`GET /api/site-worlds/jobs/:jobId`), and nothing more:
 * - the page is built by the page's own loader with the test company as its viewer (`loadCompanyJobPage`), so every check
 *   the page has stands, the site's words are screened as for any company, and a job with a video reading and no current
 *   brief starts its brief (`requestJobBrief`, held against the job's one $40 cap like any page read's);
 * - the test company's view is recorded, as the page route records a company's first open (`recordCompanyJobView`);
 * - the job summary is the PDF a company downloads from that page (`companyJobSummaryPdf`), read back as text
 *   (`pdfText.ts`).
 * Then, at most `BRIEF_WAIT_MS`, it waits for a brief run this read started, so the answer says how that run ended; the
 * next read shows the brief's rows when it was written.
 *
 * What it answers is a redacted summary: never an address, a media ticket, a signature or a token (every URL in the
 * summary's text is said as `SUMMARY_LINK_SAID`, and the page's media fields are read for their state only), never an
 * email address or an email's words, and no field named for a token, a secret, a signature or a password (the operator
 * door refuses such a field). It is bounded to `RESPONSE_MAX_BYTES`, under what the Pipeline's signed call reads.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { CompanyJobPage } from "../../client/src/types/taskBrowse";
import { companyJobSummaryBlocks, companyJobSummaryPdf } from "./companyJobSummary";
import { isInternalTestJob } from "./internalTestJob";
import { loadInternalTestCompany } from "./internalTestCompany";
import { pdfPageCount, pdfTextLines } from "./pdfText";

/** How long a read waits for the brief run it started before it answers. */
export const BRIEF_WAIT_MS = 15_000;
/** The answer's most bytes: the Pipeline's signed call reads at most 20,000 (`internal_test_job_door.post_signed`). */
export const RESPONSE_MAX_BYTES = 18_000;
/** How the summary's text says the link to the job's page, and any other address. */
export const SUMMARY_LINK_SAID = "[link to the job's page]";
export const ADDRESS_SAID = "[address]";

const ADDRESS = /\b[a-z][a-z0-9+.-]{1,15}:\/\/\S+|\bwww\.\S+|[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}/gi;
/** Field names never answered: what the operator door's secret guard refuses, and any address or ticket. */
export const REFUSED_FIELD = /token|secret|signature|password|passwd|private_?key|api_?key|ticket|url|email/i;

/** Every URL-shaped or email-shaped piece of a text, said as `ADDRESS_SAID`. */
const withoutAddresses = (text: string) => text.replace(ADDRESS, ADDRESS_SAID);

/**
 * The summary's lines with its link to the job's page said as `SUMMARY_LINK_SAID`: the link may be drawn over several
 * lines (`wrapText` cuts a long word), so a run of lines that together spell it is one placeholder. Any other address
 * left is said as `ADDRESS_SAID`.
 */
export function summaryLinesWithoutLinks(lines: readonly string[], jobUrl: string): string[] {
  const out: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    let joined = "", end = index;
    while (end < lines.length && joined.length < jobUrl.length && lines[end] && jobUrl.startsWith(joined + lines[end])) {
      joined += lines[end];
      end += 1;
    }
    if (joined === jobUrl) {
      out.push(SUMMARY_LINK_SAID);
      index = end - 1;
    } else out.push(withoutAddresses(lines[index]));
  }
  return out;
}

/** The job summary as a company downloads it, read back: its text lines without links, its headings and its pages. */
export function jobSummaryRead(page: CompanyJobPage, jobUrl: string): { lines: string[]; headings: string[]; pages: number } {
  const pdf = companyJobSummaryPdf(page, jobUrl);
  const headings = companyJobSummaryBlocks(page, jobUrl).flatMap(block => block.kind === "heading" || block.kind === "subheading"
    ? [withoutAddresses(block.text)] : []);
  return { lines: summaryLinesWithoutLinks(pdfTextLines(pdf), jobUrl), headings, pages: pdfPageCount(pdf) };
}

/** Whether the At a glance rows came from the job's brief (its rows are keyed `brief:<id>`) or the catalog. */
export const fitSummaryFrom = (page: Pick<CompanyJobPage, "fitSummary">): "job_brief" | "catalog" =>
  page.fitSummary.some(row => row.key.startsWith("brief:")) ? "job_brief" : "catalog";

/**
 * The page as the test company reads it, field by field, with no address, ticket or free text but the page's own words:
 * the media by their state, size and file name only; the company's answer by its state.
 */
export function companyPageSummary(page: CompanyJobPage) {
  const download = page.simulationDownload.state === "ready" ? page.simulationDownload : null;
  return {
    headline: page.headline,
    title: page.title,
    task_family: page.taskFamily,
    country: page.country,
    published_at_iso: page.publishedAtIso,
    headline_facts: page.headlineFacts,
    fit_summary_from: fitSummaryFrom(page),
    fit_summary: page.fitSummary.map(row => ({ key: row.key, label: row.label, value: row.value, state: row.state,
      source: row.source ?? null, ...(row.estimateBelow ? { estimate_below: true } : {}) })),
    sentence_present: Boolean(page.sentence),
    success_rule: page.successRule ? "shown" : page.successRulePending ? "pending" : "none",
    video: page.video.state === "ready" ? { state: "ready", width: page.video.width, height: page.video.height,
      duration_seconds: page.video.durationSeconds } : { state: page.video.state },
    thumbnail: page.thumbnailUrl ? { present: true, source: page.thumbnailSource ?? null } : { present: false },
    simulation: { state: page.simulation.state },
    simulation_download: download ? { state: "ready", size_bytes: download.sizeBytes, file_name: download.fileName,
      ...(download.objectIncluded === false ? { object_included: false } : {}) } : { state: page.simulationDownload.state },
    simulation_status: page.simulationStatus,
    packet_facts: { present: Boolean(page.packetFacts), pending: page.packetFactsPending === true,
      ...(page.packetFacts ? { lines: { object: page.packetFacts.object.length, measured: page.packetFacts.measured.length,
        estimated: page.packetFacts.estimated.length } } : {}) },
    visit_must_confirm_count: page.visitMustConfirm.length,
    about_site: page.aboutSite,
    my_answer: page.myAnswer ? { state: page.myAnswer.state, updated_at_iso: page.myAnswer.updatedAtIso,
      statement_version: page.myAnswer.statementVersion } : null,
    question: page.clarification ? { answered: page.clarification.answer !== null }
      : page.pendingQuestion ? { answered: false, reply_by_iso: page.pendingQuestion.replyByIso } : null,
    response_statement_version: page.responseStatement.version,
  };
}

/**
 * A value with every field named for a token, a secret, a signature, a password, a ticket, an address or an email left
 * out, and every URL-shaped text said as `ADDRESS_SAID`: the last pass over an answer, whatever was put in it.
 */
export function redacted(value: unknown): unknown {
  if (typeof value === "string") return withoutAddresses(value);
  if (Array.isArray(value)) return value.map(redacted);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).filter(([key]) => !REFUSED_FIELD.test(key)).map(([key, item]) => [key, redacted(item)]));
  return value;
}

/**
 * The summary's lines joined, as many from the top as fit in `budgetBytes` of JSON, and whether any was left out.
 * A cut is said in the text itself, so no reader takes a cut summary for the whole one.
 */
export function fittedSummaryText(lines: readonly string[], budgetBytes: number): { text: string; truncated: boolean } {
  const bytes = (text: string) => Buffer.byteLength(JSON.stringify(text), "utf8");
  const whole = lines.join("\n");
  if (bytes(whole) <= budgetBytes) return { text: whole, truncated: false };
  const cut = "\n[cut here: the rest of the summary did not fit]";
  let kept = lines.length;
  while (kept > 0 && bytes(lines.slice(0, kept).join("\n") + cut) > budgetBytes) kept -= 1;
  return { text: kept ? lines.slice(0, kept).join("\n") + cut : "", truncated: true };
}

const isoOrNull = (value: unknown) => typeof value === "string" && value ? value : null;
/** A stored code as it is ("failed", "no_answer", "TypeError"), else "not_shown": never free text, such as a provider's error. */
const codeOrNull = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_:.-]{1,80}$/.test(value) ? value : value ? "not_shown" : null;
const countOrNull = (value: unknown) => Number.isInteger(value) ? value as number : null;

/** The brief's run as `job_brief_run` holds it: how it stands, and why it stopped. Never its claim or its hold. */
function briefRun(run: unknown) {
  if (!run || typeof run !== "object") return null;
  const raw = run as Record<string, unknown>;
  return { status: codeOrNull(raw.status), attempts: countOrNull(raw.attempts), total: countOrNull(raw.total),
    reason: codeOrNull(raw.reason), limit: codeOrNull(raw.limit), claimed_at_iso: isoOrNull(raw.claimedAtIso),
    ended_at_iso: isoOrNull(raw.endedAtIso) };
}

/** Wait for `work` at most `ms`: true when it ended (well or not), false when the wait ran out. */
async function endedWithin(work: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const ranOut = new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), ms); });
  try { return await Promise.race([work.then(() => true, () => true), ranOut]); } finally { clearTimeout(timer); }
}

export type InternalTestCompanyPageResult = { ok: true; body: Record<string, unknown> }
  | { ok: false; reason: "store_unavailable" | "no_test_company" | "not_found" | "not_a_test_job" | "not_listed"; closedReason?: string | null };

/**
 * Read one internal test job's page as the internal test company (see the header): refused for any job that is not an
 * internal test job, and with no test company. `briefWaitMs` is for tests.
 */
export async function readInternalTestCompanyPage(jobId: string, options: { briefWaitMs?: number } = {}):
  Promise<InternalTestCompanyPageResult> {
  if (!db) return { ok: false, reason: "store_unavailable" };
  const store = db;
  const company = await loadInternalTestCompany(store);
  if (!company) return { ok: false, reason: "no_test_company" };
  const jobRef = store.collection("inboundRequests").doc(jobId);
  const record = (await jobRef.get()).data();
  if (!record) return { ok: false, reason: "not_found" };
  // Never a real job: the test company reads internal test jobs only.
  if (!isInternalTestJob(record)) return { ok: false, reason: "not_a_test_job" };
  const [{ loadCompanyJobAccess }, { jobBriefOfRecord, ensureJobBrief, JOB_BRIEF_RUN_FIELD }, { loadCompanyJobPage },
    { recordCompanyJobView, COMPANY_JOB_VIEWS_COLLECTION }, { companyJobUrl },
    { SIMULATION_READY_NOTICE_FIELD }, { CAPTURE_OUTBOX_COLLECTION }, { INTRODUCTIONS_SUBCOLLECTION, outcomesOf }] = await Promise.all([
    import("./teamJobAccess"), import("./jobBrief"), import("./companyJobPage"), import("./companyJobViews"),
    import("./jobCompanies"), import("./simulationReadyNoticeMarker"), import("./captureOutbox"), import("./jobOutcomeGate")]);
  const { access, brief } = await loadCompanyJobAccess(jobId, record, undefined, { internalTestCompany: true });
  if (!access.listed) return { ok: false, reason: "not_listed", closedReason: access.reason ?? null };
  // Whether this read starts the brief: the page's own rule, read just before the page reads it.
  const briefRequested = jobBriefOfRecord(record, brief).wanted;
  const page = await loadCompanyJobPage(jobId, { companyId: company.id });
  if (!page) return { ok: false, reason: "not_listed", closedReason: null };
  await recordCompanyJobView(jobId, company.id);
  const briefEnded = briefRequested ? await endedWithin(ensureJobBrief(jobId), options.briefWaitMs ?? BRIEF_WAIT_MS) : null;

  const jobUrl = companyJobUrl(jobId);
  const summary = jobSummaryRead(page, jobUrl);
  const [after, briefAfter, view, introduction, outbox] = await Promise.all([
    jobRef.get().then(doc => doc.data() ?? {}),
    store.collection("siteTaskBriefs").doc(jobId).get().then(doc => doc.data()),
    jobRef.collection(COMPANY_JOB_VIEWS_COLLECTION).doc(company.id).get().then(doc => doc.data()),
    jobRef.collection(INTRODUCTIONS_SUBCOLLECTION).doc(company.id).get().then(doc => doc.data()),
    store.collection(CAPTURE_OUTBOX_COLLECTION).where("requestId", "==", jobId).limit(100).get(),
  ]);
  const notice = after[SIMULATION_READY_NOTICE_FIELD];
  const body = {
    ok: true,
    job_id: jobId,
    page: companyPageSummary(page),
    job_brief: { requested: briefRequested, ...(briefEnded === null ? {} : { run_ended_in_wait: briefEnded }),
      current: Boolean(jobBriefOfRecord(after, briefAfter).current), run: briefRun(after[JOB_BRIEF_RUN_FIELD]) },
    view: { opened_at_iso: isoOrNull(view?.openedAtIso) },
    simulation_ready_notice: notice && typeof notice === "object" ? { owed: notice.owed === true,
      owed_at_iso: isoOrNull(notice.owedAtIso), queued: countOrNull(notice.queued), queued_at_iso: isoOrNull(notice.queuedAtIso),
      closed_reason: codeOrNull(notice.closedReason) } : null,
    introduction: introduction ? { requested_at_iso: isoOrNull(introduction.requestedAtIso),
      cancelled: typeof introduction.cancelledAtIso === "string",
      outcomes: outcomesOf(introduction).map(item => ({ by: item.by, state: item.state, at_iso: item.atIso,
        ...(item.reason ? { reason: item.reason } : {}) })) } : null,
    // The job's emails by their kind and how each stands: never whom they went to, nor their words.
    outbox: outbox.docs.map(doc => doc.data() as Record<string, unknown>)
      .map(row => ({ kind: codeOrNull(row.kind), status: codeOrNull(row.status), created_at_iso: isoOrNull(row.createdAtIso),
        sent_at_iso: isoOrNull(row.sentAtIso), error: codeOrNull(row.lastError) }))
      .sort((a, b) => String(a.created_at_iso).localeCompare(String(b.created_at_iso))),
    summary_pdf: { pages: summary.pages, lines: summary.lines.length, headings: summary.headings, truncated: false },
    summary_text: "",
  };
  const clean = redacted(body) as typeof body;
  const room = RESPONSE_MAX_BYTES - Buffer.byteLength(JSON.stringify(clean), "utf8");
  const fitted = fittedSummaryText(summary.lines, room);
  clean.summary_text = fitted.text;
  clean.summary_pdf.truncated = fitted.truncated;
  return { ok: true, body: clean };
}
