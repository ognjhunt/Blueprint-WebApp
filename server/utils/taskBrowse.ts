import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { InboundRequest } from "../types/inbound-request";
import type { LibraryJobStage, TaskBrowseCard, TaskCardDetail } from "../../client/src/types/taskBrowse";
import { jobCardAnswerShared, loadJobCardAnswer, loadJobCardAnswerHeadline } from "./jobCardAnswer";
import { loadCompanyJobAccess, taskThumbnailUrl, teamJobAccess, type TeamJobAccess, type TeamJobAccessContext } from "./teamJobAccess";
import { JOB_SHARED_LISTING_VERSION } from "./taskListingDetails";
import { countryOf } from "./companyJobPage";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { storedCompanySimulation } from "./websiteCompanySimulation";

/**
 * The job card approved deployment companies see in the library: category title and stage only. Whether it appears is
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
    thumbnailUrl: taskThumbnailUrl(id, record) };
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
    if (phase === "testing" || phase === "result") return "simulation_built";
    if (phase === "building") return "simulation_building";
    if (phase === "reading" || phase === "waiting_on_site") return "video_received";
    return null;
  } catch {
    return null;
  }
}

async function libraryCard(card: TaskBrowseCard, record: Record<string, any>,
  session?: FirebaseFirestore.DocumentData): Promise<TaskBrowseCard> {
  const { captureId } = siteWalkthroughIdentity(card.id, record);
  const simulationDownloadAvailable = Boolean(storedCompanySimulation(session, captureId));
  const [country, simulationStage] = await Promise.all([
    countryOf(record),
    simulationDownloadAvailable ? "simulation_built" as const : libraryJobStage(card.id, record),
  ]);
  return { ...card, region: card.region || country || "", simulationStage, simulationDownloadAvailable };
}

/**
 * `withAnswerHeadlines` adds the answer's headline to a card whose site chose to share its answer and whose
 * current listing consent still names it (`jobCardAnswerShared`). No answer is composed for any other card.
 */
export async function listTaskBrowseCards(options: { withAnswerHeadlines?: boolean } = {}): Promise<TaskBrowseCard[]> {
  if (!db) throw new Error("Task library unavailable");
  // Only jobs shared under the current listing record can be listed (E2); older cards are not read at all.
  const snapshot = await db.collection("inboundRequests")
    .where("public_task_listing.consentVersion", "==", JOB_SHARED_LISTING_VERSION).limit(200).get();
  const cards = await Promise.all(snapshot.docs.map(async (doc): Promise<TaskBrowseCard | null> => {
    const record = doc.data() as InboundRequest;
    const { access, session } = await loadCompanyJobAccess(doc.id, record);
    const listed = projectTaskBrowseCard(doc.id, record, access);
    if (!listed) return null;
    const [card, headline] = await Promise.all([libraryCard(listed, record, session),
      options.withAnswerHeadlines && jobCardAnswerShared(record) ? loadJobCardAnswerHeadline(doc.id, record) : null]);
    return headline ? { ...card, answerHeadline: headline } : card;
  }));
  return cards.filter((card): card is TaskBrowseCard => card !== null)
    .sort((a, b) => b.publishedAtIso.localeCompare(a.publishedAtIso));
}

/** One listed card as an approved company opens it, with the answer when the site shared it. Null when not listed. */
export async function readTaskCardDetail(id: string): Promise<TaskCardDetail | null> {
  if (!db) throw new Error("Task library unavailable");
  const { record, access, session } = await loadCompanyJobAccess(id);
  const listed = record ? projectTaskBrowseCard(id, record as InboundRequest, access) : null;
  if (!listed || !record) return null;
  const [card, answerSummary] = await Promise.all([libraryCard(listed, record as InboundRequest, session), loadJobCardAnswer(id, record)]);
  return answerSummary ? { ...card, answerHeadline: answerSummary.headline, answerSummary } : card;
}
