/** Disposable durable file-backed fakes. Not Firestore/GCS emulator fidelity. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { Writable } from "node:stream";
import { Firestore, FieldValue } from "firebase-admin/firestore";
import { createFakeFirestore, type StoredDoc } from "./fake-firestore";

export const root = path.resolve("output/reliability-program/journeys/storage");
fs.mkdirSync(root, { recursive: true });
const documentPath = path.join(root, "documents.json");
function atomicWrite(target: string, value: unknown) {
  fs.writeFileSync(`${target}.next`, JSON.stringify(value));
  fs.renameSync(`${target}.next`, target);
}
class DurableMap extends Map<string, StoredDoc> {
  ready = false;
  constructor(rows: [string, StoredDoc][] = []) { super(rows); this.ready = true; }
  persist() { if (this.ready) atomicWrite(documentPath, [...this.entries()]); }
  override set(key: string, value: StoredDoc) { super.set(key, value); this.persist(); return this; }
  override delete(key: string) { const deleted = super.delete(key); this.persist(); return deleted; }
  override clear() { super.clear(); this.persist(); }
}
export const state = { docs: new DurableMap() };
export const emulatorMode = process.env.RELIABILITY_FIRESTORE_EMULATOR === "1";
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
if (emulatorMode && emulatorHost !== "127.0.0.1:8085") throw new Error("Reliability Firestore must bind the isolated loopback emulator");
const emulatorDatabase = emulatorMode ? new Firestore({ projectId: "demo-blueprint-reliability", ignoreUndefinedProperties: true }) : null;
export const database = emulatorDatabase ?? createFakeFirestore(state);
export const fieldValue = emulatorMode ? FieldValue : { serverTimestamp: () => "local-timestamp", delete: () => "__FAKE_FIRESTORE_FIELD_DELETE__", increment: (value: number) => value };
export async function refreshDocumentView() {
  if (!emulatorDatabase) return;
  const collections = await emulatorDatabase.listCollections();
  const rows: [string, StoredDoc][] = [];
  for (const collection of collections) {
    const docs = await collection.get();
    for (const doc of docs.docs) rows.push([doc.ref.path, doc.data()]);
  }
  state.docs = new DurableMap(rows);
  state.docs.persist();
}
export async function clearEmulator() {
  if (!emulatorMode) return;
  const response = await fetch("http://127.0.0.1:8085/emulator/v1/projects/demo-blueprint-reliability/databases/(default)/documents", { method: "DELETE" });
  if (!response.ok) throw new Error("Cannot clear isolated reliability emulator");
}
export function reloadDocuments() {
  state.docs = new DurableMap(JSON.parse(fs.readFileSync(documentPath, "utf8")));
}
export const faults = { storageUnavailable: false, manifestOnce: false, writeDelayMs: 0, holdVideoWrites: false, videoWriteReached: false };
let heldWrites: (() => void)[] = [];
export function releaseVideoWrites() { faults.holdVideoWrites = false; const selected = heldWrites; heldWrites = []; for (const finish of selected) finish(); }
type ObjectRow = { name: string; generation: string; size: string; crc32c: string; contentType?: string; metadata?: unknown; body: string };
const objectPath = path.join(root, "objects.json");
let objects: Record<string, ObjectRow> = {};
let generation = 0;
export function resetStorage() {
  objects = {}; generation = 0; state.docs.clear();
  faults.storageUnavailable = false; faults.manifestOnce = false; faults.writeDelayMs = 0; faults.holdVideoWrites = false; faults.videoWriteReached = false; heldWrites = [];
  atomicWrite(objectPath, objects);
}
export function reloadObjects() {
  objects = JSON.parse(fs.readFileSync(objectPath, "utf8"));
  generation = Math.max(0, ...Object.values(objects).map(row => Number(row.generation)));
}
export const bucket = {
  name: "local-reliability-fixture",
  file(name: string, options?: { generation?: string; preconditionOpts?: { ifGenerationMatch?: number | string } }) {
    let responseMetadata: ObjectRow | undefined;
    const current = () => {
      if (faults.storageUnavailable) throw new Error("local_storage_unavailable");
      const row = objects[name];
      if (!row || (options?.generation && row.generation !== options.generation)) throw Object.assign(new Error("local_object_missing"), { code: 404 });
      return row;
    };
    const write = (bytes: Buffer, opts: any = {}) => {
      if (faults.storageUnavailable) throw new Error("local_storage_unavailable");
      if (faults.manifestOnce && name.endsWith("/manifest.json")) { faults.manifestOnce = false; throw new Error("local_manifest_fault"); }
      const expected = opts.preconditionOpts?.ifGenerationMatch ?? opts.ifGenerationMatch;
      if (expected !== undefined && String(expected) !== (objects[name]?.generation ?? "0")) throw Object.assign(new Error("local_precondition_failed"), { code: 412 });
      const row = { name, generation: String(++generation), size: String(bytes.length), crc32c: "AAAAAA==", contentType: opts.contentType, metadata: opts.metadata, body: bytes.toString("base64") };
      objects[name] = row; responseMetadata = row; atomicWrite(objectPath, objects);
    };
    return {
      get metadata() { return responseMetadata; },
      async getMetadata() { return [current()]; },
      async exists() { try { current(); return [true]; } catch (error) { if ((error as any).code === 404) return [false]; throw error; } },
      async download() { return [Buffer.from(current().body, "base64")]; },
      async save(bytes: Buffer | string, opts?: unknown) { write(Buffer.from(bytes), opts); },
      async delete(opts?: any) {
        let row: ObjectRow;
        try { row = current(); } catch (error) { if (opts?.ignoreNotFound && (error as any).code === 404) return; throw error; }
        const expected = opts?.ifGenerationMatch ?? options?.preconditionOpts?.ifGenerationMatch;
        if (expected !== undefined && String(expected) !== row.generation) throw Object.assign(new Error("local_precondition_failed"), { code: 412 });
        delete objects[name]; atomicWrite(objectPath, objects);
      },
      async getSignedUrl() { return ["https://fixture.invalid/never-fetch"]; },
      createWriteStream(opts?: unknown) {
        const chunks: Buffer[] = [];
        return new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); },
          final(callback) {
            const finish = () => { try { write(Buffer.concat(chunks), opts); callback(); } catch (error) { callback(error as Error); } };
            if (name.endsWith(".mp4") || name.endsWith(".mov")) faults.videoWriteReached = true;
            if (faults.holdVideoWrites && (name.endsWith(".mp4") || name.endsWith(".mov"))) heldWrites.push(finish);
            else if (faults.writeDelayMs) setTimeout(finish, faults.writeDelayMs); else finish();
          },
        });
      },
    };
  },
  async getFiles({ prefix }: { prefix: string }) { return [Object.keys(objects).filter(name => name.startsWith(prefix)).map(name => ({ name }))]; },
};
export function durableSummary() {
  return { documents: state.docs.size, object_count: Object.keys(objects).length,
    document_sha256: createHash("sha256").update(fs.readFileSync(documentPath)).digest("hex"),
    objects_sha256: createHash("sha256").update(fs.readFileSync(objectPath)).digest("hex") };
}
