/** Device-local crash recovery. No provider, server, or bearer URL is stored here. */
import type { SiteCaptureRecovery } from "./siteCaptureDraft";
export type DurableSiteCaptureRow = { value: SiteCaptureRecovery | null; retired: boolean };
const DATABASE = "blueprint-site-capture-recovery-v1";
const STORE = "recovery";
async function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("Durable browser storage is unavailable");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let settled = false;
    const timeout = setTimeout(() => { settled = true; reject(new Error("Durable browser storage did not open")); }, 5000);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => { clearTimeout(timeout); settled = true; reject(request.error); };
    request.onblocked = () => { clearTimeout(timeout); settled = true; reject(new Error("Durable browser storage is blocked")); };
    request.onsuccess = () => { clearTimeout(timeout); if (settled) request.result.close(); else resolve(request.result); };
  });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, setResult: (value: T) => void) => void): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode, mode === "readwrite" ? { durability: "strict" } : undefined);
      if (mode === "readwrite" && tx.durability !== "strict") { tx.abort(); reject(new Error("Strict browser durability is unavailable")); return; }
      let result: T;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error || new Error("Durable recovery transaction was aborted"));
      tx.onerror = () => reject(tx.error || new Error("Durable recovery transaction failed"));
      try { action(tx.objectStore(STORE), value => { result = value; }); }
      catch (error) { tx.abort(); reject(error); }
    });
  } finally { db.close(); }
}
export async function readDurableSiteCaptureRecovery(key: string): Promise<DurableSiteCaptureRow | null> {
  return transaction("readonly", (store, done) => { const request = store.get(key); request.onsuccess = () => done(request.result ?? null); });
}
export async function writeDurableSiteCaptureRecovery(key: string, value: SiteCaptureRecovery, replaceIdentity = false): Promise<void> {
  await transaction<void>("readwrite", (store, done) => {
    const request = store.get(key);
    request.onsuccess = () => {
      const current = request.result as DurableSiteCaptureRow | undefined;
      // Ordinary delayed writes cannot reopen a logout tombstone or replace another generation.
      if (!replaceIdentity && current && (current.retired || current.value?.requestId !== value.requestId
        || current.value?.retryToken !== value.retryToken)) { request.transaction!.abort(); return; }
      const { task, location, email, company, method, region, regionManuallySet, privateHandling } = value.draft;
      const canonical = { version: value.version, savedAt: value.savedAt, requestId: value.requestId, retryToken: value.retryToken,
        draft: { task, location, email, company, method, region, regionManuallySet, ...(privateHandling === true ? { privateHandling } : {}) },
        pending: value.pending ? { body: value.pending.body, endpoint: value.pending.endpoint, acknowledged: value.pending.acknowledged } : null };
      store.put({ value: canonical, retired: false } satisfies DurableSiteCaptureRow, key); done(undefined);
    };
  });
}
export async function retireDurableSiteCaptureRecovery(key: string): Promise<void> {
  await transaction<void>("readwrite", (store, done) => { store.put({ value: null, retired: true } satisfies DurableSiteCaptureRow, key); done(undefined); });
}
export async function durableSiteCaptureRecoveryKeys(): Promise<string[]> {
  return transaction("readonly", (store, done) => { const request = store.getAllKeys(); request.onsuccess = () => done(request.result.filter((key): key is string => typeof key === "string")); });
}
