import crypto from "crypto";
import { URL } from "url";

import fetch, { RequestInit } from "node-fetch";
import type {
  DocumentData,
  DocumentReference,
  SetOptions,
  WithFieldValue,
} from "firebase-admin/firestore";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { KnowledgeSource, VenueChunk } from "../types/knowledge";
import { embedTexts } from "./embeddings";

const DEFAULT_MAX_SOURCES = Number(process.env.VENUE_INDEX_MAX_SOURCES ?? 16);
const DEFAULT_CHUNK_SIZE = Number(process.env.VENUE_INDEX_CHUNK_CHARS ?? 1600);
const DEFAULT_CHUNK_OVERLAP = Number(process.env.VENUE_INDEX_CHUNK_OVERLAP ?? 200);
const MAX_CHUNKS_PER_SOURCE = Number(process.env.VENUE_INDEX_MAX_CHUNKS_PER_SOURCE ?? 24);
const FETCH_TIMEOUT_MS = Number(process.env.VENUE_INDEX_FETCH_TIMEOUT_MS ?? 30_000);
const TEXT_LENGTH_LIMIT = Number(process.env.VENUE_INDEX_TEXT_LIMIT ?? 80_000);
const ROBOTS_CACHE_TTL_MS = Number(process.env.VENUE_INDEX_ROBOTS_CACHE_MS ?? 6 * 60 * 60 * 1000);

const jinaReaderBaseUrl = process.env.JINA_READER_BASE_URL || "https://r.jina.ai/";
const jinaApiKey = process.env.JINA_READER_API_KEY;

const robotsCache = new Map<string, { expiresAt: number; rules: RobotsRules | null }>();

function normalizeSourceUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function dedupeSources(sources: KnowledgeSource[]): KnowledgeSource[] {
  const map = new Map<string, KnowledgeSource>();
  for (const source of sources) {
    const normalizedUrl = normalizeSourceUrl(source.url);
    const normalizedTitle = source.title?.trim();
    if (!normalizedUrl || !normalizedTitle) continue;
    if (map.has(normalizedUrl)) continue;
    map.set(normalizedUrl, {
      ...source,
      title: normalizedTitle,
      url: normalizedUrl,
      category: source.category?.trim() || undefined,
      description: source.description?.trim() || undefined,
    });
  }
  return Array.from(map.values()).slice(0, DEFAULT_MAX_SOURCES);
}

type RobotsRules = {
  allow: string[];
  disallow: string[];
};

type BatchOperation =
  | {
      type: "set";
      ref: DocumentReference;
      data: WithFieldValue<DocumentData>;
      options?: SetOptions;
    }
  | {
      type: "delete";
      ref: DocumentReference;
    };

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function robotsMatchLength(rule: string, path: string) {
  if (!rule) return -1;
  const pattern = "^" + rule.split("*").map(escapeRegex).join(".*");
  const regex = new RegExp(pattern);
  const match = path.match(regex);
  return match ? match[0].length : -1;
}

function parseRobots(content: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [] };
  if (!content) return rules;

  const lines = content.split(/\r?\n/);
  let applies = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const [directiveRaw, valueRaw] = line.split(":", 2);
    if (!valueRaw) continue;

    const directive = directiveRaw.trim().toLowerCase();
    const value = valueRaw.trim();

    if (directive === "user-agent") {
      applies = value === "*";
      continue;
    }

    if (!applies) {
      continue;
    }

    if (directive === "allow") {
      rules.allow.push(value);
    } else if (directive === "disallow") {
      rules.disallow.push(value);
    }
  }

  return rules;
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1_000, FETCH_TIMEOUT_MS));
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function getRobotsRules(target: URL): Promise<RobotsRules | null> {
  const cacheKey = target.origin;
  const cached = robotsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rules;
  }

  try {
    const robotsUrl = new URL("/robots.txt", target.origin).toString();
    const response = await fetchWithTimeout(robotsUrl, {
      headers: { "User-Agent": "BlueprintCrawler/1.0" },
    });
    if (!response.ok) {
      robotsCache.set(cacheKey, {
        expiresAt: Date.now() + ROBOTS_CACHE_TTL_MS,
        rules: null,
      });
      return null;
    }

    const text = await response.text();
    const rules = parseRobots(text);
    robotsCache.set(cacheKey, {
      expiresAt: Date.now() + ROBOTS_CACHE_TTL_MS,
      rules,
    });
    return rules;
  } catch (error) {
    logger.warn({ host: target.host, err: error }, "Failed to fetch robots.txt; allowing crawl");
    robotsCache.set(cacheKey, {
      expiresAt: Date.now() + ROBOTS_CACHE_TTL_MS,
      rules: null,
    });
    return null;
  }
}

async function isUrlAllowed(url: URL) {
  try {
    const rules = await getRobotsRules(url);
    if (!rules) {
      return true;
    }

    const path = url.pathname || "/";
    let allowScore = -1;
    for (const rule of rules.allow) {
      allowScore = Math.max(allowScore, robotsMatchLength(rule, path));
    }

    let disallowScore = -1;
    for (const rule of rules.disallow) {
      disallowScore = Math.max(disallowScore, robotsMatchLength(rule, path));
    }

    if (allowScore === -1 && disallowScore === -1) {
      return true;
    }

    if (allowScore >= disallowScore) {
      return true;
    }

    return false;
  } catch (error) {
    logger.warn({ url: url.toString(), err: error }, "robots.txt evaluation failed; allowing crawl");
    return true;
  }
}

async function fetchViaJina(url: string) {
  try {
    const prefix = jinaReaderBaseUrl.endsWith("/") ? jinaReaderBaseUrl : `${jinaReaderBaseUrl}/`;
    const readerUrl = `${prefix}${url}`;
    const headers: Record<string, string> = {
      Accept: "text/plain, text/markdown;q=0.9, */*;q=0.1",
      "User-Agent": "BlueprintCrawler/1.0",
    };
    if (jinaApiKey) {
      headers["Authorization"] = `Bearer ${jinaApiKey}`;
    }
    const response = await fetchWithTimeout(readerUrl, { headers });
    if (!response.ok) {
      return null;
    }
    const text = await response.text();
    if (!text.trim()) {
      return null;
    }
    return text;
  } catch (error) {
    logger.warn({ url, err: error }, "Failed to fetch via Jina Reader");
    return null;
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|p|div|li|tr|td|th|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

async function fetchDirect(url: string) {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { "User-Agent": "BlueprintCrawler/1.0", Accept: "text/html, text/plain" },
    });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get("content-type") || "";
    const buffer = await response.text();
    if (/html/i.test(contentType)) {
      return stripHtml(buffer);
    }
    return buffer;
  } catch (error) {
    logger.warn({ url, err: error }, "Failed to fetch source directly");
    return null;
  }
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line)
    .join("\n");
}

function chunkText(text: string, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
  if (!text) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length && chunks.length < MAX_CHUNKS_PER_SOURCE) {
    const end = Math.min(text.length, start + chunkSize);
    const slice = text.slice(start, end);
    chunks.push(slice.trim());
    if (end === text.length) {
      break;
    }
    start = end - overlap;
    if (start < 0) {
      start = 0;
    }
  }
  return chunks.filter(Boolean);
}

function estimateTokens(text: string) {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).length;
  return Math.round(words * 1.3);
}

function hashChunk(url: string, text: string, index: number) {
  return crypto.createHash("sha1").update(`${url}::${index}::${text}`).digest("hex").slice(0, 32);
}

async function fetchSourceText(source: KnowledgeSource) {
  const normalizedUrl = normalizeSourceUrl(source.url);
  if (!normalizedUrl) {
    return null;
  }

  const target = new URL(normalizedUrl);
  const allowed = await isUrlAllowed(target);
  if (!allowed) {
    logger.info({ url: normalizedUrl }, "Skipping source due to robots.txt");
    return null;
  }

  const viaJina = await fetchViaJina(normalizedUrl);
  if (viaJina) {
    return viaJina.slice(0, TEXT_LENGTH_LIMIT);
  }

  const direct = await fetchDirect(normalizedUrl);
  if (direct) {
    return direct.slice(0, TEXT_LENGTH_LIMIT);
  }

  return null;
}

async function commitOperations(operations: BatchOperation[]) {
  if (!db || operations.length === 0) return;

  const batchSize = 450;
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = db.batch();
    const slice = operations.slice(i, i + batchSize);
    for (const op of slice) {
      if (op.type === "set") {
        if (op.options) {
          batch.set(op.ref, op.data, op.options);
        } else {
          batch.set(op.ref, op.data);
        }
      } else {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}

export async function buildVenueIndex(blueprintId: string, rawSources: KnowledgeSource[]) {
  if (!db) {
    logger.warn("Firestore is not configured; skipping venue indexing");
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    logger.warn({ blueprintId }, "OPENAI_API_KEY is not configured; skipping venue indexing");
    return;
  }

  try {
    const sources = dedupeSources(rawSources);
    if (sources.length === 0) {
      logger.info({ blueprintId }, "No knowledge sources provided; skipping index build");
      return;
    }

    const chunks: VenueChunk[] = [];

    for (const source of sources) {
      const text = await fetchSourceText(source);
      if (!text) {
        logger.warn({ blueprintId, url: source.url }, "No text extracted for knowledge source");
        continue;
      }

      const normalized = normalizeText(text);
      if (!normalized) {
        continue;
      }

      const chunkTexts = chunkText(normalized);
      if (chunkTexts.length === 0) {
        continue;
      }

      const embeddings = await embedTexts(chunkTexts);
      if (embeddings.length !== chunkTexts.length) {
        logger.warn(
          { blueprintId, url: source.url },
          "Embedding count did not match chunk count; skipping source",
        );
        continue;
      }

      chunkTexts.forEach((chunk, index) => {
        const chunkId = hashChunk(source.url, chunk, index);
        chunks.push({
          blueprintId,
          sourceUrl: source.url,
          sourceTitle: source.title,
          sourceCategory: source.category,
          chunkId,
          text: chunk,
          embedding: embeddings[index],
          tokenCount: estimateTokens(chunk),
        });
      });
    }

    const collectionRef = db
      .collection("blueprints")
      .doc(blueprintId)
      .collection("knowledge_chunks");

    const snapshot = await collectionRef.get();
    const newIds = new Set(chunks.map((chunk) => chunk.chunkId));

    const operations: BatchOperation[] = [];

    for (const doc of snapshot.docs) {
      if (!newIds.has(doc.id)) {
        operations.push({ type: "delete", ref: doc.ref });
      }
    }

    for (const chunk of chunks) {
      const docRef = collectionRef.doc(chunk.chunkId);
      operations.push({
        type: "set",
        ref: docRef,
        data: {
          blueprintId: chunk.blueprintId,
          sourceUrl: chunk.sourceUrl,
          sourceTitle: chunk.sourceTitle,
          sourceCategory: chunk.sourceCategory || null,
          text: chunk.text,
          embedding: chunk.embedding,
          tokenCount: chunk.tokenCount ?? null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        options: { merge: true },
      });
    }

    await commitOperations(operations);

    await db
      .collection("blueprints")
      .doc(blueprintId)
      .set(
        {
          aiKnowledgeIndex: {
            lastIndexedAt: admin.firestore.FieldValue.serverTimestamp(),
            sourceCount: sources.length,
            chunkCount: chunks.length,
          },
        },
        { merge: true },
      );

    logger.info(
      { blueprintId, sourceCount: sources.length, chunkCount: chunks.length },
      "Venue knowledge index updated",
    );
  } catch (error) {
    logger.error({ blueprintId, err: error }, "Failed to build venue knowledge index");
  }
}

export async function searchVenue(blueprintId: string, queryEmbedding: number[], k = 6) {
  if (!db) {
    logger.warn("Firestore is not configured. Returning empty search results.");
    return [];
  }

  const collectionRef = db
    .collection("blueprints")
    .doc(blueprintId)
    .collection("knowledge_chunks");

  const finder = (collectionRef as any).findNearest;
  if (typeof finder !== "function") {
    logger.warn("Firestore vector search is not available in this environment. Returning empty search results.");
    return [];
  }

  const snapshot = await finder.call(collectionRef, "embedding", queryEmbedding, {
    limit: k,
    distanceMeasure: "COSINE",
  });

  return snapshot.docs.map((doc: any) => ({
    ...(doc.data() as VenueChunk),
    distance: doc.distance ?? null,
    id: doc.id,
  }));
}
