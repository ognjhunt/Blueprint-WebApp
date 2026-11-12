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
 * - `requestIntroduction` returns each refusal in its case, refuses a fourth, and writes the introduction, the
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
import { passedPrivacyScreen, sharedJobListing, sharedRecordingGrant } from "./helpers/sharedJob";
import { COMPANY_RESPONSE_STATEMENT, COMPANY_RESPONSE_STATEMENT_VERSION } from "../../client/src/lib/companyResponses";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", async importOriginal => ({ ...await importOriginal<typeof import("../utils/field-encryption")>(),
  decryptFieldValue: vi.fn(async (value: unknown) => String(value ?? "").replace(/^encrypted:/, "")) }));
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
    const allowed = record?.status === "approved";
    return { access: { gated: true, status: record?.status ?? "none", signedIn: true, emailVerified: true, allowed, staff: false },
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
      siteLocation: `encrypted:${SITE.address}`, siteLocationMetadata: { formattedAddress: `encrypted:${SITE.address}`, country: `encrypted:${SITE.country}` },
      consent_attestation: sharedRecordingGrant() },
    site_address: SITE.address,
    public_task_listing: sharedJobListing("Stack cartons onto the pallet"),
    capture_privacy_screen: passedPrivacyScreen(ID),
    ...extra,
  };
}

function company(tag: string, extra: Record<string, unknown> = {}) {
  return { partnerRole: "deployment", name: `Person ${tag}`, email: `contact@${tag.toLowerCase()}.example`, company: `${tag} Robotics`,
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
    if (url.includes("/website-company-simulations/")) return new Response(Buffer.from("PK-ZIP-BYTES"), { status: 200,
      headers: { "content-type": "application/zip", "content-length": "12", "x-blueprint-artifact-sha256": `sha256:${"9".repeat(64)}` } });
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
    // Opening it as a page is refused: view only.
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
    const result = await requestIntroduction({ requestId: ID, alias: "A", actor: "site" }, { siteEmail: () => ({ subject: "s", body: "b" }) });
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
    const before = JSON.stringify([...state.docs.entries()]);
    expect(await sendJobToApprovedCompanies(ID)).toEqual({ sent: false, reason: "already_sent" });
    expect(await sweepAutomaticSends()).toEqual({ examined: 0, sent: 0 });
    expect(JSON.stringify([...state.docs.entries()])).toBe(before);
  });

  it("the sweep catches a listed job that was never sent, and sends nothing for one that is not listed", async () => {
    patchJob({ operator_listing_hold: { held: true } });
    expect(await sweepAutomaticSends()).toEqual({ examined: 1, sent: 0 });
    expect(outbox()).toEqual([]);
    patchJob({ operator_listing_hold: { held: false } });
    expect(await sweepAutomaticSends()).toEqual({ examined: 1, sent: 1 });
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
    const result = await requestIntroduction({ requestId: ID, alias: "Company A", actor: "site" },
      { siteEmail, now: () => new Date("2026-11-12T15:00:00.000Z") });
    expect(result).toEqual({ ok: true, introducedAtIso: "2026-11-12T15:00:00.000Z" });
    const companyId = sha(NORTH.email);
    expect(state.docs.get(`inboundRequests/${ID}/introductions/${companyId}`)).toEqual({ schemaVersion: 1, alias: "A",
      requestedAtIso: "2026-11-12T15:00:00.000Z", by: "site",
      siteShared: { name: SITE.name, contactName: `${SITE.first} ${SITE.last}`, email: SITE.email, location: SITE.address },
      companyShared: { company: NORTH.company, contactName: NORTH.name, email: NORTH.email, website: NORTH.website }, outcomes: [] });
    expect(state.docs.get(`billableEvents/introduction-${ID}-${companyId}`)).toEqual({ kind: "introduction", requestId: ID, companyId,
      atIso: "2026-11-12T15:00:00.000Z", priceUsd: null, status: "recorded_no_price" });
    const toCompany = outbox().find(row => row.kind === "introduction_made_company")!;
    expect(toCompany).toMatchObject({ key: `${ID}:introduction_made_company:${companyId}`, to: NORTH.email,
      subject: "A site wants to talk about its job", replyTo: SITE.email });
    for (const detail of [SITE.name, `${SITE.first} ${SITE.last}`, SITE.email, SITE.address, `/jobs/${ID}`]) expect(toCompany.body).toContain(detail);
    expect(outbox().find(row => row.kind === "introduction_made_site")).toMatchObject({ key: `${ID}:introduction_made_site:${companyId}`,
      to: SITE.email, subject: "Meet the company", replyTo: NORTH.email });
    // Nothing else a company can see names the site.
    expectNoSiteIn("the page after an introduction", (await page(SOUTH)).raw);
    expectNoSiteIn("every email to a company but the chosen one", JSON.stringify(outbox().filter(row => row.to !== NORTH.email && row.to !== SITE.email)));
    // The site's view now carries the company's details on that answer only.
    const activity = await loadSiteCompanyActivity(ID);
    expect(activity.introductions).toEqual({ used: 1, max: 3 });
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
    const ask = (alias: string) => requestIntroduction({ requestId: ID, alias, actor: "site" }, { siteEmail });
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

  it("allows three introductions per job and refuses a fourth", async () => {
    await interested(NORTH, SOUTH, EAST, WEST);
    for (const alias of ["A", "B", "C"]) expect(await requestIntroduction({ requestId: ID, alias, actor: "site" }, { siteEmail })).toMatchObject({ ok: true });
    expect(await requestIntroduction({ requestId: ID, alias: "D", actor: "site" }, { siteEmail })).toEqual({ ok: false, reason: "limit_reached" });
    expect([...state.docs.keys()].filter(key => key.startsWith(`inboundRequests/${ID}/introductions/`))).toHaveLength(3);
    expect([...state.docs.keys()].filter(key => key.startsWith("billableEvents/"))).toHaveLength(3);
    const activity = await loadSiteCompanyActivity(ID);
    expect(activity.introductions).toEqual({ used: 3, max: 3 });
    expect(activity.entries.find(entry => entry.alias === "Company D")).toMatchObject({ canIntroduce: false });
  });

  it("cancels the company's introduction email at dispatch once the site has withdrawn", async () => {
    await interested(NORTH);
    await requestIntroduction({ requestId: ID, alias: "A", actor: "site" }, { siteEmail });
    patchJob({ consent_revoked: true });
    await deliverOutbox({ limit: 50 });
    expect(outbox().find(row => row.kind === "introduction_made_company")).toMatchObject({ status: "cancelled" });
    expect(seams.sendEmail.mock.calls.map(([message]) => message.to)).not.toContain(NORTH.email);
  });
});

const simulationPackage = () => ({ schema_version: "website_company_simulation.v1", capture_id: CAPTURE, state: "ready",
  digest: `sha256:${"9".repeat(64)}`, size_bytes: 12 });

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
    expect(download.headers.get("content-disposition")).toBe('attachment; filename="blueprint-job-simulation.zip"');
    expect((await media(url.replace(/viewer=[a-f0-9]+/, `viewer=${sha(SOUTH.email)}`))).status).toBe(404);
    expect((await answer(NORTH, { state: "tested_can_do" })).status).toBe(200);
    expect((await answer(SOUTH, { state: "tested_cannot_yet" })).status).toBe(200);
    const activity = await loadSiteCompanyActivity(ID);
    expect(activity.entries.map(entry => [entry.alias, entry.kind === "answered" && entry.state, entry.kind === "answered" && entry.canIntroduce]))
      .toEqual([["Company A", "tested_can_do", true], ["Company B", "tested_cannot_yet", false]]);
    expect(await requestIntroduction({ requestId: ID, alias: "B", actor: "site" }, { siteEmail })).toEqual({ ok: false, reason: "not_interested" });
    expect(await requestIntroduction({ requestId: ID, alias: "A", actor: "site" }, { siteEmail })).toMatchObject({ ok: true });
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

it("ids are the access record ids", () => expect(accessRecordId(NORTH.email)).toBe(sha(NORTH.email)));
