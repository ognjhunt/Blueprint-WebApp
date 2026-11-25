import { createHmac } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { InboundRequest } from "../types/inbound-request";
import { jobTitleForDisplay, type LibraryJobStage, type PublicLiveJob, type TaskBrowseCard, type TaskCardDetail } from "../../client/src/types/taskBrowse";
export type { PublicLiveJob } from "../../client/src/types/taskBrowse";
import { jobCardAnswerShared, loadJobCardAnswerHeadline } from "./jobCardAnswer";
import { loadCompanyJobAccess, taskThumbnailUrl, teamJobAccess, thumbnailSourceOf, type TeamJobAccess, type TeamJobAccessContext } from "./teamJobAccess";
import { JOB_SHARED_LISTING_VERSION } from "./taskListingDetails";
import { companyJobHeadline, companyPlaceOf, countryOf, knownSiteIdentity, siteSentenceForCompany } from "./companyJobPage";
import { readJobFacts } from "./jobFacts";
import { publicJobKind, rateInWords } from "../../client/src/lib/companyJobPage";
import { KINDS_OF_JOB_TYPE } from "../../client/src/lib/jobFacts";
import { jobReadingOf } from "./siteRobotFit";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { storedCompanySimulation } from "./websiteCompanySimulation";
import { loadScreenings, screenAndWait, screenInBackground } from "./freeTextScreening";

/**
 * The job card approved deployment companies see in the library: category title and stage (the site's sentence is added
 * in `libraryCard`). Whether it appears is
 * `teamJobAccess`. Pass the access `loadCompanyJobAccess` decided (the whole E2 rule), or a context; without either,
 * the two checks that live outside the record are skipped (see `teamJobAccess`).
 */
export function projectTaskBrowseCard(id: string, record: InboundRequest, decided?: TeamJobAccess | TeamJobAccessContext): TaskBrowseCard | null {
  const access = decided && "listed" in decided ? decided : teamJobAccess(record, decided as TeamJobAccessContext | undefined);
  if (!access.listed) return null;
  const raw = record as unknown as Record<string, any>;
  const ready = access.evaluationAvailable;
  const captured = Boolean(raw.capture_privacy_screen?.screened_at_iso || raw.capture_coverage
    || record.pipeline?.artifacts?.worldlabs_world_manifest_uri);
  // No price, not even 0: no price is stated anywhere (owner, 2026-11-12). The card's old `costUsd` went on 2026-11-19.
  return { ...access.details, id, stage: ready ? "ready" : captured ? "preparing" : "capture",
    evaluationAvailable: ready,
    publishedAtIso: raw.public_task_listing.approvedAtIso, jobUrl: `/jobs/${encodeURIComponent(id)}`,
    thumbnailUrl: taskThumbnailUrl(id, record),
    ...(taskThumbnailUrl(id, record) ? { thumbnailSource: thumbnailSourceOf(record) } : {}) };
}

/**
 * Where a listed job's simulation stands, from its real state: the stored recording, the Pipeline's rebuilt scene and
 * the job's outlook (one decision for the job page, the emails and this label). Null whenever any read is uncertain
 * or the state is one of the endings no label describes, so the card shows nothing rather than something untrue.
 */
export async function libraryJobStage(id: string, record: Record<string, any>): Promise<LibraryJobStage | null> {
  try {
    if (record?.pipeline?.artifacts?.worldlabs_world_manifest_uri) return "simulation_built";
    const [{ siteWalkthroughIdentity, savedWalkthrough }, { loadJobOutlookDecision }] = await Promise.all([
      import("./siteWalkthrough"), import("./jobOutlook")]);
    const walkthrough = await savedWalkthrough(siteWalkthroughIdentity(id, record));
    if (!walkthrough) return null;
    if (!walkthrough.received) return "no_video";
    const decision = await loadJobOutlookDecision(id);
    if (!decision.certain) return null;
    const { phase } = decision.outlook;
    if (phase === "simulation_ready") return "simulation_built";
    if (phase === "building") return "simulation_building";
    if (phase === "reading" || phase === "waiting_on_site") return "video_received";
    return null;
  } catch {
    return null;
  }
}

async function libraryCard(card: TaskBrowseCard, record: Record<string, any>,
  session?: FirebaseFirestore.DocumentData, brief?: FirebaseFirestore.DocumentData,
  /** How long one card's own read waits for a model pass its sentence still needs; the whole list waits for none. */
  screeningWaitMs = 0): Promise<TaskBrowseCard> {
  const { captureId } = siteWalkthroughIdentity(card.id, record);
  const simulationDownloadAvailable = Boolean(storedCompanySimulation(session, captureId));
  const [country, simulationStage, known, screenings] = await Promise.all([
    companyPlaceOf(record),
    simulationDownloadAvailable ? "simulation_built" as const : libraryJobStage(card.id, record),
    knownSiteIdentity(record).catch(() => null),
    loadScreenings(card.id),
  ]);
  // The site's sentence, and the title's object name from the video reading, only once the model pass over each has
  // succeeded (`siteWordsForCompany`, `companyJobHeadline`); else it starts now.
  const read = (results: typeof screenings) => ({ sentence: siteSentenceForCompany(brief, known, results),
    headline: companyJobHeadline(record, card.taskFamily, jobTitleForDisplay(card.title), known, results) });
  let words = read(screenings);
  if (screenings.missing.length && screeningWaitMs > 0) {
    if (await screenAndWait(card.id, screenings.missing, screeningWaitMs)) words = read(await loadScreenings(card.id));
  } else screenInBackground(card.id, screenings.missing);
  // The country, with the state or city only as the accepted statement allows (`companyPlaceOf`): never the site's name or address.
  // The title and how often the job runs, as its page leads with them, like a load post.
  return { ...card, region: card.region || country || "", sentence: words.sentence, simulationStage,
    simulationDownloadAvailable, headline: words.headline,
    headlineFacts: rateInWords(readJobFacts(record)) };
}

/**
 * `withAnswerHeadlines` adds the answer's headline to a card whose site chose to share its answer and whose
 * current listing consent still names it (`jobCardAnswerShared`). No answer is composed for any other card.
 */
export async function listTaskBrowseCards(options: { withAnswerHeadlines?: boolean } = {}): Promise<TaskBrowseCard[]> {
  if (!db) throw new Error("Task library unavailable");
  // Only jobs shared under the current listing record can be listed (E2); older cards are not read at all. Every such
  // job is read (no cap), and the list is put in one order below: newest shared first, then by id.
  const snapshot = await db.collection("inboundRequests")
    .where("public_task_listing.consentVersion", "==", JOB_SHARED_LISTING_VERSION).get();
  const cards = await Promise.all(snapshot.docs.map(async (doc): Promise<TaskBrowseCard | null> => {
    const record = doc.data() as InboundRequest;
    const { access, session, brief } = await loadCompanyJobAccess(doc.id, record);
    const listed = projectTaskBrowseCard(doc.id, record, access);
    if (!listed) return null;
    const [card, headline] = await Promise.all([libraryCard(listed, record, session, brief),
      options.withAnswerHeadlines && jobCardAnswerShared(record) ? loadJobCardAnswerHeadline(doc.id, record) : null]);
    return headline ? { ...card, answerHeadline: headline } : card;
  }));
  return cards.filter((card): card is TaskBrowseCard => card !== null)
    .sort((a, b) => b.publishedAtIso.localeCompare(a.publishedAtIso) || a.id.localeCompare(b.id));
}

/**
 * The live jobs as anyone sees them on /jobs (owner, 2026-11-23: let deployment companies see that real jobs exist
 * before they apply). Exactly the jobs approved companies see (`teamJobAccess`), each with only what Blueprint itself
 * derives: its kind from the fixed categories, the country, the day it was shared and whether its simulation is ready.
 * Never the site's words, its state or city, its video, an answer or the job's id: each site agreed to share its job
 * only with deployment companies Blueprint has approved.
 */
/**
 * A live job's public reference: an HMAC of its id, never the id itself, so the public list names no job a company
 * could look up elsewhere. The row opens `/jobs/<ref>`; the job page resolves it to the job only for an approved company
 * (`resolvePublicLiveJobRef`), and a visitor who is not signed in is asked to apply and comes back to the same address.
 * Null when no signing secret is configured: the row is then shown without a link.
 */
export const PUBLIC_LIVE_JOB_REF = /^l-[a-f0-9]{32}$/;
export function publicLiveJobRef(id: string): string | null {
  const secret = String(process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET || "").trim();
  return secret ? `l-${createHmac("sha256", secret).update(`public-live-job:${id}`).digest("hex").slice(0, 32)}` : null;
}

/** The job a public reference names, while it is still listed; null otherwise. Read for an approved company only. */
export async function resolvePublicLiveJobRef(ref: string): Promise<string | null> {
  if (!db || !PUBLIC_LIVE_JOB_REF.test(ref)) return null;
  const snapshot = await db.collection("inboundRequests")
    .where("public_task_listing.consentVersion", "==", JOB_SHARED_LISTING_VERSION).get();
  const match = snapshot.docs.find(doc => publicLiveJobRef(doc.id) === ref);
  return match ? match.id : null;
}

export async function listPublicLiveJobs(): Promise<PublicLiveJob[]> {
  if (!db) throw new Error("Task library unavailable");
  const snapshot = await db.collection("inboundRequests")
    .where("public_task_listing.consentVersion", "==", JOB_SHARED_LISTING_VERSION).get();
  const jobs = await Promise.all(snapshot.docs.map(async (doc): Promise<PublicLiveJob | null> => {
    const record = doc.data() as InboundRequest;
    const { access, session } = await loadCompanyJobAccess(doc.id, record);
    const listed = projectTaskBrowseCard(doc.id, record, access);
    if (!listed || !/^\d{4}-\d{2}-\d{2}/.test(String(listed.publishedAtIso ?? ""))) return null;
    const raw = record as unknown as Record<string, any>;
    const { captureId } = siteWalkthroughIdentity(doc.id, raw);
    // The video reading's kind of job where the keyword category says less (owner, 2026-11-23): fixed words only.
    const { kind, kindKey } = publicJobKind({ taskFamily: listed.taskFamily, categoryTitle: jobTitleForDisplay(listed.title),
      readerKind: jobReadingOf(raw)?.kind ?? null, categoryKinds: KINDS_OF_JOB_TYPE[listed.taskFamily] });
    const ref = publicLiveJobRef(doc.id);
    return { ...(ref ? { ref } : {}), kind, kindKey, country: await countryOf(raw).catch(() => null),
      postedOn: listed.publishedAtIso.slice(0, 10), simulationReady: Boolean(storedCompanySimulation(session, captureId)) };
  }));
  return jobs.filter((job): job is PublicLiveJob => job !== null)
    .sort((a, b) => b.postedOn.localeCompare(a.postedOn) || a.kind.localeCompare(b.kind));
}

/**
 * One listed card as an approved company opens it. Null when not listed. No first look: it stays with the site
 * (Terms 2026-11-25.2; owner, 2026-11-25), so none is composed for a company here.
 */
export async function readTaskCardDetail(id: string): Promise<TaskCardDetail | null> {
  if (!db) throw new Error("Task library unavailable");
  const { record, access, session, brief } = await loadCompanyJobAccess(id);
  const listed = record ? projectTaskBrowseCard(id, record as InboundRequest, access) : null;
  if (!listed || !record) return null;
  return libraryCard(listed, record as InboundRequest, session, brief, 4_000);
}
