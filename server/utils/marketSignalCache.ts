import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { MarketSignalProviderKey, MarketSignalRecord } from "./marketSignalProviders";

export interface MarketSignalCacheSnapshot {
  runId: string;
  topic: string;
  providerKey: MarketSignalProviderKey | null;
  signals: MarketSignalRecord[];
  lastSeenAtIso: string | null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSignalRecord(
  id: string,
  data: Record<string, unknown>,
): MarketSignalRecord | null {
  const topic = normalizeString(data.topic);
  const title = normalizeString(data.title);
  const summary = normalizeString(data.summary);
  if (!id || !topic || !title || !summary) {
    return null;
  }

  return {
    id,
    topic,
    title,
    summary,
    url: normalizeString(data.url) || null,
    source: normalizeString(data.source) || null,
    publishedAt: normalizeString(data.publishedAt) || null,
  };
}

export async function writeMarketSignalCache(params: {
  runId: string;
  providerKey: MarketSignalProviderKey;
  topic: string;
  signals: MarketSignalRecord[];
}) {
  if (!db) {
    throw new Error("Database not available");
  }

  const nowIso = new Date().toISOString();

  for (const signal of params.signals) {
    const signalRef = db.collection("market_signal_cache").doc(signal.id);
    const existing = await signalRef.get();
    const existingData =
      existing.exists && existing.data && typeof existing.data === "function"
        ? (existing.data() as Record<string, unknown> | undefined) || {}
        : {};
    const seenCount =
      typeof existingData.seen_count === "number" && Number.isFinite(existingData.seen_count)
        ? existingData.seen_count + 1
        : 1;

    await signalRef.set(
      {
        signal_id: signal.id,
        topic: signal.topic || params.topic,
        title: signal.title,
        summary: signal.summary,
        url: signal.url || null,
        source: signal.source || null,
        publishedAt: signal.publishedAt || null,
        signal_provider_key: params.providerKey,
        first_seen_run_id: normalizeString(existingData.first_seen_run_id) || params.runId,
        first_seen_at_iso: normalizeString(existingData.first_seen_at_iso) || nowIso,
        last_seen_run_id: params.runId,
        last_seen_at_iso: nowIso,
        seen_count: seenCount,
        updated_at_iso: nowIso,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
}

export async function readLatestMarketSignalSnapshot(): Promise<MarketSignalCacheSnapshot | null> {
  if (!db) {
    return null;
  }

  const latestSnapshot = await db
    .collection("market_signal_cache")
    .orderBy("last_seen_at_iso", "desc")
    .limit(1)
    .get();

  if (latestSnapshot.empty || latestSnapshot.docs.length === 0) {
    return null;
  }

  const latestDocData = latestSnapshot.docs[0].data() as Record<string, unknown>;
  const runId = normalizeString(latestDocData.last_seen_run_id);
  if (!runId) {
    return null;
  }

  const runSnapshot = await db
    .collection("market_signal_cache")
    .where("last_seen_run_id", "==", runId)
    .get();

  if (runSnapshot.empty || runSnapshot.docs.length === 0) {
    return null;
  }

  const docs = runSnapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as Record<string, unknown>,
  }));

  const signals = docs
    .map((entry) => normalizeSignalRecord(entry.id, entry.data))
    .filter((entry): entry is MarketSignalRecord => Boolean(entry));

  if (signals.length === 0) {
    return null;
  }

  const firstDoc = docs[0]?.data || {};

  return {
    runId,
    topic: signals[0]?.topic || normalizeString(firstDoc.topic),
    providerKey:
      normalizeString(firstDoc.signal_provider_key) === "web_search"
        ? "web_search"
        : normalizeString(firstDoc.signal_provider_key) === "firehose"
          ? "firehose"
          : null,
    signals,
    lastSeenAtIso: normalizeString(firstDoc.last_seen_at_iso) || null,
  };
}
