// @vitest-environment node
/**
 * Everything a deployment company receives or can fetch, swept for the site's identity (Blueprint v1: a site's name,
 * street address and contact details are never shared without asking the site first; the site asks for an
 * introduction with one press per company, and only then does Blueprint email each side the other's details).
 * OFFLINE: the real routes, the real automatic send, the real outbox dispatch and the real introduction against the
 * fake Firestore; sign-in, email delivery and the Pipeline's signed reads are fakes.
 *
 * One site is planted with distinctive fake identity in every place the website stores it (contact, request, place
 * metadata, display metadata, top-level copies), in the site's own sentence and answers, in the video reader's free
 * text, in the capture session and in stored listing text. Then:
 * - before an introduction, nothing a company receives (library list, card, job page, every signed media link and
 *   its headers, the 3D viewer's files, the answer route, its own access state, every email the outbox sends it, the
 *   withdrawal notice) carries any planted value, nor ANY email address (other than Blueprint's and the recipient's
 *   own), phone number or street address (other than Blueprint's own postal line);
 * - after the site asks to meet one company, exactly one email carries the site's details: the introduction email to
 *   that company. Its pages still carry none; the other company gets nothing.
 */
import express from "express";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state, sharedFakeFirestore } from "./helpers/fake-firestore";
import { currentTermsAcceptance, passedPrivacyScreen, sharedRecordingGrant } from "./helpers/sharedJob";
import { INTRODUCTION_REQUEST_STATEMENT_VERSION } from "../../client/src/lib/siteIntroductions";
import { COMPANY_RESPONSE_STATEMENT_VERSION } from "../../client/src/lib/companyResponses";
import { COMPANY, COMPANY_POSTAL_LINE } from "../../client/src/data/company";
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
    const { companyMaySeeJobs } = await import("../utils/companyTerms");
    return { access: { gated: true, status: record?.status ?? "none", signedIn: true, emailVerified: true,
      allowed: companyMaySeeJobs(record), staff: false }, viewer: { uid: account.uid, email: account.email, companyId, staff: false } };
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
vi.mock("../utils/pipelineCompanyRecheck", () => ({ recheckCaptureInBackground: vi.fn(), askPipelineToRecheckCapture: vi.fn() }));

const { default: worldsRouter } = await import("../routes/site-worlds");
const { default: mediaRouter } = await import("../routes/company-media");
const { default: viewsRouter } = await import("../routes/website-atlas-preview-views");
const { default: accessRouter } = await import("../routes/robot-team-access");
const { sendJobToApprovedCompanies } = await import("../utils/jobAutoSend");
const { requestIntroduction } = await import("../utils/jobIntroductions");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { planWithdrawalCompanyNotices } = await import("../utils/withdrawalCompanyNotice");

const ID = "capture-6f0c2a1e-3b7d-4c55-9e21-8a4d0b6c1f99";
const CAPTURE = `walkthrough-${ID}`;
const sha = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

/* ----------------------------------------------------------------- the planted site */

const SITE = {
  siteName: "Zorblax Provisions", organisation: "Quillfeather Holdings", first: "Thaddeus", last: "Vexworthy",
  email: "thaddeus.vexworthy@zorblax-plant.example", phone: "+1 (628) 555-0199",
  street: "4417 Marrowbone Avenue", address: "4417 Marrowbone Avenue, Suite 12, Glimmerton, OR 97035",
  city: "Glimmerton", postalCode: "97035", placeId: "ChIJplantZorblaxPlace01", lat: 45.43219, lng: -122.76541,
};
/** Every value that names, places or reaches the site. None may reach a company before an introduction. */
const PLANTED = ["Zorblax", "Quillfeather", "Thaddeus", "Vexworthy", "zorblax-plant", "555-0199", "(628)", "Marrowbone",
  "Glimmerton", SITE.postalCode, "ChIJplant", "45.43219", "-122.76541", "Brindle", "Snorkwell"];
/** The site's own sentence, typing every one of them, a street we do not hold and spelled contact forms. */
const SENTENCE = "Stack 12 kg cartons onto the pallet at Zorblax Provisions (Quillfeather Holdings), "
  + "4417 Marrowbone Avenue, Suite 12, Glimmerton, OR 97035. Ask Thaddeus Vexworthy on +1 (628) 555-0199 or "
  + "thaddeus.vexworthy@zorblax-plant.example (thaddeus at zorblax-plant dot example). Overflow goes to 88 Brindle Road. "
  + "We stack 12 cartons on 3 pallets in aisle 4, 2 shifts, 24/7.";

function plantedJob(extra: Record<string, unknown> = {}) {
  const enc = (value: string) => `encrypted:${value}`;
  return {
    requestId: ID,
    contact: { email: enc(SITE.email), firstName: enc(SITE.first), lastName: enc(SITE.last), company: enc(SITE.organisation),
      phone: enc(SITE.phone), roleTitle: "Site operator" },
    contactEmail: SITE.email, contactPhone: SITE.phone, contactName: `${SITE.first} ${SITE.last}`,
    contactFirstName: SITE.first, submitterName: `${SITE.first} ${SITE.last}`, siteName: SITE.siteName, site_address: SITE.address,
    request: { buyerType: "site_operator", capture_mode: "self_capture", capture_region: "us",
      siteName: enc(SITE.siteName), siteLocation: enc(SITE.address), taskStatement: SENTENCE,
      siteLocationMetadata: { source: "places", placeId: enc(SITE.placeId), formattedAddress: enc(SITE.address), lat: SITE.lat,
        lng: SITE.lng, city: enc(SITE.city), state: enc("OR"), country: enc("US"), postalCode: enc(SITE.postalCode) },
      displayCaptureMetadata: { targetName: enc(SITE.siteName), addressLabel: enc(SITE.address), requestId: ID,
        captureBrief: enc(SENTENCE) },
      consent_attestation: sharedRecordingGrant() },
    // Stored listing text is never trusted: a company sees only the closed category.
    public_task_listing: { enabled: true, consentVersion: "job-shared-2026-11-12", approvedAtIso: "2026-11-12T10:00:00.000Z",
      wentLiveIso: "2026-11-12T10:00:00.000Z", approvedBy: "recording_statement", recordingStatementVersion: "2026-11-12.v4",
      details: { title: "Carton palletizing opportunity", siteType: SITE.siteName, region: SITE.address, objects: SITE.street },
      thumbnailDigest: null, reviewRequired: false },
    capture_privacy_screen: passedPrivacyScreen(ID),
    capture_coverage: { covers_scene: true, notes: `Sign over the dock reads ${SITE.siteName}` },
    // The video reader's free text, as if it read a sign in the frames.
    walkthrough_job_estimates: { capture_id: CAPTURE, job_estimates: {
      object: `${SITE.siteName} carton`, object_largest_side_m: 0.4, object_mass_kg_low: 8, object_mass_kg_high: 11,
      object_surface: "matte", pick_to_place_m: 1.6, pick_height_m: null, place_height_m: null, front_clearance_m: 1.5,
      other_items_likely: [`${SITE.siteName} totes`], cycle_seconds: null,
      basis: `A person stacks cartons under the ${SITE.siteName} sign at ${SITE.street}.` } },
    job_facts: { weight: "5_15kg", updatedAtIso: "2026-11-12T10:00:00.000Z" },
    ...extra,
  };
}

function company(tag: string) {
  return { partnerRole: "deployment", status: "approved", termsAcceptance: currentTermsAcceptance(),
    termsAcceptedByUid: `uid-${tag}`, name: `Person ${tag}`, email: `contact@${tag.toLowerCase()}-robots.example`,
    company: `${tag} Robotics`, website: `https://${tag.toLowerCase()}-robots.example`, robot: "arm", workWanted: "pick",
    region: null, newJobAlertsOptIn: true, appliedAtIso: "2026-11-01T00:00:00.000Z", updatedAtIso: "2026-11-01T00:00:00.000Z",
    decidedAtIso: "2026-11-02T00:00:00.000Z", decidedBy: "ops", decisionNote: null };
}
const NORTH = company("North");
const SOUTH = company("South");
const COMPANIES = [NORTH, SOUTH];

/* ----------------------------------------------------------------- the packet's media, as the Pipeline publishes them */

const CLIP_BYTES = Buffer.from("company-clip-bytes-without-sound");
const ZIP_BYTES = Buffer.from("PK-simulation-zip-bytes");
const digestOf = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
function sealed(value: Record<string, unknown>, field: string) {
  return { ...value, [field]: crossRuntimeArtifactDigest(value, field) };
}
const companyClip = () => sealed({ schema_version: "website_company_clip.v1", capture_id: CAPTURE,
  clip_revision: `sha256:${"3".repeat(64)}`, state: "ready", format: "mp4_h264_faststart_video_only", content_type: "video/mp4",
  digest: digestOf(CLIP_BYTES), size_bytes: CLIP_BYTES.length, width: 1280, height: 720, fps: 30, duration_seconds: 4.2,
  has_audio: false, permission_basis: "site_sharing_statement", statement_version: "2026-11-12.v4", updated_at_epoch: 1_794_000_000 },
"clip_digest");
const companySimulation = () => sealed({ schema_version: "website_company_simulation.v1", capture_id: CAPTURE,
  simulation_revision: `sha256:${"4".repeat(64)}`, state: "ready", format: "zip_usd_scene_object_success_rule",
  content_type: "application/zip", digest: digestOf(ZIP_BYTES), size_bytes: ZIP_BYTES.length,
  files: ["README.txt", "object.usdz", "scene.usda", "scene/room.usdc", "scene/room_collision.usdc", "success_rule.json"],
  permission_basis: "site_sharing_statement", statement_version: "2026-11-12.v4", updated_at_epoch: 1_794_000_000 }, "simulation_digest");
const scenePreview = () => sealed({ schema_version: "website_scene_preview.v1", capture_id: CAPTURE,
  scene_revision: `sha256:${"1".repeat(64)}`, state: "ready", source_kind: "atlas_base_scene", format: "ply_3dgs_sh0",
  coordinate_frame: "right_up_back_y_up", digest: `sha256:${"2".repeat(64)}`, size_bytes: 10, gaussian_count: 2,
  source_gaussian_count: 2, start_view: null, claim_ceiling: "development_only", updated_at_epoch: 1_794_000_000 }, "preview_digest");

/* ----------------------------------------------------------------- the scans */

const BLUEPRINT_EMAIL = /@tryblueprint\.io$/i;
const ANY_EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const ANY_PHONE = /(?<![\w.])(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\w])/g;
const ANY_STREET = /\b\d{1,6}\s+(?:[A-Z][\w'.-]*\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd|Way|Court|Ct|Place|Pl|Parkway|Pkwy|Highway|Hwy|Terrace|Square)\b/g;

/** Text a company receives, with what may carry long digit runs by chance (signatures, digests, epochs) taken out. */
function scrubbed(text: string): string {
  return text.split(COMPANY_POSTAL_LINE).join(" ").split(COMPANY.mailingAddress).join(" ")
    .replace(/\b[a-f0-9]{16,}\b/gi, " ").replace(/expires=\d+/g, " ");
}

/** None of the planted values, and no email (but Blueprint's and the recipient's own), phone or street address. */
function expectNothingOfTheSite(label: string, text: string, recipient: string | null = null) {
  const clean = scrubbed(text);
  for (const planted of PLANTED) expect(clean.toLowerCase(), `${label} carries ${planted}`).not.toContain(planted.toLowerCase());
  const emails = (clean.match(ANY_EMAIL) ?? []).filter(email => !BLUEPRINT_EMAIL.test(email)
    && email.toLowerCase() !== recipient?.toLowerCase());
  expect(emails, `${label} carries an email address`).toEqual([]);
  expect(clean.match(ANY_PHONE) ?? [], `${label} carries a phone number`).toEqual([]);
  expect(clean.match(ANY_STREET) ?? [], `${label} carries a street address`).toEqual([]);
}

/* ----------------------------------------------------------------- calls */

let server: Server;
let base = "";
const realFetch = globalThis.fetch;

function signIn(record: { email: string }) {
  const token = `token-${record.email}`;
  seams.tokens.set(token, { uid: `uid-${record.email}`, email: record.email });
  return { Authorization: `Bearer ${token}` };
}
async function get(url: string, headers: Record<string, string> = {}) {
  const response = await realFetch(`${base}${url}`, { headers });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { status: response.status, headers: JSON.stringify([...response.headers.entries()]), text: bytes.toString("latin1") };
}
async function answer(record: { email: string }) {
  const response = await realFetch(`${base}/api/site-worlds/tasks/${ID}/interest`, { method: "POST",
    body: JSON.stringify({ state: "interested", inputs: "We palletize cartons like these.", statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION }),
    headers: { ...signIn(record), "content-type": "application/json", cookie: "csrf_token=sweep", "x-csrf-token": "sweep" } });
  return { status: response.status, text: await response.text() };
}

/**
 * Everything one company can receive or fetch for the job, as text: its library, the card, the job page, every signed
 * link the page holds (body and headers), the 3D viewer's files, the thumbnail route and its own access state.
 */
async function everythingFetchable(record: { email: string }): Promise<Array<[string, string]>> {
  const auth = signIn(record);
  const seen: Array<[string, string]> = [];
  const take = async (label: string, url: string, headers: Record<string, string> = auth) => {
    const read = await get(url, headers);
    seen.push([`${label} (${read.status})`, `${read.headers}\n${read.text}`]);
    return read;
  };
  await take("the library list", "/api/site-worlds/tasks");
  await take("the card", `/api/site-worlds/tasks/${ID}`);
  await take("the thumbnail route", `/api/site-worlds/tasks/${ID}/thumbnail`);
  await take("the company's access state", "/api/robot-team-access/me");
  const page = await take("the job page", `/api/site-worlds/jobs/${ID}`);
  expect(page.status).toBe(200);
  const item = JSON.parse(page.text).item;
  expect(item.video.state).toBe("ready");
  expect(item.simulationDownload.state).toBe("ready");
  expect(item.simulation.state).toBe("ready");
  const media = { "sec-fetch-dest": "video" };
  expect((await take("the video", item.video.url, media)).status).toBe(200);
  expect((await take("the simulation download", item.simulationDownload.url, media)).status).toBe(200);
  const viewer = new URLSearchParams(String(item.simulation.viewerUrl).split("?")[1]);
  seen.push(["the viewer link", String(item.simulation.viewerUrl)]);
  const content = viewer.get("content")!;
  expect((await take("the 3D viewer's splat", content, { "sec-fetch-dest": "empty" })).status).toBe(200);
  await take("the 3D viewer's settings", content.replace("scene.ply", "settings.json"), { "sec-fetch-dest": "empty" });
  return seen;
}

const outboxRows = () => [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"))
  .map(([key, value]): Record<string, any> & { key: string } => ({ key, ...(value as Record<string, any>) }));
const companyEmails = new Set(COMPANIES.map(record => record.email));
/** Every message the email seam was asked to send to a company, and every outbox row addressed to one. */
function emailsToCompanies() {
  const sent = seams.sendEmail.mock.calls.map(([message]) => message).filter(message => companyEmails.has(String(message.to)));
  const rows = outboxRows().filter(row => companyEmails.has(String(row.to)));
  return { sent, rows };
}

beforeEach(async () => {
  state.docs.clear();
  seams.tokens.clear();
  seams.sendEmail.mockClear();
  vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "fixture-ticket-secret");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "https://pipeline.invalid");
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "fixture-read-token");
  const dir = mkdtempSync(path.join(tmpdir(), "company-sweep-"));
  seams.sceneFiles = { splat: path.join(dir, "scene.ply"), settings: path.join(dir, "settings.json") };
  writeFileSync(seams.sceneFiles.splat, "ply\nformat binary_little_endian 1.0\nelement vertex 2\nend_header\n");
  writeFileSync(seams.sceneFiles.settings, JSON.stringify({ camera: { position: [0, 1, 2] } }));
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith("https://pipeline.invalid/")) return realFetch(input as never, init);
    const bytes = url.includes("/website-company-simulations/") ? ZIP_BYTES : CLIP_BYTES;
    return new Response(bytes, { status: 200, headers: { "content-type": "application/octet-stream",
      "content-length": String(bytes.length), "x-blueprint-artifact-sha256": digestOf(bytes),
      // What a careless upstream might add: the website must never pass it on.
      "content-disposition": `attachment; filename="${SITE.siteName} ${SITE.street}.bin"`, "x-site-contact": SITE.email } });
  }));
  state.docs.set(`inboundRequests/${ID}`, plantedJob());
  state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: SENTENCE, confirmedAtIso: null,
    operatorAnswers: { where: `Dock 2 at ${SITE.address}`, contact: SITE.phone },
    successCriteria: { successDefinition: `Pallet wrapped, call ${SITE.first} on ${SITE.phone}`, successRate: 90, cycleTimeSeconds: 30 } });
  state.docs.set(`captureUploadSessions/${CAPTURE}`, { scene_preview: scenePreview(), company_clip: companyClip(),
    company_simulation: companySimulation(), uploader_email: SITE.email, site_name: SITE.siteName,
    original_filename: `${SITE.siteName} - ${SITE.street}.MOV`, device_location: `${SITE.lat},${SITE.lng}` });
  for (const record of COMPANIES) state.docs.set(`robotTeamAccess/${sha(record.email)}`, record);
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

describe("the sweep's own scans", () => {
  it("find each planted value, any other email, phone number and street address, and pass Blueprint's own lines", () => {
    for (const planted of PLANTED) expect(() => expectNothingOfTheSite("a control", `x ${planted} y`)).toThrow();
    for (const other of ["write to jane@other-site.example", "call 503-555-0142", "at 12 Mill Road", "at 1200 N Main St"])
      expect(() => expectNothingOfTheSite("a control", other)).toThrow();
    expectNothingOfTheSite("Blueprint's own lines", `${COMPANY_POSTAL_LINE}\nhello@tryblueprint.io\n`
      + `/api/company-media/jobs/${ID}/video.mp4?expires=1794000123&signature=${"ab12".repeat(16)}`);
  });
});

describe("before the site asks for an introduction, nothing a company receives names, places or reaches the site", () => {
  it("the library, the card, the job page, every signed link and its headers, the viewer's files and the access state", async () => {
    for (const record of COMPANIES) {
      for (const [label, text] of await everythingFetchable(record)) expectNothingOfTheSite(`${record.company}: ${label}`, text);
    }
  });

  it("the job page still shows the job: the site's sentence with its identity removed, and the country only", async () => {
    const item = JSON.parse((await get(`/api/site-worlds/jobs/${ID}`, signIn(NORTH))).text).item;
    expect(item.country).toBe("United States");
    expect(item.sentence).toMatch(/^Stack 12 kg cartons onto the pallet at the site/);
    expect(item.sentence).toContain("We stack 12 cartons on 3 pallets in aisle 4, 2 shifts, 24/7.");
    expect(item.title).toBe("Carton palletizing opportunity");
  });

  it("the answer route's reply, and the email it queues (to the site, under an alias)", async () => {
    const reply = await answer(NORTH);
    expect(reply.status).toBe(200);
    expectNothingOfTheSite("the answer route's reply", reply.text);
    const { rows } = emailsToCompanies();
    expect(rows).toEqual([]);
  });

  it("every email the automatic send queues and the outbox delivers to a company", async () => {
    expect(await sendJobToApprovedCompanies(ID)).toMatchObject({ sent: true, emailed: COMPANIES.length });
    await deliverOutbox({ limit: 50 });
    const { sent, rows } = emailsToCompanies();
    expect(sent.map(message => message.to).sort()).toEqual(COMPANIES.map(record => record.email).sort());
    for (const message of sent) expectNothingOfTheSite(`the new-job email to ${message.to}`, JSON.stringify(message), String(message.to));
    for (const row of rows) expectNothingOfTheSite(`the outbox row ${row.key}`, JSON.stringify(row), String(row.to));
  });

  it("the withdrawal's deletion notice to every company the job was sent to", async () => {
    await sendJobToApprovedCompanies(ID);
    const planned = await sharedFakeFirestore.runTransaction(tx => planWithdrawalCompanyNotices(tx as never, ID, plantedJob()));
    expect(planned.map(row => row.data.to).sort()).toEqual(COMPANIES.map(record => record.email).sort());
    for (const row of planned) expectNothingOfTheSite(`the withdrawal notice to ${row.data.to}`, JSON.stringify(row.data), String(row.data.to));
  });
});

describe("after the site asks to meet one company", () => {
  it("only the introduction email to that company carries the site's name and contact details", async () => {
    await sendJobToApprovedCompanies(ID);
    for (const record of COMPANIES) expect((await answer(record)).status).toBe(200);
    expect(await requestIntroduction({ requestId: ID, alias: "Company A", actor: "site",
      statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION })).toMatchObject({ ok: true });
    await deliverOutbox({ limit: 50 });
    // Company A is the first to answer: NORTH.
    const { sent } = emailsToCompanies();
    const carrying = sent.filter(message => PLANTED.some(value => scrubbed(JSON.stringify(message)).toLowerCase().includes(value.toLowerCase())));
    expect(carrying).toHaveLength(1);
    const [introduction] = carrying;
    expect(introduction).toMatchObject({ to: NORTH.email, subject: "A site wants to talk about its job" });
    for (const detail of [SITE.siteName, `${SITE.first} ${SITE.last}`, SITE.email, SITE.address])
      expect(String(introduction.text)).toContain(detail);
    // Every other email to any company carries nothing of the site.
    for (const message of sent.filter(message => message !== introduction))
      expectNothingOfTheSite(`the email ${String(message.subject)} to ${message.to}`, JSON.stringify(message), String(message.to));
    // The introduction is by email only: no page or link either company can fetch carries the site's details.
    for (const record of COMPANIES) {
      for (const [label, text] of await everythingFetchable(record)) expectNothingOfTheSite(`${record.company} after the introduction: ${label}`, text);
    }
    // The outbox keeps no copy of the details once the email is sent.
    for (const row of emailsToCompanies().rows) {
      const { to: _to, ...rest } = row as Record<string, unknown>;
      expectNothingOfTheSite(`the outbox row ${row.key} after sending`, JSON.stringify(rest));
    }
  });
});
