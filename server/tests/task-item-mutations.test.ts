// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  get dbAdmin() { return fixture.db; },
  default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } },
}));
import { upsertItem, removeItem, recordItemImage, saveItemInventory } from "../utils/taskItemInventory";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";

const key = "siteTaskItemInventories/request";
const clone = <T>(value: T): T => structuredClone(value);
/** Optimistic callback reentry fixture, not a general Firestore emulator. */
function store() {
  const docs = new Map<string, any>(), versions = new Map<string, number>();
  const stagedItems: any[][] = [];
  let callbackRuns = 0;
  let afterFirstRead: null | (() => Promise<void>) = null;
  const put = (path: string, value: any, merge = false) => {
    docs.set(path, clone(merge ? { ...docs.get(path), ...value } : value));
    versions.set(path, (versions.get(path) ?? 0) + 1);
  };
  const read = async (path: string) => {
    const value = clone(docs.get(path));
    const snapshot = { exists: value !== undefined, data: () => clone(value), version: versions.get(path) ?? 0 };
    if (path === key && afterFirstRead) {
      const pause = afterFirstRead; afterFirstRead = null; await pause();
    }
    return snapshot;
  };
  const db = {
    collection: (collection: string) => ({ doc: (id: string) => ({ path: `${collection}/${id}`,
      get: () => read(`${collection}/${id}`),
      set: async (value: any, options?: { merge?: boolean }) => put(`${collection}/${id}`, value, options?.merge),
    }) }),
    runTransaction: async (callback: (tx: any) => Promise<any>) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        callbackRuns++;
        const reads = new Map<string, number>();
        const writes: { ref: any; value: any; merge: boolean }[] = [];
        const result = await callback({
          get: async (ref: any) => {
            if (writes.length) throw new Error("read_after_write");
            const snapshot = await read(ref.path); reads.set(ref.path, snapshot.version); return snapshot;
          },
          set: (ref: any, value: any, options?: { merge?: boolean }) => {
            stagedItems.push(clone(value.items)); writes.push({ ref, value: clone(value), merge: Boolean(options?.merge) });
          },
        });
        if ([...reads].some(([path, version]) => version !== (versions.get(path) ?? 0))) continue;
        for (const write of writes) put(write.ref.path, write.value, write.merge);
        return result;
      }
      throw new Error("fixture_conflict_exhausted");
    },
  };
  return { db, docs, put, stagedItems, get callbackRuns() { return callbackRuns; },
    pauseFirstRead() {
      let reached!: () => void, resume!: () => void;
      const waiting = new Promise<void>(resolve => { reached = resolve; });
      const release = new Promise<void>(resolve => { resume = resolve; });
      afterFirstRead = async () => { reached(); await release; };
      return { waiting, resume };
    } };
}
const item = (itemId: string) => ({ itemId, label: itemId, basis: "operator_added", images: [], assetStatus: "sim_ready" });
const photo = { imageId: "accepted-photo", storagePath: "scenes/request/photo.jpg", uploadedAtIso: "2026-10-07T00:00:00Z" };
let state: ReturnType<typeof store>;
beforeEach(() => {
  state = store(); fixture.db = state.db;
  state.put(key, { requestId: "request", items: [item("keep"), item("remove")], updatedAtIso: "before", legacyReceipt: "retain" });
  state.put("inboundRequests/request", { request: { consent_attestation: {
    granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-07T00:00:00Z",
  } } });
});
afterEach(() => vi.restoreAllMocks());

describe("owner inventory writes retry against accepted concurrent work", () => {
  it.each(["edit", "remove"] as const)("%s preserves a photo committed after its first snapshot", async operation => {
    const gate = state.pauseFirstRead();
    const mutation = operation === "edit" ? upsertItem("request", { itemId: "keep", label: "Renamed bin" })
      : removeItem("request", "remove");
    await gate.waiting;
    try {
      expect(await recordItemImage("request", "keep", photo)).not.toBeNull();
    } finally { gate.resume(); }
    const result = await mutation;
    const kept = result.items.find(value => value.itemId === "keep")!;
    expect(kept.images).toEqual([photo]);
    expect(kept.assetStatus).toBe("sim_ready");
    expect(state.docs.get(key).legacyReceipt).toBe("retain");
    if (operation === "edit") expect(kept.label).toBe("Renamed bin");
    else expect(result.items.map(value => value.itemId)).toEqual(["keep"]);
    expect(state.callbackRuns).toBe(3); // photo once; owner callback before and after the conflict
  });

  it("keeps one generated ID across callback retries and preserves a peer's accepted addition", async () => {
    const gate = state.pauseFirstRead();
    const first = upsertItem("request", { label: "First owner addition" });
    await gate.waiting;
    try { await upsertItem("request", { label: "Peer addition" }); } finally { gate.resume(); }
    const result = await first;
    expect(result.items.filter(value => value.label === "Peer addition")).toHaveLength(1);
    const firstIds = state.stagedItems.flat().filter(value => value.label === "First owner addition").map(value => value.itemId);
    expect(firstIds).toHaveLength(2);
    expect(new Set(firstIds).size).toBe(1);
    expect(result.items.filter(value => value.label === "First owner addition")).toHaveLength(1);
    expect(state.callbackRuns).toBe(3);
  });

  it.each(["edit", "remove", "save"] as const)("%s refuses unavailable storage instead of accepting unsaved input", async operation => {
    fixture.db = null;
    const mutation = operation === "edit" ? upsertItem("request", { label: "Unsaved" }) : operation === "remove"
      ? removeItem("request", "keep") : saveItemInventory({ requestId: "request", items: [], updatedAtIso: "now" });
    await expect(mutation).rejects.toThrow("item_inventory_store_unavailable");
  });
});
