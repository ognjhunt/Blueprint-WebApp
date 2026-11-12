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

describe("the company's page for one job (E3)", () => {
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

  it("says the video is being prepared, and the simulation is not finished, until each exists", async () => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, {});
    const { body } = await page();
    expect(body.item.video).toEqual({ state: "preparing" });
    expect(body.item.simulation).toEqual({ state: "not_finished" });
  });

  it("is for a signed-in, approved account only", async () => {
    expect((await realFetch(`${base}/api/site-worlds/jobs/${ID}`)).status).toBe(404);
    expect((await page(PENDING)).status).toBe(404);
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
    expect(state.docs.get(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`))
      .toMatchObject({ state: "interested", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION, recordedBy: "company" });
    expect((await page()).body.item.myAnswer).toMatchObject({ state: "interested", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION });
    // The site is queued one email by alias and fixed label only; no person at Blueprint is rung.
    const queued = outbox();
    expect(queued.map(row => row.key)).toEqual([`${ID}:company_answered:A-interested`]);
    expect(queued[0]).toMatchObject({ to: SITE.email, subject: "A deployment company answered" });
    expect(JSON.stringify(queued)).not.toMatch(/North|contact@north|We do this every day/);
  });

  it("lists the job in the library with its page link and nothing that names the site", async () => {
    const { body, raw } = await list();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: ID, jobUrl: `/jobs/${ID}`, region: "" });
    expectNoSiteIn("the library list", raw);
  });

  it("is not listed without the site's sentence, or before the privacy screen, or under an older statement", async () => {
    state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: "Your site task", confirmedAtIso: null });
    expect((await page()).status).toBe(404);
    state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: SENTENCE, confirmedAtIso: null });
    patchJob({ capture_privacy_screen: { ...passedPrivacyScreen(ID), proceeded: false, eligibility: "pending" } });
    expect((await page()).status).toBe(404);
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
  ["an authority end", () => state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`),
    website_preparation: { selector: { request_id: ID, capture_id: CAPTURE }, status: { state: "authority_ended" } } })],
  ["the site closing its job", () => patchJob({ website_run_closures: { [CAPTURE]: { closed_at_iso: "2026-11-12T12:00:00.000Z" } } })],
  ["the company's approval withdrawn", () => state.docs.set(`robotTeamAccess/${sha(NORTH.email)}`, { ...NORTH, status: "declined" })],
];

describe("every stop closes everything a company can see (E2)", () => {
  it.each(STOPS)("%s closes the card, the page, both media routes, the answer route and introductions", async (_name, stop) => {
    const before = (await page()).body.item;
    expect((await answer(NORTH)).status).toBe(200);
    stop();
    expect((await page()).status).toBe(404);
    expect((await list()).body.items).toEqual([]);
    expect((await media(before.video.url)).status).toBe(404);
    expect((await media(sceneContentUrl(before.simulation.viewerUrl), { "sec-fetch-dest": "empty" })).status).toBe(404);
    expect((await answer(NORTH, { state: "declined" })).status).not.toBe(200);
    const result = await requestIntroduction({ requestId: ID, alias: "A", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail: () => ({ subject: "s", body: "b" }) });
    expect(result.ok).toBe(false);
    expect(state.docs.has(`inboundRequests/${ID}/introductions/${sha(NORTH.email)}`)).toBe(false);
  });
});

/* ----------------------------------------------------------------- the automatic send */

describe("the automatic send (E4)", () => {
  it("records one system send per approved deployment company and emails only those that asked and are not suppressed", async () => {
    const result = await sendJobToApprovedCompanies(ID);
    const deployment = [NORTH, SOUTH, EAST, WEST, QUIET, MUTED];
    expect(result).toMatchObject({ sent: true, count: deployment.length, emailed: 4 });
    const sends = [...state.docs.entries()].filter(([key]) => key.startsWith(`inboundRequests/${ID}/companySends/`));
    expect(sends.map(([, value]) => (value as any).companyId).sort()).toEqual(deployment.map(record => sha(record.email)).sort());
    expect(sends.every(([key, value]) => (value as any).sentBy === "system" && key.endsWith(`system-${(value as any).companyId}`))).toBe(true);
    const alerts = outbox().filter(row => row.kind === "robot_team_new_task");
    expect(alerts.map(row => row.to).sort()).toEqual([NORTH, SOUTH, EAST, WEST].map(record => record.email).sort());
    expect(alerts[0]).toMatchObject({ subject: "New job on Blueprint" });
    expect(alerts[0].body).toMatch(/^A site has filmed a job and is looking for a deployment company\. Watch the video and answer in a minute: interested, not a fit, or would need something\.\n\nhttps:\/\/\S+\/jobs\/req-e2\n/);
    expect(alerts[0].body).toMatch(/Unsubscribe from optional updates emails: /);
    expectNoSiteIn("the new-job emails", JSON.stringify(alerts));
    // The site's one email.
    expect(outbox().filter(row => row.kind === "job_sent").map(row => row.key)).toEqual([`${ID}:job_sent:companies`]);
    expect(jobDoc().company_auto_send).toMatchObject({ schemaVersion: 1, count: 6 });
    // The site's page reports the count and the first date.
    expect((await loadSiteCompanyActivity(ID)).sent).toEqual({ count: 6, firstAtIso: result.sent ? result.sentAtIso : "" });
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
    state.docs.set(`robotTeamAccess/${sha(SOUTH.email)}`, { ...SOUTH, newJobAlertsOptIn: false });
    state.docs.set(`robotTeamAccess/${sha(EAST.email)}`, { ...EAST, status: "declined" });
    state.docs.set(`email_suppressions/${WEST.email}`, { global_suppressed: true });
    await deliverOutbox({ limit: 50 });
    const delivered = seams.sendEmail.mock.calls.map(([message]) => String(message.to));
    expect(delivered.filter(to => to.endsWith(".example") && to.startsWith("contact@"))).toEqual([NORTH.email]);
    const status = (to: string) => outbox().find(row => row.kind === "robot_team_new_task" && row.to === to)?.status;
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
      subject: "A site wants to talk about its job", replyTo: SITE.email });
    for (const detail of [SITE.name, `${SITE.first} ${SITE.last}`, SITE.email, SITE.address, `/jobs/${ID}`]) expect(toCompany.body).toContain(detail);
    // The company's email goes first (H2), so it says the site's email is on its way, not that it has gone (J2).
    expect(toCompany.body).toContain("We are sending the site your company's name and your contact details now. Reply to them directly.");
    expect(toCompany.body).not.toMatch(/We have given the site/);
    expect(outbox().find(row => row.kind === "introduction_made_site")).toMatchObject({ key: `${ID}:introduction_made_site:${companyId}`,
      to: SITE.email, subject: "Meet the company", replyTo: NORTH.email });
    // Nothing else a company can see names the site.
    expectNoSiteIn("the page after an introduction", (await page(SOUTH)).raw);
    expectNoSiteIn("every email to a company but the chosen one", JSON.stringify(outbox().filter(row => row.to !== NORTH.email && row.to !== SITE.email)));
    // The site's view now carries the company's details on that answer only.
    const activity = await loadSiteCompanyActivity(ID);
    expect(activity.introductions).toEqual({ used: 1 });
    expect(activity.entries).toEqual([expect.objectContaining({ alias: "Company A", canIntroduce: false,
      introducedAtIso: "2026-11-12T15:00:00.000Z", company: { name: NORTH.company, contactName: NORTH.name, email: NORTH.email, website: NORTH.website } })]);
  });

  it("before an introduction the site sees aliases only, and may introduce each Interested company that answered under the new line", async () => {
    await interested(NORTH, SOUTH);
    expect((await answer(EAST, { state: "declined" })).status).toBe(200);
    const activity = await loadSiteCompanyActivity(ID);
    expect(JSON.stringify(activity)).not.toMatch(/North|South|East|contact@/);
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
    expect(labels).toEqual(["Tested it: can do", "Interested"]);
    // And the site side's real email words it (no stub).
    await interested(EAST);
    expect(await requestIntroduction({ requestId: ID, alias: "C", actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }))
      .toMatchObject({ ok: true });
    const toSite = outbox().filter(row => row.kind === "introduction_made_site").map(row => String(row.body));
    expect(toSite.at(-1)).toContain("Interested");
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

  it("serves the package to the viewer's ticket only, accepts a tested answer, and introduces on tested_can_do", async () => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    const url = (await page()).body.item.simulationDownload.url as string;
    expect(url).toMatch(new RegExp(`^/api/company-media/jobs/${ID}/simulation\\.zip\\?`));
    const download = await media(url);
    expect(download.status).toBe(200);
    expect(download.bytes.toString()).toBe("PK-ZIP-BYTES");
    expect(download.headers.get("content-disposition")).toBe('attachment; filename="simulation.zip"');
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

/* ----------------------------------------------------------------- the independent review's findings, as assertions */

const { teamJobAccess, loadCompanyJobAccess } = await import("../utils/teamJobAccess");
const { recordCompanySend } = await import("../utils/jobCompanies");

describe("review findings (must-fix and should-fix)", () => {
  it("must-fix 1: a technology partner gets no page, no video, no download, no answer and no introduction", async () => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    const north = (await page()).body.item;
    expect((await page(TECH)).status).toBe(404);
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
    expect(COMPANY_RESPONSE_STATEMENT).toBe("The site is told your answer. If you answer Interested or Tested it: can do and the "
      + "site asks for an introduction, we give the site your company's name and your contact details, and give you theirs.");
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    expect((await answer(NORTH, { state: "tested_can_do" })).status).toBe(200);
    await interested(SOUTH);
    for (const alias of ["A", "B"]) expect(await requestIntroduction({ requestId: ID, alias, actor: "site", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION }, { siteEmail })).toMatchObject({ ok: true });
    const bodyTo = (email: string) => outbox().find(row => row.kind === "introduction_made_company" && row.to === email)!.body as string;
    expect(bodyTo(NORTH.email)).toContain("You answered Tested it: can do to a job on Blueprint");
    expect(bodyTo(SOUTH.email)).toContain("You answered Interested to a job on Blueprint");
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

  it("should-fix: an operator send uses the whole rule (no sentence: refused)", async () => {
    state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: "Your site task", confirmedAtIso: null });
    expect((await loadCompanyJobAccess(ID)).access.listed).toBe(false);
    await expect(recordCompanySend(ID, sha(NORTH.email), { uid: "ops", email: "ops@example.com" })).rejects.toMatchObject({ code: "not_visible" });
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

  it("200: the whole zip, as simulation.zip, private and not cached, with the signed read named by digest", async () => {
    ready();
    const url = (await page()).body.item.simulationDownload.url as string;
    const read = await media(url);
    expect(read.status).toBe(200);
    expect(read.bytes.equals(ZIP_BYTES)).toBe(true);
    expect(read.headers.get("content-type")).toBe("application/zip");
    expect(read.headers.get("cache-control")).toBe("private, no-store");
    expect(read.headers.get("x-content-type-options")).toBe("nosniff");
    expect(read.headers.get("content-disposition")).toBe('attachment; filename="simulation.zip"');
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
      body: JSON.stringify({ acceptedTerms: true, termsVersion: "2026-11-12.2", privacyVersion: "2026-11-12.2" }) });
    return { status: response.status, body: await response.json() as Record<string, any> };
  }

  it.each(variants)("with %s: every surface answers terms_acceptance_required and carries nothing of any job; after accepting, all work", async (_name, patch) => {
    state.docs.set(`captureUploadSessions/${CAPTURE}`, { ...state.docs.get(`captureUploadSessions/${CAPTURE}`), company_simulation: simulationPackage() });
    const item = (await page()).body.item;
    withoutTerms(patch);
    const refusals = [await list(), await page()].map(({ status, raw }) => ({ status, raw }));
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
      expect(refusal.raw).not.toMatch(/req-e2|Carton|palletiz|items|Stack|United States|video\.mp4|simulation\.zip|PK-ZIP|0123456789/);
      expectNoSiteIn("the refusal", refusal.raw);
    }
    expect(state.docs.has(`inboundRequests/${ID}/robotTeamInterest/${sha(NORTH.email)}`)).toBe(false);
    // Accepting records the current versions on the account and the access record, then everything works.
    expect(await accept()).toMatchObject({ status: 200, body: { ok: true, termsVersion: "2026-11-12.2", privacyVersion: "2026-11-12.2" } });
    expect(state.docs.get(`users/uid-${NORTH.email}`)).toMatchObject({ acceptedTerms: true, termsVersion: "2026-11-12.2",
      privacyVersion: "2026-11-12.2", termsAcceptance: { accepted_terms: true, terms_version: "2026-11-12.2" } });
    expect((state.docs.get(`robotTeamAccess/${sha(NORTH.email)}`) as Record<string, any>).termsAcceptance)
      .toMatchObject({ accepted_terms: true, terms_version: "2026-11-12.2", privacy_version: "2026-11-12.2" });
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
    expect(outbox().find(row => row.kind === "robot_team_new_task" && row.to === NORTH.email)).toMatchObject({ status: "cancelled" });
    expect(outbox().find(row => row.kind === "introduction_made_company")).toMatchObject({ status: "cancelled" });
    expect(seams.sendEmail.mock.calls.map(([message]) => message.to)).not.toContain(NORTH.email);
    // And no new introduction can be asked for it.
    expect((await loadSiteCompanyActivity(ID)).entries.find(entry => entry.alias === "Company A")).toMatchObject({ canIntroduce: false });
  });
});

it("ids are the access record ids", () => expect(accessRecordId(NORTH.email)).toBe(sha(NORTH.email)));
