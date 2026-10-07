// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Firestore } from "@google-cloud/firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { Firestore, FieldValue } = await import("@google-cloud/firestore");
  return { default: { firestore: { FieldValue } },
    dbAdmin: new Firestore({ projectId: "blueprint-offline-fixture", ssl: false }) };
});
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { deriveItemInventory, initializeItemInventory } from "../utils/taskItemInventory";

afterEach(() => vi.restoreAllMocks());

function sdk() {
  const store = dbAdmin as unknown as Firestore;
  vi.spyOn(store as any, "initializeIfNeeded").mockResolvedValue(undefined);
  const commit = vi.spyOn(store as any, "request").mockResolvedValue({
    writeResults: [{ updateTime: { seconds: "1", nanos: 0 } }],
  });
  return { store, commit };
}
const candidate = () => deriveItemInventory({ requestId: "item-init-fixture", taskSummary: "Move cartons" });

describe("item initialization uses the installed SDK absence precondition", () => {
  it("creates one inventory only if absent, with no replacing write", async () => {
    const { commit } = sdk(), proposed = candidate();
    expect(await initializeItemInventory(proposed)).toEqual(proposed);
    expect(commit).toHaveBeenCalledTimes(1);
    const [method, request] = commit.mock.calls[0] as [string, any];
    expect(method).toBe("commit");
    expect(request.writes).toHaveLength(1);
    expect(request.writes[0].currentDocument).toEqual({ exists: false });
    expect(request.writes[0].update.name).toBe(
      "projects/blueprint-offline-fixture/databases/(default)/documents/siteTaskItemInventories/item-init-fixture");
  });

  it.each([6, "already-exists"])("reads the winning inventory after conflict %s without another write", async code => {
    const { store, commit } = sdk();
    commit.mockRejectedValueOnce(Object.assign(new Error("already exists"), { code }));
    const accepted = { ...candidate(), items: [{ itemId: "owner-bin", label: "Owner bin", basis: "operator_added",
      images: [{ imageId: "accepted-photo", storagePath: "scenes/fixture/photo.jpg" }], assetStatus: "sim_ready" }] };
    const read = vi.spyOn(Object.getPrototypeOf(store.doc("siteTaskItemInventories/item-init-fixture")), "get")
      .mockResolvedValue({ exists: true, data: () => accepted });
    expect(await initializeItemInventory(candidate())).toMatchObject(accepted);
    expect(read).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("propagates unknown write outcomes rather than returning an unretained suggestion", async () => {
    const { commit } = sdk();
    commit.mockRejectedValueOnce(Object.assign(new Error("response lost"), { code: 2 }));
    await expect(initializeItemInventory(candidate())).rejects.toThrow("response lost");
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("refuses an absent readback after a create collision", async () => {
    const { store, commit } = sdk();
    commit.mockRejectedValueOnce(Object.assign(new Error("already exists"), { code: 6 }));
    vi.spyOn(Object.getPrototypeOf(store.doc("siteTaskItemInventories/item-init-fixture")), "get")
      .mockResolvedValue({ exists: false, data: () => undefined });
    await expect(initializeItemInventory(candidate())).rejects.toThrow("item_inventory_changed_during_initialization");
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
