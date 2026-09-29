// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildBrowserDelivery } from "../utils/websiteCaptureDelivery";
import { observeWebsiteCaptureOwner } from "../utils/websiteCaptureOwnerObservation";

const sha = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const request = { account_owner_uid: "uid-owner", claimed_at_iso: null,
  request: { buyerType: "site_operator", capture_mode: "self_capture", consent_attestation: {
    granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-09-28T00:00:00.000Z",
  } } };
const video = { object_name: "scenes/site-r1/captures/walkthrough-r1/raw/walkthrough.mp4",
  generation: "90071992547409931", size_bytes: 7, crc32c: "AAAAAA==" };
const manifestBytes = Buffer.from('{"video_uri":"x"}');
const manifest = { object_name: "scenes/site-r1/captures/walkthrough-r1/raw/manifest.json",
  generation: "90071992547409932", size_bytes: manifestBytes.length,
  crc32c: "AAAAAA==", sha256: sha(manifestBytes) };
const delivery = buildBrowserDelivery({ requestId: "r1", sceneId: "site-r1",
  captureId: "walkthrough-r1", rawPrefix: "scenes/site-r1/captures/walkthrough-r1/raw",
  video, manifest, completedAtIso: "2026-09-29T00:00:00.000Z" });
const markerName = `${delivery.record.raw_prefix}/capture_upload_complete.json`;
const object = (name: string, generation: string, bytes: Buffer) => ({
  metadata: { name, generation, size: String(bytes.length), crc32c: "AAAAAA==" }, bytes,
});

function fixture() {
  const objects = new Map([
    [`${markerName}@100`, object(markerName, "100", delivery.markerBytes)],
    [`${delivery.objectName}@101`, object(delivery.objectName, "101", delivery.recordBytes)],
    [`${manifest.object_name}@${manifest.generation}`, object(manifest.object_name, manifest.generation, manifestBytes)],
  ]);
  let revision = 5;
  const deps = {
    bucket: "test-bucket", now: () => 1_780_000_000,
    async readRequest() { return { data: request, updateTime: { seconds: revision, nanoseconds: 0 } }; },
    async readPinned(name: string, generation: string, _limit: number) {
      const value = objects.get(`${name}@${generation}`);
      if (!value) throw new Error("missing_pinned_object");
      return value;
    },
    async readMetadata(name: string, generation: string | null) {
      if (name === video.object_name && generation === video.generation)
        return { name, generation, size: "7", crc32c: video.crc32c };
      const value = generation ? objects.get(`${name}@${generation}`) :
        [...objects.values()].find((item) => item.metadata.name === name);
      if (!value) throw new Error("missing_object");
      return value.metadata;
    },
  };
  return { deps, objects, changeRevision: () => { revision++; } };
}

describe("authoritative original website capture owner read", () => {
  it("selects M1 and V1 even after a later canonical marker/video generation exists", async () => {
    const { deps, objects } = fixture();
    objects.set(`${markerName}@200`, object(markerName, "200", Buffer.from("later marker")));
    const observed = await observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, deps);
    expect(observed.capture_owner).toEqual({ user_id: "uid-owner", basis: "inboundRequests.account_owner_uid" });
    expect(observed.completion_marker.generation).toBe("100");
    expect(observed.producer_delivery.raw_video.generation).toBe(video.generation);
    expect(JSON.stringify(observed)).not.toMatch(/email|token|contact/);
  });
  it("refuses tampered receipt bytes and ownership changes during the read", async () => {
    const { deps, objects } = fixture();
    objects.set(`${delivery.objectName}@101`, object(delivery.objectName, "101", Buffer.from("{}")));
    await expect(observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, deps)).rejects.toThrow();
    const intact = fixture();
    const originalRead = intact.deps.readPinned;
    intact.deps.readPinned = async (name, generation, limit) => {
      const value = await originalRead(name, generation, limit);
      intact.changeRevision(); return value;
    };
    await expect(observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, intact.deps)).rejects.toThrow();
  });
});
