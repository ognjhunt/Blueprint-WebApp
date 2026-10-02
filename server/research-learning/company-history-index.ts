import { FieldPath } from "firebase-admin/firestore";
import { z } from "zod";
import { embedTexts } from "../retrieval/embeddings";
import { digest, hash, instant, LEARNING_ROOT } from "./contract";

export const HISTORY_SEARCH_INDEX_ROOT = `${LEARNING_ROOT}/historySearchIndex`;
export const HISTORY_SEARCH_SETTINGS_REF = `${LEARNING_ROOT}/historySearchSettings/current`;
// embedTexts captures this setting when its module is loaded, too.
const configuredEmbeddingModel = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
export type HistoryEmbeddingAuthority = { enabled: boolean; model: string; dimensions: number; maxInputCharacters: number;
  authorizationRef?: string; expiresAt?: string };
export type HistoryIndexSource = { id: string; text: string; sourceSha256: string };
export type HistoryEmbeddingDiagnostic = { id?: string; code: string; action: string };
type Embed = (texts: string[]) => Promise<number[][]>;
const authoritySchema = z.object({ enabled: z.boolean(), model: z.string().min(1).max(200),
  dimensions: z.number().int().min(1).max(8192), maxInputCharacters: z.number().int().positive().max(1000000),
  authorizationRef: z.string().trim().min(1).max(500).optional(), expiresAt: instant.optional() }).strict()
  .refine(value => (value.authorizationRef === undefined) === (value.expiresAt === undefined), "history_embedding_authority_reference_invalid");
const settingsSchema = z.object({ schemaVersion: z.literal(1), authorizationRef: z.string().trim().min(1).max(500),
  expiresAt: instant, authority: authoritySchema }).strict();
const sourceSchema = z.object({ id: z.string().min(1).max(1024), text: z.string().min(1), sourceSha256: hash }).strict();
const recordSchema = z.object({ schemaVersion: z.literal(1), id: z.string().min(1).max(1024), sourceSha256: hash,
  textSha256: hash, model: z.string().min(1).max(200), dimensions: z.number().int().min(1).max(8192),
  vector: z.array(z.number().finite()).min(1).max(8192), updatedAt: instant }).strict()
  .refine(row => row.vector.length === row.dimensions && row.vector.some(value => value !== 0), "history_embedding_vector_invalid");
export type HistoryEmbeddingRecord = z.infer<typeof recordSchema>;
const diagnostic = (code: string, id?: string): HistoryEmbeddingDiagnostic => ({ ...(id === undefined ? {} : { id }), code,
  action: "Use keyword search or browse the next history page; repair this index source or explicit embedding authority before retrying semantic search." });
const recordId = (id: string) => digest(id);

/** Company backend reads existing approved settings; never model arguments.
 * This read does not create authority, mutate settings or invoke a provider. */
export async function loadHistoryEmbeddingAuthority(db: FirebaseFirestore.Firestore,
  now: (() => string) | string = () => new Date().toISOString()): Promise<{ authority?: HistoryEmbeddingAuthority; diagnostic?: HistoryEmbeddingDiagnostic }> {
  let saved: FirebaseFirestore.DocumentSnapshot;
  try { saved = await db.doc(HISTORY_SEARCH_SETTINGS_REF).get(); }
  catch { return { diagnostic: diagnostic("history_embedding_settings_read_failed") }; }
  if (!saved.exists) return {};
  const parsed = settingsSchema.safeParse(saved.data());
  if (!parsed.success || parsed.data.authority.authorizationRef !== undefined || parsed.data.authority.expiresAt !== undefined) {
    return { diagnostic: diagnostic("history_embedding_settings_invalid") };
  }
  const checkedAt = instant.safeParse(typeof now === "function" ? now() : now);
  if (!checkedAt.success || parsed.data.expiresAt <= checkedAt.data) return { diagnostic: diagnostic("history_embedding_authority_expired") };
  return { authority: { ...parsed.data.authority, authorizationRef: parsed.data.authorizationRef, expiresAt: parsed.data.expiresAt } };
}

/** Trusted host supplies existing spending authority. Neither a credential nor
 * model text can enable it. The injected provider is only a test/host seam. */
export function createHistoryEmbedder(authority: HistoryEmbeddingAuthority, embed: Embed = embedTexts): Embed {
  return async texts => {
    const parsed = authoritySchema.safeParse(authority);
    if (!parsed.success) throw new Error("history_embedding_authority_invalid");
    const settings = parsed.data;
    if (!settings.enabled) throw new Error("history_embedding_authority_disabled");
    if (settings.expiresAt !== undefined && settings.expiresAt <= new Date().toISOString()) throw new Error("history_embedding_authority_expired");
    if (embed === embedTexts && settings.model !== configuredEmbeddingModel) throw new Error("history_embedding_model_configuration_mismatch");
    if (!texts.length || texts.some(text => typeof text !== "string" || !text.length)
      || texts.reduce((size, text) => size + text.length, 0) > settings.maxInputCharacters) throw new Error("history_embedding_input_limit");
    let vectors: number[][];
    try { vectors = await embed(texts); } catch { throw new Error("history_embedding_provider_failed"); }
    if (!Array.isArray(vectors) || vectors.length !== texts.length || vectors.some(vector => !Array.isArray(vector)
      || vector.length !== settings.dimensions || vector.some(value => !Number.isFinite(value)) || !vector.some(value => value !== 0))) {
      throw new Error("history_embedding_response_invalid");
    }
    return vectors;
  };
}

function matchingRecord(value: unknown, source: HistoryIndexSource, authority: HistoryEmbeddingAuthority) {
  const parsed = recordSchema.safeParse(value);
  return parsed.success && parsed.data.id === source.id && parsed.data.sourceSha256 === source.sourceSha256
    && parsed.data.textSha256 === digest(source.text) && parsed.data.model === authority.model
    && parsed.data.dimensions === authority.dimensions ? parsed.data : undefined;
}

/** Incrementally index an already-authorized source page. Transport/input
 * bounds never define a permanent corpus quota. Stale vectors are excluded,
 * even when re-embedding is disabled or unavailable. No source writes. */
export async function ensureHistoryEmbeddings(db: FirebaseFirestore.Firestore, sources: HistoryIndexSource[],
  authority: HistoryEmbeddingAuthority, embed: Embed = embedTexts, beforeAction?: () => void) {
  const records: HistoryEmbeddingRecord[] = [], diagnostics: HistoryEmbeddingDiagnostic[] = [];
  const settings = authoritySchema.safeParse(authority);
  if (!settings.success) return { records, diagnostics: [diagnostic("history_embedding_authority_invalid")] };
  const pending: HistoryIndexSource[] = [], seen = new Set<string>();
  let inputCharacters = 0;
  for (const value of sources) {
    const parsed = sourceSchema.safeParse(value);
    if (!parsed.success) { diagnostics.push(diagnostic("history_embedding_source_invalid", typeof value?.id === "string" ? value.id : undefined)); continue; }
    const source = parsed.data;
    if (seen.has(source.id)) { diagnostics.push(diagnostic("history_embedding_duplicate_source", source.id)); continue; }
    seen.add(source.id);
    try {
      const saved = await db.doc(HISTORY_SEARCH_INDEX_ROOT + "/" + recordId(source.id)).get();
      if (saved.exists) {
        const cached = matchingRecord(saved.data(), source, settings.data);
        if (cached) { records.push(cached); continue; }
        diagnostics.push(diagnostic("history_embedding_cached_source_changed_or_invalid", source.id));
      }
    } catch { diagnostics.push(diagnostic("history_embedding_cache_read_failed", source.id)); }
    if (!settings.data.enabled) { diagnostics.push(diagnostic("history_embedding_authority_disabled", source.id)); continue; }
    if (inputCharacters + source.text.length > settings.data.maxInputCharacters) {
      diagnostics.push(diagnostic("history_embedding_input_limit", source.id)); continue;
    }
    inputCharacters += source.text.length; pending.push(source);
  }
  if (!pending.length) return { records, diagnostics };
  let vectors: number[][];
  // The access lease can expire during cache reads even when the independent
  // company embedding grant is valid. Propagate the host's actionable refusal.
  beforeAction?.();
  try { vectors = await createHistoryEmbedder(settings.data, embed)(pending.map(source => source.text)); }
  catch (error) { return { records, diagnostics: [...diagnostics, ...pending.map(source => diagnostic((error as Error).message, source.id))] }; }
  diagnostics.push({ code: "history_embedding_paid_usage_unknown", action: "Retain unknown paid usage; the existing vector-only provider helper returns no usage receipt. Character limits do not establish a dollar ceiling." });
  for (const [index, source] of pending.entries()) {
    const record: HistoryEmbeddingRecord = { schemaVersion: 1, id: source.id, sourceSha256: source.sourceSha256,
      textSha256: digest(source.text), model: settings.data.model, dimensions: settings.data.dimensions,
      vector: vectors[index], updatedAt: new Date().toISOString() };
    // Document ID is Blueprint-owned, safe for arbitrary canonical source IDs.
    // Concurrent old projections cannot become hits: every reader joins hashes.
    beforeAction?.();
    try { await db.doc(HISTORY_SEARCH_INDEX_ROOT + "/" + recordId(source.id)).set(record); records.push(record); }
    catch { diagnostics.push(diagnostic("history_embedding_cache_write_failed", source.id)); }
  }
  return { records, diagnostics };
}

export async function embedHistoryQuery(query: string, authority: HistoryEmbeddingAuthority, embed: Embed = embedTexts, beforeAction?: () => void):
  Promise<{ vector?: number[]; error?: HistoryEmbeddingDiagnostic; diagnostics?: HistoryEmbeddingDiagnostic[] }> {
  beforeAction?.();
  try { return { vector: (await createHistoryEmbedder(authority, embed)([query]))[0], diagnostics: [{ code: "history_embedding_paid_usage_unknown",
    action: "Retain unknown paid usage; the vector-only provider helper returns no usage receipt. Do not report zero cost or a proven dollar ceiling." }] }; }
  catch (error) { return { error: diagnostic((error as Error).message) }; }
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length || [...left, ...right].some(value => !Number.isFinite(value))) throw new Error("history_embedding_vector_invalid");
  const leftScale = Math.max(...left.map(Math.abs)), rightScale = Math.max(...right.map(Math.abs));
  if (!leftScale || !rightScale) throw new Error("history_embedding_vector_invalid");
  const normalizedLeft = left.map(value => value / leftScale), normalizedRight = right.map(value => value / rightScale);
  const leftNorm = Math.hypot(...normalizedLeft), rightNorm = Math.hypot(...normalizedRight);
  return normalizedLeft.reduce((sum, value, index) => sum + (value / leftNorm) * (normalizedRight[index] / rightNorm), 0);
}

/** Portable index inspection/export. Return the transport cursor even when a
 * malformed row is quarantined, so it cannot hide valid later siblings. The
 * index is a derived cache; canonical history must still authorize each hit. */
export async function readHistoryIndexPage(db: FirebaseFirestore.Firestore, cursor?: string, pageSize = 100) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || (cursor !== undefined && !/^[a-f0-9]{64}$/.test(cursor))) throw new Error("history_embedding_cursor_invalid");
  let query: FirebaseFirestore.Query = db.doc(LEARNING_ROOT).collection("historySearchIndex").orderBy(FieldPath.documentId());
  if (cursor !== undefined) query = query.startAfter(cursor);
  const page = await query.limit(pageSize).get(), records: HistoryEmbeddingRecord[] = [], diagnostics: HistoryEmbeddingDiagnostic[] = [];
  for (const row of page.docs) {
    const parsed = recordSchema.safeParse(row.data());
    if (parsed.success && recordId(parsed.data.id) === row.id) records.push(parsed.data);
    else diagnostics.push(diagnostic("history_embedding_stored_record_invalid", row.id));
  }
  return { records, diagnostics, nextCursor: page.size === pageSize ? page.docs.at(-1)!.id : null };
}
