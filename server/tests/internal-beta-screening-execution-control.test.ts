// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { ingestBetaPolicyScreening } from "../utils/betaPolicyScreeningIngest";
import { screeningFixture, screeningSha } from "./fixtures/beta-policy-screening";

const store = vi.hoisted(() => ({ state: { docs: new Map<string, any>() }, fail: false }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { createFakeFirestore } = await import("./helpers/fake-firestore");
  const database = createFakeFirestore(store.state);
  return { dbAdmin: { ...database, runTransaction: async (fn: any) => {
    if (store.fail) throw new Error("mock_storage_unreachable");
    return database.runTransaction(fn);
  } } };
});
vi.mock("../utils/pipelineSyncSecurity", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
const SECRET = "test-only-execution-control-signature";
let router: any, body: any;
const controlRows = () => store.state.docs.get("taskEvaluationPolicyRuns/campaign-one").screening_execution_controls;
beforeEach(async () => {
  store.state.docs.clear(); store.fail = false;
  vi.stubEnv("PIPELINE_SYNC_TOKEN", SECRET); vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
  const { job, brief, intake, publication } = screeningFixture();
  (intake.request as any).execution = { expires_at_epoch: Math.floor(Date.now() / 1000) + 3600 };
  intake.request_digest = crossRuntimeDigest(intake.request);
  intake.receipt.request_digest = intake.request_digest;
  intake.receipt.receipt_digest = crossRuntimeArtifactDigest(intake.receipt, "receipt_digest");
  intake.pipeline_status.request_digest = intake.request_digest;
  intake.pipeline_status.status_digest = crossRuntimeArtifactDigest(intake.pipeline_status, "status_digest");
  store.state.docs.set("inboundRequests/job-one", job); store.state.docs.set("siteTaskBriefs/job-one", brief);
  store.state.docs.set("taskEvaluationSceneIntakes/intake-one", intake);
  await ingestBetaPolicyScreening(publication);
  body = { schema_version: "blueprint.beta_policy_screening_execution_control_request.v1",
    campaign_id: publication.campaign_id, site_id: publication.site_id, plan_digest: publication.plan_digest,
    candidate_id: publication.candidates[0].candidate_id, configuration_digest: publication.candidates[0].configuration_digest,
    attempt_id: "attempt-one", invocation_id: screeningSha("3"), prepared_digest: screeningSha("1"),
    authority_digest: screeningSha("2"), resource_name: "blueprint-campaign-one", source: publication.source };
  router = (await import("../routes/internal-beta-policy-screening")).default;
});
afterEach(() => {
  vi.unstubAllEnvs(); store.fail = false;
});
function send(value = body, options: { campaign?: string; signed?: boolean; extraHeaders?: Record<string, string> } = {}) {
  const text = JSON.stringify(value), timestamp = new Date().toISOString();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...options.extraHeaders };
  if (options.signed !== false) Object.assign(headers, { "X-Blueprint-Pipeline-Timestamp": timestamp,
    "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: SECRET, timestamp, body: text }) });
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    // Exercise Express matching, real HMAC verification and the transactional
    // helper in process. No listening socket, external storage or network.
    let status = 200;
    const response = { status(code: number) { status = code; return response; },
      json(result: any) { resolve({ status, body: result }); return response; } };
    router.handle({ method: "POST", url: `/beta-policy-screening-runs/${options.campaign ?? "campaign-one"}/execution-control`,
      body: value, rawBody: text,
      header(name: string) { const key = Object.keys(headers).find(value => value.toLowerCase() === name.toLowerCase()); return key ? headers[key] : undefined; } },
    response, (error?: Error) => reject(error ?? new Error("control_route_not_matched")));
  });
}

it("authenticates with the existing controller signature and returns exact persisted control", async () => {
  const response = await send();
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ schema_version: "blueprint.beta_policy_screening_execution_control.v1",
    status: "current", new_execution_authorized: false, read_only_closeout_allowed: true });
  expect(controlRows()[response.body.binding_digest.slice(7)]).toEqual(response.body);
  expect(response.body.control_digest).toBe(crossRuntimeArtifactDigest(response.body, "control_digest"));
});

it("refuses unsigned and legacy bearer-only reads even when legacy publication auth is configured", async () => {
  expect((await send(body, { signed: false })).status).toBe(401);
  vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "true");
  expect((await send(body, { signed: false, extraHeaders: { "X-Blueprint-Pipeline-Token": SECRET } })).status).toBe(401);
  expect(controlRows()).toBeUndefined();
});

it("refuses a bad HMAC or stale signature before observing stored authority", async () => {
  const timestamp = new Date(Date.now() - 600_000).toISOString();
  expect((await send(body, { signed: false, extraHeaders: { "X-Blueprint-Pipeline-Timestamp": new Date().toISOString(),
    "X-Blueprint-Pipeline-Signature": "bad-signature" } })).status).toBe(401);
  expect((await send(body, { signed: false, extraHeaders: { "X-Blueprint-Pipeline-Timestamp": timestamp,
    "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: SECRET, timestamp, body: JSON.stringify(body) }) } })).status).toBe(401);
  expect(controlRows()).toBeUndefined();
});

it("requires exact path/body scope and strict source/request schemas", async () => {
  expect((await send(body, { campaign: "other-campaign" })).status).toBe(400);
  expect((await send({ ...body, gpu_token: "injected" })).status).toBe(400);
  expect((await send({ ...body, source: { ...body.source, team_id: "injected" } })).status).toBe(400);
  expect(controlRows()).toBeUndefined();
});

it("refuses a validly signed request whose source or candidate differs from the retained campaign", async () => {
  expect(await send({ ...body, candidate_id: "other-candidate" })).toMatchObject({ status: 409, body: { code: "screening_control_identity_conflict" } });
  expect(await send({ ...body, source: { ...body.source, scene_intent_digest: screeningSha("9") } }))
    .toMatchObject({ status: 409, body: { code: "screening_control_identity_conflict" } });
  expect(controlRows()).toBeUndefined();
});

it("returns a durable historical stop on current withdrawal while allowing own-resource closeout reads", async () => {
  await send();
  store.state.docs.get("inboundRequests/job-one").capture_withdrawal = { state: "uploads_stopped_cleanup_pending" };
  const stopped = await send();
  expect(stopped).toMatchObject({ status: 200, body: { status: "stopped", cancellation_requested: true, applicability: "historical_only" } });
  store.state.docs.delete("inboundRequests/job-one");
  expect(await send()).toEqual(stopped);
});

it("returns 503 with no decision for storage loss or missing real source expiry", async () => {
  store.fail = true;
  expect(await send()).toMatchObject({ status: 503, body: { code: "screening_store_unavailable" } });
  store.fail = false;
  delete store.state.docs.get("taskEvaluationSceneIntakes/intake-one").request.execution;
  expect(await send()).toMatchObject({ status: 503, body: { code: "screening_control_authority_unavailable" } });
  expect(controlRows()).toBeUndefined();
});
