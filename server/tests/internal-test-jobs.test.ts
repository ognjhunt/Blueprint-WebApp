// @vitest-environment node
/**
 * Internal test jobs (owner, 2026-11-15): `POST /api/internal/pipeline/test-jobs`.
 *
 * The real routes and modules against the fake Firestore and the fake bucket: the signed internal route, the start
 * form's own handler, the real upload finish, the real outbox and its real dispatch, the real Slack sender. Substituted:
 * Firebase persistence, Cloud Storage, the email transport (counted), the network (Slack's webhook is counted, nothing
 * leaves the process), the media probe and the privacy screen's model step.
 *
 * What this pins:
 * - W4: the signature is the only door (the same refusal as another internal route); the body is validated; unknown
 *   footage is a typed 404; the same key is the same job; the video is copied into the canonical path and finished
 *   exactly as a site's upload is (manifest, completion marker, delivery record, coverage review), with the same
 *   objects a site's own upload leaves; the public intake counters are not touched.
 * - W5: a marked job, driven through creation, its video, its lifecycle notices, the ops alerts and its withdrawal,
 *   queues and sends nothing, while the same drive for a site's job sends what it sends today.
 * - W6: the Privacy version in force is written once, with what it rests on, and no person's acceptance.
 * - W7: the job gets the same grant from the same policy as a site's job, with no other owner or account.
 * - W8: the public form cannot reach any of this (no marker, no internal grant) and still sends its notices.
 * - W9: the owner link withdraws a test job through the existing path.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { sharedUploadBucket } from "./helpers/fake-upload-bucket";
import { siteCaptureStartSubmission } from "./helpers/siteCaptureStartSubmission";

const seams = vi.hoisted(() => ({
  sendEmail: vi.fn(async (_message: { to?: unknown; subject?: unknown }) => ({ sent: true, provider: "resend", messageId: "accepted" })),
  slack: [] as string[],
}));

vi.mock("../utils/selfCaptureMediaMetadata", async importOriginal => {
  const actual = await importOriginal<typeof import("../utils/selfCaptureMediaMetadata")>();
  const { fixtureCaptureMediaMetadata } = await import("./helpers/capture-media-probe");
  return { ...actual, probeCaptureVideo: vi.fn(async () => fixtureCaptureMediaMetadata()),
    probeStoredCaptureVideo: vi.fn(async () => fixtureCaptureMediaMetadata()) };
});
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE, fakeArrayUnion } = await import("./helpers/fake-firestore");
  const { sharedUploadBucket: bucket } = await import("./helpers/fake-upload-bucket");
  return {
    dbAdmin: sharedFakeFirestore,
    storageAdmin: { bucket: () => bucket.bucket },
    authAdmin: { verifyIdToken: async () => { throw new Error("No account sign-in here"); } },
    default: { firestore: { FieldValue: {
      serverTimestamp: () => new Date().toISOString(), delete: () => FAKE_FIELD_DELETE,
      arrayUnion: (...items: unknown[]) => fakeArrayUnion(...items), increment: (n: number) => n,
    } } },
  };
});
vi.mock("../utils/email", () => ({ sendEmail: seams.sendEmail }));
vi.mock("../utils/capturePrivacyScreen", () => ({
  screenCaptureForPrivacy: vi.fn(async () => ({ proceed: true, outcome: "cleared", eligibility: "unscreened", detail: null, evidence: null })),
}));
vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn(() => { throw new Error("No model calls here"); }) }));

const SLACK = "https://hooks.slack.invalid/services/fixture";
const originalFetch = globalThis.fetch;
let server: Server | undefined, base = "", sequence = 0;
const doc = (path: string): any => state.docs.get(path);
const rows = (jobId: string) => [...state.docs.entries()]
  .filter(([key, value]) => key.startsWith("captureOutbox/") && !key.slice("captureOutbox/".length).includes("/")
    && (value as { requestId?: string }).requestId === jobId)
  .map(([key, value]) => ({ key: key.slice("captureOutbox/".length), ...(value as Record<string, any>) }));
const kinds = (jobId: string) => rows(jobId).map(row => row.kind).sort();
/** Messages that leave Blueprint: every email not to Blueprint's own ops address. */
const outwardMentioning = (jobId: string) => seams.sendEmail.mock.calls
  .filter(([message]) => message.to !== "ops@tryblueprint.io" && JSON.stringify(message).includes(jobId));
const opsEmailsMentioning = (jobId: string) => seams.sendEmail.mock.calls
  .filter(([message]) => message.to === "ops@tryblueprint.io" && JSON.stringify(message).includes(jobId));
const slackMentioning = (jobId: string) => seams.slack.filter(text => text.includes(jobId));

beforeAll(async () => {
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("BLUEPRINT_INTAKE_DAILY_LIMIT", "10000");
  vi.stubEnv("BLUEPRINT_INTAKE_PER_IP_DAILY_LIMIT", "10000");
  vi.stubEnv("PIPELINE_SYNC_TOKEN", "fixture-pipeline-sync-secret");
  vi.stubEnv("SLACK_WEBHOOK_URL", SLACK);
  vi.stubEnv("SLACK_INBOUND_WEBHOOK_URL", SLACK);
  vi.stubEnv("BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON", JSON.stringify({ owner: { user_id: "blueprint", organization_id: "blueprint" },
    upstream_max_spend_usd: 1, native_max_spend_usd: 1, max_total_spend_usd: 2, max_paid_attempts: 2, ttl_seconds: 3600,
    provider_terms_reference: `sha256:${"c".repeat(64)}` }));
  vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.href.startsWith(SLACK)) {
      seams.slack.push(String(JSON.parse(String(init?.body ?? "{}")).text ?? ""));
      return new Response("ok", { status: 200 });
    }
    if (url.hostname !== "127.0.0.1") throw new Error(`External network forbidden here: ${url.hostname}`);
    return originalFetch(input, init);
  });
  const { default: intake } = await import("../routes/inbound-request");
  const { default: uploads } = await import("../routes/self-capture-uploads");
  const { default: brief } = await import("../routes/site-task-brief");
  const { default: testJobs } = await import("../routes/internal-test-jobs");
  const { default: testbeds } = await import("../routes/internal-capture-testbeds");
  const { default: worlds } = await import("../routes/internal-capture-worlds");
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/inbound-request", intake);
  app.use("/api/self-capture/uploads", uploads);
  app.use("/api/site-task-brief", brief);
  app.use("/api/internal/pipeline", testJobs);
  app.use("/api/internal/pipeline", testbeds);
  app.use("/api/internal/pipeline", worlds);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 300_000);
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
beforeEach(() => {
  state.docs.clear();
  sharedUploadBucket.clear();
  seams.sendEmail.mockClear();
  seams.slack.length = 0;
});

/** A minimal MP4: the routes check the header, not the picture. */
function mp4(): Buffer {
  const header = Buffer.alloc(20);
  header.writeUInt32BE(20, 0);
  header.write("ftypisom", 4, "latin1");
  header.write("isom", 16, "latin1");
  return Buffer.concat([header, Buffer.from("internal-test-footage-bytes")]);
}

/** Blueprint's own test footage, kept under its prefix (the Pipeline half puts it there). */
async function seedFootage(footageId: string, extension = "mp4", body = mp4()) {
  await sharedUploadBucket.bucket.file(`internal-test-footage/${footageId}/walkthrough.${extension}`).save(body, { resumable: false });
}

async function signedPost(path: string, body: unknown, options: { sign?: boolean; secret?: string } = {}) {
  const { buildPipelineSyncSignature } = await import("../utils/pipelineSyncSecurity");
  const raw = JSON.stringify(body);
  const timestamp = new Date().toISOString();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.sign !== false) {
    headers["X-Blueprint-Pipeline-Timestamp"] = timestamp;
    headers["X-Blueprint-Pipeline-Signature"] = `sha256=${buildPipelineSyncSignature({ secret: options.secret ?? "fixture-pipeline-sync-secret",
      timestamp, body: raw })}`;
  }
  const response = await fetch(`${base}${path}`, { method: "POST", headers, body: raw });
  return { status: response.status, body: await response.json() as Record<string, any> };
}

const testJobBody = (overrides: Record<string, unknown> = {}) => ({ idempotency_key: `harness-run-${sequence}-key`, label: "rigid pick 1080p",
  footage_id: "pexels-854533", description: "Pick up the red box from the shelf and place it on the cart", ...overrides });

async function createTestJob(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  await seedFootage(String(overrides.footage_id ?? "pexels-854533"));
  const result = await signedPost("/api/internal/pipeline/test-jobs", testJobBody(overrides));
  expect(result.status, JSON.stringify(result.body)).toBe(201);
  return result.body as { job_id: string; capture_id: string; footage: Record<string, unknown> };
}

/** The job's owner link token, as the website mints it for a site (a person opens a test job from the console). */
async function ownerToken(jobId: string) {
  const { captureUploadUrlFor } = await import("../utils/captureUploadToken");
  return captureUploadUrlFor(jobId, "owner").split("/capture-upload/")[1];
}

/** A site starts a job on the public form, exactly as the browser sends it. */
async function startSiteJob() {
  const requestId = `site-job-${++sequence}`;
  const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(sequence % 250) + 1}` },
    body: JSON.stringify(siteCaptureStartSubmission({ requestId, retryToken: `r${requestId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: `${requestId}@example.test` })) });
  expect(response.status, await response.clone().text()).toBe(201);
  const { captureUrl } = await response.json() as { captureUrl: string };
  return { jobId: requestId, token: captureUrl.split("/capture-upload/")[1] };
}

async function uploadSiteVideo(token: string) {
  const form = new FormData();
  form.append("video", new Blob([mp4()], { type: "video/mp4" }), "walkthrough.mp4");
  const response = await fetch(`${base}/api/self-capture/uploads/${token}`, { method: "POST", body: form });
  expect(response.status, await response.clone().text()).toBe(201);
}

/** What a job's capture prefix holds, with the job's own ids taken out so two jobs compare. */
function captureObjects(jobId: string) {
  const prefix = `scenes/site-${jobId}/captures/walkthrough-${jobId}/`;
  return sharedUploadBucket.objectNames().filter(name => name.startsWith(prefix))
    .map(name => name.slice(prefix.length).replace(/browser-video-\d+\.json$/, "browser-video-<generation>.json")).sort();
}

/** Every later step of a job's life that queues or sends a notice, as the workers and the Pipeline's calls reach them. */
async function driveLifecycle(jobId: string) {
  const { enqueueTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
  // The Pipeline's calls and the reconcilers reach these through the one lifecycle producer.
  for (const milestone of ["video_received", "scene_ready", "listing_live", "scene_tests_started", "footage_before_account"] as const)
    await enqueueTaskLifecycleNotification({ requestId: jobId, milestone }).catch(() => undefined);
  // A held scene stage's notice and an ending's notice.
  await enqueueTaskLifecycleNotification({ requestId: jobId, milestone: "evaluation_outcome", eventId: `sha256:${"d".repeat(64)}`,
    screeningOutcome: "held_setup" } as never).catch(() => undefined);
  // An ops alert keyed by the job (a Pipeline code the website does not know).
  const { noteUnknownPipelineCode } = await import("../utils/unknownPipelineCode");
  await noteUnknownPipelineCode(jobId, "fixture_slot", `fixture_code_${jobId}`);
  // Everything queued goes to the real dispatch, twice (a released row goes on the next pass).
  const { deliverOutbox } = await import("../utils/captureOutbox");
  await deliverOutbox({ limit: 100 });
  await deliverOutbox({ limit: 100 });
}

/* ----------------------------------------------------------------- W4: the door and the body */

describe("the door (W4)", () => {
  it("refuses an unsigned or wrongly signed call exactly as another internal Pipeline route does", async () => {
    await seedFootage("pexels-854533");
    const unsigned = await signedPost("/api/internal/pipeline/test-jobs", testJobBody(), { sign: false });
    const otherRoute = await signedPost("/api/internal/pipeline/capture-testbeds", {}, { sign: false });
    expect(unsigned).toEqual(otherRoute);
    expect(unsigned.status).toBe(401);
    const forged = await signedPost("/api/internal/pipeline/test-jobs", testJobBody(), { secret: "not-the-secret" });
    expect(forged).toEqual(await signedPost("/api/internal/pipeline/capture-testbeds", {}, { secret: "not-the-secret" }));
    expect([...state.docs.keys()].filter(key => key.startsWith("inboundRequests/"))).toEqual([]);
  });

  it.each([
    ["a footage id with a path in it", { footage_id: "../scenes" }],
    ["a footage id with a slash", { footage_id: "a/b" }],
    ["an upper-case footage id", { footage_id: "Pexels" }],
    ["a label with markup", { label: "<b>x</b>" }],
    ["a label that is too long", { label: "x".repeat(81) }],
    ["an empty description", { description: "   " }],
    ["a description over the form's limit", { description: "y".repeat(2001) }],
    ["the form's placeholder for a description", { description: "Your site task" }],
    ["a short idempotency key", { idempotency_key: "short" }],
    ["a field the route does not take (the form's trap field)", { honeypot: "bot" }],
  ])("refuses %s with a typed 400 and creates nothing", async (_name, overrides) => {
    await seedFootage("pexels-854533");
    const result = await signedPost("/api/internal/pipeline/test-jobs", testJobBody(overrides));
    expect(result.status).toBe(400);
    expect(result.body.code).toBe("internal_test_job_invalid");
    expect([...state.docs.keys()].filter(key => key.startsWith("inboundRequests/"))).toEqual([]);
  });

  it("answers unknown footage with a typed 404, and footage with two videos with a typed 409", async () => {
    const unknown = await signedPost("/api/internal/pipeline/test-jobs", testJobBody({ footage_id: "not-there" }));
    expect(unknown).toEqual({ status: 404, body: { code: "internal_test_footage_not_found", footage_id: "not-there" } });
    // A video elsewhere, with the same name, is not this footage.
    await sharedUploadBucket.bucket.file("scenes/not-there/walkthrough.mp4").save(mp4(), { resumable: false });
    expect((await signedPost("/api/internal/pipeline/test-jobs", testJobBody({ footage_id: "not-there" }))).status).toBe(404);
    await seedFootage("two-videos", "mp4");
    await seedFootage("two-videos", "mov");
    const ambiguous = await signedPost("/api/internal/pipeline/test-jobs", testJobBody({ footage_id: "two-videos" }));
    expect(ambiguous).toEqual({ status: 409, body: { code: "internal_test_footage_ambiguous", footage_id: "two-videos" } });
    expect([...state.docs.keys()].filter(key => key.startsWith("inboundRequests/"))).toEqual([]);
  });

  it("creates the job through the start form's path and answers with the job and its capture", async () => {
    const created = await createTestJob();
    expect(created.job_id).toMatch(/^itest-[a-f0-9]{40}$/);
    expect(created.capture_id).toBe(`walkthrough-${created.job_id}`);
    expect(created).not.toHaveProperty("job_page_path");
    expect(created.footage).toMatchObject({ state: "processing_ready", status: 201 });
    // The site's own job page works for it.
    const token = await ownerToken(created.job_id);
    const page = await fetch(`${base}/api/site-task-brief/${token}/status`);
    expect(page.status).toBe(200);
    const record = doc(`inboundRequests/${created.job_id}`);
    expect(record.internal_test).toEqual({ label: "rigid pick 1080p", footage_id: "pexels-854533",
      created_by: "pipeline_sync_signature", created_at_iso: expect.any(String) });
    expect(record.request).toMatchObject({ buyerType: "site_operator", capture_mode: "self_capture",
      consent_attestation: { granted: true, statement_version: "internal_test.v1", basis: "blueprint_internal_test" } });
    // The sentence is the job's, and its brief is confirmed, as the form's one box does.
    const brief = doc(`siteTaskBriefs/${created.job_id}`);
    expect(brief).toMatchObject({ summary: "Pick up the red box from the shelf and place it on the cart" });
    expect(brief.confirmedAtIso).toEqual(expect.any(String));
    // No share statement: no listing record, nothing owed to companies.
    expect(record.public_task_listing).toBeUndefined();
    expect(record.summary_shared_notice).toBeUndefined();
  });

  it("copies the video into the canonical path and finishes it exactly as a site's upload is finished", async () => {
    const created = await createTestJob();
    const site = await startSiteJob();
    await uploadSiteVideo(site.token);
    // The same objects: the walkthrough, its manifest, the completion marker the extractor watches, the delivery record.
    expect(captureObjects(created.job_id)).toEqual(captureObjects(site.jobId));
    expect(captureObjects(created.job_id)).toEqual(expect.arrayContaining(["raw/walkthrough.mp4", "raw/manifest.json",
      "raw/capture_upload_complete.json"]));
    const raw = `scenes/site-${created.job_id}/captures/${created.capture_id}/raw`;
    const [video] = await sharedUploadBucket.bucket.file(`${raw}/walkthrough.mp4`).download();
    expect(video.equals(mp4())).toBe(true);
    const [marker] = await sharedUploadBucket.bucket.file(`${raw}/capture_upload_complete.json`).download();
    expect(JSON.parse(marker.toString())).toMatchObject({ schema_version: "v1", scene_id: `site-${created.job_id}`,
      capture_id: created.capture_id, raw_prefix: raw });
    const [manifest] = await sharedUploadBucket.bucket.file(`${raw}/manifest.json`).download();
    expect(JSON.parse(manifest.toString()).capture_rights).toMatchObject({ derived_scene_generation_allowed: true,
      consent_status: "granted", statement_version: "internal_test.v1" });
    // The same hand-off records the site's upload leaves: the coverage review, the published browser delivery.
    const queues = (jobId: string) => [...state.docs.keys()].filter(key => key.includes(`walkthrough-${jobId}`))
      .map(key => key.replace(jobId, "<job>").replace(jobId, "<job>")).sort();
    expect(queues(created.job_id)).toEqual(queues(site.jobId));
    // The source stays where it was.
    expect(sharedUploadBucket.objectNames()).toContain("internal-test-footage/pexels-854533/walkthrough.mp4");
  });

  it("returns the same job for the same key and creates nothing twice", async () => {
    const first = await createTestJob();
    const snapshot = () => JSON.stringify([...state.docs.entries()].filter(([key]) => !key.startsWith("automationState/")));
    const objects = sharedUploadBucket.objectNames().sort();
    const before = snapshot();
    const again = await signedPost("/api/internal/pipeline/test-jobs", testJobBody());
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ ok: true, created: false, job_id: first.job_id, capture_id: first.capture_id,
      footage: { code: "capture_already_saved" } });
    expect(sharedUploadBucket.objectNames().sort()).toEqual(objects);
    expect(snapshot()).toBe(before);
    // The same key with other footage, another label or another description is refused, never the old job.
    await seedFootage("other-clip");
    for (const changed of [{ footage_id: "other-clip" }, { label: "another label" }, { description: "Push the bin to the wall" }]) {
      const reused = await signedPost("/api/internal/pipeline/test-jobs", testJobBody(changed));
      expect(reused).toEqual({ status: 409, body: { code: "internal_test_idempotency_key_reused" } });
    }
  });

  it("a call that lost the create race to another ask under its key is refused, and none of its footage lands", async () => {
    sequence += 1;
    const clip = (tag: string) => Buffer.concat([mp4(), Buffer.from(tag)]);
    await seedFootage("clip-a", "mp4", clip("A"));
    await seedFootage("clip-b", "mp4", clip("B"));
    const winner = await signedPost("/api/internal/pipeline/test-jobs", testJobBody({ footage_id: "clip-a" }));
    expect(winner.status).toBe(201);
    const id = String(winner.body.job_id);
    // The second call read "no job" before the first created it: its route-level read sees nothing, so its create is the
    // recovered one (same retry token), carrying other footage.
    const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
    const collection = sharedFakeFirestore.collection.bind(sharedFakeFirestore);
    let first = true;
    const read = vi.spyOn(sharedFakeFirestore, "collection").mockImplementation(((name: string) => {
      const real = collection(name);
      if (name !== "inboundRequests" || !first) return real;
      first = false;
      return { ...real, doc: (docId: string) => ({ ...real.doc(docId), get: async () => ({ exists: false, data: () => undefined }) }) };
    }) as never);
    let loser;
    try { loser = await signedPost("/api/internal/pipeline/test-jobs", testJobBody({ footage_id: "clip-b" })); }
    finally { read.mockRestore(); }
    expect(loser).toEqual({ status: 409, body: { code: "internal_test_idempotency_key_reused" } });
    expect(doc(`inboundRequests/${id}`).internal_test.footage_id).toBe("clip-a");
    const [video] = await sharedUploadBucket.bucket.file(`scenes/site-${id}/captures/walkthrough-${id}/raw/walkthrough.mp4`).download();
    expect(video.equals(clip("A"))).toBe(true);
  });

  it("refuses a job id that is not a test job's, and a public form that tries to take a test job's id first", async () => {
    sequence += 1;
    const id = (await import("../routes/internal-test-jobs")).internalTestJobId(testJobBody().idempotency_key);
    const taken = await fetch(`${base}/api/inbound-request`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(siteCaptureStartSubmission({ requestId: id, retryToken: "t".repeat(64),
        sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: "squatter@example.test" })) });
    expect(taken.status).toBe(400);
    expect(await taken.json()).toMatchObject({ code: "request_id_reserved" });
    expect(doc(`inboundRequests/${id}`)).toBeUndefined();
    // A record under that id that is not a test job (one stored before this check) is never taken over.
    state.docs.set(`inboundRequests/${id}`, { requestId: id, request: { buyerType: "site_operator" } });
    await seedFootage("pexels-854533");
    expect(await signedPost("/api/internal/pipeline/test-jobs", testJobBody()))
      .toEqual({ status: 409, body: { code: "internal_test_job_id_taken" } });
  });

  it.each([
    ["larger than one job may upload", "big-clip", Buffer.concat([mp4(), Buffer.alloc(1024 * 1024)]), 413, "video_too_large_for_job"],
    ["that is not a video by its header", "not-a-video", Buffer.from("plain text, not a video at all"), 415, "video_content_not_recognized"],
  ])("refuses footage %s before any job exists", async (_name, footageId, body, status, code) => {
    vi.stubEnv("BLUEPRINT_UPLOAD_PER_JOB_DAILY_MB_LIMIT", "1");
    try {
      await seedFootage(footageId, "mp4", body);
      expect(await signedPost("/api/internal/pipeline/test-jobs", testJobBody({ footage_id: footageId })))
        .toEqual({ status, body: { code, footage_id: footageId } });
      expect([...state.docs.keys()].filter(key => key.startsWith("inboundRequests/") || key.startsWith("siteTaskBriefs/"))).toEqual([]);
    } finally {
      vi.stubEnv("BLUEPRINT_UPLOAD_PER_JOB_DAILY_MB_LIMIT", "4096");
    }
  });

  it("is not counted in the intake figures", async () => {
    await createTestJob();
    expect([...state.docs.keys()].filter(key => key.startsWith("stats/"))).toEqual([]);
    await startSiteJob();
    expect([...state.docs.keys()].filter(key => key.startsWith("stats/")).length).toBeGreaterThan(0);
  });

  it("does not count against the public intake caps", async () => {
    vi.stubEnv("BLUEPRINT_INTAKE_DAILY_LIMIT", "1");
    try {
      // Three test jobs under a global cap of one job a day...
      const ids = [(await createTestJob()).job_id, (await createTestJob()).job_id, (await createTestJob()).job_id];
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) {
        expect(doc(`inboundRequests/${id}`).intake_message_suppression).toBeUndefined();
      }
      // ...and the day's one site job is still admitted; the next is refused by the cap, as today.
      await startSiteJob();
      const refused = await fetch(`${base}/api/inbound-request`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(siteCaptureStartSubmission({ requestId: `site-capped-${++sequence}`, retryToken: "c".repeat(64),
          sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: "capped@example.test" })) });
      expect(refused.status).toBe(429);
    } finally {
      vi.stubEnv("BLUEPRINT_INTAKE_DAILY_LIMIT", "10000");
    }
  });
});

/* ----------------------------------------------------------------- W5: nothing is sent */

describe("nothing about a test job leaves Blueprint (W5)", () => {
  it("creation, the video, every lifecycle notice and dispatch: no outward message for the test job, ops told as for a site", async () => {
    const created = await createTestJob();
    const site = await startSiteJob();
    await uploadSiteVideo(site.token);
    // Fire-and-forget bells settle.
    await new Promise(resolve => setTimeout(resolve, 50));
    // At creation a site's job queues its receipt (with its link), and rings ops.
    expect(kinds(site.jobId)).toEqual(expect.arrayContaining(["task_received"]));
    expect(slackMentioning(site.jobId).length).toBeGreaterThan(0);
    expect(kinds(created.job_id)).toEqual([]);

    await driveLifecycle(created.job_id);
    await driveLifecycle(site.jobId);
    await new Promise(resolve => setTimeout(resolve, 50));
    // Outward: nothing queued in the outbox, nothing sent to anyone outside Blueprint.
    expect(kinds(created.job_id)).toEqual([]);
    expect(outwardMentioning(created.job_id)).toEqual([]);
    // Internal: ops hear about the test job as about a site's, and the new-request notice says it is a test, by its label.
    expect(opsEmailsMentioning(created.job_id).map(([message]) => String(message.subject)))
      .toEqual(['[NORMAL] New internal test job "rigid pick 1080p" (site operator)']);
    const bells = (jobId: string) => slackMentioning(jobId).map(text => text.replace(new RegExp(jobId, "g"), "<job>")
      .replace(/fixture_code_\S+/, "<code>").split("\n")[0].replace(/ · .*$/, ""));
    expect(bells(created.job_id).sort()).toEqual(bells(site.jobId).sort());
    // The same drive for the site's job queues and sends what it does today: its receipt with its link (the only site
    // email until companies answer, 2026-11-19); the ops email; and three Slack bells (the new request, the walkthrough
    // to review, the unknown Pipeline code).
    expect(kinds(site.jobId)).toEqual(["task_received"]);
    expect(rows(site.jobId).every(row => row.status === "sent")).toBe(true);
    const toSite = seams.sendEmail.mock.calls.filter(([message]) => message.to === `${site.jobId}@example.test`)
      .map(([message]) => String(message.subject));
    expect(toSite).toEqual(["Your Blueprint job link"]);
    expect(seams.sendEmail.mock.calls.some(([message]) => message.to === "ops@tryblueprint.io")).toBe(true);
    expect(slackMentioning(site.jobId).map(text => text.slice(0, 80))).toEqual(expect.arrayContaining([
      expect.stringContaining("New request"), expect.stringContaining("Pipeline code")]));
    // No bell for footage review by hand: no person reviews footage (2026-11-22).
    expect(slackMentioning(site.jobId).some(text => /review coverage by hand/.test(text))).toBe(false);
    // Every email of the drive went to the site or to ops: none outward about the test job.
    expect(seams.sendEmail.mock.calls.length).toBe(toSite.length + 2);
  });

  it("a row queued for a test job by any path is cancelled at dispatch, never sent", async () => {
    const created = await createTestJob();
    const { deliverOutbox, enqueueOutbox } = await import("../utils/captureOutbox");
    const entry = { idempotencyKey: `${created.job_id}:fixture`, requestId: created.job_id, kind: "scene_ready" as const,
      to: "someone@example.test", subject: "s", body: "b" };
    expect(await enqueueOutbox(entry)).toEqual({ enqueued: true });
    await deliverOutbox({ limit: 10 });
    expect(seams.sendEmail.mock.calls.filter(([message]) => message.to === "someone@example.test")).toEqual([]);
    expect(doc(`captureOutbox/${entry.idempotencyKey}`)).toMatchObject({ status: "cancelled", lastError: "internal_test_job" });
  });

  it("the job page cannot send its film link to anyone for a test job; a site's still can", async () => {
    const created = await createTestJob();
    const send = async (token: string) => fetch(`${base}/api/site-task-brief/${token}/film-link/send`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "email", to: "stranger@example.test" }) });
    const refused = await send(await ownerToken(created.job_id));
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ code: "internal_test_job" });
    expect(seams.sendEmail.mock.calls.filter(([message]) => message.to === "stranger@example.test")).toEqual([]);
    const site = await startSiteJob();
    expect((await send(site.token)).status).toBe(200);
    expect(seams.sendEmail.mock.calls.filter(([message]) => message.to === "stranger@example.test")).toHaveLength(1);    // Fail closed: when the marker read fails (after the link's rights read passed), nothing is sent.
    const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
    const collection = sharedFakeFirestore.collection.bind(sharedFakeFirestore);
    let reads = 0;
    const read = vi.spyOn(sharedFakeFirestore, "collection").mockImplementation(((name: string) => {
      if (name === "inboundRequests" && ++reads > 1) throw new Error("store_unavailable");
      return collection(name);
    }) as never);
    try {
      expect((await send(site.token)).status).toBe(409);
    } finally { read.mockRestore(); }
    expect(seams.sendEmail.mock.calls.filter(([message]) => message.to === "stranger@example.test")).toHaveLength(1);
  });
});

/* ----------------------------------------------------------------- W6, W7 */

describe("the Privacy version and the money (W6, W7)", () => {
  it("records the Privacy version in force as Blueprint's own, once, and no person's acceptance", async () => {
    const { PRIVACY_VERSION } = await import("../../client/src/lib/legalAcceptance");
    const created = await createTestJob();
    const record = doc(`inboundRequests/${created.job_id}`);
    expect(record.privacy_version_at_submission).toBe(PRIVACY_VERSION);
    expect(record.terms_acceptance).toBeNull();
    const { websiteJobPrivacyPolicyVersion } = await import("../utils/siteConsentStatements");
    expect(websiteJobPrivacyPolicyVersion(record)).toBe(PRIVACY_VERSION);
    // A site's job keeps the version its form showed, and its acceptance.
    const site = await startSiteJob();
    expect(doc(`inboundRequests/${site.jobId}`).terms_acceptance).toMatchObject({ accepted_terms: true });
  });

  it("gets the same grant, from the same policy and limits, as a site's job; its owner is the job's own subject", async () => {
    const { websiteSceneSponsorship } = await import("../utils/websiteSceneSponsorship");
    const { getBrief } = await import("../utils/siteTaskBrief");
    const created = await createTestJob();
    const site = await startSiteJob();
    await uploadSiteVideo(site.token);
    const grant = async (jobId: string) => websiteSceneSponsorship({ requestId: jobId, brief: (await getBrief(jobId))!,
      record: doc(`inboundRequests/${jobId}`), now: Math.floor(Date.now() / 1000) }) as Record<string, any>;
    const test = await grant(created.job_id), real = await grant(site.jobId);
    const money = (value: Record<string, any>) => ({ sponsor: value.sponsor, owner: value.owner,
      preparation_max_total_spend_usd: value.preparation_max_total_spend_usd, upstream_max_spend_usd: value.upstream_max_spend_usd,
      max_total_spend_usd: value.max_total_spend_usd, max_paid_attempts: value.max_paid_attempts,
      automatic_budget_extension: value.automatic_budget_extension });
    expect(money(test)).toEqual(money(real));
    expect(test.owner).toEqual({ user_id: "blueprint", organization_id: "blueprint" });
    expect(doc(`inboundRequests/${created.job_id}`).capture_owner_uid).toMatch(/^site-job-[a-f0-9]{40}$/);
  });
});

/* ----------------------------------------------------------------- W8, W9 */

describe("real jobs and closing a test job (W8, W9)", () => {
  it("the public form cannot set the marker or the internal grant", async () => {
    const requestId = `site-forged-${++sequence}`;
    const body = { ...siteCaptureStartSubmission({ requestId, retryToken: `r${requestId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", email: `${requestId}@example.test` }),
    internal_test: { label: "x" }, internalTestIntake: { recordFields: { internal_test: { label: "x" } } } };
    const response = await fetch(`${base}/api/inbound-request`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body) });
    expect(response.status).toBe(201);
    expect(doc(`inboundRequests/${requestId}`).internal_test).toBeUndefined();
    const forgedGrant = await fetch(`${base}/api/inbound-request`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, requestId: `${requestId}-g`, retryToken: `g${requestId}`.padEnd(64, "x"),
        consentAttestation: { granted: true, statementVersion: "internal_test.v1", basis: "blueprint_internal_test" } }) });
    expect(forgedGrant.status).toBe(400);
    expect(doc(`inboundRequests/${requestId}-g`)).toBeUndefined();
  });

  it("the job page cannot replace a test job's grant with a sharing statement", async () => {
    const created = await createTestJob();
    const token = await ownerToken(created.job_id);
    const response = await fetch(`${base}/api/self-capture/uploads/${token}/recording-consent`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ granted: true, statementVersion: "2026-11-12.v4" }) });
    expect(response.status).toBe(409);
    expect(doc(`inboundRequests/${created.job_id}`).request.consent_attestation.statement_version).toBe("internal_test.v1");
    expect(doc(`inboundRequests/${created.job_id}`).public_task_listing).toBeUndefined();
  });

  it("withdraws a test job through the owner link's own path, sending nothing outward", async () => {
    const created = await createTestJob();
    const token = await ownerToken(created.job_id);
    const response = await fetch(`${base}/api/self-capture/uploads/${token}/withdrawal`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: "withdraw_recording_permission" }) });
    expect(response.status, await response.clone().text()).toBe(202);
    const record = doc(`inboundRequests/${created.job_id}`);
    expect(record.capture_withdrawal).toBeTruthy();
    const { projectWebsiteCaptureRights } = await import("../utils/websiteCaptureRights");
    expect(projectWebsiteCaptureRights(record).consent_revoked).toBe(true);
    const { deliverOutbox } = await import("../utils/captureOutbox");
    await deliverOutbox({ limit: 50 });
    expect(kinds(created.job_id)).toEqual([]);
    expect(outwardMentioning(created.job_id)).toEqual([]);
  });
});

/* ----------------------------------------------------------------- W11: what the Pipeline sees */

describe("what the Pipeline reads about a test job (W11)", () => {
  const MARK = { label: "rigid pick 1080p", footage_id: "pexels-854533" };

  it("the rights, the task context, the manifest and the grant carry the marker and the grant version; a site's carry neither", async () => {
    const { loadWebsiteCaptureRights, projectWebsiteTaskContext } = await import("../utils/websiteTaskContext");
    const { getBrief } = await import("../utils/siteTaskBrief");
    const { websiteSceneSponsorship } = await import("../utils/websiteSceneSponsorship");
    const created = await createTestJob();
    const rights = await loadWebsiteCaptureRights(created.job_id);
    expect(rights).toMatchObject({ statement_version: "internal_test.v1", consent_status: "granted", consent_revoked: false,
      derived_scene_generation_allowed: true, internal_test: MARK });
    const context = projectWebsiteTaskContext((await getBrief(created.job_id))!, rights) as Record<string, any>;
    expect(context.internal_test).toEqual(MARK);
    expect(context.capture_rights).toMatchObject({ statement_version: "internal_test.v1", consent_status: "granted",
      consent_revoked: false, internal_test: MARK });
    const raw = `scenes/site-${created.job_id}/captures/${created.capture_id}/raw`;
    const [manifest] = await sharedUploadBucket.bucket.file(`${raw}/manifest.json`).download();
    expect(JSON.parse(manifest.toString()).capture_rights.internal_test).toEqual(MARK);
    const grant = websiteSceneSponsorship({ requestId: created.job_id, brief: (await getBrief(created.job_id))!,
      record: doc(`inboundRequests/${created.job_id}`), now: Math.floor(Date.now() / 1000) }) as Record<string, any>;
    expect(grant.internal_test).toEqual(MARK);
    // A site's job: the same projections as before, with no marker anywhere.
    const site = await startSiteJob();
    await uploadSiteVideo(site.token);
    const siteRights = await loadWebsiteCaptureRights(site.jobId);
    expect(Object.keys(siteRights).sort()).toEqual(["capture_contributor_payout_eligible", "consent_revoked", "consent_scope",
      "consent_status", "data_licensing_allowed", "derived_scene_generation_allowed", "recorded_at_iso", "statement_version"]);
    const siteContext = projectWebsiteTaskContext((await getBrief(site.jobId))!, siteRights) as Record<string, any>;
    expect(siteContext).not.toHaveProperty("internal_test");
    const siteRaw = `scenes/site-${site.jobId}/captures/walkthrough-${site.jobId}/raw`;
    const [siteManifest] = await sharedUploadBucket.bucket.file(`${siteRaw}/manifest.json`).download();
    expect(JSON.parse(siteManifest.toString()).capture_rights).not.toHaveProperty("internal_test");
  });

  it("the Pipeline's signed task-context read serves the marker and the grant version", async () => {
    const created = await createTestJob();
    const served = await signedPost(`/api/internal/pipeline/creator-captures/${created.capture_id}/task-context`,
      { request_id: created.job_id, scene_id: `site-${created.job_id}` });
    expect(served.status, JSON.stringify(served.body)).toBe(200);
    expect(served.body.internal_test).toEqual(MARK);
    expect(served.body.capture_rights).toMatchObject({ statement_version: "internal_test.v1", consent_status: "granted",
      consent_revoked: false, internal_test: MARK });
    const site = await startSiteJob();
    await uploadSiteVideo(site.token);
    const siteServed = await signedPost(`/api/internal/pipeline/creator-captures/walkthrough-${site.jobId}/task-context`,
      { request_id: site.jobId, scene_id: `site-${site.jobId}` });
    expect(siteServed.status).toBe(200);
    expect(siteServed.body).not.toHaveProperty("internal_test");
    expect(siteServed.body.capture_rights).not.toHaveProperty("internal_test");
  });

  async function publications(captureId: string, basis: string, statementVersion: string) {
    const { crossRuntimeArtifactDigest } = await import("../utils/crossRuntimeCanonical");
    const clip: Record<string, unknown> = { schema_version: "website_company_clip.v1", capture_id: captureId,
      clip_revision: `sha256:${"3".repeat(64)}`, state: "ready", format: "mp4_h264_faststart_video_only", content_type: "video/mp4",
      digest: `sha256:${"5".repeat(64)}`, size_bytes: 36, width: 1280, height: 720, fps: 30, duration_seconds: 4.2, has_audio: false,
      permission_basis: basis, statement_version: statementVersion, updated_at_epoch: 1_794_000_000 };
    const simulation: Record<string, unknown> = { schema_version: "website_company_simulation.v1", capture_id: captureId,
      simulation_revision: `sha256:${"4".repeat(64)}`, state: "ready", format: "zip_usd_scene_object_success_rule",
      content_type: "application/zip", digest: `sha256:${"6".repeat(64)}`, size_bytes: 12,
      files: ["README.txt", "object.usdz", "scene.usda", "scene/room.usdc", "scene/room_collision.usdc", "success_rule.json"],
      permission_basis: basis, statement_version: statementVersion, updated_at_epoch: 1_794_000_000 };
    return { clip: { ...clip, clip_digest: crossRuntimeArtifactDigest(clip, "clip_digest") } as never,
      simulation: { ...simulation, simulation_digest: crossRuntimeArtifactDigest(simulation, "simulation_digest") } as never };
  }

  it("stores the company clip and simulation the Pipeline publishes for a test job, and serves them to no company", async () => {
    const { recordWebsiteCompanyClip } = await import("../utils/websiteCompanyClip");
    const { recordWebsiteCompanySimulation } = await import("../utils/websiteCompanySimulation");
    const { companyMediaRefusal } = await import("../utils/companyJobPage");
    const created = await createTestJob();
    const scene = `site-${created.job_id}`;
    const internal = await publications(created.capture_id, "internal_test", "internal_test.v1");
    expect(await recordWebsiteCompanyClip(created.job_id, scene, created.capture_id, internal.clip)).toMatchObject({ accepted: true });
    expect(await recordWebsiteCompanySimulation(created.job_id, scene, created.capture_id, internal.simulation)).toMatchObject({ accepted: true });
    const session = doc(`captureUploadSessions/${created.capture_id}`);
    expect(session.company_clip).toMatchObject({ permission_basis: "internal_test", statement_version: "internal_test.v1" });
    expect(session.company_simulation).toMatchObject({ permission_basis: "internal_test" });
    // Stored, and still served to no company: the one predicate refuses the job first.
    expect(await companyMediaRefusal(created.job_id, created.capture_id, "any-company")).not.toBeNull();
    const { loadCompanyJobAccess } = await import("../utils/teamJobAccess");
    expect((await loadCompanyJobAccess(created.job_id)).access.reason).toBe("internal_test_job");
    // A test job's copy only on its own basis.
    const shared = await publications(created.capture_id, "site_sharing_statement", "2026-11-12.v4");
    await expect(recordWebsiteCompanyClip(created.job_id, scene, created.capture_id, shared.clip)).rejects.toThrow("website_company_clip_not_permitted");
  });

  it("refuses the internal basis for a site's job, and keeps a site's own records as today", async () => {
    const { recordWebsiteCompanyClip } = await import("../utils/websiteCompanyClip");
    const { recordWebsiteCompanySimulation } = await import("../utils/websiteCompanySimulation");
    const site = await startSiteJob();
    await uploadSiteVideo(site.token);
    const capture = `walkthrough-${site.jobId}`, scene = `site-${site.jobId}`;
    const internal = await publications(capture, "internal_test", "internal_test.v1");
    await expect(recordWebsiteCompanyClip(site.jobId, scene, capture, internal.clip)).rejects.toThrow("website_company_clip_not_permitted");
    await expect(recordWebsiteCompanySimulation(site.jobId, scene, capture, internal.simulation))
      .rejects.toThrow("website_company_simulation_not_permitted");
    const shared = await publications(capture, "site_sharing_statement", "2026-11-12.v4");
    expect(await recordWebsiteCompanyClip(site.jobId, scene, capture, shared.clip)).toMatchObject({ accepted: true });
    expect(await recordWebsiteCompanySimulation(site.jobId, scene, capture, shared.simulation)).toMatchObject({ accepted: true });
  });
});

/* ----------------------------------------------------------------- the Pipeline's owner read, through the real mask */

describe("the owner observation reads a test job through the masked Firestore read", () => {
  /** What Firestore's REST read answers under the website's field mask: only the masked paths, typed. */
  async function maskedRead(jobId: string, record: Record<string, any>) {
    const { OWNER_FIRESTORE_FIELD_PATHS, decodeMaskedOwnerDocument } = await import("../utils/firestoreOwnerProjection");
    const fields: Record<string, any> = {};
    for (const path of OWNER_FIRESTORE_FIELD_PATHS) {
      const segments = path.split(".");
      const value = segments.reduce<any>((at, key) => at?.[key], record);
      if (value === undefined) continue;
      let cursor = fields;
      for (const key of segments.slice(0, -1)) cursor = (cursor[key] ??= { mapValue: { fields: {} } }).mapValue.fields;
      cursor[segments.at(-1)!] = typeof value === "string" ? { stringValue: value }
        : typeof value === "boolean" ? { booleanValue: value } : { nullValue: "NULL_VALUE" };
    }
    const name = `projects/p/databases/(default)/documents/inboundRequests/${jobId}`;
    return decodeMaskedOwnerDocument(Buffer.from(JSON.stringify({ name, fields, createTime: "2026-11-15T12:00:00Z",
      updateTime: "2026-11-15T12:00:01.5Z" })), name);
  }
  /** The observer's deps over the job's masked record and the real stored capture objects. */
  async function observe(jobId: string, record: Record<string, any>, purpose?: "scene_preparation") {
    const { observeWebsiteCaptureOwner } = await import("../utils/websiteCaptureOwnerObservation");
    const bucket = sharedUploadBucket.bucket;
    const metadata = async (name: string, generation: string | null) =>
      (await bucket.file(name, generation ? { generation } : undefined).getMetadata())[0];
    const marker = await metadata(`scenes/site-${jobId}/captures/walkthrough-${jobId}/raw/capture_upload_complete.json`, null);
    return observeWebsiteCaptureOwner({ request_id: jobId, scene_id: `site-${jobId}`, capture_id: `walkthrough-${jobId}`,
      completion_marker_generation: String(marker.generation), ...(purpose ? { purpose } : {}) }, {
      bucket: "fake-upload-bucket", now: () => 1_790_000_000,
      readRequest: async () => maskedRead(jobId, record),
      readMetadata: metadata,
      readPinned: async (name: string, generation: string) => ({ metadata: await metadata(name, generation),
        bytes: (await bucket.file(name, { generation }).download())[0] }),
    } as never);
  }
  const RIGHTS_KEYS = ["capture_contributor_payout_eligible", "consent_revoked", "consent_scope", "consent_status",
    "data_licensing_allowed", "derived_scene_generation_allowed", "recorded_at_iso", "statement_version"];

  it("a test job: the internal grant in its three keys, the marker beside its rights, its own owner subject", async () => {
    const created = await createTestJob();
    const record = doc(`inboundRequests/${created.job_id}`);
    for (const purpose of ["scene_preparation", undefined] as const) {
      const observed = await observe(created.job_id, record, purpose);
      expect(observed.consent_attestation).toEqual({ granted: true, statement_version: "internal_test.v1",
        recorded_at_iso: record.request.consent_attestation.recorded_at_iso });
      expect(Object.keys(observed.capture_rights).sort()).toEqual([...RIGHTS_KEYS, "internal_test"].sort());
      expect(observed.capture_rights).toMatchObject({ statement_version: "internal_test.v1", consent_status: "granted",
        derived_scene_generation_allowed: true, internal_test: { label: "rigid pick 1080p", footage_id: "pexels-854533" } });
      // A test job is bound to its own owner subject at creation, like any guest site job.
      expect(observed.capture_owner).toEqual({ user_id: record.capture_owner_uid, basis: "inboundRequests.capture_owner_uid" });
    }
  });

  it("a site's job: the same answer as before, with no marker and no basis anywhere", async () => {
    const site = await startSiteJob();
    await uploadSiteVideo(site.token);
    const record = doc(`inboundRequests/${site.jobId}`);
    const observed = await observe(site.jobId, record, "scene_preparation");
    expect(Object.keys(observed.capture_rights).sort()).toEqual(RIGHTS_KEYS);
    expect(Object.keys(observed.consent_attestation).sort()).toEqual(["granted", "recorded_at_iso", "statement_version"]);
    expect(JSON.stringify(observed)).not.toMatch(/internal_test|basis"?:"blueprint/);
  });

  it("a basis or marker forged onto a site's job: the rights still follow its own statement", async () => {
    const site = await startSiteJob();
    await uploadSiteVideo(site.token);
    const record = doc(`inboundRequests/${site.jobId}`);
    const forged = { ...record, internal_test: { label: "forged", footage_id: "forged" },
      request: { ...record.request, consent_attestation: { ...record.request.consent_attestation, basis: "blueprint_internal_test" } } };
    const observed = await observe(site.jobId, forged, "scene_preparation");
    expect(observed.consent_attestation).toEqual({ granted: true, statement_version: "2026-11-12.v4",
      recorded_at_iso: record.request.consent_attestation.recorded_at_iso });
    expect(observed.capture_rights.statement_version).toBe("2026-11-12.v4");
    // The marker is reported beside the rights (any marker counts); the Pipeline refuses rights with that extra key under
    // a version other than internal_test.v1, so the hand-off stops rather than sharing anything.
    expect(observed.capture_rights.internal_test).toEqual({ label: "forged", footage_id: "forged" });
  });
});
