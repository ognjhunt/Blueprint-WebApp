// @vitest-environment node
/**
 * "Download the simulation package" on the admin job console (owner, 2026-11-16: "packages should be downloadable").
 * OFFLINE: the site's real routes (`registerRoutes`, so the console's real mount and gate and the real company media
 * route) against the fake Firestore; Firebase sign-in and the Pipeline's signed reads are fakes.
 *
 * What this pins:
 * - a signed-in admin gets the same bytes and headers a company's download gets, for a normal job and for an internal
 *   test job, whose company download stays refused;
 * - anyone else is refused exactly as the console's other routes refuse them, and each of the gate's two places holds
 *   on its own (the mount in `server/routes.ts` and the router's own `router.use(requireAdminRole)`);
 * - each other state (no package, a reference the website refuses, one taken back, a withdrawn site, the Pipeline's own
 *   answers) gets the company route's answer;
 * - nothing that names or reaches the site reaches a log line or a response of this route.
 */
import express from "express";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { currentTermsAcceptance, passedPrivacyScreen, sharedJobListing, sharedRecordingGrant } from "./helpers/sharedJob";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

const seams = vi.hoisted(() => ({ tokens: new Map<string, Record<string, unknown>>() }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, storageAdmin: null,
    // The real `verifyFirebaseToken` asks this; a token is a fake account's decoded claims.
    authAdmin: { verifyIdToken: async (token: string) => {
      const claims = seams.tokens.get(token);
      if (!claims) throw new Error("invalid token");
      return claims;
    } } };
});
const logged = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock("../logger", () => {
  const record = (...args: unknown[]) => { logged.calls.push(args); };
  return { logger: { info: vi.fn(record), warn: vi.fn(record), error: vi.fn(record), debug: vi.fn(record) } };
});

const { registerRoutes } = await import("../routes");
const { default: verifyFirebaseToken } = await import("../middleware/verifyFirebaseToken");
const { requireAdminRole } = await import("../middleware/requireAdminRole");
const { default: adminJobConsoleRouter } = await import("../routes/admin-job-console");
const { teamJobAccess } = await import("../utils/teamJobAccess");
const { companySimulationUrl } = await import("../utils/websiteCompanySimulation");
const { deleteWebsiteCompanyClips } = await import("../utils/websiteCompanyClip");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");

const ID = "req-dl";
const CAPTURE = `walkthrough-${ID}`;
const sha = (value: string) => createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
const ZIP_BYTES = Buffer.from("PK-ZIP-BYTES-OF-THE-PACKAGE");
const ZIP_DIGEST = `sha256:${createHash("sha256").update(ZIP_BYTES).digest("hex")}`;

const SITE = { name: "ZEBRAPLANT Foods", address: "77 QUOKKA Lane, Springfield", email: "owner@site-plant.example", phone: "+1 415 555 0134" };
const SITE_PLANTED = [SITE.name, "ZEBRAPLANT", "QUOKKA", SITE.email, "site-plant", "415 555"];

const NORTH = { email: "contact@north.example", partnerRole: "deployment", status: "approved", termsAcceptance: currentTermsAcceptance(),
  termsAcceptedByUid: "uid-north", company: "North Robotics", decidedAtIso: "2026-11-02T00:00:00.000Z" };
const NORTH_ID = sha(NORTH.email);
const INTERNAL_TEST = { label: "rigid pick", footage_id: "pexels-854533", created_by: "pipeline_sync_signature",
  created_at_iso: "2026-11-15T12:00:00.000Z" };
const INTERNAL_GRANT = { granted: true, statement_version: "internal_test.v1", basis: "blueprint_internal_test",
  recorded_at_iso: "2026-11-15T12:00:00.000Z" };

/** A site's job shared with approved companies (listed), with the site's identity planted in every field that holds it. */
function job(extra: Record<string, unknown> = {}) {
  return {
    requestId: ID, createdAt: "2026-11-12T10:00:00.000Z",
    contact: { email: SITE.email, company: SITE.name, phone: SITE.phone }, contactEmail: SITE.email, site_address: SITE.address,
    request: { buyerType: "site_operator", capture_mode: "self_capture", siteName: SITE.name, siteLocation: SITE.address,
      consent_attestation: sharedRecordingGrant() },
    public_task_listing: sharedJobListing("Stack cartons onto the pallet"),
    capture_privacy_screen: passedPrivacyScreen(ID),
    ...extra,
  };
}
/** A package reference exactly as the contract's record (`website_company_simulation.v1`). */
function simulationPackage(patch: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = { schema_version: "website_company_simulation.v1", capture_id: CAPTURE,
    simulation_revision: `sha256:${"4".repeat(64)}`, state: "ready", format: "zip_usd_scene_object_success_rule",
    content_type: "application/zip", digest: ZIP_DIGEST, size_bytes: ZIP_BYTES.length,
    files: ["README.txt", "object.usdz", "scene.usda", "success_rule.json"],
    permission_basis: "site_sharing_statement", statement_version: "2026-11-12.v4", updated_at_epoch: 1_794_000_000, ...patch };
  return { ...value, simulation_digest: crossRuntimeArtifactDigest(value, "simulation_digest") };
}
const jobDoc = () => state.docs.get(`inboundRequests/${ID}`) as Record<string, any>;
const patchJob = (patch: Record<string, unknown>) => state.docs.set(`inboundRequests/${ID}`, { ...jobDoc(), ...patch });
const storePackage = (value: unknown = simulationPackage()) => state.docs.set(`captureUploadSessions/${CAPTURE}`, { company_simulation: value });
const markTestJob = () => patchJob({ internal_test: INTERNAL_TEST, request: { ...jobDoc().request, consent_attestation: INTERNAL_GRANT } });

/* ----------------------------------------------------------------- calls */

let server: Server;
let base = "";
let app: express.Express;
const realFetch = globalThis.fetch;
let pipelineAnswer: "zip" | 404 | 403 = "zip";

const ADMIN = { Authorization: "Bearer admin-token" };
const OPS = { Authorization: "Bearer ops-token" };
const COMPANY = { Authorization: "Bearer company-token" };
const SITE_OWNER = { Authorization: "Bearer site-owner-token" };

type Answer = { status: number; headers: Headers; body: string; bytes: Buffer };
async function call(path: string, headers: Record<string, string> = {}): Promise<Answer> {
  const response = await realFetch(`${base}${path}`, { headers });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { status: response.status, headers: response.headers, body: bytes.toString(), bytes };
}
const adminDownload = (headers: Record<string, string> = ADMIN) => call(`/api/admin/jobs/${ID}/simulation.zip`, headers);
const adminDetail = (headers: Record<string, string> = ADMIN) => call(`/api/admin/jobs/${ID}`, headers);
/** The company's own download, by the ticket its page would issue (built directly: a test job's page issues none). */
const companyDownload = () => call(companySimulationUrl(ID, CAPTURE, NORTH_ID)!, { "sec-fetch-dest": "empty" });
const shape = (answer: Answer) => ({ status: answer.status, body: answer.body });

beforeEach(async () => {
  state.docs.clear();
  logged.calls.length = 0;
  pipelineAnswer = "zip";
  seams.tokens.clear();
  seams.tokens.set("admin-token", { uid: "uid-admin", email: "founder@tryblueprint.io", admin: true });
  seams.tokens.set("ops-token", { uid: "uid-ops", email: "ops@tryblueprint.io", ops: true });
  seams.tokens.set("company-token", { uid: "uid-north", email: NORTH.email, email_verified: true });
  seams.tokens.set("site-owner-token", { uid: "uid-site", email: SITE.email, email_verified: true });
  vi.stubEnv("BLUEPRINT_ADMIN_EMAIL_ALLOWLIST", "");
  vi.stubEnv("BLUEPRINT_OPS_EMAIL_ALLOWLIST", "");
  vi.stubEnv("BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK", "0");
  vi.stubEnv("BLUEPRINT_LOCAL_WEBAPP_ROUTE_PROOF_AUTH_TOKEN", "");
  vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "fixture-ticket-secret");
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "https://pipeline.invalid");
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "fixture-read-token");
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith("https://pipeline.invalid/")) return realFetch(input as never, init);
    if (!url.includes("/website-company-simulations/")) return new Response("", { status: 404 });
    if (pipelineAnswer !== "zip") return new Response(JSON.stringify({ detail: "no" }), { status: pipelineAnswer });
    const range = new Headers(init?.headers).get("range");
    const match = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
    if (match) {
      const first = Number(match[1]), last = match[2] ? Number(match[2]) : ZIP_BYTES.length - 1;
      if (first >= ZIP_BYTES.length) return new Response("", { status: 416, headers: { "content-range": `bytes */${ZIP_BYTES.length}` } });
      return new Response(ZIP_BYTES.subarray(first, last + 1), { status: 206, headers: { "content-type": "application/zip",
        "content-range": `bytes ${first}-${last}/${ZIP_BYTES.length}`, "content-length": String(last - first + 1), "x-blueprint-artifact-sha256": ZIP_DIGEST } });
    }
    return new Response(ZIP_BYTES, { status: 200, headers: { "content-type": "application/zip",
      "content-length": String(ZIP_BYTES.length), "x-blueprint-artifact-sha256": ZIP_DIGEST } });
  }));
  state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: "Stack 12 kg cartons onto the pallet.", confirmedAtIso: null });
  state.docs.set(`inboundRequests/${ID}`, job());
  state.docs.set(`robotTeamAccess/${NORTH_ID}`, NORTH);
  // The site's real routes, as `server/index.ts` registers them.
  app = express();
  app.use(express.json());
  registerRoutes(app);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

/* ----------------------------------------------------------------- an admin downloads */

describe("an admin downloads a job's simulation package from the job console", () => {
  it("(a) a normal job: the same bytes and headers the company's download serves", async () => {
    storePackage();
    const company = await companyDownload();
    expect(company.status).toBe(200);
    const admin = await adminDownload();
    expect(admin.status).toBe(200);
    expect(admin.bytes.equals(ZIP_BYTES)).toBe(true);
    expect(admin.bytes.equals(company.bytes)).toBe(true);
    for (const header of ["content-type", "content-disposition", "content-length", "accept-ranges", "cache-control", "x-content-type-options"])
      expect(admin.headers.get(header), header).toBe(company.headers.get(header));
    expect(admin.headers.get("content-disposition")).toBe('attachment; filename="simulation.zip"');
    expect(admin.headers.get("cache-control")).toBe("private, no-store");
    // An ops account passes the same gate.
    expect((await adminDownload(OPS)).status).toBe(200);
  });

  it("passes a resumed download's range through, as the company route does", async () => {
    storePackage();
    const part = await adminDownload({ ...ADMIN, Range: "bytes=3-" });
    expect(part.status).toBe(206);
    expect(part.bytes.equals(ZIP_BYTES.subarray(3))).toBe(true);
    expect(part.headers.get("content-range")).toBe(`bytes 3-${ZIP_BYTES.length - 1}/${ZIP_BYTES.length}`);
    expect((await adminDownload({ ...ADMIN, Range: `bytes=${ZIP_BYTES.length + 5}-` })).status).toBe(416);
  });

  it("(b) an internal test job under the current statement: served to a company until marked, then to the admin only", async () => {
    // Listed under the current sharing statement: a company is served this package...
    storePackage();
    expect((await companyDownload()).status).toBe(200);
    // ...until the job is an internal test job, with nothing else changed (the v4 grant stays). Only the
    // `internal_test_job` stop now refuses it.
    patchJob({ internal_test: INTERNAL_TEST });
    expect(jobDoc().request.consent_attestation).toEqual(sharedRecordingGrant());
    expect(teamJobAccess(jobDoc()).reason).toBe("internal_test_job");
    expect(shape(await companyDownload())).toEqual({ status: 404,
      body: JSON.stringify({ error: "The simulation is not available.", code: "company_simulation_unavailable" }) });
    const admin = await adminDownload();
    expect(admin.status).toBe(200);
    expect(admin.bytes.equals(ZIP_BYTES)).toBe(true);
  });

  it("(b') an internal test job as the internal route makes it (its own grant and package basis): the admin gets it", async () => {
    markTestJob();
    storePackage(simulationPackage({ permission_basis: "internal_test", statement_version: null }));
    const admin = await adminDownload();
    expect(admin.status).toBe(200);
    expect(admin.bytes.equals(ZIP_BYTES)).toBe(true);
    // The company route, unchanged: a valid ticket for an approved company is still refused for a test job.
    expect(shape(await companyDownload())).toEqual({ status: 404,
      body: JSON.stringify({ error: "The simulation is not available.", code: "company_simulation_unavailable" }) });
  });
});

/* ----------------------------------------------------------------- who is refused */

describe("the gate holds in each of its two places", () => {
  it("the console's mount in server/routes.ts carries the shared admin gate ahead of the router", () => {
    // Every app-level layer mounted at /api/admin/jobs, in order (not the ones mounted at the root).
    const stack = (app as unknown as { _router: { stack: Array<{ regexp: RegExp; route?: unknown; handle: unknown }> } })._router.stack;
    const handles = stack.filter(layer => !layer.route && layer.regexp.test("/api/admin/jobs") && !layer.regexp.test("/not-the-console"))
      .map(layer => layer.handle);
    const consoleAt = handles.indexOf(adminJobConsoleRouter);
    expect(consoleAt).toBeGreaterThan(-1);
    expect(handles.slice(0, consoleAt)).toEqual(expect.arrayContaining([verifyFirebaseToken, requireAdminRole]));
  });

  it("the console router refuses a non-admin by itself, without the mount's gate", async () => {
    storePackage();
    const bare = express();
    bare.use("/api/admin/jobs", verifyFirebaseToken, adminJobConsoleRouter);
    const bareServer = createServer(bare);
    await new Promise<void>(resolve => bareServer.listen(0, "127.0.0.1", () => resolve()));
    const address = bareServer.address();
    const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/api/admin/jobs/${ID}/simulation.zip`;
    try {
      for (const headers of [COMPANY, SITE_OWNER]) {
        const response = await realFetch(url, { headers });
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: "Admin access required" });
      }
      expect((await realFetch(url, { headers: ADMIN })).status).toBe(200);
    } finally {
      await new Promise<void>(resolve => bareServer.close(() => resolve()));
    }
  });
});

describe("anyone but an admin is refused exactly as the console's other routes refuse", () => {
  const siteLinkToken = () => createCaptureUploadToken({ requestId: ID, sceneId: `site-${ID}`, captureId: CAPTURE, scope: "owner" });
  const CASES: Array<[string, () => Record<string, string>, number]> = [
    ["no session", () => ({}), 401],
    ["a signed-in deployment company", () => COMPANY, 403],
    ["the site's own signed-in account", () => SITE_OWNER, 403],
    ["the site's job link token, offered as a bearer", () => ({ Authorization: `Bearer ${siteLinkToken()}` }), 401],
    ["a company's download ticket, offered as a bearer", () => ({ Authorization: `Bearer ${new URLSearchParams(companySimulationUrl(ID, CAPTURE, NORTH_ID)!.split("?")[1]).get("signature")}` }), 401],
  ];
  it.each(CASES)("%s", async (_name, headers, status) => {
    storePackage();
    const download = await adminDownload(headers());
    expect(download.status).toBe(status);
    expect(download.bytes.includes(ZIP_BYTES)).toBe(false);
    // Same status and body as the console's job detail route for the same caller.
    expect(shape(download)).toEqual(shape(await adminDetail(headers())));
  });

  it("the site's job link and a company ticket in the address open nothing on the admin route", async () => {
    storePackage();
    const ticket = companySimulationUrl(ID, CAPTURE, NORTH_ID)!.split("?")[1];
    for (const query of [`token=${encodeURIComponent(createCaptureUploadToken({ requestId: ID, sceneId: `site-${ID}`, captureId: CAPTURE }))}`, ticket]) {
      const download = await call(`/api/admin/jobs/${ID}/simulation.zip?${query}`);
      expect(download.status).toBe(401);
      expect(download.bytes.includes(ZIP_BYTES)).toBe(false);
    }
  });
});

/* ----------------------------------------------------------------- each state, beside the company route */

describe("each state answers as the company route answers", () => {
  const NOT_AVAILABLE = { status: 404, body: JSON.stringify({ error: "The simulation is not available.", code: "company_simulation_unavailable" }) };
  const NOT_NOW = { status: 503, body: JSON.stringify({ error: "The simulation is not available right now. Try again in a few minutes." }) };
  const STATES: Array<[string, () => void | Promise<unknown>, typeof NOT_AVAILABLE]> = [
    ["no package stored", () => state.docs.delete(`captureUploadSessions/${CAPTURE}`), NOT_AVAILABLE],
    ["a reference the website refuses (its digest does not verify)", () => storePackage({ ...simulationPackage(), simulation_digest: `sha256:${"9".repeat(64)}` }), NOT_AVAILABLE],
    ["a reference for another capture", () => storePackage(simulationPackage({ capture_id: `walkthrough-other` })), NOT_AVAILABLE],
    ["a reference taken back (withdrawal deletion)", () => deleteWebsiteCompanyClips(ID, [CAPTURE]), NOT_AVAILABLE],
    ["the site withdrew, the reference not yet deleted", () => patchJob({ consent_revoked: true, request: { ...jobDoc().request,
      consent_attestation: { ...sharedRecordingGrant(), granted: false, revoked_at_iso: "2026-11-16T12:00:00.000Z" } } }), NOT_AVAILABLE],
    ["the site withdrew its capture", () => patchJob({ capture_withdrawal: { requested_at_iso: "2026-11-16T12:00:00.000Z" } }), NOT_AVAILABLE],
    ["the Pipeline no longer has the package", () => { pipelineAnswer = 404; }, NOT_AVAILABLE],
    ["the Pipeline refuses the website's signed read", () => { pipelineAnswer = 403; }, NOT_NOW],
  ];
  it.each(STATES)("%s", async (_name, arrange, expected) => {
    storePackage();
    await arrange();
    const company = shape(await companyDownload());
    const admin = shape(await adminDownload());
    expect(company).toEqual(expected);
    expect(admin).toEqual(expected);
  });

  it("a withdrawal closes an internal test job's package too, and a missing job is the console's own 404", async () => {
    markTestJob();
    storePackage(simulationPackage({ permission_basis: "internal_test", statement_version: null }));
    patchJob({ capture_withdrawal: { requested_at_iso: "2026-11-16T12:00:00.000Z" } });
    expect(shape(await adminDownload())).toEqual(NOT_AVAILABLE);
    state.docs.delete(`inboundRequests/${ID}`);
    expect(shape(await adminDownload())).toEqual(shape(await adminDetail()));
    expect((await adminDownload()).status).toBe(404);
  });
});

/* ----------------------------------------------------------------- the console's detail, and what is logged */

describe("the console's job detail offers the download only when a package is ready", () => {
  const url = async () => JSON.parse((await adminDetail()).body).simulationPackageUrl;
  it("none, then ready, then none once the site withdraws; a test job's package too", async () => {
    expect(await url()).toBeNull();
    storePackage();
    expect(await url()).toBe(`/api/admin/jobs/${ID}/simulation.zip`);
    patchJob({ capture_withdrawal: { requested_at_iso: "2026-11-16T12:00:00.000Z" } });
    expect(await url()).toBeNull();
    state.docs.set(`inboundRequests/${ID}`, job());
    markTestJob();
    storePackage(simulationPackage({ permission_basis: "internal_test", statement_version: null }));
    expect(await url()).toBe(`/api/admin/jobs/${ID}/simulation.zip`);
  });
});

describe("what the route logs and answers", () => {
  it("names the job, the capture and the admin's uid only: never the site's name, address or contact details", async () => {
    storePackage();
    const answers: string[] = [];
    answers.push((await adminDownload()).body);
    pipelineAnswer = 403;
    answers.push((await adminDownload()).body);
    pipelineAnswer = "zip";
    answers.push((await adminDownload(COMPANY)).body);
    state.docs.delete(`captureUploadSessions/${CAPTURE}`);
    answers.push((await adminDownload()).body);
    const text = JSON.stringify(logged.calls) + answers.join("\n");
    for (const planted of SITE_PLANTED) expect(text.toLowerCase(), planted).not.toContain(planted.toLowerCase());
    expect(logged.calls).toContainEqual([{ jobId: ID, actor: "uid-admin", status: 200 }, "Simulation package downloaded from the job console"]);
    expect(logged.calls).toContainEqual([{ jobId: ID, captureId: CAPTURE },
      "The Pipeline refused the website's signed read of a simulation package for the job console"]);
  });
});
