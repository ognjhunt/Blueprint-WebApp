/**
 * The model pass over a person's own words before the other side reads them (2026-11-24, after a $0 stress test found
 * names, phone numbers, web addresses and street numbers reaching companies through pattern matching alone).
 *
 * Defence in depth, in this order, for every piece of free text that crosses between a site and a deployment company
 * (the site's sentence and success rule and its replies to a company's question; a company's reason, question, what it
 * verified and what a visit must confirm):
 *
 * 1. The deterministic pass (`client/src/lib/contactRedaction.ts`): the writer's own identity the website holds, street
 *    and place forms, emails, phone numbers, links, handles, and name-shaped words.
 * 2. This pass: the `free_text_redaction` lane reads what step 1 left and points at the pieces still naming or locating
 *    a person or a business. Plain code replaces each piece it finds in the text with "[removed]" and ignores the rest,
 *    so the model can only take words out, never add or change any (`applyRemovals`).
 * 3. The deterministic pass again, on what step 2 left, every time the words are read.
 *
 * It fails closed: until step 2 has succeeded for the exact text, the other side does not read the text at all. It
 * still reads everything else about the job or the answer, as when no words were given. Nothing waits on a person.
 *
 * Results are stored by a digest of the exact text step 2 read (`inboundRequests/{job}/freeTextScreenings/{digest}`,
 * Admin SDK only): the text with the pieces taken out, never the pieces, never the text before. A changed text is a new
 * digest and is read again.
 *
 * Money (a hard stop): before each pass, its most possible cost is held against the job's one $40 cap, with every
 * ledger of the job counted, in the transaction that claims it (`jobLaneSpend.ts`); it is settled at the cost the run
 * reports. A pass the cap leaves no room for does not start, and the words stay unread. Every pass also goes through the
 * agent runtime (its data-class gate, per-run cost cap, rolling spend stop, cost record and "no funds" handling), on the
 * small tier at low effort with an 800-token output ceiling, and a job has at most `SCREENING_PASSES_PER_JOB` passes
 * ever. With no provider the policy permits configured, no pass starts and nothing is held or counted.
 */
import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { REMOVED, removeIdentifyingDetails, removeNamesNotHeld, type KnownSiteIdentity } from "../../client/src/lib/contactRedaction";
import { logger } from "../logger";

export const FREE_TEXT_SCREENING_COLLECTION = "freeTextScreenings";
export const FREE_TEXT_SCREENING_SCHEMA = "free-text-screening.v1";
/** Whose words: a site's (read by deployment companies) or a deployment company's (read by the site). */
export type ScreeningWriter = "site" | "company";

/**
 * At most this many passes per job, ever, over every piece of text and every retry. One pass on the lane's default
 * (gpt-6-luna at $0.10 per million input tokens and $0.50 per million output tokens, `server/utils/openaiPromptCache.ts`)
 * reads about two thousand tokens and writes at most 800, so the cap bounds a job's passes far below a dollar there.
 */
export const SCREENING_PASSES_PER_JOB = 200;
/** How long a page waits for a pass before it shows the words as not ready yet. */
export const SCREENING_WAIT_MS = 8_000;
/** A claimed pass that has not ended in this long is taken as lost (the process stopped) and may be claimed again. */
const CLAIM_LOST_AFTER_MS = 3 * 60_000;
/** After a failed pass, the next is allowed after one minute, then four, sixteen, … at most six hours. */
const retryAfterMs = (attempts: number) => Math.min(60_000 * 4 ** Math.max(0, attempts - 1), 6 * 60 * 60_000);
const BUDGET_DOC = "budget";
/** The longest piece the model may point at, and the most pieces it may name. */
const PIECE_MAX = 300;

export function screeningKey(writer: ScreeningWriter, text: string): string {
  return createHash("sha256").update(`${FREE_TEXT_SCREENING_SCHEMA}\n${writer}\n${text}`).digest("hex");
}

/** Text with no letter left beside the placeholders needs no pass: nothing in it can name anyone. */
export function needsScreening(text: string): boolean {
  return /\p{L}/u.test(text.split(REMOVED).join(" ").replace(/\bthe (?:site|company)\b/gi, " "));
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The model's answer applied: each piece it named that is found in the text (letter case and the spacing between its
 * words aside) becomes "[removed]", wherever it occurs; a piece not in the text is ignored. Nothing else changes, so
 * the result never holds a word the text did not.
 */
export function applyRemovals(text: string, pieces: readonly unknown[]): string {
  const usable = [...new Set(pieces.filter((piece): piece is string => typeof piece === "string")
    .map(piece => piece.normalize("NFKC").trim()).filter(piece => piece.length >= 2 && piece.length <= PIECE_MAX)
    .filter(piece => piece !== REMOVED && !/^the (?:site|company)$/i.test(piece)))]
    // Longest first, so a whole name goes before a part of it.
    .sort((a, b) => b.length - a.length);
  let out = text;
  for (const piece of usable) {
    const words = piece.split(/\s+/).map(escapeRegExp);
    // Whole words only at the piece's ends ("Joe" is not taken out of "Joey"), unless the piece starts or ends with
    // something other than a letter or digit.
    const lead = /^[\p{L}\p{N}]/u.test(piece) ? "(?<![\\p{L}\\p{N}])" : "";
    const tail = /[\p{L}\p{N}]$/u.test(piece) ? "(?![\\p{L}\\p{N}])" : "";
    out = out.replace(new RegExp(`${lead}${words.join("\\s+")}${tail}`, "giu"), REMOVED);
  }
  return out.replace(/\[removed\](?:[^\S\n]+\[removed\])+/g, REMOVED);
}

/**
 * A model pass: the pieces of the text to take out, or null when it did not answer. A scripted pass may also say what
 * it cost (`costUsd`); otherwise it costs nothing.
 */
export type FreeTextRedactor = (input: { writer: ScreeningWriter; text: string; requestId: string }) =>
  Promise<unknown[] | { remove: unknown[] | null; costUsd?: number } | null>;

let redactorOverride: FreeTextRedactor | null = null;
/**
 * Unit tests and the local journey harness only: a scripted pass in place of the model (as the harness scripts its
 * video model). Null puts the model back.
 */
export function useFreeTextRedactor(redactor: FreeTextRedactor | null) {
  redactorOverride = redactor;
}

/** Whether a pass can start at all: the scripted one, or a provider the policy permits for the lane is configured. */
async function redactorAvailable(): Promise<boolean> {
  if (redactorOverride) return true;
  const { getStructuredProviderOrder } = await import("../agents/provider-config");
  return getStructuredProviderOrder("free_text_redaction").length > 0;
}

/** What one pass returned: the pieces (null when it did not answer) and what it cost (null when that is not known). */
type PassResult = { pieces: unknown[] | null; costUsd: number | null; basis: "reported_usage" | "no_provider_request" | "scripted" };

async function modelPass(input: { writer: ScreeningWriter; text: string; requestId: string }): Promise<PassResult> {
  if (redactorOverride) {
    const answer = await redactorOverride(input);
    const pieces = Array.isArray(answer) ? answer : answer && Array.isArray(answer.remove) ? answer.remove : null;
    const cost = !Array.isArray(answer) && answer && typeof answer.costUsd === "number" ? answer.costUsd : 0;
    return { pieces, costUsd: cost, basis: "scripted" };
  }
  const { runAgentTask } = await import("../agents/runtime");
  const { runCostUsd } = await import("./jobLaneSpend");
  const result = await runAgentTask<{ writer: ScreeningWriter; text: string }, { remove?: unknown }>({
    kind: "free_text_redaction", input: { writer: input.writer, text: input.text },
    metadata: { request_id: input.requestId },
  }, {
    dispatchQueuedOnFinish: false,
    // A site's words follow the Privacy Policy version its job was started under; a company's words, the strictest
    // table of every version (no binding), since they were not given under the site's acceptance.
    ...(input.writer === "site" ? { privacyRequestBinding: { request_id: input.requestId } } : {}),
  });
  const costUsd = runCostUsd(result as { artifacts?: Record<string, unknown> });
  return { pieces: result.status === "completed" && Array.isArray(result.output?.remove) ? result.output!.remove as unknown[] : null,
    costUsd, basis: costUsd === 0 ? "no_provider_request" : "reported_usage" };
}

/**
 * The most one pass over `text` can cost (`laneCallMaximumUsd`): its prompt's size, the lane's 800-token output ceiling,
 * the dearest model the lane may be sent to now. Null when it cannot be bounded (a model with no price): no pass starts.
 */
async function passMaximumUsd(writer: ScreeningWriter, text: string): Promise<number | null> {
  const [{ freeTextRedactionTask }, { laneCallMaximumUsd, laneModels }, { getTaskModelByProvider }] = await Promise.all([
    import("../agents/tasks/free-text-redaction"), import("./jobLaneSpend"), import("../agents/provider-config")]);
  // A scripted pass (tests, the local harness) is held as the lane's default model would be.
  const models = redactorOverride ? { openai_responses: getTaskModelByProvider("free_text_redaction").openai_responses }
    : await laneModels("free_text_redaction");
  if (!models) return null;
  return laneCallMaximumUsd({ promptBytes: Buffer.byteLength(freeTextRedactionTask.build_prompt({ writer, text }), "utf8"),
    outputTokenCeiling: freeTextRedactionTask.max_output_tokens_ceiling ?? 800, models });
}

type Claim = { state: "done"; text: string } | { state: "claimed"; attempts: number; reservationId: string } | { state: "busy" }
  | { state: "cap" } | { state: "job_cap" };

/**
 * In one transaction: the stored result, or a new pass claimed, counted against the job's pass cap and held against the
 * job's one spending cap (`planJobLaneReservation`: every ledger of the job counted, this pass's most possible cost
 * added). Refused by either cap, nothing is written: no call starts, nothing is counted.
 */
async function claimPass(jobId: string, key: string, writer: ScreeningWriter, nowMs: number, maximumUsd: number): Promise<Claim> {
  const store = db!;
  const { planJobLaneReservation } = await import("./jobLaneSpend");
  const collection = store.collection("inboundRequests").doc(jobId).collection(FREE_TEXT_SCREENING_COLLECTION);
  const ref = collection.doc(key), budgetRef = collection.doc(BUDGET_DOC);
  return store.runTransaction(async (tx): Promise<Claim> => {
    const [row, budget] = [(await tx.get(ref)).data(), (await tx.get(budgetRef)).data()];
    if (row?.status === "done" && typeof row.text === "string") return { state: "done", text: row.text };
    const attempts = Number.isInteger(row?.attempts) ? row!.attempts as number : 0;
    if (row?.status === "running" && nowMs - Number(row.claimedAtMs ?? 0) < CLAIM_LOST_AFTER_MS) return { state: "busy" };
    if (row?.status === "failed" && nowMs - Number(row.endedAtMs ?? 0) < retryAfterMs(attempts)) return { state: "busy" };
    const passes = Number.isInteger(budget?.passes) ? budget!.passes as number : 0;
    if (passes >= SCREENING_PASSES_PER_JOB) return { state: "cap" };
    const reservationId = `free_text_redaction-${key}-${attempts + 1}`;
    const hold = await planJobLaneReservation(tx, jobId, { lane: "free_text_redaction", reservationId, maximumUsd });
    if (hold.state !== "fits") return { state: "job_cap" };
    const atIso = new Date(nowMs).toISOString();
    hold.write(tx);
    tx.set(ref, { schemaVersion: FREE_TEXT_SCREENING_SCHEMA, writer, status: "running", attempts: attempts + 1,
      claimedAtIso: atIso, claimedAtMs: nowMs, reservationId }, { merge: true });
    tx.set(budgetRef, { passes: passes + 1, updatedAtIso: atIso }, { merge: true });
    return { state: "claimed", attempts: attempts + 1, reservationId };
  });
}

const inFlight = new Map<string, Promise<string | null>>();
let capLogged = new Set<string>();

/**
 * The words as the other side may read them before the last deterministic pass, or null while that is not known:
 * the stored result for this exact text, else a new pass (claimed, counted, run and stored). With `waitMs`, null after
 * that long; the pass goes on and stores its result for the next read. Never throws.
 */
export async function screenText(jobId: string, writer: ScreeningWriter, text: string, options: { waitMs?: number } = {}):
  Promise<string | null> {
  if (!needsScreening(text)) return text;
  if (!db || !/^[A-Za-z0-9_-]{1,200}$/.test(jobId)) return null;
  const key = screeningKey(writer, text);
  const flightKey = `${jobId}:${key}`;
  let work = inFlight.get(flightKey);
  if (!work) {
    work = runOnce(jobId, key, writer, text).catch(error => {
      logger.warn({ err: error, requestId: jobId }, "The model pass over free text could not run; the words stay unread");
      return null;
    }).finally(() => inFlight.delete(flightKey));
    inFlight.set(flightKey, work);
  }
  if (!options.waitMs) return work;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), options.waitMs); });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

async function runOnce(jobId: string, key: string, writer: ScreeningWriter, text: string): Promise<string | null> {
  const store = db!;
  const ref = store.collection("inboundRequests").doc(jobId).collection(FREE_TEXT_SCREENING_COLLECTION).doc(key);
  const stored = (await ref.get()).data();
  if (stored?.status === "done" && typeof stored.text === "string") return stored.text;
  // No provider the policy permits: no pass starts and nothing is counted (no spend can happen).
  if (!(await redactorAvailable())) return null;
  const maximumUsd = await passMaximumUsd(writer, text);
  if (maximumUsd === null) return null;
  const claim = await claimPass(jobId, key, writer, Date.now(), maximumUsd);
  if (claim.state === "done") return claim.text;
  if (claim.state === "cap" || claim.state === "job_cap") {
    if (!capLogged.has(`${jobId}:${claim.state}`)) {
      capLogged.add(`${jobId}:${claim.state}`);
      logger.warn({ requestId: jobId, cap: claim.state === "cap" ? SCREENING_PASSES_PER_JOB : "job_spending_cap" },
        claim.state === "cap" ? "The job reached its cap on model passes over free text; new words stay unread by the other side"
          : "The job's spending cap leaves no room for a model pass over free text; new words stay unread by the other side");
    }
    return null;
  }
  if (claim.state !== "claimed") return null;
  const { settleJobLaneSpend } = await import("./jobLaneSpend");
  let pass: PassResult = { pieces: null, costUsd: null, basis: "reported_usage" }, failure: string | null = null;
  try { pass = await modelPass({ writer, text, requestId: jobId }); }
  catch (error) { failure = error instanceof Error ? error.name : "error"; }
  // The hold settles at what the pass cost, or stays whole when that is not known (a throw included).
  await settleJobLaneSpend(jobId, claim.reservationId, pass.costUsd, pass.basis).catch(error =>
    logger.warn({ err: error, requestId: jobId }, "A model pass's hold could not be settled; it stays counted in full"));
  const endedAtMs = Date.now(), endedAtIso = new Date(endedAtMs).toISOString();
  if (!pass.pieces) {
    await ref.set({ status: "failed", endedAtMs, endedAtIso, lastError: failure ?? "no_answer" }, { merge: true });
    return null;
  }
  const result = applyRemovals(text, pass.pieces);
  await ref.set({ status: "done", text: result, endedAtMs, endedAtIso, lastError: null }, { merge: true });
  return result;
}

/** What has been screened for one job: the result for an exact text, or null while there is none yet. */
export interface Screenings {
  shown(writer: ScreeningWriter, text: string): string | null;
  /** The texts asked for that have no result yet, to screen next. */
  readonly missing: ReadonlyArray<{ writer: ScreeningWriter; text: string }>;
}

/** A lookup over stored results (`key` → the text with the pieces taken out). */
export function screeningsFrom(results: ReadonlyMap<string, string>): Screenings {
  const missing: Array<{ writer: ScreeningWriter; text: string }> = [];
  return {
    missing,
    shown(writer, text) {
      if (!needsScreening(text)) return text;
      const found = results.get(screeningKey(writer, text));
      if (found !== undefined) return found;
      if (!missing.some(item => item.writer === writer && item.text === text)) missing.push({ writer, text });
      return null;
    },
  };
}

/** Nothing screened: every text that needs a pass reads as not ready. */
export const NOTHING_SCREENED: () => Screenings = () => screeningsFrom(new Map());

/** The job's stored results. On any failure to read them, none (the words then stay unread). */
export async function loadScreenings(jobId: string): Promise<Screenings> {
  if (!db) return NOTHING_SCREENED();
  try {
    const rows = await db.collection("inboundRequests").doc(jobId).collection(FREE_TEXT_SCREENING_COLLECTION)
      .where("status", "==", "done").limit(SCREENING_PASSES_PER_JOB + 50).get();
    return screeningsFrom(new Map(rows.docs.filter(doc => typeof doc.data()?.text === "string")
      .map(doc => [doc.id, String(doc.data().text)])));
  } catch (error) {
    logger.warn({ err: error, requestId: jobId }, "Could not read the job's screened words; they stay unread for now");
    return NOTHING_SCREENED();
  }
}

/** Start a pass for each text a read found unscreened, without waiting (the next read shows the result). */
export function screenInBackground(jobId: string, items: ReadonlyArray<{ writer: ScreeningWriter; text: string }>) {
  for (const item of items) void screenText(jobId, item.writer, item.text);
}

/** Screen each text, waiting at most `waitMs` in all; true when any new result arrived (a second read shows it). */
export async function screenAndWait(jobId: string, items: ReadonlyArray<{ writer: ScreeningWriter; text: string }>,
  waitMs = SCREENING_WAIT_MS): Promise<boolean> {
  if (!items.length) return false;
  const results = await Promise.all(items.map(item => screenText(jobId, item.writer, item.text, { waitMs })));
  return results.some(result => result !== null);
}

/* ------------------------------------------------------------------- a site's words, as a company reads them */

const NO_IDENTITY: KnownSiteIdentity = { names: [], addresses: [], contacts: [] };

/** The deterministic pass over a site's own words for a company: its known identity, then name-shaped text. */
export function siteWordsDeterministic(text: string, known: KnownSiteIdentity): string {
  return removeNamesNotHeld(removeIdentifyingDetails(text, known));
}

/**
 * A site's own words as a deployment company reads them (2026-11-24): the deterministic pass, the model pass over what
 * it leaves, and the deterministic pass again. Empty while the model pass has not succeeded for this exact text, and
 * when the site's identity cannot be read: never words that might name it. The text the model pass still needs is
 * recorded in `screenings.missing`, for the caller to screen.
 */
export function siteWordsForCompany(text: string, known: KnownSiteIdentity | null, screenings: Screenings): string {
  if (!known) return "";
  const input = siteWordsDeterministic(text, known).trim();
  if (!input) return "";
  const screened = screenings.shown("site", input);
  return screened === null ? "" : siteWordsDeterministic(screened, known).trim();
}

/**
 * The site's reply to a company's question as that company reads it, and as the site's own page shows it: the stored
 * reply (through the deterministic pass with the site's identity when the site sent it, `answerCompanyQuestion`),
 * through the model pass, then the deterministic pass again, with the site's identity when it can be read. Null while
 * the model pass has not succeeded for it.
 */
export function siteReplyForCompany(stored: string, known: KnownSiteIdentity | null, screenings: Screenings): string | null {
  const screened = screenings.shown("site", stored);
  if (screened === null) return null;
  return siteWordsDeterministic(screened, known ?? NO_IDENTITY).trim() || null;
}

export function resetFreeTextScreeningForTests() {
  inFlight.clear();
  capLogged = new Set();
  redactorOverride = null;
}
