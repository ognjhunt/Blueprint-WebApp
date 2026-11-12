// @vitest-environment node
/**
 * The Terms gate (planner, 19:50Z, G1 to G7), as an independent reviewer's probes T1 to T5 found it, now pinned as the
 * corrected behaviour. The rule: a company's acceptance of the Terms exists only as a signed-in act of its own. Nothing
 * an unsigned request sends can create, replace or carry one, and nothing an unsigned request sends can change a record
 * that has already been decided.
 * OFFLINE: the real routes and modules against the fake Firestore; sign-in, email delivery and the Pipeline's signed
 * reads are fakes. (The viewer gate itself, unmocked, is pinned in `robot-team-early-access.test.ts`.)
 */
import express from "express";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { currentTermsAcceptance, passedPrivacyScreen, sharedJobListing, sharedRecordingGrant } from "./helpers/sharedJob";
import { INTRODUCTION_REQUEST_STATEMENT_VERSION } from "../../client/src/lib/siteIntroductions";
import { COMPANY_RESPONSE_STATEMENT, COMPANY_RESPONSE_STATEMENT_VERSION } from "../../client/src/lib/companyResponses";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
// Fixture strings stand for encrypted fields ("encrypted:…"); a real encrypted object (an introduction's details) is
// decrypted by the real function with the test's master key.
vi.mock("../utils/field-encryption", async importOriginal => {
  const actual = await importOriginal<typeof import("../utils/field-encryption")>();
  return { ...actual, decryptFieldValue: vi.fn(async (value: unknown) => typeof value === "string" || value == null
    ? String(value ?? "").replace(/^encrypted:/, "") : actual.decryptFieldValue(value as never)) };
});
const seams = vi.hoisted(() => ({
  tokens: new Map<string, { uid: string; email: string }>(),
  sendEmail: vi.fn(async (_message: Record<string, unknown>) => ({ sent: true, provider: "resend", messageId: "accepted" })),
  sceneFiles: { splat: "", settings: "" },
}));
// The signed-in viewer: a bearer token names an account; its approval is read from the store, as the real gate does.
vi.mock("../utils/robotTeamLibraryAccess", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  const { accessRecordId } = await import("../utils/robotTeamEarlyAccess");
  const viewerFor = async (req: express.Request) => {
    const token = String(req.headers.authorization ?? "").replace(/^Bearer /, "");
    const account = seams.tokens.get(token);
    if (!account) return { access: { gated: true, status: "none", signedIn: false, emailVerified: false, allowed: false, staff: false }, viewer: null };
    const companyId = accessRecordId(account.email);
    const record = (await sharedFakeFirestore.collection("robotTeamAccess").doc(companyId).get()).data();
    // As the real gate (`resolveViewerAccess`): approved, and a deployment company, never a technology partner.
    const { companyMaySeeJobs } = await import("../utils/companyTerms");
    const deployment = record?.status === "approved" && record.partnerRole !== "technology";
    const allowed = companyMaySeeJobs(record);
    return { access: { gated: true, status: record?.status ?? "none", signedIn: true, emailVerified: true, allowed, staff: false,
      ...(deployment && !allowed ? { termsRequired: true } : {}) },
      viewer: { uid: account.uid, email: account.email, companyId, staff: false } };
  };
  return { companyViewerForRequest: viewerFor, libraryAccessForRequest: async (req: express.Request) => (await viewerFor(req)).access };
});
vi.mock("../middleware/verifyFirebaseToken", () => ({ default: (req: express.Request, res: express.Response, next: () => void) => {
  const account = seams.tokens.get(String(req.headers.authorization ?? "").replace(/^Bearer /, ""));
  res.locals.firebaseUser = account ? { uid: account.uid, email: account.email, email_verified: true } : undefined;
  next();
} }));
vi.mock("../utils/email", () => ({ sendEmail: seams.sendEmail }));
// The per-address limits would otherwise carry across tests from one test address.
vi.mock("express-rate-limit", () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../utils/siteWalkthrough", async importOriginal => ({ ...await importOriginal<typeof import("../utils/siteWalkthrough")>(),
  savedWalkthrough: vi.fn(async () => ({ received: true, uploadState: "processing_ready" })) }));
vi.mock("../utils/websiteScenePreview", async importOriginal => ({ ...await importOriginal<typeof import("../utils/websiteScenePreview")>(),
  websiteScenePreviewViewerFiles: vi.fn(async () => seams.sceneFiles) }));

const { default: worldsRouter } = await import("../routes/site-worlds");
const { default: mediaRouter } = await import("../routes/company-media");
const { default: viewsRouter } = await import("../routes/website-atlas-preview-views");
const { default: accessRouter } = await import("../routes/robot-team-access");
const { sendJobToApprovedCompanies, sweepAutomaticSends } = await import("../utils/jobAutoSend");
const { requestIntroduction } = await import("../utils/jobIntroductions");
const { loadSiteCompanyActivity } = await import("../utils/jobCompanies");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { accessRecordId } = await import("../utils/robotTeamEarlyAccess");

const ID = "req-e2";
const CAPTURE = `walkthrough-${ID}`;
const sha = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

/* ----------------------------------------------------------------- planted site records */

const SITE = { name: "ZEBRAPLANT Foods", address: "77 QUOKKA Lane, Springfield", email: "owner@site-plant.example",
  phone: "+1 415 555 0134", first: "Wilhelmina", last: "Zebraplant", country: "United States" };
/** Every identifying string of the site; none may reach a company before an introduction. */
const SITE_PLANTED = [SITE.name, "ZEBRAPLANT", "QUOKKA", SITE.email, "site-plant", "415 555", SITE.first, "Wilhelmina"];
const SENTENCE = "Stack 12 kg cartons onto the pallet, 2 shifts, 24/7. Call +1 415 555 0134 or email owner@site-plant.example, see www.site-plant.example";

function job(extra: Record<string, unknown> = {}) {
  return {
    requestId: ID,
    contact: { email: `encrypted:${SITE.email}`, firstName: `encrypted:${SITE.first}`, lastName: `encrypted:${SITE.last}`,
      company: `encrypted:${SITE.name}`, phone: SITE.phone },
    contactEmail: SITE.email, contactPhone: SITE.phone, submitterName: `${SITE.first} ${SITE.last}`,
    request: { buyerType: "site_operator", capture_mode: "self_capture", siteName: `encrypted:${SITE.name}`,
      siteLocation: `encrypted:${SITE.address}`, siteLocationMetadata: { formattedAddress: `encrypted:${SITE.address}`, country: "encrypted:US" },
      consent_attestation: sharedRecordingGrant() },
    site_address: SITE.address,
    public_task_listing: sharedJobListing("Stack cartons onto the pallet"),
    capture_privacy_screen: passedPrivacyScreen(ID),
    ...extra,
  };
}

function company(tag: string, extra: Record<string, unknown> = {}) {
  // Accepted signed in by the account the tests sign in as (`signIn`): the record carries that user's id.
  return { partnerRole: "deployment", termsAcceptance: currentTermsAcceptance(), termsAcceptedByUid: `uid-contact@${tag.toLowerCase()}.example`, name: `Person ${tag}`, email: `contact@${tag.toLowerCase()}.example`, company: `${tag} Robotics`,
    website: `https://${tag.toLowerCase()}.example`, robot: "arm", workWanted: "pick", region: null, status: "approved",
    newJobAlertsOptIn: true, appliedAtIso: "2026-11-01T00:00:00.000Z", updatedAtIso: "2026-11-01T00:00:00.000Z",
    decidedAtIso: "2026-11-02T00:00:00.000Z", decidedBy: "ops", decisionNote: null, ...extra };
}
const NORTH = company("North");
const SOUTH = company("South");
const EAST = company("East");
const WEST = company("West");
const QUIET = company("Quiet", { newJobAlertsOptIn: false });
const MUTED = company("Muted");
const TECH = company("Tech", { partnerRole: "technology" });
const PENDING = company("Pending", { status: "applied" });

const splatPath = () => seams.sceneFiles.splat;
function scenePreview() {
  const value: Record<string, unknown> = { schema_version: "website_scene_preview.v1", capture_id: CAPTURE,
    scene_revision: `sha256:${"1".repeat(64)}`, state: "ready", source_kind: "atlas_base_scene", format: "ply_3dgs_sh0",
    coordinate_frame: "right_up_back_y_up", digest: `sha256:${"2".repeat(64)}`, size_bytes: 10, gaussian_count: 2,
    source_gaussian_count: 2, start_view: null, claim_ceiling: "development_only", updated_at_epoch: 1_794_000_000 };
  return { ...value, preview_digest: crossRuntimeArtifactDigest(value, "preview_digest") };
}
const CLIP_BYTES = Buffer.from("0123456789abcdefghijklmnopqrstuvwxyz");
const ZIP_BYTES = Buffer.from("PK-ZIP-BYTES");
const ZIP_DIGEST = `sha256:${createHash("sha256").update(ZIP_BYTES).digest("hex")}`;
function companyClip() {
  const value: Record<string, unknown> = { schema_version: "website_company_clip.v1", capture_id: CAPTURE,
    clip_revision: `sha256:${"3".repeat(64)}`, state: "ready", format: "mp4_h264_faststart_video_only", content_type: "video/mp4",
    digest: `sha256:${createHash("sha256").update(CLIP_BYTES).digest("hex")}`, size_bytes: CLIP_BYTES.length, width: 1280, height: 720,
    fps: 30, duration_seconds: 4.2, has_audio: false, permission_basis: "site_sharing_statement", statement_version: "2026-11-12.v4",
    updated_at_epoch: 1_794_000_000 };
  return { ...value, clip_digest: crossRuntimeArtifactDigest(value, "clip_digest") };
}

const jobDoc = () => state.docs.get(`inboundRequests/${ID}`) as Record<string, any>;
const patchJob = (patch: Record<string, unknown>) => state.docs.set(`inboundRequests/${ID}`, { ...jobDoc(), ...patch });
const outbox = () => [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"))
  .map(([key, value]) => ({ key: key.slice("captureOutbox/".length), ...(value as Record<string, any>) }));
const expectNoSiteIn = (label: string, text: string) => {
  for (const planted of SITE_PLANTED) expect(text.toLowerCase(), `${label} contains ${planted}`).not.toContain(planted.toLowerCase());
};

/* ----------------------------------------------------------------- calls */

let server: Server;
let base = "";
const realFetch = globalThis.fetch;
const pipelineReads: Array<{ url: string; range: string | null }> = [];

function signIn(record: { email: string }) {
  const token = `token-${record.email}`;
  seams.tokens.set(token, { uid: `uid-${record.email}`, email: record.email });
  return { Authorization: `Bearer ${token}` };
}
async function page(record = NORTH) {
  const response = await realFetch(`${base}/api/site-worlds/jobs/${ID}`, { headers: signIn(record) });
  const raw = await response.text();
  return { status: response.status, raw, body: JSON.parse(raw) as Record<string, any> };
}
async function list(record = NORTH) {
  const response = await realFetch(`${base}/api/site-worlds/tasks`, { headers: signIn(record) });
  const raw = await response.text();
  return { status: response.status, raw, body: JSON.parse(raw) as Record<string, any> };
}
async function answer(record: { email: string }, body: Record<string, unknown> = {}) {
  const response = await realFetch(`${base}/api/site-worlds/tasks/${ID}/interest`, { method: "POST",
    body: JSON.stringify({ state: "interested", inputs: "We do this every day.", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION, ...body }),
    headers: { ...signIn(record), "content-type": "application/json", cookie: "csrf_token=e2-test", "x-csrf-token": "e2-test" } });
  return { status: response.status, body: await response.json() as Record<string, any> };
}
async function media(url: string, headers: Record<string, string> = {}) {
  const response = await realFetch(`${base}${url}`, { headers: { "sec-fetch-dest": "video", ...headers } });
  return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
}
const sceneContentUrl = (viewerUrl: string) => new URLSearchParams(viewerUrl.split("?")[1]).get("content")!;

beforeEach(async () => {
  state.docs.clear();
  seams.tokens.clear();
  seams.sendEmail.mockClear();
  pipelineReads.length = 0;
  vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "fixture-ticket-secret");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "https://pipeline.invalid");
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "fixture-read-token");
  const dir = mkdtempSync(path.join(tmpdir(), "company-scene-"));
  seams.sceneFiles = { splat: path.join(dir, "scene.ply"), settings: path.join(dir, "settings.json") };
  writeFileSync(seams.sceneFiles.splat, "PLYBYTES"); writeFileSync(seams.sceneFiles.settings, "{}");
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith("https://pipeline.invalid/")) return realFetch(input as never, init);
    const range = new Headers(init?.headers).get("range");
    pipelineReads.push({ url, range });
    if (url.includes("/website-company-simulations/")) {
      const zipRange = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
      if (zipRange) {
        const first = Number(zipRange[1]), last = zipRange[2] ? Number(zipRange[2]) : ZIP_BYTES.length - 1;
        if (first >= ZIP_BYTES.length) return new Response(JSON.stringify({ detail: "website_company_simulation_range_not_satisfiable" }),
          { status: 416, headers: { "content-range": `bytes */${ZIP_BYTES.length}` } });
        return new Response(ZIP_BYTES.subarray(first, last + 1), { status: 206, headers: { "content-type": "application/zip",
          "content-range": `bytes ${first}-${last}/${ZIP_BYTES.length}`, "content-length": String(last - first + 1), "x-blueprint-artifact-sha256": ZIP_DIGEST } });
      }
      return new Response(ZIP_BYTES, { status: 200, headers: { "content-type": "application/zip",
        "content-length": String(ZIP_BYTES.length), "x-blueprint-artifact-sha256": ZIP_DIGEST } });
    }
    const match = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
    if (match) {
      const first = Number(match[1]), last = match[2] ? Number(match[2]) : CLIP_BYTES.length - 1;
      return new Response(CLIP_BYTES.subarray(first, last + 1), { status: 206, headers: { "content-type": "video/mp4",
        "content-range": `bytes ${first}-${last}/${CLIP_BYTES.length}`, "content-length": String(last - first + 1),
        "x-blueprint-artifact-sha256": String(companyClip().digest) } });
    }
    return new Response(CLIP_BYTES, { status: 200, headers: { "content-type": "video/mp4", "content-length": String(CLIP_BYTES.length),
      "x-blueprint-artifact-sha256": String(companyClip().digest) } });
  }));
  state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: SENTENCE, confirmedAtIso: null });
  state.docs.set(`inboundRequests/${ID}`, job({ job_facts: { weight: "5_15kg", updatedAtIso: "2026-11-12T10:00:00.000Z" } }));
  state.docs.set(`captureUploadSessions/${CAPTURE}`, { scene_preview: scenePreview(), company_clip: companyClip() });
  for (const record of [NORTH, SOUTH, EAST, WEST, QUIET, MUTED, TECH, PENDING]) state.docs.set(`robotTeamAccess/${sha(record.email)}`, record);
  state.docs.set(`email_suppressions/${MUTED.email}`, { suppressed_scopes: ["optional_updates"] });
  const app = express();
  app.use(express.json());
  app.use("/api/site-worlds", worldsRouter);
  app.use("/api/company-media", mediaRouter);
  app.use("/api/website-atlas-preview-views", viewsRouter);
  app.use("/api/robot-team-access", accessRouter);
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

/* ----------------------------------------------------------------- the company's page */


const { companyClipUrl } = await import("../utils/websiteCompanyClip");
const { companySimulationUrl } = await import("../utils/websiteCompanySimulation");
const { websiteScenePreviewCompanyViewerUrl } = await import("../utils/websiteScenePreview");
const { companyMaySeeJobs, recordCompanyTermsAcceptance, syncCompanyTerms } = await import("../utils/companyTerms");
const { planWithdrawalCompanyNotices, withdrawalNoticeIsCurrent, withdrawalCompanyKey, WITHDRAWAL_COMPANY_KIND } =
  await import("../utils/withdrawalCompanyNotice");
const { JOB_OUTCOME_QUESTION_KIND, outcomeQuestionIsCurrent, outcomeQuestionKey } = await import("../utils/jobOutcomeGate");
const { sharedFakeFirestore } = await import("./helpers/fake-firestore");

const STALE: Array<[string, unknown, boolean]> = [
  ["no acceptance", undefined, true],
  ["an older version", { ...currentTermsAcceptance(), terms_version: "2026-11-02.1", privacy_version: "2026-11-02.1" }, true],
  ["the Terms without the Privacy Policy", { ...currentTermsAcceptance(), privacy_version: "2026-11-02.1" }, true],
  ["the Privacy Policy without the Terms", { ...currentTermsAcceptance(), terms_version: "2026-11-02.1" }, true],
  // The current versions, but not recorded by a signed-in act (no accepting user's id): the tick on the application.
  ["a current acceptance no signed-in user recorded", currentTermsAcceptance(), false],
];
const recordOf = (record: { email: string }) => state.docs.get(`robotTeamAccess/${sha(record.email)}`) as Record<string, any>;
const setTerms = (record: Record<string, unknown>, terms: unknown, keepUid = true) => {
  const next: Record<string, unknown> = { ...recordOf(record as { email: string }), termsAcceptance: terms };
  if (terms === undefined) delete next.termsAcceptance;
  if (!keepUid) delete next.termsAcceptedByUid;
  state.docs.set(`robotTeamAccess/${sha(String(record.email))}`, next);
};
async function get(url: string, headers: Record<string, string> = {}) {
  const r = await realFetch(`${base}${url}`, { headers: { "sec-fetch-dest": "empty", ...headers } });
  return { status: r.status, text: await r.text() };
}
const simPkg = () => {
  const value: Record<string, unknown> = { schema_version: "website_company_simulation.v1", capture_id: CAPTURE,
    simulation_revision: `sha256:${"4".repeat(64)}`, state: "ready", format: "zip_usd_scene_object_success_rule",
    content_type: "application/zip", digest: ZIP_DIGEST, size_bytes: ZIP_BYTES.length, files: ["scene.usda"],
    permission_basis: "site_sharing_statement", statement_version: "2026-11-12.v4", updated_at_epoch: 1_794_000_000 };
  return { ...value, simulation_digest: crossRuntimeArtifactDigest(value, "simulation_digest") };
};
const introduce = (alias: string) => requestIntroduction({ requestId: ID, alias, actor: "site",
  statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION });
const SHOWN = { termsVersion: "2026-11-12.1", privacyVersion: "2026-11-12.1" };
const apply = (body: Record<string, unknown>) => realFetch(`${base}/api/robot-team-access/apply`, { method: "POST",
  headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Mallory", company: "Mallory Corp", robot: "arm",
    workWanted: "pick", acceptedTerms: true, ...SHOWN, ...body }) }).then(async r => ({ status: r.status, body: await r.json() }));

describe("T1 every company surface refuses without a current signed-in acceptance, and says nothing of any job", () => {
  it.each(STALE)("%s", async (_label, terms, keepUid) => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simPkg() });
    await answer(NORTH);
    setTerms(NORTH, terms, keepUid);
    const north = sha(NORTH.email), auth = signIn(NORTH);
    expect(companyMaySeeJobs(recordOf(NORTH) as never)).toBe(false);
    const listing = await get("/api/site-worlds/tasks", auth);
    const card = await get(`/api/site-worlds/tasks/${ID}`, auth), cardMissing = await get("/api/site-worlds/tasks/no-such-job", auth);
    const jobPage = await get(`/api/site-worlds/jobs/${ID}`, auth), jobMissing = await get("/api/site-worlds/jobs/no-such-job", auth);
    // G5: the thumbnail answers the same 403 as every other surface, for a listed job and for one that does not exist.
    const thumb = await get(`/api/site-worlds/tasks/${ID}/thumbnail`, auth), thumbMissing = await get("/api/site-worlds/tasks/no-such-job/thumbnail", auth);
    for (const r of [listing, card, cardMissing, jobPage, jobMissing, thumb, thumbMissing]) {
      expect(r.status).toBe(403);
      expect(r.text).toContain("terms_acceptance_required");
    }
    expect(card.text).toBe(cardMissing.text);
    expect(jobPage.text).toBe(jobMissing.text);
    expect(thumb.text).toBe(thumbMissing.text);
    expect(listing.text).not.toMatch(/items|req-e2|count/);
    const video = await get(companyClipUrl(ID, CAPTURE, north)!), videoRange = await get(companyClipUrl(ID, CAPTURE, north)!, { range: "bytes=2-5" });
    const zip = await get(companySimulationUrl(ID, CAPTURE, north)!);
    const viewer = websiteScenePreviewCompanyViewerUrl(ID, CAPTURE, north)!;
    const scene = await get(new URLSearchParams(viewer.split("?")[1]).get("content")!);
    for (const r of [video, videoRange, zip, scene]) { expect(r.status).toBe(403); expect(r.text).toContain("terms_acceptance_required"); }
    expect(pipelineReads).toEqual([]);
    expect((await answer(NORTH, { state: "declined" })).status).toBe(403);
    expect(await introduce("A")).toEqual({ ok: false, reason: "company_not_approved" });
    // A media ticket for a job that is NOT listed answers the same 403: the refusal says nothing of the job.
    patchJob({ operator_listing_hold: { held: true } });
    expect((await get(companyClipUrl(ID, CAPTURE, north)!)).text).toBe(video.text);
  });
});

describe("T2 the unsigned application form cannot create, replace or carry an acceptance, or change a decided record", () => {
  it("leaves an approved company that never accepted without one, and answers exactly as for a new application", async () => {
    setTerms(NORTH, undefined, false);
    const before = recordOf(NORTH);
    expect((await page()).status).toBe(403);
    const fresh = await apply({ email: "new-company@new.example" });
    const r = await apply({ email: NORTH.email, partnerRole: "deployment" });
    expect(r).toEqual(fresh);
    expect(recordOf(NORTH)).toEqual(before);
    expect(companyMaySeeJobs(recordOf(NORTH) as never)).toBe(false);
    expect((await page()).status).toBe(403);
    expect(outbox().filter(row => row.to === NORTH.email)).toEqual([]);
  });

  it("leaves a technology partner a technology partner", async () => {
    const before = recordOf(TECH);
    const pageBefore = await page(TECH);
    expect((await apply({ email: TECH.email, partnerRole: "deployment" })).status).toBe(202);
    expect(recordOf(TECH)).toEqual(before);
    expect((await page(TECH)).status).toBe(pageBefore.status);
    expect(pageBefore.status).not.toBe(200);
  });

  it("stores what the form showed on a pending application only; it never satisfies the gate", async () => {
    expect((await apply({ email: "new-company@new.example" })).status).toBe(202);
    const record = recordOf({ email: "new-company@new.example" });
    expect(record.applicationTermsAcceptance).toMatchObject({ terms_version: "2026-11-12.1", privacy_version: "2026-11-12.1" });
    expect(record).not.toHaveProperty("termsAcceptance");
    // Even if it were approved as it stands, the application's tick would not let it see a job.
    expect(companyMaySeeJobs({ ...record, status: "approved" } as never)).toBe(false);
  });
});

describe("T3 the accept route", () => {
  const post = (record: { email: string } | null, body: unknown) => realFetch(`${base}/api/robot-team-access/accept-terms`, { method: "POST",
    headers: { ...(record ? signIn(record) : {}), "content-type": "application/json" }, body: JSON.stringify(body) })
    .then(async r => ({ status: r.status, body: await r.json() as Record<string, any> }));
  const good = { acceptedTerms: true, ...SHOWN };
  it("refuses crafted bodies and the wrong callers; records the server's versions and the accepting user", async () => {
    setTerms(NORTH, undefined, false);
    // Crafted bodies through the route; the wrong callers through the function it calls.
    expect((await post(NORTH, { ...good, termsVersion: "2026-11-02.1" })).status).toBe(400);
    expect((await post(NORTH, { ...good, extra: 1 })).status).toBe(400);
    expect((await post(null, good)).status).toBe(403);
    expect(await recordCompanyTermsAcceptance({ uid: "u-p", email: PENDING.email }, sha(PENDING.email))).toBe(false);
    expect(await recordCompanyTermsAcceptance({ uid: "u-t", email: TECH.email }, sha(TECH.email))).toBe(false);
    expect(await recordCompanyTermsAcceptance({ uid: "u-s", email: "site@elsewhere.example" }, sha("site@elsewhere.example"))).toBe(false);
    expect(await recordCompanyTermsAcceptance({ uid: "u-x", email: SOUTH.email }, sha(NORTH.email))).toBe(false);
    expect(companyMaySeeJobs(recordOf(NORTH) as never)).toBe(false);
    expect((await post(NORTH, good)).status).toBe(200);
    const rec = recordOf(NORTH);
    // The stored acceptance is the server's own record of the current versions; the body's versions were only checked.
    expect(rec.termsAcceptance).toMatchObject({ accepted_terms: true, terms_version: "2026-11-12.1", privacy_version: "2026-11-12.1",
      terms_url: "/terms", privacy_url: "/privacy" });
    expect(Object.keys(rec.termsAcceptance)).not.toContain("extra");
    expect(rec.termsAcceptedByUid).toBe(`uid-${NORTH.email}`);
    expect((await page()).status).toBe(200);
  });

  it("syncCompanyTerms copies only a current acceptance, given signed in on the same account", async () => {
    const id = sha(NORTH.email);
    setTerms(NORTH, undefined, false);
    state.docs.set("users/u-north", { termsAcceptance: { ...currentTermsAcceptance(), terms_version: "2026-11-02.1", privacy_version: "2026-11-02.1" } });
    expect(companyMaySeeJobs(await syncCompanyTerms({ uid: "u-north" }, id, recordOf(NORTH) as never) as never)).toBe(false);
    // An account acceptance carried from a site's unsigned intake form is not this company's signed-in act.
    state.docs.set("users/u-north", { termsAcceptance: currentTermsAcceptance(), termsAcceptanceSource: { kind: "site_capture_intake", requestId: "x" } });
    await syncCompanyTerms({ uid: "u-north" }, id, recordOf(NORTH) as never);
    expect(companyMaySeeJobs(recordOf(NORTH) as never)).toBe(false);
    state.docs.set("users/u-north", { termsAcceptance: currentTermsAcceptance() });
    await syncCompanyTerms({ uid: "u-north" }, id, recordOf(NORTH) as never);
    expect(recordOf(NORTH).termsAcceptedByUid).toBe("u-north");
    expect(companyMaySeeJobs(recordOf(NORTH) as never)).toBe(true);
    // A record's acceptance by one user is never copied to another user's account.
    await syncCompanyTerms({ uid: "u-other" }, id, recordOf(NORTH) as never);
    expect(state.docs.get("users/u-other")).toBeUndefined();
  });
});

describe("T4 the automatic path", () => {
  it("leaves out a company that has not accepted; it sees the job after accepting signed in; the site's count stays the number sent", async () => {
    setTerms(SOUTH, undefined, false);
    expect(await sendJobToApprovedCompanies(ID)).toMatchObject({ sent: true, count: 5 });
    expect(state.docs.has(`inboundRequests/${ID}/companySends/system-${sha(SOUTH.email)}`)).toBe(false);
    expect(outbox().some(r => r.to === SOUTH.email)).toBe(false);
    expect((await loadSiteCompanyActivity(ID)).sent?.count).toBe(5);
    expect(await recordCompanyTermsAcceptance({ uid: `uid-${SOUTH.email}`, email: SOUTH.email }, sha(SOUTH.email))).toBe(true);
    expect((await page(SOUTH)).status).toBe(200);
  });
});

/** G3: one predicate for both introduction emails, and a whole cancellation when it fails at dispatch. */
describe("an introduction that may no longer go ahead at dispatch is cancelled as a whole (G3)", () => {
  const north = () => sha(NORTH.email);
  const rows = () => ({ company: outbox().find(r => r.kind === "introduction_made_company" && r.key.endsWith(north())),
    site: outbox().find(r => r.kind === "introduction_made_site" && r.key.endsWith(north())) });

  async function expectCancelled(reason: string) {
    await deliverOutbox({ limit: 50 });
    const { company, site } = rows();
    expect(company).toMatchObject({ status: "cancelled", subject: "", body: "", replyTo: null });
    expect(site).toMatchObject({ status: "cancelled", subject: "", body: "", replyTo: null });
    // Neither side was given the other's details.
    const sentTo = seams.sendEmail.mock.calls.map(([message]) => String(message.to));
    expect(sentTo).not.toContain(NORTH.email);
    // The site may get its other job emails (a company answered); none names the company.
    for (const [message] of seams.sendEmail.mock.calls) {
      // A company's email carries nothing of the site; the site's own emails go to it and name no company.
      const { to, ...rest } = message as Record<string, unknown>;
      if (to !== SITE.email) expectNoSiteIn("an email", JSON.stringify(message));
      expect(JSON.stringify(rest)).not.toMatch(/North Robotics|contact@north|Person North|north\.example/);
    }
    const intro = state.docs.get(`inboundRequests/${ID}/introductions/${north()}`) as Record<string, any>;
    expect(intro).toMatchObject({ cancelReason: reason, siteShared: null, companyShared: null });
    expect(intro.cancelledAtIso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // The billable event is kept and marked void: never counted.
    expect(state.docs.get(`billableEvents/introduction-${ID}-${north()}`)).toMatchObject({ status: "void", voidReason: reason });
  }

  it("T4b: an acceptance that goes stale between the request and the dispatch cancels both emails; another company can still be introduced, up to three", async () => {
    await answer(NORTH); await answer(SOUTH); await answer(EAST); await answer(WEST);
    expect(await introduce("A")).toMatchObject({ ok: true });
    setTerms(NORTH, { ...currentTermsAcceptance(), terms_version: "2026-11-02.1" });
    await expectCancelled("company_not_approved");
    // The site's page shows that company's answer again, without an introduction and without any of its details.
    const activity = await loadSiteCompanyActivity(ID);
    const a = activity.entries.find(entry => entry.kind === "answered" && entry.alias === "Company A") as Record<string, any>;
    expect(a).toBeDefined();
    expect(a).not.toHaveProperty("introducedAtIso");
    expect(a).not.toHaveProperty("company");
    expect(a.canIntroduce).toBe(false);
    expect(JSON.stringify(activity)).not.toMatch(/North Robotics|contact@north|Person North/);
    expect(activity.introductions.used).toBe(0);
    // A cancelled introduction does not count toward the three.
    seams.sendEmail.mockClear();
    for (const alias of ["B", "C", "D"]) expect(await introduce(alias)).toMatchObject({ ok: true });
    expect(await introduce("A")).toEqual({ ok: false, reason: "already_introduced" });
    expect((await loadSiteCompanyActivity(ID)).introductions.used).toBe(3);
    await deliverOutbox({ limit: 50 });
    const sentTo = seams.sendEmail.mock.calls.map(([message]) => String(message.to));
    for (const record of [SOUTH, EAST, WEST]) expect(sentTo).toContain(record.email);
    const meet = seams.sendEmail.mock.calls.filter(([message]) => message.to === SITE.email && /Meet /.test(String(message.subject)));
    expect(meet).toHaveLength(3);
    const counted = [...state.docs.entries()].filter(([key, value]) => key.startsWith("billableEvents/")
      && (value as Record<string, unknown>).status === "recorded_no_price");
    expect(counted).toHaveLength(3);
  });

  it("a company suspended before the dispatch: both emails cancelled", async () => {
    await answer(NORTH);
    expect(await introduce("A")).toMatchObject({ ok: true });
    state.docs.set(`robotTeamAccess/${north()}`, { ...recordOf(NORTH), status: "declined" });
    await expectCancelled("company_not_approved");
  });

  it("a job withdrawn before the dispatch: both emails cancelled", async () => {
    await answer(NORTH);
    expect(await introduce("A")).toMatchObject({ ok: true });
    patchJob({ consent_revoked: true });
    await expectCancelled("job_withdrawn");
  });

  it("a job no longer shared (an operator hold) before the dispatch: both emails cancelled", async () => {
    await answer(NORTH);
    expect(await introduce("A")).toMatchObject({ ok: true });
    patchJob({ operator_listing_hold: { held: true } });
    await expectCancelled("job_not_shared");
  });

  it("when one email already went out, the other is still cancelled with the rest", async () => {
    await answer(NORTH);
    expect(await introduce("A")).toMatchObject({ ok: true });
    // The company's email went out first; the company is then suspended before the site's.
    const companyKey = rows().company!.key;
    state.docs.set(`captureOutbox/${companyKey}`, { ...(state.docs.get(`captureOutbox/${companyKey}`) as object), status: "sent",
      subject: "", body: "", replyTo: null });
    state.docs.set(`robotTeamAccess/${north()}`, { ...recordOf(NORTH), status: "declined" });
    await deliverOutbox({ limit: 50 });
    expect(rows().company).toMatchObject({ status: "sent" });
    expect(rows().site).toMatchObject({ status: "cancelled", subject: "", body: "", replyTo: null });
    expect(state.docs.get(`billableEvents/introduction-${ID}-${north()}`)).toMatchObject({ status: "void" });
  });
});

describe("G4 outcome questions to a company go only while it is still an approved deployment company", () => {
  it("a stale Terms acceptance does not stop them; a suspension does; the site's questions are unaffected", async () => {
    await answer(NORTH);
    expect(await introduce("A")).toMatchObject({ ok: true });
    const entry = (side: "site" | "company") => ({ kind: JOB_OUTCOME_QUESTION_KIND, requestId: ID,
      idempotencyKey: outcomeQuestionKey(ID, sha(NORTH.email), side, 14) });
    expect(await outcomeQuestionIsCurrent(entry("company"))).toBe(true);
    setTerms(NORTH, undefined, false);
    expect(await outcomeQuestionIsCurrent(entry("company"))).toBe(true);
    state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, { ...recordOf(NORTH), status: "declined" });
    expect(await outcomeQuestionIsCurrent(entry("company"))).toBe(false);
    expect(await outcomeQuestionIsCurrent(entry("site"))).toBe(true);
    state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, { ...recordOf(NORTH), status: "approved", partnerRole: "technology" });
    expect(await outcomeQuestionIsCurrent(entry("company"))).toBe(false);
  });
});

describe("T5 the withdrawal notice goes to every company the job was sent to, whatever its state", () => {
  it("reaches a company that has not accepted and one suspended since; never one the job was not sent to", async () => {
    await sendJobToApprovedCompanies(ID);
    setTerms(NORTH, undefined, false);
    state.docs.set(`robotTeamAccess/${sha(SOUTH.email)}`, { ...recordOf(SOUTH), status: "declined" });
    const planned = await sharedFakeFirestore.runTransaction(async (tx: any) => planWithdrawalCompanyNotices(tx, ID, jobDoc()));
    const to = planned.map(p => String(p.data.to)).sort();
    expect(to).toEqual([NORTH, SOUTH, EAST, WEST, QUIET, MUTED].map(record => record.email).sort());
    expect(String(planned[0].data.body)).toMatch(/^A site has withdrawn a job you were sent on [A-Z][a-z]+ \d{1,2}, \d{4}: [A-Za-z ]+\. It has left your job library\. If you saved its video or its simulation, delete your copy now\.$/);
    const notice = (record: { email: string }) => ({ kind: WITHDRAWAL_COMPANY_KIND, requestId: ID,
      idempotencyKey: withdrawalCompanyKey(ID, sha(record.email)) });
    expect(await withdrawalNoticeIsCurrent(notice(NORTH))).toBe(true);
    expect(await withdrawalNoticeIsCurrent(notice(SOUTH))).toBe(true);
    expect(await withdrawalNoticeIsCurrent(notice(TECH))).toBe(false);
    expect(await withdrawalNoticeIsCurrent(notice(PENDING))).toBe(false);
  });
});
