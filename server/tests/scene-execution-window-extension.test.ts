// @vitest-environment node
// OFFLINE: the real route, HMAC verification and transaction helper against the fake Firestore.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { effectiveSceneExecutionExpiry, sponsorshipExecutionWindowUntil, verifiedSceneExecutionWindowExtensions,
  SCENE_EXECUTION_WINDOW_NOTICE_SCHEMA } from "../utils/sceneExecutionWindowExtension";
import { screeningFixture, screeningSha } from "./fixtures/beta-policy-screening";

const store = vi.hoisted(() => ({ state: { docs: new Map<string, any>() } }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { createFakeFirestore } = await import("./helpers/fake-firestore");
  return { dbAdmin: createFakeFirestore(store.state) };
});
vi.mock("../utils/pipelineSyncSecurity", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const SECRET = "test-only-scene-window-signature";
const RAW = 1_793_442_610; // the sealed expiry, 2026-10-31T10:30:10Z
const GRANT = screeningSha("9");
const intakeKey = "taskEvaluationSceneIntakes/intake-one";
const row = (key: string) => store.state.docs.get(key);
let router: any;

function notice(changes: Record<string, unknown> = {}) {
  return { schema_version: SCENE_EXECUTION_WINDOW_NOTICE_SCHEMA, intent_id: "scene-one", intent_digest: screeningSha("a"),
    extension_digest: screeningSha("7"), original_expires_at_epoch: RAW, expires_at_epoch: RAW + 6 * 86400,
    authorization_reference: "founder approval 2026-10-31 (time only)", authorized_via: "operator_door",
    issued_at_epoch: RAW + 3600, ...changes };
}
function send(value: any, options: { intent?: string; signed?: boolean } = {}) {
  const text = JSON.stringify(value), timestamp = new Date().toISOString();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.signed !== false) Object.assign(headers, { "X-Blueprint-Pipeline-Timestamp": timestamp,
    "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: SECRET, timestamp, body: text }) });
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    let status = 200;
    const response = { status(code: number) { status = code; return response; }, setHeader() { return response; },
      json(result: any) { resolve({ status, body: result }); return response; } };
    router.handle({ method: "POST", body: value, rawBody: text,
      url: `/task-evaluation-scene-intents/${options.intent ?? "scene-one"}/execution-window-extensions`,
      header(name: string) { const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase()); return key ? headers[key] : undefined; } },
    response, (error?: Error) => reject(error ?? new Error("route_not_matched")));
  });
}

beforeEach(async () => {
  store.state.docs.clear();
  vi.stubEnv("PIPELINE_SYNC_TOKEN", SECRET); vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
  const { job, intake } = screeningFixture();
  (intake.request as any).execution = { max_total_spend_usd: 1, max_paid_attempts: 1, max_retries: 0, expires_at_epoch: RAW };
  intake.request_digest = crossRuntimeDigest(intake.request);
  Object.assign(intake, { state: "expired", closeout_complete: true, next_forward_at_ms: Number.MAX_SAFE_INTEGER,
    root_sponsorship_digest: GRANT, sponsorship_digest: GRANT });
  Object.assign(job.website_scene_sponsorship, { authority_digest: GRANT, expires_at_epoch: RAW,
    max_total_spend_usd: 1, max_paid_attempts: 1 });
  store.state.docs.set("inboundRequests/job-one", job);
  store.state.docs.set(intakeKey, intake);
  router = (await import("../routes/internal-scene-execution-window")).default;
});
afterEach(() => vi.unstubAllEnvs());

describe("signed Pipeline notice", () => {
  it("records one append-only extension, resumes the status poll and changes no cap", async () => {
    const before = structuredClone(row(intakeKey));
    const response = await send(notice());
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "recorded", intent_id: "scene-one", extension_digest: screeningSha("7"),
      expires_at_epoch: RAW + 6 * 86400, effective_expires_at_epoch: RAW + 6 * 86400, intake_state: "accepted",
      sponsorship_window_mirrored: true, spend_caps_changed: false });
    const intake = row(intakeKey);
    expect(intake.execution_window_extensions).toEqual([{ ...notice(), received_at_iso: expect.any(String) }]);
    expect(intake).toMatchObject({ state: "accepted", next_forward_at_ms: 0, closeout_complete: false });
    // The sealed request (caps, attempts, providers, task, rights) is byte-identical.
    expect(intake.request).toEqual(before.request);
    expect(intake.request_digest).toBe(before.request_digest);
    const job = row("inboundRequests/job-one");
    expect(job.website_scene_sponsorship).toMatchObject({ authority_digest: GRANT, expires_at_epoch: RAW, max_total_spend_usd: 1 });
    expect(job.website_scene_sponsorship_execution_window).toEqual({ schema_version: "website_scene_sponsorship_execution_window.v1",
      scope: "execution_time_only", authority_digest: GRANT, intent_id: "scene-one", intake_id: "intake-one",
      extension_digest: screeningSha("7"), original_expires_at_epoch: RAW, expires_at_epoch: RAW + 6 * 86400 });
  });

  it("is idempotent by extension digest and refuses a different expiry under the same digest", async () => {
    expect((await send(notice())).body.status).toBe("recorded");
    const replay = await send(notice());
    expect(replay).toMatchObject({ status: 200, body: { status: "replayed" } });
    expect(row(intakeKey).execution_window_extensions).toHaveLength(1);
    const conflict = await send(notice({ expires_at_epoch: RAW + 5 * 86400 }));
    expect(conflict).toEqual({ status: 409, body: { code: "scene_execution_window_extension_conflict" } });
    expect(row(intakeKey).execution_window_extensions).toHaveLength(1);
    // A later, distinct approval appends; history keeps both.
    const later = await send(notice({ extension_digest: screeningSha("8"), expires_at_epoch: RAW + 7 * 86400 }));
    expect(later.body).toMatchObject({ status: "recorded", effective_expires_at_epoch: RAW + 7 * 86400 });
    expect(row(intakeKey).execution_window_extensions).toHaveLength(2);
  });

  it.each([
    ["beyond raw + 7 days", { expires_at_epoch: RAW + 7 * 86400 + 1 }],
    ["not after the sealed expiry", { expires_at_epoch: RAW }],
    ["issued after it expires", { issued_at_epoch: RAW + 6 * 86400 + 1 }],
    ["an unknown issuer", { authorized_via: "webapp" }],
    ["an empty authorization", { authorization_reference: "" }],
    ["a spend field", { max_total_spend_usd: 100 }],
  ])("refuses a notice with %s before any write", async (_name, changes) => {
    const response = await send(notice(changes));
    expect(response).toEqual({ status: 400, body: { code: "scene_execution_window_notice_invalid" } });
    expect(row(intakeKey).execution_window_extensions).toBeUndefined();
  });

  it("requires the Pipeline signature and the path's own intent", async () => {
    expect((await send(notice(), { signed: false })).status).toBe(401);
    expect((await send(notice(), { intent: "scene-two" })).status).toBe(400);
    expect(row(intakeKey).execution_window_extensions).toBeUndefined();
  });

  it.each([
    ["a digest mismatch", () => { row(intakeKey).receipt.intent_digest = screeningSha("b"); }, "scene_execution_window_intent_mismatch"],
    ["another sealed expiry", () => { row(intakeKey).request.execution.expires_at_epoch = RAW + 1;
      row(intakeKey).request_digest = crossRuntimeDigest(row(intakeKey).request); }, "scene_execution_window_original_expiry_mismatch"],
    ["a revoked intent", () => { row(intakeKey).revocation_requested = true; }, "scene_execution_window_intent_revoked"],
    ["a revocation in progress", () => { row(intakeKey).state = "revocation_pending"; }, "scene_execution_window_intent_revoked"],
    ["revoked consent", () => { row("inboundRequests/job-one").request.consent_attestation.revoked_at_iso = "2026-10-31T00:00:00Z"; },
      "scene_execution_window_consent_revoked"],
    ["a withdrawn capture", () => { row("inboundRequests/job-one").capture_withdrawal = { requested_at_iso: "2026-10-31T00:00:00Z" }; },
      "scene_execution_window_capture_withdrawn"],
  ])("refuses %s and writes nothing", async (_name, mutate, code) => {
    mutate();
    const before = structuredClone([...store.state.docs]);
    expect(await send(notice())).toEqual({ status: 409, body: { code } });
    expect([...store.state.docs]).toEqual(before);
  });

  it("returns 404 for an unknown intent", async () => {
    expect(await send(notice({ intent_id: "scene-two" }), { intent: "scene-two" }))
      .toEqual({ status: 404, body: { code: "scene_execution_window_intake_unavailable" } });
  });
});

describe("effective expiry readers", () => {
  const intake = (rows: unknown[]) => ({ ...row(intakeKey), execution_window_extensions: rows });
  const stored = (changes: Record<string, unknown> = {}) => ({ ...notice(changes), received_at_iso: "2026-10-31T12:00:00Z" });

  it("is max(raw, latest verified extension) and ignores entries that do not bind this intake", () => {
    expect(effectiveSceneExecutionExpiry(row(intakeKey))).toBe(RAW);
    expect(effectiveSceneExecutionExpiry(intake([stored(), stored({ extension_digest: screeningSha("8"), expires_at_epoch: RAW + 86400 })])))
      .toBe(RAW + 6 * 86400);
    for (const forged of [stored({ intent_digest: screeningSha("b") }), stored({ intent_id: "scene-two" }),
      stored({ original_expires_at_epoch: RAW - 1 }), stored({ expires_at_epoch: RAW + 8 * 86400, issued_at_epoch: RAW + 2 * 86400 }),
      { ...stored(), received_at_iso: undefined }, "not an object"])
      expect(effectiveSceneExecutionExpiry(intake([forged]))).toBe(RAW);
    expect(verifiedSceneExecutionWindowExtensions(intake([stored()]))).toEqual([notice()]);
  });

  it("keeps a non-numeric sealed expiry for each caller's own handling", () => {
    expect(effectiveSceneExecutionExpiry({ request: { execution: {} }, execution_window_extensions: [stored()] })).toBeUndefined();
    expect(effectiveSceneExecutionExpiry(undefined)).toBeUndefined();
  });

  it("lets the bound grant read follow only a verified, unrevoked extension of its own intake", async () => {
    await send(notice());
    const job = row("inboundRequests/job-one"), current = row(intakeKey), grant = job.website_scene_sponsorship;
    expect(sponsorshipExecutionWindowUntil(grant, job, current)).toBe(RAW + 6 * 86400);
    expect(sponsorshipExecutionWindowUntil({ ...grant, authority_digest: screeningSha("6") }, job, current)).toBeUndefined();
    expect(sponsorshipExecutionWindowUntil({ ...grant, expires_at_epoch: RAW + 1 }, job, current)).toBeUndefined();
    expect(sponsorshipExecutionWindowUntil(grant, job, { ...current, revocation_requested: true })).toBeUndefined();
    expect(sponsorshipExecutionWindowUntil(grant, job, { ...current, execution_window_extensions: [] })).toBeUndefined();
    expect(sponsorshipExecutionWindowUntil(grant, job, undefined)).toBeUndefined();
    expect(sponsorshipExecutionWindowUntil(grant, { ...job, website_scene_sponsorship_execution_window: {
      ...job.website_scene_sponsorship_execution_window, expires_at_epoch: RAW + 30 * 86400 } }, current)).toBeUndefined();
  });
});
