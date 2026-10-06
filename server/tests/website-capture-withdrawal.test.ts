// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore }));
const transport = vi.hoisted(() => ({ result: {} as any, calls: [] as any[] }));
vi.mock("../utils/captureLifecycleForwarding", () => ({ signedCaptureLifecycleRequest: async (value: any) => {
  transport.calls.push(value); return transport.result;
} }));
import { canonicalArtifactDigest as digest } from "../utils/taskCandidateContract";
import { websiteWithdrawalCommand, verifyWebsiteWithdrawalReceipt, forwardWebsiteCaptureWithdrawals } from "../utils/websiteCaptureWithdrawal";

const withdrawal = { requestedAtIso: "2026-10-06T00:00:00Z", requestId: "req1", sceneId: "site-req1",
  captureId: "walkthrough-req1", requestedBy: "private-owner", state: "uploads_stopped_cleanup_pending",
  pipelineAcknowledged: false, deletionConfirmed: false };
function receipt(command: ReturnType<typeof websiteWithdrawalCommand>, local = false) {
  const value = { schema_version: "website_capture_withdrawal_receipt.v1", request_id: command.request_id,
    scene_id: command.scene_id, capture_id: command.capture_id, withdrawal_id: command.withdrawal_id,
    command_digest: digest(command, "digest"), tombstone_digest: `sha256:${"1".repeat(64)}`,
    state: local ? "local_cleanup_verified_external_pending" : "pipeline_acknowledged_cleanup_pending",
    pipeline_acknowledged: true, serve_allowed: false, future_processing_allowed: false, local_cleanup_verified: local,
    local_cleanup_receipt_digest: local ? `sha256:${"2".repeat(64)}` : null, deletion_confirmed: false,
    provider_acknowledgement: "unknown", cloud_storage_cleanup_verified: false, delivered_copy_cleanup_verified: false,
    retained_audit_records: true, legal_hold: false, cleanup_scope: "server_mapped_site_local_files", external_cleanup_required: true };
  return { ...value, digest: digest(value, "digest") };
}
beforeEach(() => { sharedFakeFirestoreState.docs.clear(); transport.calls = []; transport.result = {};
  sharedFakeFirestoreState.docs.set("inboundRequests/req1", { consent_revoked: true, captureWithdrawalPending: true, capture_withdrawal: withdrawal });
});
it("legacy pending receipts create one stable command without owner data or deletion authority", () => {
  const command = websiteWithdrawalCommand("req1", withdrawal);
  expect(websiteWithdrawalCommand("req1", { ...withdrawal, state: "pipeline_acknowledged_cleanup_pending" })).toEqual(command);
  expect(JSON.stringify(command)).not.toContain("private-owner");
  expect(command).not.toHaveProperty("capture_root");
  expect(command).not.toHaveProperty("authorize_local_deletion");
  expect(() => websiteWithdrawalCommand("other", withdrawal)).toThrow();
});
it.each(["ack", "local"])("persists truthful %s proof and remains pending for external cleanup", async phase => {
  const command = websiteWithdrawalCommand("req1", withdrawal);
  const proof = receipt(command, phase === "local");
  transport.result = { status: "forwarded", value: proof };
  await forwardWebsiteCaptureWithdrawals();
  const stored = sharedFakeFirestoreState.docs.get("inboundRequests/req1") as any;
  expect(stored.capture_withdrawal).toMatchObject({ pipelineAcknowledged: true, deletionConfirmed: false,
    localCleanupVerified: phase === "local", providerAcknowledgement: "unknown", pipelineReceiptDigest: proof.digest });
  expect(stored.captureWithdrawalPending).toBe(true);
  expect(transport.calls).toHaveLength(1);
  await forwardWebsiteCaptureWithdrawals();
  expect(transport.calls).toHaveLength(1);
});
it.each(["unknown", "mismatch", "false_deletion", "tampered"])("keeps %s acknowledgement pending without asserting deletion", async fault => {
  const command = websiteWithdrawalCommand("req1", withdrawal), proof = receipt(command);
  if (fault === "mismatch") proof.request_id = "other";
  if (fault === "false_deletion") (proof as any).deletion_confirmed = true;
  if (fault === "tampered") proof.tombstone_digest = `sha256:${"9".repeat(64)}`;
  transport.result = fault === "unknown" ? { status: "failed", blocker: "unknown_ack" } : { status: "forwarded", value: proof };
  await forwardWebsiteCaptureWithdrawals();
  expect((sharedFakeFirestoreState.docs.get("inboundRequests/req1") as any).capture_withdrawal).toMatchObject({ pipelineAcknowledged: false, deletionConfirmed: false });
});
it("rejects internally inconsistent cleanup receipts even when their digest is valid", () => {
  const command = websiteWithdrawalCommand("req1", withdrawal), proof = receipt(command, true);
  proof.local_cleanup_receipt_digest = null;
  proof.digest = digest(proof, "digest");
  expect(() => verifyWebsiteWithdrawalReceipt(command, proof)).toThrow();
});
