/**
 * The admin job page's reads: what the page shows, and nothing more (`client/src/types/jobConsole.ts`).
 *
 * No status is worked out here. Where a job stands is its outlook (`loadJobOutlook`), the one decision the site's own
 * job page shows; the page says that phase in a short phrase and quotes the outlook's own sentence. Everything else is
 * a record, said as the record says it: the package record, the Pipeline's last report, the job's ledgers, the
 * privacy, rights and money records that stop a job, and the events whose time a record holds.
 *
 * Every read past the job's own record is best effort: one that fails leaves its part out, never the page.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { ADMIN_PHASE_WORDS, STANDING_NO_VIDEO, STANDING_ON_HOLD, STANDING_PACKAGE_BUILT, STANDING_UNREAD, type AdminJobDetail, type AdminJobEvent, type AdminJobInternalTest,
  type AdminJobRow, type AdminJobStop } from "../../client/src/types/jobConsole";
import { COMPANY_RESPONSE_LABELS } from "../../client/src/lib/companyResponses";
import { OUTLOOK_HOLDS, READING_LINE, SIMULATION_BUILDING, SIMULATION_READY } from "../../client/src/lib/jobOutlook";
import { projectWebsiteCaptureWithdrawal } from "./websiteCaptureWithdrawal";
import { decryptInboundRequestForAdmin } from "./field-encryption";
import { iso, object, text } from "./workspace-projection";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { adminCompanySimulation, storedCompanySimulation, type WebsiteCompanySimulation } from "./websiteCompanySimulation";
import { isInternalTestJob } from "./internalTestJob";
import { adminViewableWebsiteScenePreview } from "./websiteScenePreview";
import { isPlaceholderSummary } from "./siteTaskBrief";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { teamJobAccess } from "./teamJobAccess";
import { operatorListingHold } from "./operatorListing";
import { loadJobOutlook, type JobOutlook, type JobOutlookKnownReads } from "./jobOutlook";
import type { PublicWebsitePreparationStatus } from "./websitePreparationStatus";
import type { TaskSceneProgression } from "./taskStatusProjection";
import type { AdminJobCompanies } from "../../client/src/types/jobCompanies";

/** At most this many records are scanned for one page of the list. */
export const SCAN_LIMIT = 200;
export const PAGE_LIMIT_MAX = 25;
/** How long one job's outlook may take before its row says it could not be read. */
export const OUTLOOK_DEADLINE_MS = 8_000;

type Data = Record<string, any>;

export function isSiteJobRecord(record: Data | undefined): boolean {
  return Boolean(record) && object(record!.request).buyerType === "site_operator" && !record!.workspace_evaluation;
}

function internalTestOf(record: Data): AdminJobInternalTest | null {
  return isInternalTestJob(record) ? { label: text(object(record.internal_test).label) || null } : null;
}

/** The site's own sentence, as its job page reads it (`composeSiteAnswer`): the brief's summary, unless a placeholder. */
function sentenceOf(record: Data, brief: Data | null | undefined): { sentence: string | null; drafted: boolean } {
  const summary = typeof brief?.summary === "string" && !isPlaceholderSummary(brief.summary) ? brief.summary.trim() : null;
  const drafted = Boolean(summary) && !brief?.confirmedAtIso && !record.site_task_brief_confirmed_at
    && object(record.capture_task_statement_draft).state === "drafted";
  return { sentence: summary, drafted };
}

function within<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), ms); });
  return Promise.race([work.catch(() => null), late]).finally(() => clearTimeout(timer));
}

/** What the site's own job page says for the outlook: its reason sentence, else the page's line for the phase. */
function sitePageLine(outlook: JobOutlook): string | null {
  if (outlook.sentence) return outlook.sentence;
  if (outlook.phase === "reading") return READING_LINE;
  if (outlook.phase === "building") return SIMULATION_BUILDING;
  if (outlook.phase === "simulation_ready") return SIMULATION_READY;
  return null;
}

/**
 * Where the job stands, for staff. The outlook's phase in a short phrase, read with its reason (a hold is not an
 * ending), except where a record says more: the package record says the package is built (said first; if the site's
 * page says otherwise, that line is shown beside it, not hidden), and no video has arrived while the outlook reads
 * "reading". A job waiting on Blueprint (`stops`) says so. Nothing else is worked out here.
 */
export function standingOf(input: { outlook: JobOutlook | null; packageBuilt: boolean; videoReceived: boolean;
  waitsOnBlueprint: string[] }): { phase: AdminJobRow["phase"]; phrase: string; siteSees: string | null } {
  const { outlook, packageBuilt } = input;
  const agrees = outlook?.phase === "simulation_ready";
  let phrase: string;
  let siteSees: string | null = outlook?.sentence ?? null;
  if (packageBuilt) {
    phrase = STANDING_PACKAGE_BUILT;
    siteSees = outlook && !agrees ? sitePageLine(outlook) : null;
  } else if (!outlook) phrase = STANDING_UNREAD;
  else if (outlook.phase === "reading") phrase = input.videoReceived ? ADMIN_PHASE_WORDS.reading : STANDING_NO_VIDEO;
  else if (outlook.phase === "no_test" && outlook.reason && OUTLOOK_HOLDS.has(outlook.reason)) phrase = STANDING_ON_HOLD;
  else phrase = ADMIN_PHASE_WORDS[outlook.phase] ?? STANDING_UNREAD;
  if (input.waitsOnBlueprint.length) phrase += `; waiting on Blueprint: ${input.waitsOnBlueprint.join(", ")}`;
  return { phase: outlook?.phase ?? null, phrase, siteSees };
}

async function readOutlook(requestId: string, known?: JobOutlookKnownReads): Promise<JobOutlook | null> {
  return within(loadJobOutlook(requestId, known), OUTLOOK_DEADLINE_MS);
}

async function getAllDocs(collection: string, ids: string[]): Promise<Map<string, Data>> {
  const out = new Map<string, Data>();
  if (!db || !ids.length) return out;
  const snapshots = await db.getAll(...ids.map(id => db!.collection(collection).doc(id)));
  snapshots.forEach((snapshot, index) => {
    const data = snapshot.exists ? snapshot.data() : undefined;
    if (data) out.set(ids[index], data);
  });
  return out;
}

/* ------------------------------------------------------------------------- the list */

/** One page of site jobs, newest first: the job, where it stands, when it was received. */
export async function listJobConsoleRows(params: { limit: number; cursor?: string | null }):
  Promise<{ rows: AdminJobRow[]; nextCursor: string | null }> {
  if (!db) throw new Error("job_console_store_unavailable");
  const limit = Math.max(1, Math.min(PAGE_LIMIT_MAX, Math.floor(params.limit)));
  let query = db.collection("inboundRequests").orderBy("createdAt", "desc") as FirebaseFirestore.Query;
  if (params.cursor) {
    const start = await db.collection("inboundRequests").doc(params.cursor).get();
    if (start.exists) query = query.startAfter(start);
  }
  const snapshot = await query.limit(SCAN_LIMIT).get();
  const docs = snapshot.docs as unknown as Array<{ id: string; data: () => Data | undefined }>;
  const page: Array<{ id: string; record: Data }> = [];
  let consumed = 0;
  for (const doc of docs) {
    consumed += 1;
    const record = doc.data();
    if (record && isSiteJobRecord(record)) page.push({ id: doc.id, record });
    if (page.length >= limit) break;
  }
  const empty = () => new Map<string, Data>();
  const captures = new Map(page.map(({ id, record }) => [id, siteWalkthroughIdentity(id, record).captureId]));
  const [briefs, sessions] = await Promise.all([
    getAllDocs("siteTaskBriefs", page.map(row => row.id)).catch(empty),
    getAllDocs("captureUploadSessions", [...captures.values()]).catch(empty),
  ]);
  const rows = await Promise.all(page.map(async ({ id, record }) => {
    const outlook = await readOutlook(id);
    const captureId = captures.get(id)!;
    const { phase, phrase } = standingOf({ outlook, packageBuilt: Boolean(adminCompanySimulation(record, sessions.get(captureId), captureId)),
      videoReceived: Boolean(videoReceivedAtIso(sessions.get(captureId))), waitsOnBlueprint: blueprintWaits(recordStops(record)) });
    return {
      requestId: id,
      sentence: sentenceOf(record, briefs.get(id)).sentence,
      internalTest: internalTestOf(record),
      phase,
      standing: phrase,
      receivedAtIso: iso(record.createdAt),
    } satisfies AdminJobRow;
  }));
  const more = consumed < docs.length || docs.length === SCAN_LIMIT;
  return { rows, nextCursor: more && docs.length ? docs[consumed - 1].id : null };
}

/* ------------------------------------------------------------------------- one job */

/** The site job's record, or null when there is no such site job (the detail's 404). */
export async function loadSiteJobRecord(requestId: string): Promise<Data | null> {
  if (!db) throw new Error("job_console_store_unavailable");
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  const record = snapshot.exists ? snapshot.data() : undefined;
  return isSiteJobRecord(record) ? record! : null;
}

/**
 * The job's simulation package for the console's download (`adminCompanySimulation`): the stored reference of the
 * job's current capture, read the way the company's page reads it; null when it has none or the site has withdrawn.
 */
export async function jobSimulationPackage(requestId: string, record: Data): Promise<WebsiteCompanySimulation | null> {
  if (!db) throw new Error("job_console_store_unavailable");
  const { captureId } = siteWalkthroughIdentity(requestId, record);
  const session = (await db.collection("captureUploadSessions").doc(captureId).get()).data();
  return adminCompanySimulation(record, session, captureId);
}

/**
 * The job's scene preview for the console's "View the simulation of the site" (`adminViewableWebsiteScenePreview`): the
 * stored preview of the job's current capture, internal test jobs included; null when it has none, its site's grant no
 * longer stands, or the site has withdrawn. The capture id is returned so the view ticket is bound to the same capture.
 */
export async function jobScenePreview(requestId: string, record: Record<string, any>) {
  if (!db) throw new Error("job_console_store_unavailable");
  const { captureId } = siteWalkthroughIdentity(requestId, record);
  const session = (await db.collection("captureUploadSessions").doc(captureId).get()).data();
  const preview = adminViewableWebsiteScenePreview(record, session, captureId);
  return preview ? { captureId, preview } : null;
}

/** The Pipeline's preparation state, said as its record names it. */
const PREPARATION_WORDS: Readonly<Record<string, string>> = {
  preparing: "preparing the job",
  awaiting_inputs: "waiting for an input before it goes on",
  capacity_delayed: "waiting for capacity",
  failed_retryable: "a step failed, and it will try again",
  failed_terminal: "stopped",
  authority_ended: "its authority to work on the job ended",
  handed_off: "handed off to build the scene",
};
const TERMINAL_WORDS: Readonly<Record<string, string>> = {
  permanent_invalid: "an input could not be used",
  retry_exhausted: "it ran out of retries",
  budget_exhausted: "it reached the job's budget",
  capacity_blocked: "it waited too long for capacity",
  out_of_scope: "the job is outside what it can build",
};
const SCENE_WORDS: Readonly<Record<string, string>> = {
  in_progress: "building the scene",
  waiting: "the scene is waiting",
  completed: "the scene is built",
  ready: "the simulation package is published",
};
const plain = (code: string) => code.replace(/_/g, " ");

/** The Pipeline's last report, in plain words, or null when it has reported nothing readable. */
function pipelineWords(preparation: PublicWebsitePreparationStatus | null, scene: TaskSceneProgression | null): string | null {
  if (!preparation || preparation.state === "unavailable") return null;
  let words = PREPARATION_WORDS[preparation.state] ?? plain(preparation.state);
  if (preparation.state === "failed_terminal" && preparation.terminalReason)
    words += `: ${TERMINAL_WORDS[preparation.terminalReason] ?? plain(preparation.terminalReason)}`;
  if (preparation.state === "handed_off" && scene) {
    words = scene.state === "held" ? `the scene is on hold (${plain(scene.heldReason ?? "held_capability")})`
      : scene.state === "ended" ? `the scene ended${scene.sceneOutcome?.kind ? ` (${plain(scene.sceneOutcome.kind)})` : ""}`
        : SCENE_WORDS[scene.state] ?? plain(scene.state);
    if (scene.attemptFailed) words += "; one attempt failed and it is trying again";
  }
  return `The Pipeline reports: ${words}.`;
}

/**
 * A withdrawal, as the withdrawal's own projection reports it (`projectWebsiteCaptureWithdrawal`): each part of the
 * cleanup said as confirmed or not, never rounded up. The Pipeline's cleanup of its own copies and of copies outside
 * it are reported apart from the website's deletion and its acknowledgement, and are never inferred from them.
 */
function withdrawalStop(record: Data): AdminJobStop {
  const attestation = object(object(record.request).consent_attestation);
  const raw = object(record.capture_withdrawal);
  const atIso = text(attestation.revoked_at_iso) || text(attestation.withdrawn_at_iso) || text(raw.requestedAtIso)
    || text(raw.requested_at_iso) || null;
  const lead = "The site withdrew permission to use its video.";
  if (!Object.keys(raw).length) return { key: "withdrawn", whose: "blueprint", atIso,
    text: `${lead} No withdrawal record is on file yet, so no cleanup is confirmed.` };
  const projected = projectWebsiteCaptureWithdrawal(raw);
  const storage = { deleted: "deleted", deleted_late_upload_check_pending: "deleted, a check for late uploads still to run",
    retrying: "deletion is being retried", pending: "not deleted yet" }[projected.storageDeletion.state];
  // The Pipeline's receipt covers only the site's mapped files on its host (`cleanup_scope:
  // "server_mapped_site_local_files"`, `external_cleanup_required: true`) and, separately, the cloud scene folder
  // (`scenes/<site>/`). Provider copies, delivered packages, launch runs and their evidence, and the archive are cleared
  // by a separate Pipeline command that nothing on the website records, so they are never said to be removed.
  const local = raw.localCleanupVerified === true;
  const cloud = raw.cloudObjectAbsenceVerified === true;
  const verified = local && cloud ? "The site's mapped files on the Pipeline host and its cloud scene folder are verified removed."
    : local ? "The site's mapped files on the Pipeline host are verified removed; its cloud scene folder is not verified removed."
      : cloud ? "Its cloud scene folder is verified removed; the site's mapped files on the Pipeline host are not verified removed."
        : "Neither the site's mapped files on the Pipeline host nor its cloud scene folder is verified removed.";
  const parts = [
    `Website copies: ${storage}.`,
    projected.pipelineAcknowledged ? "The Pipeline acknowledged it." : "The Pipeline has not acknowledged it yet.",
    verified,
    "Provider copies, delivered packages, launch runs and their evidence, and the archive are not verified removed.",
    ...(projected.legalHold ? ["Cleanup is under a legal hold."] : []),
  ];
  // No record on the website ever says every copy is gone, so the step stays Blueprint's unless a legal hold stops it.
  return { key: "withdrawn", text: `${lead} ${parts.join(" ")}`, atIso, whose: projected.legalHold ? "none" : "blueprint" };
}

/** The rights reasons that keep a site's job from companies, each with whose step it is. */
const RIGHTS_STOPS: Readonly<Record<string, { text: string; whose: AdminJobStop["whose"] }>> = {
  rights_blocked: { text: "The rights review blocked the video.", whose: "blueprint" },
  rights_needs_review: { text: "The rights review has not cleared the video yet.", whose: "blueprint" },
  recording_consent_missing: { text: "No current permission to use the video is on file.", whose: "site" },
  older_statement: { text: "The site agreed to an older statement, so the job is not shared until it accepts the current one.", whose: "site" },
};

/** Money records that stopped spending on the job (`opsWebsiteJobOverBudgetAlerts`), each Blueprint's to look at. */
const MONEY_STOPS: Readonly<Record<string, string>> = {
  safety_limit: "Spending was refused at this job's safety limit.",
  screening_job_ceiling: "Testing was held back at this job's spending limit.",
};

/** The stops the job's own record holds: a withdrawal, a rights reason, Blueprint's hold. */
function recordStops(record: Data): AdminJobStop[] {
  if (projectWebsiteCaptureRights(record).consent_revoked) return [withdrawalStop(record)];
  if (isInternalTestJob(record)) return [];
  const stops: AdminJobStop[] = [];
  const access = (() => { try { return teamJobAccess(record); } catch { return null; } })();
  const rights = access?.reason ? RIGHTS_STOPS[access.reason] : undefined;
  if (rights) stops.push({ key: `rights-${access!.reason}`, text: rights.text, whose: rights.whose, atIso: null });
  const hold = operatorListingHold(record);
  if (hold) stops.push({ key: "blueprint-hold", whose: "blueprint", atIso: hold.atIso,
    text: `Blueprint stopped showing this job to companies${hold.reason ? `: ${hold.reason}` : "."}` });
  return stops;
}

/** What the job waits on Blueprint for, in a word or two each, from its stops. */
const WAIT_WORDS: Readonly<Record<string, string>> = {
  withdrawn: "withdrawal cleanup", "rights-rights_blocked": "rights review", "rights-rights_needs_review": "rights review",
  "blueprint-hold": "its hold on sharing",
  "money-budget": "budget", "money-safety_limit": "budget", "money-screening_job_ceiling": "budget", "money-words_limit": "budget",
};
function blueprintWaits(stops: AdminJobStop[]): string[] {
  return [...new Set(stops.filter(stop => stop.whose === "blueprint").map(stop => WAIT_WORDS[stop.key] ?? "a step of its own"))];
}

function epochIso(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
}

/** Words left unread by the other side at a limit on preparing them (`freeTextScreening.ts`), said on the admin page. */
const WORDS_LIMIT_STOPS: Readonly<Record<string, string>> = {
  writer_passes: "Some words were not shown to the other side: one writer reached its limit on checking words for names and contact details.",
  job_passes: "Some words were not shown to the other side: this job reached its limit on checking words for names and contact details.",
  job_spending_cap: "Some words were not shown to the other side: this job's spending limit left no room to check them for names and contact details.",
};

async function moneyStops(requestId: string): Promise<AdminJobStop[]> {
  if (!db) return [];
  const rows = await db.collection("opsWebsiteJobOverBudgetAlerts").where("request_id", "==", requestId).limit(20).get();
  const stops = rows.docs.flatMap(doc => {
    const data = doc.data() ?? {};
    return Object.entries(MONEY_STOPS).filter(([kind]) => data[kind]).map(([kind, words]) => ({ key: `money-${kind}`, text: words,
      whose: "blueprint" as const, atIso: epochIso(object(data[kind]).recorded_at_epoch) ?? (text(data.alerted_at_iso) || null) }));
  });
  const { screeningLimitReached } = await import("./freeTextScreening");
  const limit = await screeningLimitReached(requestId).catch(() => null);
  return limit ? [...stops, { key: "money-words_limit", text: WORDS_LIMIT_STOPS[limit.limit], whose: "blueprint" as const,
    atIso: limit.atIso }] : stops;
}

/** What the job's ledgers count (`websiteJobSpend`), or null when the job has no ledger entry at all. */
async function costOf(requestId: string, record: Data): Promise<AdminJobDetail["cost"]> {
  if (!db) return null;
  const { transactionJobLedgerReader, websiteJobSpend } = await import("./websiteJobCeiling");
  const store = db;
  const ledgers = transactionJobLedgerReader(store, { get: (reference: any) => reference.get() }, requestId);
  let entries = Object.keys(object(record.website_preparation_reservations)).length;
  const counted = {
    sceneIntakes: async () => { const rows = await ledgers.sceneIntakes(); entries += rows.length; return rows; },
    screeningRuns: async () => { const rows = await ledgers.screeningRuns(); entries += rows.length; return rows; },
    laneReservations: async () => { const rows = await ledgers.laneReservations(); entries += rows.length; return rows; },
    videoReadings: async () => { const rows = await ledgers.videoReadings(); entries += rows.length; return rows; },
  };
  const spend = await websiteJobSpend({ record, reader: counted });
  if (!entries) return null;
  // What the readable records add up to: an unreadable record counts nothing here, and the page names it as left out.
  return { spentOrHeldUsd: Math.round(spend.readable_total_micros / 10_000) / 100, unreadable: spend.unreadable };
}

async function siteOf(record: Data): Promise<{ name: string | null; place: string | null }> {
  try {
    const decrypted = await decryptInboundRequestForAdmin(record as never) as unknown as Data;
    return { name: text(object(decrypted.request).siteName) || null, place: text(object(decrypted.request).siteLocation) || null };
  } catch {
    return { name: null, place: null };
  }
}

/**
 * When the video arrived, from the capture record itself: the browser upload's stored record, its delivery record, or
 * an app bundle's record. Not from the "we have your video" email notice, which a job with no address (an internal
 * test job) never gets. Null when the record holds no upload.
 */
export function videoReceivedAtIso(session: Data | null | undefined): string | null {
  const stored = object(session?.browser_stored_upload), pending = object(session?.browser_pending_delivery);
  const bundle = object(session?.site_capture_bundle);
  return text(stored.completed_at_iso) || text(pending.completed_at_iso) || text(bundle.recorded_at_iso) || null;
}

function companyEvents(companies: AdminJobCompanies | null): AdminJobEvent[] {
  if (!companies) return [];
  const name = (row: { company: string | null; alias?: string | null }) => row.company ?? (row.alias ? `Company ${row.alias}` : "A company");
  const events: AdminJobEvent[] = [];
  if (companies.autoSend) events.push({ key: "auto-send", atIso: companies.autoSend.sentAtIso,
    text: `Shared with ${companies.autoSend.count} approved deployment ${companies.autoSend.count === 1 ? "company" : "companies"}` });
  for (const send of companies.sends) if (send.sentBy !== "system" && !send.voidedAtIso && send.sentAtIso)
    events.push({ key: `send-${send.sendId}`, atIso: send.sentAtIso, text: `Sent to ${name(send)} by hand` });
  for (const row of companies.responses) if (row.updatedAtIso && row.recordedBy !== "before_c1")
    events.push({ key: `response-${row.companyId}`, atIso: row.updatedAtIso,
      text: row.state === "interested" ? `${name(row)} applied`
        : `${name(row)} answered: ${row.state ? COMPANY_RESPONSE_LABELS[row.state] : "an answer this page cannot read"}` });
  for (const row of companies.introductions ?? []) {
    if (row.requestedAtIso)
      events.push({ key: `introduction-${row.companyId}`, atIso: row.requestedAtIso, text: `The site asked to meet ${name(row)}` });
    if (row.cancelledAtIso) events.push({ key: `introduction-cancelled-${row.companyId}`, atIso: row.cancelledAtIso,
      text: `The introduction to ${name(row)} was cancelled${row.cancelReason ? ` (${row.cancelReason.replace(/_/g, " ")})` : ""}; emails not yet sent for it were cancelled` });
    if (row.latestOutcome?.atIso) events.push({ key: `outcome-${row.companyId}`, atIso: row.latestOutcome.atIso,
      text: `After the introduction to ${name(row)}, the ${row.latestOutcome.by === "site" ? "site" : "company"} said: ${row.latestOutcome.label}` });
  }
  // Each introduction is recorded as a billable event: said as recorded or voided, never with a price. It counts only
  // once the introduction is made (owner, 2026-11-23); one not made yet says so, so the state is seen, not counted.
  for (const event of companies.billableEvents ?? []) {
    const made = event.status !== "void" && Boolean(event.madeAtIso);
    if (event.atIso)
      events.push({ key: `billable-${event.id}`, atIso: event.atIso, text: event.status === "void"
        ? `Billable event for the introduction to ${name(event)}: voided`
        : made ? `Billable event recorded for the introduction to ${name(event)}`
          : `Billable event recorded for the introduction to ${name(event)}; not made yet, so not counted` });
    if (made && event.madeAtIso)
      events.push({ key: `billable-made-${event.id}`, atIso: event.madeAtIso,
        text: `The introduction to ${name(event)} was made; its billable event counts` });
  }
  return events;
}

export async function getJobConsoleDetail(requestId: string): Promise<AdminJobDetail | null> {
  const record = await loadSiteJobRecord(requestId);
  if (!record || !db) return null;
  const store = db;
  const internalTest = internalTestOf(record);
  const revoked = projectWebsiteCaptureRights(record).consent_revoked;
  const { captureId } = siteWalkthroughIdentity(requestId, record);
  const optional = <T>(work: () => Promise<T>): Promise<T | null> => work().catch(() => null);

  const [brief, session] = await Promise.all([
    optional(() => import("./siteTaskBrief").then(({ getBrief }) => getBrief(requestId))),
    optional(() => store.collection("captureUploadSessions").doc(captureId).get().then(snapshot => snapshot.data())),
  ]);
  // The Pipeline's own report, read as the site's status route reads it; never after a withdrawal.
  const preparation = !revoked && session?.website_preparation
    ? await optional(() => import("./websitePreparationStatus")
      .then(({ loadCurrentWebsitePreparationStatus }) => loadCurrentWebsitePreparationStatus(requestId, captureId))) : null;
  const scene = preparation?.state === "handed_off"
    ? await optional(() => import("./websiteSceneProgression")
      .then(({ loadWebsiteSceneProgression }) => loadWebsiteSceneProgression(requestId, captureId))) : null;
  // Withdrawn, or the capture session unreadable: the outlook makes every read itself.
  const answerWork = !revoked && session !== null
    ? import("./siteAnswer").then(({ loadSiteAnswer }) => loadSiteAnswer(requestId)) : null;
  // The outlook reads it, and treats a failure as no answer; nothing else waits on it.
  answerWork?.catch(() => undefined);
  const known: JobOutlookKnownReads | undefined = answerWork ? {
    record, captureId, session: session ?? undefined, preparationStatus: preparation, sceneProgression: scene, brief: brief as never,
    answer: answerWork,
  } : undefined;

  const videoAtIso = videoReceivedAtIso(session);
  const [outlook, site, companies, money, cost] = await Promise.all([
    readOutlook(requestId, known),
    internalTest ? Promise.resolve(null) : siteOf(record),
    internalTest ? Promise.resolve(null)
      : optional(() => import("./jobCompanies").then(({ loadAdminJobCompanies }) => loadAdminJobCompanies(requestId))),
    optional(() => moneyStops(requestId)),
    optional(() => costOf(requestId, record)),
  ]);

  const stored = storedCompanySimulation(session ?? undefined, captureId);
  const packageReady = adminCompanySimulation(record, session ?? undefined, captureId);
  const { sentence, drafted } = sentenceOf(record, brief);

  // Only privacy, rights and money stop a job; said as each record says it.
  const stops: AdminJobStop[] = recordStops(record);
  if (preparation?.state === "failed_terminal" && preparation.terminalReason === "budget_exhausted")
    stops.push({ key: "money-budget", text: "The Pipeline stopped at this job's budget.", whose: "blueprint", atIso: null });
  stops.push(...(money ?? []));

  const builtAtIso = stored ? epochIso(stored.updated_at_epoch) : null;
  const events: AdminJobEvent[] = [
    ...(iso(record.createdAt) ? [{ key: "received", text: "Job received", atIso: iso(record.createdAt)! }] : []),
    ...(videoAtIso ? [{ key: "video", text: "Video received", atIso: videoAtIso }] : []),
    ...(builtAtIso ? [{ key: "package", text: "Simulation package built", atIso: builtAtIso }] : []),
    ...companyEvents(companies),
    ...stops.filter(stop => stop.key === "withdrawn" && stop.atIso).map(stop => ({ key: "withdrawn", text: "Permission withdrawn by the site", atIso: stop.atIso! })),
  ].sort((a, b) => a.atIso.localeCompare(b.atIso));

  const { phase, phrase, siteSees } = standingOf({ outlook, packageBuilt: Boolean(packageReady), videoReceived: Boolean(videoAtIso),
    waitsOnBlueprint: blueprintWaits(stops) });
  return {
    requestId,
    job: { sentence, drafted, site: internalTest ? null : site, internalTest },
    standing: { phase, phrase, siteSees,
      companies: companies && !revoked ? companies.sharing.words : null, pipeline: pipelineWords(preparation, scene) },
    simulationPackageUrl: packageReady ? `/api/admin/jobs/${encodeURIComponent(requestId)}/simulation.zip` : null,
    simulationPackage: packageReady ? { files: packageReady.files, sizeBytes: packageReady.size_bytes, builtAtIso } : null,
    // The same reading as the view route's own (`jobScenePreview`), from the session this read already holds.
    scenePreviewViewUrl: adminViewableWebsiteScenePreview(record, session ?? undefined, captureId)
      ? `/api/admin/jobs/${encodeURIComponent(requestId)}/scene-preview-view` : null,
    cost,
    stops,
    events,
  };
}
