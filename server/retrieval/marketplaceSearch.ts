import type { Firestore } from "firebase-admin/firestore";

import type { MarketplaceSearchSort } from "../../client/src/types/marketplace-search";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  environmentPolicies,
  marketplaceScenes,
  trainingDatasets,
  type MarketplaceScene,
  type TrainingDataset,
} from "../../client/src/data/content";

import { embedTexts } from "./embeddings";
import { logger } from "../logger";

export type MarketplaceSearchBackend = "firestore-vector" | "static-inmemory";

export type MarketplaceSearchFilters = {
  itemType?: "all" | "scenes" | "training";
  locationType?: string | null;
  policySlug?: string | null;
  objectTags?: string[];
  sort?: MarketplaceSearchSort;
};

export type MarketplaceHardConstraints = {
  minQualityScore?: number;
  minEpisodes?: number;
};

export type MarketplaceSoftSignals = {
  tabletop?: boolean;
  policySlugs?: string[];
  robotModels?: string[];
  compatibleWith?: string[];
  objectTags?: string[];
};

export type MarketplaceSearchResult = {
  type: "scene" | "training";
  item: MarketplaceScene | TrainingDataset;
  score: number;
  distance: number | null;
  reasons: string[];
};

export type MarketplaceSearchMeta = {
  backend: MarketplaceSearchBackend;
  embeddingModel: string;
  usedEmbeddings: boolean;
};

type Candidate = {
  type: "scene" | "training";
  item: MarketplaceScene | TrainingDataset;
  searchDoc: string;
  embedding: number[] | null;
};

const DEFAULT_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "data",
  "dataset",
  "datasets",
  "demos",
  "demo",
  "episodes",
  "episode",
  "for",
  "from",
  "get",
  "i",
  "in",
  "is",
  "it",
  "need",
  "of",
  "on",
  "or",
  "pack",
  "packs",
  "please",
  "scene",
  "scenes",
  "show",
  "that",
  "the",
  "to",
  "trajectories",
  "trajectory",
  "with",
]);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function dot(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function norm(a: number[]) {
  let sum = 0;
  for (const v of a) sum += v * v;
  return Math.sqrt(sum);
}

export function cosineSimilarity(a: number[], b: number[]): number | null {
  if (!a?.length || !b?.length) return null;
  if (a.length !== b.length) return null;
  const denom = norm(a) * norm(b);
  if (!denom) return null;
  return dot(a, b) / denom;
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token && !STOPWORDS.has(token));
}

export function jaccardSimilarity(tokensA: string[], tokensB: string[]) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union ? intersection / union : 0;
}

function buildPolicyTitleMap() {
  const map = new Map<string, string>();
  for (const policy of environmentPolicies) {
    if (policy?.slug && policy?.title) {
      map.set(policy.slug, policy.title);
    }
  }
  return map;
}

export function buildSearchDoc(
  candidate: Candidate,
  policyTitleMap: Map<string, string>,
) {
  const item = candidate.item;
  const policyTitles =
    "policySlugs" in item && Array.isArray(item.policySlugs)
      ? item.policySlugs
          .map((slug) => policyTitleMap.get(slug) || slug)
          .filter(Boolean)
      : [];

  const base: string[] = [
    candidate.type === "scene" ? "Scene Library" : "Dataset Pack",
    item.title,
    item.description,
    `Archetype: ${item.locationType}`,
  ];

  if (Array.isArray(item.tags) && item.tags.length) {
    base.push(`Tags: ${item.tags.join(", ")}`);
  }
  if (Array.isArray(item.objectTags) && item.objectTags.length) {
    base.push(`Objects: ${item.objectTags.join(", ")}`);
  }
  if (Array.isArray((item as any).policySlugs) && (item as any).policySlugs.length) {
    base.push(`Policies: ${(item as any).policySlugs.join(", ")}`);
  }
  if (policyTitles.length) {
    base.push(`Policy targets: ${policyTitles.join(", ")}`);
  }

  if (candidate.type === "training") {
    const training = item as TrainingDataset;
    base.push(`Episodes: ${training.episodeCount.toLocaleString()}`);
    base.push(`Trajectory length: ${training.trajectoryLength}`);
    base.push(`Format: ${training.dataFormat}`);
    base.push(`Sensors: ${training.sensorModalities.join(", ")}`);
    if (Array.isArray(training.compatibleWith) && training.compatibleWith.length) {
      base.push(`Compatible with: ${training.compatibleWith.join(", ")}`);
    }
    if (Array.isArray(training.robotModels) && training.robotModels.length) {
      base.push(`Robot models: ${training.robotModels.join(", ")}`);
    }
    if (typeof training.qualityScore === "number") {
      base.push(`Quality score: ${training.qualityScore.toFixed(2)}`);
    }
    base.push("Also known as: trajectories, demos, expert demonstrations");
  } else {
    const scene = item as MarketplaceScene;
    if (typeof scene.episodeCount === "number") {
      base.push(`Episodes included: ${scene.episodeCount.toLocaleString()}`);
    }
    if (Array.isArray(scene.interactions) && scene.interactions.length) {
      base.push(`Interactions: ${scene.interactions.join(", ")}`);
    }
  }

  return base.filter(Boolean).join("\n");
}

function hasAllObjectTags(item: { objectTags: string[] }, required: string[]) {
  if (!required.length) return true;
  const set = new Set(item.objectTags || []);
  return required.every((tag) => set.has(tag));
}

function passesHardConstraints(
  candidate: Candidate,
  constraints: MarketplaceHardConstraints,
) {
  if (typeof constraints.minQualityScore === "number") {
    const training = candidate.type === "training" ? (candidate.item as TrainingDataset) : null;
    if (!training || typeof training.qualityScore !== "number") {
      return false;
    }
    if (training.qualityScore < constraints.minQualityScore) {
      return false;
    }
  }

  if (typeof constraints.minEpisodes === "number") {
    const minEpisodes = constraints.minEpisodes;
    const episodeCount =
      candidate.type === "training"
        ? (candidate.item as TrainingDataset).episodeCount
        : typeof (candidate.item as MarketplaceScene).episodeCount === "number"
          ? ((candidate.item as MarketplaceScene).episodeCount as number)
          : 0;
    if (!episodeCount || episodeCount < minEpisodes) {
      return false;
    }
  }

  return true;
}

function passesFilters(candidate: Candidate, filters: MarketplaceSearchFilters) {
  const itemType = filters.itemType || "all";
  if (itemType === "scenes" && candidate.type !== "scene") return false;
  if (itemType === "training" && candidate.type !== "training") return false;

  if (filters.locationType) {
    if (candidate.item.locationType !== filters.locationType) return false;
  }

  if (filters.policySlug) {
    const policies = (candidate.item as any).policySlugs || [];
    if (!Array.isArray(policies) || !policies.includes(filters.policySlug)) {
      return false;
    }
  }

  const requiredObjects = Array.isArray(filters.objectTags) ? filters.objectTags : [];
  if (requiredObjects.length > 0) {
    if (!hasAllObjectTags(candidate.item, requiredObjects)) return false;
  }

  return true;
}

export function rankCandidates(params: {
  query: string;
  queryEmbedding: number[] | null;
  candidates: Candidate[];
  filters: MarketplaceSearchFilters;
  hard: MarketplaceHardConstraints;
  soft: MarketplaceSoftSignals;
}) {
  const policyTitleMap = buildPolicyTitleMap();
  const queryTokens = tokenize(params.query);

  const scored = params.candidates.map((candidate) => {
    const reasons: string[] = [];
    const item = candidate.item;

    const docTokens = tokenize(candidate.searchDoc);
    const lexicalScore = jaccardSimilarity(queryTokens, docTokens);

    const semanticSim =
      params.queryEmbedding && candidate.embedding
        ? cosineSimilarity(params.queryEmbedding, candidate.embedding)
        : null;

    const semanticScore =
      typeof semanticSim === "number" ? (1 + semanticSim) / 2 : null;

    const semanticAvailable = typeof semanticScore === "number";
    let finalScore = semanticAvailable
      ? 0.8 * semanticScore + 0.2 * lexicalScore
      : lexicalScore;

    // Deterministic boosts
    if (params.filters.locationType && item.locationType === params.filters.locationType) {
      finalScore += 0.05;
      reasons.push(`Archetype: ${item.locationType}`);
    }

    if (params.filters.policySlug) {
      const policies = (item as any).policySlugs || [];
      if (Array.isArray(policies) && policies.includes(params.filters.policySlug)) {
        finalScore += 0.05;
        const title = policyTitleMap.get(params.filters.policySlug) || params.filters.policySlug;
        reasons.push(`Policy: ${title}`);
      }
    }

    if (typeof params.hard.minQualityScore === "number" && candidate.type === "training") {
      const training = item as TrainingDataset;
      if (typeof training.qualityScore === "number") {
        finalScore += 0.05;
        reasons.push(
          `Quality ${training.qualityScore.toFixed(2)} >= ${params.hard.minQualityScore.toFixed(2)}`,
        );
      }
    }

    if (typeof params.hard.minEpisodes === "number") {
      const episodeCount =
        candidate.type === "training"
          ? (item as TrainingDataset).episodeCount
          : typeof (item as MarketplaceScene).episodeCount === "number"
            ? ((item as MarketplaceScene).episodeCount as number)
            : null;
      if (typeof episodeCount === "number") {
        reasons.push(
          `Episodes ${episodeCount.toLocaleString()}${episodeCount >= params.hard.minEpisodes ? " (meets)" : ""}`,
        );
      }
    }

    if (params.soft.tabletop && item.locationType === "Labs") {
      finalScore += 0.04;
      reasons.push("Boosted for tabletop (Labs)");
    }

    if (Array.isArray(params.soft.policySlugs) && params.soft.policySlugs.length) {
      const policies = (item as any).policySlugs || [];
      const hit = Array.isArray(policies)
        ? params.soft.policySlugs.find((slug) => policies.includes(slug))
        : null;
      if (hit) {
        finalScore += 0.03;
        const title = policyTitleMap.get(hit) || hit;
        reasons.push(`Matches: ${title}`);
      }
    }

    if (Array.isArray(params.soft.robotModels) && params.soft.robotModels.length && candidate.type === "training") {
      const training = item as TrainingDataset;
      const robotModels = new Set(training.robotModels || []);
      const hit = params.soft.robotModels.find((model) => robotModels.has(model));
      if (hit) {
        finalScore += 0.03;
        reasons.push(`Robot: ${hit}`);
      }
    }

    if (Array.isArray(params.soft.compatibleWith) && params.soft.compatibleWith.length && candidate.type === "training") {
      const training = item as TrainingDataset;
      const compatible = new Set(training.compatibleWith || []);
      const hit = params.soft.compatibleWith.find((name) => compatible.has(name));
      if (hit) {
        finalScore += 0.03;
        reasons.push(`Model: ${hit}`);
      }
    }

    if (Array.isArray(params.soft.objectTags) && params.soft.objectTags.length) {
      const objSet = new Set(item.objectTags || []);
      const overlap = params.soft.objectTags.filter((tag) => objSet.has(tag));
      if (overlap.length > 0) {
        finalScore += 0.02;
        reasons.push(`Objects: ${overlap.slice(0, 3).join(", ")}${overlap.length > 3 ? "…" : ""}`);
      }
    }

    finalScore = clamp(finalScore, 0, 1.5);

    return {
      candidate,
      score: finalScore,
      semanticScore,
      lexicalScore,
      reasons: reasons.slice(0, 6),
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function applySort(
  items: MarketplaceSearchResult[],
  sort: MarketplaceSearchSort | undefined,
) {
  const sortMode = sort || "relevance";
  if (sortMode === "relevance") {
    return items;
  }

  const copy = items.slice();
  switch (sortMode) {
    case "newest":
      copy.sort(
        (a, b) =>
          new Date((b.item as any).releaseDate).getTime() -
          new Date((a.item as any).releaseDate).getTime(),
      );
      return copy;
    case "price-asc":
      copy.sort((a, b) => (a.item as any).price - (b.item as any).price);
      return copy;
    case "price-desc":
      copy.sort((a, b) => (b.item as any).price - (a.item as any).price);
      return copy;
    case "scene-desc":
      copy.sort((a, b) => {
        const countA =
          a.type === "training" ? (a.item as TrainingDataset).episodeCount / 1000 : 1;
        const countB =
          b.type === "training" ? (b.item as TrainingDataset).episodeCount / 1000 : 1;
        return countB - countA;
      });
      return copy;
    default:
      return items;
  }
}

let staticIndex: { candidates: Candidate[]; usedEmbeddings: boolean } | null =
  null;
let staticIndexPromise: Promise<void> | null = null;

export function __resetMarketplaceSearchCacheForTests() {
  staticIndex = null;
  staticIndexPromise = null;
}

async function ensureStaticIndex(): Promise<{
  candidates: Candidate[];
  usedEmbeddings: boolean;
  warnings: string[];
}> {
  if (staticIndex) {
    return { candidates: staticIndex.candidates, usedEmbeddings: staticIndex.usedEmbeddings, warnings: [] };
  }

  if (!staticIndexPromise) {
    staticIndexPromise = (async () => {
      const policyTitleMap = buildPolicyTitleMap();
      const candidates: Candidate[] = [
        ...marketplaceScenes.map((scene) => ({
          type: "scene" as const,
          item: scene,
          searchDoc: "",
          embedding: null,
        })),
        ...trainingDatasets.map((dataset) => ({
          type: "training" as const,
          item: dataset,
          searchDoc: "",
          embedding: null,
        })),
      ];

      for (const candidate of candidates) {
        candidate.searchDoc = buildSearchDoc(candidate, policyTitleMap);
      }

      let embeddings: number[][] = [];
      let usedEmbeddings = false;
      try {
        embeddings = await embedTexts(candidates.map((candidate) => candidate.searchDoc));
        usedEmbeddings = embeddings.some((vector) => Array.isArray(vector) && vector.length > 0);
      } catch (error) {
        logger.warn({ err: error }, "Static marketplace embedding generation failed; using lexical scoring only");
      }

      if (embeddings.length === candidates.length) {
        for (let i = 0; i < candidates.length; i++) {
          candidates[i].embedding = embeddings[i]?.length ? embeddings[i] : null;
        }
      }

      staticIndex = { candidates, usedEmbeddings };
    })();
  }

  const warnings: string[] = [];
  await staticIndexPromise;
  if (!staticIndex) {
    return { candidates: [], usedEmbeddings: false, warnings: ["Marketplace search index is not ready."] };
  }
  if (!staticIndex.usedEmbeddings) {
    warnings.push("Embeddings are not configured; using lexical search only.");
  }
  return { candidates: staticIndex.candidates, usedEmbeddings: staticIndex.usedEmbeddings, warnings };
}

async function tryFirestoreVectorSearch(params: {
  query: string;
  queryEmbedding: number[];
  limit: number;
  filters: MarketplaceSearchFilters;
  hard: MarketplaceHardConstraints;
  soft: MarketplaceSoftSignals;
}): Promise<{ results: MarketplaceSearchResult[]; usedEmbeddings: boolean } | null> {
  if (!db) {
    return null;
  }

  const collectionRef = (db as Firestore).collection("marketplace_items");
  const finder = (collectionRef as any).findNearest;
  if (typeof finder !== "function") {
    return null;
  }

  const k = clamp(Math.max(params.limit * 5, 80), 1, 250);

  const snapshot = await finder.call(collectionRef, "embedding", params.queryEmbedding, {
    limit: k,
    distanceMeasure: "COSINE",
  });

  const candidates: Candidate[] = snapshot.docs
    .map((doc: any) => {
      const data = doc.data() || {};
      const type = data.type === "training" ? ("training" as const) : ("scene" as const);
      const item = data.item as MarketplaceScene | TrainingDataset;
      const embedding = Array.isArray(data.embedding) && data.embedding.length ? (data.embedding as number[]) : null;
      const searchDoc =
        typeof data.searchDoc === "string" && data.searchDoc.trim()
          ? data.searchDoc
          : buildSearchDoc({ type, item, embedding: null, searchDoc: "" }, buildPolicyTitleMap());
      return {
        type,
        item,
        embedding,
        searchDoc,
        // @ts-expect-error: Firestore vector search adds distance metadata
        distance: typeof doc.distance === "number" ? (doc.distance as number) : null,
      };
    })
    .filter((cand: any) => cand?.item?.slug && cand.searchDoc);

  const filtered = candidates
    .filter((candidate) => passesFilters(candidate, params.filters))
    .filter((candidate) => passesHardConstraints(candidate, params.hard));

  const ranked = rankCandidates({
    query: params.query,
    queryEmbedding: params.queryEmbedding,
    candidates: filtered,
    filters: params.filters,
    hard: params.hard,
    soft: params.soft,
  });

  const results: MarketplaceSearchResult[] = ranked.slice(0, params.limit).map((row) => ({
    type: row.candidate.type,
    item: row.candidate.item,
    score: row.score,
    // Firestore distances aren't surfaced consistently across SDK versions; keep null for now.
    distance: null,
    reasons: row.reasons,
  }));

  return { results, usedEmbeddings: true };
}

export async function searchMarketplace(params: {
  query: string;
  limit: number;
  filters: MarketplaceSearchFilters;
  hard: MarketplaceHardConstraints;
  soft: MarketplaceSoftSignals;
}): Promise<{ results: MarketplaceSearchResult[]; meta: MarketplaceSearchMeta; warnings: string[] }> {
  const warnings: string[] = [];
  const queryText = (params.query || "").trim();

  const queryEmbeddingResponse = await embedTexts([queryText]);
  const queryEmbedding =
    Array.isArray(queryEmbeddingResponse?.[0]) && queryEmbeddingResponse[0].length
      ? queryEmbeddingResponse[0]
      : null;

  if (!queryEmbedding) {
    warnings.push("Embeddings are not configured; using lexical search only.");
  }

  // Prefer Firestore vector search when available.
  if (queryEmbedding) {
    try {
      const firestore = await tryFirestoreVectorSearch({
        query: queryText,
        queryEmbedding,
        limit: params.limit,
        filters: params.filters,
        hard: params.hard,
        soft: params.soft,
      });
      if (firestore) {
        return {
          results: applySort(firestore.results, params.filters.sort),
          meta: {
            backend: "firestore-vector",
            embeddingModel: DEFAULT_EMBEDDING_MODEL,
            usedEmbeddings: true,
          },
          warnings,
        };
      }
    } catch (error) {
      logger.warn({ err: error }, "Firestore marketplace vector search failed; falling back to static search");
    }
  }

  const staticData = await ensureStaticIndex();
  warnings.push(...staticData.warnings);

  const filtered = staticData.candidates
    .filter((candidate) => passesFilters(candidate, params.filters))
    .filter((candidate) => passesHardConstraints(candidate, params.hard));

  const ranked = rankCandidates({
    query: queryText,
    queryEmbedding,
    candidates: filtered,
    filters: params.filters,
    hard: params.hard,
    soft: params.soft,
  });

  const results: MarketplaceSearchResult[] = ranked.slice(0, params.limit).map((row) => ({
    type: row.candidate.type,
    item: row.candidate.item,
    score: row.score,
    distance: null,
    reasons: row.reasons,
  }));

  return {
    results: applySort(results, params.filters.sort),
    meta: {
      backend: "static-inmemory",
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
      usedEmbeddings: Boolean(queryEmbedding) && staticData.usedEmbeddings,
    },
    warnings,
  };
}

