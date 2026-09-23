// @vitest-environment node
/**
 * The bundles the iOS recorder actually writes, completed through the capture
 * link against a fake bucket.
 *
 * `fixtures/recorded-app-bundles/{lidar,nonlidar}` were recorded by
 * BlueprintCapture's shared recorder driven by its synthetic camera, the way
 * the App Clip records (no IMU, declared), finalized by the app's Raw V3.2
 * finalizer and planned by the app's planner (`SyntheticCaptureBundleTests`,
 * exported by its CI). Synthetic content only: no real space is measured.
 *
 * Each one is planned exactly as the phone plans it, uploaded to create-only
 * MD5-bound targets, and completed; the server writes its own files, then
 * `hashes.json` and the marker last. With `BLUEPRINT_EXPORT_COMPLETED_BUNDLES`
 * set, the completed raw prefix is written out; that is the fixture the
 * pipeline verifies (`verify_canonical_raw_bundle_path`).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { FakeGcsBucket } from "./helpers/fake-gcs-bucket";

const state = vi.hoisted(() => ({
  bucket: null as unknown as import("./helpers/fake-gcs-bucket").FakeGcsBucket,
  privacy: [] as Record<string, unknown>[],
  notices: [] as string[],
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
  authorizeCaptureUpload: vi.fn(async () => ({ allowed: true, holdReason: null, detail: null, blockers: [], openQuestions: [] })),
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
  reviewCaptureCoverage: vi.fn(async () => undefined),
}));

vi.mock("../utils/slack", () => ({
  notifySlackCapturePrivacyEscalation: vi.fn(async () => undefined),
}));

vi.mock("../utils/siteTaskBriefReading", () => ({
  mergeFootageIntoBrief: vi.fn(async () => undefined),
}));

vi.mock("../utils/siteTaskBrief", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/siteTaskBrief")>()),
  getBrief: vi.fn(async (requestId: string) => ({
    requestId,
    summary: "Pack cartons at station 3.",
    confirmedAtIso: "2026-09-20T10:00:00.000Z",
  })),
}));

const uploadsRouter = (await import("../routes/self-capture-uploads")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "recorded-app-bundles");
const PROFILES = [
  { name: "lidar", profileId: "iphone_arkit_lidar" },
  { name: "nonlidar", profileId: "iphone_arkit_non_lidar" },
] as const;
const APPROVED = { proceed: true, eligibility: "approved", outcome: "cleared", detail: null, evidence: null };

interface PlanFile {
  path: string;
  bytes: number;
  sha256: string;
  md5: string;
}

interface Recorded {
  plan: { client: string; binding_digest: string; device_manifest: Record<string, unknown>; files: PlanFile[] };
  linkInfo: { scene_id: string; capture_id: string; raw_prefix: string; binding: { request_id: string } };
  files: Map<string, Buffer>;
}

function walk(root: string, directory = root): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(root, path) : [relative(root, path).split("\\").join("/")];
  });
}

function loadRecorded(name: string): Recorded {
  const root = join(FIXTURES, name);
  const bundleRoot = join(root, "bundle");
  const files = new Map<string, Buffer>();
  for (const path of walk(bundleRoot)) files.set(path, readFileSync(join(bundleRoot, path)));
  return {
    plan: JSON.parse(readFileSync(join(root, "plan_request.json"), "utf8")),
    linkInfo: JSON.parse(readFileSync(join(root, "link_info.json"), "utf8")),
    files,
  };
}

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "8mb" }));
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
  state.privacy = [];
  state.notices = [];
  sharedFakeFirestoreState.docs.clear();
});

async function api(method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}/api/self-capture/uploads/${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

describe.each(PROFILES)("the recorder's $name bundle completes through the capture link", ({ name, profileId }) => {
  it("plans, uploads create-only, and completes with the server's files and the marker last", async () => {
    const recorded = loadRecorded(name);
    const requestId = recorded.linkInfo.binding.request_id;
    const sceneId = recorded.linkInfo.scene_id;
    const captureId = recorded.linkInfo.capture_id;
    const raw = `scenes/${sceneId}/captures/${captureId}/raw`;
    expect(recorded.linkInfo.raw_prefix).toBe(raw);
    sharedFakeFirestoreState.docs.set(`inboundRequests/${requestId}`, {
      requestId,
      request: {
        consent_attestation: { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-09-19T12:00:00.000Z" },
      },
    });
    const token = createCaptureUploadToken({ requestId, sceneId, captureId, scope: "owner" });

    // The plan names exactly the files on disk that the phone uploads, with
    // their real sizes and digests.
    for (const file of recorded.plan.files) {
      const bytes = recorded.files.get(file.path);
      expect(bytes, file.path).toBeDefined();
      expect(bytes!.length).toBe(file.bytes);
      expect(createHash("sha256").update(bytes!).digest("hex")).toBe(file.sha256);
      expect(createHash("md5").update(bytes!).digest("base64")).toBe(file.md5);
    }
    expect(recorded.plan.client).toBe("ios_app_clip");
    expect(recorded.plan.device_manifest).toMatchObject({
      schema_version: "v3",
      capture_schema_version: "3.2.0",
      capture_source: "iphone",
      capture_profile_id: profileId,
      scene_id: sceneId,
      capture_id: captureId,
      video_uri: "walkthrough.mov",
    });

    // The phone's link check: it binds to the rights the server grants.
    const link = await api("GET", token);
    expect(link.status).toBe(200);
    expect(link.body.bundle.scene_id).toBe(sceneId);
    expect(link.body.bundle.capture_id).toBe(captureId);
    const plan = await api("POST", `${token}/bundle`, {
      client: recorded.plan.client,
      binding_digest: link.body.bundle.binding_digest,
      device_manifest: recorded.plan.device_manifest,
      files: recorded.plan.files,
    });
    expect(plan.status, JSON.stringify(plan.body)).toBe(200);
    expect(plan.body.file_count).toBe(recorded.plan.files.length);
    expect(plan.body.present_paths).toEqual([]);

    const uploaded = new Set<string>();
    let targets = plan.body.targets as Record<string, any>[];
    while (targets.length) {
      for (const target of targets) {
        const data = recorded.files.get(target.path)!;
        const status = target.kind === "resumable"
          ? state.bucket.uploadResumable(target.session_uri, data)
          : state.bucket.putSigned(target.url, data, target.headers);
        expect(status, target.path).toBe(200);
        uploaded.add(target.path);
      }
      const remaining = recorded.plan.files.map((file) => file.path).filter((path) => !uploaded.has(path)).slice(0, 250);
      if (!remaining.length) break;
      const minted = await api("POST", `${token}/bundle/targets`, { plan_digest: plan.body.plan_digest, paths: remaining });
      expect(minted.status).toBe(200);
      targets = minted.body.targets;
    }
    expect(uploaded.size).toBe(recorded.plan.files.length);

    state.privacy.push(APPROVED);
    const complete = await api("POST", `${token}/bundle/complete`, { plan_digest: plan.body.plan_digest });
    expect(complete.status, JSON.stringify(complete.body)).toBe(201);
    expect(complete.body.state).toBe("complete");
    expect(state.notices).toEqual([`${requestId}:video_received`]);
    expect(state.bucket.writeLog.slice(-1)[0]).toBe(`${raw}/capture_upload_complete.json`);

    // Every device byte is stored as recorded; the server's files sit beside
    // them; hashes.json covers everything but itself.
    const stored = state.bucket.names(`${raw}/`).map((objectName) => objectName.slice(raw.length + 1));
    for (const file of recorded.plan.files) {
      expect(state.bucket.objects.get(`${raw}/${file.path}`)!.data.equals(recorded.files.get(file.path)!)).toBe(true);
    }
    for (const serverOwned of ["manifest.json", "provenance.json", "rights_consent.json", "capture_context.json",
      "intake_packet.json", "task_hypothesis.json", "hashes.json", "capture_upload_complete.json"]) {
      expect(stored, serverOwned).toContain(serverOwned);
    }
    const hashes = JSON.parse(state.bucket.text(`${raw}/hashes.json`)!);
    expect(Object.keys(hashes.artifacts).sort()).toEqual(stored.filter((path) => path !== "hashes.json").sort());

    const manifest = JSON.parse(state.bucket.text(`${raw}/manifest.json`)!);
    expect(manifest).toMatchObject({
      schema_version: "v3",
      capture_schema_version: "3.2.0",
      capture_source: "iphone",
      capture_profile_id: profileId,
      scene_id: sceneId,
      capture_id: captureId,
      site_submission_id: requestId,
      video_uri: "walkthrough.mov",
    });
    expect(manifest.site_self_capture).toMatchObject({ authored_by: "blueprint_webapp", client: "ios_app_clip", request_id: requestId });
    expect(manifest.capture_capabilities).toMatchObject({ device_imu: false, device_imu_unavailable_reason: "app_clip_runtime" });
    expect(stored).not.toContain("motion.jsonl");

    const exportRoot = process.env.BLUEPRINT_EXPORT_COMPLETED_BUNDLES;
    if (exportRoot) {
      const destination = join(exportRoot, name, "raw");
      rmSync(destination, { recursive: true, force: true });
      for (const path of stored) {
        mkdirSync(dirname(join(destination, path)), { recursive: true });
        writeFileSync(join(destination, path), state.bucket.objects.get(`${raw}/${path}`)!.data);
      }
    }
  });
});
