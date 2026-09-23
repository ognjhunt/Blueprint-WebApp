// @vitest-environment node
/**
 * The Blueprint app / App Clip uploading a Raw V3.2 bundle through a capture
 * link, end to end at the route, against a fake bucket that enforces what real
 * storage enforces: create-only writes, MD5-bound signed PUTs, 412 on overwrite.
 *
 * What these pin, in the order the brief states them: the path allow-list and
 * create-only writes; missing and extra objects and MD5 mismatches; permission
 * withdrawn mid-upload (409); a held privacy screen writes no marker; the marker
 * is written last and `hashes.json` covers it; completion is idempotent; and a
 * realistic bundle stays far under the API rate limit.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { FakeGcsBucket } from "./helpers/fake-gcs-bucket";
import { syntheticDeviceBundle, type DeviceBundle } from "./helpers/site-capture-bundle-fixture";

const state = vi.hoisted(() => ({
  bucket: null as unknown as import("./helpers/fake-gcs-bucket").FakeGcsBucket,
  authorization: { allowed: true, holdReason: null, detail: null, blockers: [], openQuestions: [] } as Record<string, unknown>,
  privacy: [] as Record<string, unknown>[],
  brief: null as null | { summary: string; confirmedAtIso: string | null },
  notices: [] as string[],
  coverage: [] as string[],
}));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: {
      firestore: {
        FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE },
      },
    },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: { bucket: () => state.bucket },
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../utils/captureUploadAuthorization", () => ({
  authorizeCaptureUpload: vi.fn(async () => state.authorization),
}));

vi.mock("../utils/taskLifecycleNotifications", () => ({
  enqueueTaskLifecycleNotification: vi.fn(async (input: { requestId: string; milestone: string }) => {
    state.notices.push(`${input.requestId}:${input.milestone}`);
  }),
}));

vi.mock("../utils/capturePrivacyScreen", () => ({
  screenCaptureForPrivacy: vi.fn(async () => {
    const next = state.privacy.shift();
    if (!next) throw new Error("test did not script a privacy result");
    return next;
  }),
}));

vi.mock("../utils/captureCoverageReview", () => ({
  reviewCaptureCoverage: vi.fn(async (input: { captureId: string }) => {
    state.coverage.push(input.captureId);
  }),
}));

vi.mock("../utils/slack", () => ({
  notifySlackCapturePrivacyEscalation: vi.fn(async () => undefined),
}));

vi.mock("../utils/siteTaskBriefReading", () => ({
  mergeFootageIntoBrief: vi.fn(async () => undefined),
}));

vi.mock("../utils/siteTaskBrief", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/siteTaskBrief")>()),
  getBrief: vi.fn(async () => (state.brief ? { requestId: "req-1", ...state.brief } : null)),
}));

const uploadsRouter = (await import("../routes/self-capture-uploads")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { bundleDigest } = await import("../utils/siteCaptureBundle");

const REQUEST_ID = "req-1";
const SCENE_ID = `site-${REQUEST_ID}`;
const CAPTURE_ID = `walkthrough-${REQUEST_ID}`;
const RAW = `scenes/${SCENE_ID}/captures/${CAPTURE_ID}/raw`;
const APPROVED = { proceed: true, eligibility: "approved", outcome: "cleared", detail: null, evidence: null };
const PENDING = {
  proceed: false,
  eligibility: "pending",
  outcome: "review_unavailable",
  retryable: true,
  detail: "The review did not come back in time.",
  evidence: null,
};

let server: Server;
let baseUrl = "";
let apiRequests = 0;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  app.use((req, _res, next) => {
    apiRequests += 1;
    next();
  });
  app.use("/api/self-capture/uploads", uploadsRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  state.bucket = new FakeGcsBucket("blueprint-8c1ca.appspot.com");
  state.authorization = { allowed: true, holdReason: null, detail: null, blockers: [], openQuestions: [] };
  state.privacy = [];
  state.brief = { summary: "Move totes from the conveyor to the rack", confirmedAtIso: "2026-09-20T10:00:00.000Z" };
  state.notices = [];
  state.coverage = [];
  apiRequests = 0;
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set(`inboundRequests/${REQUEST_ID}`, {
    requestId: REQUEST_ID,
    request: {
      consent_attestation: { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-09-19T12:00:00.000Z" },
    },
  });
});

function token(scope: "owner" | "film" = "owner") {
  return createCaptureUploadToken({ requestId: REQUEST_ID, sceneId: SCENE_ID, captureId: CAPTURE_ID, scope });
}

async function api(method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}/api/self-capture/uploads/${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function linkCheck(linkToken = token()) {
  return api("GET", linkToken);
}

async function bundleFor(options: Parameters<typeof syntheticDeviceBundle>[0] extends infer T
  ? Partial<Omit<T & object, "sceneId" | "captureId" | "binding">>
  : never = {}) {
  const link = await linkCheck();
  expect(link.status).toBe(200);
  const device = syntheticDeviceBundle({
    sceneId: SCENE_ID,
    captureId: CAPTURE_ID,
    binding: link.body.bundle.binding,
    ...options,
  });
  return { link, device, bindingDigest: link.body.bundle.binding_digest as string };
}

function planBody(device: DeviceBundle, bindingDigest: string, client = "ios_app_clip") {
  return { client, device_manifest: device.deviceManifest, files: device.plan, binding_digest: bindingDigest };
}

/** The phone: upload every target it was handed, straight to the bucket. */
function uploadTargets(device: DeviceBundle, targets: Record<string, any>[]) {
  for (const target of targets) {
    const data = device.files.get(target.path)!;
    const status = target.kind === "resumable"
      ? state.bucket.uploadResumable(target.session_uri, data)
      : state.bucket.putSigned(target.url, data, target.headers);
    expect(status).toBe(200);
  }
}

async function uploadEverything(device: DeviceBundle, bindingDigest: string) {
  const plan = await api("POST", `${token()}/bundle`, planBody(device, bindingDigest));
  expect(plan.status).toBe(200);
  uploadTargets(device, plan.body.targets);
  let more = plan.body.more_targets as boolean;
  const presentPaths = new Set<string>(plan.body.present_paths);
  const uploaded = new Set<string>(plan.body.targets.map((t: { path: string }) => t.path));
  while (more) {
    const next = device.plan.filter((file) => !presentPaths.has(file.path) && !uploaded.has(file.path)).slice(0, 250);
    const minted = await api("POST", `${token()}/bundle/targets`, { plan_digest: plan.body.plan_digest, paths: next.map((file) => file.path) });
    expect(minted.status).toBe(200);
    uploadTargets(device, minted.body.targets);
    for (const target of minted.body.targets) uploaded.add(target.path);
    more = uploaded.size + presentPaths.size < device.plan.length;
  }
  return plan.body.plan_digest as string;
}

describe("the link check tells the app what to record", () => {
  it("returns server-issued ids, the rights binding and the device contract", async () => {
    const link = await linkCheck();
    expect(link.status).toBe(200);
    const bundle = link.body.bundle;
    expect(bundle.scene_id).toBe(SCENE_ID);
    expect(bundle.capture_id).toBe(CAPTURE_ID);
    expect(bundle.raw_prefix).toBe(RAW);
    expect(bundle.state).toBe("open");
    expect(bundle.contract).toMatchObject({ schema_version: "v3", capture_schema_version: "3.2.0", capture_source: "iphone", video_uri: "walkthrough.mov" });
    expect(bundle.binding.capture_rights).toEqual({ derived_scene_generation_allowed: true, data_licensing_allowed: false, redaction_required: true });
    expect(bundle.binding_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(bundle.server_owned_paths).toEqual(expect.arrayContaining(["manifest.json", "hashes.json", "capture_upload_complete.json"]));
    expect(bundle.device_manifest_keys).not.toContain("site_self_capture");
    expect(bundle.device_manifest_keys).not.toContain("capture_rights");
    // The browser page's existing fields are unchanged.
    expect(link.body.accepts).toEqual(["mov", "mp4"]);
    expect(link.body.state).toBe("ready");
  });

  it("still answers 404 for a bad link", async () => {
    const response = await api("GET", "not-a-token");
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("This upload link is not valid or has expired.");
  });
});

describe("the plan is checked against the Raw V3.2 layout before any bytes move", () => {
  it.each([
    ["../escape.json", "path_traversal"],
    ["arkit/../manifest.json", "path_traversal"],
    [".hidden", "path_hidden"],
    ["arkit/.DS_Store", "path_hidden"],
    ["/abs.json", "path_not_relative"],
    ["manifest.json", "path_server_owned"],
    ["hashes.json", "path_server_owned"],
    ["capture_upload_complete.json", "path_server_owned"],
    ["rights_consent.json", "path_server_owned"],
    ["arkit/depth/1.png", "path_not_in_raw_v32_layout"],
    ["notes.txt", "path_not_in_raw_v32_layout"],
  ])("refuses %s", async (path, reason) => {
    const { device, bindingDigest } = await bundleFor();
    const body = planBody(device, bindingDigest);
    body.files = [...device.plan, { path, bytes: 1, sha256: "a".repeat(64), md5: "1B2M2Y8AsgTpgAmY7PhCfg==" }];
    const response = await api("POST", `${token()}/bundle`, body);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("bundle_plan_invalid");
    expect(response.body.errors).toContain(`${reason}:${path}`);
    expect(state.bucket.names()).toEqual([]);
  });

  it("refuses a device manifest that carries server-owned fields", async () => {
    const { device, bindingDigest } = await bundleFor();
    for (const key of ["site_self_capture", "capture_rights", "requested_outputs", "site_submission_id", "rights_profile"]) {
      const body = planBody(device, bindingDigest);
      body.device_manifest = { ...device.deviceManifest, [key]: "forged" };
      const response = await api("POST", `${token()}/bundle`, body);
      expect(response.status).toBe(400);
      expect(response.body.errors).toContain(`device_manifest_key_not_allowed:${key}`);
    }
  });

  it("refuses ids the server did not issue and a non-V3.2 bundle", async () => {
    const { device, bindingDigest } = await bundleFor();
    const body = planBody(device, bindingDigest);
    body.device_manifest = { ...device.deviceManifest, capture_id: "someone-else", capture_schema_version: "3.1.0", video_uri: "raw/walkthrough.mov" };
    const response = await api("POST", `${token()}/bundle`, body);
    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(expect.arrayContaining([
      "device_manifest_capture_id_mismatch",
      "device_manifest_capture_schema_not_3_2_0",
      "device_manifest_video_uri_invalid",
    ]));
  });

  it("holds the declared IMU absence to the contract", async () => {
    const clip = await bundleFor({ imu: "app_clip" });
    const accepted = await api("POST", `${token()}/bundle`, planBody(clip.device, clip.bindingDigest));
    expect(accepted.status).toBe(200);

    state.bucket = new FakeGcsBucket("blueprint-8c1ca.appspot.com");
    const { device, bindingDigest } = await bundleFor({ imu: "app_clip" });
    const withMotion = planBody(device, bindingDigest);
    withMotion.files = [...device.plan, { path: "motion.jsonl", bytes: 0, sha256: "e".repeat(64), md5: "1B2M2Y8AsgTpgAmY7PhCfg==" }];
    const refused = await api("POST", `${token()}/bundle`, withMotion);
    expect(refused.status).toBe(400);
    expect(refused.body.errors).toContain("device_imu_declared_unavailable_but_motion_present");

    const app = await bundleFor({ imu: "record" });
    const withoutMotion = planBody(app.device, app.bindingDigest, "ios_app");
    withoutMotion.files = app.device.plan.filter((file) => file.path !== "motion.jsonl");
    const missing = await api("POST", `${token()}/bundle`, withoutMotion);
    expect(missing.status).toBe(400);
    expect(missing.body.errors).toContain("required_file_missing:motion.jsonl");
  });

  it("asks the phone to re-bind when the rights changed before anything was stored", async () => {
    const { device, bindingDigest } = await bundleFor();
    sharedFakeFirestoreState.docs.set(`inboundRequests/${REQUEST_ID}`, { requestId: REQUEST_ID, request: {} });
    const response = await api("POST", `${token()}/bundle`, planBody(device, bindingDigest));
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("capture_binding_changed");
    expect(response.body.binding.capture_rights.derived_scene_generation_allowed).toBe(false);
    expect(state.bucket.names()).toEqual([]);
  });
});

describe("uploads are create-only and verified before completion", () => {
  it("hands out create-only, MD5-bound targets and a resumable session for the video", async () => {
    const { device, bindingDigest } = await bundleFor();
    const plan = await api("POST", `${token()}/bundle`, planBody(device, bindingDigest));
    expect(plan.status).toBe(200);
    const video = plan.body.targets.find((t: { path: string }) => t.path === "walkthrough.mov");
    expect(video.kind).toBe("resumable");
    const put = plan.body.targets.find((t: { path: string }) => t.path === "sync_map.jsonl");
    expect(put.headers).toMatchObject({ "x-goog-if-generation-match": "0", "Content-MD5": expect.any(String) });
    // The plan record lives beside raw/, never in it.
    expect(state.bucket.names(`${RAW}/`)).toEqual([]);
    expect(state.bucket.names(`scenes/${SCENE_ID}/captures/${CAPTURE_ID}/upload/`)).toEqual([
      `scenes/${SCENE_ID}/captures/${CAPTURE_ID}/upload/bundle_plan.json`,
    ]);

    uploadTargets(device, plan.body.targets);
    // Storage refuses a second write to the same object and a body that does
    // not match the signed MD5.
    expect(state.bucket.putSigned(put.url, device.files.get("sync_map.jsonl")!, put.headers)).toBe(412);
    const other = plan.body.targets.find((t: { path: string }) => t.path === "arkit/poses.jsonl");
    expect(state.bucket.putSigned(other.url, Buffer.from("tampered"), other.headers)).toBe(400);
  });

  it("reports missing objects, then completes once they land", async () => {
    const { device, bindingDigest } = await bundleFor();
    const plan = await api("POST", `${token()}/bundle`, planBody(device, bindingDigest));
    const [held, ...rest] = plan.body.targets;
    uploadTargets(device, rest);
    const early = await api("POST", `${token()}/bundle/complete`, { plan_digest: plan.body.plan_digest });
    expect(early.status).toBe(409);
    expect(early.body.code).toBe("bundle_incomplete");
    expect(early.body.missing).toEqual([held.path]);
    expect(state.bucket.objects.has(`${RAW}/manifest.json`)).toBe(false);

    // Re-declaring the same plan is a replay that lists what is stored.
    const replay = await api("POST", `${token()}/bundle`, planBody(device, bindingDigest));
    expect(replay.status).toBe(200);
    expect(replay.body.present_paths).toHaveLength(device.plan.length - 1);
    uploadTargets(device, replay.body.targets);

    state.privacy.push(APPROVED);
    const complete = await api("POST", `${token()}/bundle/complete`, { plan_digest: plan.body.plan_digest });
    expect(complete.status).toBe(201);
  });

  it("refuses an undeclared object under the raw prefix", async () => {
    const { device, bindingDigest } = await bundleFor();
    const planDigest = await uploadEverything(device, bindingDigest);
    state.bucket.seed(`${RAW}/stray.bin`, "not planned");
    const complete = await api("POST", `${token()}/bundle/complete`, { plan_digest: planDigest });
    expect(complete.status).toBe(409);
    expect(complete.body.code).toBe("bundle_prefix_has_undeclared_objects");
    expect(complete.body.paths).toEqual(["stray.bin"]);
  });

  it("refuses a stored object whose MD5 or size does not match the plan", async () => {
    const { device, bindingDigest } = await bundleFor();
    const plan = await api("POST", `${token()}/bundle`, planBody(device, bindingDigest));
    const [first, ...rest] = plan.body.targets;
    uploadTargets(device, rest);
    state.bucket.seed(`${RAW}/${first.path}`, "different bytes");
    const complete = await api("POST", `${token()}/bundle/complete`, { plan_digest: plan.body.plan_digest });
    expect(complete.status).toBe(409);
    expect(complete.body.code).toBe("bundle_object_mismatch");
    expect(complete.body.paths).toEqual([first.path]);
  });

  it("refuses a different plan for the same capture", async () => {
    const { device, bindingDigest } = await bundleFor();
    await api("POST", `${token()}/bundle`, planBody(device, bindingDigest));
    const other = syntheticDeviceBundle({ sceneId: SCENE_ID, captureId: CAPTURE_ID, binding: (await linkCheck()).body.bundle.binding, videoBytes: 999 });
    const response = await api("POST", `${token()}/bundle`, planBody(other, bindingDigest));
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("bundle_plan_conflict");
  });

  it("refuses a downstream candidate manifest bound to other rights", async () => {
    const { link, device, bindingDigest } = await bundleFor();
    const forged = syntheticDeviceBundle({
      sceneId: SCENE_ID,
      captureId: CAPTURE_ID,
      binding: { ...link.body.bundle.binding, capture_rights: { derived_scene_generation_allowed: true, data_licensing_allowed: true } },
    });
    const planDigest = await uploadEverything(forged, bindingDigest);
    state.privacy.push(APPROVED);
    const complete = await api("POST", `${token()}/bundle/complete`, { plan_digest: planDigest });
    expect(complete.status).toBe(422);
    expect(complete.body.errors).toContain("downstream_candidate_data_licensing_binding_mismatch");
    expect(state.bucket.objects.has(`${RAW}/manifest.json`)).toBe(false);
    expect(device).toBeDefined();
  });
});

describe("completion keeps the web path's order and authority", () => {
  it("writes server files, notifies, screens, then hashes.json and the marker last", async () => {
    const { device, bindingDigest } = await bundleFor({ lidar: true });
    const planDigest = await uploadEverything(device, bindingDigest);
    state.privacy.push(APPROVED);
    const beforeComplete = state.bucket.writeLog.length;
    const complete = await api("POST", `${token()}/bundle/complete`, { plan_digest: planDigest });
    expect(complete.status).toBe(201);
    expect(complete.body).toMatchObject({ ok: true, state: "complete", eligibility: "approved" });

    const writes = state.bucket.writeLog.slice(beforeComplete).map((name) => name.split("/").slice(-1)[0]);
    expect(writes[0]).toBe("bundle_completion.json");
    expect(writes[1]).toBe("manifest.json");
    expect(writes.slice(-2)).toEqual(["hashes.json", "capture_upload_complete.json"]);
    expect(state.notices).toEqual([`${REQUEST_ID}:video_received`]);
    expect(state.coverage).toEqual([CAPTURE_ID]);

    const manifest = JSON.parse(state.bucket.text(`${RAW}/manifest.json`)!);
    expect(manifest.capture_source).toBe("iphone");
    expect(manifest.capture_profile_id).toBe("iphone_arkit_lidar");
    expect(manifest.site_submission_id).toBe(REQUEST_ID);
    expect(manifest.capture_job_id).toBeNull();
    expect(manifest.site_self_capture).toMatchObject({
      schema_version: "site_self_capture.v1",
      authored_by: "blueprint_webapp",
      site_filmed_itself: true,
      capture_job_exists: false,
      request_id: REQUEST_ID,
      client: "ios_app_clip",
    });
    expect(manifest.capture_rights.derived_scene_generation_allowed).toBe(true);
    expect(manifest.requested_outputs).toEqual(["qualification"]);
    expect(manifest.evidence_tier).toBe("qualified_metric_capture");

    const intake = JSON.parse(state.bucket.text(`${RAW}/intake_packet.json`)!);
    expect(intake).toMatchObject({
      workflow_name: "Move totes from the conveyor to the rack",
      task_steps: ["Move totes from the conveyor to the rack"],
      owner: "site_operator",
    });

    // hashes.json: bare hex, every raw file but itself, marker included.
    const hashes = JSON.parse(state.bucket.text(`${RAW}/hashes.json`)!);
    const rawFiles = state.bucket.names(`${RAW}/`).map((name) => name.slice(RAW.length + 1)).filter((path) => path !== "hashes.json");
    expect(Object.keys(hashes.artifacts).sort()).toEqual(rawFiles);
    for (const [path, digest] of Object.entries(hashes.artifacts)) {
      expect(digest).toMatch(/^[0-9a-f]{64}$/);
      const bytes = state.bucket.objects.get(`${RAW}/${path}`)!.data;
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(digest);
    }
    expect(hashes.bundle_sha256).toBe(bundleDigest(hashes.artifacts));

    const marker = JSON.parse(state.bucket.text(`${RAW}/capture_upload_complete.json`)!);
    expect(marker).toMatchObject({ scene_id: SCENE_ID, capture_id: CAPTURE_ID, raw_prefix: RAW, status: "complete" });

    const session = sharedFakeFirestoreState.docs.get(`captureUploadSessions/${CAPTURE_ID}`) as Record<string, any>;
    expect(session.immutable_upload_identity).toEqual({
      raw_bundle_digest: `sha256:${hashes.bundle_sha256}`,
      raw_manifest_uri: `gs://blueprint-8c1ca.appspot.com/${RAW}/manifest.json`,
      upload_completion_digest: `sha256:${hashes.artifacts["capture_upload_complete.json"]}`,
      verification_status: "pending_pipeline_storage_readback",
    });
    expect(sharedFakeFirestoreState.docs.has(`creatorCaptures/${CAPTURE_ID}`)).toBe(false);

    const status = await linkCheck();
    expect(status.body.bundle.state).toBe("complete");
  });

  it("an unconfirmed brief stays an honestly incomplete intake", async () => {
    state.brief = { summary: "A draft nobody confirmed", confirmedAtIso: null };
    const { device, bindingDigest } = await bundleFor();
    const planDigest = await uploadEverything(device, bindingDigest);
    state.privacy.push(APPROVED);
    expect((await api("POST", `${token()}/bundle/complete`, { plan_digest: planDigest })).status).toBe(201);
    const intake = JSON.parse(state.bucket.text(`${RAW}/intake_packet.json`)!);
    expect(intake).toMatchObject({ workflow_name: null, task_steps: [], owner: null, source: "unconfirmed_site_task_brief" });
    const hypothesis = JSON.parse(state.bucket.text(`${RAW}/task_hypothesis.json`)!);
    expect(hypothesis.status).toBe("needs_confirmation");
    const manifest = JSON.parse(state.bucket.text(`${RAW}/manifest.json`)!);
    expect(manifest.evidence_tier).toBe("pre_screen_video");
  });

  it("a held privacy screen stores the capture but writes no marker, then finishes when it clears", async () => {
    const { device, bindingDigest } = await bundleFor();
    const planDigest = await uploadEverything(device, bindingDigest);
    state.privacy.push(PENDING);
    const held = await api("POST", `${token()}/bundle/complete`, { plan_digest: planDigest });
    expect(held.status).toBe(200);
    expect(held.body).toMatchObject({ ok: true, state: "held", code: "capture_review_unavailable" });
    expect(state.bucket.objects.has(`${RAW}/manifest.json`)).toBe(true);
    expect(state.bucket.objects.has(`${RAW}/hashes.json`)).toBe(false);
    expect(state.bucket.objects.has(`${RAW}/capture_upload_complete.json`)).toBe(false);
    expect(state.coverage).toEqual([]);

    // Completing again while held asks nobody again and still writes nothing.
    const again = await api("POST", `${token()}/bundle/complete`, { plan_digest: planDigest });
    expect(again.body.state).toBe("held");
    expect(state.bucket.objects.has(`${RAW}/capture_upload_complete.json`)).toBe(false);
    expect((await linkCheck()).body.bundle.state).toBe("held");

    // The status poll retries the screen; when it clears, the marker lands.
    state.privacy.push(APPROVED);
    const polled = await linkCheck();
    expect(polled.body.bundle.state).toBe("complete");
    const completion = JSON.parse(state.bucket.text(`scenes/${SCENE_ID}/captures/${CAPTURE_ID}/upload/bundle_completion.json`)!);
    expect(state.bucket.text(`${RAW}/hashes.json`)).toBe(completion.hashes_json);
    expect(state.bucket.text(`${RAW}/capture_upload_complete.json`)).toBe(completion.completion_marker_json);
    expect(state.bucket.writeLog.slice(-1)[0]).toBe(`${RAW}/capture_upload_complete.json`);
  });

  it("is idempotent: repeating complete changes nothing and notifies once", async () => {
    const { device, bindingDigest } = await bundleFor();
    const planDigest = await uploadEverything(device, bindingDigest);
    state.privacy.push(APPROVED);
    expect((await api("POST", `${token()}/bundle/complete`, { plan_digest: planDigest })).status).toBe(201);
    const snapshot = new Map([...state.bucket.objects].map(([name, object]) => [name, object.generation]));
    const second = await api("POST", `${token()}/bundle/complete`, { plan_digest: planDigest });
    expect(second.status).toBe(201);
    expect(second.body.state).toBe("complete");
    expect(new Map([...state.bucket.objects].map(([name, object]) => [name, object.generation]))).toEqual(snapshot);
    expect(state.notices).toHaveLength(1);
  });

  it("a crash after the completion record finishes with the same bytes on retry", async () => {
    const { device, bindingDigest } = await bundleFor();
    const planDigest = await uploadEverything(device, bindingDigest);
    // First attempt dies in the privacy screen, after the server files exist.
    const crashed = await api("POST", `${token()}/bundle/complete`, { plan_digest: planDigest });
    expect(crashed.status).toBe(503);
    const manifestBefore = state.bucket.text(`${RAW}/manifest.json`);
    expect(manifestBefore).not.toBeNull();
    // The brief changes in between; the recorded composition does not.
    state.brief = { summary: "Something else entirely", confirmedAtIso: "2026-09-21T00:00:00.000Z" };
    state.privacy.push(APPROVED);
    const retried = await api("POST", `${token()}/bundle/complete`, { plan_digest: planDigest });
    expect(retried.status).toBe(201);
    expect(state.bucket.text(`${RAW}/manifest.json`)).toBe(manifestBefore);
  });

  it("stops when permission is withdrawn mid-upload", async () => {
    const { device, bindingDigest } = await bundleFor();
    const plan = await api("POST", `${token()}/bundle`, planBody(device, bindingDigest));
    uploadTargets(device, plan.body.targets.slice(0, 5));
    state.authorization = {
      allowed: false,
      holdReason: "parked_for_review",
      detail: "A person is looking at this submission before any capture.",
      blockers: [],
      openQuestions: [],
    };
    const targets = await api("POST", `${token()}/bundle/targets`, { plan_digest: plan.body.plan_digest, paths: ["walkthrough.mov"] });
    expect(targets.status).toBe(409);
    expect(targets.body.code).toBe("parked_for_review");
    const complete = await api("POST", `${token()}/bundle/complete`, { plan_digest: plan.body.plan_digest });
    expect(complete.status).toBe(409);
    expect(state.bucket.objects.has(`${RAW}/manifest.json`)).toBe(false);
    expect(state.bucket.objects.has(`${RAW}/capture_upload_complete.json`)).toBe(false);
  });
});

describe("the browser recorder never overwrites an app bundle", () => {
  it("refuses browser parts and a browser upload once an app bundle is recorded", async () => {
    const { device, bindingDigest } = await bundleFor();
    await api("POST", `${token()}/bundle`, planBody(device, bindingDigest));
    const part = await fetch(`${baseUrl}/api/self-capture/uploads/${token()}/parts/0?extension=mp4`, {
      method: "PUT",
      body: (() => {
        const form = new FormData();
        form.append("part", new Blob([Buffer.alloc(16, 1)]), "part.bin");
        return form;
      })(),
    });
    expect(part.status).toBe(409);
    expect(((await part.json()) as Record<string, unknown>).code).toBe("capture_recorded_in_app");

    const form = new FormData();
    form.append("metadata", JSON.stringify({ widthPx: 1080, heightPx: 1920, fps: 30, durationSeconds: 10, recordedAtEpochMs: Date.now() }));
    form.append("video", new Blob([Buffer.alloc(32, 2)]), "walkthrough.mp4");
    const upload = await fetch(`${baseUrl}/api/self-capture/uploads/${token()}`, { method: "POST", body: form });
    expect(upload.status).toBe(409);
    expect(state.bucket.names(`${RAW}/`).some((name) => name.endsWith("walkthrough.mp4"))).toBe(false);
  });
});

describe("a realistic bundle stays far under the API rate limit", () => {
  it("uploads a 2,000-file LiDAR bundle in a handful of API requests", async () => {
    const { device, bindingDigest } = await bundleFor({ lidar: true, depthFrames: 990 });
    expect(device.plan.length).toBeGreaterThanOrEqual(2000);
    apiRequests = 0;
    const planDigest = await uploadEverything(device, bindingDigest);
    state.privacy.push(APPROVED);
    expect((await api("POST", `${token()}/bundle/complete`, { plan_digest: planDigest })).status).toBe(201);
    // Link check + plan + target batches + complete. The global /api limiter is
    // 300 requests per 15 minutes per IP.
    expect(apiRequests).toBeLessThanOrEqual(12);
    expect(apiRequests).toBeLessThan(300 / 10);
  });
});
