// @vitest-environment node
/**
 * The deployment company's side, automatic (package E, E2 to E7): the predicate, the company's page for one job, its
 * media routes, the answer, the automatic send and its emails, introductions and the billable event.
 * OFFLINE: the real routes and modules against the fake Firestore; sign-in, email delivery and the Pipeline's signed
 * reads are fakes.
 *
 * What this pins:
 * - plant-and-prove: the site's name, typed address, email, phone and submitter name never reach the library list,
 *   the job page payload, the video route, the new-job email or anything a company sees before an introduction; the
 *   introduction email reaches only the company the site chose. Contact details typed into the site's sentence are
 *   removed from what a company sees;
 * - every stop (withdrawal, operator hold, rights hold, authority end, the site closing its job, the company's
 *   approval withdrawn) closes the card, the job page, the video route, the simulation route, the answer route and
 *   `requestIntroduction`;
 * - the automatic send is idempotent and emails only an approved deployment company that asked for job emails and is
 *   not suppressed;
 * - `requestIntroduction` returns each refusal in its case, has no limit per job, and writes the introduction, the
 *   billable event and both emails in one transaction.
 */
import express from "express";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { modelPassFindsNothing } from "./helpers/freeTextScreening";
import { currentTermsAcceptance, passedPrivacyScreen, sharedJobListing, sharedRecordingGrant } from "./helpers/sharedJob";
// The fixture's site holds a name of its own and a person's, so its page shows the sentence of 2026-11-12, true for it
// (`introductionStatementVersionFor`); a job from the start form shows the current one.
import { INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION as INTRODUCTION_REQUEST_STATEMENT_VERSION } from "../../client/src/lib/siteIntroductions";
import { COMPANY_RESPONSE_STATEMENT, COMPANY_RESPONSE_STATEMENT_VERSION } from "../../client/src/lib/companyResponses";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { JOB_SUMMARY_FOOTER, NOTHING_TESTED_AT_SITE, SITE_IDENTITY_RULE, VISIT_MUST_CONFIRM } from "../../client/src/lib/companyJobPage";
import { pdfLinks, pdfPageCount, pdfText } from "./helpers/pdfText";

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
    if (!account) return { access: { status: "none", signedIn: false, emailVerified: false, allowed: false, staff: false }, viewer: null };
    const companyId = accessRecordId(account.email);
    const record = (await sharedFakeFirestore.collection("robotTeamAccess").doc(companyId).get()).data();
    // As the real gate (`resolveViewerAccess`): approved, and a deployment company, never a technology partner.
    const { companyMaySeeJobs } = await import("../utils/companyTerms");
    const deployment = record?.status === "approved" && record.partnerRole !== "technology";
    const allowed = companyMaySeeJobs(record);
    return { access: { status: record?.status ?? "none", signedIn: true, emailVerified: true, allowed, staff: false,
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
vi.mock("../utils/siteWalkthrough", async importOriginal => ({ ...await importOriginal<typeof import("../utils/siteWalkthrough")>(),
  savedWalkthrough: vi.fn(async () => ({ received: true, uploadState: "processing_ready" })) }));
vi.mock("../utils/websiteScenePreview", async importOriginal => ({ ...await importOriginal<typeof import("../utils/websiteScenePreview")>(),
  websiteScenePreviewViewerFiles: vi.fn(async () => seams.sceneFiles) }));

const { default: worldsRouter } = await import("../routes/site-worlds");
const { default: mediaRouter } = await import("../routes/company-media");
const { default: viewsRouter } = await import("../routes/website-atlas-preview-views");
const { default: accessRouter } = await import("../routes/robot-team-access");
const { default: briefRouter } = await import("../routes/site-task-brief");
const { sendJobToApprovedCompanies, sendJobToCompaniesIfListed, sweepAutomaticSends } = await import("../utils/jobAutoSend");
const { requestIntroduction } = await import("../utils/jobIntroductions");
const { loadSiteCompanyActivity } = await import("../utils/jobCompanies");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { accessRecordId } = await import("../utils/robotTeamEarlyAccess");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");

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
  return { partnerRole: "deployment", termsAcceptance: currentTermsAcceptance(), termsAcceptedByUid: `uid-contact@${tag.toLowerCase()}.example`, name: `Person ${tag}`, email: `contact@${tag.toLowerCase()}.example`, company: `${tag} Robotics`,
    website: `https://${tag.toLowerCase()}.example`, robot: "arm", workWanted: "pick", region: null, status: "approved",
    newJobAlertsOptIn: true, appliedAtIso: "2026-11-01T00:00:00.000Z", updatedAtIso: "2026-11-01T00:00:00.000Z",
    decidedAtIso: "2026-11-02T00:00:00.000Z", decidedBy: "ops", decisionNote: null, ...extra };
}
/** A company that turned job emails off in Settings: the only saved choice that stops them (owner, 2026-11-20). */
const jobEmailsOffInSettings = () => ({ newJobAlertsOptIn: false, updatePreferences: { newsletter: false, newJobAlerts: false,
  interests: {}, declaredCategories: {}, requirements: {}, source: "settings", updatedAtIso: "2026-11-03T00:00:00.000Z",
  version: "optional-updates-v2" } });
const NORTH = company("North");
const SOUTH = company("South");
const EAST = company("East");
const WEST = company("West");
const QUIET = company("Quiet", jobEmailsOffInSettings());
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
/** The package's version in its file name: the first 8 hex of its digest. */
const ZIP_VERSION = ZIP_DIGEST.slice("sha256:".length, "sha256:".length + 8);
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
/** "Download the job summary (PDF)": the page's words as a PDF, behind the page's own checks. Signed out with null. */
async function summary(record: { email: string } | null = NORTH) {
  const response = await realFetch(`${base}/api/site-worlds/jobs/${ID}/summary.pdf`, { headers: record ? signIn(record) : {} });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { status: response.status, headers: response.headers, bytes, raw: bytes.toString("latin1") };
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
  // The model pass over free text finds nothing more than the deterministic pass (the site's words still reach a company).
  modelPassFindsNothing();
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
  app.use("/api/site-task-brief", briefRouter);
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

describe("the company's page for one job (E3)", () => {
  it("counts each approved company only once and puts anonymized success criteria next to the job", async () => {
    const brief = state.docs.get(`siteTaskBriefs/${ID}`)!;
    state.docs.set(`siteTaskBriefs/${ID}`, { ...brief, successCriteria: {
      successDefinition: `Keep each carton upright at 12 cartons per minute. Questions to ${SITE.email}.`,
    } });
    expect((await list()).status).toBe(200);
    expect((await loadSiteCompanyActivity(ID)).views ?? 0).toBe(0);
    const opened = await page();
    expect(opened.body.item.successRule).toContain("12 cartons per minute");
    expectNoSiteIn("success criteria", opened.body.item.successRule);
    expect((await page()).status).toBe(200);
    expect((await page(PENDING)).status).toBe(404);
    expect((await page(SOUTH)).status).toBe(200);
    expect((await loadSiteCompanyActivity(ID)).views).toBe(2);
  });

  it("answers the current question through the private owner link and notifies only the company that asked", async () => {
    const question = "How many cartons arrive per minute?";
    expect((await answer(NORTH, { state: "needs_something", inputs: question, details: {
      verified: `Our arm can lift 12 kg. See ${NORTH.email}.`, startWindow: "within_month",
    } })).status).toBe(200);
    const activity = await loadSiteCompanyActivity(ID);
    const reply = activity.entries.find(entry => entry.kind === "answered");
    if (reply?.kind !== "answered" || !reply.question) throw new Error("No question was projected");
    expect(reply).toMatchObject({ alias: "Company A", question: { text: question }, details: { startWindow: "within_month" } });
    expect(reply.details?.verified).toContain("12 kg");
    expect(JSON.stringify(reply)).not.toContain(NORTH.email);
    const submit = async (scope: "owner" | "film", questionId = reply.question!.id) => {
      const token = createCaptureUploadToken({ requestId: ID, captureId: CAPTURE, sceneId: `site-${ID}`, scope });
      return realFetch(`${base}/api/site-task-brief/${token}/clarifications`, { method: "POST",
        headers: { "content-type": "application/json", cookie: "csrf_token=e2-test", "x-csrf-token": "e2-test" },
        body: JSON.stringify({ alias: "A", questionId, answer: `12 cartons per minute. Email ${SITE.email}.` }) });
    };
    expect((await submit("film")).status).toBe(403);
    expect((await submit("owner", "0".repeat(64))).status).toBe(409);
    expect((await submit("owner")).status).toBe(200);
    expect((await submit("owner")).status).toBe(200);
    const notice = outbox().filter(row => row.kind === "job_clarification");
    expect(notice).toHaveLength(1);
    expect(notice[0]).toMatchObject({ to: NORTH.email, status: "pending" });
    expect(notice[0].body).not.toContain("12 cartons per minute");
    const clarification = (await page()).body.item.clarification;
    expect(clarification).toMatchObject({ question, answer: expect.stringContaining("12 cartons per minute") });
    expectNoSiteIn("clarification", clarification.answer);
    expect((await page(SOUTH)).body.item.clarification).toBeUndefined();
    await deliverOutbox({ limit: 50 });
    expect(outbox().find(row => row.kind === "job_clarification")).toMatchObject({ status: "sent" });
  });

  // Owner, 2026-11-23: every job has a thumbnail, a frame of its video until the Pipeline renders its simulation.
  it("makes the job's thumbnail from its company clip, serves it to approved companies, and drops it on withdrawal", async () => {
    const thumbnail = await import("../utils/jobThumbnail");
    const { createRequire } = await import("node:module");
    const { PNG } = createRequire(import.meta.url)("pngjs") as { PNG: { sync: { write: (image: object) => Buffer } } };
    const frame = PNG.sync.write({ width: 48, height: 30, data: Buffer.alloc(48 * 30 * 4, 120) });
    const downloads: string[] = [];
    const deps = { now: () => new Date("2026-11-23T12:00:00.000Z"),
      downloadClip: async (jobId: string, clip: { digest: string }) => { downloads.push(`${jobId}:${clip.digest}`); return true; },
      extractFrame: async (_file: string, start: number) => { expect(start).toBeGreaterThanOrEqual(0); return frame; } };
    expect((await page()).body.item.thumbnailUrl).toBeNull();
    expect(await thumbnail.makeJobThumbnail(ID, deps)).toBe("made");
    expect(downloads).toEqual([`${ID}:${companyClip().digest}`]);
    const stored = state.docs.get(`taskThumbnails/${ID}`) as Record<string, any>;
    expect(stored).toMatchObject({ consentVersion: thumbnail.JOB_THUMBNAIL_VERSION, source: "company_clip_frame", clipDigest: companyClip().digest });
    expect((state.docs.get(`inboundRequests/${ID}`) as Record<string, any>).public_task_listing.thumbnailDigest).toBe(stored.digest);
    // Made once: the same clip is not read again.
    expect(await thumbnail.makeJobThumbnail(ID, deps)).toBe("current");
    expect(downloads).toHaveLength(1);
    // The page gives this company's ticketed address: a browser loads it as an image or poster with no sign-in token.
    const url = (await page()).body.item.thumbnailUrl as string;
    expect(url).toMatch(new RegExp(`^/api/site-worlds/tasks/${ID}/thumbnail\\?viewer=${sha(NORTH.email)}&expires=\\d+&signature=`));
    const served = await realFetch(`${base}${url}`);
    expect(served.status).toBe(200);
    expect(Buffer.from(await served.arrayBuffer()).toString("base64")).toBe(stored.pngBase64);
    // A forged or another company's ticket, and the bare address with no token, give nothing.
    expect((await realFetch(`${base}${url.replace(/signature=[^&]+/, "signature=forged")}`)).status).toBe(404);
    expect((await realFetch(`${base}${url.replace(sha(NORTH.email), sha(SOUTH.email))}`)).status).toBe(404);
    expect((await realFetch(`${base}/api/site-worlds/tasks/${ID}/thumbnail`)).status).toBe(404);
    // The library's card carries the same kind of address; the bearer route still works for a signed-in caller.
    const card = ((await list()).body.items as Array<Record<string, any>>).find(item => item.id === ID)!;
    expect(card.thumbnailUrl).toMatch(/thumbnail\?viewer=/);
    expect((await realFetch(`${base}/api/site-worlds/tasks/${ID}/thumbnail`, { headers: signIn(NORTH) })).status).toBe(200);
    // A company that may no longer see jobs gets nothing from a ticket it was given earlier.
    const north = state.docs.get(`robotTeamAccess/${sha(NORTH.email)}`) as Record<string, any>;
    state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, { ...north, status: "declined" });
    expect((await realFetch(`${base}${url}`)).status).toBe(404);
    state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, north);
    await thumbnail.deleteJobThumbnail(ID);
    expect(state.docs.get(`taskThumbnails/${ID}`)).toBeUndefined();
    expect((await page()).body.item.thumbnailUrl).toBeNull();
  });

  // Thumbnails step 2: a render of the job's simulation takes the place of the frame.
  it("keeps the Pipeline's render of the simulation as the thumbnail, over a frame, once, and refuses a stale or forged one", async () => {
    const thumbnail = await import("../utils/jobThumbnail");
    const { createHash } = await import("node:crypto");
    const { createRequire } = await import("node:module");
    const { PNG } = createRequire(import.meta.url)("pngjs") as { PNG: { sync: { write: (image: object) => Buffer } } };
    const sha = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    const frameDeps = { now: () => new Date(), downloadClip: async () => true,
      extractFrame: async () => PNG.sync.write({ width: 8, height: 5, data: Buffer.alloc(8 * 5 * 4, 9) }) };
    expect(await thumbnail.makeJobThumbnail(ID, frameDeps)).toBe("made");
    const render = PNG.sync.write({ width: 48, height: 27, data: Buffer.alloc(48 * 27 * 4, 200) });
    const sent = { schema_version: "website_job_thumbnail.v1" as const, capture_id: CAPTURE, source: "simulation_render" as const,
      camera: "scene_preview_start_view" as const, scene_preview_digest: scenePreview().preview_digest, width: 48, height: 27,
      png_base64: render.toString("base64"), digest: sha(render) };
    const record = (value = sent) => thumbnail.recordJobThumbnailRender(ID, `site-${ID}`, CAPTURE, value);
    expect(await record()).toEqual({ schema_version: "website_job_thumbnail_acceptance.v1", accepted: true, digest: sent.digest });
    const stored = state.docs.get(`taskThumbnails/${ID}`) as Record<string, any>;
    expect(stored).toMatchObject({ source: "simulation_render", sourceDigest: sent.digest, scenePreviewDigest: sent.scene_preview_digest });
    const listing = (state.docs.get(`inboundRequests/${ID}`) as Record<string, any>).public_task_listing;
    expect(listing).toMatchObject({ thumbnailDigest: stored.digest, thumbnailSource: "simulation_render" });
    expect((await page()).body.item).toMatchObject({ thumbnailUrl: expect.stringMatching(/thumbnail\?viewer=/), thumbnailSource: "simulation_render" });
    // The same render again is accepted once; a frame never replaces a render.
    expect(await record()).toMatchObject({ accepted: true });
    expect(await thumbnail.makeJobThumbnail(ID, frameDeps)).toBe("current");
    expect((state.docs.get(`taskThumbnails/${ID}`) as Record<string, any>).source).toBe("simulation_render");
    // Not of the current scene preview, bytes that do not match the digest, or another capture: refused.
    await expect(record({ ...sent, scene_preview_digest: `sha256:${"0".repeat(64)}` })).rejects.toThrow("website_job_thumbnail_stale");
    await expect(record({ ...sent, digest: `sha256:${"1".repeat(64)}` })).rejects.toThrow("website_job_thumbnail_digest_invalid");
    await expect(thumbnail.recordJobThumbnailRender(ID, `site-${ID}`, "walkthrough-other", sent)).rejects.toThrow("task_context_capture_mismatch");
  });

  it("passes over jobs whose thumbnail cannot be made, so later jobs are still caught up", async () => {
    const thumbnail = await import("../utils/jobThumbnail");
    const record = state.docs.get(`inboundRequests/${ID}`) as Record<string, any>;
    // Three listed jobs read before this one whose thumbnail cannot be made, and this one, which can (read last).
    state.docs.delete(`inboundRequests/${ID}`);
    for (const id of ["aaa-1", "aaa-2", "aaa-3"]) state.docs.set(`inboundRequests/${id}`, structuredClone(record));
    state.docs.set(`inboundRequests/${ID}`, record);
    let clock = Date.parse("2026-11-23T12:00:00.000Z");
    const deps = { now: () => new Date(clock), downloadClip: async () => true, extractFrame: async () => null };
    const tried: string[] = [];
    const make = async (jobId: string) => { tried.push(jobId); return jobId === ID ? "made" as const : "unavailable" as const; };
    expect(await thumbnail.sweepJobThumbnails(deps, make)).toBe(0);
    expect(tried).toEqual(["aaa-1", "aaa-2", "aaa-3"]);
    // The three that failed wait their six hours; the next pass reaches this job.
    expect(await thumbnail.sweepJobThumbnails(deps, make)).toBe(1);
    expect(tried.slice(3)).toEqual([ID]);
    // Six hours on, the failed ones are tried again.
    clock += thumbnail.JOB_THUMBNAIL_RETRY_AFTER_MS;
    await thumbnail.sweepJobThumbnails(deps, make);
    expect(tried.slice(4)).toEqual(["aaa-1", "aaa-2", "aaa-3"]);
    expect(state.docs.get(`${thumbnail.JOB_THUMBNAIL_ATTEMPTS_COLLECTION}/aaa-1`)).toMatchObject({ failedAtIso: new Date(clock).toISOString() });
  });

  it("makes no thumbnail for a job companies cannot see, and catches up listed jobs without one", async () => {
    const thumbnail = await import("../utils/jobThumbnail");
    const { createRequire } = await import("node:module");
    const { PNG } = createRequire(import.meta.url)("pngjs") as { PNG: { sync: { write: (image: object) => Buffer } } };
    const deps = { now: () => new Date(), downloadClip: async () => true,
      extractFrame: async () => PNG.sync.write({ width: 8, height: 5, data: Buffer.alloc(8 * 5 * 4, 9) }) };
    expect(await thumbnail.sweepJobThumbnails(deps)).toBe(1);
    expect(await thumbnail.sweepJobThumbnails(deps)).toBe(0);
    const record = state.docs.get(`inboundRequests/${ID}`) as Record<string, any>;
    state.docs.delete(`taskThumbnails/${ID}`);
    state.docs.set(`inboundRequests/${ID}`, { ...record, capture_rights: { ...(record.capture_rights ?? {}), consent_revoked: true },
      public_task_listing: { ...record.public_task_listing, thumbnailDigest: null } });
    expect(await thumbnail.makeJobThumbnail(ID, deps)).toBe("not_listed");
    expect(state.docs.get(`taskThumbnails/${ID}`)).toBeUndefined();
  });

  // Owner, 2026-11-23: anyone may see on /jobs that real jobs exist, but only what Blueprint derives about each.
  it("lists a shared job publicly by its kind, country, day and simulation state only", async () => {
    const { listPublicLiveJobs } = await import("../utils/taskBrowse");
    const jobs = await listPublicLiveJobs();
    expect(jobs).toEqual([{ ref: expect.stringMatching(/^l-[a-f0-9]{32}$/), kind: "Palletize cartons", kindKey: "palletizing",
      country: "United States", postedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), simulationReady: expect.any(Boolean) }]);
    const text = JSON.stringify(jobs);
    expectNoSiteIn("the public live jobs", text);
    expect(text).not.toContain(ID);
    expect(text).not.toMatch(/Stack 12 kg|pallet\. Call|\[removed\]/);
  });

  // Owner, 2026-11-23: a tap on a public live job opens it for an approved company, and asks anyone else to apply.
  it("opens a public live job's reference as the job for an approved company only, and never names the job's id", async () => {
    const { listPublicLiveJobs } = await import("../utils/taskBrowse");
    const [job] = await listPublicLiveJobs();
    const open = async (record: { email: string }) => {
      const response = await realFetch(`${base}/api/site-worlds/jobs/${job.ref}`, { headers: signIn(record) });
      return { status: response.status, body: await response.json() as Record<string, any> };
    };
    const north = await open(NORTH);
    expect(north.status).toBe(200);
    expect(north.body.item.id).toBe(ID);
    expect((await open(PENDING)).status).toBe(404);
    expect((await realFetch(`${base}/api/site-worlds/jobs/${job.ref}`)).status).toBe(404);
    // A reference no listed job has, and a job that left the list, open nothing.
    const other = await realFetch(`${base}/api/site-worlds/jobs/l-${"0".repeat(32)}`, { headers: signIn(NORTH) });
    expect(other.status).toBe(404);
    const record = state.docs.get(`inboundRequests/${ID}`) as Record<string, any>;
    state.docs.set(`inboundRequests/${ID}`, { ...record, capture_rights: { ...(record.capture_rights ?? {}), consent_revoked: true } });
    expect((await open(NORTH)).status).toBe(404);
  });

  it("names a public live job by the video reading's kind when the category says less", async () => {
    const { listPublicLiveJobs } = await import("../utils/taskBrowse");
    patchJob({ walkthrough_job_estimates: { capture_id: CAPTURE, job_estimates: { job_kind: "transport", object: "linen cart" } } });
    const [job] = await listPublicLiveJobs();
    // The reading disagrees with the keyword category, so its kind is said; never its object.
    expect(job).toMatchObject({ kind: "Moving things between places", kindKey: "transport" });
    expect(JSON.stringify(job)).not.toMatch(/linen/);
  });

  it("lists nothing publicly for a job companies cannot see", async () => {
    const { listPublicLiveJobs } = await import("../utils/taskBrowse");
    const record = state.docs.get(`inboundRequests/${ID}`) as Record<string, any>;
    state.docs.set(`inboundRequests/${ID}`, { ...record, capture_rights: { ...(record.capture_rights ?? {}), consent_revoked: true } });
    expect(await listPublicLiveJobs()).toEqual([]);
  });

  // Owner, 2026-11-23: the company reads the answers to the questions the site was asked, chosen by the reading's kind.
  it("says the answers to the questions the video reading's kind of job chose, not the keyword match's", async () => {
    state.docs.set(`inboundRequests/${ID}`, job({
      job_facts: { route: "floors", palletPattern: "fixed", weight: "5_15kg", updatedAtIso: "2026-11-12T10:00:00.000Z" },
      walkthrough_job_estimates: { capture_id: CAPTURE, job_estimates: { job_kind: "transport", object: "linen cart" } } }));
    expect((await page()).body.item.jobFacts).toEqual(["Where it goes: Between floors", "Weight: 5 to 15 kg (11 to 33 lb)"]);
  });

  // Owner, 2026-11-23 (research report "Robot deployment readiness needs"): the page leads with a title from the job's
  // facts and its answers as fields, says where each box stands, and lists what a visit must confirm for this kind of job.
  it("leads with a title from the job's facts, its answers as fields, and what a visit must confirm for its kind", async () => {
    state.docs.set(`inboundRequests/${ID}`, job({
      job_facts: { maxLoadedWeightKg: "14", hours: "two_shifts", updatedAtIso: "2026-11-12T10:00:00.000Z" },
      walkthrough_job_estimates: { capture_id: CAPTURE, job_estimates: { job_kind: "palletizing", object: "cartons" } } }));
    const item = (await page()).body.item;
    expect(item.headline).toBe("Stack cartons on pallets");
    expect(item.headlineFacts).toEqual(["Two shifts"]);
    expect(item.fitSummary.map((row: Record<string, unknown>) => [row.label, row.value, row.state])).toEqual([
      ["Object", "cartons", "from_video"],
      ["Heaviest loaded item", "14 kg", "stated"],
      ["Peak incoming rate", null, "not_stated"],
      ["Pallet pattern", null, "not_stated"],
      ["Hours a day", "Two shifts", "stated"],
      ["When", null, "not_stated"],
    ]);
    expect(item.visitMustConfirm).toEqual([...VISIT_MUST_CONFIRM.palletizing]);
    expect(item.aboutSite).toEqual([SITE_IDENTITY_RULE]);
    expect(item).not.toHaveProperty("notShown");
    // A viewer exists in this fixture, so the simulation needs no status.
    expect(item).toMatchObject({ simulationStatus: null });
    // The first look stays on the site's own pages (owner, 2026-11-25): none of it is in the company's payload.
    for (const key of ["firstLook", "firstLookRows", "firstLookMore", "firstLookStatus"]) expect(item).not.toHaveProperty(key);
  });

  it("keeps the site's name out of the title and the fit summary when the video reading echoes it", async () => {
    state.docs.set(`inboundRequests/${ID}`, job({
      walkthrough_job_estimates: { capture_id: CAPTURE, job_estimates: { job_kind: "pick_and_place", object: "ZEBRAPLANT jars" } } }));
    const { body, raw } = await page();
    // The reading's name carried the site's name, so the title keeps the category title rather than show it.
    expect(body.item.headline).toBe("Palletize cartons");
    expect(body.item.fitSummary.some((row: Record<string, unknown>) => row.key === "object")).toBe(false);
    expectNoSiteIn("the job page payload", raw);
  });

  // Owner, 2026-11-25: "At a glance" is chosen for this job by its brief, every value written by code from the record.
  it("leads with the job brief's own rows once one is written, each value from the record and never the site's name", async () => {
    const { ensureJobBrief, resetJobBriefForTests, useJobBriefWriter } = await import("../utils/jobBrief");
    state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, confirmedAtIso: null,
      summary: "Move the lamp from the round bedside table to the glass shelf on the wall." });
    patchJob({ job_facts: { hours: "two_shifts", updatedAtIso: "2026-11-25T10:00:00.000Z" },
      walkthrough_job_estimates: { capture_id: CAPTURE, job_estimates: { job_kind: "pick_and_place", object: "bedside lamp",
        object_largest_side_m: 0.45, object_mass_kg_low: 1, object_mass_kg_high: 3 } } });
    const rows = (item: Record<string, any>) => item.fitSummary.map((row: Record<string, unknown>) => [row.label, row.value, row.state]);
    // No brief yet (none can be written here): the reading's own questions for one lamp, not a flow of loads.
    expect(rows((await page()).body.item)).toEqual([["Object", "bedside lamp", "from_video"], ["Weight", null, "not_stated"],
      ["Size, longest side", null, "not_stated"], ["Times an hour", null, "not_stated"], ["Hours a day", "Two shifts", "stated"],
      ["When", null, "not_stated"]]);
    try {
      useJobBriefWriter(async () => [
        { id: "lamp_size_weight", label: "Lamp size and weight", evidence: "video_estimate",
          estimate_fields: ["object_largest_side_m", "object_mass_kg_low", "object_mass_kg_high"] },
        { id: "table_to_shelf", label: "From table to shelf", evidence: "site_sentence", quote: "from the round bedside table to the glass shelf" },
        { id: "how_often_moved", label: "How often it is moved", evidence: "ask_site", question: "How often is the lamp moved?",
          choices: ["Once a day", "A few times a day", "Once a week or less"] },
        { id: "zebra_care", label: "ZEBRAPLANT lamp care", evidence: "ask_site", question: "Is the lamp fragile?", choices: ["Yes", "No"] },
        { id: "hours", label: "Hours a day", evidence: "site_answer", answer_key: "hours" },
      ]);
      await ensureJobBrief(ID);
      // The site answers the brief's own question on its page: the second choice.
      patchJob({ job_facts: { ...jobDoc().job_facts, custom: { how_often_moved: 1 } } });
      const { body, raw } = await page();
      expect(body.item.fitSummary).toEqual([
        { key: "object", label: "Object", value: "bedside lamp", state: "from_video" },
        { key: "brief:lamp_size_weight", label: "Lamp size and weight", value: "About 45 cm on its longest side, about 1 to 3 kg",
          state: "from_video", source: "video_estimate" },
        { key: "brief:table_to_shelf", label: "From table to shelf", value: "from the round bedside table to the glass shelf",
          state: "stated", source: "site_sentence" },
        { key: "brief:how_often_moved", label: "How often it is moved", value: "A few times a day", state: "stated", source: "site" },
        { key: "hours", label: "Hours a day", value: "Two shifts", state: "stated", source: "site" },
      ]);
      expectNoSiteIn("the job page payload with a brief", raw);
    } finally {
      resetJobBriefForTests();
    }
  });

  // Owner, 2026-11-25: every "Need more details" question and "Not a fit" reason is a lesson for the next similar job.
  it("turns a Need more details question saved through the answer route into one lesson for the job's kind, never an Apply", async () => {
    const { resetJobBriefLessonsForTests, useJobBriefLessonWriter } = await import("../utils/jobBriefLessons");
    patchJob({ walkthrough_job_estimates: { capture_id: CAPTURE, job_estimates: { job_kind: "palletizing", object: "cartons" } } });
    const read: string[] = [];
    try {
      useJobBriefLessonWriter(async input => { read.push(input.words); return { lesson: { topic: "peakPerMinute", question: "ignored" } }; });
      expect((await answer(NORTH, { state: "interested", inputs: "We stack cartons every day." })).status).toBe(200);
      expect((await answer(NORTH, { state: "needs_something", inputs: `How many cartons arrive per minute at ZEBRAPLANT Foods? ${NORTH.email}` }))
        .status).toBe(200);
      await vi.waitFor(() => expect(state.docs.get("jobBriefLessons/palletizing")).toMatchObject({ questions: [
        { topic: "peakPerMinute", question: "How many items arrive per minute at the busiest time?", count: 1 }] }));
      // One run, for the question only, and the site's and the company's identity were out of what it read.
      expect(read).toHaveLength(1);
      expectNoSiteIn("the lesson lane's input", read[0]);
      expect(read[0]).not.toContain(NORTH.email);
    } finally {
      resetJobBriefLessonsForTests();
    }
  });

  // A review of PR #1437: a rule the site gave that is not shown yet is said so, never "has not said what counts as done".
  it("says the site's rule for done cannot be shown yet while its words are unread, and nothing of the kind when it gave none", async () => {
    const brief = state.docs.get(`siteTaskBriefs/${ID}`)!;
    state.docs.set(`siteTaskBriefs/${ID}`, { ...brief, successCriteria: { successDefinition: "Keep each carton upright at 12 cartons per minute." } });
    const { modelPassFails } = await import("./helpers/freeTextScreening");
    modelPassFails();
    const held = (await page()).body.item;
    expect(held).not.toHaveProperty("successRule");
    expect(held.successRulePending).toBe(true);
    state.docs.set(`siteTaskBriefs/${ID}`, brief);
    expect((await page()).body.item).not.toHaveProperty("successRulePending");
  });

  it("says how quickly the site answers companies' questions, from questions asked and answered on this job", async () => {
    expect((await answer(NORTH, { state: "needs_something", inputs: "How many cartons arrive per minute?" })).status).toBe(200);
    const ref = `inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`;
    const reply = state.docs.get(ref) as Record<string, any>;
    expect(typeof reply.questionAskedAtIso).toBe("string");
    // The same question again keeps the time it was first asked.
    expect((await answer(NORTH, { state: "needs_something", inputs: "How many cartons arrive per minute?", details: { startWindow: "within_month" } })).status).toBe(200);
    expect((state.docs.get(ref) as Record<string, any>).questionAskedAtIso).toBe(reply.questionAskedAtIso);
    const answeredAtIso = new Date(Date.parse(reply.questionAskedAtIso) + 150 * 60_000).toISOString();
    state.docs.set(ref, { ...(state.docs.get(ref) as Record<string, any>), siteClarification: { questionId: reply.questionId,
      text: "About 12.", answeredAtIso } });
    expect((await page(SOUTH)).body.item.aboutSite).toEqual([SITE_IDENTITY_RULE,
      "Answers questions from companies here, usually within 3 hours."]);
  });

  // Owner, 2026-11-23, after freight marketplaces: a pending step carries its date and one reminder, and never closes.
  it("gives a company's question a three-day reply date, reminds the site once at it, and closes the window on a reply", async () => {
    const { remindUnansweredQuestions, SITE_REPLY_WINDOWS, replyReminderIsCurrent } = await import("../utils/siteReplyReminders");
    expect((await answer(NORTH, { state: "needs_something", inputs: "How many cartons arrive per minute?" })).status).toBe(200);
    const reply = state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`) as Record<string, any>;
    const replyBy = Date.parse(reply.questionAskedAtIso) + 3 * 24 * 60 * 60 * 1000;
    const windowKey = `${SITE_REPLY_WINDOWS}/${ID}__${sha(NORTH.email)}`;
    expect(state.docs.get(windowKey)).toMatchObject({ state: "open", questionId: reply.questionId, replyByIso: new Date(replyBy).toISOString() });
    // The company and the site both read the date.
    expect((await page()).body.item.pendingQuestion).toEqual({ askedAtIso: reply.questionAskedAtIso,
      replyByIso: new Date(replyBy).toISOString(), reminded: false });
    expect((await loadSiteCompanyActivity(ID)).entries.find(entry => entry.alias === "Company A"))
      .toMatchObject({ question: { id: reply.questionId, replyByIso: new Date(replyBy).toISOString() } });
    // Before the date: nothing. At it: one reminder to the site, naming no company; never a second.
    expect(await remindUnansweredQuestions(replyBy - 1)).toBe(0);
    expect(await remindUnansweredQuestions(replyBy)).toBe(1);
    expect(await remindUnansweredQuestions(replyBy + 60_000)).toBe(0);
    const reminders = outbox().filter(row => row.kind === "site_reply_reminder");
    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({ to: SITE.email, subject: "A company is waiting for your reply" });
    expect(reminders[0].body).not.toMatch(/North|contact@/);
    expect(state.docs.get(windowKey)).toMatchObject({ state: "reminded" });
    expect((await page()).body.item.pendingQuestion).toMatchObject({ reminded: true });
    // Still true at dispatch while unanswered; once the site replies, the reminder is no longer true.
    const entry = { kind: "site_reply_reminder" as const, requestId: ID, idempotencyKey: reminders[0].key };
    const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
    const current = () => sharedFakeFirestore.runTransaction((tx: FirebaseFirestore.Transaction) => replyReminderIsCurrent(entry as never, tx));
    expect(await current()).toBe(true);
    state.docs.set(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`, { ...(state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`) as object),
      siteClarification: { questionId: reply.questionId, text: "About 12.", answeredAtIso: new Date(replyBy).toISOString() } });
    expect(await current()).toBe(false);
    expect((await page()).body.item.pendingQuestion).toBeUndefined();
  });

  // A review of PR #1437: the site's page shows a company's question only once the model pass over it has succeeded,
  // so the site is never reminded about a question it cannot read; the window stays open and a later pass reminds it.
  it("reminds the site about a question only once its page shows it", async () => {
    const { remindUnansweredQuestions, SITE_REPLY_WINDOWS } = await import("../utils/siteReplyReminders");
    const { modelPassFails } = await import("./helpers/freeTextScreening");
    const { budgetFor, screenText } = await import("../utils/freeTextScreening");
    modelPassFails();
    expect((await answer(NORTH, { state: "needs_something", inputs: "How many cartons arrive per minute?" })).status).toBe(200);
    const reply = state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`) as Record<string, any>;
    const replyBy = Date.parse(reply.questionAskedAtIso) + 3 * 24 * 60 * 60 * 1000;
    const windowKey = `${SITE_REPLY_WINDOWS}/${ID}__${sha(NORTH.email)}`;
    expect((await loadSiteCompanyActivity(ID)).entries.find(entry => entry.alias === "Company A")).not.toHaveProperty("question.text");
    expect(await remindUnansweredQuestions(replyBy)).toBe(0);
    expect(state.docs.get(windowKey)).toMatchObject({ state: "open" });
    expect(outbox().filter(row => row.kind === "site_reply_reminder")).toHaveLength(0);
    // The pass succeeds later: the page shows the question, and the next sweep reminds the site once.
    for (const key of [...state.docs.keys()]) if (key.startsWith(`inboundRequests/${ID}/freeTextScreenings/`)) state.docs.delete(key);
    modelPassFindsNothing();
    expect(await screenText(ID, "company", "How many cartons arrive per minute?", { budget: budgetFor("company", sha(NORTH.email)) }))
      .toBe("How many cartons arrive per minute?");
    expect((await loadSiteCompanyActivity(ID)).entries.find(entry => entry.alias === "Company A"))
      .toMatchObject({ question: { text: "How many cartons arrive per minute?" } });
    expect(await remindUnansweredQuestions(replyBy + 60_000)).toBe(1);
    expect(state.docs.get(windowKey)).toMatchObject({ state: "reminded" });
  });

  // Review of #1425: a new question replaces the window under the same id; a pass that read the old one leaves it open.
  it("leaves a newer question's window open when the sweep read the one it replaced", async () => {
    const { remindUnansweredQuestions, SITE_REPLY_WINDOWS } = await import("../utils/siteReplyReminders");
    expect((await answer(NORTH, { state: "needs_something", inputs: "How many cartons arrive per minute?" })).status).toBe(200);
    const key = `${SITE_REPLY_WINDOWS}/${ID}__${sha(NORTH.email)}`;
    const first = state.docs.get(key) as Record<string, any>;
    const due = Date.parse(first.replyByIso);
    // The sweep reads the first window; before its transaction, the company asks a new question.
    const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
    const realRun = sharedFakeFirestore.runTransaction.bind(sharedFakeFirestore);
    let swapped = false;
    const spy = vi.spyOn(sharedFakeFirestore, "runTransaction").mockImplementation(async (fn: never) => {
      if (!swapped) {
        swapped = true;
        expect((await answer(NORTH, { state: "needs_something", inputs: "What height is the pallet?" })).status).toBe(200);
      }
      return realRun(fn);
    });
    expect(await remindUnansweredQuestions(due)).toBe(0);
    spy.mockRestore();
    const replaced = state.docs.get(key) as Record<string, any>;
    expect(replaced.questionId).not.toBe(first.questionId);
    expect(replaced.state).toBe("open");
    expect(outbox().filter(row => row.kind === "site_reply_reminder")).toHaveLength(0);
  });

  // Owner, 2026-11-23 ("yes build it this way"): an application at a glance, with an optional estimate before a visit.
  it("shows the site an application's charging, estimate, similar jobs and visit note, and never in an email", async () => {
    const glance = { chargeModel: "subscription", estimate: { lowUsd: 12000, highUsd: 18000 }, similarJobs: "6_20",
      visitMustConfirm: `Conveyor height at the end of the line. Call ${NORTH.email}.`, startWindow: "within_month" };
    expect((await answer(NORTH, { state: "interested", details: glance })).status).toBe(200);
    await deliverOutbox({ limit: 50 });
    const entry = (await loadSiteCompanyActivity(ID)).entries.find(row => row.alias === "Company A");
    expect(entry).toMatchObject({ details: { chargeModel: "subscription", estimate: { lowUsd: 12000, highUsd: 18000 },
      similarJobs: "6_20", startWindow: "within_month" } });
    // The company's words lose its contact details, as its reason does.
    expect(entry?.kind === "answered" && entry.details?.visitMustConfirm).toMatch(/^Conveyor height at the end of the line\. Call \[removed\]\.$/);
    // No email to the site carries the estimate or the way of charging.
    for (const row of outbox()) expect(`${row.subject} ${row.body}`).not.toMatch(/\$|12,000|subscription/i);
    // Under the earlier line the company never agreed the site sees an estimate: it is left out, the rest stays.
    const ref = `inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`;
    state.docs.set(ref, { ...(state.docs.get(ref) as Record<string, any>), statementVersion: "company-response-2026-11-23" });
    const older = (await loadSiteCompanyActivity(ID)).entries.find(row => row.alias === "Company A");
    expect(older?.kind === "answered" && older.details?.estimate).toBeFalsy();
    expect(older).toMatchObject({ details: { chargeModel: "subscription", similarJobs: "6_20" } });
  });

  it("keeps the application's fields only with an application, and refuses an estimate it cannot read", async () => {
    const glance = { chargeModel: "per_hour", estimate: { lowUsd: 30, highUsd: 45 }, similarJobs: "1_5" };
    expect((await answer(NORTH, { state: "needs_something", inputs: "How tall is the pallet?", details: glance })).status).toBe(200);
    const stored = state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`) as Record<string, any>;
    expect(stored.details ?? {}).not.toHaveProperty("estimate");
    expect(stored.details ?? {}).not.toHaveProperty("chargeModel");
    for (const details of [{ estimate: { lowUsd: 30, highUsd: 45 } }, { chargeModel: "undecided", estimate: { lowUsd: 30, highUsd: 45 } },
      { chargeModel: "per_hour", estimate: { lowUsd: 45, highUsd: 30 } }, { chargeModel: "per_hour", estimate: { lowUsd: 0.005, highUsd: 30 } },
      { chargeModel: "per_hour", estimate: { lowUsd: 0, highUsd: 30 } }, { chargeModel: "per_hour", estimate: { lowUsd: 30, highUsd: 100_000_001 } }])
      expect((await answer(SOUTH, { state: "interested", details })).status).toBe(400);
  });

  // Stress test, 2026-11-24: an estimate under $1, or with cents, could not be given.
  it("takes an estimate in dollars and cents, at most two decimals, and shows it to the site with its cents", async () => {
    const details = { chargeModel: "per_task", estimate: { lowUsd: 0.35, highUsd: 0.5 } };
    expect((await answer(NORTH, { state: "interested", details })).status).toBe(200);
    const stored = state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`) as Record<string, any>;
    expect(stored.details).toMatchObject(details);
    const entry = (await loadSiteCompanyActivity(ID)).entries.find(row => row.alias === "Company A");
    expect(entry).toMatchObject({ details });
    expect((await answer(NORTH, { state: "interested", details: { chargeModel: "per_hour", estimate: { lowUsd: 45, highUsd: 60.25 } } })).status).toBe(200);
  });

  // Stress test, 2026-11-24: every refusal was said as "keep your note under 2,000 characters", whatever failed.
  it("names the field that failed when it refuses an answer's details", async () => {
    const refusal = async (body: Record<string, unknown>) => (await answer(SOUTH, body)).body.error as string;
    expect(await refusal({ state: "interested", details: { question: "Hi?" } })).toBe("Write your question for the site in 4 to 400 characters.");
    expect(await refusal({ state: "interested", details: { visitMustConfirm: "x".repeat(301) } }))
      .toBe("Keep what a visit must confirm to 300 characters or fewer.");
    expect(await refusal({ state: "interested", details: { chargeModel: "per_hour", estimate: { lowUsd: 45, highUsd: 30 } } }))
      .toMatch(/^Enter the estimate in US dollars/);
    // Stress test round 2 (2026-11-24): over the way of charging's ceiling, or digits that read as a phone number; and the
    // refusal names its field for the form to mark and focus.
    for (const estimate of [{ lowUsd: 45, highUsd: 20_000 }, { lowUsd: 41_555_501.99, highUsd: 41_555_501.99 }]) {
      const refused = await answer(SOUTH, { state: "interested", details: { chargeModel: "per_hour", estimate } });
      expect(refused.status).toBe(400);
      expect(refused.body).toMatchObject({ field: "estimate", error: expect.stringMatching(/^Enter the estimate in US dollars/) });
    }
    expect((await answer(SOUTH, { state: "interested", details: { visitMustConfirm: "x".repeat(301) } })).body.field).toBe("visitMustConfirm");
    expect((await answer(SOUTH, { state: "interested", inputs: "x".repeat(2001) })).body.field).toBe("inputs");
    expect(await refusal({ state: "interested", details: { chargeModel: "undecided", estimate: { lowUsd: 5, highUsd: 9 } } }))
      .toMatch(/^An estimate needs a way of charging/);
    expect(await refusal({ state: "interested", details: { chargeModel: "barter" } })).toBe("Choose how you charge from the list.");
    expect(await refusal({ state: "interested", details: { startWindow: "someday" } })).toBe("Choose the earliest start from the list.");
    expect(await refusal({ state: "interested", details: { similarJobs: "lots" } })).toBe("Choose how many similar jobs you have done from the list.");
    expect(await refusal({ state: "interested", inputs: "x".repeat(2001) })).toBe("Keep your note to 2,000 characters or fewer.");
    expect(await refusal({ state: "maybe" })).toBe("Choose a response.");
    expect(await refusal({ state: "interested", statementVersion: "company-response-2026-11-12" }))
      .toBe("The wording on this page has changed. Reload the page, read it, then send your response again.");
    expect(await refusal({ state: "interested", details: { nickname: "x" } })).toBe("Your response could not be read. Reload the page and send it again.");
  });

  it("closes a reply window with no email when the question was answered or changed first", async () => {
    const { remindUnansweredQuestions, SITE_REPLY_WINDOWS } = await import("../utils/siteReplyReminders");
    expect((await answer(NORTH, { state: "needs_something", inputs: "How many cartons arrive per minute?" })).status).toBe(200);
    const asked = Date.parse((state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`) as Record<string, any>).questionAskedAtIso);
    // The company applies instead: no question is open any more.
    expect((await answer(NORTH, { state: "interested", inputs: "We do this every day." })).status).toBe(200);
    expect(await remindUnansweredQuestions(asked + 4 * 24 * 60 * 60 * 1000)).toBe(0);
    expect(state.docs.get(`${SITE_REPLY_WINDOWS}/${ID}__${sha(NORTH.email)}`)).toMatchObject({ state: "closed" });
    expect(outbox().filter(row => row.kind === "site_reply_reminder")).toHaveLength(0);
  });

  it("shows the site's sentence with contact details removed, its answers in words, the country, the media and the form line", async () => {
    const { status, body, raw } = await page();
    expect(status).toBe(200);
    const item = body.item;
    expect(item).toMatchObject({ schemaVersion: "company_job_page.v1", id: ID, title: "Carton palletizing opportunity", country: "United States",
      jobFacts: [expect.stringMatching(/5 to 15 kg/)], simulation: { state: "ready" },
      video: { state: "ready", width: 1280, height: 720 }, responseStatement: { version: COMPANY_RESPONSE_STATEMENT_VERSION, text: COMPANY_RESPONSE_STATEMENT } });
    expect(item.sentence).toBe("Stack 12 kg cartons onto the pallet, 2 shifts, 24/7. Call [removed] or email [removed], see [removed]");
    expectNoSiteIn("the job page payload", raw);
    expect(raw).not.toMatch(/walkthrough\.|raw\/|scenes\/site-|pipeline\.invalid/);
  });

  // Plant-and-prove, with the sentence as one of the planted places: the site's own name, typed address, contact name,
  // submitter name, email and phone, each in another case or spacing, and a street address we do not hold.
  it("removes the site's own identity and street addresses from the sentence before any company sees it", async () => {
    state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, confirmedAtIso: null, summary:
      "Stack cartons at ZEBRAPLANT Foods, 77 QUOKKA Lane, Springfield. wilhelmina   ZEBRAPLANT runs it; ask WILHELMINA. "
      + "Cartons also come from 12 Mill Road, Unit 4. Mail OWNER@SITE-PLANT.EXAMPLE or call +1 (415) 555-0134. "
      + "We stack 12 cartons on 3 pallets in aisle 4 at station 2." });
    const { raw, body } = await page();
    expect(body.item.sentence).toBe("Stack cartons at the site. The site runs it; ask the site. Cartons also come. "
      + "Mail [removed] or call [removed]. We stack 12 cartons on 3 pallets in aisle 4 at station 2.");
    expectNoSiteIn("the job page payload", raw);
    for (const planted of ["77", "Mill Road", "Springfield", "springfield"]) expect(body.item.sentence).not.toContain(planted);
    expect((await list()).raw).not.toMatch(/ZEBRAPLANT|QUOKKA|Wilhelmina|Springfield|Mill Road/i);
  });

  // Core-journey audit, 2026-11-20: the start form asks for no site or person name, so a name typed into the sentence
  // is one the record does not hold; it still never reaches a company before an introduction.
  it.each([
    ["At Joe's Diner, move the trays from the dish pit to the rack.", "At [removed], move the trays from the dish pit to the rack."],
    ["Acme Fulfillment needs cartons moved from the conveyor to a pallet.", "[removed] needs cartons moved from the conveyor to a pallet."],
    ["Joe Smith at Smith Bakery wants bread trays stacked on the cart.", "[removed] at [removed] wants bread trays stacked on the cart."],
  ])("removes a business or person name the record does not hold from the sentence: %s", async (summary, expected) => {
    state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, confirmedAtIso: null, summary });
    const { body, raw } = await page();
    expect(body.item.sentence).toBe(expected);
    expect(raw).not.toMatch(/Joe|Diner|Acme|Fulfillment|Smith|Bakery/);
  });

  it("makes the job visible with playable video while the simulation is being built", async () => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, {});
    expect((await page()).status).toBe(404);
    expect((await list()).body.items).toEqual([]);
    expect(await sendJobToApprovedCompanies(ID)).toMatchObject({ sent: false });
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { company_clip: companyClip() });
    const { body } = await page();
    expect(body.item.video).toMatchObject({ state: "ready" });
    expect(body.item.simulationDownload).toEqual({ state: "not_finished" });
    expect(await sendJobToApprovedCompanies(ID)).toMatchObject({ sent: true });
  });

  it("accepts a quick fit response and requires details for other responses", async () => {
    expect((await answer(NORTH, { inputs: "" })).status).toBe(200);
    expect((await answer(SOUTH, { state: "declined", inputs: "" })).status).toBe(200);
    expect((await answer(NORTH, { state: "needs_something", inputs: " " })).status).toBe(400);
    expect((await answer(NORTH, { state: "tested_can_do", inputs: "" })).status).toBe(400);
    expect((await page()).body.item.myAnswer).toMatchObject({ state: "interested", inputs: "" });
  });

  it("keeps a legacy description-only listing out of the library and closed to responses", async () => {
    patchJob({ request: { ...jobDoc().request, consent_attestation: null,
      description_authority: { granted: true, statement_version: "2026-11-12.v5", recorded_at_iso: "2026-11-12T10:00:00.000Z" } },
      public_task_listing: { ...jobDoc().public_task_listing, approvedBy: "description_statement",
        descriptionStatementVersion: "2026-11-12.v5" } });
    state.docs.delete(`captureUploadSessions/${CAPTURE}`);
    expect((await page()).status).toBe(404);
    expect((await list()).body.items).toEqual([]);
    expect((await answer(NORTH)).status).toBe(409);
    expect(await sendJobToApprovedCompanies(ID)).toMatchObject({ sent: false });
    expect(outbox()).toEqual([]);
  });

  it("is for a signed-in, approved account only", async () => {
    expect((await realFetch(`${base}/api/site-worlds/jobs/${ID}`)).status).toBe(404);
    expect((await page(PENDING)).status).toBe(404);
    // The job summary too: the page's own checks, so no PDF for anyone the page refuses.
    for (const refused of [await summary(null), await summary(PENDING)]) {
      expect(refused.status).toBe(404);
      expect(refused.headers.get("content-type")).toMatch(/^application\/json/);
      expect(refused.raw).not.toMatch(/%PDF|Carton|Stack/);
    }
  });

  it("streams the clip through the website with a viewer-bound ticket and range requests, never the Pipeline's address", async () => {
    const url = (await page()).body.item.video.url as string;
    expect(url).toMatch(new RegExp(`^/api/company-media/jobs/${ID}/video\\.mp4\\?`));
    const whole = await media(url);
    expect(whole.status).toBe(200);
    expect(whole.bytes.equals(CLIP_BYTES)).toBe(true);
    expect(whole.headers.get("cache-control")).toBe("private, no-store");
    const part = await media(url, { range: "bytes=2-5" });
    expect(part.status).toBe(206);
    expect(part.bytes.toString()).toBe("2345");
    expect(part.headers.get("content-range")).toBe(`bytes 2-5/${CLIP_BYTES.length}`);
    expect(pipelineReads.map(read => read.range)).toEqual([null, "bytes=2-5"]);
    expect(pipelineReads.every(read => read.url.includes(`/website-company-clips/${CAPTURE}/clip.mp4`))).toBe(true);
    // A ticket is bound to its viewer: another company cannot use it.
    expect((await media(url.replace(/viewer=[a-f0-9]+/, `viewer=${sha(SOUTH.email)}`))).status).toBe(404);
    // A browser's request to open it as a page is refused (it only discourages saving; the ticket itself is a 15-minute
    // signed URL bound to the job, the capture and the viewer).
    expect((await media(url, { "sec-fetch-dest": "document" })).status).toBe(403);
    expectNoSiteIn("the video route", whole.headers.get("content-disposition") ?? "");
  });

  it("serves the simulation preview to the company with its own ticket", async () => {
    const content = sceneContentUrl((await page()).body.item.simulation.viewerUrl);
    expect(content).toContain(`viewer=${sha(NORTH.email)}`);
    const read = await media(content, { "sec-fetch-dest": "empty" });
    expect(read.status).toBe(200);
    expect(read.bytes.toString()).toBe("PLYBYTES");
    expect(splatPath()).toBeTruthy();
  });

  it("records the answer with the line the company saw, and refuses one without it", async () => {
    expect((await answer(NORTH, { statementVersion: undefined })).status).toBe(400);
    expect((await answer(NORTH)).status).toBe(200);
    const responsePath = `inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`;
    const firstResponse = state.docs.get(responsePath);
    expect(firstResponse)
      .toMatchObject({ state: "interested", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION, recordedBy: "company" });
    expect(firstResponse?.firstAnsweredAtIso).toBe(firstResponse?.updatedAtIso);
    // When it first applied, for the owner's marketplace numbers (`marketplaceNumbers.ts`).
    expect(firstResponse?.firstAppliedAtIso).toBe(firstResponse?.updatedAtIso);
    expect((await page()).body.item.myAnswer).toMatchObject({ state: "interested", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION });
    // The site is queued one email by alias and fixed label only; no person at Blueprint is rung.
    const queued = outbox();
    expect(queued.map(row => row.key)).toEqual([`${ID}:company_answered:A-interested`]);
    expect(queued[0]).toMatchObject({ to: SITE.email, subject: "A deployment company answered" });
    expect(JSON.stringify(queued)).not.toMatch(/North|contact@north|We do this every day/);
    expect((await answer(NORTH, { state: "needs_something" })).status).toBe(200);
    expect(state.docs.get(responsePath)).toMatchObject({ state: "needs_something", firstAnsweredAtIso: firstResponse?.firstAnsweredAtIso,
      firstAppliedAtIso: firstResponse?.firstAppliedAtIso });
  });

  it("lists the job in the library with its page link and nothing that names the site", async () => {
    const { body, raw } = await list();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: ID, jobUrl: `/jobs/${ID}`, region: "United States" });
    expectNoSiteIn("the library list", raw);
  });

  it("is not listed without the site's sentence, or under an older statement", async () => {
    state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: "Your site task", confirmedAtIso: null });
    expect((await page()).status).toBe(404);
    state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: SENTENCE, confirmedAtIso: null });
    // A held upload-time privacy record from before 2026-09-24 no longer keeps the job from companies.
    patchJob({ capture_privacy_screen: { ...passedPrivacyScreen(ID), proceeded: false, eligibility: "pending" } });
    expect((await page()).status).toBe(200);
    patchJob({ capture_privacy_screen: passedPrivacyScreen(ID),
      request: { ...jobDoc().request, consent_attestation: { ...sharedRecordingGrant(), statement_version: "2026-11-11.v3" } } });
    expect((await page()).status).toBe(404);
    expect((await list()).body.items).toEqual([]);
  });
});

/* ----------------------------------------------------------------- the stops */

const STOPS: Array<[string, () => void]> = [
  ["the site's withdrawal", () => patchJob({ consent_revoked: true, request: { ...jobDoc().request,
    consent_attestation: { ...sharedRecordingGrant(), granted: false, revoked_at_iso: "2026-11-12T12:00:00.000Z" } } })],
  ["Blueprint's operator hold", () => patchJob({ operator_listing_hold: { held: true, atIso: "2026-11-12T12:00:00.000Z", by: "ops" } })],
  ["a rights hold", () => patchJob({ evaluation_readiness: { rights_review_status: "blocked" } })],
  ["an authority end for a revoked source", () => { patchJob({ request: { ...jobDoc().request,
    consent_attestation: { ...sharedRecordingGrant(), granted: false } } }); state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`),
    website_preparation: { selector: { request_id: ID, capture_id: CAPTURE }, status: { state: "authority_ended" } } }); }],
  ["the site closing its job", () => patchJob({ website_run_closures: { [CAPTURE]: { closed_at_iso: "2026-11-12T12:00:00.000Z" } } })],
  ["the company's approval withdrawn", () => state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, { ...NORTH, status: "declined" })],
];

describe("every stop closes everything a company can see (E2)", () => {
  it.each(STOPS)("%s closes the card, the page, both media routes, the answer route and introductions", async (_name, stop) => {
    const before = (await page()).body.item;
    expect((await answer(NORTH)).status).toBe(200);
    expect((await summary()).status).toBe(200);
    stop();
    expect((await page()).status).toBe(404);
    expect((await summary()).status).toBe(404);
    expect((await list()).body.items).toEqual([]);
    expect((await media(before.video.url)).status).toBe(404);
    expect((await media(sceneContentUrl(before.simulation.viewerUrl), { "sec-fetch-dest": "empty" })).status).toBe(404);
    expect((await answer(NORTH, { state: "declined" })).status).not.toBe(200);
    const result = await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail: () => ({ subject: "s", body: "b" }) });
    expect(result.ok).toBe(false);
    expect(state.docs.has(`inboundRequests/${ID}/introductions/${sha(NORTH.email)}`)).toBe(false);
  });
});

// A withdrawal the Pipeline has not acknowledged and whose deletion has not run yet (the website's deletion waits at
// least 35 minutes, and up to 2 hours for the acknowledgement): the clip, the simulation package, the scene preview and
// the thumbnail are all still stored, and none of them is served to a company.
describe("a recorded withdrawal closes everything a company can see while its deletion is pending", () => {
  it("refuses the page, the card, the video, the download, the viewer and the thumbnail, though all are still stored", async () => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    const thumbnail = await import("../utils/jobThumbnail");
    const { createRequire } = await import("node:module");
    const { PNG } = createRequire(import.meta.url)("pngjs") as { PNG: { sync: { write: (image: object) => Buffer } } };
    expect(await thumbnail.makeJobThumbnail(ID, { now: () => new Date(), downloadClip: async () => true,
      extractFrame: async () => PNG.sync.write({ width: 8, height: 5, data: Buffer.alloc(8 * 5 * 4, 9) }) })).toBe("made");
    const before = (await page()).body.item;
    // Every address a company was handed before the withdrawal works until then.
    const addresses: Array<[string, string, Record<string, string>]> = [
      ["the video", before.video.url, {}],
      ["the simulation download", before.simulationDownload.url, {}],
      ["the viewer", sceneContentUrl(before.simulation.viewerUrl), { "sec-fetch-dest": "empty" }],
      ["the thumbnail", before.thumbnailUrl, { "sec-fetch-dest": "image" }],
    ];
    for (const [name, url, headers] of addresses) expect((await media(url, headers)).status, name).toBe(200);

    // The site presses "Stop using my video": the real withdrawal, with no Pipeline acknowledgement.
    const { recordWebsiteCaptureWithdrawal } = await import("../utils/websiteCaptureWithdrawal");
    const { created } = await recordWebsiteCaptureWithdrawal({ requestId: ID, requestedBy: "owner_link", authorize: () => undefined });
    expect(created).toBe(true);
    expect(jobDoc().capture_withdrawal).toMatchObject({ state: "uploads_stopped_cleanup_pending", pipelineAcknowledged: false,
      webappDeletion: { phase: "pending", attempts: 0 } });
    // Nothing has been deleted yet.
    const session = state.docs.get(`captureUploadSessions/${CAPTURE}`) as Record<string, unknown>;
    expect(session.company_clip).toBeTruthy();
    expect(session.company_simulation).toBeTruthy();
    expect(session.scene_preview).toBeTruthy();
    expect(state.docs.get(`taskThumbnails/${ID}`)).toBeTruthy();

    expect((await page()).status).toBe(404);
    expect((await summary()).status).toBe(404);
    expect((await list()).body.items).toEqual([]);
    for (const [name, url, headers] of addresses) expect((await media(url, headers)).status, name).toBe(404);
    expect((await realFetch(`${base}/api/site-worlds/tasks/${ID}/thumbnail`, { headers: signIn(NORTH) })).status).toBe(404);
  });
});

describe("Blueprint's own work window ending is not a stop (G-01)", () => {
  it("keeps the job's page and its answer route open when the window ends its authority", async () => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`),
      website_preparation: { selector: { request_id: ID, capture_id: CAPTURE }, status: { state: "authority_ended" } } });
    expect((await page()).status).toBe(200);
    expect((await answer(NORTH)).status).toBe(200);
  });
});

/* ----------------------------------------------------------------- an internal test job (W2) */

/** The marker the internal test-job route writes (`internalTestJob.ts`). */
const INTERNAL_TEST = { label: "rigid pick", footage_id: "pexels-854533", created_by: "pipeline_sync_signature",
  created_at_iso: "2026-11-15T12:00:00.000Z" };
const markTestJob = () => patchJob({ internal_test: INTERNAL_TEST });

describe("an internal test job is closed on every company surface, though everything else would list it (W2)", () => {
  type Page = Record<string, any>;
  /** Each company read, as a company makes it: true when it serves the job. */
  const SURFACES: Array<[string, (item: Page) => Promise<boolean>]> = [
    ["the predicate", async () => (await (await import("../utils/teamJobAccess")).loadCompanyJobAccess(ID)).access.listed],
    ["the library", async () => (await list()).body.items.length > 0],
    ["the card", async () => (await realFetch(`${base}/api/site-worlds/tasks/${ID}`, { headers: signIn(NORTH) })).status === 200],
    ["the job page", async () => (await page()).status === 200],
    ["the video", async item => (await media(item.video.url)).status === 200],
    ["the scene view", async item => (await media(sceneContentUrl(item.simulation.viewerUrl), { "sec-fetch-dest": "empty" })).status === 200],
    ["the simulation zip", async item => (await media(item.simulationDownload.url)).status === 200],
    ["the job summary", async () => (await summary()).status === 200],
  ];
  it.each(SURFACES)("%s serves the listed job, and refuses it once it is a test job", async (_name, serves) => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    // Fully listed: the v4 grant, the listing record, the site's sentence.
    const item = (await page()).body.item as Page;
    expect(await serves(item)).toBe(true);
    markTestJob();
    expect(await serves(item)).toBe(false);
  });

  it("the answer route refuses a company's answer, and the predicate names its own reason", async () => {
    markTestJob();
    expect((await answer(NORTH)).status).not.toBe(200);
    expect(state.docs.has(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`)).toBe(false);
    const { loadCompanyJobAccess } = await import("../utils/teamJobAccess");
    expect((await loadCompanyJobAccess(ID)).access).toEqual({ listed: false, evaluationAvailable: false, reason: "internal_test_job", details: null });
  });

  it("introductions: no new one, and the gate stops the emails of one already queued", async () => {
    await interested(NORTH, SOUTH);
    expect(await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })).toMatchObject({ ok: true });
    const queued = outbox().filter(row => row.kind === "introduction_made_company");
    expect(queued).toHaveLength(1);
    markTestJob();
    expect(await requestIntroduction({ requestId: ID, alias: "B", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })).toMatchObject({ ok: false });
    expect(state.docs.has(`inboundRequests/${ID}/introductions/${sha(SOUTH.email)}`)).toBe(false);
    const { introductionEmailCheck, introductionMayProceed } = await import("../utils/jobIntroductionGate");
    expect(await introductionMayProceed(ID, sha(NORTH.email))).toMatchObject({ ok: false, reason: "job_not_shared" });
    expect((await introductionEmailCheck({ kind: queued[0].kind, requestId: ID, idempotencyKey: queued[0].key })).current).toBe(false);
  });

  it("the automatic send and the new-job emails: none sent for it, and one queued before is not current", async () => {
    markTestJob();
    expect(await sendJobToApprovedCompanies(ID)).toMatchObject({ sent: false });
    expect(await sweepAutomaticSends()).toMatchObject({ sent: 0 });
    expect(outbox()).toEqual([]);
    expect([...state.docs.keys()].filter(key => key.startsWith(`inboundRequests/${ID}/companySends/`))).toEqual([]);
    // A new-job email queued while the job was listed is not current once it is a test job (its dispatch check).
    patchJob({ internal_test: undefined });
    await sendJobToApprovedCompanies(ID);
    const alerts = outbox().filter(row => row.kind === "robot_team_new_task");
    expect(alerts.length).toBeGreaterThan(0);
    markTestJob();
    const { jobAlertIsCurrent } = await import("../utils/newJobAlerts");
    const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
    for (const row of alerts) expect(await sharedFakeFirestore.runTransaction(tx => jobAlertIsCurrent(row as never, tx as never))).toBe(false);
  });

  it("the follow-up outcome questions: none for it", async () => {
    await interested(NORTH);
    expect(await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })).toMatchObject({ ok: true });
    const { jobTakesOutcomeQuestions, outcomeQuestionIsCurrent, outcomeQuestionKey, JOB_OUTCOME_QUESTION_KIND } = await import("../utils/jobOutcomeGate");
    // The day-14 question to the site, as the sweep queues it and the outbox checks it before sending.
    const question = { kind: JOB_OUTCOME_QUESTION_KIND, requestId: ID, idempotencyKey: outcomeQuestionKey(ID, sha(NORTH.email), "site", 14) };
    expect(await jobTakesOutcomeQuestions(ID, jobDoc())).toBe(true);
    expect(await outcomeQuestionIsCurrent(question)).toBe(true);
    markTestJob();
    expect(await jobTakesOutcomeQuestions(ID, jobDoc())).toBe(false);
    expect(await outcomeQuestionIsCurrent(question)).toBe(false);
  });
});

/* ----------------------------------------------------------------- the automatic send */

describe("the automatic send (E4)", () => {
  it("does not queue messages from a pull request preview", async () => {
    vi.stubEnv("IS_PULL_REQUEST", "true");
    expect(await sendJobToCompaniesIfListed(ID)).toBeNull();
    expect(outbox()).toHaveLength(0);
  });

  it("records one system send per approved deployment company and emails all but those that turned job emails off or are suppressed", async () => {
    const result = await sendJobToApprovedCompanies(ID);
    const deployment = [NORTH, SOUTH, EAST, WEST, QUIET, MUTED];
    expect(result).toMatchObject({ sent: true, count: deployment.length, emailed: 4 });
    const sends = [...state.docs.entries()].filter(([key]) => key.startsWith(`inboundRequests/${ID}/companySends/`));
    expect(sends.map(([, value]) => (value as any).companyId).sort()).toEqual(deployment.map(record => sha(record.email)).sort());
    expect(sends.every(([key, value]) => (value as any).sentBy === "system" && key.endsWith(`system-${(value as any).companyId}`))).toBe(true);
    const alerts = outbox().filter(row => row.kind === "robot_team_new_task");
    expect(alerts.map(row => row.to).sort()).toEqual([NORTH, SOUTH, EAST, WEST].map(record => record.email).sort());
    // The kind of job and the country, never the site (ledger BL49).
    expect(alerts[0]).toMatchObject({ subject: "New job on Blueprint: Palletize cartons" });
    // The job's link is one labelled button, the company's own ("Open the job"), not the site's default.
    expect(alerts[0].subject).toBe("New job on Blueprint: Palletize cartons");
    expect(alerts[0].body).toMatch(/^A site has posted a new job\. Open it to see the job packet and respond\.\n\nJob: Palletize cartons\nCountry: United States\n\nOpen the job:\nhttps:\/\/\S+\/jobs\/req-e2\?link=\S+\n\nYou get an email like this for each new job\. Turn them off in Settings /);
    // Owner, 2026-11-23: the job's link signs that company in on the way, once, for a week, and opens this job.
    const { verifyAccountSignInToken } = await import("../utils/request-review-auth");
    for (const alert of alerts) {
      const link = decodeURIComponent(/\/jobs\/req-e2\?link=(\S+)/.exec(alert.body)![1]);
      const payload = verifyAccountSignInToken(link)!;
      expect(payload).toMatchObject({ kind: "account_sign_in", email: alert.to, sourceId: sha(alert.to), job: ID });
      expect(payload.exp * 1000 - Date.now()).toBeGreaterThan(6 * 24 * 3600 * 1000);
    }
    // The unsubscribe line names the emails it stops, never the scope's internal name.
    expect(alerts[0].body).toMatch(/\nUnsubscribe from new-job emails and Blueprint updates: https:\/\/\S+\/api\/growth\/email\/unsubscribe\?token=[A-Za-z0-9_-]+$/);
    // The link carries a sealed token: no address in it.
    expect(alerts[0].body).not.toMatch(/unsubscribe\?[^\s]*(email=|%40|@)/);
    expect(alerts[0].body).not.toMatch(/optional updates/i);
    expectNoSiteIn("the new-job emails", JSON.stringify(alerts));
    // No email to the site: its job link email already said where the job goes and how to stop (ledger AL38).
    expect(outbox().filter(row => row.kind === "job_sent")).toEqual([]);
    expect(jobDoc().company_auto_send).toMatchObject({ schemaVersion: 1, count: 6 });
    // The site's page reports the count and the first date.
    expect((await loadSiteCompanyActivity(ID)).sent).toEqual({ count: 6, firstAtIso: result.sent ? result.sentAtIso : "" });
  });

  it("emails a company that made no choice, or said no only in the old bundled box, and not one that said no in Settings", async () => {
    const bundled = { newsletter: false, newJobAlerts: false, interests: {}, declaredCategories: {}, requirements: {},
      updatedAtIso: "2026-11-03T00:00:00.000Z", version: "optional-updates-v1" };
    state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, { ...NORTH, newJobAlertsOptIn: false });
    state.docs.set(`robotTeamAccess/${sha(SOUTH.email)}`, { ...SOUTH, newJobAlertsOptIn: false, updatePreferences: { ...bundled, source: "application" } });
    state.docs.set(`robotTeamAccess/${sha(EAST.email)}`, { ...EAST, newJobAlertsOptIn: false, updatePreferences: { ...bundled, source: "signup" } });
    state.docs.set(`robotTeamAccess/${sha(WEST.email)}`, { ...WEST, ...jobEmailsOffInSettings() });
    await sendJobToApprovedCompanies(ID);
    expect(outbox().filter(row => row.kind === "robot_team_new_task").map(row => row.to).sort())
      .toEqual([NORTH, SOUTH, EAST].map(record => record.email).sort());
    await deliverOutbox({ limit: 50 });
    expect(seams.sendEmail.mock.calls.map(([message]) => String(message.to)).filter(to => to !== "" && [NORTH, SOUTH, EAST, WEST]
      .some(record => record.email === to)).sort()).toEqual([NORTH, SOUTH, EAST].map(record => record.email).sort());
    // e-004, e-008: the job is the company's button ("Open the job"); the commercial footer stays in the text part, and the
    // HTML part shows the layout's own footer with its "Unsubscribe" link, not a raw link carrying the reader's address.
    const alert = seams.sendEmail.mock.calls.map(([message]) => message).find(message => message.to === NORTH.email && message.subject === "New job on Blueprint: Palletize cartons")!;
    const html = String(alert.html), text = String(alert.text);
    expect(text).toMatch(/\n\n--\n.+\nPrivacy: https:\/\/\S+\/privacy\nUnsubscribe from new-job emails and Blueprint updates: https:\/\/\S+$/);
    expect(html).toContain(">Open the job</a>");
    expect(html).not.toContain("Open your job page");
    expect(html).not.toMatch(/Privacy: |Unsubscribe from |scope=optional_updates&quot;|>--</);
    expect(html).toMatch(/href="https:\/\/\S+\/api\/growth\/email\/unsubscribe\?token=[A-Za-z0-9_-]+"[^>]*>Unsubscribe<\/a>/);
  });

  it("emails the site nothing when its job is sent, and sends no notice for a legacy description draft", async () => {
    await sendJobToApprovedCompanies(ID);
    expect(outbox().filter(row => row.kind === "job_sent")).toEqual([]);
    state.docs.clear();
    state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: SENTENCE, confirmedAtIso: null });
    // Sent with its description only (v5): the job page offers "Withdraw my job" (`SelfCaptureUpload.tsx`), not a video to stop.
    state.docs.set(`inboundRequests/${ID}`, job({ capture_privacy_screen: undefined, request: { ...job().request, consent_attestation: null,
      description_authority: { granted: true, statement_version: "2026-11-12.v5", recorded_at_iso: "2026-11-12T10:00:00.000Z" } },
      public_task_listing: { ...sharedJobListing("Stack cartons onto the pallet"), approvedBy: "description_statement",
        recordingStatementVersion: null, descriptionStatementVersion: "2026-11-12.v5" } }));
    state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, NORTH);
    expect(await sendJobToApprovedCompanies(ID)).toEqual({ sent: false, reason: "not_listed" });
    expect(outbox()).toHaveLength(0);
  });

  it("is idempotent: a second call and the sweep add nothing", async () => {
    await sendJobToApprovedCompanies(ID);
    // Everything but the sweep's own cursor.
    const snapshot = () => JSON.stringify([...state.docs.entries()].filter(([key]) => !key.startsWith("automationState/")));
    const before = snapshot();
    expect(await sendJobToApprovedCompanies(ID)).toEqual({ sent: false, reason: "already_sent" });
    expect(await sweepAutomaticSends()).toMatchObject({ examined: 0, sent: 0 });
    expect(snapshot()).toBe(before);
  });

  it("the sweep catches a listed job that was never sent, and sends nothing for one that is not listed", async () => {
    patchJob({ operator_listing_hold: { held: true } });
    expect(await sweepAutomaticSends()).toMatchObject({ examined: 1, sent: 0 });
    expect(outbox()).toEqual([]);
    patchJob({ operator_listing_hold: { held: false } });
    expect(await sweepAutomaticSends()).toMatchObject({ examined: 1, sent: 1 });
  });

  it("delivers the email only while the job is listed and the company still wants it, at dispatch", async () => {
    await sendJobToApprovedCompanies(ID);
    state.docs.set(`robotTeamAccess/${sha(SOUTH.email)}`, { ...SOUTH, ...jobEmailsOffInSettings() });
    state.docs.set(`robotTeamAccess/${sha(EAST.email)}`, { ...EAST, status: "declined" });
    state.docs.set(`email_suppressions/${WEST.email}`, { global_suppressed: true });
    await deliverOutbox({ limit: 50 });
    const delivered = seams.sendEmail.mock.calls.map(([message]) => String(message.to));
    expect(delivered.filter(to => to.endsWith(".example") && to.startsWith("contact@"))).toEqual([NORTH.email]);
    const { outboxRecipientMatches } = await import("../utils/captureOutbox");
    const status = (to: string) => outbox().find(row => row.kind === "robot_team_new_task" && outboxRecipientMatches(row, to))?.status;
    expect([status(SOUTH.email), status(EAST.email), status(WEST.email)]).toEqual(["cancelled", "cancelled", "cancelled"]);
  });
});

/* ----------------------------------------------------------------- introductions */

const siteEmail = () => ({ subject: "Meet the company", body: "company details" });
async function interested(...records: Array<{ email: string }>) {
  for (const record of records) expect((await answer(record)).status).toBe(200);
}

describe("introductions (E6) and money (E7)", () => {
  it("introduces the site to the company it chose: one transaction, both emails, one billable event, no price", async () => {
    await interested(NORTH);
    const result = await requestIntroduction({ requestId: ID, alias: "Company A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION },
      { siteEmail, now: () => new Date("2026-11-12T15:00:00.000Z") });
    expect(result).toEqual({ ok: true, introducedAtIso: "2026-11-12T15:00:00.000Z" });
    const companyId = sha(NORTH.email);
    const stored = state.docs.get(`inboundRequests/${ID}/introductions/${companyId}`) as Record<string, any>;
    expect(stored).toMatchObject({ schemaVersion: 1, alias: "A", requestedAtIso: "2026-11-12T15:00:00.000Z", by: "site", outcomes: [] });
    // Both sides' details are encrypted at rest: no planted name, email, phone or address in plain text (item 5).
    const raw = JSON.stringify(stored);
    for (const planted of [SITE.name, "ZEBRAPLANT", SITE.email, SITE.first, SITE.address, "QUOKKA", NORTH.company, NORTH.email, NORTH.name, "north.example"])
      expect(raw).not.toContain(planted);
    const { openShared } = await import("../utils/introductionShared");
    expect(await openShared(stored.siteShared)).toEqual({ name: SITE.name, contactName: `${SITE.first} ${SITE.last}`, email: SITE.email,
      location: SITE.address });
    expect(await openShared(stored.companyShared)).toEqual({ company: NORTH.company, contactName: NORTH.name, email: NORTH.email,
      website: NORTH.website });
    expect(state.docs.get(`billableEvents/introduction-${ID}-${companyId}`)).toEqual({ kind: "introduction", requestId: ID, companyId,
      atIso: "2026-11-12T15:00:00.000Z", priceUsd: null, status: "recorded_no_price" });
    const toCompany = outbox().find(row => row.kind === "introduction_made_company")!;
    expect(toCompany).toMatchObject({ key: `${ID}:introduction_made_company:${companyId}`, to: NORTH.email,
      subject: "A site accepted your application", replyTo: SITE.email });
    for (const detail of [SITE.name, `${SITE.first} ${SITE.last}`, SITE.email, SITE.address, `/jobs/${ID}`]) expect(toCompany.body).toContain(detail);
    // The company's email goes first (H2), so it says the site's email is on its way, not that it has gone (J2).
    // A reply reaches Blueprint (dispatch sends Reply-To hello@), so it says where to write instead (decision 9).
    expect(toCompany.body).toContain("We are sending the site your company's name and your contact details now. Write to them at the email above.");
    expect(toCompany.body).not.toMatch(/Reply to them/);
    expect(toCompany.body).toContain(`\nOpen the job:\nhttps://`);
    expect(toCompany.body).toContain(`\nSite: ${SITE.name}\n`);
    expect(toCompany.body).toContain(`\nAddress: ${SITE.address}\n`);
    expect(toCompany.body).not.toMatch(/We have given the site/);
    expect(outbox().find(row => row.kind === "introduction_made_site")).toMatchObject({ key: `${ID}:introduction_made_site:${companyId}`,
      to: SITE.email, subject: "Meet the company", replyTo: NORTH.email });
    // Nothing else a company can see names the site.
    expectNoSiteIn("the page after an introduction", (await page(SOUTH)).raw);
    expectNoSiteIn("every email to a company but the chosen one", JSON.stringify(outbox().filter(row => row.to !== NORTH.email && row.to !== SITE.email)));
    // Nothing has been sent yet, so nothing is introduced (H2): the site's view says the request is in progress and
    // carries none of the company's details.
    const pending = await loadSiteCompanyActivity(ID);
    expect(pending.introductions).toEqual({ used: 1 });
    expect(pending.entries).toEqual([expect.objectContaining({ alias: "Company A", canIntroduce: false, introductionPending: true })]);
    expect(pending.entries[0]).not.toHaveProperty("introducedAtIso");
    expect(pending.entries[0]).not.toHaveProperty("company");
    // The applicant's name and website show with its answer (owner, 2026-11-23); its contact details only once made.
    expect(pending.entries[0]).toMatchObject({ applicant: { name: "North Robotics", website: "https://north.example" } });
    expect(JSON.stringify(pending)).not.toMatch(/contact@north|Person North/);
    // Once the company's email is sent the introduction is made: the site's view carries the company's details on that
    // answer only, dated when it was made.
    await deliverOutbox({ limit: 50 });
    const sentAtIso = outbox().find(row => row.kind === "introduction_made_company")!.sentAtIso;
    expect(sentAtIso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const activity = await loadSiteCompanyActivity(ID);
    expect(activity.introductions).toEqual({ used: 1 });
    expect(activity.entries).toEqual([expect.objectContaining({ alias: "Company A", canIntroduce: false,
      introducedAtIso: sentAtIso, company: { name: NORTH.company, contactName: NORTH.name, email: NORTH.email, website: NORTH.website } })]);
    expect(activity.entries[0]).not.toHaveProperty("introductionPending");
  });

  // Owner, 2026-11-23: an answer under the current line shows the site the company's name and website, never its
  // contact details, before the site accepts.
  it("before the site accepts, it sees each applicant's name and website and no contact details, and may accept each one that applied", async () => {
    await interested(NORTH, SOUTH);
    expect((await answer(EAST, { state: "declined" })).status).toBe(200);
    const activity = await loadSiteCompanyActivity(ID);
    expect(activity.entries.map(entry => entry.kind === "answered" && entry.applicant)).toEqual([
      { name: "North Robotics", website: "https://north.example" }, { name: "South Robotics", website: "https://south.example" },
      { name: "East Robotics", website: "https://east.example" }]);
    expect(JSON.stringify(activity)).not.toMatch(/contact@|Person (North|South|East)/);
    expect(activity.entries.map(entry => [entry.alias, entry.kind === "answered" && entry.canIntroduce])).toEqual([
      ["Company A", true], ["Company B", true], ["Company C", false]]);
  });

  it("returns each refusal in its case", async () => {
    const ask = (alias: string) => requestIntroduction({ requestId: ID, alias, actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail });
    // No company under that alias, and a company that did not answer Interested.
    expect(await ask("A")).toEqual({ ok: false, reason: "not_interested" });
    expect((await answer(NORTH, { state: "needs_something" })).status).toBe(200);
    expect(await ask("A")).toEqual({ ok: false, reason: "not_interested" });
    // Interested under the older line (an answer recorded before 2026-11-12): no consent yet.
    state.docs.set(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`, { state: "interested", inputs: "x", recordedBy: "company",
      updatedAtIso: "2026-11-11T00:00:00.000Z" });
    expect(await ask("A")).toEqual({ ok: false, reason: "consent_missing" });
    // The company's approval withdrawn, or a technology partner.
    await interested(NORTH);
    state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, { ...NORTH, partnerRole: "technology" });
    expect(await ask("A")).toEqual({ ok: false, reason: "company_not_approved" });
    state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, NORTH);
    expect(await ask("A")).toMatchObject({ ok: true });
    expect(await ask("A")).toEqual({ ok: false, reason: "already_introduced" });
    patchJob({ operator_listing_hold: { held: true } });
    expect(await ask("A")).toEqual({ ok: false, reason: "not_listed" });
  });

  it("refuses without the current introduction statement, and stores the one the site agreed to in plain text", async () => {
    await interested(NORTH);
    for (const statementVersion of [undefined, null, "introduction-request-2026-11-01"])
      expect(await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion }, { siteEmail }))
        .toEqual({ ok: false, reason: "statement_not_current" });
    expect(state.docs.has(`inboundRequests/${ID}/introductions/${sha(NORTH.email)}`)).toBe(false);
    expect(await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION },
      { siteEmail })).toMatchObject({ ok: true });
    expect(state.docs.get(`inboundRequests/${ID}/introductions/${sha(NORTH.email)}`))
      .toMatchObject({ statementVersion: "introduction-request-2026-11-12" });
  });

  it("tells the site, in its Meet email, the answer the company gave", async () => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    expect((await answer(NORTH, { state: "tested_can_do" })).status).toBe(200);
    await interested(SOUTH);
    const labels: unknown[] = [];
    const capture = (input: { answerLabel?: string | null }) => { labels.push(input.answerLabel); return { subject: "s", body: "b" }; };
    for (const alias of ["A", "B"])
      expect(await requestIntroduction({ requestId: ID, alias, actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION },
        { siteEmail: capture })).toMatchObject({ ok: true });
    expect(labels).toEqual(["Tested it: can do", "Applied"]);
    // And the site side's real email words it (no stub).
    await interested(EAST);
    expect(await requestIntroduction({ requestId: ID, alias: "C", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }))
      .toMatchObject({ ok: true });
    const toSite = outbox().filter(row => row.kind === "introduction_made_site").map(row => String(row.body));
    expect(toSite.at(-1)).toContain("applied to your job");
  });

  // Owner, 2026-11-12: "if they want to talk to 1 that should be fine if they want to go through the steps with 8 that
  // should be fine". No limit per job; still one introduction per company.
  it("has no limit per job: introduces every company that answered Interested, each once, each with its billable event", async () => {
    await interested(NORTH, SOUTH, EAST, WEST, MUTED);
    for (const alias of ["A", "B", "C", "D"]) expect(await requestIntroduction({ requestId: ID, alias, actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })).toMatchObject({ ok: true });
    const before = await loadSiteCompanyActivity(ID);
    expect(before.introductions).toEqual({ used: 4 });
    expect(before.entries.find(entry => entry.alias === "Company E")).toMatchObject({ canIntroduce: true });
    expect(await requestIntroduction({ requestId: ID, alias: "E", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })).toMatchObject({ ok: true });
    expect(await requestIntroduction({ requestId: ID, alias: "B", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })).toEqual({ ok: false, reason: "already_introduced" });
    expect([...state.docs.keys()].filter(key => key.startsWith(`inboundRequests/${ID}/introductions/`))).toHaveLength(5);
    expect([...state.docs.keys()].filter(key => key.startsWith("billableEvents/"))).toHaveLength(5);
    const activity = await loadSiteCompanyActivity(ID);
    expect(activity.introductions).toEqual({ used: 5 });
    expect(activity.entries.every(entry => entry.kind !== "answered" || entry.canIntroduce === false)).toBe(true);
  });

  // Owner, 2026-11-23: the site's job reads like a shipment tracker; a visit and a pilot are the site's own marks.
  it("records the site's own marks for a visit and a pilot after an introduction, and only after one", async () => {
    await interested(NORTH, SOUTH);
    const { markIntroductionProgress } = await import("../utils/jobIntroductions");
    expect(await markIntroductionProgress({ requestId: ID, alias: "A", step: "visit", done: true })).toEqual({ ok: false, reason: "not_introduced" });
    expect(await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })).toMatchObject({ ok: true });
    const at = (iso: string) => () => new Date(iso);
    expect(await markIntroductionProgress({ requestId: ID, alias: "A", step: "visit", done: true }, at("2026-11-20T10:00:00.000Z")))
      .toEqual({ ok: true, progress: { visitAtIso: "2026-11-20T10:00:00.000Z" } });
    // Pressing again keeps the first date; a pilot is added beside it; "Undo" takes the visit back alone.
    expect(await markIntroductionProgress({ requestId: ID, alias: "A", step: "visit", done: true }, at("2026-11-21T10:00:00.000Z")))
      .toEqual({ ok: true, progress: { visitAtIso: "2026-11-20T10:00:00.000Z" } });
    expect(await markIntroductionProgress({ requestId: ID, alias: "A", step: "pilot", done: true }, at("2026-11-22T10:00:00.000Z")))
      .toEqual({ ok: true, progress: { visitAtIso: "2026-11-20T10:00:00.000Z", pilotAtIso: "2026-11-22T10:00:00.000Z" } });
    const entry = (await loadSiteCompanyActivity(ID)).entries.find(row => row.alias === "Company A");
    expect(entry).toMatchObject({ progress: { visitAtIso: "2026-11-20T10:00:00.000Z", pilotAtIso: "2026-11-22T10:00:00.000Z" } });
    expect(await markIntroductionProgress({ requestId: ID, alias: "A", step: "visit", done: false }))
      .toEqual({ ok: true, progress: { pilotAtIso: "2026-11-22T10:00:00.000Z" } });
    // A company the site was never introduced to has nothing to mark, and a withdrawn job takes no marks.
    expect(await markIntroductionProgress({ requestId: ID, alias: "B", step: "pilot", done: true })).toEqual({ ok: false, reason: "not_introduced" });
    patchJob({ capture_withdrawal: { requestedAtIso: "2026-11-23T00:00:00.000Z" } });
    expect(await markIntroductionProgress({ requestId: ID, alias: "A", step: "pilot", done: true })).toEqual({ ok: false, reason: "withdrawn" });
  });

  it("clears both sides' details from the introduction emails' outbox rows once sent; a failed try keeps them for the retry", async () => {
    await interested(NORTH);
    expect(await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }))
      .toMatchObject({ ok: true });
    const rows = () => outbox().filter(row => row.kind === "introduction_made_company" || row.kind === "introduction_made_site");
    expect(rows()).toHaveLength(2);
    // The first try fails with a provider error that can be retried: the rows keep their full bodies.
    const introTo = new Set([NORTH.email, SITE.email]);
    seams.sendEmail.mockImplementation(async (message: Record<string, unknown>) => introTo.has(String(message.to))
      ? { sent: false, provider: "resend", messageId: null, failure: "transient", error: new Error("rate limited") } as never
      : { sent: true, provider: "resend", messageId: "accepted" });
    await deliverOutbox({ limit: 50 });
    seams.sendEmail.mockImplementation(async () => ({ sent: true, provider: "resend", messageId: "accepted" }));
    for (const row of rows()) {
      // The company's row waits to be retried; the site's waits, held, for the company's to be sent (H2).
      expect(row.status).toBe(row.kind === "introduction_made_company" ? "pending" : "held");
      expect(String(row.body)).toContain(row.kind === "introduction_made_company" ? SITE.email : NORTH.email);
    }
    expect(seams.sendEmail.mock.calls.some(([message]) => message.to === SITE.email && /Meet/.test(String(message.subject)))).toBe(false);
    // The retry sends the full email, then the row holds neither side's details.
    for (const row of rows()) state.docs.set(`captureOutbox/${row.key}`, { ...state.docs.get(`captureOutbox/${row.key}`), nextAttemptAtMs: 0 });
    seams.sendEmail.mockClear();
    await deliverOutbox({ limit: 50 });
    const sentBodies = seams.sendEmail.mock.calls.map(([message]) => JSON.stringify(message));
    expect(sentBodies.some(body => body.includes(SITE.name) && body.includes(SITE.email))).toBe(true);
    expect(sentBodies.some(body => body.includes(NORTH.email))).toBe(true);
    for (const row of rows()) {
      expect(row.status).toBe("sent");
      expect(row).toMatchObject({ subject: "", body: "", replyTo: null });
      // The row keeps its own recipient (`to`), which the outbox needs; the other side's details are gone.
      const { to: _to, ...rest } = row as Record<string, unknown>;
      const raw = JSON.stringify(rest);
      for (const planted of [SITE.name, SITE.email, SITE.address, `${SITE.first} ${SITE.last}`, NORTH.email, NORTH.company, NORTH.name])
        expect(raw).not.toContain(planted);
    }
  });

  it("clears them too when an introduction email is cancelled", async () => {
    await interested(NORTH);
    await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail });
    patchJob({ consent_revoked: true });
    await deliverOutbox({ limit: 50 });
    const row = outbox().find(entry => entry.kind === "introduction_made_company")!;
    expect(row).toMatchObject({ status: "cancelled", body: "", replyTo: null });
    expect(JSON.stringify(row)).not.toContain(SITE.email);
  });

  // Audit G-06: Blueprint's own work window ending stops paid work only; it no longer cancels an introduction the site
  // pressed. Every rights hold, the withdrawal and Blueprint's hold still do.
  it("lets an introduction the site pressed go ahead when only Blueprint's work window ended, and still stops it for every hold", async () => {
    await interested(NORTH);
    expect(await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION },
      { siteEmail })).toMatchObject({ ok: true });
    const { introductionMayProceed } = await import("../utils/jobIntroductionGate");
    const companyId = sha(NORTH.email);
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`),
      website_preparation: { selector: { request_id: ID, capture_id: CAPTURE }, status: { state: "authority_ended" } } });
    // An authority end while the recorded grant still allows the work (the window ran out) keeps the job listed (G-01).
    expect(await introductionMayProceed(ID, companyId)).toEqual({ ok: true });
    patchJob({ website_scene_sponsorship: { expires_at_epoch: Math.floor(Date.now() / 1000) - 3600 } });
    expect(await introductionMayProceed(ID, companyId)).toEqual({ ok: true });
    const base = structuredClone(jobDoc());
    for (const [name, patch] of [
      ["a rights hold under review", { evaluation_readiness: { rights_review_status: "needs_review" } }],
      ["a rights block", { pipeline: { rights_review_status: "blocked" } }],
      ["Blueprint's hold", { operator_listing_hold: { held: true, atIso: "2026-11-12T12:00:00.000Z", by: "ops" } }],
      ["the site's close", { website_run_closures: { [CAPTURE]: { closed_at_iso: "2026-11-12T12:00:00.000Z" } } }],
      ["the site's withdrawal", { consent_revoked: true }],
    ] as Array<[string, Record<string, unknown>]>) {
      state.docs.set(`inboundRequests/${ID}`, { ...structuredClone(base), ...patch });
      expect((await introductionMayProceed(ID, companyId)).ok, name).toBe(false);
    }
  });

  it("cancels the company's introduction email at dispatch once the site has withdrawn", async () => {
    await interested(NORTH);
    await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail });
    patchJob({ consent_revoked: true });
    await deliverOutbox({ limit: 50 });
    expect(outbox().find(row => row.kind === "introduction_made_company")).toMatchObject({ status: "cancelled" });
    expect(seams.sendEmail.mock.calls.map(([message]) => message.to)).not.toContain(NORTH.email);
  });
});

/** A package reference exactly as the contract's record (`website_company_simulation.v1`). */
function simulationPackage(patch: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = { schema_version: "website_company_simulation.v1", capture_id: CAPTURE,
    simulation_revision: `sha256:${"4".repeat(64)}`, state: "ready", format: "zip_usd_scene_object_success_rule",
    content_type: "application/zip", digest: ZIP_DIGEST, size_bytes: ZIP_BYTES.length,
    files: ["README.txt", "object.usdz", "scene.usda", "scene/room.usdc", "scene/room_collision.usdc", "success_rule.json"],
    permission_basis: "site_sharing_statement", statement_version: "2026-11-12.v4", updated_at_epoch: 1_794_000_000, ...patch };
  delete value.simulation_digest;
  return { ...value, simulation_digest: crossRuntimeArtifactDigest(value, "simulation_digest") };
}

describe("the simulation download and the tested answers (E9)", () => {
  it("offers no download and refuses a tested answer until the job has a simulation package", async () => {
    expect((await page()).body.item.simulationDownload).toEqual({ state: "not_finished" });
    expect((await answer(NORTH, { state: "tested_can_do" })).status).toBe(409);
    expect(state.docs.has(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`)).toBe(false);
  });

  it("reads Ready on the job card only once the company simulation is stored, never from the retired runnable proof", async () => {
    const before = (await list()).body.items[0];
    expect(before).toMatchObject({ evaluationAvailable: false, simulationDownloadAvailable: false });
    expect(before.stage).not.toBe("ready");
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    expect((await list()).body.items[0]).toMatchObject({ stage: "ready", evaluationAvailable: true, simulationDownloadAvailable: true });
  });

  it("serves the package to the viewer's ticket only, accepts a tested answer, and introduces on tested_can_do", async () => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    const offered = (await page()).body.item.simulationDownload;
    const url = offered.url as string;
    expect(url).toMatch(new RegExp(`^/api/company-media/jobs/${ID}/simulation\\.zip\\?`));
    // The button says the stored size, and the file is named by the package's version (owner, 2026-11-25).
    expect(offered).toMatchObject({ state: "ready", sizeBytes: ZIP_BYTES.length, fileName: `simulation-${ZIP_VERSION}.zip` });
    const download = await media(url);
    expect(download.status).toBe(200);
    expect(download.bytes.toString()).toBe("PK-ZIP-BYTES");
    expect(download.headers.get("content-disposition")).toBe(`attachment; filename="simulation-${ZIP_VERSION}.zip"`);
    expect((await media(url.replace(/viewer=[a-f0-9]+/, `viewer=${sha(SOUTH.email)}`))).status).toBe(404);
    expect((await answer(NORTH, { state: "tested_can_do" })).status).toBe(200);
    expect((await answer(SOUTH, { state: "tested_cannot_yet" })).status).toBe(200);
    const activity = await loadSiteCompanyActivity(ID);
    expect(activity.entries.map(entry => [entry.alias, entry.kind === "answered" && entry.state, entry.kind === "answered" && entry.canIntroduce]))
      .toEqual([["Company A", "tested_can_do", true], ["Company B", "tested_cannot_yet", false]]);
    expect(await requestIntroduction({ requestId: ID, alias: "B", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })).toEqual({ ok: false, reason: "not_interested" });
    expect(await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })).toMatchObject({ ok: true });
    // A stop closes the download too.
    patchJob({ operator_listing_hold: { held: true } });
    expect((await media(url)).status).toBe(404);
  });

  it("withdrawal deletion removes the clip and the package references", async () => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    const { deleteWebsiteCompanyClips } = await import("../utils/websiteCompanyClip");
    expect(await deleteWebsiteCompanyClips(ID, [CAPTURE])).toEqual([CAPTURE]);
    const session = state.docs.get(`captureUploadSessions/${CAPTURE}`) as Record<string, unknown>;
    expect(session.company_clip).toBeUndefined();
    expect(session.company_simulation).toBeUndefined();
    expect(session.scene_preview).toBeTruthy();
  });
});

/* ----------------------------------------------------------------- the job summary (owner, 2026-11-25) */

describe("the job summary: the page's words as a PDF, under the page's checks", () => {
  it("is a PDF named by a short job reference, private and not cached, holding what the page shows", async () => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    state.docs.set(`siteTaskBriefs/${ID}`, { ...state.docs.get(`siteTaskBriefs/${ID}`),
      successCriteria: { successDefinition: "Every carton ends up on the pallet, label facing out." } });
    const item = (await page()).body.item;
    const read = await summary();
    expect(read.status).toBe(200);
    expect(read.headers.get("content-type")).toBe("application/pdf");
    expect(read.headers.get("content-disposition")).toBe('attachment; filename="job-summary-e2.pdf"');
    expect(read.headers.get("cache-control")).toBe("private, no-store");
    expect(read.headers.get("x-content-type-options")).toBe("nosniff");
    expect(read.raw.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfPageCount(read.bytes)).toBeLessThanOrEqual(2);
    const text = pdfText(read.bytes);
    // What the page shows, in its words: the title, the country, the day shared, the site's words with its contact
    // details removed, what counts as done, At a glance, what a visit must confirm, and the identity line.
    expect(item.visitMustConfirm).toEqual(VISIT_MUST_CONFIRM.palletizing);
    for (const part of [item.headline, "United States", "Shared November 12, 2026", "What counts as done",
      "Every carton ends up on the pallet, label facing out.", "At a glance", "Weight 5 to 15 kg (11 to 33 lb)", "Not stated yet:",
      "What a visit must confirm", ...item.visitMustConfirm, NOTHING_TESTED_AT_SITE, SITE_IDENTITY_RULE, JOB_SUMMARY_FOOTER])
      expect(text.replace(/\n/g, " ")).toContain(part);
    // No first look, as on the page: it stays on the site's own pages (owner, 2026-11-25).
    expect(text).not.toMatch(/first look/i);
    expect(text.replace(/\n/g, " ")).toContain("Stack 12 kg cartons onto the pallet, 2 shifts, 24/7. Call [removed] or email [removed], see [removed]");
    // The way back to the page for the video and the simulation: the page's address, as a link.
    expect(pdfLinks(read.bytes)).toEqual([`https://tryblueprint.io/jobs/${ID}`]);
    // Nothing of the site, and none of the page's media: no video, frame, thumbnail or ticket, and no price.
    expectNoSiteIn("the job summary", read.raw);
    expectNoSiteIn("the job summary's text", text);
    expect(read.raw).not.toMatch(/video\.mp4|simulation\.zip|thumbnail|signature=|expires=|viewer=|splat|pipeline\.invalid|walkthrough-|\/Image|\/XObject/);
    expect(text).not.toMatch(/[$€£]\s?\d/);
    expect(text).not.toContain(COMPANY_RESPONSE_STATEMENT);
  });

  it("leaves out the company's own answer and its question, and opens a public live job's reference as the job", async () => {
    expect((await answer(NORTH, { inputs: "We palletize these for a grocer in Ohio, ask Jo at 555 0100." })).status).toBe(200);
    const text = pdfText((await summary()).bytes);
    expect(text).not.toMatch(/grocer|Ohio|555 0100|Jo at/);
    const { publicLiveJobRef } = await import("../utils/taskBrowse");
    const ref = publicLiveJobRef(ID)!;
    const response = await realFetch(`${base}/api/site-worlds/jobs/${ref}/summary.pdf`, { headers: signIn(NORTH) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="job-summary-e2.pdf"');
    expect((await realFetch(`${base}/api/site-worlds/jobs/${ref}/summary.pdf`, { headers: signIn(PENDING) })).status).toBe(404);
  });
});

/* ----------------------------------------------------------------- the independent review's findings, as assertions */

const { teamJobAccess, loadCompanyJobAccess } = await import("../utils/teamJobAccess");

describe("review findings (must-fix and should-fix)", () => {
  it("must-fix 1: a technology partner gets no page, no video, no download, no answer and no introduction", async () => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    const north = (await page()).body.item;
    expect((await page(TECH)).status).toBe(404);
    expect((await summary(TECH)).status).toBe(404);
    expect((await list(TECH)).body.items).toEqual([]);
    // A ticket minted for a deployment company, replayed under the partner's id, is refused; so is the partner's own id.
    for (const url of [north.video.url, north.simulationDownload.url, sceneContentUrl(north.simulation.viewerUrl)])
      expect((await media(url.replace(/viewer=[a-f0-9]+/, `viewer=${sha(TECH.email)}`), { "sec-fetch-dest": "empty" })).status).toBe(404);
    const { companyMediaAllowed } = await import("../utils/companyJobPage");
    expect(await companyMediaAllowed(ID, CAPTURE, sha(TECH.email))).toBe(false);
    expect((await answer(TECH)).status).toBe(403);
    expect(state.docs.has(`inboundRequests/${ID}/robotTeamInterest/${sha(TECH.email)}`)).toBe(false);
    expect((await loadSiteCompanyActivity(ID)).entries).toEqual([]);
  });

  it.each([
    ["an operator hold", () => patchJob({ operator_listing_hold: { held: true, atIso: "2026-11-12T12:00:00.000Z", by: "ops" } })],
    ["a rights hold", () => patchJob({ evaluation_readiness: { rights_review_status: "blocked" } })],
    ["the site closing its job", () => patchJob({ website_run_closures: { [CAPTURE]: { closed_at_iso: "2026-11-12T12:00:00.000Z" } } })],
    ["the company's suspension", () => state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, { ...NORTH, status: "declined" })],
  ] as Array<[string, () => void]>)("must-fix 2: the company's introduction email is cancelled after %s, and carries nothing of the site", async (_name, stop) => {
    await interested(NORTH);
    expect(await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })).toMatchObject({ ok: true });
    stop();
    await deliverOutbox({ limit: 50 });
    expect(outbox().find(row => row.kind === "introduction_made_company")).toMatchObject({ status: "cancelled" });
    const toCompany = seams.sendEmail.mock.calls.map(([message]) => message as Record<string, unknown>).filter(message => message.to === NORTH.email);
    expect(JSON.stringify(toCompany)).not.toContain(SITE.name);
  });

  it("must-fix 3: a job its site paused before today is listed; the old close and a withdrawal still close it", async () => {
    patchJob({ workspace_task: { paused: true } });
    expect(teamJobAccess(jobDoc(), { brief: { summary: SENTENCE } })).toMatchObject({ listed: true });
    expect((await page()).status).toBe(200);
    patchJob({ workspace_task: { archived: true } });
    expect(teamJobAccess(jobDoc(), { brief: { summary: SENTENCE } })).toMatchObject({ listed: false, reason: "closed_by_site" });
    // A withdrawal sets the same pause flag, and is found by its own fields: a fresh v4 grant written afterwards does not reopen it.
    patchJob({ workspace_task: { paused: true }, capture_withdrawal: { state: "requested" }, consent_revoked: true,
      request: { ...jobDoc().request, consent_attestation: { granted: false, revoked_at_iso: "2026-11-12T12:00:00.000Z" } } });
    patchJob({ request: { ...jobDoc().request, consent_attestation: sharedRecordingGrant() } });
    expect(teamJobAccess(jobDoc(), { brief: { summary: SENTENCE } })).toMatchObject({ listed: false, reason: "consent_withdrawn" });
    // Even with only the withdrawal record left.
    patchJob({ consent_revoked: false });
    expect(teamJobAccess(jobDoc(), { brief: { summary: SENTENCE } })).toMatchObject({ listed: false, reason: "consent_withdrawn" });
    expect((await page()).status).toBe(404);
  });

  it("must-fix 4: sixty held shared jobs do not starve a listed one; the sweep walks on and wraps", async () => {
    const listed = jobDoc();
    for (let i = 0; i < 60; i += 1) state.docs.set(`inboundRequests/a-held-${String(i).padStart(2, "0")}`,
      { ...listed, requestId: `a-held-${i}`, operator_listing_hold: { held: true } });
    const passes = [];
    for (let i = 0; i < 4 && !jobDoc().company_auto_send; i += 1) passes.push(await sweepAutomaticSends(25));
    expect(jobDoc().company_auto_send).toMatchObject({ count: 6 });
    expect(passes.reduce((sum, pass) => sum + pass.sent, 0)).toBe(1);
    // The cursor wraps to the start after the last page.
    expect(passes.at(-1)).toMatchObject({ wrapped: true });
    expect(state.docs.get("automationState/companyAutoSendCursor")).toMatchObject({ after: null });
  });

  it("must-fix 5: the consent line names both answers, and the company's email states its own stored answer", async () => {
    expect(COMPANY_RESPONSE_STATEMENT).toBe("The site sees your company's name and website with your answer, and any estimate you "
      + "give, as an estimate before a site visit, not a quote. If you apply or answer Tested it: can do and the site accepts, we "
      + "give the site your contact details, and give you theirs.");
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    expect((await answer(NORTH, { state: "tested_can_do" })).status).toBe(200);
    await interested(SOUTH);
    for (const alias of ["A", "B"]) expect(await requestIntroduction({ requestId: ID, alias, actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })).toMatchObject({ ok: true });
    const bodyTo = (email: string) => outbox().find(row => row.kind === "introduction_made_company" && row.to === email)!.body as string;
    expect(bodyTo(NORTH.email)).toContain('You answered "Tested it: can do" to a job on Blueprint');
    expect(bodyTo(SOUTH.email)).toContain("You applied to a job on Blueprint, and the site accepted your application.");
  });

  it("must-fix 6: both media routes refuse an answer without the stored digest, and the download refuses another size", async () => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    const item = (await page()).body.item;
    const serve = (simulation: { body: string; headers: Record<string, string> }, clip: { body: string; headers: Record<string, string> }) =>
      vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input);
        if (!url.startsWith("https://pipeline.invalid/")) return realFetch(input as never, init);
        const answer = url.includes("/website-company-simulations/") ? simulation : clip;
        return new Response(Buffer.from(answer.body), { status: 200, headers: answer.headers });
      }));
    const clipDigest = String(companyClip().digest), zipDigest = ZIP_DIGEST;
    // No digest header at all.
    serve({ body: "PK-ZIP-BYTES", headers: { "content-length": "12" } }, { body: "X".repeat(CLIP_BYTES.length), headers: { "content-length": String(CLIP_BYTES.length) } });
    expect((await media(item.simulationDownload.url)).status).toBe(503);
    expect((await media(item.video.url)).status).toBe(503);
    // The right digest header, but a zip of another size.
    serve({ body: "SOMETHING-ELSE-ENTIRELY-LONGER", headers: { "x-blueprint-artifact-sha256": zipDigest } },
      { body: CLIP_BYTES.toString(), headers: { "content-length": String(CLIP_BYTES.length), "x-blueprint-artifact-sha256": clipDigest } });
    expect((await media(item.simulationDownload.url)).status).toBe(503);
    expect((await media(item.video.url)).status).toBe(200);
  });

  it("must-fix 7 (stated behaviour): the video ticket is a 15-minute signed URL bound to job, capture and viewer, re-checked per request", async () => {
    const url = (await page()).body.item.video.url as string;
    const expires = Number(new URLSearchParams(url.split("?")[1]).get("expires"));
    expect(expires - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(15 * 60);
    expect((await media(url.replace(`capture=${CAPTURE}`, "capture=walkthrough-other"))).status).toBe(404);
    expect((await media(url.replace(`/jobs/${ID}/`, `/jobs/${encodeURIComponent(`../${ID}`)}/`))).status).toBe(404);
    // No sign-in is needed while the ticket lasts (the claim says so), but the job's listing is re-read every time.
    expect((await media(url)).status).toBe(200);
    patchJob({ operator_listing_hold: { held: true } });
    expect((await media(url)).status).toBe(404);
  });

  it("should-fix: the count is the standing introductions, and two presses at once both write the job document", async () => {
    await interested(NORTH, SOUTH);
    // Three standing introductions to other companies and one cancelled at dispatch (G3): no limit refuses, and the
    // count kept on the job is the standing ones.
    for (const other of ["x", "y", "z"]) state.docs.set(`inboundRequests/${ID}/introductions/${other.repeat(64)}`,
      { requestedAtIso: "2026-11-12T00:00:00.000Z", outcomes: [] });
    state.docs.set(`inboundRequests/${ID}/introductions/${"w".repeat(64)}`, { requestedAtIso: "2026-11-12T00:00:00.000Z",
      cancelledAtIso: "2026-11-12T01:00:00.000Z", cancelReason: "company_not_approved", outcomes: [] });
    expect(await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })).toMatchObject({ ok: true });
    expect(jobDoc().introductions_used).toBe(4);
    for (const other of ["x", "y", "z", "w"]) state.docs.delete(`inboundRequests/${ID}/introductions/${other.repeat(64)}`);
    patchJob({ introductions_used: 1 });
    const both = await Promise.all(["B", "B"].map(alias => requestIntroduction({ requestId: ID, alias, actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })));
    expect(both.filter(result => result.ok)).toHaveLength(1);
    expect(jobDoc().introductions_used).toBe(2);
  });

  it("should-fix: stored listing text and a free-text country never reach a company", async () => {
    const PL = "PLANTXQ";
    patchJob({ request: { ...jobDoc().request, siteLocationMetadata: { country: `encrypted:${PL} Industries` } },
      public_task_listing: { ...jobDoc().public_task_listing, details: { ...jobDoc().public_task_listing.details,
        title: `${PL} listing title`, siteType: `${PL} siteType`, objects: `${PL} objects`, pilotConditions: `${PL} conditions` } } });
    const { raw, body } = await page();
    expect(raw).not.toContain(PL);
    expect(body.item.country).toBeNull();
    expect((await list()).raw).not.toContain(PL);
    patchJob({ request: { ...jobDoc().request, siteLocationMetadata: { country: "encrypted:GB" } } });
    expect((await page()).body.item.country).toBe("United Kingdom");
  });

  it("the introduction email names no contact when the site typed no name: never the intake's placeholders", async () => {
    // The start form asks for no name; the intake stores "there" and "—" in their place (`inbound-request.ts`).
    patchJob({ contact: { ...jobDoc().contact, firstName: "encrypted:there", lastName: "encrypted:—" } });
    await interested(NORTH);
    await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail });
    const body = outbox().find(row => row.kind === "introduction_made_company")!.body as string;
    expect(body).toMatch(/^Hi Person,\n/);
    expect(body).not.toMatch(/Contact:|\bthere\b/);
    expect(body).toContain(`Email: ${SITE.email}`);
    const stored = state.docs.get(`inboundRequests/${ID}/introductions/${sha(NORTH.email)}`) as Record<string, any>;
    const { openShared } = await import("../utils/introductionShared");
    expect((await openShared(stored.siteShared)).contactName).toBeUndefined();
  });

  it("should-fix: the introduction email says a typed location once when it is also the site's name", async () => {
    patchJob({ request: { ...jobDoc().request, siteName: `encrypted:${SITE.address}` } });
    await interested(NORTH);
    await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail });
    const body = outbox().find(row => row.kind === "introduction_made_company")!.body as string;
    expect(body.split(SITE.address)).toHaveLength(2);
  });
});

/* ----------------------------------------------------------------- the download against the contract (E9) */

/* ----------------------------------------------------------------- a reset upstream never takes the process down */

describe("a company media stream whose upstream fails or whose company goes away", () => {
  /** An upstream body: these chunks, then an error or a wait that only a cancel ends. Records the cancel. */
  function upstream(chunks: Buffer[], then: "error" | "hang") {
    const state = { cancelled: false };
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (sent < chunks.length) { controller.enqueue(new Uint8Array(chunks[sent])); sent += 1; return; }
        if (then === "error") { await new Promise(resolve => setTimeout(resolve, 20)); controller.error(new Error("ECONNRESET upstream")); return; }
        await new Promise(() => undefined);
      },
      cancel() { state.cancelled = true; },
    });
    return { stream, state };
  }
  const serveUpstream = (make: (url: string, range: string | null) => { status: number; body: ReadableStream<Uint8Array>; headers: Record<string, string> }) =>
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.startsWith("https://pipeline.invalid/")) return realFetch(input as never, init);
      const answer = make(url, new Headers(init?.headers).get("range"));
      return new Response(answer.body, { status: answer.status, headers: answer.headers });
    }));
  let uncaught: unknown[] = [];
  const onUncaught = (error: unknown) => { uncaught.push(error); };
  beforeEach(() => {
    uncaught = [];
    process.on("uncaughtException", onUncaught);
    process.on("unhandledRejection", onUncaught);
  });
  afterEach(() => {
    process.off("uncaughtException", onUncaught);
    process.off("unhandledRejection", onUncaught);
  });
  const settle = () => new Promise(resolve => setTimeout(resolve, 100));
  /** Read a response to its end; true when it ended in an error (the connection was cut before the file completed). */
  async function readsToError(url: string, headers: Record<string, string> = {}): Promise<boolean> {
    try {
      // A response that never ends (the failure this guards against) fails the test in seconds, not minutes.
      const response = await realFetch(`${base}${url}`, { signal: AbortSignal.timeout(5000), headers: { "sec-fetch-dest": "video", ...headers } });
      await response.arrayBuffer();
      return false;
    } catch (error) {
      // Our own timeout is a hang, not the error the server should have ended the response with.
      return !(error instanceof Error && error.name === "TimeoutError");
    }
  }

  const cases: Array<[string, "clip" | "simulation", string | null]> = [
    ["the video, whole file", "clip", null], ["the video, a range", "clip", "bytes=2-"],
    ["the video, a range covering the whole file", "clip", "bytes=0-"],
    ["the simulation, whole file", "simulation", null], ["the simulation, a range", "simulation", "bytes=2-"],
    ["the simulation, a range covering the whole file", "simulation", "bytes=0-"],
  ];

  it.each(cases)("%s: an upstream error midway ends only that response, in an error, with nothing unhandled", async (_name, kind, range) => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    const item = (await page()).body.item;
    const bytes = kind === "clip" ? CLIP_BYTES : ZIP_BYTES;
    const digest = kind === "clip" ? String(companyClip().digest) : ZIP_DIGEST;
    serveUpstream((_url, asked) => ({ status: asked ? 206 : 200, body: upstream([bytes.subarray(0, 4), bytes.subarray(4, 8)], "error").stream,
      headers: { "content-length": String(bytes.length), "x-blueprint-artifact-sha256": digest,
        ...(asked ? { "content-range": `bytes 0-${bytes.length - 1}/${bytes.length}` } : {}) } }));
    const url = kind === "clip" ? item.video.url : item.simulationDownload.url;
    expect(await readsToError(url, range ? { range } : {})).toBe(true);
    await settle();
    expect(uncaught).toEqual([]);
    // The server is still up and serves the next request.
    expect((await page()).status).toBe(200);
  });

  it.each(cases)("%s: a Pipeline that stalls mid-body ends the response at the idle timeout and cancels the upstream read",
    async (_name, kind, range) => {
      vi.stubEnv("COMPANY_MEDIA_IDLE_TIMEOUT_MS", "200");
      state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
      const item = (await page()).body.item;
      const bytes = kind === "clip" ? CLIP_BYTES : ZIP_BYTES;
      const digest = kind === "clip" ? String(companyClip().digest) : ZIP_DIGEST;
      let made: ReturnType<typeof upstream> | null = null;
      serveUpstream((_url, asked) => {
        made = upstream([bytes.subarray(0, 4), bytes.subarray(4, 8)], "hang");
        return { status: asked ? 206 : 200, body: made.stream, headers: { "content-length": String(bytes.length), "x-blueprint-artifact-sha256": digest,
          ...(asked ? { "content-range": `bytes 0-${bytes.length - 1}/${bytes.length}` } : {}) } };
      });
      const url = kind === "clip" ? item.video.url : item.simulationDownload.url;
      const started = Date.now();
      expect(await readsToError(url, range ? { range } : {})).toBe(true);
      expect(Date.now() - started).toBeLessThan(4000);
      await vi.waitFor(() => expect(made?.state.cancelled).toBe(true), { timeout: 3000 });
      await settle();
      expect(uncaught).toEqual([]);
    });

  /** A healthy upstream of `size` bytes, in 64 KiB pieces as fast as it is asked; the package names its true digest. */
  function healthyUpstream(kind: "clip" | "simulation", size: number) {
    const bytes = Buffer.alloc(size, 7);
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (kind === "clip") {
      const { clip_digest: _old, ...value } = companyClip() as Record<string, unknown>;
      const clip = { ...value, digest, size_bytes: size };
      state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`),
        company_clip: { ...clip, clip_digest: crossRuntimeArtifactDigest(clip, "clip_digest") } });
    } else {
      state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`),
        company_simulation: simulationPackage({ digest, size_bytes: size }) });
    }
    serveUpstream((_url, asked) => {
      const match = asked ? /^bytes=(\d+)-(\d*)$/.exec(asked) : null;
      const first = match ? Number(match[1]) : 0, last = match?.[2] ? Number(match[2]) : size - 1;
      const part = bytes.subarray(first, last + 1);
      let at = 0;
      const stream = new ReadableStream<Uint8Array>({ pull(controller) {
        if (at >= part.length) return controller.close();
        const next = part.subarray(at, at + 64 * 1024); at += next.length; controller.enqueue(new Uint8Array(next));
      } });
      return { status: match ? 206 : 200, body: stream, headers: { "content-length": String(part.length), "x-blueprint-artifact-sha256": digest,
        "content-type": kind === "clip" ? "video/mp4" : "application/zip",
        ...(match ? { "content-range": `bytes ${first}-${last}/${size}` } : {}) } };
    });
    return { bytes };
  }
  /** Read with node's client: pause first for `firstPauseMs`, then after every piece for `eachPauseMs`. */
  async function readSlowly(url: string, headers: Record<string, string>, firstPauseMs: number, eachPauseMs = 0) {
    const http = await import("node:http");
    return new Promise<{ status: number; body: Buffer; ended: boolean }>(resolve => {
      const pieces: Buffer[] = [];
      const request = http.get(`${base}${url}`, { headers: { "sec-fetch-dest": "video", ...headers } }, response => {
        const done = (ended: boolean) => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(pieces), ended });
        response.pause();
        setTimeout(() => response.resume(), firstPauseMs);
        response.on("data", (piece: Buffer) => {
          pieces.push(piece);
          if (eachPauseMs) { response.pause(); setTimeout(() => response.resume(), eachPauseMs); }
        });
        response.on("end", () => done(true));
        response.on("error", () => done(false));
        response.on("aborted", () => done(false));
      });
      request.on("error", () => resolve({ status: 0, body: Buffer.alloc(0), ended: false }));
    });
  }
  const slowCases: Array<[string, "clip" | "simulation", string | null]> = [
    ["the video, whole file", "clip", null], ["the video, a range", "clip", "bytes=1-"],
    ["the simulation, whole file", "simulation", null], ["the simulation, a range", "simulation", "bytes=1-"],
  ];

  // Planner, 20:35Z, H1: time spent waiting for the company to read does not count toward the idle timeout.
  it.each(slowCases)("%s: a company that pauses longer than the idle timeout still gets every byte", async (_name, kind, range) => {
    vi.stubEnv("COMPANY_MEDIA_IDLE_TIMEOUT_MS", "300");
    const { bytes } = healthyUpstream(kind, 16 * 1024 * 1024);
    const item = (await page()).body.item;
    const url = kind === "clip" ? item.video.url : item.simulationDownload.url;
    const result = await readSlowly(url, range ? { range } : {}, 1500);
    const expected = range ? bytes.subarray(1) : bytes;
    expect(result.status).toBe(range ? 206 : 200);
    expect(result.ended).toBe(true);
    expect(result.body.length).toBe(expected.length);
    expect(createHash("sha256").update(result.body).digest("hex")).toBe(createHash("sha256").update(expected).digest("hex"));
    await settle();
    expect(uncaught).toEqual([]);
  }, 20_000);

  it.each(slowCases.filter(([, , range]) => range === null))("%s: a slow company that reads steadily still completes", async (_name, kind) => {
    vi.stubEnv("COMPANY_MEDIA_IDLE_TIMEOUT_MS", "300");
    const { bytes } = healthyUpstream(kind, 2 * 1024 * 1024);
    const item = (await page()).body.item;
    const url = kind === "clip" ? item.video.url : item.simulationDownload.url;
    const result = await readSlowly(url, {}, 0, 40);
    expect(result.ended).toBe(true);
    expect(createHash("sha256").update(result.body).digest("hex")).toBe(createHash("sha256").update(bytes).digest("hex"));
  }, 20_000);

  // Planner, 20:55Z, J3: one overall deadline per download, so a Pipeline that trickles is ended.
  it.each(slowCases)("%s: a Pipeline that trickles past the overall deadline is ended and its read cancelled", async (_name, kind, range) => {
    vi.stubEnv("COMPANY_MEDIA_IDLE_TIMEOUT_MS", "300");
    vi.stubEnv("COMPANY_MEDIA_DEADLINE_MS", "600");
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    const item = (await page()).body.item;
    const bytes = kind === "clip" ? CLIP_BYTES : ZIP_BYTES;
    const digest = kind === "clip" ? String(companyClip().digest) : ZIP_DIGEST;
    const trickle = { cancelled: false };
    serveUpstream((_url, asked) => {
      const part = asked ? bytes.subarray(1) : bytes;
      let at = 0;
      return { status: asked ? 206 : 200, headers: { "content-length": String(part.length), "x-blueprint-artifact-sha256": digest,
        ...(asked ? { "content-range": `bytes 1-${bytes.length - 1}/${bytes.length}` } : {}) },
        // One byte every 100 ms: never quiet long enough for the idle timer, and far slower than the deadline allows.
        body: new ReadableStream<Uint8Array>({ async pull(controller) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (at >= part.length) return controller.close();
          controller.enqueue(new Uint8Array(part.subarray(at, at + 1))); at += 1; },
          cancel() { trickle.cancelled = true; } }) };
    });
    const url = kind === "clip" ? item.video.url : item.simulationDownload.url;
    const started = Date.now();
    expect(await readsToError(url, range ? { range } : {})).toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(500);
    expect(Date.now() - started).toBeLessThan(4000);
    await vi.waitFor(() => expect(trickle.cancelled).toBe(true), { timeout: 3000 });
    await settle();
    expect(uncaught).toEqual([]);
  });

  // Planner, 20:55Z, J4: the drain half of the idle timer on its own. The upstream here ignores pause (as if it kept
  // sending), so the only thing that can stop the timer is the response needing drain while the company is not reading.
  it("does not count the Pipeline's quiet while the response needs drain (the drain half alone)", async () => {
    vi.stubEnv("COMPANY_MEDIA_IDLE_TIMEOUT_MS", "100");
    const { Readable, Writable } = await import("node:stream");
    const { finished } = await import("node:stream/promises");
    const { sendThrough } = await import("../routes/company-media");
    const body = new Readable({ read() {} });
    body.pause = function () { return this; };
    let reading: () => void = () => undefined;
    const companyReads = new Promise<void>(resolve => { reading = resolve; });
    let received = 0;
    const res = new Writable({ highWaterMark: 4, write(chunk: Buffer, _encoding, callback) {
      received += chunk.length; void companyReads.then(() => callback()); } });
    sendThrough(body, res as never, { jobId: ID, kind: "clip" });
    body.push(Buffer.alloc(64, 1));
    body.push(Buffer.alloc(64, 2));
    // The company does not read for four times the idle timeout, and the Pipeline sends nothing meanwhile.
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(res.writableNeedDrain).toBe(true);
    expect(body.destroyed).toBe(false);
    reading();
    body.push(Buffer.alloc(64, 3));
    body.push(null);
    await finished(res);
    expect(received).toBe(192);
  });

  it.each(cases)("%s: a company that goes away cancels the upstream read", async (_name, kind, range) => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    const item = (await page()).body.item;
    const bytes = kind === "clip" ? CLIP_BYTES : ZIP_BYTES;
    const digest = kind === "clip" ? String(companyClip().digest) : ZIP_DIGEST;
    let made: ReturnType<typeof upstream> | null = null;
    serveUpstream((_url, asked) => {
      made = upstream([bytes.subarray(0, 4), bytes.subarray(4, 8)], "hang");
      return { status: asked ? 206 : 200, body: made.stream, headers: { "content-length": String(bytes.length), "x-blueprint-artifact-sha256": digest,
        ...(asked ? { "content-range": `bytes 0-${bytes.length - 1}/${bytes.length}` } : {}) } };
    });
    const url = kind === "clip" ? item.video.url : item.simulationDownload.url;
    const controller = new AbortController();
    const response = await realFetch(`${base}${url}`, { signal: controller.signal, headers: { "sec-fetch-dest": "video", ...(range ? { range } : {}) } });
    const reader = response.body!.getReader();
    await reader.read();
    controller.abort();
    void response;
    await reader.cancel().catch(() => undefined);
    await vi.waitFor(() => expect(made?.state.cancelled).toBe(true), { timeout: 3000 });
    await settle();
    expect(uncaught).toEqual([]);
  });
});

describe("the simulation download against COMPANY_SIMULATION_CONTRACT.md section 2", () => {
  const ready = () => state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`),
    company_simulation: simulationPackage() });
  const answerWith = (status: number, body: Buffer | string, headers: Record<string, string>) => vi.stubGlobal("fetch", vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.startsWith("https://pipeline.invalid/")) return realFetch(input as never, init);
      return new Response(typeof body === "string" ? body : body, { status, headers });
    }));

  it("200: the whole zip, named by its version, private and not cached, with the signed read named by digest", async () => {
    ready();
    const url = (await page()).body.item.simulationDownload.url as string;
    const read = await media(url);
    expect(read.status).toBe(200);
    expect(read.bytes.equals(ZIP_BYTES)).toBe(true);
    expect(read.headers.get("content-type")).toBe("application/zip");
    expect(read.headers.get("cache-control")).toBe("private, no-store");
    expect(read.headers.get("x-content-type-options")).toBe("nosniff");
    // `simulation-<first 8 hex of the package digest>.zip`: an old and a new package never share a name.
    expect(read.headers.get("content-disposition")).toBe(`attachment; filename="simulation-${ZIP_VERSION}.zip"`);
    const pipelineUrl = new URL(pipelineReads.at(-1)!.url);
    expect(pipelineUrl.pathname).toBe(`/api/live-pipeline/website-company-simulations/${CAPTURE}/simulation.zip`);
    expect(Object.fromEntries(pipelineUrl.searchParams)).toEqual({ request_id: ID, digest: ZIP_DIGEST });
  });

  it("206 and 416: a resumed download's range is passed through, and so is a range past the end", async () => {
    ready();
    const url = (await page()).body.item.simulationDownload.url as string;
    const part = await media(url, { range: "bytes=3-6" });
    expect(part.status).toBe(206);
    expect(part.bytes.toString()).toBe("ZIP-");
    expect(part.headers.get("content-range")).toBe(`bytes 3-6/${ZIP_BYTES.length}`);
    expect(pipelineReads.at(-1)!.range).toBe("bytes=3-6");
    const past = await media(url, { range: `bytes=${ZIP_BYTES.length + 5}-` });
    expect(past.status).toBe(416);
    expect(past.headers.get("content-range")).toBe(`bytes */${ZIP_BYTES.length}`);
  });

  it("403, 404 and 503 from the Pipeline: not available (right now), never the Pipeline's words", async () => {
    ready();
    const url = (await page()).body.item.simulationDownload.url as string;
    answerWith(403, JSON.stringify({ detail: "website company simulation issuer not authorized" }), { "content-type": "application/json" });
    const refused = await media(url);
    expect(refused.status).toBe(503);
    expect(refused.bytes.toString()).toContain("The simulation is not available right now.");
    answerWith(404, JSON.stringify({ detail: "website_company_simulation_unavailable" }), { "content-type": "application/json" });
    const gone = await media(url);
    expect(gone.status).toBe(404);
    expect(gone.bytes.toString()).not.toContain("website_company_simulation_unavailable");
    answerWith(503, JSON.stringify({ detail: "website_company_simulation_storage_unavailable" }), { "content-type": "application/json" });
    expect((await media(url)).status).toBe(503);
  });

  it("refuses an answer without the stored digest, another size, a range of another total, and aborts bytes that do not hash", async () => {
    ready();
    const url = (await page()).body.item.simulationDownload.url as string;
    answerWith(200, ZIP_BYTES, { "content-length": String(ZIP_BYTES.length) });
    expect((await media(url)).status).toBe(503);
    answerWith(200, Buffer.from("PK-ZIP-BYTES-AND-MORE"), { "x-blueprint-artifact-sha256": ZIP_DIGEST });
    expect((await media(url)).status).toBe(503);
    answerWith(206, ZIP_BYTES.subarray(0, 4), { "content-range": "bytes 0-3/999", "content-length": "4", "x-blueprint-artifact-sha256": ZIP_DIGEST });
    expect((await media(url, { range: "bytes=0-3" })).status).toBe(503);
    // Right digest header and size, but other bytes: the stream is cut before it ends, so no whole file arrives.
    answerWith(200, Buffer.from("XX-ZIP-BYTES"), { "content-length": String(ZIP_BYTES.length), "x-blueprint-artifact-sha256": ZIP_DIGEST });
    const cut = await realFetch(`${base}${url}`).then(async response => {
      const outcome = { status: response.status, bytes: -1, failed: false };
      try { outcome.bytes = (await response.arrayBuffer()).byteLength; } catch { outcome.failed = true; }
      return outcome;
    }, () => ({ status: 0, bytes: -1, failed: true }));
    expect(cut.failed || cut.bytes < ZIP_BYTES.length).toBe(true);
    // And the right bytes do complete.
    answerWith(200, ZIP_BYTES, { "content-length": String(ZIP_BYTES.length), "x-blueprint-artifact-sha256": ZIP_DIGEST });
    expect((await media(url)).bytes.equals(ZIP_BYTES)).toBe(true);
  });

  // Ported from the re-check's probe, which asserted the gap (a complete wrong file through `Range: bytes=0-`); flipped.
  it("a range covering the whole file is read whole and hashed: wrong bytes never complete the file", async () => {
    ready();
    const item = (await page()).body.item;
    const wrong = Buffer.from("XX-XXX-XXXXX");
    const rawFetch = async (url: string, headers: Record<string, string>) => {
      let response: Response;
      try { response = await realFetch(`${base}${url}`, { headers: { "sec-fetch-dest": "empty", ...headers } }); }
      catch (error) { return { status: 0, bytes: null as Buffer | null, error }; }
      try { return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()), error: null as unknown }; }
      catch (error) { return { status: response.status, bytes: null as Buffer | null, error }; }
    };
    // The re-check's stub: the Pipeline answers a part (206) of the right total with wrong bytes.
    answerWith(206, wrong, { "content-length": String(wrong.length), "content-range": `bytes 0-${wrong.length - 1}/${wrong.length}`,
      "x-blueprint-artifact-sha256": ZIP_DIGEST });
    for (const range of ["bytes=0-", `bytes=0-${ZIP_BYTES.length - 1}`]) {
      const read = await rawFetch(item.simulationDownload.url, { range });
      expect(read.bytes?.equals(wrong) ?? false).toBe(false);
      expect(read.status).not.toBe(206);
    }
    // The Pipeline answers the whole read (as it does when no range is sent) with wrong bytes: cut before the end.
    answerWith(200, wrong, { "content-length": String(wrong.length), "x-blueprint-artifact-sha256": ZIP_DIGEST });
    const cut = await rawFetch(item.simulationDownload.url, { range: "bytes=0-" });
    expect(cut.error !== null || (cut.bytes?.length ?? 0) < wrong.length).toBe(true);
    // The right bytes, asked as bytes=0-, arrive whole as a 200.
    answerWith(200, ZIP_BYTES, { "content-length": String(ZIP_BYTES.length), "x-blueprint-artifact-sha256": ZIP_DIGEST });
    const right = await rawFetch(item.simulationDownload.url, { range: "bytes=0-" });
    expect(right).toMatchObject({ status: 200 });
    expect(right.bytes?.equals(ZIP_BYTES)).toBe(true);
    // The video too: a player's first request (bytes=0-) is read whole and hashed.
    answerWith(200, Buffer.from("X".repeat(CLIP_BYTES.length)), { "content-length": String(CLIP_BYTES.length),
      "x-blueprint-artifact-sha256": String(companyClip().digest) });
    const video = await rawFetch(item.video.url, { range: "bytes=0-", "sec-fetch-dest": "video" });
    expect(video.error !== null || (video.bytes?.length ?? 0) < CLIP_BYTES.length).toBe(true);
  });

  it("a technology partner, a job that may not be shared and a withdrawn job get no download and no tested answer", async () => {
    ready();
    const url = (await page()).body.item.simulationDownload.url as string;
    expect((await media(url.replace(/viewer=[a-f0-9]+/, `viewer=${sha(TECH.email)}`))).status).toBe(404);
    expect((await answer(TECH, { state: "tested_can_do" })).status).toBe(403);
    // A job whose recording statement does not share it (an older statement).
    patchJob({ request: { ...jobDoc().request, consent_attestation: { ...sharedRecordingGrant(), statement_version: "2026-11-11.v3" } } });
    expect((await media(url)).status).toBe(404);
    expect((await page()).status).toBe(404);
    expect((await answer(NORTH, { state: "tested_can_do" })).status).toBe(409);
    // Withdrawn.
    patchJob({ request: { ...jobDoc().request, consent_attestation: sharedRecordingGrant() }, consent_revoked: true });
    expect((await media(url)).status).toBe(404);
  });

  it("an invalid stored reference reads as not finished yet: no button and no tested answers", async () => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`),
      company_simulation: { ...simulationPackage(), size_bytes: 600_000_000 } });
    expect((await page()).body.item.simulationDownload).toEqual({ state: "not_finished" });
    expect((await answer(NORTH, { state: "tested_can_do" })).status).toBe(409);
  });
});

/* ----------------------------------------------------------------- the current Terms before any job (planner, 18:50Z) */

describe("a company must accept the current Terms and Privacy Policy before it sees any job", () => {
  const variants: Array<[string, Record<string, unknown>]> = [
    ["no acceptance", { termsAcceptance: undefined }],
    ["an older version", { termsAcceptance: { ...currentTermsAcceptance(), terms_version: "2026-11-02.1", privacy_version: "2026-11-02.1" } }],
    ["only the Terms, not the Privacy Policy", { termsAcceptance: { ...currentTermsAcceptance(), privacy_version: "2026-11-02.1" } }],
  ];
  const withoutTerms = (patch: Record<string, unknown>) => {
    const record: Record<string, unknown> = { ...NORTH, ...patch };
    if (patch.termsAcceptance === undefined) delete record.termsAcceptance;
    state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, record);
  };
  async function accept(record = NORTH) {
    const response = await realFetch(`${base}/api/robot-team-access/accept-terms`, { method: "POST",
      headers: { ...signIn(record), "content-type": "application/json" },
      body: JSON.stringify({ acceptedTerms: true, termsVersion: "2026-11-12.2", privacyVersion: "2026-11-13.1" }) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  }

  it.each(variants)("with %s: every surface answers terms_acceptance_required and carries nothing of any job; after accepting, all work", async (_name, patch) => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    const item = (await page()).body.item;
    withoutTerms(patch);
    const refusals = [await list(), await page(), await summary()].map(({ status, raw }) => ({ status, raw }));
    for (const url of [item.video.url, item.simulationDownload.url, sceneContentUrl(item.simulation.viewerUrl)]) {
      const read = await media(url, { "sec-fetch-dest": "empty" });
      refusals.push({ status: read.status, raw: read.bytes.toString() });
    }
    const answered = await answer(NORTH);
    refusals.push({ status: answered.status, raw: JSON.stringify(answered.body) });
    for (const refusal of refusals) {
      expect(refusal.status).toBe(403);
      expect(JSON.parse(refusal.raw)).toMatchObject({ code: "terms_acceptance_required",
        error: "Before you see jobs, read and agree to our Terms and Privacy Policy." });
      // Plant-and-prove: nothing of any job, not even a count.
      expect(refusal.raw).not.toMatch(/req-e2|Carton|palletiz|items|Stack|United States|video\.mp4|simulation\.zip|PK-ZIP|0123456789|%PDF/);
      expectNoSiteIn("the refusal", refusal.raw);
    }
    expect(state.docs.has(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`)).toBe(false);
    // Accepting records the current versions on the account and the access record, then everything works.
    expect(await accept()).toMatchObject({ status: 200, body: { ok: true, termsVersion: "2026-11-12.2", privacyVersion: "2026-11-13.1" } });
    expect(state.docs.get(`users/uid-${NORTH.email}`)).toMatchObject({ acceptedTerms: true, termsVersion: "2026-11-12.2",
      privacyVersion: "2026-11-13.1", termsAcceptance: { accepted_terms: true, terms_version: "2026-11-12.2" } });
    expect((state.docs.get(`robotTeamAccess/${sha(NORTH.email)}`) as Record<string, any>).termsAcceptance)
      .toMatchObject({ accepted_terms: true, terms_version: "2026-11-12.2", privacy_version: "2026-11-13.1" });
    expect((await page()).status).toBe(200);
    expect((await list()).body.items).toHaveLength(1);
    expect((await media(item.video.url)).status).toBe(200);
    expect((await answer(NORTH)).status).toBe(200);
  });

  it("refuses the accept route to anyone who is not an approved deployment company", async () => {
    expect((await accept(TECH)).status).toBe(403);
    expect((await accept(PENDING)).status).toBe(403);
  });

  it("the automatic send and the dispatch gates leave out a company that has not accepted", async () => {
    withoutTerms({ termsAcceptance: undefined });
    const result = await sendJobToApprovedCompanies(ID);
    // Five of the six deployment companies: NORTH is not counted, gets no row and no email.
    expect(result).toMatchObject({ sent: true, count: 5 });
    expect(state.docs.has(`inboundRequests/${ID}/companySends/system-${sha(NORTH.email)}`)).toBe(false);
    expect(outbox().filter(row => row.kind === "robot_team_new_task").map(row => row.to)).not.toContain(NORTH.email);
    // A new-job email queued while it had accepted, and an introduction to it, are cancelled at dispatch once its
    // acceptance is no longer current.
    state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, NORTH);
    state.docs.set(`captureOutbox/robot_team_new_task:${ID}:${sha(NORTH.email)}`, { idempotencyKey: `robot_team_new_task:${ID}:${sha(NORTH.email)}`,
      requestId: ID, kind: "robot_team_new_task", to: NORTH.email, subject: "New job on Blueprint", body: "x", status: "pending", attempts: 0,
      nextAttemptAtMs: 0, jobAlert: { schema: "job-alert-2026-11-12", jobId: ID, companyId: sha(NORTH.email) } });
    await interested(NORTH);
    expect(await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION },
      { siteEmail })).toMatchObject({ ok: true });
    withoutTerms({ termsAcceptance: { ...currentTermsAcceptance(), terms_version: "2026-11-02.1" } });
    await deliverOutbox({ limit: 50 });
    const { outboxRecipientMatches } = await import("../utils/captureOutbox");
    expect(outbox().find(row => row.kind === "robot_team_new_task" && outboxRecipientMatches(row, NORTH.email))).toMatchObject({ status: "cancelled", to: "", body: "" });
    expect(outbox().find(row => row.kind === "introduction_made_company")).toMatchObject({ status: "cancelled" });
    expect(seams.sendEmail.mock.calls.map(([message]) => message.to)).not.toContain(NORTH.email);
    // And no new introduction can be asked for it.
    expect((await loadSiteCompanyActivity(ID)).entries.find(entry => entry.alias === "Company A")).toMatchObject({ canIntroduce: false });
  });

  // Audit B-03: a company that accepts after a job was sent is emailed once about the jobs open to it. The accept route
  // calls `emailOpenJobsToCompany` after recording the acceptance (its rate limit leaves no room for more calls here).
  it("emails a company that accepts after a job was sent, once, through the new-job email's dispatch gate", async () => {
    const { emailOpenJobsToCompany } = await import("../utils/jobAutoSend");
    withoutTerms({ termsAcceptance: undefined });
    await sendJobToApprovedCompanies(ID);
    expect(await emailOpenJobsToCompany(sha(NORTH.email))).toBe(false);
    state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, NORTH);
    expect(await emailOpenJobsToCompany(sha(NORTH.email))).toBe(true);
    const open = outbox().filter(row => row.key === `robot_team_open_jobs:${sha(NORTH.email)}`);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ kind: "robot_team_new_task", to: NORTH.email, subject: "Jobs on Blueprint you can open now",
      jobAlert: { jobId: ID, companyId: sha(NORTH.email) } });
    expect(open[0].body).toMatch(/^Sites posted jobs before you could see them\. Open Find jobs to see each job packet and respond\.\n\nFind jobs:\nhttps:\/\/\S+\/contact\/robot-team\n/);
    expectNoSiteIn("the open-jobs email", JSON.stringify(open));
    const { jobAlertIsCurrent } = await import("../utils/newJobAlerts");
    const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
    expect(await sharedFakeFirestore.runTransaction(tx => jobAlertIsCurrent(open[0] as never, tx as never))).toBe(true);
    // Once: a second acceptance adds nothing.
    expect(await emailOpenJobsToCompany(sha(NORTH.email))).toBe(false);
    expect(outbox().filter(row => row.key.startsWith("robot_team_open_jobs:"))).toHaveLength(1);
  });

  it("sends no open-jobs email when no job was sent yet, or to a company that was on every send", async () => {
    const { emailOpenJobsToCompany } = await import("../utils/jobAutoSend");
    expect(await emailOpenJobsToCompany(sha(NORTH.email))).toBe(false);
    await sendJobToApprovedCompanies(ID);
    expect(await emailOpenJobsToCompany(sha(NORTH.email))).toBe(false);
    expect(outbox().filter(row => row.key.startsWith("robot_team_open_jobs:"))).toHaveLength(0);
  });
});

it("ids are the access record ids", () => expect(accessRecordId(NORTH.email)).toBe(sha(NORTH.email)));
