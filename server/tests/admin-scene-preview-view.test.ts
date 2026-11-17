// @vitest-environment node
/**
 * "View the simulation of the site" on the admin job console (owner, 2026-11-17: a link to look at a job's splat,
 * Blueprint's internal test jobs included). OFFLINE: the site's real routes (`registerRoutes`, so the console's real
 * mount and gate and the real viewer route) against the fake Firestore; Firebase sign-in and the Pipeline's signed read
 * are fakes.
 *
 * What this pins:
 * - a signed-in admin (or ops) gets the viewer address with a ticket for the job and its capture under the admin
 *   ticket's own domain (the address names no person; the mint's log line names the admin), and the
 *   viewer route serves it the same bytes the site's own ticket gets, for a normal job and for an internal test job,
 *   whose company view stays refused;
 * - anyone else is refused the mint exactly as the console's other routes refuse them, each of the gate's two places
 *   holds on its own, and nobody gets past the viewer route without a ticket of their own kind;
 * - no stored preview, a withdrawal and a revocation give no link, no ticket and no bytes, even for a ticket minted
 *   before; operator hold and an older statement do not stop staff;
 * - logs name the job, the capture, the admin's uid and the status: never the ticket or the site; the request log's
 *   path for every ticket on the view route carries no query.
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
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { privateWorkLogPath } = await import("../utils/blueprintWorkLogPrivacy");
const { forgetWebsiteScenePreviews, websiteScenePreviewAdminViewerUrl, websiteScenePreviewCompanyViewerUrl,
  websiteScenePreviewViewerUrl } = await import("../utils/websiteScenePreview");

const ID = "req-view";
const CAPTURE = `walkthrough-${ID}`;
const sha = (value: string) => createHash("sha256").update(value.trim().toLowerCase()).digest("hex");

const SITE = { name: "ZEBRAPLANT Foods", address: "77 QUOKKA Lane, Springfield", email: "owner@site-plant.example", phone: "+1 415 555 0134" };
const SITE_PLANTED = [SITE.name, "ZEBRAPLANT", "QUOKKA", SITE.email, "site-plant", "415 555"];
const NORTH = { email: "contact@north.example", partnerRole: "deployment", status: "approved", termsAcceptance: currentTermsAcceptance(),
  termsAcceptedByUid: "uid-north", company: "North Robotics", decidedAtIso: "2026-11-02T00:00:00.000Z" };
const NORTH_ID = sha(NORTH.email);
const INTERNAL_TEST = { label: "rigid pick", footage_id: "pexels-854533", created_by: "pipeline_sync_signature",
  created_at_iso: "2026-11-15T12:00:00.000Z" };
const INTERNAL_GRANT = { granted: true, statement_version: "internal_test.v1", basis: "blueprint_internal_test",
  recorded_at_iso: "2026-11-15T12:00:00.000Z" };

/** A float 3DGS PLY of two splats, as the Pipeline's first writer makes it. */
const PLY_PROPERTIES = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity", "scale_0", "scale_1", "scale_2",
  "rot_0", "rot_1", "rot_2", "rot_3"];
const SPLAT = (() => {
  const rows = [[1, 2, 3, 0.1, 0.2, 0.3, 2, -5, -5, -7, 0.9, 0.1, 0.2, 0.3], [4, 5, 6, 0.4, 0.5, 0.6, 1, -4, -4, -4, 0.5, 0.5, 0.5, 0.5]];
  const header = `ply\nformat binary_little_endian 1.0\nelement vertex ${rows.length}\n`
    + PLY_PROPERTIES.map(name => `property float ${name}\n`).join("") + "end_header\n";
  return Buffer.concat([Buffer.from(header, "latin1"), Buffer.from(new Float32Array(rows.flat()).buffer)]);
})();
const SPLAT_DIGEST = `sha256:${createHash("sha256").update(SPLAT).digest("hex")}`;

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
/** A stored scene preview exactly as the Pipeline's callback stores it (`website_scene_preview.v1`). */
function scenePreview(patch: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = { schema_version: "website_scene_preview.v1", capture_id: CAPTURE,
    scene_revision: `sha256:${"1".repeat(64)}`, state: "ready", source_kind: "atlas_base_scene", format: "ply_3dgs_sh0",
    coordinate_frame: "right_up_back_y_up", digest: SPLAT_DIGEST, size_bytes: SPLAT.length, gaussian_count: 2,
    source_gaussian_count: 2_000_000, start_view: { position: [1, 1.5, 2], target: [3, 1.5, 2] },
    claim_ceiling: "development_only", updated_at_epoch: 1_794_000_000, ...patch };
  return { ...value, preview_digest: crossRuntimeArtifactDigest(value, "preview_digest") };
}
const jobDoc = () => state.docs.get(`inboundRequests/${ID}`) as Record<string, any>;
const patchJob = (patch: Record<string, unknown>) => state.docs.set(`inboundRequests/${ID}`, { ...jobDoc(), ...patch });
const storePreview = (value: unknown = scenePreview()) => state.docs.set(`captureUploadSessions/${CAPTURE}`, { scene_preview: value });
const markTestJob = () => patchJob({ internal_test: INTERNAL_TEST, request: { ...jobDoc().request, consent_attestation: INTERNAL_GRANT } });
const WITHDRAWN = () => patchJob({ capture_withdrawal: { requested_at_iso: "2026-11-17T12:00:00.000Z" } });
const REVOKED = () => patchJob({ consent_revoked: true, request: { ...jobDoc().request,
  consent_attestation: { ...sharedRecordingGrant(), granted: false, revoked_at_iso: "2026-11-17T12:00:00.000Z" } } });

/* ----------------------------------------------------------------- calls */

let server: Server;
let base = "";
let app: express.Express;
const realFetch = globalThis.fetch;

const ADMIN = { Authorization: "Bearer admin-token" };
const OPS = { Authorization: "Bearer ops-token" };
const COMPANY = { Authorization: "Bearer company-token" };
const SITE_OWNER = { Authorization: "Bearer site-owner-token" };
/** How the vendored viewer asks for the splat: a plain fetch, never a navigation. */
const VIEWER_FETCH = { "sec-fetch-dest": "empty" };

type Answer = { status: number; body: string; bytes: Buffer };
async function call(path: string, headers: Record<string, string> = {}): Promise<Answer> {
  const response = await realFetch(`${base}${path}`, { headers });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { status: response.status, body: bytes.toString(), bytes };
}
const mint = (headers: Record<string, string> = ADMIN) => call(`/api/admin/jobs/${ID}/scene-preview-view`, headers);
const adminDetail = (headers: Record<string, string> = ADMIN) => call(`/api/admin/jobs/${ID}`, headers);
/** The splat address inside a viewer URL (what the vendored viewer fetches). */
const contentOf = (viewerUrl: string) => new URLSearchParams(viewerUrl.split("?")[1]).get("content")!;
const view = (viewerUrl: string, headers: Record<string, string> = VIEWER_FETCH) => call(contentOf(viewerUrl), headers);
const withQuery = (content: string, edit: (query: URLSearchParams) => void) => {
  const [path, query] = content.split("?");
  const params = new URLSearchParams(query);
  edit(params);
  return `${path}?${params}`;
};
const shape = (answer: Answer) => ({ status: answer.status, body: answer.body });
const UNAVAILABLE = { status: 404, body: JSON.stringify({ error: "3D preview is unavailable", code: "website_atlas_preview_unavailable" }) };
const NOT_VIEWABLE = { status: 404, body: JSON.stringify({ error: "The simulation of the site is not available.", code: "scene_preview_unavailable" }) };

async function mintedUrl(headers: Record<string, string> = ADMIN) {
  const answer = await mint(headers);
  expect(answer.status).toBe(200);
  return JSON.parse(answer.body).url as string;
}

beforeEach(async () => {
  state.docs.clear();
  logged.calls.length = 0;
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
  await forgetWebsiteScenePreviews(ID);
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith("https://pipeline.invalid/")) return realFetch(input as never, init);
    if (!url.includes(`/website-scene-previews/${CAPTURE}/scene.ply`)) return new Response("", { status: 404 });
    return new Response(SPLAT, { status: 200 });
  }));
  state.docs.set(`siteTaskBriefs/${ID}`, { requestId: ID, summary: "Stack 12 kg cartons onto the pallet.", confirmedAtIso: null });
  state.docs.set(`inboundRequests/${ID}`, job());
  state.docs.set(`robotTeamAccess/${NORTH_ID}`, NORTH);
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
  await forgetWebsiteScenePreviews(ID);
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

/* ----------------------------------------------------------------- an admin views */

describe("an admin opens a job's scene preview from the job console", () => {
  it("a normal job: the viewer address, naming no one, serving the bytes the site's own ticket serves", async () => {
    storePreview();
    const url = await mintedUrl();
    expect(url.startsWith("/splat-viewer/index.html?content=")).toBe(true);
    const content = contentOf(url);
    // The address carries the job, the capture, the source, the admin marker and the ticket: nothing else, no uid.
    expect(content.split("?")[0]).toBe(`/api/website-atlas-preview-views/${ID}/${CAPTURE}/scene.ply`);
    expect([...new URLSearchParams(content.split("?")[1]).keys()].sort()).toEqual(["admin", "expires", "signature", "source"]);
    expect(new URLSearchParams(content.split("?")[1]).get("admin")).toBe("1");
    expect(url).not.toContain("uid-admin");
    expect(await mintedUrl(OPS)).not.toContain("uid-ops");
    // The same lifetime as the site's own ticket.
    const owner = websiteScenePreviewViewerUrl(ID, CAPTURE)!;
    const expiry = (u: string) => Number(new URLSearchParams(contentOf(u).split("?")[1]).get("expires"));
    expect(Math.abs(expiry(url) - expiry(owner))).toBeLessThanOrEqual(1);

    const admin = await view(url);
    const site = await view(owner);
    expect(admin.status).toBe(200);
    expect(admin.bytes.equals(site.bytes)).toBe(true);
    expect((await call(contentOf(url).replace("/scene.ply?", "/settings.json?"), VIEWER_FETCH)).status).toBe(200);
    // An ops account passes the same gate.
    expect((await view(await mintedUrl(OPS))).status).toBe(200);
  });

  it("an internal test job: viewable by an admin, still refused to a company", async () => {
    storePreview();
    const company = websiteScenePreviewCompanyViewerUrl(ID, CAPTURE, NORTH_ID)!;
    // Listed under the current sharing statement, a company is served this preview...
    expect((await view(company)).status).toBe(200);
    // ...until the job is an internal test job (the v4 grant unchanged); only the `internal_test_job` stop refuses it.
    patchJob({ internal_test: INTERNAL_TEST });
    expect(teamJobAccess(jobDoc()).reason).toBe("internal_test_job");
    expect(shape(await view(company))).toEqual(UNAVAILABLE);
    expect((await view(await mintedUrl())).status).toBe(200);
    // As the internal route makes it, with its own grant: the admin still gets it, a company still does not.
    markTestJob();
    expect(JSON.parse((await adminDetail()).body).scenePreviewViewUrl).toBe(`/api/admin/jobs/${ID}/scene-preview-view`);
    expect((await view(await mintedUrl())).status).toBe(200);
    expect(shape(await view(company))).toEqual(UNAVAILABLE);
  });

  it("operator hold and an older statement do not stop staff: looking at what Blueprint holds is not sharing", async () => {
    storePreview();
    patchJob({ operator_listing_hold: { held: true, atIso: "2026-11-17T00:00:00.000Z", by: "uid-ops", byEmail: "ops@tryblueprint.io", reason: "check" } });
    expect((await view(await mintedUrl())).status).toBe(200);
    patchJob({ operator_listing_hold: null, request: { ...jobDoc().request,
      consent_attestation: { ...sharedRecordingGrant(), statement_version: "2026-09-18.v1" } } });
    expect((await view(await mintedUrl())).status).toBe(200);
  });
});

/* ----------------------------------------------------------------- who is refused */

describe("the gate holds in each of its two places", () => {
  it("the console's mount in server/routes.ts carries the shared admin gate ahead of the router", () => {
    const stack = (app as unknown as { _router: { stack: Array<{ regexp: RegExp; route?: unknown; handle: unknown }> } })._router.stack;
    const handles = stack.filter(layer => !layer.route && layer.regexp.test("/api/admin/jobs") && !layer.regexp.test("/not-the-console"))
      .map(layer => layer.handle);
    const consoleAt = handles.indexOf(adminJobConsoleRouter);
    expect(consoleAt).toBeGreaterThan(-1);
    expect(handles.slice(0, consoleAt)).toEqual(expect.arrayContaining([verifyFirebaseToken, requireAdminRole]));
  });

  it("the console router refuses a non-admin by itself, without the mount's gate", async () => {
    storePreview();
    const bare = express();
    bare.use("/api/admin/jobs", verifyFirebaseToken, adminJobConsoleRouter);
    const bareServer = createServer(bare);
    await new Promise<void>(resolve => bareServer.listen(0, "127.0.0.1", () => resolve()));
    const address = bareServer.address();
    const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/api/admin/jobs/${ID}/scene-preview-view`;
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

describe("anyone but an admin is refused the ticket exactly as the console's other routes refuse", () => {
  const siteLinkToken = () => createCaptureUploadToken({ requestId: ID, sceneId: `site-${ID}`, captureId: CAPTURE, scope: "owner" });
  const CASES: Array<[string, () => Record<string, string>, number]> = [
    ["no session", () => ({}), 401],
    ["a signed-in deployment company", () => COMPANY, 403],
    ["the site's own signed-in account", () => SITE_OWNER, 403],
    ["the site's job link token, offered as a bearer", () => ({ Authorization: `Bearer ${siteLinkToken()}` }), 401],
  ];
  it.each(CASES)("%s", async (_name, headers, status) => {
    storePreview();
    const answer = await mint(headers());
    expect(answer.status).toBe(status);
    expect(answer.body).not.toContain("signature");
    expect(shape(answer)).toEqual(shape(await adminDetail(headers())));
  });
});

describe("the viewer route serves an admin's ticket and nothing that only looks like one", () => {
  it("refuses an anonymous caller, the site's account and a company without a ticket of their own", async () => {
    storePreview();
    const bare = `/api/website-atlas-preview-views/${ID}/${CAPTURE}/scene.ply?source=scene`;
    for (const headers of [{}, SITE_OWNER, COMPANY, ADMIN]) expect(shape(await call(bare, { ...VIEWER_FETCH, ...headers }))).toEqual(UNAVAILABLE);
    expect(shape(await call(`${bare}&admin=uid-admin`, VIEWER_FETCH))).toEqual(UNAVAILABLE);
  });

  it("refuses any ticket changed in what it is bound to, or presented as another kind", async () => {
    storePreview();
    const content = contentOf(await mintedUrl());
    const owner = contentOf(websiteScenePreviewViewerUrl(ID, CAPTURE)!);
    const company = contentOf(websiteScenePreviewCompanyViewerUrl(ID, CAPTURE, NORTH_ID)!);
    const forged = [
      // Without the admin marker it would be read as the site's own ticket, under another domain.
      withQuery(content, q => q.delete("admin")),
      // Another viewer kind beside it, or in its place.
      withQuery(content, q => q.set("viewer", NORTH_ID)),
      withQuery(content, q => { q.delete("admin"); q.set("viewer", NORTH_ID); }),
      // The site's own and a company's ticket, claiming to be an admin's.
      withQuery(owner, q => q.set("admin", "1")),
      withQuery(company, q => { q.delete("viewer"); q.set("admin", "1"); }),
      // Another job or capture, a later expiry, the Atlas preview's source.
      content.replace(`/${ID}/`, "/req-other/"),
      content.replace(`/${CAPTURE}/`, "/walkthrough-other/"),
      withQuery(content, q => q.set("expires", String(Number(q.get("expires")) + 60))),
      withQuery(content, q => q.delete("source")),
    ];
    for (const path of forged) expect(shape(await call(path, VIEWER_FETCH)), path).toEqual(UNAVAILABLE);
    expect((await call(content, VIEWER_FETCH)).status).toBe(200);
    // Each marker is exact: an admin ticket with any other admin value is refused.
    for (const value of ["2", "uid-admin", "", "true"])
      expect(shape(await call(withQuery(content, q => q.set("admin", value)), VIEWER_FETCH)), value).toEqual(UNAVAILABLE);
  });

  it("a valid company ticket that also carries the admin marker is refused, though alone it is served", async () => {
    storePreview();
    const company = contentOf(websiteScenePreviewCompanyViewerUrl(ID, CAPTURE, NORTH_ID)!);
    expect((await call(company, VIEWER_FETCH)).status).toBe(200);
    expect(shape(await call(withQuery(company, q => q.set("admin", "1")), VIEWER_FETCH))).toEqual(UNAVAILABLE);
    // And the site's own ticket with the marker: it never verifies under the admin domain.
    const owner = contentOf(websiteScenePreviewViewerUrl(ID, CAPTURE)!);
    expect((await call(owner, VIEWER_FETCH)).status).toBe(200);
    expect(shape(await call(withQuery(owner, q => q.set("admin", "1")), VIEWER_FETCH))).toEqual(UNAVAILABLE);
  });

  it("an expired admin ticket opens nothing", async () => {
    storePreview();
    const old = websiteScenePreviewAdminViewerUrl(ID, CAPTURE, Math.floor(Date.now() / 1000) - 16 * 60)!;
    expect(shape(await view(old))).toEqual(UNAVAILABLE);
  });

  it("opening the splat as a page is refused, as for every ticket", async () => {
    storePreview();
    expect((await view(await mintedUrl(), { "sec-fetch-dest": "document" })).status).toBe(403);
  });
});

/* ----------------------------------------------------------------- each state */

describe("no stored preview, a withdrawal and a revocation give no link and no bytes", () => {
  const link = async () => JSON.parse((await adminDetail()).body).scenePreviewViewUrl;

  it("no stored preview, or one that does not verify: no link and a refusal", async () => {
    expect(await link()).toBeNull();
    expect(shape(await mint())).toEqual(NOT_VIEWABLE);
    storePreview({ ...scenePreview(), preview_digest: `sha256:${"9".repeat(64)}` });
    expect(await link()).toBeNull();
    expect(shape(await mint())).toEqual(NOT_VIEWABLE);
    storePreview(scenePreview({ capture_id: "walkthrough-other" }));
    expect(shape(await mint())).toEqual(NOT_VIEWABLE);
    storePreview();
    expect(await link()).toBe(`/api/admin/jobs/${ID}/scene-preview-view`);
  });

  it.each([["the site withdrew its capture", WITHDRAWN], ["the site revoked its consent", REVOKED]])(
    "%s: no link, no ticket, and a ticket minted before is refused at once", async (_name, arrange) => {
      storePreview();
      const before = await mintedUrl();
      expect((await view(before)).status).toBe(200);
      arrange();
      expect(await link()).toBeNull();
      expect(shape(await mint())).toEqual(NOT_VIEWABLE);
      expect(shape(await view(before))).toEqual(UNAVAILABLE);
    });

  it("a withdrawal closes an internal test job's preview too, and a missing job is the console's own 404", async () => {
    storePreview();
    markTestJob();
    const before = await mintedUrl();
    WITHDRAWN();
    expect(shape(await mint())).toEqual(NOT_VIEWABLE);
    expect(shape(await view(before))).toEqual(UNAVAILABLE);
    state.docs.delete(`inboundRequests/${ID}`);
    expect(shape(await mint())).toEqual(shape(await adminDetail()));
    expect((await mint()).status).toBe(404);
  });

  it("without the signing secret no ticket is minted", async () => {
    storePreview();
    vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "");
    expect((await mint()).status).toBe(503);
  });
});

/* ----------------------------------------------------------------- what is logged */

describe("what the route logs and answers", () => {
  it("names the job, the capture, the admin's uid and the status only: never the ticket or the site", async () => {
    storePreview();
    const answers: string[] = [];
    const url = await mintedUrl();
    answers.push((await mint(COMPANY)).body);
    state.docs.delete(`captureUploadSessions/${CAPTURE}`);
    answers.push((await mint()).body);
    const signature = new URLSearchParams(contentOf(url).split("?")[1]).get("signature")!;
    const logs = JSON.stringify(logged.calls);
    expect(logs).not.toContain(signature);
    expect(logs).not.toContain("splat-viewer");
    const text = logs + answers.join("\n");
    for (const planted of SITE_PLANTED) expect(text.toLowerCase(), planted).not.toContain(planted.toLowerCase());
    expect(logged.calls).toContainEqual([{ jobId: ID, captureId: CAPTURE, actor: "uid-admin", status: 200 },
      "Simulation of the site opened from the job console"]);
    expect(logged.calls).toContainEqual([{ jobId: ID, actor: "uid-admin", status: 404 },
      "Simulation of the site not viewable from the job console"]);
  });

  it("the request log's path for the splat and its settings carries no ticket, for every ticket kind", async () => {
    storePreview();
    const tickets = [await mintedUrl(), websiteScenePreviewViewerUrl(ID, CAPTURE)!, websiteScenePreviewCompanyViewerUrl(ID, CAPTURE, NORTH_ID)!];
    for (const content of tickets.map(contentOf)) {
      for (const path of [content, content.replace("/scene.ply?", "/settings.json?")]) {
        const logged = privateWorkLogPath(path);
        expect(logged).toBe(path.split("?")[0]);
        for (const part of ["?", "signature", "expires", "admin", "viewer", NORTH_ID, "uid-admin"]) expect(logged, part).not.toContain(part);
      }
    }
  });
});
