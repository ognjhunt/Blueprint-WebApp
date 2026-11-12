// @vitest-environment node
/**
 * The Pipeline's simulation package reference (`COMPANY_SIMULATION_CONTRACT.md` section 1): the signed callback
 * `POST /creator-captures/{captureId}/company-simulation` stores only the package's identity, once per revision, and only
 * while the site's grant stands and its recorded statement shares the job. Each refusal the contract lists is answered
 * with its code; the rights refusals are the ones the Pipeline treats as "delete the archived copy".
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { sharedRecordingGrant } from "./helpers/sharedJob";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/captureFootageReview", () => ({ buildCaptureFootageReviewer: vi.fn() }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: vi.fn(), reconstructionIsViewable: vi.fn() }));
vi.mock("../utils/worldReconstruction", () => ({ startWorldReconstruction: vi.fn(), advanceWorldReconstruction: vi.fn() }));
vi.mock("../utils/pipelineSyncSecurity", () => ({
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyPipelineSyncRequest: () => ({ ok: true }),
}));

const { crossRuntimeArtifactDigest } = await import("../utils/crossRuntimeCanonical");
const { MAX_COMPANY_SIMULATION_BYTES } = await import("../utils/websiteCompanySimulation");

const REQUEST = "inboundRequests/req1";
const CAPTURE = "walkthrough-req1";
const SESSION = `captureUploadSessions/${CAPTURE}`;
const realFetch = globalThis.fetch;

function sealed(patch: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = { schema_version: "website_company_simulation.v1", capture_id: CAPTURE,
    simulation_revision: `sha256:${"1".repeat(64)}`, state: "ready", format: "zip_usd_scene_object_success_rule",
    content_type: "application/zip", digest: `sha256:${"2".repeat(64)}`, size_bytes: 221_000_000,
    files: ["README.txt", "object.usdz", "scene.usda", "scene/room.usdc", "scene/room_collision.usdc", "success_rule.json"],
    permission_basis: "site_sharing_statement", statement_version: "2026-11-12.v4", updated_at_epoch: 1_794_500_000, ...patch };
  delete value.simulation_digest;
  return { ...value, simulation_digest: crossRuntimeArtifactDigest(value, "simulation_digest") };
}
function seed(request: Record<string, unknown> = {}) {
  state.docs.set(REQUEST, { request: { buyerType: "site_operator", consent_attestation: sharedRecordingGrant() }, ...request });
  state.docs.set(SESSION, { browser_stored_upload: { request_id: "req1" }, updated_at_iso: "2026-11-12T00:00:00.000Z" });
}

let server: Server, base: string;
beforeEach(async () => {
  state.docs.clear();
  const app = express();
  app.use(express.json());
  app.use((await import("../routes/internal-capture-worlds")).default);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function publish(simulation: unknown, capture = CAPTURE, body: Record<string, unknown> = {}) {
  const response = await realFetch(`${base}/creator-captures/${capture}/company-simulation`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", simulation, ...body }) });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

describe("the Pipeline's company simulation callback", () => {
  it("accepts the contract's record, stores only its identity, and answers with the acceptance", async () => {
    seed();
    const first = sealed();
    expect(await publish(first)).toEqual({ status: 200, body: { schema_version: "website_company_simulation_acceptance.v1",
      accepted: true, simulation_revision: first.simulation_revision, simulation_digest: first.simulation_digest } });
    expect(state.docs.get(SESSION)).toMatchObject({ company_simulation: first, browser_stored_upload: { request_id: "req1" } });
    // A replay is accepted and changes nothing.
    const stored = structuredClone(state.docs.get(SESSION));
    expect((await publish(first)).status).toBe(200);
    expect((state.docs.get(SESSION) as Record<string, unknown>).company_simulation).toEqual((stored as Record<string, unknown>).company_simulation);
    // A new revision, later, replaces it.
    const next = sealed({ simulation_revision: `sha256:${"3".repeat(64)}`, digest: `sha256:${"4".repeat(64)}`, updated_at_epoch: 1_794_600_000 });
    expect((await publish(next)).status).toBe(200);
    expect((state.docs.get(SESSION) as Record<string, unknown>).company_simulation).toEqual(next);
  });

  it("refuses each case the contract lists, with its code", async () => {
    seed();
    const first = sealed();
    expect((await publish(first)).status).toBe(200);
    // Same revision, other digest.
    expect(await publish(sealed({ digest: `sha256:${"9".repeat(64)}` }))).toEqual({ status: 409, body: { code: "idempotency_conflict" } });
    // An older package than the stored one.
    expect(await publish(sealed({ simulation_revision: `sha256:${"5".repeat(64)}`, updated_at_epoch: 1_794_000_000 })))
      .toEqual({ status: 409, body: { code: "website_company_simulation_stale" } });
    // A record whose seal does not verify.
    expect(await publish({ ...first, size_bytes: 1 })).toEqual({ status: 409, body: { code: "website_company_simulation_digest_invalid" } });
    // The path's capture is not the record's, or the scene id does not match the request.
    expect(await publish(first, "walkthrough-other")).toEqual({ status: 409, body: { code: "task_context_capture_mismatch" } });
    expect(await publish(first, CAPTURE, { scene_id: "site-other" })).toEqual({ status: 409, body: { code: "task_context_capture_mismatch" } });
    // No capture session yet.
    state.docs.delete(SESSION);
    expect(await publish(sealed({ simulation_revision: `sha256:${"6".repeat(64)}`, updated_at_epoch: 1_794_900_000 })))
      .toEqual({ status: 409, body: { code: "website_company_simulation_capture_missing" } });
    // No job at all.
    state.docs.delete(REQUEST);
    expect(await publish(first)).toEqual({ status: 409, body: { code: "website_company_simulation_request_missing" } });
  });

  // A record that fails the schema gets one of the contract's answers (409 `website_company_simulation_invalid`), not a
  // 400 outside it. It is not a rights refusal, so the Pipeline retries it on its next pass.
  it("refuses a package over the contract's 512 MiB, a different format, and a member name outside the zip", async () => {
    seed();
    expect(MAX_COMPANY_SIMULATION_BYTES).toBe(536_870_912);
    const invalid = { status: 409, body: { code: "website_company_simulation_invalid" } };
    expect(await publish(sealed({ size_bytes: MAX_COMPANY_SIMULATION_BYTES + 1 }))).toEqual(invalid);
    expect((await publish(sealed({ size_bytes: MAX_COMPANY_SIMULATION_BYTES }))).status).toBe(200);
    expect(await publish(sealed({ format: "zip_other" }))).toEqual(invalid);
    expect(await publish(sealed({ files: ["../outside.usda"] }))).toEqual(invalid);
    expect(await publish(sealed({ files: ["/abs/scene.usda"] }))).toEqual(invalid);
  });

  it("gives the rights refusals: a job that may not be shared, and a withdrawn job", async () => {
    // An older recording statement: the job is not shared, so no package is kept for it.
    seed({ request: { buyerType: "site_operator", consent_attestation: { ...sharedRecordingGrant(), statement_version: "2026-11-11.v3" } } });
    expect(await publish(sealed())).toEqual({ status: 409, body: { code: "website_company_simulation_not_permitted" } });
    // Blueprint-owned is not a basis the website can check: the statement decides.
    expect(await publish(sealed({ permission_basis: "blueprint_owned_capture", statement_version: null })))
      .toEqual({ status: 409, body: { code: "website_company_simulation_not_permitted" } });
    // Withdrawn: by the grant, by the record's own flag, or by the withdrawal record alone.
    seed({ consent_revoked: true });
    expect(await publish(sealed())).toEqual({ status: 409, body: { code: "source_revoked" } });
    seed({ capture_withdrawal: { state: "requested" } });
    expect(await publish(sealed())).toEqual({ status: 409, body: { code: "source_revoked" } });
    seed({ request: { buyerType: "site_operator", consent_attestation: { ...sharedRecordingGrant(), granted: false, revoked_at_iso: "2026-11-12T12:00:00.000Z" } } });
    expect(await publish(sealed())).toEqual({ status: 409, body: { code: "source_revoked" } });
    expect((state.docs.get(SESSION) as Record<string, unknown>).company_simulation).toBeUndefined();
  });
});

describe("the Pipeline's company clip callback: a record that fails its schema is a named refusal", () => {
  it("answers 409 website_company_clip_invalid, one of the contract's answers, never a 400 outside it", async () => {
    seed();
    for (const clip of [{ schema_version: "website_company_clip.v1", capture_id: CAPTURE }, { fps: 60 }, null]) {
      const response = await realFetch(`${base}/creator-captures/${CAPTURE}/company-clip`, { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", clip }) });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ code: "website_company_clip_invalid" });
    }
  });
});
