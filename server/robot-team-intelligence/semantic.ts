import { createHash } from "node:crypto";
import { cosineSimilarity, embedHistoryQuery, ensureHistoryEmbeddings,
  loadHistoryEmbeddingAuthority, type HistoryEmbeddingAuthority } from "../research-learning/company-history-index";

export type SemanticCandidate = { team_id: string; source_sha256: string; text: string };
export type SemanticRanking = { scores: Record<string, number>; mode: "semantic" | "keyword";
  model?: string; diagnostics: Array<{ code: string; action: string }> };

/** Derived vectors reuse the existing company-owned index. The host supplies
 * public projections only; neither tool arguments nor an MCP connection can
 * turn on paid embeddings. Rankings are for the current source page, never a
 * claim that unseen directory pages were searched. */
export function createRobotTeamSemanticRanker(db: FirebaseFirestore.Firestore, options: {
  assertAccess: () => void;
  authority?: HistoryEmbeddingAuthority;
  providerModel?: string;
  embed?: (texts: string[]) => Promise<number[][]>;
}): (query: string, candidates: SemanticCandidate[]) => Promise<SemanticRanking> {
  const queries = new Map<string, number[]>();
  return async (query, candidates) => {
    const fallback: SemanticRanking = { scores: {}, mode: "keyword", diagnostics: [] };
    options.assertAccess();
    const loaded = options.authority ? { authority: options.authority } : await loadHistoryEmbeddingAuthority(db);
    if (!loaded.authority?.enabled || !query.trim()) {
      if ("diagnostic" in loaded && loaded.diagnostic) fallback.diagnostics.push(loaded.diagnostic);
      return fallback;
    }
    const authority = loaded.authority;
    if (options.providerModel && authority.model !== options.providerModel) return { ...fallback, diagnostics: [{ code: "history_embedding_model_configuration_mismatch",
      action: "Use keyword filters until the retained embedding model matches the configured provider model." }] };
    // Cache the query only for this worker instance and this exact authority.
    const key = createHash("sha256").update(JSON.stringify({ query, authority })).digest("hex");
    let vector = queries.get(key);
    const diagnostics: SemanticRanking["diagnostics"] = [];
    if (!vector) {
      const embedded = await embedHistoryQuery(query, authority, options.embed, options.assertAccess);
      if (!embedded.vector) return { ...fallback, diagnostics: embedded.error ? [embedded.error,
        ...(embedded.error.code === "history_embedding_provider_failed" ? [{ code: "history_embedding_paid_usage_unknown",
          action: "Retain the submitted embedding attempt as unknown paid usage; a transport/access failure is not zero spend." }] : [])] : [] };
      vector = embedded.vector; queries.set(key, vector);
      diagnostics.push(...(embedded.diagnostics ?? []));
    }
    const indexed = await ensureHistoryEmbeddings(db, candidates.map(item => ({ id: `robot_team:${item.team_id}`,
      text: item.text, sourceSha256: item.source_sha256 })), authority, options.embed, options.assertAccess);
    diagnostics.push(...indexed.diagnostics);
    if (indexed.diagnostics.some(item => item.code === "history_embedding_provider_failed")) diagnostics.push({ code: "history_embedding_paid_usage_unknown",
      action: "Retain the submitted embedding attempt as unknown paid usage; a transport/access failure is not zero spend." });
    options.assertAccess();
    const scores: Record<string, number> = {};
    for (const item of candidates) {
      const record = indexed.records.find(value => value.id === `robot_team:${item.team_id}` && value.sourceSha256 === item.source_sha256);
      if (record) scores[item.team_id] = cosineSimilarity(vector, record.vector);
    }
    return { scores, mode: Object.keys(scores).length ? "semantic" : "keyword", model: authority.model, diagnostics };
  };
}
