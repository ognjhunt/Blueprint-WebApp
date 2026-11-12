/**
 * The company's page for one job (package E, E3): what a signed-in, approved deployment company sees at `/jobs/:jobId`.
 *
 * Built field by field. It reads the site's own sentence (the brief's summary), the site's quick answers (`job_facts`),
 * the country (decrypted from the place's country alone, else the capture region), the job packet's media identities
 * and the first look. It never reads the site's name, typed address, email, phone or the submitter's name, so none can
 * reach the payload; plant-and-prove tests keep it so. Media are tickets bound to this viewer, re-checked on every
 * request (`companyMediaAllowed`).
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { CompanyFirstLookRow, CompanyJobPage } from "../../client/src/types/taskBrowse";
import { COMPANY_RESPONSE_STATEMENT, COMPANY_RESPONSE_STATEMENT_VERSION, isCompanyResponseState } from "../../client/src/lib/companyResponses";
import { jobFactsInWords } from "../../client/src/lib/jobFacts";
import { firstLookRowFromAnswerRobot, firstLookRowInWords } from "../../client/src/lib/firstLookWords";
import { readJobFacts } from "./jobFacts";
import { firstLookFromStoredPreparation } from "./firstLookTable";
import { companySimulationUrl, storedCompanySimulation } from "./websiteCompanySimulation";
import { removeContactDetails } from "../../client/src/lib/contactRedaction";
import { loadCompanyJobAccess } from "./teamJobAccess";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { companyClipUrl, storedCompanyClip } from "./websiteCompanyClip";
import { viewableWebsiteScenePreview, websiteScenePreviewCompanyViewerUrl } from "./websiteScenePreview";
import { loadJobCardAnswerWithRobots } from "./jobCardAnswer";
import { logger } from "../logger";
import { decryptFieldValue } from "./field-encryption";

/**
 * The company still stands approved as a deployment company (never a technology partner: the site agreed to share its
 * job with robot deployment companies). Read on every page, media request and introduction.
 */
export async function companyStillApproved(companyId: string, tx?: FirebaseFirestore.Transaction): Promise<boolean> {
  if (!db || !/^[a-f0-9]{64}$/.test(companyId)) return false;
  const ref = db.collection("robotTeamAccess").doc(companyId);
  const record = (tx ? await tx.get(ref) : await ref.get()).data();
  return record?.status === "approved" && record.partnerRole !== "technology";
}

/**
 * Every company media request, every byte range: the whole sharing rule (`loadCompanyJobAccess`), the viewer's
 * approval, and the capture is the job's current one.
 */
export async function companyMediaAllowed(requestId: string, captureId: string, companyId: string,
  record?: Record<string, any> | null): Promise<boolean> {
  const [{ record: job, access }, approved] = await Promise.all([
    loadCompanyJobAccess(requestId, record === undefined ? undefined : record ?? null), companyStillApproved(companyId)]);
  return Boolean(job) && access.listed && approved && siteWalkthroughIdentity(requestId, job ?? undefined).captureId === captureId;
}

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

/** A two-letter country code as its English name; anything else (a name, free text, an unknown code) is no country. */
export function countryName(value: string): string | null {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  try {
    const name = REGION_NAMES.of(code);
    return name && name !== code && name !== "Unknown Region" ? name : null;
  } catch { return null; }
}

/**
 * The country only: the place's decrypted country field when it is a two-letter code, shown as its English name; else
 * the closed region the site chose (`capture_region`, "us"). Never the address or any free text.
 */
export async function countryOf(record: Record<string, any>): Promise<string | null> {
  const stored = record.request?.siteLocationMetadata?.country;
  if (stored) {
    try {
      const value = String(await decryptFieldValue(stored) ?? "").trim();
      const name = countryName(value);
      if (name) return name;
    } catch (error) {
      logger.warn({ error }, "Could not read the job's country");
    }
  }
  return record.request?.capture_region === "us" ? "United States" : null;
}

/** The page payload for one viewer, or null when the job is not listed (refused alike with a job that does not exist). */
export async function loadCompanyJobPage(requestId: string, viewer: { companyId: string }): Promise<CompanyJobPage | null> {
  if (!db) throw new Error("company_job_store_unavailable");
  // The viewer must still be an approved deployment company, whatever the library gate decided.
  const [{ record, access }, approved] = await Promise.all([loadCompanyJobAccess(requestId), companyStillApproved(viewer.companyId)]);
  if (!record || !access.listed || !approved) return null;
  const { captureId } = siteWalkthroughIdentity(requestId, record);
  const [brief, session, answerRow, firstLook, country] = await Promise.all([
    db.collection("siteTaskBriefs").doc(requestId).get().then(doc => doc.data()),
    db.collection("captureUploadSessions").doc(captureId).get().then(doc => doc.data()),
    db.collection("inboundRequests").doc(requestId).collection("robotTeamInterest").doc(viewer.companyId).get().then(doc => doc.data()),
    loadJobCardAnswerWithRobots(requestId, record),
    countryOf(record),
  ]);
  const facts = readJobFacts(record);
  const clip = storedCompanyClip(session, captureId);
  const clipUrl = clip ? companyClipUrl(requestId, captureId, viewer.companyId) : null;
  const preview = viewableWebsiteScenePreview(record, session, captureId);
  const simulationPackage = storedCompanySimulation(session, captureId);
  const simulationUrl = simulationPackage ? companySimulationUrl(requestId, captureId, viewer.companyId) : null;
  const viewerUrl = preview ? websiteScenePreviewCompanyViewerUrl(requestId, captureId, viewer.companyId) : null;
  // The Pipeline's first look in words (the same function the site's page uses), else today's two robots.
  const table = firstLookFromStoredPreparation(session?.website_preparation, record);
  const rows: CompanyFirstLookRow[] = table ? table.rows.map(({ verdict, text, robot }) => ({ verdict, text, robot })) : firstLook.robots.map(robot => {
    const words = firstLookRowInWords(firstLookRowFromAnswerRobot(robot), facts);
    return { verdict: words.verdict, text: words.text, robot: words.robot };
  });
  return {
    schemaVersion: "company_job_page.v1",
    id: requestId,
    title: access.details.title,
    taskFamily: access.details.taskFamily,
    publishedAtIso: String(record.public_task_listing?.approvedAtIso ?? ""),
    // The site's own words, with any email, phone number or link it typed removed: a company gets those only through an
    // introduction the site asks for.
    sentence: removeContactDetails(String(brief?.summary ?? "").trim().slice(0, 2000)),
    jobFacts: jobFactsInWords(facts),
    country,
    video: clip && clipUrl ? { state: "ready", url: clipUrl, width: clip.width, height: clip.height, durationSeconds: clip.duration_seconds }
      : { state: "preparing" },
    simulationDownload: simulationUrl ? { state: "ready", url: simulationUrl } : { state: "not_finished" },
    simulation: viewerUrl ? { state: "ready", viewerUrl } : { state: "not_finished" },
    firstLook: firstLook.summary,
    firstLookRows: rows,
    firstLookMore: table?.more ?? null,
    myAnswer: answerRow && isCompanyResponseState(answerRow.state) ? { state: answerRow.state,
      inputs: typeof answerRow.inputs === "string" ? answerRow.inputs : "", updatedAtIso: String(answerRow.updatedAtIso ?? ""),
      statementVersion: typeof answerRow.statementVersion === "string" ? answerRow.statementVersion : null } : null,
    responseStatement: { version: COMPANY_RESPONSE_STATEMENT_VERSION, text: COMPANY_RESPONSE_STATEMENT },
  };
}
