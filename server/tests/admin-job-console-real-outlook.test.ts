// @vitest-environment node
/**
 * The admin job page's "Where it stands" with the real outlook loader (`loadJobOutlook`), not a mock: the case that
 * started the redesign. A job whose simulation package is stored never reads as ended or as waiting on a better video;
 * if the site's own page says something else, staff see that beside it. OFFLINE: the site's real routes against the
 * fake Firestore; the Pipeline is a fake that answers nothing.
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


const detailBody = async () => JSON.parse((await adminDetail()).body);

describe("a delivered job's page, with the real outlook", () => {
  it("an internal test job with a confirmed sentence and a stored package says the package is built", async () => {
    state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: "Stack 12 kg cartons onto the pallet.",
      confirmedAtIso: "2026-11-15T12:05:00.000Z" });
    patchJob({ site_task_brief_confirmed_at: "2026-11-15T12:05:00.000Z", capture_coverage: { covers_scene: true } });
    markTestJob();
    storePackage(simulationPackage({ permission_basis: "internal_test", statement_version: null }));
    const body = await detailBody();
    expect(body.job.internalTest).toEqual({ label: "rigid pick" });
    expect(body.simulationPackageUrl).toBe(`/api/admin/jobs/${ID}/simulation.zip`);
    expect(body.standing.phrase).toBe("Simulation package built");
    expect(body.standing.phrase).not.toMatch(/Ended|video|Reading/);
    // The reviewer's case: the real outlook reads this job as ended on an unsized video. Staff see that as the site's
    // page's own line, beside the package, not as where the job stands.
    expect(body.standing.phase).toBe("no_test");
    expect(body.standing.siteSees).toBe("Your video didn't show the job clearly enough for us to measure it.");
    expect(body.events.map((event: { text: string }) => event.text)).toContain("Simulation package built");
  });

  it("a site's job with a stored package says the package is built", async () => {
    storePackage();
    const body = await detailBody();
    expect(body.job.site).toMatchObject({ name: SITE.name });
    expect(body.standing.phrase).toMatch(/^Simulation package built/);
    expect(body.standing.phrase).not.toMatch(/Ended|video|Reading/);
    // And in the list, the same.
    const list = JSON.parse((await call("/api/admin/jobs", ADMIN)).body);
    expect(list.jobs.find((row: { requestId: string }) => row.requestId === ID).standing).toMatch(/^Simulation package built/);
  });

  it("without a package, the same job reads the outlook's phase, and no video reads as waiting for it", async () => {
    const body = await detailBody();
    expect(body.simulationPackageUrl).toBeNull();
    expect(body.standing.phrase).not.toBe("Simulation package built");
    expect(body.standing.phrase).not.toMatch(/^Reading the video/);
  });

  it("an internal test job with footage and no package reads that the video is in, from the capture record", async () => {
    markTestJob();
    // As `finishStoredCapture` records a landed upload; a test job gets no "we have your video" email notice.
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { browser_stored_upload: { completed_at_iso: "2026-11-16T18:03:00.000Z" } });
    const body = await detailBody();
    expect(body.simulationPackageUrl).toBeNull();
    expect(body.standing.phrase).not.toMatch(/Waiting for the video/);
    expect(body.events).toContainEqual({ key: "video", text: "Video received", atIso: "2026-11-16T18:03:00.000Z" });
  });
});
