/**
 * The company's page for one job (package E, E3): what a signed-in, approved deployment company sees at `/jobs/:jobId`.
 *
 * Built field by field. It reads the site's own sentence (the brief's summary), the site's quick answers (`job_facts`),
 * the country (decrypted from the place's country alone, else the capture region; with the state or city only under a
 * statement listed in `RECORDING_VERSION_PLACE_LEVEL`), the job packet's media identities and the Pipeline's facts
 * about the job's object (`packetFactsForCompany`). Not the first look: it stays on the site's own pages (owner,
 * 2026-11-25). It never reads the site's name, typed address, email, phone or the submitter's name, so none can
 * reach the payload; plant-and-prove tests keep it so. Media are tickets bound to this viewer, re-checked on every
 * request (`companyMediaAllowed`).
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { jobTitleForDisplay, type CompanyJobPage } from "../../client/src/types/taskBrowse";
import { COMPANY_RESPONSE_STATEMENT, COMPANY_RESPONSE_STATEMENT_VERSION, isCompanyResponseState, replyByIso } from "../../client/src/lib/companyResponses";
import { jobFactsInWords } from "../../client/src/lib/jobFacts";
import { SIMULATION_STATUS, SITE_IDENTITY_RULE, answerSpeedInWords, fitObjectRow, fitSummary,
  jobHeadline, rateInWords, visitMustConfirm, type FitSummaryRow } from "../../client/src/lib/companyJobPage";
import { jobBriefFitSummary, jobBriefWords, type JobBriefEstimates, type StoredJobBrief } from "../../client/src/lib/jobBrief";
import { readJobFacts } from "./jobFacts";
import { jobThumbnailViewUrl } from "./jobThumbnailTicket";
import { jobReadingOf, readingActionsOf } from "./siteRobotFit";
import { companySimulationUrl, storedCompanySimulation } from "./websiteCompanySimulation";
import { REMOVED, identifyingDetailsRemoved, removeNamesNotHeld } from "../../client/src/lib/contactRedaction";
import { clarificationOnReply, questionOnReply } from "./jobClarifications";
import { knownSiteIdentity } from "./siteIdentity";
import { loadCompanyJobAccess, RECORDING_VERSION_PLACE_LEVEL, taskThumbnailUrl, thumbnailSourceOf } from "./teamJobAccess";
import { recordingStatementShares } from "./jobSharedListing";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { companyClipUrl, storedCompanyClip } from "./websiteCompanyClip";
import { viewableWebsiteScenePreview, websiteScenePreviewCompanyViewerUrl } from "./websiteScenePreview";
import { logger } from "../logger";
import { decryptFieldValue } from "./field-encryption";
import { companyMaySeeJobs } from "./companyTerms";
import { hasInternalTestCompanyMarker, isInternalTestCompanyRow } from "./internalTestCompany";
import { storedPacketFacts, type PacketFacts, type PACKET_FACT_QUESTIONS } from "./websitePreparationStatus";
import type { JobFactKey, JobFacts, JobReading } from "../../client/src/lib/jobFacts";
import type { KnownSiteIdentity } from "../../client/src/lib/contactRedaction";
import { loadScreenings, NOTHING_SCREENED, screenAndWait, siteReplyStateForCompany, siteWordsDeterministic, siteWordsForCompany,
  siteWordsStateForCompany, type Screenings } from "./freeTextScreening";
export { siteWordsDeterministic, siteWordsForCompany };
import type { CompaniesReadSiteWords } from "../../client/src/lib/companiesRead";
import { JOB_DESCRIPTION_MAX_LENGTH } from "../../client/src/lib/jobDescriptionLimit";

/**
 * The company still stands approved as a deployment company (never a technology partner: the site agreed to share its
 * job with robot deployment companies) AND has accepted the current Terms and Privacy Policy (`companyMaySeeJobs`).
 * Read on every page, media request and introduction.
 */
export async function companyStillApproved(companyId: string, tx?: FirebaseFirestore.Transaction): Promise<boolean> {
  return (await companyReaderOf(companyId, tx)).approved;
}

/**
 * Who reads a job page or its media: an approved deployment company under the current Terms (`companyMaySeeJobs`), or
 * Blueprint's own internal test company (`internalTestCompany.ts`), which is shown internal test jobs only: its reads pass
 * `internalTestCompany` to `loadCompanyJobAccess`, which closes every real job to it.
 */
export async function companyReaderOf(companyId: string, tx?: FirebaseFirestore.Transaction):
  Promise<{ approved: boolean; internalTestCompany: boolean; record: Record<string, any> | undefined }> {
  if (!db || !/^[a-f0-9]{64}$/.test(companyId)) return { approved: false, internalTestCompany: false, record: undefined };
  const ref = db.collection("robotTeamAccess").doc(companyId);
  const record = (tx ? await tx.get(ref) : await ref.get()).data();
  const internalTestCompany = isInternalTestCompanyRow(companyId, record);
  return { approved: internalTestCompany || companyMaySeeJobs(record), internalTestCompany, record };
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
  // Blueprint's own internal test company: an internal test job's media only, and no Terms asked of it.
  const internalTestCompany = isInternalTestCompanyRow(companyId, company);
  if (!internalTestCompany && company?.status === "approved" && company.partnerRole !== "technology"
    && !hasInternalTestCompanyMarker(company) && !companyMaySeeJobs(company)) return "terms_acceptance_required";
  if (!internalTestCompany && !companyMaySeeJobs(company)) return "unavailable";
  const { record: job, access } = await loadCompanyJobAccess(requestId, record === undefined ? undefined : record ?? null, undefined,
    internalTestCompany ? { internalTestCompany } : undefined);
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

/** A decrypted city or state field when it looks like a place name (no digit, at most 60 characters); else null. */
async function placeField(stored: unknown): Promise<string | null> {
  if (!stored) return null;
  try {
    const value = String(await decryptFieldValue(stored as any) ?? "").trim();
    return value && value.length <= 60 && !/\d/.test(value) ? value : null;
  } catch (error) {
    logger.warn({ error }, "Could not read the job's place");
    return null;
  }
}

/**
 * The place as a company reads it: the country (`countryOf`), with the state, or the city and state, before it only
 * when the recording statement the site accepted is listed in `RECORDING_VERSION_PLACE_LEVEL`. Reads only the
 * structured city and state fields, never the address, postal code, typed place, site name or coordinates. A field that
 * is missing, unreadable or not place-shaped gives the coarser level, and in the end the country alone.
 */
export async function companyPlaceOf(record: Record<string, any>,
  levels: Readonly<Record<string, "state" | "city">> = RECORDING_VERSION_PLACE_LEVEL): Promise<string | null> {
  const country = await countryOf(record);
  if (!country || !recordingStatementShares(record)) return country;
  const level = levels[String(record.request?.consent_attestation?.statement_version ?? "")];
  if (level !== "state" && level !== "city") return country;
  const metadata = record.request?.siteLocationMetadata;
  const state = await placeField(metadata?.state);
  if (!state) return country;
  const city = level === "city" ? await placeField(metadata?.city) : null;
  return city ? `${city}, ${state}, ${country}` : `${state}, ${country}`;
}

/** Everything the job record holds that names or reaches the site (`siteIdentity.ts`). */
export { knownSiteIdentity };

/** The site's quick question each Pipeline estimate answers (`PACKET_FACT_QUESTIONS`), as the job page keys it. */
const SITE_QUESTION: Readonly<Record<(typeof PACKET_FACT_QUESTIONS)[number], JobFactKey>> = {
  item_weight: "weight", item_size_longest_side: "size", items_per_hour: "perHour", hours_per_day: "hours" };

/**
 * Words from a model reading of the site's video and sentence, as a company may read them (round 2, 2026-11-24: an
 * object's name such as "Harbor Fresh Foods produce crate" and a place such as "Dana Whitfield's returns cart" reached
 * companies through the identity pass alone). Shown only exactly as written, and only when nothing would be taken out of
 * them: not by the site's known identity (`identifyingDetailsRemoved`), not by the name pass (`removeNamesNotHeld`), and
 * not by the model pass over free text (`server/utils/freeTextScreening.ts`, the site's words and budget). A text any of
 * them would change is left out whole rather than shown with a gap; until the model pass has succeeded for the exact
 * text nothing is shown (it fails closed). Blueprint's own name is read by the model pass as "the company", a phrase it
 * leaves alone, so "Blueprint's estimate" is never taken for a business that may name the site; "Blueprint" followed
 * by another capitalised word ("Blueprint Bakery") is read as written.
 */
const OUR_NAME = /\bBlueprint\b(?![^\S\n]*\p{Lu})/gu;
const asScreened = (text: string) => text.replace(OUR_NAME, "the company");
/** Untouched by the site's identity and by the name pass: the text as written could be shown. */
function deterministicPassesKeep(text: string, known: KnownSiteIdentity): boolean {
  return Boolean(text.trim()) && !text.includes(REMOVED) && !identifyingDetailsRemoved(text, known) && removeNamesNotHeld(text) === text;
}
type ScreenedLines = { state: "shown"; kept: boolean[] } | { state: "pending" };
/**
 * Lines read by the model pass as one text, one line each (one pass for a whole set, so the site's budget is not spent
 * line by line). Each line is kept only when the pass left it exactly as it was; a result whose lines no longer line
 * up keeps none.
 */
function modelPassKeeps(lines: readonly string[], screenings: Screenings): ScreenedLines {
  if (!lines.length) return { state: "shown", kept: [] };
  const read = lines.map(line => asScreened(line).replace(/\s*\n\s*/g, " "));
  const screened = screenings.stateOf("site", read.join("\n"), "site");
  if (screened.state !== "shown") return { state: "pending" };
  const back = screened.text.split("\n");
  return { state: "shown", kept: back.length === read.length ? read.map((line, index) => back[index] === line && !line.includes(REMOVED))
    : read.map(() => false) };
}

/**
 * The Pipeline's packet facts as a company reads them. Blueprint's estimate of a question the site answered on its job
 * page is left out (the site's own answer is shown; "Not sure" answers nothing). The object's name, the place's label,
 * the material and the basis of an estimate are a model's reading of the site's video and sentence, written into
 * Blueprint's own lines, so every line is read as words that may echo the site's (`deterministicPassesKeep`,
 * `modelPassKeeps`): a line any pass would change is left out whole. Until the model pass over the lines has succeeded,
 * none is shown and `pending` says so. `estimated` names the site's questions that a line Blueprint shows does answer,
 * so the fit summary can point to it.
 */
export function packetFactsForCompany(facts: PacketFacts | null, answers: Partial<JobFacts> | null,
  known: KnownSiteIdentity, screenings: Screenings = NOTHING_SCREENED()):
  { packetFacts: CompanyJobPage["packetFacts"]; estimated: JobFactKey[]; pending: boolean } {
  if (!facts) return { packetFacts: null, estimated: [], pending: false };
  const answered = (question: keyof typeof SITE_QUESTION) => {
    const code = answers?.[SITE_QUESTION[question]];
    return typeof code === "string" && code !== "unsure";
  };
  const sections = (["object", "measured", "estimated"] as const).map(section => ({ section,
    rows: facts[section].filter(row => !(row.answers && answered(row.answers)) && deterministicPassesKeep(row.text, known)) }));
  const screened = modelPassKeeps(sections.flatMap(({ rows }) => rows.map(row => row.text)), screenings);
  if (screened.state !== "shown") return { packetFacts: null, estimated: [], pending: true };
  let index = 0;
  const kept = sections.map(({ section, rows }) => ({ section, rows: rows.filter(() => screened.kept[index++]) }));
  const lines = (section: (typeof kept)[number]["section"]) => kept.find(item => item.section === section)!.rows.map(row => row.text);
  const estimated = new Set<JobFactKey>();
  for (const { rows } of kept) for (const row of rows) if (row.answers) estimated.add(SITE_QUESTION[row.answers]);
  return { packetFacts: { object: lines("object"), measured: lines("measured"), estimated: lines("estimated") },
    estimated: [...estimated], pending: false };
}

const isName = (value: string | null): value is string => Boolean(value);
/**
 * A name from the video reading as a company may read it: exactly as written when neither the site's identity, the name
 * pass nor the model pass would change it, else nothing (`deterministicPassesKeep`, `modelPassKeeps`).
 */
function companyJobObject(name: string | null, known: KnownSiteIdentity, screenings: Screenings): string | null {
  const clean = name?.trim() ?? "";
  if (!clean || clean !== name || !deterministicPassesKeep(clean, known)) return null;
  const screened = modelPassKeeps([clean], screenings);
  return screened.state === "shown" && screened.kept[0] ? clean : null;
}

/**
 * The "At a glance" rows as a company reads them: the job's brief (`client/src/lib/jobBrief.ts`) when it is current and
 * at least three of its rows can be shown (`jobBriefFitSummary`), else the catalog's rows (`fitSummary`). The brief's
 * labels, quotes and choices are a model's words and the site's own, so each is read as the reading's words are
 * (`deterministicPassesKeep`, then `modelPassKeeps` over all of them as one text): a word any pass would change is not
 * shown, a row whose label or value is not shown is left out, and while the model pass has not read them, or the
 * site's identity cannot be read, the catalog's rows are shown. Every value is written by code from the job record.
 */
export function companyFitSummary(input: { jobBrief: StoredJobBrief | null; estimates: JobBriefEstimates | null; sentence: string;
  facts: Partial<JobFacts> | null; taskFamily: string; reading: Pick<JobReading, "kind" | "object" | "others"> | null;
  estimated: ReadonlySet<JobFactKey> }, known: KnownSiteIdentity | null, screenings: Screenings = NOTHING_SCREENED()): FitSummaryRow[] {
  const catalog = () => fitSummary(input.facts, input.taskFamily, input.reading, input.estimated);
  if (!input.jobBrief || !known) return catalog();
  const words = jobBriefWords(input.jobBrief).filter(text => deterministicPassesKeep(text, known));
  const screened = modelPassKeeps(words, screenings);
  if (screened.state !== "shown") return catalog();
  const kept = new Set(words.filter((_, index) => screened.kept[index]));
  return jobBriefFitSummary(input.jobBrief, { facts: input.facts, estimates: input.estimates, sentence: input.sentence,
    estimated: input.estimated, shown: text => kept.has(text), objectRow: fitObjectRow(input.reading) }) ?? catalog();
}

/**
 * The job's title from the video reading (`jobHeadline`), with the object's name only as `companyJobObject` allows: no
 * name at all without the site's identity, or while the model pass over it has not succeeded.
 */
export function companyJobHeadline(record: Record<string, any>, taskFamily: string, fallback: string,
  known: KnownSiteIdentity | null, screenings: Screenings = NOTHING_SCREENED()): string {
  const reading = jobReadingOf(record);
  const object = known ? companyJobObject(reading?.object ?? null, known, screenings) : null;
  return jobHeadline({ kind: reading?.kind ?? null, object, actions: readingActionsOf(record), taskFamily, fallback });
}

/**
 * About the site, with nothing that identifies it: that its identity comes only with an introduction it asks for, and
 * how quickly it has answered companies' questions here (the median, from questions asked and answered on this job;
 * nothing when none has been). That the site agreed to share the job is not said to the company (owner, 2026-11-25:
 * the page said more than a company acts on).
 */
export async function aboutTheSite(requestId: string): Promise<string[]> {
  const lines: string[] = [SITE_IDENTITY_RULE];
  if (!db) return lines;
  try {
    // One row per company that answered this job; bounded, as the job page reads it on every visit.
    const replies = await db.collection("inboundRequests").doc(requestId).collection("robotTeamInterest").limit(200).get();
    const hours: number[] = [];
    for (const doc of replies.docs) {
      const reply = doc.data();
      const asked = Date.parse(String(reply?.questionAskedAtIso ?? ""));
      const answered = Date.parse(String(reply?.siteClarification?.answeredAtIso ?? ""));
      if (reply?.siteClarification?.questionId === reply?.questionId && Number.isFinite(asked) && Number.isFinite(answered)
        && answered >= asked) hours.push((answered - asked) / 3_600_000);
    }
    hours.sort((a, b) => a - b);
    const median = hours.length ? hours[Math.floor((hours.length - 1) / 2)] : null;
    const speed = answerSpeedInWords(median);
    if (speed) lines.push(speed);
  } catch (error) {
    logger.warn({ error, requestId }, "Could not read how quickly the site answers questions");
  }
  return lines;
}

/** The site's sentence as the deterministic pass reads it: the brief's summary, at most the one description limit. */
export const siteSentenceSource = (brief: { summary?: unknown } | undefined | null) => String(brief?.summary ?? "").trim().slice(0, JOB_DESCRIPTION_MAX_LENGTH);
/** The site's success rule as the deterministic pass reads it, or "" when the site said it does not know. */
export const siteSuccessRuleSource = (brief: { successCriteria?: any } | undefined | null) =>
  brief?.successCriteria?.unknown ? "" : String(brief?.successCriteria?.successDefinition ?? "").trim().slice(0, 1000);

/**
 * The site's own sentence as a deployment company reads it, on the job page and on its card in the list
 * (`siteWordsForCompany`). Empty while its model pass has not succeeded, or when the identity cannot be read.
 */
export function siteSentenceForCompany(brief: { summary?: unknown } | undefined | null, known: KnownSiteIdentity | null,
  screenings: Screenings): string {
  return siteWordsForCompany(siteSentenceSource(brief), known, screenings);
}

/**
 * What deployment companies read of the site's own sentence and success rule, for the site's own page (2026-11-24):
 * exactly the words a company's page shows (`siteWordsForCompany`), or `pending` while the model pass over them has not
 * succeeded. A text the pass has not read yet is screened now, waiting at most `waitMs`. Null when the site's identity
 * cannot be read (a company then reads none of its words either).
 */
export async function companiesReadSiteWords(requestId: string, record: Record<string, any>,
  brief: { summary?: unknown; successCriteria?: any } | null | undefined, waitMs = 5_000): Promise<CompaniesReadSiteWords | null> {
  const known = await knownSiteIdentity(record).catch(() => null);
  if (!known) return null;
  const read = (screenings: Screenings) => {
    const view: CompaniesReadSiteWords = {};
    for (const [field, source] of [["sentence", siteSentenceSource(brief)], ["successRule", siteSuccessRuleSource(brief)]] as const) {
      if (!siteWordsDeterministic(source, known).trim()) continue;
      const read = siteWordsStateForCompany(source, known, screenings);
      // Shown, being prepared, or held at a limit: each said plainly on the site's page.
      view[field] = read.state === "shown" && read.text ? { text: read.text } : read.state === "limit" ? { limit: true } : { pending: true };
    }
    return view;
  };
  const first = await loadScreenings(requestId);
  const view = read(first);
  if (!first.missing.length) return view;
  return await screenAndWait(requestId, first.missing, waitMs) ? read(await loadScreenings(requestId)) : view;
}

/** The page payload for one viewer, or null when the job is not listed (refused alike with a job that does not exist). */
export async function loadCompanyJobPage(requestId: string, viewer: { companyId: string }): Promise<CompanyJobPage | null> {
  if (!db) throw new Error("company_job_store_unavailable");
  // The viewer must still be an approved deployment company, whatever the library gate decided, or Blueprint's internal
  // test company, which reads an internal test job only (`companyReaderOf`).
  const reader = await companyReaderOf(viewer.companyId);
  if (!reader.approved) return null;
  const { record, access, brief, session } = await loadCompanyJobAccess(requestId, undefined, undefined,
    reader.internalTestCompany ? { internalTestCompany: true } : undefined);
  if (!record || !access.listed) return null;
  const { captureId } = siteWalkthroughIdentity(requestId, record);
  const [answerRow, country, known, about, stage, screenings] = await Promise.all([
    db.collection("inboundRequests").doc(requestId).collection("robotTeamInterest").doc(viewer.companyId).get().then(doc => doc.data()),
    companyPlaceOf(record),
    knownSiteIdentity(record).catch(() => null),
    aboutTheSite(requestId),
    import("./taskBrowse").then(({ libraryJobStage }) => libraryJobStage(requestId, record)).catch(() => null),
    loadScreenings(requestId),
  ]);
  const facts = readJobFacts(record);
  const storedFacts = storedPacketFacts(session?.website_preparation);
  const reading = jobReadingOf(record);
  // The job's brief, when it was written from what the record holds now; a job with a reading and none gets one
  // written in the background, never waited for (the catalog's rows are shown meanwhile).
  const { jobBriefOfRecord, requestJobBrief } = await import("./jobBrief");
  const jobBrief = jobBriefOfRecord(record, brief);
  if (jobBrief.wanted) requestJobBrief(requestId);
  const taskFamily = access.details.taskFamily;
  const clip = storedCompanyClip(session, captureId);
  const clipUrl = clip ? companyClipUrl(requestId, captureId, viewer.companyId) : null;
  const preview = viewableWebsiteScenePreview(record, session, captureId);
  const simulationPackage = storedCompanySimulation(session, captureId);
  const simulationUrl = simulationPackage ? companySimulationUrl(requestId, captureId, viewer.companyId) : null;
  const viewerUrl = preview ? websiteScenePreviewCompanyViewerUrl(requestId, captureId, viewer.companyId) : null;
  const question = questionOnReply(answerRow);
  const clarification = question ? clarificationOnReply(answerRow, question.id) : undefined;
  // The site's words as this company reads them (`siteWordsForCompany`, `siteReplyForCompany`): each empty (or the reply
  // null) while the model pass over it has not succeeded. Words it has not read yet are screened now, the page waiting
  // a few seconds for them; a pass still running then goes on, and a later visit shows its result.
  // The words a model read from the site's video and sentence go the same way: the Pipeline's packet facts and the
  // reading's object names (`packetFactsForCompany`, `companyJobObject`). Identity that cannot be read right now: no
  // sentence, no packet facts and no object name this time, never one that might name the site.
  const siteWords = (results: Screenings) => {
    const packet = known ? packetFactsForCompany(storedFacts, facts, known, results)
      : { packetFacts: null, estimated: [] as JobFactKey[], pending: Boolean(storedFacts) };
    const readingShown = reading && known ? { ...reading, object: companyJobObject(reading.object, known, results),
      others: reading.others.map(item => companyJobObject(item, known, results)).filter(isName) }
      : reading ? { ...reading, object: null, others: [] } : null;
    return {
      sentence: siteSentenceForCompany(brief, known, results),
      successRule: siteWordsStateForCompany(siteSuccessRuleSource(brief), known, results),
      clarification: clarification === undefined ? undefined : siteReplyStateForCompany(clarification, known, results),
      packet,
      headline: companyJobHeadline(record, taskFamily, jobTitleForDisplay(access.details.title), known, results),
      // The job's brief, else the questions the site's page asked, chosen the same way, "Not stated" where the site
      // skipped one; the object's name only as `companyJobObject` allows it (`companyFitSummary`).
      fit: companyFitSummary({ jobBrief: jobBrief.current, estimates: jobBrief.estimates, sentence: jobBrief.sentence, facts,
        taskFamily, reading: readingShown, estimated: new Set(packet.estimated) }, known, results),
    };
  };
  let words = siteWords(screenings);
  if (screenings.missing.length && await screenAndWait(requestId, screenings.missing, 4_000))
    words = siteWords(await loadScreenings(requestId));
  const { sentence, successRule: successRead, clarification: clarificationRead, packet, headline, fit } = words;
  const successRule = successRead.state === "shown" ? successRead.text : "";
  // A rule the site gave that is not shown yet is said so, never as "The site has not said what counts as done yet"
  // (a review of PR #1437).
  const successRulePending = successRead.state !== "shown" && Boolean(siteSuccessRuleSource(brief));
  // The simulation says where it stands instead of showing an empty box.
  const simulationStatus = simulationUrl || viewerUrl ? null : SIMULATION_STATUS[stage ?? "unknown"];
  return {
    schemaVersion: "company_job_page.v1",
    id: requestId,
    title: access.details.title,
    // The title built from the job's facts ("Scrape and scoop cake batter"); the category title until a reading names it.
    headline,
    headlineFacts: rateInWords(facts),
    taskFamily,
    publishedAtIso: String(record.public_task_listing?.approvedAtIso ?? ""),
    // The site's own words, with its own known name, organisation, typed address, email and phone, any street-shaped
    // text and any other contact detail removed (`removeIdentifyingDetails`), then any name-shaped text the record does
    // not hold (`removeNamesNotHeld`), then whatever the model pass finds, then both again (`siteWordsForCompany`):
    // a company gets the site's name only through an introduction the site asks for. Empty until the model pass is done.
    sentence,
    ...(successRule ? { successRule } : {}),
    ...(successRulePending ? { successRulePending: true as const } : {}),
    // The questions the site's page asked, chosen the same way: the reading's kind of job, else the keyword match.
    jobFacts: jobFactsInWords(facts, taskFamily, reading),
    // The facts that decide this job, from its brief (`companyFitSummary`), else the catalog's: "Not stated" where the
    // site skipped one; the object's name only as `companyJobObject` allows it.
    fitSummary: fit,
    country,
    video: clip && clipUrl ? { state: "ready", url: clipUrl, width: clip.width, height: clip.height, durationSeconds: clip.duration_seconds }
      : { state: "preparing" },
    // The ticketed address this company's browser can load as the video's poster (`jobThumbnailViewUrl`).
    thumbnailUrl: taskThumbnailUrl(requestId, record) ? jobThumbnailViewUrl(requestId, viewer.companyId) : null,
    thumbnailSource: taskThumbnailUrl(requestId, record) ? thumbnailSourceOf(record) : null,
    // The Pipeline says whether the package holds the job's object (`object_included`); said only when it does not.
    simulationDownload: simulationUrl ? { state: "ready", url: simulationUrl,
      ...(simulationPackage?.object_included === false ? { objectIncluded: false as const } : {}) } : { state: "not_finished" },
    simulation: viewerUrl ? { state: "ready", viewerUrl } : { state: "not_finished" },
    simulationStatus,
    packetFacts: packet.packetFacts,
    ...(packet.pending ? { packetFactsPending: true as const } : {}),
    visitMustConfirm: [...visitMustConfirm(reading?.kind ?? null, taskFamily)],
    aboutSite: about,
    myAnswer: answerRow && isCompanyResponseState(answerRow.state) ? { state: answerRow.state,
      inputs: typeof answerRow.inputs === "string" ? answerRow.inputs : "", updatedAtIso: String(answerRow.updatedAtIso ?? ""),
      statementVersion: typeof answerRow.statementVersion === "string" ? answerRow.statementVersion : null,
      ...(answerRow.details ? { details: answerRow.details } : {}) } : null,
    // The site's reply: null while the model pass over it has not succeeded (the page says it is being prepared).
    ...(question && clarification ? { clarification: { question: question.text,
      answer: clarificationRead?.state === "shown" ? clarificationRead.text : null,
      ...(clarificationRead?.state === "limit" ? { limitReached: true as const } : {}) } } : {}),
    // The company's own question while the site has not replied, with its reply date (`REPLY_WINDOW_MS`).
    ...(question && !clarification && replyByIso(answerRow?.questionAskedAtIso) ? { pendingQuestion: {
      askedAtIso: String(answerRow!.questionAskedAtIso), replyByIso: replyByIso(answerRow!.questionAskedAtIso)!,
      reminded: answerRow?.replyReminder?.questionId === question.id } } : {}),
    responseStatement: { version: COMPANY_RESPONSE_STATEMENT_VERSION, text: COMPANY_RESPONSE_STATEMENT },
  };
}
