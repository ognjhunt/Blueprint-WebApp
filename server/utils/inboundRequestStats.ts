import admin from "../../client/src/lib/firebaseAdmin";

/**
 * Sharded counters for the stats/inboundRequests summary document.
 *
 * Every inbound-lead submission and status transition previously incremented
 * fields on the single stats/inboundRequests doc, which contends at
 * Firestore's ~1 sustained write/sec/doc ceiling under lead bursts. Writes now
 * land on a random shard under stats/inboundRequests/shards/{0..N-1}; reads
 * sum the legacy base doc (which keeps its historic totals) plus all shards.
 */
export const INBOUND_REQUEST_STATS_SHARD_COUNT = 8;

const STATS_COLLECTION = "stats";
const BASE_DOC_ID = "inboundRequests";
const SHARDS_SUBCOLLECTION = "shards";

type Db = FirebaseFirestore.Firestore;

function shardsCollection(db: Db) {
  return db
    .collection(STATS_COLLECTION)
    .doc(BASE_DOC_ID)
    .collection(SHARDS_SUBCOLLECTION);
}

export function pickInboundRequestStatsShard(random: () => number = Math.random): string {
  return String(Math.floor(random() * INBOUND_REQUEST_STATS_SHARD_COUNT));
}

/**
 * Apply numeric field deltas (dot-path keys, e.g. "byStatus.submitted") to a
 * random shard. Mirrors the set(..., { merge: true }) + FieldValue.increment
 * shape the base doc previously used, so nested map layout is unchanged.
 */
export async function incrementInboundRequestStats(
  db: Db,
  deltas: Record<string, number>,
  random: () => number = Math.random,
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  for (const [field, delta] of Object.entries(deltas)) {
    payload[field] = admin.firestore.FieldValue.increment(delta);
  }
  await shardsCollection(db)
    .doc(pickInboundRequestStatsShard(random))
    .set(payload, { merge: true });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  // Excludes Timestamp/GeoPoint/etc. class instances, whose own numeric
  // fields must not be summed as counters.
  return proto === Object.prototype || proto === null;
}

function addNumericLeaves(target: Record<string, unknown>, source: unknown): void {
  if (!isPlainObject(source)) return;
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      const current = target[key];
      target[key] = (typeof current === "number" ? current : 0) + value;
    } else if (isPlainObject(value)) {
      const nested = isPlainObject(target[key])
        ? (target[key] as Record<string, unknown>)
        : {};
      target[key] = nested;
      addNumericLeaves(nested, value);
    }
  }
}

/**
 * Read the summed stats view: legacy base doc totals plus every shard.
 * Non-numeric fields (e.g. updatedAt) are kept from the base doc only.
 */
export async function readInboundRequestStats(db: Db): Promise<Record<string, unknown>> {
  const [baseSnapshot, shardsSnapshot] = await Promise.all([
    db.collection(STATS_COLLECTION).doc(BASE_DOC_ID).get(),
    shardsCollection(db).get(),
  ]);
  const totals: Record<string, unknown> = baseSnapshot.exists
    ? { ...(baseSnapshot.data() ?? {}) }
    : {};
  const summed: Record<string, unknown> = {};
  addNumericLeaves(summed, totals);
  for (const shard of shardsSnapshot.docs) {
    addNumericLeaves(summed, shard.data());
  }
  return { ...totals, ...summed };
}
