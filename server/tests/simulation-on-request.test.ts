// @vitest-environment node
/**
 * The simulation on request (owner, 2026-11-28; `server/utils/simulationRequest.ts`). Against the fake Firestore with the
 * real company route, the real request and push code, the real sweeps, watch, outlook and outcome projection. Faked:
 * sign-in, the sharing rule's read (`loadCompanyJobAccess`, which needs a clip and a listing this file does not build; its
 * own rules are pinned elsewhere), Blueprint's internal test company's configured id, and the Pipeline's answers.
 *
 * What this pins:
 * - the field reaches the sealed task context only on a job that carries it, and an existing job's context and digest
 *   are byte for byte what they were;
 * - the press: the account checks of the answer route, Terms, a withdrawn or unlisted job refused, idempotent, a second
 *   company recorded and told it was already asked for, the internal test company on an internal test job only;
 * - the push: exactly the contract's five keys, nothing identifying, a stable digest, `capture_unknown` tried again,
 *   `capture_withdrawn` and `invalid` stopped, `202` the end;
 * - the grant: nothing creates, widens or extends one; a job whose grant cannot cover a build is refused with one plain
 *   sentence and offered no button, and a queued push stops rather than meet an expired grant;
 * - a waiting job is not a failure: no watch, no window ending, no no-grant ending, no staff alert, a true page line;
 *   every job that does not wait is acted on as before.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { currentTermsAcceptance, sharedRecordingGrant } from "./helpers/sharedJob";
import * as F from "./helpers/taskContextIdentityFixtures";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, authAdmin: null, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", async importOriginal => ({ ...await importOriginal<typeof import("../utils/field-encryption")>(),
  decryptFieldValue: vi.fn(async (value: unknown) => String(value ?? "").replace(/^encrypted:/, "")) }));
const seams = vi.hoisted(() => ({ tokens: new Map<string, { uid: string; email: string }>() }));
vi.mock("../middleware/verifyFirebaseToken", () => ({ default: (req: express.Request, res: express.Response, next: () => void) => {
  const account = seams.tokens.get(String(req.headers.authorization ?? "").replace(/^Bearer /, ""));
  res.locals.firebaseUser = account ? { uid: account.uid, email: account.email, email_verified: true } : undefined;
  next();
} }));
// The sharing rule as a test switch on the stored job (`test_listed`), read inside the caller's transaction as the real one is.
vi.mock("../utils/teamJobAccess", async importOriginal => {
  const actual = await importOriginal<typeof import("../utils/teamJobAccess")>();
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { ...actual, loadCompanyJobAccess: vi.fn(async (id: string, _given: unknown, tx?: { get(ref: unknown): Promise<any> },
    options: { internalTestCompany?: boolean } = {}) => {
    const ref = sharedFakeFirestore.collection("inboundRequests").doc(id);
    const record = (tx ? await tx.get(ref) : await ref.get()).data() ?? null;
    const internalJob = Boolean(record?.internal_test);
    const listed = record?.test_listed === true && internalJob === Boolean(options.internalTestCompany);
    return { record, access: { listed, reason: listed ? null : "not_listed", evaluationAvailable: record?.test_simulation_ready === true,
      details: { title: "Palletizing opportunity", taskFamily: "Palletizing" } }, brief: undefined, session: undefined };
  }) };
});
// The site's recording is saved (the no-grant sweep reads whose step a job waits on from it).
vi.mock("../utils/siteWalkthrough", async importOriginal => ({ ...await importOriginal<typeof import("../utils/siteWalkthrough")>(),
  savedWalkthrough: vi.fn(async () => ({ received: true, uploadState: "processing_ready" })) }));
vi.mock("../utils/internalTestCompany", async importOriginal => ({ ...await importOriginal<typeof import("../utils/internalTestCompany")>(),
  isInternalTestCompanyRow: (_id: unknown, record: any) => record?.fixture_internal_test_company === true,
  hasInternalTestCompanyMarker: (record: any) => record?.fixture_internal_test_company === true }));

const { projectWebsiteTaskContext, taskContextSiteIdentity, TASK_CONTEXT_IDENTITY_FIELD } = await import("../utils/websiteTaskContext");
const { projectWebsiteCaptureRights } = await import("../utils/websiteCaptureRights");
const S = await import("../utils/simulationRequest");
const W = await import("../../client/src/lib/simulationRequest");
const { default: worldsRouter } = await import("../routes/site-worlds");

const DAY = 86400;
const NOW = Date.UTC(2026, 10, 28, 12) ;
const ID = "job-sim";
const sha = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
const jobDoc = (id = ID) => state.docs.get(`inboundRequests/${id}`) as Record<string, any>;
const WAITING_OUTCOME = { category: "held", reason: "awaiting_simulation_request", basis: "simulation_on_request", robot_id: null,
  evidence_digest: `sha256:${"e".repeat(64)}` };

function company(tag: string, extra: Record<string, unknown> = {}) {
  const email = `contact@${tag}.example`;
  return { email, record: { partnerRole: "deployment", termsAcceptance: currentTermsAcceptance(), termsAcceptedByUid: `uid-${email}`,
    name: `Person ${tag}`, email, company: `${tag} Robotics`, website: `https://${tag}.example`, status: "approved",
    appliedAtIso: "2026-11-01T00:00:00.000Z", updatedAtIso: "2026-11-01T00:00:00.000Z", decidedAtIso: "2026-11-02T00:00:00.000Z",
    ...extra } };
}
function seedCompany(tag: string, extra: Record<string, unknown> = {}) {
  const { email, record } = company(tag, extra);
  state.docs.set(`robotTeamAccess/${sha(email)}`, record);
  return { email, companyId: sha(email), record };
}
/** A listed site job created after the change, with a grant that has `remainingDays` to run. */
function seedJob(changes: Record<string, unknown> = {}, remainingDays: number | null = 6, id = ID) {
  const expires = NOW / 1000 + (remainingDays ?? 0) * DAY;
  state.docs.set(`inboundRequests/${id}`, { requestId: id, test_listed: true, [S.SIMULATION_ON_REQUEST_FIELD]: true,
    request: { buyerType: "site_operator", capture_mode: "self_capture", capture_region: "us", consent_attestation: sharedRecordingGrant() },
    ...(remainingDays === null ? {} : { website_scene_sponsorship: { schema_version: "website_scene_sponsorship.v1", request_id: id,
      authority_digest: `sha256:${"9".repeat(64)}`, expires_at_epoch: expires, consent: { accepted_at_epoch: expires - 7 * DAY } } }),
    ...changes });
}

let server: Server, base = "";
const realFetch = globalThis.fetch;
function signIn(email: string) {
  seams.tokens.set(`token-${email}`, { uid: `uid-${email}`, email });
  return { Authorization: `Bearer token-${email}` };
}
async function press(email: string, id = ID, body: unknown = {}) {
  const response = await realFetch(`${base}/api/site-worlds/jobs/${id}/simulation-request`, { method: "POST",
    headers: { ...signIn(email), "content-type": "application/json", cookie: "csrf_token=sim-test", "x-csrf-token": "sim-test" },
    body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() as Record<string, any> };
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/site-worlds", worldsRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); });
beforeEach(() => {
  state.docs.clear();
  vi.unstubAllEnvs();
  // No Pipeline address: the press's own immediate try sends nothing and leaves the push queued.
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "");
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_URL", "");
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "");
});

/* ----------------------------------------------------------------- the field and the sealed task context */

/** The projection of the fixtures' plain brief on a job without the field, as `task-context-site-identity.test.ts` pins it. */
const BEFORE_PLAIN = { digest: "sha256:c18461dc98336de516230533b650b32ba33e0af7c634c927f4217b45c882ea7c" };

describe("the field and the task context", () => {
  const rights = projectWebsiteCaptureRights(F.RIGHTS_RECORD);
  it("leaves an existing job's context and digest byte for byte as they were", async () => {
    for (const record of [F.IDENTITY_RECORD, { ...F.IDENTITY_RECORD, [TASK_CONTEXT_IDENTITY_FIELD]: true }]) {
      const context = projectWebsiteTaskContext(F.PLAIN_BRIEF, rights, { siteIdentity: await taskContextSiteIdentity(record) });
      expect(context).not.toHaveProperty("simulation_on_request");
      expect(context.context_digest).toBe(BEFORE_PLAIN.digest);
    }
  });
  it("puts `simulation_on_request: true` at the top level of a new job's context, inside its digest", async () => {
    const record = { ...F.IDENTITY_RECORD, [TASK_CONTEXT_IDENTITY_FIELD]: true, [S.SIMULATION_ON_REQUEST_FIELD]: true };
    const context = projectWebsiteTaskContext(F.PLAIN_BRIEF, rights, { siteIdentity: await taskContextSiteIdentity(record) });
    expect(context.simulation_on_request).toBe(true);
    expect(context.context_digest).not.toBe(BEFORE_PLAIN.digest);
    const { simulation_on_request: _flag, context_digest: _digest, ...rest } = context;
    // Everything else is the existing job's context exactly.
    const existing = projectWebsiteTaskContext(F.PLAIN_BRIEF, rights, { siteIdentity: await taskContextSiteIdentity(
      { ...F.IDENTITY_RECORD, [TASK_CONTEXT_IDENTITY_FIELD]: true }) });
    const { context_digest: _old, ...existingRest } = existing;
    expect(rest).toEqual(existingRest);
  });
  it("is read from the record's own field only: any other value adds nothing", async () => {
    for (const value of [false, "true", 1, null]) {
      const record = { ...F.IDENTITY_RECORD, [TASK_CONTEXT_IDENTITY_FIELD]: true, [S.SIMULATION_ON_REQUEST_FIELD]: value };
      const context = projectWebsiteTaskContext(F.PLAIN_BRIEF, rights, { siteIdentity: await taskContextSiteIdentity(record) });
      expect(context.context_digest, String(value)).toBe(BEFORE_PLAIN.digest);
    }
  });
});

/* ----------------------------------------------------------------- the press */

describe("Ask for a simulation", () => {
  it("records the first request, its row, the summary and the push in one go, and is idempotent", async () => {
    const north = seedCompany("north");
    seedJob();
    const first = await press(north.email);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ok: true, already: false, message: W.SIMULATION_ASKED });
    const record = jobDoc();
    const summary = S.storedSimulationRequest(record)!;
    expect(summary).toMatchObject({ source: "company", first_row_id: north.companyId, count: 1 });
    const row = state.docs.get(`inboundRequests/${ID}/simulationRequests/${north.companyId}`) as any;
    expect(row).toMatchObject({ request_id: ID, row_id: north.companyId, source: "company", capture_id: `walkthrough-${ID}` });
    expect(summary.request_digest).toBe(S.simulationRequestRowDigest(row));
    expect(S.storedSimulationRequestPush(record)?.state).toBe("pending");
    // Nothing of the company's name, contact or person is on the row or the summary.
    for (const text of [JSON.stringify(row), JSON.stringify(summary)])
      for (const planted of [north.email, "north Robotics", "Person north", "uid-"]) expect(text).not.toContain(planted);
    const again = await press(north.email);
    expect(again.body).toMatchObject({ ok: true, already: true, askedAtIso: summary.first_requested_at_iso });
    expect(S.storedSimulationRequest(jobDoc())).toEqual(summary);
  });

  it("records a second company's row and tells it the simulation was already asked for; one request serves every company", async () => {
    const north = seedCompany("north"), south = seedCompany("south");
    seedJob();
    await press(north.email);
    const before = S.storedSimulationRequest(jobDoc())!;
    const second = await press(south.email);
    expect(second.body).toMatchObject({ ok: true, already: true, message: W.SIMULATION_ALREADY_ASKED });
    expect(state.docs.has(`inboundRequests/${ID}/simulationRequests/${south.companyId}`)).toBe(true);
    const after = S.storedSimulationRequest(jobDoc())!;
    expect(after).toEqual({ ...before, count: 2 });
  });

  it("refuses as the answer route does: no verified account, not approved, a technology partner, Terms not current", async () => {
    seedJob();
    const unsigned = await realFetch(`${base}/api/site-worlds/jobs/${ID}/simulation-request`, { method: "POST",
      headers: { "content-type": "application/json", cookie: "csrf_token=sim-test", "x-csrf-token": "sim-test" }, body: "{}" });
    expect(unsigned.status).toBe(403);
    const applied = seedCompany("applied", { status: "applied" });
    expect((await press(applied.email)).status).toBe(403);
    const partner = seedCompany("partner", { partnerRole: "technology" });
    expect((await press(partner.email)).status).toBe(403);
    const stale = seedCompany("stale", { termsAcceptance: { ...currentTermsAcceptance(), terms_version: "2020-01-01.1" } });
    const terms = await press(stale.email);
    expect(terms.status).toBe(403);
    expect(terms.body.code).toBe("terms_acceptance_required");
    expect(jobDoc().simulation_request).toBeUndefined();
  });

  it("refuses a withdrawn or unlisted job, a job built without a request, and a body it does not take", async () => {
    const north = seedCompany("north");
    seedJob({ capture_withdrawal: { requested_at_iso: "2026-11-28T00:00:00.000Z" } });
    expect(await press(north.email)).toEqual({ status: 409, body: { error: W.SIMULATION_ASK_NOT_SHARED } });
    seedJob({ request: { buyerType: "site_operator", consent_attestation: { ...sharedRecordingGrant(), withdrawn_at_iso: "2026-11-28T00:00:00.000Z" } } });
    expect((await press(north.email)).body.error).toBe(W.SIMULATION_ASK_NOT_SHARED);
    seedJob({ test_listed: false });
    expect((await press(north.email)).body.error).toBe(W.SIMULATION_ASK_NOT_SHARED);
    seedJob({ [S.SIMULATION_ON_REQUEST_FIELD]: undefined });
    expect((await press(north.email)).body.error).toBe(W.SIMULATION_NOT_ON_REQUEST);
    seedJob();
    expect((await press(north.email, ID, { note: "please" })).status).toBe(400);
    expect(jobDoc().simulation_request).toBeUndefined();
    expect([...state.docs.keys()].filter(key => key.includes("/simulationRequests/"))).toEqual([]);
  });

  it("lets Blueprint's internal test company press it on an internal test job, and only there", async () => {
    const tester = seedCompany("tester", { fixture_internal_test_company: true });
    seedJob({ internal_test: { label: "fixture", footage_id: "x", created_by: "pipeline_sync_signature", created_at_iso: "2026-11-28T00:00:00.000Z" } });
    expect((await press(tester.email)).body).toMatchObject({ ok: true, already: false });
    expect(S.storedSimulationRequest(jobDoc())?.source).toBe("company");
    seedJob({}, 6, "job-real");
    expect((await press(tester.email, "job-real")).body.error).toBe(W.SIMULATION_ASK_NOT_SHARED);
    // A real company cannot press it on the test job.
    const north = seedCompany("north");
    expect((await press(north.email)).body.error).toBe(W.SIMULATION_ASK_NOT_SHARED);
  });
});

/* ----------------------------------------------------------------- the grant */

describe("the grant: nothing creates, widens or extends one", () => {
  it("refuses with one plain sentence a job whose grant has too little time left for a build, and writes nothing", async () => {
    const north = seedCompany("north");
    seedJob({}, 2);
    const grantBefore = structuredClone(jobDoc().website_scene_sponsorship);
    expect(await press(north.email)).toEqual({ status: 409, body: { error: W.SIMULATION_CANNOT_BE_ASKED } });
    expect(W.SIMULATION_CANNOT_BE_ASKED).toBe("A simulation can no longer be built for this job.");
    expect(jobDoc().website_scene_sponsorship).toEqual(grantBefore);
    expect(jobDoc().simulation_request).toBeUndefined();
    seedJob({}, -1);
    expect((await press(north.email)).body.error).toBe(W.SIMULATION_CANNOT_BE_ASKED);
  });
  it("covers a build while the grant has the room, and a job with no grant yet (the hand-off issues a new one)", () => {
    const record = (days: number | null, extra: Record<string, unknown> = {}) => ({ [S.SIMULATION_ON_REQUEST_FIELD]: true,
      ...(days === null ? {} : { website_scene_sponsorship: { request_id: ID, expires_at_epoch: NOW / 1000 + days * DAY } }), ...extra });
    expect(S.SIMULATION_BUILD_MIN_REMAINING_SECONDS).toBe(3 * DAY);
    expect(S.grantCoversSimulationBuild(record(3), ID, NOW / 1000)).toBe(true);
    expect(S.grantCoversSimulationBuild(record(2.99), ID, NOW / 1000)).toBe(false);
    expect(S.grantCoversSimulationBuild(record(null), ID, NOW / 1000)).toBe(true);
    // Another job's grant covers nothing.
    expect(S.grantCoversSimulationBuild({ website_scene_sponsorship: { request_id: "other", expires_at_epoch: NOW / 1000 + 6 * DAY } }, ID, NOW / 1000)).toBe(false);
    expect(S.simulationRequestState(record(6), ID, NOW / 1000)).toBe("can_ask");
    expect(S.simulationRequestState(record(1), ID, NOW / 1000)).toBe("cannot_ask");
    expect(S.simulationRequestState({ website_scene_sponsorship: {} }, ID, NOW / 1000)).toBe("not_on_request");
  });
  it("offers the company's button only where the press would be taken, and keeps every other job's line", () => {
    const record = (days: number, extra: Record<string, unknown> = {}) => ({ [S.SIMULATION_ON_REQUEST_FIELD]: true,
      website_scene_sponsorship: { request_id: ID, expires_at_epoch: NOW / 1000 + days * DAY }, ...extra });
    const status = (value: Record<string, unknown>, stage: Parameters<typeof S.companySimulationStatus>[2]) =>
      S.companySimulationStatus(value, ID, stage, NOW / 1000);
    expect(status(record(6), "simulation_on_request")).toEqual({ simulationStatus: W.SIMULATION_ON_REQUEST_COMPANY,
      simulationRequest: { state: "can_ask" } });
    expect(W.SIMULATION_ON_REQUEST_COMPANY).toBe("A simulation of the site is built when a company asks for one.");
    expect(W.ASK_FOR_SIMULATION_LABEL).toBe("Ask for a simulation");
    // Too little time left: no button, and the existing "no simulation" line.
    expect(status(record(1), null)).toEqual({ simulationStatus: "There is no simulation for this job." });
    // Asked: when, and what is happening, until it is built or has ended.
    const asked = record(6, { [S.SIMULATION_REQUEST_FIELD]: { schema_version: "simulation_request.v1",
      first_requested_at_iso: "2026-11-28T10:00:00.000Z", first_row_id: "a".repeat(64), source: "company",
      request_digest: `sha256:${"1".repeat(64)}`, count: 1 } });
    expect(status(asked, "simulation_building")).toEqual({
      simulationStatus: "Asked November 28, 2026. The simulation is being built from the site's video.",
      simulationRequest: { state: "asked", askedAtIso: "2026-11-28T10:00:00.000Z" } });
    expect(status(asked, "simulation_built")).toEqual({ simulationStatus: "The simulation is built. Its download is being prepared." });
    expect(status(asked, "no_simulation")).toEqual({ simulationStatus: "There is no simulation for this job." });
    // A job from before the change: today's line for its stage, exactly.
    for (const stage of ["no_video", "video_received", "simulation_building", "simulation_built", "no_simulation", null] as const)
      expect(status({ website_scene_sponsorship: { request_id: ID, expires_at_epoch: NOW / 1000 + DAY } }, stage), String(stage))
        .toEqual({ simulationStatus: (({ no_video: "The simulation is built from the site's video, which has not arrived yet.",
          video_received: "The video has arrived. The simulation has not started yet.",
          simulation_building: "The simulation is being built from the site's video.",
          simulation_built: "The simulation is built. Its download is being prepared.",
          no_simulation: "There is no simulation for this job." }) as Record<string, string>)[String(stage)]
          ?? "The simulation of the site is not finished yet." });
  });
});

/* ----------------------------------------------------------------- the push */

const PIPELINE = "http://127.0.0.1:9";
/** A job whose first request is on record and whose push is due now. */
function seedQueued(remainingDays: number | null = 6, extra: Record<string, unknown> = {}, id = ID) {
  const row = { schema_version: "simulation_request_row.v1" as const, request_id: id, row_id: "a".repeat(64), source: "company" as const,
    capture_id: `walkthrough-${id}`, requested_at_iso: "2026-11-28T10:00:00.000Z" };
  seedJob({ [S.SIMULATION_REQUEST_FIELD]: { schema_version: "simulation_request.v1", first_requested_at_iso: row.requested_at_iso,
    first_row_id: row.row_id, source: "company", request_digest: S.simulationRequestRowDigest(row), count: 1 },
  [S.SIMULATION_REQUEST_PUSH_FIELD]: { schema_version: "simulation_request_push.v1", state: "pending", attempts: 0, lease_id: null,
    lease_until_ms: 0, last_result: null }, [S.SIMULATION_REQUEST_PUSH_DUE_FIELD]: NOW, ...extra }, remainingDays, id);
  state.docs.set(`inboundRequests/${id}/simulationRequests/${row.row_id}`, row);
  return row;
}
function pipeline(...answers: Array<[number, Record<string, unknown>]>) {
  const calls: Array<{ url: string; body: string; headers: Record<string, string> }> = [];
  const fetch = vi.fn(async (url: string | URL, init: RequestInit) => {
    calls.push({ url: String(url), body: String(init.body), headers: init.headers as Record<string, string> });
    const [status, body] = answers.shift() ?? [500, {}];
    return { status, text: async () => JSON.stringify(body) };
  });
  return { fetch, calls };
}
const configure = () => {
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", PIPELINE);
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "fixture-token");
};

describe("the push to the Pipeline", () => {
  it("sends the contract's five keys, signed, to the capture's route, and nothing that names anyone", async () => {
    configure();
    const row = seedQueued();
    const { fetch, calls } = pipeline([202, { status: "recorded" }]);
    expect(await S.deliverSimulationRequestPush(ID, { fetch, nowMs: NOW })).toBe("delivered");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${PIPELINE}/api/live-pipeline/website-simulation-requests/walkthrough-${ID}`);
    const body = JSON.parse(calls[0].body);
    expect(Object.keys(body).sort()).toEqual(["request_digest", "request_id", "requested_at_epoch", "scene_id", "source"]);
    expect(body).toEqual({ request_id: ID, scene_id: `site-${ID}`, request_digest: S.simulationRequestRowDigest(row), source: "company",
      requested_at_epoch: Date.parse(row.requested_at_iso) / 1000 });
    expect(Buffer.byteLength(calls[0].body)).toBeLessThanOrEqual(4096);
    expect(calls[0].body).not.toContain(row.row_id);
    expect(calls[0].headers["x-blueprint-pipeline-client-id"]).toBe("blueprint-webapp");
    expect(calls[0].headers["x-blueprint-pipeline-signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(S.storedSimulationRequestPush(jobDoc())).toMatchObject({ state: "delivered", last_result: "recorded" });
    expect(jobDoc()[S.SIMULATION_REQUEST_PUSH_DUE_FIELD]).toBe(Number.MAX_SAFE_INTEGER);
    // Delivered: nothing is sent again.
    expect(await S.deliverSimulationRequestPush(ID, { fetch, nowMs: NOW + DAY * 1000 })).toBe("skipped");
  });

  it("keeps the digest stable: the same row gives the same digest, and the digest is sha256 over the row", () => {
    const row = { schema_version: "simulation_request_row.v1" as const, request_id: ID, row_id: "b".repeat(64), source: "company" as const,
      capture_id: `walkthrough-${ID}`, requested_at_iso: "2026-11-28T10:00:00.000Z" };
    const digest = S.simulationRequestRowDigest(row);
    expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(S.simulationRequestRowDigest({ ...row })).toBe(digest);
    expect(S.simulationRequestRowDigest({ ...row, requested_at_iso: "2026-11-28T10:00:01.000Z" })).not.toBe(digest);
  });

  it("tries again on capture_unknown (before the hand-off lands) with a backoff, then ends at 202", async () => {
    configure();
    seedQueued();
    const { fetch, calls } = pipeline([404, { detail: "capture_unknown" }], [202, { status: "already_recorded" }]);
    expect(await S.deliverSimulationRequestPush(ID, { fetch, nowMs: NOW })).toBe("retry");
    expect(S.storedSimulationRequestPush(jobDoc())).toMatchObject({ state: "pending", attempts: 1, last_result: "capture_unknown" });
    expect(jobDoc()[S.SIMULATION_REQUEST_PUSH_DUE_FIELD]).toBe(NOW + 30_000);
    // Not due yet: the queue leaves it.
    expect(await S.processSimulationRequestPushQueue(10, { fetch, nowMs: NOW + 1_000 })).toEqual({ processed: 0 });
    expect(await S.processSimulationRequestPushQueue(10, { fetch, nowMs: NOW + 31_000 })).toEqual({ processed: 1 });
    expect(calls).toHaveLength(2);
    expect(calls[1].body).toBe(calls[0].body);
    expect(S.storedSimulationRequestPush(jobDoc())).toMatchObject({ state: "delivered", attempts: 2, last_result: "already_recorded" });
  });

  it.each([[404, { detail: "capture_withdrawn" }, "capture_withdrawn"], [400, { detail: "website_simulation_request_invalid" }, "invalid"]])(
    "stops for good on %s %j", async (status, answer, code) => {
      configure();
      seedQueued();
      const { fetch, calls } = pipeline([status, answer]);
      expect(await S.deliverSimulationRequestPush(ID, { fetch, nowMs: NOW })).toBe("stopped");
      expect(S.storedSimulationRequestPush(jobDoc())).toMatchObject({ state: "stopped", stopped_reason: code });
      expect(await S.processSimulationRequestPushQueue(10, { fetch, nowMs: NOW + DAY * 1000 })).toEqual({ processed: 0 });
      expect(calls).toHaveLength(1);
    });

  it("tries again on any other answer, an unreachable Pipeline or one not configured", async () => {
    seedQueued();
    const { fetch, calls } = pipeline([503, {}]);
    expect(await S.deliverSimulationRequestPush(ID, { fetch, nowMs: NOW })).toBe("retry");
    expect(calls).toHaveLength(0);
    expect(S.storedSimulationRequestPush(jobDoc())?.last_result).toBe("not_configured");
    configure();
    expect(await S.deliverSimulationRequestPush(ID, { fetch, nowMs: NOW + 31_000 })).toBe("retry");
    expect(S.storedSimulationRequestPush(jobDoc())?.last_result).toBe("http_503");
    expect(S.simulationRequestAnswer(null, null)).toEqual({ outcome: "retry", code: "unreachable" });
    expect(S.simulationRequestAnswer(403, null)).toEqual({ outcome: "retry", code: "http_403" });
  });

  it("stops before sending anything when the job was withdrawn, or its grant no longer covers a build", async () => {
    configure();
    const { fetch, calls } = pipeline([202, { status: "recorded" }]);
    seedQueued(6, { capture_withdrawal: { requested_at_iso: "2026-11-28T11:00:00.000Z" } });
    expect(await S.deliverSimulationRequestPush(ID, { fetch, nowMs: NOW })).toBe("stopped");
    expect(S.storedSimulationRequestPush(jobDoc())?.stopped_reason).toBe("withdrawn");
    seedQueued(1);
    expect(await S.deliverSimulationRequestPush(ID, { fetch, nowMs: NOW })).toBe("stopped");
    expect(S.storedSimulationRequestPush(jobDoc())?.stopped_reason).toBe("grant_window_passed");
    expect(calls).toHaveLength(0);
    // The pages then say no simulation will be built, and offer no button.
    expect(S.simulationRequestState(jobDoc(), ID, NOW / 1000)).toBe("cannot_ask");
    expect(S.companySimulationStatus(jobDoc(), ID, null, NOW / 1000)).toEqual({ simulationStatus: "There is no simulation for this job." });
  });

  it("never pushes from a pull request preview, which shares the production store", async () => {
    configure();
    vi.stubEnv("IS_PULL_REQUEST", "true");
    seedQueued();
    const { fetch, calls } = pipeline([202, { status: "recorded" }]);
    expect(await S.deliverSimulationRequestPush(ID, { fetch, nowMs: NOW })).toBe("skipped");
    expect(calls).toHaveLength(0);
  });
});

/* ----------------------------------------------------------------- a waiting job is not a failure */

describe("a job waiting for a request is not a failure", () => {
  const session = (status: Record<string, unknown>, id = ID) => state.docs.set(`captureUploadSessions/walkthrough-${id}`,
    { website_preparation: { status } });

  it("lists the reason and the category, so no staff alert fires; an unknown reason still alerts", async () => {
    const { unknownPreparationCodes } = await import("../utils/websitePreparationStatus");
    const status = (outcome: Record<string, unknown>) => ({ schema_version: "website_preparation_status.v7", state: "awaiting_inputs",
      terminal_reason: null, outcome, question: null }) as never;
    expect(unknownPreparationCodes(status(WAITING_OUTCOME))).toEqual([]);
    expect(unknownPreparationCodes(status({ ...WAITING_OUTCOME, reason: "fixture_unknown_reason" })))
      .toEqual([["preparation.outcome.reason", "fixture_unknown_reason"]]);
    const { KNOWN_PREPARATION_OUTCOME_CATEGORIES, preparationOutcomeV7Schema, projectPreparationOutcome } = await import("../utils/taskPreparationOutcome");
    expect(KNOWN_PREPARATION_OUTCOME_CATEGORIES).toContain("held");
    expect(preparationOutcomeV7Schema.safeParse(WAITING_OUTCOME).success).toBe(true);
    const outcome = projectPreparationOutcome(WAITING_OUTCOME as never);
    expect(outcome).toMatchObject({ category: "held", basis: "simulation_on_request", title: W.SIMULATION_ON_REQUEST_SITE,
      actionOwner: "none" });
    expect(`${outcome.title} ${outcome.reason} ${outcome.nextStep}`).not.toMatch(/film|new video|longer|failed|stopped/i);
  });

  it("starts no preparation watch for the wait, and still watches any other unchanged state", async () => {
    const { nextWebsitePreparationWatch } = await import("../utils/websitePreparationStatus");
    const selector = { request_id: ID, capture_id: `walkthrough-${ID}` };
    const prep = (outcome: unknown) => ({ selector, status: { state: "awaiting_inputs", attempt_count: 1, outcome } }) as never;
    expect(nextWebsitePreparationWatch(null, prep(WAITING_OUTCOME), NOW)).toBeNull();
    const other = nextWebsitePreparationWatch(null, prep(null), NOW);
    expect(other).toMatchObject({ kind: "unchanged_state", state: "awaiting_inputs" });
    const { websitePreparationOverdue } = await import("../utils/websitePreparationWatch");
    expect(websitePreparationOverdue(null, NOW + 30 * DAY * 1000)).toBe(false);
    expect(websitePreparationOverdue(other, NOW + 2 * DAY * 1000)).toBe(true);
  });

  it("is not ended by the window sweep once its grant's window passed; a job that does not wait still is", async () => {
    const { sweepWebsiteJobWindow } = await import("../utils/websiteJobWindowSweep");
    seedJob({}, -1);
    session({ state: "awaiting_inputs", outcome: WAITING_OUTCOME });
    expect(await sweepWebsiteJobWindow(ID, NOW)).toBe("awaiting_simulation_request");
    expect(jobDoc().website_job_window_ending).toBeUndefined();
    seedJob({}, -1, "job-other");
    session({ state: "awaiting_inputs", outcome: null }, "job-other");
    expect(await sweepWebsiteJobWindow("job-other", NOW)).toBe("ended_no_notice");
  });

  it("is not ended by the no-grant sweep; a job with no grant that does not wait still gets its clock", async () => {
    const { sweepWebsiteJobNoGrant } = await import("../utils/websiteJobWindowSweep");
    for (const id of [ID, "job-other"]) {
      seedJob({ createdAt: new Date(NOW - 60_000).toISOString() }, null, id);
      state.docs.set(`siteTaskBriefs/${id}`, { requestId: id, summary: "Stack the cartons onto the pallet." });
    }
    session({ state: "awaiting_inputs", outcome: WAITING_OUTCOME });
    expect(await sweepWebsiteJobNoGrant(ID, NOW)).toBe("awaiting_simulation_request");
    expect(jobDoc().website_job_no_grant_clock).toBeUndefined();
    session({ state: "preparing", outcome: null }, "job-other");
    expect(await sweepWebsiteJobNoGrant("job-other", NOW)).toBe("clock_started");
    expect(jobDoc("job-other").website_job_no_grant_clock).toBeDefined();
  });
});

/* ----------------------------------------------------------------- the outlook */

describe("the site's outlook", () => {
  it("says the simulation is built if a company asks, and that none will be built once none can be asked for", async () => {
    const { jobOutlook } = await import("../utils/jobOutlook");
    const base = { consentRevoked: false, closedByOwner: false, answer: { state: "ready" as const, unsized: false, reason: null },
      windowEnded: false, noGrantEnded: false, preparation: { state: "awaiting_inputs", geometryOnlyEnd: false }, scene: null, proof: null };
    expect(jobOutlook({ ...base, simulationRequest: "can_ask" })).toEqual({ phase: "building", reason: "simulation_on_request",
      sentence: "A simulation of your site is built if a company asks for one." });
    expect(jobOutlook({ ...base, simulationRequest: "cannot_ask" })).toEqual({ phase: "building", reason: "simulation_not_built",
      sentence: "No simulation of your site will be built for this job." });
    // Asked, or a job from before the change: exactly as before.
    expect(jobOutlook({ ...base, simulationRequest: "asked" })).toEqual(jobOutlook(base));
    expect(jobOutlook({ ...base, simulationRequest: "not_on_request" })).toEqual(jobOutlook(base));
    // An older Pipeline that built it anyway: the scene's own state is said.
    expect(jobOutlook({ ...base, simulationRequest: "can_ask", preparation: { state: "handed_off", geometryOnlyEnd: false },
      scene: { state: "ready" } }).phase).toBe("simulation_ready");
    // A recorded ending, and the site's own, still come first.
    expect(jobOutlook({ ...base, simulationRequest: "can_ask", consentRevoked: true }).phase).toBe("ended_by_site");
    expect(jobOutlook({ ...base, simulationRequest: "can_ask", windowEnded: true }).reason).toBe("window_expired");
  });
});

/* ----------------------------------------------------------------- the simulation-ready email */

describe("the simulation-ready email", () => {
  it("covers the company that asked, though it neither answered nor opened the job; a job not asked for reads as before", async () => {
    const { queueSimulationReadyNotices, SIMULATION_READY_NOTICE_FIELD } = await import("../utils/simulationReadyNotice");
    const north = seedCompany("north", { newJobAlertsOptIn: true });
    seedJob({ test_simulation_ready: true, [SIMULATION_READY_NOTICE_FIELD]: { owed: true } });
    await press(north.email);
    expect(state.docs.has(`inboundRequests/${ID}/robotTeamInterest/${north.companyId}`)).toBe(false);
    const result = await queueSimulationReadyNotices(ID, () => new Date(NOW));
    expect(result).toMatchObject({ queued: 1, closed: true });
    expect(state.docs.get(`captureOutbox/company_simulation_ready:${ID}:${north.companyId}`)).toMatchObject({ to: north.email,
      kind: "company_simulation_ready" });
    // A job with no request: the company that only asked elsewhere is not added.
    seedJob({ test_simulation_ready: true, [SIMULATION_READY_NOTICE_FIELD]: { owed: true } }, 6, "job-plain");
    expect(await queueSimulationReadyNotices("job-plain", () => new Date(NOW))).toMatchObject({ queued: 0, closed: true });
  });
});
