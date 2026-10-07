// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { Firestore, FieldValue } from "@google-cloud/firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { FieldValue } = await import("@google-cloud/firestore");
  return { default: { firestore: { FieldValue } }, dbAdmin: null, storageAdmin: null, authAdmin: null };
});
import { createInboundRequestWithReceipt } from "../utils/inboundRequestCommit";

const receipt = { idempotencyKey: "atomic-fixture:task_received", requestId: "atomic-fixture",
  kind: "task_received" as const, to: "fixture@example.test", subject: "Fixture receipt", body: "Private fixture link" };

function sdk() {
  const store = new Firestore({ projectId: "blueprint-offline-fixture", ssl: false });
  // Exercise the installed Firestore SDK's serialization/WriteBatch, replacing
  // only initialization and the final RPC sink. No emulator or credentials.
  vi.spyOn(store as any, "initializeIfNeeded").mockResolvedValue(undefined);
  const commit = vi.spyOn(store as any, "request").mockResolvedValue({
    writeResults: [{ updateTime: { seconds: "1", nanos: 0 } }, { updateTime: { seconds: "1", nanos: 0 } }],
  });
  return { store, commit };
}

describe("atomic intake and private receipt commit", () => {
  it("sends both create preconditions through exactly one real SDK commit", async () => {
    const { store, commit } = sdk();
    await createInboundRequestWithReceipt(store, store.doc("inboundRequests/atomic-fixture"),
      { requestId: "atomic-fixture", createdAt: FieldValue.serverTimestamp() }, receipt);
    expect(commit).toHaveBeenCalledTimes(1);
    const [method, request] = commit.mock.calls[0] as [string, any];
    expect(method).toBe("commit");
    expect(request.writes).toHaveLength(2);
    expect(request.writes.map((write: any) => write.currentDocument)).toEqual([{ exists: false }, { exists: false }]);
    expect(request.writes.map((write: any) => write.update.name)).toEqual([
      "projects/blueprint-offline-fixture/databases/(default)/documents/inboundRequests/atomic-fixture",
      "projects/blueprint-offline-fixture/databases/(default)/documents/captureOutbox/atomic-fixture:task_received",
    ]);
    expect(request.writes[1].update.fields).toMatchObject({ status: { stringValue: "pending" }, attempts: { integerValue: 0 } });
  });

  it("propagates a failed commit without a second independent notification write", async () => {
    const { store, commit } = sdk();
    commit.mockRejectedValueOnce(Object.assign(new Error("commit unavailable"), { code: 14 }));
    await expect(createInboundRequestWithReceipt(store, store.doc("inboundRequests/atomic-fixture"),
      { requestId: "atomic-fixture" }, receipt)).rejects.toThrow("commit unavailable");
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("does not create a receipt when the intake has no permitted return link", async () => {
    const { store, commit } = sdk();
    await createInboundRequestWithReceipt(store, store.doc("inboundRequests/atomic-fixture"), { requestId: "atomic-fixture" }, null);
    expect((commit.mock.calls[0][1] as any).writes).toHaveLength(1);
  });
});
