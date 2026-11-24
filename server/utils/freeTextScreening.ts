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
import { createHash, randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { REMOVED, removeIdentifyingDetails, removeNamesNotHeld, type KnownSiteIdentity } from "../../client/src/lib/contactRedaction";
import { logger } from "../logger";

export const FREE_TEXT_SCREENING_COLLECTION = "freeTextScreenings";
export const FREE_TEXT_SCREENING_SCHEMA = "free-text-screening.v1";
/** Whose words: a site's (read by deployment companies) or a deployment company's (read by the site). */
export type ScreeningWriter = "site" | "company";

/**
 * How many passes may run (a review of PR #1437, 2026-11-24: one shared, never-reset count of 200 let about fifty edits
 * by one company use up a whole job, after which nobody's new words reached the other side). Each writer has a budget
 * of its own (the site, and each company by its id), under a job total; one pass on the lane's default (gpt-6-luna at
 * $0.10 per million input tokens and $0.50 per million output tokens, `server/utils/openaiPromptCache.ts`) is held at
 * about $0.0014 at most, so the job total bounds a job's passes near a dollar and a half. The job's $40 ledger
 * (`jobLaneSpend.ts`) is the money stop; these counts only keep one writer from crowding out the others.
 */
export const SCREENING_PASSES_PER_JOB = 1_000;
export const SCREENING_PASSES_PER_SITE = 300;
export const SCREENING_PASSES_PER_COMPANY = 100;
/** How long a page waits for a pass before it shows the words as not ready yet. */
export const SCREENING_WAIT_MS = 8_000;
/** A claimed pass that has not ended in this long is taken as lost (the process stopped) and may be claimed again. */
const CLAIM_LOST_AFTER_MS = 3 * 60_000;
/** After a failed pass, the next is allowed after one minute, then four, sixteen, … at most six hours. */
const retryAfterMs = (attempts: number) => Math.min(60_000 * 4 ** Math.max(0, attempts - 1), 6 * 60 * 60_000);
const BUDGET_DOC = "budget";
/** The longest piece the model may point at, and the most pieces it may name. */
const PIECE_MAX = 300;

/** Whose budget a pass counts against: the site's, or one company's (by its id). */
export type ScreeningBudget = "site" | `company:${string}`;
const budgetDocOf = (budget: ScreeningBudget) => budget === "site" ? "budget-site" : `budget-company-${budget.slice(8)}`;
const budgetCapOf = (budget: ScreeningBudget) => budget === "site" ? SCREENING_PASSES_PER_SITE : SCREENING_PASSES_PER_COMPANY;
/** The site's budget for its own words; a company's by its id; a company's words with no id known count as one. */
export const budgetFor = (writer: ScreeningWriter, companyId?: string | null): ScreeningBudget =>
  writer === "site" ? "site" : `company:${companyId && /^[A-Za-z0-9_-]{1,100}$/.test(companyId) ? companyId : "unknown"}`;

export function screeningKey(writer: ScreeningWriter, text: string): string {
  return createHash("sha256").update(`${FREE_TEXT_SCREENING_SCHEMA}\n${writer}\n${text}`).digest("hex");
}

/** Text with no letter left beside the placeholders needs no pass: nothing in it can name anyone. */
export function needsScreening(text: string): boolean {
  return /\p{L}/u.test(text.split(REMOVED).join(" ").replace(/\bthe (?:site|company)\b/gi, " "));
}

const ZERO_WIDTH = /[​-‍⁠﻿­]/;
/**
 * One character as matching reads it: look-alikes plain (NFKC) and accents dropped, as `contactRedaction`'s `fold`
 * does, then every quote mark one, every dash one, and lower case (a review of PR #1437: a model that wrote "dana o'neil"
 * for "dana o’neil", "smith-jones" for "smith–jones" or "and" for "&" left the name in).
 */
function foldChar(char: string): string {
  if (ZERO_WIDTH.test(char)) return "";
  if (/\s/u.test(char)) return " ";
  if (char === "&") return "and";
  return char.normalize("NFKC").normalize("NFKD").replace(/\p{M}+/gu, "")
    .replace(/[‘’‚‛′`´ʼ]/g, "'").replace(/[“”„‟″]/g, "\"")
    .replace(/[‐-―−﹘﹣－]/g, "-").toLowerCase();
}

/** The text folded for matching, each folded character with the index and length of the original one it came from;
 * whitespace runs read as one space. */
function foldWithMap(text: string): { folded: string; from: number[]; width: number[] } {
  let folded = "";
  const from: number[] = [], width: number[] = [];
  let index = 0;
  for (const char of text) {
    const out = foldChar(char);
    for (const piece of out) {
      if (piece === " " && folded.endsWith(" ")) continue;
      folded += piece; from.push(index); width.push(char.length);
    }
    index += char.length;
  }
  return { folded, from, width };
}

/** A model's piece as matching reads it: folded the same way, without the punctuation around it ("dave." is "dave"). */
function foldPiece(piece: string): string {
  return foldWithMap(piece.normalize("NFKC")).folded.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/**
 * The model's answer applied: each piece it named becomes "[removed]" wherever it occurs in the text, matched on both
 * sides folded (`foldChar`: case, accents, quote marks, dashes, "&" and "and", spacing) and mapped back to the text's
 * own characters; whole words only at a piece's ends ("Joe" is not taken out of "Joey"). Nothing else changes, so the
 * result never holds a word the text did not. `unmatched` lists the usable pieces found nowhere: the caller then fails
 * the pass closed, as a name the model saw may still be in the text.
 */
export function removalsOf(text: string, pieces: readonly unknown[]): { text: string; unmatched: string[] } {
  const usable = [...new Set(pieces.filter((piece): piece is string => typeof piece === "string")
    .map(piece => piece.normalize("NFKC").trim()).filter(piece => piece.length >= 2 && piece.length <= PIECE_MAX)
    .filter(piece => piece !== REMOVED && !/^the (?:site|company)$/i.test(piece)))];
  const { folded, from, width } = foldWithMap(text);
  const isWord = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);
  const ranges: Array<[number, number]> = [];
  const unmatched: string[] = [];
  for (const piece of usable) {
    const needle = foldPiece(piece);
    if (needle.length < 2) continue;
    let found = false;
    for (let at = folded.indexOf(needle); at >= 0; at = folded.indexOf(needle, at + 1)) {
      const end = at + needle.length;
      if (isWord(needle[0]) && isWord(folded[at - 1])) continue;
      if (isWord(needle[needle.length - 1]) && isWord(folded[end])) continue;
      ranges.push([from[at], from[end - 1] + width[end - 1]]);
      found = true;
    }
    if (!found) unmatched.push(piece);
  }
  // Merged, then replaced from the end, so earlier offsets hold.
  const merged = ranges.sort((a, b) => a[0] - b[0]).reduce<Array<[number, number]>>((list, range) => {
    const last = list[list.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]); else list.push([...range]);
    return list;
  }, []);
  let out = text;
  for (const [start, end] of merged.reverse()) out = `${out.slice(0, start)}${REMOVED}${out.slice(end)}`;
  return { text: out.replace(/\[removed\](?:[^\S\n]+\[removed\])+/g, REMOVED), unmatched };
}

/** `removalsOf`'s text alone. */
export function applyRemovals(text: string, pieces: readonly unknown[]): string {
  return removalsOf(text, pieces).text;
}

/**
 * Words an empty answer is not trusted for (a review of PR #1437: words written to talk the model into answering
 * nothing could carry a contact through): an instruction aimed at a model, or what is left of an address or a handle
 * spelled out. The pass then fails closed rather than pass the words as clean.
 */
export function emptyAnswerDistrusted(text: string): boolean {
  const plain = text.split(REMOVED).join(" ");
  return /\b(?:ignore|disregard|forget|override)\b[^.!?\n]{0,40}\b(?:instructions?|rules?|prompt|above|previous)\b/i.test(plain)
    || /\b(?:return|answer|reply|output|respond)\b[^.!?\n]{0,20}(?:\[\s*\]|\bnothing\b|\bempty\b)/i.test(plain)
    || /\b(?:system|developer)\s+(?:prompt|message|instructions?)\b/i.test(plain)
    || /\byou are (?:an?|the) (?:ai|assistant|model|language model)\b/i.test(plain)
    || /@/.test(plain)
    || /\b(?:at|@)\s+[\p{L}\p{N}-]+(?:\s+[\p{L}\p{N}-]+){0,3}\s+(?:dot|\.)\s+[\p{L}]{2,}\b/iu.test(plain);
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

/** Why words cannot be read now and will not be by waiting: a pass count, or the job's spending cap. */
export type ScreeningLimit = "writer_passes" | "job_passes" | "job_spending_cap";

type Claim = { state: "done"; text: string } | { state: "claimed"; attempts: number; reservationId: string; token: string }
  | { state: "busy" } | { state: "limit"; limit: ScreeningLimit };

/**
 * In one transaction: the stored result, or a new pass claimed, counted against its writer's budget and the job's total
 * and held against the job's one spending cap (`planJobLaneReservation`: every ledger of the job counted, this pass's
 * most possible cost added). Refused by any of them, no pass is counted or held and no call starts; the text's row says
 * which limit it met, so both pages can say so.
 */
async function claimPass(jobId: string, key: string, writer: ScreeningWriter, budget: ScreeningBudget, nowMs: number,
  maximumUsd: number): Promise<Claim> {
  const store = db!;
  const { planJobLaneReservation } = await import("./jobLaneSpend");
  const collection = store.collection("inboundRequests").doc(jobId).collection(FREE_TEXT_SCREENING_COLLECTION);
  const ref = collection.doc(key), jobBudgetRef = collection.doc(BUDGET_DOC), writerBudgetRef = collection.doc(budgetDocOf(budget));
  return store.runTransaction(async (tx): Promise<Claim> => {
    const [row, jobBudget, writerBudget] = [(await tx.get(ref)).data(), (await tx.get(jobBudgetRef)).data(),
      (await tx.get(writerBudgetRef)).data()];
    if (row?.status === "done" && typeof row.text === "string") return { state: "done", text: row.text };
    const attempts = Number.isInteger(row?.attempts) ? row!.attempts as number : 0;
    if (row?.status === "running" && nowMs - Number(row.claimedAtMs ?? 0) < CLAIM_LOST_AFTER_MS) return { state: "busy" };
    if (row?.status === "failed" && nowMs - Number(row.endedAtMs ?? 0) < retryAfterMs(attempts)) return { state: "busy" };
    const count = (value: unknown) => Number.isInteger(value) ? value as number : 0;
    const atIso = new Date(nowMs).toISOString();
    const limited = (limit: ScreeningLimit): Claim => {
      // Said on the text's row (no pass is counted, nothing held), once per limit.
      if (row?.status !== "limit" || row.limit !== limit)
        tx.set(ref, { schemaVersion: FREE_TEXT_SCREENING_SCHEMA, writer, budget, status: "limit", limit, limitAtIso: atIso }, { merge: true });
      return { state: "limit", limit };
    };
    const reservationId = `free_text_redaction-${key}-${attempts + 1}`;
    const hold = await planJobLaneReservation(tx, jobId, { lane: "free_text_redaction", reservationId, maximumUsd });
    if (count(writerBudget?.passes) >= budgetCapOf(budget)) return limited("writer_passes");
    if (count(jobBudget?.passes) >= SCREENING_PASSES_PER_JOB) return limited("job_passes");
    if (hold.state !== "fits") return limited("job_spending_cap");
    const token = randomUUID();
    hold.write(tx);
    tx.set(ref, { schemaVersion: FREE_TEXT_SCREENING_SCHEMA, writer, budget, status: "running", attempts: attempts + 1,
      claimedAtIso: atIso, claimedAtMs: nowMs, reservationId, claimToken: token, limit: null }, { merge: true });
    tx.set(jobBudgetRef, { passes: count(jobBudget?.passes) + 1, updatedAtIso: atIso }, { merge: true });
    tx.set(writerBudgetRef, { budget, passes: count(writerBudget?.passes) + 1, updatedAtIso: atIso }, { merge: true });
    return { state: "claimed", attempts: attempts + 1, reservationId, token };
  });
}

/**
 * The pass's end, written only while the row is still this claim's (a review of PR #1437: a pass taken over after its
 * claim was taken as lost could otherwise overwrite the newer pass's result).
 */
async function endPass(ref: FirebaseFirestore.DocumentReference, token: string, end: Record<string, unknown>): Promise<boolean> {
  return db!.runTransaction(async tx => {
    const row = (await tx.get(ref)).data();
    if (row?.claimToken !== token || row.status !== "running") return false;
    tx.set(ref, end, { merge: true });
    return true;
  });
}

const inFlight = new Map<string, Promise<string | null>>();
let capLogged = new Set<string>();

/**
 * The words as the other side may read them before the last deterministic pass, or null while that is not known:
 * the stored result for this exact text, else a new pass (claimed, counted, held, run and stored). With `waitMs`, null
 * after that long; the pass goes on and stores its result for the next read. `budget` says whose passes it counts
 * against (the site's own words count against the site's). Never throws.
 */
export async function screenText(jobId: string, writer: ScreeningWriter, text: string,
  options: { waitMs?: number; budget?: ScreeningBudget } = {}): Promise<string | null> {
  if (!needsScreening(text)) return text;
  if (!db || !/^[A-Za-z0-9_-]{1,200}$/.test(jobId)) return null;
  const key = screeningKey(writer, text);
  const flightKey = `${jobId}:${key}`;
  const budget = options.budget ?? budgetFor(writer);
  let work = inFlight.get(flightKey);
  if (!work) {
    work = runOnce(jobId, key, writer, text, budget).catch(error => {
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

async function runOnce(jobId: string, key: string, writer: ScreeningWriter, text: string, budget: ScreeningBudget): Promise<string | null> {
  const store = db!;
  const ref = store.collection("inboundRequests").doc(jobId).collection(FREE_TEXT_SCREENING_COLLECTION).doc(key);
  const stored = (await ref.get()).data();
  if (stored?.status === "done" && typeof stored.text === "string") return stored.text;
  // No provider the policy permits: no pass starts and nothing is counted (no spend can happen).
  if (!(await redactorAvailable())) return null;
  const maximumUsd = await passMaximumUsd(writer, text);
  if (maximumUsd === null) return null;
  const claim = await claimPass(jobId, key, writer, budget, Date.now(), maximumUsd);
  if (claim.state === "done") return claim.text;
  if (claim.state === "limit") {
    if (!capLogged.has(`${jobId}:${budget}:${claim.limit}`)) {
      capLogged.add(`${jobId}:${budget}:${claim.limit}`);
      logger.warn({ requestId: jobId, budget, limit: claim.limit },
        "A model pass over free text met a limit; these words stay unread by the other side, and both pages say so");
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
  const failed = (reason: string) => endPass(ref, claim.token, { status: "failed", endedAtMs, endedAtIso, lastError: reason });
  if (!pass.pieces) { await failed(failure ?? "no_answer"); return null; }
  // Fail closed when the answer cannot be trusted: a piece the model named that is in the text in no form, or nothing
  // named for words an empty answer is not trusted for.
  const { text: result, unmatched } = removalsOf(text, pass.pieces);
  if (unmatched.length) { await failed("piece_not_found"); return null; }
  if (!pass.pieces.length && emptyAnswerDistrusted(text)) { await failed("empty_answer_distrusted"); return null; }
  return await endPass(ref, claim.token, { status: "done", text: result, endedAtMs, endedAtIso, lastError: null, limit: null })
    ? result : null;
}

/** Where one exact text stands: read (its result), not yet read, or held at a limit (`ScreeningLimit`). */
export type ScreeningState = { state: "shown"; text: string } | { state: "pending" } | { state: "limit"; limit: ScreeningLimit };

/** What has been screened for one job: the result for an exact text, or null while there is none. */
export interface Screenings {
  shown(writer: ScreeningWriter, text: string, budget?: ScreeningBudget): string | null;
  stateOf(writer: ScreeningWriter, text: string, budget?: ScreeningBudget): ScreeningState;
  /** The texts asked for that have no result yet, to screen next, each with whose budget it counts against. */
  readonly missing: ReadonlyArray<{ writer: ScreeningWriter; text: string; budget: ScreeningBudget }>;
}

/** A lookup over stored results (`key` → the text with the pieces taken out) and the texts held at a limit. */
export function screeningsFrom(results: ReadonlyMap<string, string>, limits: ReadonlyMap<string, ScreeningLimit> = new Map()): Screenings {
  const missing: Array<{ writer: ScreeningWriter; text: string; budget: ScreeningBudget }> = [];
  const stateOf = (writer: ScreeningWriter, text: string, budget?: ScreeningBudget): ScreeningState => {
    if (!needsScreening(text)) return { state: "shown", text };
    const key = screeningKey(writer, text);
    const found = results.get(key);
    if (found !== undefined) return { state: "shown", text: found };
    // A limit may lift (a hold settled lower), so the text is asked for again either way.
    if (!missing.some(item => item.writer === writer && item.text === text))
      missing.push({ writer, text, budget: budget ?? budgetFor(writer) });
    const limit = limits.get(key);
    return limit ? { state: "limit", limit } : { state: "pending" };
  };
  return {
    missing,
    stateOf,
    shown(writer, text, budget) {
      const state = stateOf(writer, text, budget);
      return state.state === "shown" ? state.text : null;
    },
  };
}

/** Nothing screened: every text that needs a pass reads as not ready. */
export const NOTHING_SCREENED: () => Screenings = () => screeningsFrom(new Map());

const LIMITS: readonly ScreeningLimit[] = ["writer_passes", "job_passes", "job_spending_cap"];

/** The most texts held at a limit read back to say so; any more read as not ready (they stay unread either way). */
const LIMIT_ROWS_READ = 500;

/**
 * The job's stored results and limits. Results are read apart from the rows held at a limit, so however many texts a
 * writer at its limit sends, every result is read (results are at most the job's passes). On any failure to read them,
 * none (the words then stay unread).
 */
export async function loadScreenings(jobId: string): Promise<Screenings> {
  if (!db) return NOTHING_SCREENED();
  try {
    const collection = db.collection("inboundRequests").doc(jobId).collection(FREE_TEXT_SCREENING_COLLECTION);
    const [done, held] = await Promise.all([collection.where("status", "==", "done").limit(SCREENING_PASSES_PER_JOB + 50).get(),
      collection.where("status", "==", "limit").limit(LIMIT_ROWS_READ).get()]);
    const results = new Map<string, string>(), limits = new Map<string, ScreeningLimit>();
    for (const doc of done.docs) {
      const row = doc.data() ?? {};
      if (row.status === "done" && typeof row.text === "string") results.set(doc.id, String(row.text));
    }
    for (const doc of held.docs) {
      const row = doc.data() ?? {};
      if (row.status === "limit" && LIMITS.includes(row.limit)) limits.set(doc.id, row.limit);
    }
    return screeningsFrom(results, limits);
  } catch (error) {
    logger.warn({ err: error, requestId: jobId }, "Could not read the job's screened words; they stay unread for now");
    return NOTHING_SCREENED();
  }
}

/** Whether any of the job's words are held at a limit, for the admin job page. */
export async function screeningLimitReached(jobId: string): Promise<{ limit: ScreeningLimit; atIso: string | null } | null> {
  if (!db) return null;
  const rows = await db.collection("inboundRequests").doc(jobId).collection(FREE_TEXT_SCREENING_COLLECTION)
    .where("status", "==", "limit").limit(1).get();
  const row = rows.docs[0]?.data();
  return row && LIMITS.includes(row.limit) ? { limit: row.limit, atIso: typeof row.limitAtIso === "string" ? row.limitAtIso : null } : null;
}

/** Start a pass for each text a read found unscreened, without waiting (the next read shows the result). */
export function screenInBackground(jobId: string, items: ReadonlyArray<{ writer: ScreeningWriter; text: string; budget?: ScreeningBudget }>) {
  for (const item of items) void screenText(jobId, item.writer, item.text, { budget: item.budget });
}

/** Screen each text, waiting at most `waitMs` in all; true when any new result arrived (a second read shows it). */
export async function screenAndWait(jobId: string, items: ReadonlyArray<{ writer: ScreeningWriter; text: string; budget?: ScreeningBudget }>,
  waitMs = SCREENING_WAIT_MS): Promise<boolean> {
  if (!items.length) return false;
  const results = await Promise.all(items.map(item => screenText(jobId, item.writer, item.text, { waitMs, budget: item.budget })));
  return results.some(result => result !== null);
}

/* ------------------------------------------------------------------- a site's words, as a company reads them */

const NO_IDENTITY: KnownSiteIdentity = { names: [], addresses: [], contacts: [] };

/** The deterministic pass over a site's own words for a company: its known identity, then name-shaped text. */
export function siteWordsDeterministic(text: string, known: KnownSiteIdentity): string {
  return removeNamesNotHeld(removeIdentifyingDetails(text, known));
}

/** Words as the other side may read them: shown, not ready yet, or held at a limit (`ScreeningLimit`). */
export type ReadState = { state: "shown"; text: string } | { state: "pending" } | { state: "limit"; limit: ScreeningLimit };

/**
 * A site's own words as a deployment company reads them (2026-11-24): the deterministic pass, the model pass over what
 * it leaves, and the deterministic pass again. Not shown while the model pass has not succeeded for this exact text
 * (`pending`, or `limit` when a limit holds it), nor when the site's identity cannot be read: never words that might
 * name it. Nothing left once the details are out reads as shown and empty. The text the model pass still needs is
 * recorded in `screenings.missing`, for the caller to screen.
 */
export function siteWordsStateForCompany(text: string, known: KnownSiteIdentity | null, screenings: Screenings): ReadState {
  if (!known) return { state: "pending" };
  const input = siteWordsDeterministic(text, known).trim();
  if (!input) return { state: "shown", text: "" };
  const screened = screenings.stateOf("site", input, "site");
  return screened.state === "shown" ? { state: "shown", text: siteWordsDeterministic(screened.text, known).trim() } : screened;
}

/** `siteWordsStateForCompany`'s words, or "" while they are not shown. */
export function siteWordsForCompany(text: string, known: KnownSiteIdentity | null, screenings: Screenings): string {
  const read = siteWordsStateForCompany(text, known, screenings);
  return read.state === "shown" ? read.text : "";
}

/**
 * The site's reply to a company's question as that company reads it, and as the site's own page shows it: the stored
 * reply (through the deterministic pass with the site's identity when the site sent it, `answerCompanyQuestion`),
 * through the model pass, then the deterministic pass again, with the site's identity when it can be read.
 */
export function siteReplyStateForCompany(stored: string, known: KnownSiteIdentity | null, screenings: Screenings): ReadState {
  const screened = screenings.stateOf("site", stored, "site");
  if (screened.state !== "shown") return screened;
  const text = siteWordsDeterministic(screened.text, known ?? NO_IDENTITY).trim();
  return text ? { state: "shown", text } : { state: "pending" };
}

/** `siteReplyStateForCompany`'s words, or null while they are not shown. */
export function siteReplyForCompany(stored: string, known: KnownSiteIdentity | null, screenings: Screenings): string | null {
  const read = siteReplyStateForCompany(stored, known, screenings);
  return read.state === "shown" ? read.text : null;
}

export function resetFreeTextScreeningForTests() {
  inFlight.clear();
  capLogged = new Set();
  redactorOverride = null;
}
