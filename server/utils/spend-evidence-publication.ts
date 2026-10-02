import { createHash, randomUUID } from "node:crypto";
import { Client } from "@notionhq/client";
import { dbAdmin, storageAdmin } from "../../client/src/lib/firebaseAdmin";

const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const digest = (value: unknown) => sha(JSON.stringify(value));
const root = (db: FirebaseFirestore.Firestore) => db.collection("blueprintSpendEvidence").doc("default");
const sourceId = (value: unknown) => typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
export const SPEND_LEDGER_DATA_SOURCE = "22a9c161-930d-4c6f-b7d7-de7cb4a4a065";
type Snapshot = { schema_version: string; generated_at: string; source_collected_at: string; snapshot_digest: string;
  rows: Record<string, any>[]; revision_history: Record<string, any>[]; coverage: Record<string, any>;
  local_metered_calls: Record<string, any>; notion_projection: { upserts: Record<string, any>[]; publication_gaps: Record<string, any>[] } };

export function parseRetainedSpendSnapshot(bytes: Buffer): Snapshot {
  const value = JSON.parse(bytes.toString("utf8")) as Snapshot;
  if (value.schema_version !== "blueprint.daily_spend_snapshot.v1" || !sourceId(value.snapshot_digest)
    || !Number.isFinite(Date.parse(value.generated_at)) || !Number.isFinite(Date.parse(value.source_collected_at))
    || !Array.isArray(value.rows) || !Array.isArray(value.revision_history) || !value.coverage
    || !Array.isArray(value.notion_projection?.upserts) || !Array.isArray(value.notion_projection?.publication_gaps))
    throw new Error("spend_snapshot_contract_invalid");
  for (const entry of value.notion_projection.upserts) {
    if (!sourceId(entry.source_key) || !sourceId(entry.revision_id) || entry.properties?.["Source key"] !== entry.source_key)
      throw new Error("spend_projection_identity_invalid");
  }
  return value;
}

/** Imports retained bytes only. Never polls a provider, estimates a charge,
 * or treats collection/import time as the provider's observation time. */
export async function retainSpendSnapshot(bytes: Buffer, provenance: { sourceRef: string; sourceVersion: string },
  dependencies: { db?: FirebaseFirestore.Firestore | null; storage?: typeof storageAdmin } = {}) {
  const snapshot = parseRetainedSpendSnapshot(bytes), byteHash = sha(bytes), db = dependencies.db === undefined ? dbAdmin : dependencies.db;
  const storage = dependencies.storage === undefined ? storageAdmin : dependencies.storage;
  if (!db || !storage || !provenance.sourceRef || !provenance.sourceVersion) throw new Error("spend_canonical_store_or_provenance_missing");
  const bucketName = "blueprint-8c1ca.appspot.com", objectName = `operations/spend/snapshots/${byteHash}.json`;
  const file = storage.bucket(bucketName).file(objectName);
  try { await file.save(bytes, { resumable: false, contentType: "application/json", preconditionOpts: { ifGenerationMatch: 0 } }); }
  catch (error: any) { if (Number(error.code) !== 412) throw error; }
  const [retained] = await file.download();
  if (sha(retained) !== byteHash) throw new Error("spend_canonical_bytes_readback_failed");
  const ref = root(db).collection("snapshots").doc(byteHash), artifactRef = `gs://${bucketName}/${objectName}`;
  const importedAt = new Date().toISOString();
  // Snapshot ref is the portable recovery route. Large source rows stay intact
  // in object storage; each small stable revision is separately inspectable.
  for (const row of snapshot.revision_history) {
    const observationId = digest(row), observation = root(db).collection("observations").doc(observationId);
    await db.runTransaction(async tx => {
      if ((await tx.get(observation)).exists) return;
      tx.create(observation, { schema: "blueprint.spend-observation.v1", row, artifactRef, artifactSha256: byteHash, importedAt,
        sourceKey: row.source_key ?? null, revisionId: row.revision_id ?? null, provenance });
    });
  }
  await db.runTransaction(async tx => {
    if ((await tx.get(ref)).exists) return;
    tx.create(ref, { schema: "blueprint.spend-snapshot.v1", artifactRef, artifactSha256: byteHash, importedAt, provenance,
      sourceCollectedAt: snapshot.source_collected_at, generatedAt: snapshot.generated_at, snapshotDigest: snapshot.snapshot_digest,
      coverage: snapshot.coverage, rowCount: snapshot.rows.length, revisionCount: snapshot.revision_history.length,
      publicationGapCount: snapshot.notion_projection.publication_gaps.length, publicationStatus: "pending_owner_resumption" });
  });
  return { artifactRef, artifactSha256: byteHash, snapshotId: byteHash, rows: snapshot.rows.length,
    revisions: snapshot.revision_history.length, coverage: snapshot.coverage };
}

const textChunks = (value: string) => {
  const chunks: string[] = []; let chunk = "";
  for (const char of value) { if ((chunk + char).length > 1800) { chunks.push(chunk); chunk = ""; } chunk += char; }
  if (chunk) chunks.push(chunk);
  return chunks.map(content => ({ text: { content } }));
};
const selectFields = new Set(["Basis", "Currency", "Expense rollup", "Freshness", "Kind", "MTD status", "Payment status", "Scope"]);
const richTextFields = new Set(["Source key", "Provider", "Service", "Account / project", "Workflow", "Coverage gap", "Next action", "Reconciliation", "Anomaly"]);
const dateFields = new Set(["Source checked", "Source observed", "Day", "Period start", "Period end", "MTD month"]);
function supportedProperty(key: string) {
  const date = key.match(/^date:(.+):(start|end|is_datetime)$/);
  return date ? dateFields.has(date[1]) : ["Entry", "Amount", "Expense MTD", "Source"].includes(key) || selectFields.has(key) || richTextFields.has(key);
}
export function unsupportedSpendProperties(entry: Record<string, any>) {
  return [...new Set([...Object.keys(entry.properties ?? {}), ...(entry.clear_properties ?? [])])].filter(key => !supportedProperty(key));
}
/** Exact existing ledger schema, including clearing corrected values. No
 * invoice/cash/funding rows outside the received projection are changed. */
export function spendNotionProperties(entry: Record<string, any>) {
  const out: Record<string, any> = {}, values = { ...entry.properties };
  for (const field of entry.clear_properties ?? []) values[field] = null;
  for (const [key, value] of Object.entries(values)) {
    if (!supportedProperty(key)) continue; // Original unsupported bytes stay in the canonical snapshot.
    if (key.endsWith(":is_datetime") || key.endsWith(":end")) continue;
    if (key.startsWith("date:") && key.endsWith(":start")) {
      out[key.slice(5, -6)] = { date: value === null ? null : { start: value, ...(values[key.slice(0, -5) + "end"] ? { end: values[key.slice(0, -5) + "end"] } : {}) } }; continue;
    }
    if (key === "Entry") out[key] = { title: textChunks(String(value ?? "")) };
    else if (key === "Amount" || key === "Expense MTD") {
      if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) throw new Error("spend_amount_invalid");
      out[key] = { number: value };
    } else if (key === "Source") out[key] = { url: value || null };
    else if (selectFields.has(key)) out[key] = { select: value === null ? null : { name: value } };
    else out[key] = { rich_text: textChunks(String(value ?? "")) };
  }
  return out;
}

// Compare full RFC3339 instants without changing retained bytes or rounding
// sub-millisecond precision. Calendar dates keep their original grain.
function parsedTimestamp(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/i);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, fraction, offset] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m < 1 || m > 12 || d < 1 || d > monthDays[m - 1]
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || (offset.toUpperCase() !== "Z" && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4, 6)) > 59))) return null;
  const milliseconds = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset.toUpperCase()}`);
  if (!Number.isFinite(milliseconds)) return null;
  return { milliseconds, fraction: (fraction ?? "").replace(/0+$/, "") };
}
const comparableTimestamp = (value: unknown) => parsedTimestamp(value) ?? value;
function observationTimeOrder(a: unknown, b: unknown) {
  const left = parsedTimestamp(a), right = parsedTimestamp(b);
  if (!left || !right) throw new Error("spend_observation_time_invalid");
  if (left.milliseconds !== right.milliseconds) return left.milliseconds < right.milliseconds ? -1 : 1;
  const width = Math.max(left.fraction.length, right.fraction.length);
  const l = left.fraction.padEnd(width, "0"), r = right.fraction.padEnd(width, "0");
  return l === r ? 0 : l < r ? -1 : 1;
}

function propertyValue(property: any) {
  if (!property) return undefined;
  if (property.title) return property.title.map((part: any) => part.plain_text ?? part.text?.content ?? "").join("");
  if (property.rich_text) return property.rich_text.map((part: any) => part.plain_text ?? part.text?.content ?? "").join("");
  if ("number" in property) return property.number;
  if ("select" in property) return property.select?.name ?? null;
  if ("date" in property) return property.date ? { start: comparableTimestamp(property.date.start),
    end: comparableTimestamp(property.date.end ?? null), time_zone: property.date.time_zone ?? null } : null;
  if ("url" in property) return property.url;
}
const sameProperty = (a: unknown, b: unknown) => JSON.stringify(propertyValue(a)) === JSON.stringify(propertyValue(b));

/** An authenticated operator may release a crashed local writer only after
 * establishing that its process ended. This marks the external result unknown;
 * ordinary publication must still reconcile the exact revision by readback. */
export async function reconcileEndedSpendWriter(input: { sourceKey: string; attemptId: string; actor: string;
  processEndedEvidenceRef: string }, db = dbAdmin) {
  if (!db || !sourceId(input.sourceKey) || !input.attemptId || !input.actor || !input.processEndedEvidenceRef)
    throw new Error("spend_writer_reconciliation_evidence_missing");
  const ref = root(db).collection("notionBindings").doc(input.sourceKey.slice(7));
  return db.runTransaction(async tx => {
    const prior = (await tx.get(ref)).data();
    if (!prior || prior.attemptId !== input.attemptId) throw new Error("spend_writer_reconciliation_stale");
    if (prior.status === "publication_unknown" && prior.reconciliation?.processEndedEvidenceRef === input.processEndedEvidenceRef)
      return { reconciled: false, reason: "duplicate" };
    if (prior.status !== "publication_writing") throw new Error("spend_writer_reconciliation_status_invalid");
    tx.set(ref, { ...prior, status: "publication_unknown", reconciliation: { ...input, observedAt: new Date().toISOString() } });
    return { reconciled: true, reason: "external_result_unknown" };
  });
}

/** Requires explicit owner resumption. Query-before-create plus durable
 * unknown-create intent makes retries reconcile rather than duplicate rows. */
export async function publishSpendProjection(snapshot: Snapshot, dependencies: { db?: FirebaseFirestore.Firestore | null; notion?: any } = {}) {
  if (process.env.BLUEPRINT_SPEND_PUBLICATION_ENABLED !== "true") return { published: 0, stale: 0, quarantined: [] as string[], reason: "spend_publication_stopped" };
  const db = dependencies.db === undefined ? dbAdmin : dependencies.db;
  const token = process.env.NOTION_API_KEY || process.env.NOTION_API_TOKEN;
  // The durable intent owns unknown outcomes; SDK retries must not duplicate a create.
  const notion = dependencies.notion ?? (token ? new Client({ auth: token, retry: false, timeoutMs: 15000 }) : null);
  if (!db || !notion) throw new Error("spend_publication_existing_binding_missing");
  if (!parsedTimestamp(snapshot.source_collected_at)) throw new Error("spend_source_observation_time_invalid");
  let published = 0, stale = 0;
  const quarantined: string[] = [];
  for (const entry of snapshot.notion_projection.upserts) {
    const unsupported = unsupportedSpendProperties(entry);
    if (unsupported.length) { quarantined.push(entry.source_key); continue; }
    const ref = root(db).collection("notionBindings").doc(entry.source_key.slice(7));
    const query = await notion.dataSources.query({ data_source_id: SPEND_LEDGER_DATA_SOURCE,
      filter: { property: "Source key", rich_text: { equals: entry.source_key } }, page_size: 100 });
    if (query.has_more !== false || query.results.length > 1) throw new Error("spend_notion_identity_ambiguous");
    const properties = spendNotionProperties(entry), found = query.results[0], attemptId = randomUUID();
    const admission = await db.runTransaction(async tx => {
      const prior = (await tx.get(ref)).data() ?? {};
      // An active writer never expires into a second writer. A crashed process
      // needs operator reconciliation with evidence that its attempt is over.
      if (prior.status === "publication_writing") throw new Error("spend_publication_writer_active");
      const observationOrder = prior.sourceCollectedAt === undefined ? null
        : observationTimeOrder(prior.sourceCollectedAt, snapshot.source_collected_at);
      if (observationOrder !== null && observationOrder > 0) return "stale";
      if (observationOrder === 0 && prior.revisionId && prior.revisionId !== entry.revision_id)
        throw new Error("spend_same_time_revision_conflict");
      if (prior.status === "publication_unknown") {
        if (found && prior.revisionId === entry.revision_id && prior.propertyDigest === digest(properties)
          && Object.entries(properties).every(([name, expected]) => sameProperty(found.properties?.[name], expected))) {
          tx.set(ref, { ...prior, status: "readback_verified", pageId: found.id, verifiedAt: new Date().toISOString() });
          return "reconciled";
        }
        throw new Error("spend_notion_publication_unknown_reconcile_required");
      }
      if (!found && prior.createAttempted) throw new Error("spend_notion_create_unknown_reconcile_required");
      if (found && Object.entries(properties).every(([name, expected]) => sameProperty(found.properties?.[name], expected))) {
        tx.set(ref, { ...prior, sourceKey: entry.source_key, revisionId: entry.revision_id, sourceCollectedAt: snapshot.source_collected_at,
          propertyDigest: digest(properties), status: "readback_verified", pageId: found.id, verifiedAt: new Date().toISOString() });
        return "reconciled";
      }
      tx.set(ref, { ...prior, sourceKey: entry.source_key, revisionId: entry.revision_id, sourceCollectedAt: snapshot.source_collected_at,
        attemptId, propertyDigest: digest(properties), status: "publication_writing", createAttempted: !found || prior.createAttempted === true, observedAt: new Date().toISOString() });
      return "publish";
    });
    if (admission === "stale") { stale++; continue; }
    if (admission === "reconciled") { published++; continue; }
    try {
      const page = found ? await notion.pages.update({ page_id: found.id, properties })
        : await notion.pages.create({ parent: { type: "data_source_id", data_source_id: SPEND_LEDGER_DATA_SOURCE }, properties });
      const readback = await notion.pages.retrieve({ page_id: page.id });
      for (const [name, expected] of Object.entries(properties))
        if (!sameProperty(readback.properties?.[name], expected)) throw new Error(`spend_notion_readback_failed:${name}`);
      await db.runTransaction(async tx => {
        const prior = (await tx.get(ref)).data();
        if (prior?.attemptId !== attemptId || prior?.status !== "publication_writing") throw new Error("spend_writer_completion_fence_changed");
        tx.set(ref, { ...prior, pageId: page.id, status: "readback_verified", verifiedAt: new Date().toISOString() });
      });
    } catch (error) {
      await db.runTransaction(async tx => {
        const prior = (await tx.get(ref)).data();
        if (prior?.attemptId === attemptId && prior?.status === "publication_writing")
          tx.set(ref, { ...prior, status: "publication_unknown", settledLocallyAt: new Date().toISOString() });
      });
      throw error;
    }
    published++;
  }
  return { published, stale, quarantined, reason: null };
}

export async function runSpendPublicationLoop() {
  if (process.env.BLUEPRINT_SPEND_PUBLICATION_ENABLED !== "true")
    return { processedCount: 0, failedCount: 0, reason: "spend_publication_stopped" };
  if (!dbAdmin || !storageAdmin) throw new Error("spend_canonical_store_missing");
  const pending = await root(dbAdmin).collection("snapshots").where("publicationStatus", "==", "pending_owner_resumption").limit(10).get();
  let processedCount = 0;
  for (const record of pending.docs) {
    const saved = record.data(), expected = `gs://blueprint-8c1ca.appspot.com/operations/spend/snapshots/${record.id}.json`;
    if (saved.artifactRef !== expected || saved.artifactSha256 !== record.id) throw new Error("spend_snapshot_binding_invalid");
    const [bytes] = await storageAdmin.bucket("blueprint-8c1ca.appspot.com").file(`operations/spend/snapshots/${record.id}.json`).download();
    if (sha(bytes) !== record.id) throw new Error("spend_snapshot_bytes_changed");
    const result = await publishSpendProjection(parseRetainedSpendSnapshot(bytes));
    await record.ref.set({ publicationStatus: result.quarantined.length ? "unsupported_projection_quarantined"
      : result.stale ? "superseded_by_newer_observation" : "readback_verified", published: result.published,
      stale: result.stale, quarantinedSourceKeys: result.quarantined, verifiedAt: new Date().toISOString() }, { merge: true });
    processedCount++;
  }
  return { processedCount, failedCount: 0, reason: null };
}
