// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildBrowserDelivery } from "../utils/websiteCaptureDelivery";
import { observeWebsiteCaptureOwner } from "../utils/websiteCaptureOwnerObservation";
import { bundleDigest, planDigestOf } from "../utils/siteCaptureBundle";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";

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
        [...objects.values()].reverse().find((item) => item.metadata.name === name);
      if (!value) throw new Error("missing_object");
      return value.metadata;
    },
  };
  return { deps, objects, changeRevision: () => { revision++; } };
}

describe("authoritative original website capture owner read", () => {
  it("verifies historical reordered receipt maps and retains the actual pinned bytes and digest", async () => {
    const { deps, objects } = fixture();
    const reordered = { ...delivery.record,
      raw_video: Object.fromEntries(Object.entries(delivery.record.raw_video).reverse()),
      manifest: Object.fromEntries(Object.entries(delivery.record.manifest).reverse()) };
    const bytes = Buffer.from(JSON.stringify(reordered, null, 2));
    objects.set(`${delivery.objectName}@101`, object(delivery.objectName, "101", bytes));
    const observed = await observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, deps);
    expect(observed.producer_delivery.server_record).toEqual({ object_name: delivery.objectName,
      generation: "101", size_bytes: bytes.length, sha256: sha(bytes) });
    expect(observed.producer_delivery.raw_video.generation).toBe(video.generation);
    expect(objects.get(`${delivery.objectName}@101`)!.bytes).toEqual(bytes);
  });

  it("binds original marker and producer identities in the existing Pipeline source digest", async () => {
    const { deps } = fixture();
    const observed = await observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, deps);
    const source = Object.fromEntries([
      "request_id", "scene_id", "capture_id", "bucket", "raw_prefix_uri", "capture_owner",
      "ownership_record", "consent_attestation", "capture_rights", "completion_marker", "producer_delivery",
    ].map((key) => [key, observed[key]]));
    expect(observed.source_projection_digest).toBe(crossRuntimeDigest(source));
    expect(crossRuntimeDigest({ ...source, completion_marker: {
      ...observed.completion_marker, generation: "200",
    } })).not.toBe(observed.source_projection_digest);
    expect(crossRuntimeDigest({ ...source, producer_delivery: {
      ...observed.producer_delivery, raw_video: { ...observed.producer_delivery.raw_video, generation: "200" },
    } })).not.toBe(observed.source_projection_digest);
  });
  it("an intact historical browser receipt does not override current withdrawal", async () => {
    const { deps } = fixture();
    const originalRead = deps.readRequest;
    deps.readRequest = async () => {
      const current = await originalRead();
      return { ...current, data: { ...current.data, consent_revoked: true } };
    };
    const observed = await observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, deps);
    expect(observed.capture_rights.derived_scene_generation_allowed).toBe(false);
    expect(observed.capture_rights.data_licensing_allowed).toBe(false);
    expect(observed.producer_delivery.raw_video.generation).toBe(video.generation);
  });
  it("selects M1 and V1 even after a later canonical marker/video generation exists", async () => {
    const { deps, objects } = fixture();
    objects.set(`${markerName}@200`, object(markerName, "200", Buffer.from("later marker")));
    objects.set(`${video.object_name}@90071992547409939`, object(video.object_name,
      "90071992547409939", Buffer.from("V2-video")));
    const observed = await observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, deps);
    expect(observed.capture_owner).toEqual({ user_id: "uid-owner", basis: "inboundRequests.account_owner_uid" });
    expect(observed.completion_marker.generation).toBe("100");
    expect(observed.producer_delivery.raw_video.generation).toBe(video.generation);
    expect(JSON.stringify(observed)).not.toMatch(/email|token|contact/);
    const originalRead = deps.readMetadata;
    deps.readMetadata = async (name, generation) => {
      if (name === video.object_name && generation === video.generation)
        return { name, generation, size: "8", crc32c: video.crc32c };
      return originalRead(name, generation);
    };
    await expect(observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, deps)).rejects.toThrow();
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
  it("refuses duplicate keys in a pinned marker before using a later alias", async () => {
    const { deps, objects } = fixture();
    const duplicate = Buffer.from(delivery.markerBytes.toString("utf8").replace(
      '"scene_id": "site-r1",', '"scene_id": "site-r1", "scene\\u005fid": "site-r1",'));
    objects.set(`${markerName}@100`, object(markerName, "100", duplicate));
    await expect(observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, deps)).rejects.toThrow();
  });

  it("verifies the existing server-owned app completion, plan, hashes and selected video", async () => {
    const { deps, objects } = fixture();
    const prefix = "scenes/site-r1/captures/walkthrough-r1/raw";
    const marker = Buffer.from(JSON.stringify({ schema_version: "v1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", raw_prefix: prefix, capture_source: "iphone",
      upload_channel: "website_capture_link_bundle", video_uri: "walkthrough.mov" }));
    objects.set(`${markerName}@100`, object(markerName, "100", marker));
    const manifest = Buffer.from('{"source":"app"}');
    const artifacts = { "walkthrough.mov": "a".repeat(64), "manifest.json": sha(manifest).slice(7),
      "capture_upload_complete.json": sha(marker).slice(7) };
    const digest = bundleDigest(artifacts);
    const planBase = { schema_version: "site_capture_bundle_plan.v1", request_id: "r1",
      scene_id: "site-r1", capture_id: "walkthrough-r1", raw_prefix: prefix,
      files: [{ path: "walkthrough.mov", bytes: 7, sha256: artifacts["walkthrough.mov"], md5: "test-md5" }],
      client: {}, device_manifest: {}, binding: {}, binding_digest: "sha256:" + "b".repeat(64),
      link_scope: "film", authority_snapshot: {}, created_at_iso: "2026-09-29T00:00:00.000Z" };
    const plan = { ...planBase, plan_digest: "" };
    plan.plan_digest = planDigestOf(plan as never);
    const upload = "scenes/site-r1/captures/walkthrough-r1/upload";
    const completion = { schema_version: "site_capture_bundle_completion.v1",
      request_id: "r1", scene_id: "site-r1", capture_id: "walkthrough-r1", raw_prefix: prefix,
      plan_digest: plan.plan_digest, completion_marker_json: marker.toString("utf8"),
      bundle_sha256: digest, hashes_json: JSON.stringify({ schema_version: "v1", bundle_sha256: digest, artifacts }),
      server_file_sha256: { "manifest.json": sha(manifest).slice(7) },
      server_files: { "manifest.json": manifest.toString("utf8") },
      device_objects: { "walkthrough.mov": { generation: "104", size_bytes: 7,
        crc32c: "AAAAAA==", md5: "test-md5" } },
      identity: { raw_bundle_digest: `sha256:${digest}`,
        raw_manifest_uri: `gs://test-bucket/${prefix}/manifest.json`, upload_completion_digest: sha(marker) } };
    objects.set(`${upload}/bundle_plan.json@102`, object(`${upload}/bundle_plan.json`, "102", Buffer.from(JSON.stringify(plan))));
    objects.set(`${upload}/bundle_completion.json@101`, object(`${upload}/bundle_completion.json`, "101", Buffer.from(JSON.stringify(completion))));
    objects.set(`${prefix}/manifest.json@103`, object(`${prefix}/manifest.json`, "103", manifest));
    const prior = deps.readMetadata;
    deps.readMetadata = async (name, generation) => name === `${prefix}/walkthrough.mov`
      ? { name, generation: generation ?? "999", size: "7", crc32c: "AAAAAA==", md5Hash: "test-md5" }
      : prior(name, generation);
    const observed = await observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, deps);
    expect(observed.producer_delivery).toMatchObject({ kind: "website_capture_link_bundle",
      raw_video: { object_name: `${prefix}/walkthrough.mov`, generation: "104" } });
    const sameNameV2 = deps.readMetadata;
    deps.readMetadata = async (name, generation) => name === `${prefix}/walkthrough.mov` && generation === null
      ? { name, generation: "999", size: "7", crc32c: "AAAAAA==", md5Hash: "test-md5" }
      : sameNameV2(name, generation);
    expect((await observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, deps))
      .producer_delivery.raw_video.generation).toBe("104");
    deps.readMetadata = sameNameV2;
    const pinnedRead = deps.readMetadata;
    deps.readMetadata = async (name, generation) => {
      if (name === `${prefix}/walkthrough.mov` && generation === "104") throw new Error("old_generation_missing");
      return pinnedRead(name, generation);
    };
    await expect(observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, deps)).rejects.toThrow();
    deps.readMetadata = pinnedRead;
    const duplicated = JSON.stringify(completion).replace('"request_id":"r1",',
      '"request_id":"r1","request\\u005fid":"r1",');
    objects.set(`${upload}/bundle_completion.json@101`, object(`${upload}/bundle_completion.json`, "101", Buffer.from(duplicated)));
    await expect(observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, deps)).rejects.toThrow();
    completion.server_file_sha256["manifest.json"] = "0".repeat(64);
    objects.set(`${upload}/bundle_completion.json@101`, object(`${upload}/bundle_completion.json`, "101", Buffer.from(JSON.stringify(completion))));
    await expect(observeWebsiteCaptureOwner({ request_id: "r1", scene_id: "site-r1",
      capture_id: "walkthrough-r1", completion_marker_generation: "100" }, deps)).rejects.toThrow();
  });
});

it("v2 DATA-only unclaimed observer requires explicit purpose and digests null ownership without a sponsor substitute",async()=>{
  const baseline=fixture();const input={request_id:"r1",scene_id:"site-r1",capture_id:"walkthrough-r1",completion_marker_generation:"100"};
  const before=await observeWebsiteCaptureOwner(input,baseline.deps);
  expect(before.observation_digest).toBe("sha256:95eee2973c38d4e7a26e5b368099029dfb42290023987222f3c391e0bbacd78b");
  expect(before).not.toHaveProperty("purpose");
  const f=fixture();const original=f.deps.readRequest;
  f.deps.readRequest=async()=>{const value=await original();const data={...value.data} as any;delete data.account_owner_uid;return {...value,data};};
  await expect(observeWebsiteCaptureOwner(input,f.deps)).rejects.toThrow("owner_identity_invalid");
  const observed=await observeWebsiteCaptureOwner({...input,purpose:"scene_preparation"} as any,f.deps);
  expect(observed.capture_owner).toBeNull();expect(observed.purpose).toBe("scene_preparation");
  const source=Object.fromEntries(["purpose","request_id","scene_id","capture_id","bucket","raw_prefix_uri","capture_owner",
    "ownership_record","consent_attestation","capture_rights","completion_marker","producer_delivery"].map(key=>[key,observed[key]]));
  expect(observed.source_projection_digest).toBe(crossRuntimeDigest(source));
  const {observation_digest,...response}=observed;expect(observation_digest).toBe(crossRuntimeDigest(response));
  const {purpose,...withoutPurpose}=source;expect(crossRuntimeDigest(withoutPurpose)).not.toBe(observed.source_projection_digest);
  expect(JSON.stringify(observed)).not.toContain("blueprint-preparation");
});
it.each([null,"evaluation","",true])("v2 observer refuses unsupported purpose %s",async(purpose)=>{
  const f=fixture();await expect(observeWebsiteCaptureOwner({request_id:"r1",scene_id:"site-r1",capture_id:"walkthrough-r1",
    completion_marker_generation:"100",purpose} as any,f.deps)).rejects.toThrow("owner_request_invalid");
});
it("v2 DATA-only preserves a real claimed owner and refuses malformed identities",async()=>{
  const input={request_id:"r1",scene_id:"site-r1",capture_id:"walkthrough-r1",completion_marker_generation:"100",purpose:"scene_preparation"} as any;
  expect((await observeWebsiteCaptureOwner(input,fixture().deps)).capture_owner).toEqual({user_id:"uid-owner",basis:"inboundRequests.account_owner_uid"});
  for(const value of ["",123,false]) {const f=fixture();const read=f.deps.readRequest;
    f.deps.readRequest=async()=>{const row=await read();return {...row,data:{...row.data,account_owner_uid:value} as any};};
    await expect(observeWebsiteCaptureOwner(input,f.deps)).rejects.toThrow("owner_identity_invalid");
  }
});
