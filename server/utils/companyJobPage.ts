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
import { removeIdentifyingDetails, type KnownSiteIdentity } from "../../client/src/lib/contactRedaction";
import { loadCompanyJobAccess } from "./teamJobAccess";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { companyClipUrl, storedCompanyClip } from "./websiteCompanyClip";
import { viewableWebsiteScenePreview, websiteScenePreviewCompanyViewerUrl } from "./websiteScenePreview";
import { loadJobCardAnswerWithRobots } from "./jobCardAnswer";
import { logger } from "../logger";
import { decryptFieldValue } from "./field-encryption";
import { companyMaySeeJobs } from "./companyTerms";

/**
 * The company still stands approved as a deployment company (never a technology partner: the site agreed to share its
 * job with robot deployment companies) AND has accepted the current Terms and Privacy Policy (`companyMaySeeJobs`).
 * Read on every page, media request and introduction.
 */
export async function companyStillApproved(companyId: string, tx?: FirebaseFirestore.Transaction): Promise<boolean> {
  if (!db || !/^[a-f0-9]{64}$/.test(companyId)) return false;
  const ref = db.collection("robotTeamAccess").doc(companyId);
  const record = (tx ? await tx.get(ref) : await ref.get()).data();
  return companyMaySeeJobs(record);
}

/**
 * Every company media request, every byte range: the whole sharing rule (`loadCompanyJobAccess`), the viewer's
 * approval, and the capture is the job's current one.
 */
export async function companyMediaAllowed(requestId: string, captureId: string, companyId: string,
  record?: Record<string, any> | null): Promise<boolean> {
  return (await companyMediaRefusal(requestId, captureId, companyId, record)) === null;
}

/**
 * The same check, saying why: null when allowed; `terms_acceptance_required` for an approved deployment company that
 * has not accepted the current Terms (checked first, so the answer says nothing about the job); else `unavailable`.
 */
export async function companyMediaRefusal(requestId: string, captureId: string, companyId: string,
  record?: Record<string, any> | null): Promise<null | "terms_acceptance_required" | "unavailable"> {
  if (!db || !/^[a-f0-9]{64}$/.test(companyId)) return "unavailable";
  const company = (await db.collection("robotTeamAccess").doc(companyId).get()).data();
  if (company?.status === "approved" && company.partnerRole !== "technology" && !companyMaySeeJobs(company)) return "terms_acceptance_required";
  if (!companyMaySeeJobs(company)) return "unavailable";
  const { record: job, access } = await loadCompanyJobAccess(requestId, record === undefined ? undefined : record ?? null);
  return Boolean(job) && access.listed && siteWalkthroughIdentity(requestId, job ?? undefined).captureId === captureId ? null : "unavailable";
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

/**
 * Everything the job record holds that names or reaches the site, decrypted the way the introduction does it. Read only
 * to remove it from the sentence; never logged, never returned.
 */
export async function knownSiteIdentity(record: Record<string, any>): Promise<KnownSiteIdentity> {
  const read = async (value: unknown): Promise<string | null> => {
    if (value === null || value === undefined || value === "") return null;
    try { return String(await decryptFieldValue(value as never) ?? "").trim() || null; } catch { return null; }
  };
  const contact = record.contact ?? {}, request = record.request ?? {}, place = request.siteLocationMetadata ?? {};
  const [first, last, company, email, phone, siteName, siteLocation, formatted, city, postal] = [
    await read(contact.firstName), await read(contact.lastName), await read(contact.company), await read(contact.email),
    await read(contact.phone), await read(request.siteName), await read(request.siteLocation), await read(place.formattedAddress),
    await read(place.city), await read(place.postalCode)];
  const plain = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
  const placeholder = (value: string | null) => value === "Untitled site" || value === "Location pending" ? null : value;
  return {
    names: [placeholder(siteName), company, first && last ? `${first} ${last}` : null, first, last,
      plain(record.siteName), plain(record.submitterName), plain(record.contactFirstName), plain(record.contactName)],
    addresses: [placeholder(siteLocation), formatted, city, postal, plain(record.site_address)],
    contacts: [email, phone, plain(record.contactEmail), plain(record.contactPhone)],
  };
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
    // The site's own words, with its own known name, organisation, typed address, email and phone, any street-shaped
    // text and any other contact detail removed (`removeIdentifyingDetails`): a company gets those only through an
    // introduction the site asks for.
    sentence: removeIdentifyingDetails(String(brief?.summary ?? "").trim().slice(0, 2000), await knownSiteIdentity(record)),
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
