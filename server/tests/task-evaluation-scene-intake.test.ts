// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWebsiteSceneSponsorship, websiteSceneSponsorship, reserveWebsitePreparationSpend, amendWebsitePreparationRequestLimit, settleWebsitePreparationSpend } from "../utils/websiteSceneSponsorship";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "../utils/websiteTaskContext";
vi.mock("../utils/captureFootageReview", () => ({ buildCaptureFootageReviewer: vi.fn() }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: vi.fn(), reconstructionIsViewable: vi.fn() }));
vi.mock("../utils/worldReconstruction", () => ({ startWorldReconstruction: vi.fn(), advanceWorldReconstruction: vi.fn() }));
vi.mock("../utils/pipelineSyncSecurity", () => ({
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyPipelineSyncRequest: () => ({ ok: true }),
}));

const store = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  claims: {} as Record<string, unknown>,
  disabled: false,
}));
vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const reference = (key: string): any => ({
    key,
    get: async () => snapshot(key),
  });
  const snapshot = (key: string): any => ({
    id: key.split("/")[1],
    exists: store.rows.has(key),
    data: () => structuredClone(store.rows.get(key)),
    ref: reference(key),
  });
  const account = {
    getUser: async () => ({
      disabled: store.disabled,
      customClaims: store.claims,
    }),
  };
  function query(
    collection: string,
    filters: Array<[string, string, any]> = [],
    order?: [string, string],
  ): any {
    return {
      where: (field: string, op: string, value: unknown) =>
        query(collection, [...filters, [field, op, value]], order),
      orderBy: (field: string, direction: string) =>
        query(collection, filters, [field, direction]),
      limit: (limit: number) => ({
        get: async () => ({
          docs: [...store.rows.keys()]
            .filter(
              (key) =>
                key.startsWith(`${collection}/`) &&
                filters.every(([field, op, value]) =>
                  op === "=="
                    ? store.rows.get(key)[field] === value
                    : store.rows.get(key)[field] <= value,
                ),
            )
            .sort((left, right) => {
              if (!order) return 0;
              const a = store.rows.get(left)[order[0]],
                b = store.rows.get(right)[order[0]];
              return (
                (a < b ? -1 : a > b ? 1 : 0) * (order[1] === "desc" ? -1 : 1)
              );
            })
            .slice(0, limit)
            .map(snapshot),
        }),
      }),
    };
  }
  return {
    authAdmin: {
      ...account,
      tenantManager: () => ({ authForTenant: () => account }),
    },
    dbAdmin: {
      collection: (collection: string) => ({
        doc: (id: string) => reference(`${collection}/${id}`),
        ...query(collection),
      }),
      runTransaction: async (callback: any) =>
        callback({
          get: (ref: any) => ref.get(),
          create: (ref: any, value: unknown) => {
            if (store.rows.has(ref.key)) throw new Error("exists");
            store.rows.set(ref.key, structuredClone(value));
          },
          update: (ref: any, value: unknown) =>
            store.rows.set(ref.key, {
              ...store.rows.get(ref.key),
              ...structuredClone(value as object),
            }),
        }),
    },
  };
});
import router from "../routes/task-evaluation-scene-intakes";
import {
  buildSceneIntake,
  processSceneIntakeQueue,
  SCENE_TERMINAL_CLOSEOUT_POLL_LIMIT,
  sceneDigest,
  sceneIntakeCommand,
  sceneOwner,
  scenePipelineRequest,
} from "../utils/taskEvaluationSceneIntake";

const sha = (char: string) => `sha256:${char.repeat(64)}`;
const sourceId = "capture-upload-one";
const realFetch = globalThis.fetch;
let server: Server | undefined;
function command() {
  return {
    submission_id: "request-one",
    source_session_id: sourceId,
    task: {
      task_id: "task-one",
      strategy: "pick_and_place",
      subject: { description: "block" },
      support: { description: "table" },
      destination: {
        relation: "inside" as const,
        visible_label: "tray",
        position_world_m: [0.4, 0, 0.1],
        orientation_xyzw: [0, 0, 0, 1],
      },
      success: {
        control_frequency_hz: 15,
        maximum_episode_seconds: 24,
        minimum_lift_m: 0.05,
        pregrasp_clearance_m: 0.1,
        minimum_planar_displacement_m: 0.1,
        maximum_final_planar_target_error_m: 0.05,
        maximum_retries: 0,
        maximum_regrasps: 0,
      },
    },
    execution: {
      max_total_spend_usd: 20,
      max_paid_attempts: 1,
      max_retries: 0,
      expires_at_epoch: Math.floor(Date.now() / 1000) + 3600,
      allowed_providers: ["vast"],
      policy_candidates: [
        { id: "one", artifact_digest: sha("a") },
        { id: "two", artifact_digest: sha("b") },
      ],
      claim_scope: "development_only",
    },
    consent: {
      rights_reference: "owner-rights-v1",
      provider_terms_reference: sha("e"),
      private_processing_authorized: true,
      provider_training_authorized: false,
      task_confirmed: true,
      spend_authorized: true,
    },
  };
}
function source() {
  return {
    owner_user_id: "owner",
    status: "capture_accepted",
    request: { capture_authority_profile: "monocular_video" },
    pipeline_capture_intake_receipt: {
      capture_digest: sha("c"),
      envelope_digest: sha("f"),
      admission_status: "accepted",
      malware_content_validation: { status: "passed" },
      proof_boundary: { server_sha256_verified: true },
    },
  };
}
async function app() {
  const application = express();
  application.use(express.json());
  application.use((req, res, next) => {
    res.locals.firebaseUser = { uid: req.headers["x-user"] || "owner" };
    next();
  });
  application.use("/intakes", router);
  application.use("/internal", (await import("../routes/internal-capture-worlds")).default);
  server = createServer(application);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as any).port}/intakes`;
}
function accepted(request: any) {
  const value = {
    schema_version: "task_evaluation_scene_intake_receipt.v1",
    status: "accepted",
    intent_id: "scene-one",
    intent_digest: sha("d"),
    request_digest: sceneDigest(request),
    provider_mutation_performed_inside_http_request: false,
  };
  return { ...value, receipt_digest: sceneDigest(value) };
}
function pipelineStatus(request: any, overrides: Record<string, any> = {}) {
  const value = {
    schema_version: "task_evaluation_scene_intent_status.v1",
    intent_id: "scene-one",
    intent_digest: sha("d"),
    request_digest: sceneDigest(request),
    owner: request.owner,
    status: "expired",
    phase: "authority",
    blockers: ["scene_intake_authority_expired"],
    attempts: [{
      attempt_id: "attempt-one",
      source_commit: "d".repeat(40),
      runtime_digest: sha("e"),
      input_digest: sha("f"),
      provider: "vast",
      maximum_spend_usd: 2,
      status: "reserved",
    }],
    result_reference: null,
    provider_mutation_performed_by_status_read: false,
    ...overrides,
  };
  return { ...value, status_digest: sceneDigest(value) };
}
function revocationReceipt(request: any) {
  const value = {
    schema_version: "task_evaluation_scene_intent_revocation.v1",
    intent_id: "scene-one",
    intent_digest: sha("d"),
    owner: request.owner,
    status: "revoked",
    revoked_at_epoch: Date.now() / 1000,
    scope: "future_execution",
    provider_mutation_performed: false,
  };
  return { ...value, receipt_digest: sceneDigest(value) };
}
function stored() {
  return [...store.rows.entries()].find(([key]) =>
    key.startsWith("taskEvaluationSceneIntakes/"),
  )!;
}
beforeEach(() => {
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify({
    vast: {
      digest: sha("e"),
      label: "Vast admitted terms",
      url: "https://vast.ai/terms",
    },
  });
  store.rows.clear();
  store.claims = { admin: true };
  store.disabled = false;
  store.rows.set(`captureUploadSessions/${sourceId}`, source());
  process.env.TASK_EVALUATION_LAUNCH_URL =
    "https://pipeline.example/api/live-pipeline/task-evaluation-launches";
  process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "test-key";
});
afterEach(async () => {
  delete process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON;
  vi.unstubAllGlobals();
  if (server)
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
  delete process.env.TASK_EVALUATION_LAUNCH_URL;
  delete process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN;
  delete process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON;
  delete process.env.BLUEPRINT_WEBSITE_AGENTS_API_POLICY_JSON;
  delete process.env.BLUEPRINT_WEBSITE_AGENTS_API_TASK_DIGESTS;
  delete process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_TASK_DIGESTS;
  delete process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_SITE_TASK_DIGESTS;
});

function sponsoredCapture() {
  process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON = JSON.stringify({
    owner: { user_id: "blueprint-preparation", organization_id: "blueprint" },
    upstream_max_spend_usd: 5, native_max_spend_usd: 20, max_total_spend_usd: 25,
    max_paid_attempts: 2, ttl_seconds: 3600, provider_terms_reference: sha("e"),
  });
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify(Object.fromEntries(
    ["vast", "openai", "meta"].map(provider => [provider, { digest: sha("e"), label: "terms", url: "https://example.com/terms" }])));
  store.rows.set("inboundRequests/req1", { request: { consent_attestation: { granted: true,
    statement_version: "2026-09-18.v1", recorded_at_iso: new Date().toISOString() } },
    site_task_triage: { disposition: "qualified" }, account_owner_uid: "site-owner-uid" });
  store.rows.set("siteTaskBriefs/req1", { requestId: "req1", summary: "Pick the box",
    confirmedAtIso: new Date().toISOString(), confirmedBy: "private site owner", operatorAnswers: {}, unresolved: [] });
  // No site account, balance or ops role is required for Blueprint sponsorship.
  store.claims = {};
}

it("retains one Blueprint cap and expiry per upload and refuses changed, expired or revoked grants", async () => {
  sponsoredCapture();
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  expect(await loadWebsiteSceneSponsorship("req1", true)).toEqual(grant);
  expect(grant.consent.accepted_by).toBe("blueprint-preparation");
  expect(JSON.stringify(grant)).not.toContain("private site owner");
  const input = { requestId: "req1", brief: store.rows.get("siteTaskBriefs/req1"),
    record: store.rows.get("inboundRequests/req1"), now: grant.expires_at_epoch };
  expect(() => websiteSceneSponsorship(input)).toThrow("consent_expired");
  expect(() => websiteSceneSponsorship({ ...input, now: grant.consent.accepted_at_epoch,
    brief: { ...input.brief, summary: "Move the chair" } })).toThrow("sponsorship_changed");
  expect(() => websiteSceneSponsorship({ ...input, record: { ...input.record, consent_revoked: true } }))
    .toThrow("source_revoked");
  const policy = JSON.parse(process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON!);
  process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON = JSON.stringify({ ...policy, max_total_spend_usd: 24 });
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("not_configured");
});

it.each(["needs_conversation", "not_now", undefined])("funds no scene for a site our screen has not cleared (%s)", async (disposition) => {
  sponsoredCapture();
  store.rows.get("inboundRequests/req1").site_task_triage = disposition ? { disposition } : undefined;
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("website_scene_site_not_qualified");
  expect(store.rows.get("inboundRequests/req1").website_scene_sponsorship).toBeUndefined();
  // The Pipeline reads the refusal as a typed hold and retries the capture.
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1");
  const response = await realFetch(`${base}/scene-sponsorship`, { method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1" }) });
  expect(response.status).toBe(409);
  expect((await response.json()).code).toBe("website_scene_site_not_qualified");
});

it("funds only the exact owner-authorized exploratory development site without qualifying it for robot teams", async () => {
  sponsoredCapture();
  const record = store.rows.get("inboundRequests/req1");
  record.request.capture_mode = "self_capture";
  record.siteTaskGates = {
    taskShape: "single", objectVariety: "under_10", deploymentTimeline: "exploratory",
  };
  record.site_task_triage = {
    disposition: "not_now", blocking_field_ids: ["deploymentTimeline"],
    open_question_field_ids: [], unanswered_field_ids: ["sceneStability", "accessWindow"],
  };
  const context = projectWebsiteTaskContext(
    store.rows.get("siteTaskBriefs/req1"), projectWebsiteCaptureRights(record));
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("website_scene_site_not_qualified");
  process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_SITE_TASK_DIGESTS = JSON.stringify([sha("a")]);
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("website_scene_site_not_qualified");
  process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_SITE_TASK_DIGESTS = JSON.stringify([context.context_digest]);
  delete record.account_owner_uid;
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("website_scene_site_unclaimed");
  record.account_owner_uid = "site-owner-uid";
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  expect(grant).toMatchObject({ sponsor: "blueprint", preparation_max_total_spend_usd: 25,
    upstream_max_spend_usd: 5, max_total_spend_usd: 20,
    task_context_digest: context.context_digest,
    development_test_site: { claim_scope: "development_only",
      commercial_site_qualification: false, captured_room_readiness: false,
      unresolved_gate_ids: ["sceneStability", "accessWindow"] } });
  expect(grant.expires_at_epoch - grant.consent.accepted_at_epoch).toBe(3600);
  expect(record.site_task_triage.disposition).toBe("not_now");
  const retained = store.rows.get("inboundRequests/req1");
  expect(retained.site_task_triage.unanswered_field_ids).toEqual(["sceneStability", "accessWindow"]);
  expect(await loadWebsiteSceneSponsorship("req1", false)).toEqual(grant);
  const base = { requestId: "req1", brief: store.rows.get("siteTaskBriefs/req1"),
    record: retained, now: grant.consent.accepted_at_epoch };
  expect(() => websiteSceneSponsorship({ ...base,
    brief: { ...base.brief, summary: "Changed task" } })).toThrow("website_scene_sponsorship_changed");
  expect(() => websiteSceneSponsorship({ ...base,
    record: { ...retained, siteTaskGates: { ...retained.siteTaskGates,
      objectVariety: "ten_to_fifty" } } })).toThrow("website_scene_sponsorship_changed");
  expect(() => websiteSceneSponsorship({ ...base,
    record: { ...retained, consent_revoked: true } })).toThrow("source_revoked");
  delete process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_SITE_TASK_DIGESTS;
  expect(() => websiteSceneSponsorship(base)).toThrow("website_scene_sponsorship_changed");
  process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_SITE_TASK_DIGESTS = JSON.stringify([context.context_digest]);
  expect(grant.policy_digest).not.toBe(websiteSceneSponsorship({
    requestId: "req1", brief: store.rows.get("siteTaskBriefs/req1"),
    record: { ...record, website_scene_sponsorship: undefined, site_task_triage: { disposition: "qualified" } },
    now: Date.now() / 1000,
  }).policy_digest);
});

it("refuses exploratory test when any other gate is marginal, blocked or unanswered", async () => {
  sponsoredCapture();
  const record = store.rows.get("inboundRequests/req1");
  record.request.capture_mode = "self_capture";
  record.siteTaskGates = {
    taskShape: "single", objectVariety: "under_10", deploymentTimeline: "exploratory",
  };
  record.site_task_triage = {
    disposition: "not_now", blocking_field_ids: ["deploymentTimeline"],
    open_question_field_ids: [], unanswered_field_ids: ["sceneStability", "accessWindow"],
  };
  const context = projectWebsiteTaskContext(
    store.rows.get("siteTaskBriefs/req1"), projectWebsiteCaptureRights(record));
  process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_SITE_TASK_DIGESTS = JSON.stringify([context.context_digest]);
  for (const changed of [
    { sceneStability: "minor_drift" }, { taskShape: "open_category" },
    { accessWindow: "continuous" }, { objectVariety: undefined },
  ]) {
    const altered = { ...record, siteTaskGates: { ...record.siteTaskGates, ...changed } };
    expect(() => websiteSceneSponsorship({ requestId: "req1",
      brief: store.rows.get("siteTaskBriefs/req1"), record: altered, now: Date.now() / 1000 }))
      .toThrow("website_scene_site_not_qualified");
  }
  const wrong = { ...record, site_task_triage: { ...record.site_task_triage,
    blocking_field_ids: ["deploymentTimeline", "taskShape"] } };
  expect(() => websiteSceneSponsorship({ requestId: "req1",
    brief: store.rows.get("siteTaskBriefs/req1"), record: wrong, now: Date.now() / 1000 }))
    .toThrow("website_scene_site_not_qualified");
});

it("funds no scene until the site is saved to an account", async () => {
  sponsoredCapture();
  delete store.rows.get("inboundRequests/req1").account_owner_uid;
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("website_scene_site_unclaimed");
  store.rows.get("inboundRequests/req1").account_owner_uid = "site-owner-uid";
  await expect(loadWebsiteSceneSponsorship("req1", true)).resolves.toMatchObject({ sponsor: "blueprint" });
});

it("builds after the call clears the site, and a later downgrade does not strand authorized spend", async () => {
  sponsoredCapture();
  store.rows.get("inboundRequests/req1").site_task_triage = { disposition: "needs_conversation" };
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("website_scene_site_not_qualified");
  store.rows.get("inboundRequests/req1").site_task_triage = { disposition: "qualified" };
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  store.rows.get("inboundRequests/req1").site_task_triage = { disposition: "not_now" };
  expect(await loadWebsiteSceneSponsorship("req1", false)).toEqual(grant);
});

it.each([false, true])("queues the signed prepared website scene once, forwards without team payment and revokes withdrawn consent (preparation only: %s)", async (preparationOnly) => {
  sponsoredCapture();
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1");
  const post = (operation: string, extra = {}) => realFetch(`${base}/${operation}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", ...extra }),
  });
  const response = await post("scene-sponsorship");
  expect(response.status).toBe(200);
  const grant = await response.json();
  const request = {
    schema_version: "task_evaluation_scene_intake_request.v1", submission_id: grant.capture_id,
    owner: grant.owner, consent: grant.consent,
    source: { kind: "gaussian_splat", binding_id: `website-splat-${"a".repeat(32)}`, content_digest: sha("a") },
    task: { ...command().task, task_id: `website-${grant.task_context_digest.slice(7, 27)}`,
      subject: { description: "box", geometry_origin: "removed_before_reconstruction" } },
    execution: { ...command().execution, max_total_spend_usd: grant.max_total_spend_usd,
      max_paid_attempts: grant.max_paid_attempts, expires_at_epoch: grant.expires_at_epoch,
      allowed_providers: ["vast", "openai"],
      ...(preparationOnly ? { purpose: "scene_preparation", policy_candidates: [] } : {}) },
  };
  expect((await post("prepared-scene", { request })).status).toBe(202);
  expect((await post("prepared-scene", { request })).status).toBe(202);
  expect([...store.rows.keys()].filter(key => key.startsWith("taskEvaluationSceneIntakes/"))).toHaveLength(1);
  expect((await post("prepared-scene", { request: { ...request, execution: {
    ...request.execution, max_total_spend_usd: 100 } } })).status).toBe(409);
  const fetcher = vi.fn(async (_url: any, init: any) => {
    const payload = JSON.parse(init.body);
    return new Response(JSON.stringify(payload.intent_digest ? revocationReceipt(request) : accepted(payload)));
  });
  vi.stubGlobal("fetch", fetcher);
  await processSceneIntakeQueue();
  expect(stored()[1].state).toBe("accepted");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(request);
  store.rows.get("inboundRequests/req1").consent_revoked = true;
  stored()[1].next_forward_at_ms = 0;
  await processSceneIntakeQueue();
  expect(stored()[1].state).toBe("closeout_pending");
  expect(stored()[1].revocation_receipt.scope).toBe("future_execution");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
describe("persistent authenticated scene intake", () => {
  it("matches the Python RFC 8785 fixture for numeric and Unicode packet fields", () => {
    expect(
      sceneDigest({
        Z: 20,
        a: -0,
        small: 0.000001,
        task: { é: "unit", "😀": "frame" },
      }),
    ).toBe(
      "sha256:7b43809d2265a08bef03ae0b63a3ded4da0b19bf19066424c70406b8b53588e9",
    );
  });
  it("derives tenant identity and rejects forged actors, changed idempotency bytes, and another owner's source", async () => {
    const url = await app();
    const input = command();
    expect(
      sceneOwner({ uid: "owner", firebase: { tenant: "tenant-one" } }),
    ).toEqual({ user_id: "owner", organization_id: "tenant-one" });
    expect(
      sceneIntakeCommand.safeParse({ ...input, owner: { user_id: "victim" } })
        .success,
    ).toBe(false);
    expect(
      (
        await realFetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-user": "other" },
          body: JSON.stringify(input),
        })
      ).status,
    ).toBe(404);
    const submit = () =>
      realFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
    expect((await submit()).status).toBe(202);
    const original = structuredClone(stored()[1]);
    expect((await submit()).status).toBe(202);
    expect(stored()[1]).toEqual(original);
    expect((await (await realFetch(url)).json()).intakes).toHaveLength(1);
    input.execution.max_total_spend_usd = 21;
    expect((await submit()).status).toBe(409);
  });
  it("recovers the persisted outbox after request completion, verifies HMAC, and retains Pipeline readback", async () => {
    const url = await app();
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command()),
    });
    const fetcher = vi.fn(async (_url: any, init: any) => {
      const headers = init.headers;
      expect(headers["x-blueprint-pipeline-signature"]).toBe(
        `sha256=${createHmac("sha256", "test-key")
          .update(
            `${headers["x-blueprint-pipeline-timestamp"]}.blueprint-webapp.${headers["x-blueprint-pipeline-nonce"]}.${init.body || ""}`,
          )
          .digest("hex")}`,
      );
      if (init.method === "POST")
        return new Response(JSON.stringify(accepted(JSON.parse(init.body))));
      const request = stored()[1].request;
      const status = {
        schema_version: "task_evaluation_scene_intent_status.v1",
        intent_id: "scene-one",
        intent_digest: sha("d"),
        request_digest: sceneDigest(request),
        owner: request.owner,
        status: "preparing",
        phase: "source",
        blockers: [],
        attempts: [],
        result_reference: null,
        provider_mutation_performed_by_status_read: false,
      };
      return new Response(
        JSON.stringify({ ...status, status_digest: sceneDigest(status) }),
      );
    });
    vi.stubGlobal("fetch", fetcher);
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("accepted");
    expect(fetcher).toHaveBeenCalledTimes(1);
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1].pipeline_status.status).toBe("preparing");
    const other = await realFetch(url, { headers: { "x-user": "other" } });
    expect((await other.json()).intakes).toEqual([]);
  });
  it("rechecks commercial authority, expiry, source revocation, and stored bytes before any delivery", async () => {
    const url = await app();
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command()),
    });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    store.claims = {};
    // A client-writable profile cannot substitute for custom claims.
    store.rows.set("users/owner", { admin: true, roles: ["ops"] });
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("commercial_authorization_required");
    store.claims = { ops: true };
    stored()[1].next_forward_at_ms = 0;
    store.rows.get(`captureUploadSessions/${sourceId}`).capture_access = {
      future_processing_allowed: false,
    };
    await processSceneIntakeQueue();
    expect(stored()[1].blocker).toBe("source_revoked");
    expect(fetcher).not.toHaveBeenCalled();
    const value = stored()[1];
    value.state = "forward_pending";
    value.next_forward_at_ms = 0;
    value.request.execution.max_total_spend_usd = 99;
    await processSceneIntakeQueue();
    expect(stored()[1].blocker).toBe("stored_request_digest_invalid");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("retains ambiguous delivery and retries exactly the same request; does not consume a paid attempt", async () => {
    const url = await app();
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command()),
    });
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection_lost"))
      .mockImplementation(
        async (_url: any, init: any) =>
          new Response(JSON.stringify(accepted(JSON.parse(init.body)))),
      );
    vi.stubGlobal("fetch", fetcher);
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("forward_blocked");
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("accepted");
    expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
    expect(stored()[1].request.execution.max_paid_attempts).toBe(1);
  });
  it("distinguishes supplied geometry and native immutable upload identity without inventing capture evidence", () => {
    const input = sceneIntakeCommand.parse(command());
    const provided = source();
    provided.request.capture_authority_profile = "provided_scene_mesh";
    expect(
      buildSceneIntake(input, sceneOwner({ uid: "owner" }), provided).source
        .kind,
    ).toBe("mesh");
    provided.request.capture_authority_profile = "provided_scene_splat";
    expect(buildSceneIntake(input, sceneOwner({ uid: "owner" }), provided).source.kind).toBe("gaussian_splat");
    input.source_session_id = "native-cap-one";
    const native = {
      creator_id: "owner",
      immutable_upload_identity: {
        raw_bundle_digest: sha("a"),
        raw_manifest_uri: "gs://bucket/cap/raw/manifest.json",
        upload_completion_digest: sha("b"),
        verification_status: "pending_pipeline_storage_readback",
      },
    };
    expect(
      buildSceneIntake(input, sceneOwner({ uid: "owner" }), native).source,
    ).toEqual({
      kind: "capture_bundle",
      binding_id: "native-cap-one",
      content_digest: sha("a"),
    });
    expect(() =>
      buildSceneIntake(input, sceneOwner({ uid: "owner" }), {
        creator_id: "owner",
      }),
    ).toThrow("source_validation_required");
  });
  it("cancels an unissued intent locally and forwards revocation for an accepted intent", async () => {
    const url = await app();
    const input = command();
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    let [key] = stored();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(
      (
        await realFetch(`${url}/${key.split("/")[1]}/revoke`, {
          method: "POST",
        })
      ).status,
    ).toBe(202);
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("revoked");
    expect(fetcher).not.toHaveBeenCalled();
    store.rows.delete(key);
    input.submission_id = "request-two";
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    fetcher.mockImplementation(
      async (_url: any, init: any) =>
        new Response(JSON.stringify(accepted(JSON.parse(init.body)))),
    );
    await processSceneIntakeQueue();
    [key] = stored();
    await realFetch(`${url}/${key.split("/")[1]}/revoke`, { method: "POST" });
    fetcher.mockImplementation(async (_url: any, init: any) => {
      if (init.method === "GET") {
        return new Response(JSON.stringify(pipelineStatus(stored()[1].request, {
          status: "revoked",
          phase: "authority",
          blockers: ["scene_intake_authority_revoked"],
          attempts: [],
        })));
      }
      const body = JSON.parse(init.body);
      expect(body.owner).toEqual({
        user_id: "owner",
        organization_id: "user:owner",
      });
      return new Response(JSON.stringify(revocationReceipt({ owner: body.owner })));
    });
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("closeout_pending");
    expect(stored()[1].revocation_receipt.scope).toBe("future_execution");
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("revoked");
  });
  it("expires original consent and rejects changed provider terms before delivery", async () => {
    const url = await app();
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command()),
    });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 7200000);
    try {
      await processSceneIntakeQueue();
      expect(stored()[1].blocker).toBe("consent_expired");
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
    stored()[1].state = "forward_pending";
    stored()[1].next_forward_at_ms = 0;
    delete process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON;
    await processSceneIntakeQueue();
    expect(stored()[1].blocker).toBe(
      "provider_terms_not_configured_or_changed",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps polling a late result after Pipeline expiry and never forwards a second execution", async () => {
    const url = await app();
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command()),
    });
    const fetcher = vi.fn(async (_url: any, init: any) => {
      if (init.method === "POST")
        return new Response(JSON.stringify(accepted(JSON.parse(init.body))));
      const record = stored()[1];
      const statusPolls = fetcher.mock.calls.filter((call: any[]) => call[1]?.method === "GET").length;
      return new Response(JSON.stringify(statusPolls === 1
        ? pipelineStatus(record.request)
        : pipelineStatus(record.request, {
          status: "completed",
          result_run_id: "selected-policy-result",
          phase: "terminal",
          blockers: [],
          result_reference: {
            uri: "s3://example/late-result.tar",
            digest: sha("9"),
            size_bytes: 123,
          },
        })));
    });
    vi.stubGlobal("fetch", fetcher);

    await processSceneIntakeQueue();
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("closeout_pending");
    expect(stored()[1].pipeline_status.status).toBe("expired");
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("completed");
    expect(stored()[1].pipeline_status.result_run_id).toBe("selected-policy-result");
    expect(stored()[1].pipeline_status.result_reference.uri).toBe("s3://example/late-result.tar");
    expect(fetcher.mock.calls.map((call: any[]) => call[1]?.method)).toEqual(["POST", "GET", "GET"]);
  });

  it("delivers a late terminal failure after revocation while preserving future-execution revocation", async () => {
    const url = await app();
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command()),
    });
    const fetcher = vi.fn(async (_url: any, init: any) => {
      if (init.method === "POST" && String(_url).endsWith("/revoke"))
        return new Response(JSON.stringify(revocationReceipt(stored()[1].request)));
      if (init.method === "POST")
        return new Response(JSON.stringify(accepted(JSON.parse(init.body))));
      const record = stored()[1];
      const statusPolls = fetcher.mock.calls.filter((call: any[]) => call[1]?.method === "GET").length;
      return new Response(JSON.stringify(statusPolls === 1
        ? pipelineStatus(record.request, {
          status: "revoked",
          phase: "authority",
          blockers: ["scene_intake_authority_revoked"],
        })
        : pipelineStatus(record.request, {
          status: "blocked",
          phase: "policy_canary_blocked",
          blockers: ["provider_capacity_unavailable"],
        })));
    });
    vi.stubGlobal("fetch", fetcher);
    await processSceneIntakeQueue();
    const id = stored()[0].split("/")[1];
    expect((await realFetch(`${url}/${id}/revoke`, { method: "POST" })).status).toBe(202);
    await processSceneIntakeQueue();
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("closeout_pending");
    expect(stored()[1].pipeline_status.status).toBe("revoked");
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("blocked");
    expect(stored()[1].pipeline_status.blockers).toEqual(["provider_capacity_unavailable"]);
    expect(fetcher.mock.calls.map((call: any[]) => call[1]?.method)).toEqual(["POST", "POST", "GET", "GET"]);
    expect(fetcher.mock.calls.filter((call: any[]) => call[1]?.method === "POST")).toHaveLength(2);
  });

  it("bounds repeated read-only closeout polling with an explicit blocker", async () => {
    const url = await app();
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command()),
    });
    const fetcher = vi.fn(async (_url: any, init: any) => {
      if (init.method === "POST")
        return new Response(JSON.stringify(accepted(JSON.parse(init.body))));
      return new Response(JSON.stringify(pipelineStatus(stored()[1].request)));
    });
    vi.stubGlobal("fetch", fetcher);
    await processSceneIntakeQueue();
    stored()[1].state = "closeout_pending";
    stored()[1].closeout_poll_count = SCENE_TERMINAL_CLOSEOUT_POLL_LIMIT - 1;
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("blocked");
    expect(stored()[1].blocker).toBe("terminal_closeout_poll_cap_exhausted");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps an expired intent terminal when Pipeline reports no authorized attempt", async () => {
    const url = await app();
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command()),
    });
    const fetcher = vi.fn(async (_url: any, init: any) => {
      if (init.method === "POST")
        return new Response(JSON.stringify(accepted(JSON.parse(init.body))));
      return new Response(JSON.stringify(pipelineStatus(stored()[1].request, {
        status: "expired",
        blockers: ["scene_intake_authority_expired"],
        attempts: [],
      })));
    });
    vi.stubGlobal("fetch", fetcher);
    await processSceneIntakeQueue();
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("expired");
    expect(stored()[1].closeout_complete).toBe(true);
    const calls = fetcher.mock.calls.length;
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(fetcher).toHaveBeenCalledTimes(calls);
  });

  it("polls due records ahead of an older record scheduled for later", async () => {
    const url = await app();
    const input = command();
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    stored()[1].next_forward_at_ms = Date.now() + 3600000;
    input.submission_id = "due-second";
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const fetcher = vi.fn(
      async (_url: any, init: any) =>
        new Response(JSON.stringify(accepted(JSON.parse(init.body)))),
    );
    vi.stubGlobal("fetch", fetcher);
    await processSceneIntakeQueue(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).submission_id).toBe(
      "due-second",
    );
  });
  it("rejects wrong-owner signed status even if self-consistently digested", async () => {
    const request = buildSceneIntake(
      sceneIntakeCommand.parse(command()),
      sceneOwner({ uid: "owner" }),
      source(),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              schema_version: "task_evaluation_scene_intent_status.v1",
              intent_id: "scene-one",
              intent_digest: sha("d"),
              request_digest: sceneDigest(request),
              owner: { user_id: "other", organization_id: "user:other" },
              status: "completed",
              phase: null,
              blockers: [],
              attempts: [],
              result_reference: null,
              provider_mutation_performed_by_status_read: false,
              status_digest: sha("f"),
            }),
          ),
      ),
    );
    await expect(scenePipelineRequest(request, "scene-one")).rejects.toThrow(
      "pipeline_receipt_binding_invalid",
    );
  });
});
describe("same-owner collision-mesh companion binding", () => {
  // A completed 3DGS source can carry an optional same-owner collision mesh in a
  // declared common frame. buildSceneIntake reuses the full source-admission
  // validation for the companion (a recursive build), so ownership, revocation,
  // rights, and byte identity are enforced identically for both exports and the
  // companion's bytes+rights are pinned into the request digest.
  const splatSource = () => {
    const value = source();
    value.request.capture_authority_profile = "provided_scene_splat";
    return value;
  };
  const meshSource = (overrides: Record<string, any> = {}) => {
    const value = source();
    value.request.capture_authority_profile = "provided_scene_mesh";
    // Distinct companion bytes/rights so the companion binding is observable.
    value.pipeline_capture_intake_receipt.capture_digest = sha("1");
    value.pipeline_capture_intake_receipt.envelope_digest = sha("2");
    return { ...value, ...overrides };
  };
  const companionCommand = (overrides: Record<string, any> = {}) => ({
    ...command(),
    source_session_id: "capture-splat-one",
    collision_source_session_id: "capture-mesh-one",
    collision_same_frame_confirmed: true as const,
    ...overrides,
  });
  const owner = () => sceneOwner({ uid: "owner" });

  it("pins the companion's bytes and rights into the source binding", () => {
    const request = buildSceneIntake(
      sceneIntakeCommand.parse(companionCommand()),
      owner(),
      splatSource(),
      undefined,
      meshSource(),
    );
    expect(request.source.kind).toBe("gaussian_splat");
    expect(request.source.collision_mesh).toEqual({
      binding_id: "capture-mesh-one",
      content_digest: sha("1"),
      rights_reference: sha("2"),
      frame_relation: "owner_declared_common_frame",
    });
  });

  it("rejects a companion mesh owned by a different user or verified tenant", () => {
    const parsed = sceneIntakeCommand.parse(companionCommand());
    // Different owning user.
    expect(() =>
      buildSceneIntake(
        parsed,
        owner(),
        splatSource(),
        undefined,
        meshSource({ owner_user_id: "intruder" }),
      ),
    ).toThrow("source_not_owned");
    // Same user id, but the companion is bound to a different verified tenant.
    expect(() =>
      buildSceneIntake(
        parsed,
        owner(),
        splatSource(),
        undefined,
        meshSource({
          organization_binding_status: "firebase_tenant_verified",
          organization_id: "tenant-elsewhere",
        }),
      ),
    ).toThrow("source_not_owned");
  });

  it("refuses to reuse the same session as its own collision companion", () => {
    expect(() =>
      buildSceneIntake(
        sceneIntakeCommand.parse(
          companionCommand({ collision_source_session_id: "capture-splat-one" }),
        ),
        owner(),
        splatSource(),
        undefined,
        splatSource(),
      ),
    ).toThrow("collision_source_binding_required");
  });

  it("requires the companion to be a mesh and the frame to be confirmed", () => {
    // A splat cannot stand in for contact geometry.
    expect(() =>
      buildSceneIntake(
        sceneIntakeCommand.parse(companionCommand()),
        owner(),
        splatSource(),
        undefined,
        splatSource(),
      ),
    ).toThrow("collision_source_mesh_required");
    // Companion attached without the common-frame confirmation is refused; the
    // schema only accepts the literal true, so an unconfirmed frame cannot parse.
    expect(
      sceneIntakeCommand.safeParse(
        companionCommand({ collision_same_frame_confirmed: false }),
      ).success,
    ).toBe(false);
  });

  it("rejects a companion whose source is revoked at build time", () => {
    const parsed = sceneIntakeCommand.parse(companionCommand());
    for (const revoked of [
      { status: "revoked" },
      { status: "revocation_in_progress" },
      { capture_access: { future_processing_allowed: false } },
      { completed_capture_lifecycle: { state: "active" } },
    ]) {
      expect(() =>
        buildSceneIntake(
          parsed,
          owner(),
          splatSource(),
          undefined,
          meshSource(revoked),
        ),
      ).toThrow("source_revoked");
    }
  });

  it("rechecks companion ownership drift and revocation before any paid delivery", async () => {
    const url = await app();
    store.rows.set("captureUploadSessions/capture-splat-one", splatSource());
    store.rows.set("captureUploadSessions/capture-mesh-one", meshSource());
    expect(
      (
        await realFetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(companionCommand()),
        })
      ).status,
    ).toBe(202);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    // The companion source is revoked after admission.
    store.rows.get(
      "captureUploadSessions/capture-mesh-one",
    ).capture_access = { future_processing_allowed: false };
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1].blocker).toBe("source_revoked");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses delivery when companion bytes or rights change after admission", async () => {
    const url = await app();
    store.rows.set("captureUploadSessions/capture-splat-one", splatSource());
    store.rows.set("captureUploadSessions/capture-mesh-one", meshSource());
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(companionCommand()),
    });
    const fetcher = vi.fn(
      async (_url: any, init: any) =>
        new Response(JSON.stringify(accepted(JSON.parse(init.body)))),
    );
    vi.stubGlobal("fetch", fetcher);
    const receipt = () =>
      store.rows.get("captureUploadSessions/capture-mesh-one")
        .pipeline_capture_intake_receipt;
    // Companion bytes drift.
    receipt().capture_digest = sha("9");
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1].blocker).toBe("stored_request_digest_invalid");
    // Restore bytes; companion rights drift.
    receipt().capture_digest = sha("1");
    receipt().envelope_digest = sha("8");
    Object.assign(stored()[1], {
      state: "forward_pending",
      blocker: null,
      next_forward_at_ms: 0,
    });
    await processSceneIntakeQueue();
    expect(stored()[1].blocker).toBe("stored_request_digest_invalid");
    // No paid transport was attempted while the companion binding was invalid.
    expect(fetcher).not.toHaveBeenCalled();
    // With the original bytes and rights restored, the pinned request delivers.
    receipt().envelope_digest = sha("2");
    Object.assign(stored()[1], {
      state: "forward_pending",
      blocker: null,
      next_forward_at_ms: 0,
    });
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("accepted");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
describe("articulated open/close task intake", () => {
  const articulatedTask = () => ({
    task_id: "task-drawer",
    strategy: "articulated_open_close" as const,
    subject: { description: "three-drawer cabinet" },
    support: { description: "floor" },
    articulation: {
      assembly_label: "three-drawer cabinet",
      part_label: "middle drawer",
      joint_type: "prismatic" as const,
      estimated_usable_stroke_m: 0.32,
      travel_authority: "object_prior_estimate_from_estimated_visible_bounds",
      estimated_front_normal_world: [0, -1, 0],
      lock_status: "unknown" as const,
      part_observed_open_in_footage: false as const,
      physical_measurement_proven: false as const,
    },
    success: {
      control_frequency_hz: 15,
      maximum_episode_seconds: 30,
      minimum_opening_fraction_of_estimated_stroke: 0.6,
      minimum_hold_seconds: 1,
      maximum_retries: 0,
    },
  });
  it("accepts a mechanism instead of a destination and forwards it unchanged", () => {
    const parsed = sceneIntakeCommand.parse({ ...command(), task: articulatedTask() });
    expect(parsed.task.strategy).toBe("articulated_open_close");
    expect(parsed.task).toEqual(articulatedTask());
  });
  it("refuses a destination, a driven joint, or a travel estimate that mismatches the joint", () => {
    const withTask = (task: unknown) => sceneIntakeCommand.safeParse({ ...command(), task }).success;
    expect(withTask({ ...articulatedTask(), destination: command().task.destination })).toBe(false);
    expect(withTask({ ...articulatedTask(), articulation: { ...articulatedTask().articulation, joint_type: "position_drive" } })).toBe(false);
    expect(withTask({ ...articulatedTask(), articulation: { ...articulatedTask().articulation, joint_type: "revolute" } })).toBe(false);
    expect(withTask({ ...articulatedTask(), success: { ...articulatedTask().success, minimum_opening_fraction_of_estimated_stroke: 1.5 } })).toBe(false);
    expect(withTask({ ...articulatedTask(), success: { ...articulatedTask().success, maximum_retries: 1 } })).toBe(false);
  });
});

describe("structured task destination and success contract", () => {
  // The completed-scene factory requires a real destination pose and structured
  // success criteria. The website must supply and validate these; a
  // description-only task must fail closed here, not silently forward.
  it("validates and forwards the structured destination pose and success criteria unchanged", () => {
    const parsed = sceneIntakeCommand.safeParse(command());
    expect(parsed.success).toBe(true);
    const request = buildSceneIntake(
      sceneIntakeCommand.parse(command()),
      sceneOwner({ uid: "owner" }),
      source(),
    );
    // buildSceneIntake stages task verbatim; the pose and criteria reach the intent.
    expect(request.task.destination).toEqual({
      relation: "inside",
      visible_label: "tray",
      position_world_m: [0.4, 0, 0.1],
      orientation_xyzw: [0, 0, 0, 1],
    });
    expect(request.task.success).toEqual({
      control_frequency_hz: 15,
      maximum_episode_seconds: 24,
      minimum_lift_m: 0.05,
      pregrasp_clearance_m: 0.1,
      minimum_planar_displacement_m: 0.1,
      maximum_final_planar_target_error_m: 0.05,
      maximum_retries: 0,
      maximum_regrasps: 0,
    });
    // The shipped defaults land on a whole number of simulation steps.
    expect(
      Number.isInteger(
        request.task.success.control_frequency_hz *
          request.task.success.maximum_episode_seconds,
      ),
    ).toBe(true);
  });
  it("refuses a description-only task with an actionable code and stages nothing", async () => {
    const url = await app();
    const descriptionOnly = {
      ...command(),
      task: {
        task_id: "task-one",
        strategy: "pick_and_place",
        subject: { description: "block" },
        support: { description: "table" },
        destination: { description: "tray" },
        success: { description: "inside tray" },
      },
    };
    const response = await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(descriptionOnly),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("task_destination_pose_required");
    expect(
      [...store.rows.keys()].some((key) =>
        key.startsWith("taskEvaluationSceneIntakes/"),
      ),
    ).toBe(false);
  });
  it("rejects an invalid destination pose", () => {
    const withDestination = (destination: unknown) =>
      sceneIntakeCommand.safeParse({
        ...command(),
        task: { ...command().task, destination },
      }).success;
    // Non-unit quaternion.
    expect(
      withDestination({
        relation: "on",
        visible_label: "tray",
        position_world_m: [0, 0, 0],
        orientation_xyzw: [1, 1, 0, 0],
      }),
    ).toBe(false);
    // Non-finite position component.
    expect(
      withDestination({
        relation: "on",
        visible_label: "tray",
        position_world_m: [Infinity, 0, 0],
        orientation_xyzw: [0, 0, 0, 1],
      }),
    ).toBe(false);
    // Unknown relation and empty label both fail closed.
    expect(
      withDestination({
        relation: "beside",
        visible_label: "tray",
        position_world_m: [0, 0, 0],
        orientation_xyzw: [0, 0, 0, 1],
      }),
    ).toBe(false);
    expect(
      withDestination({
        relation: "on",
        visible_label: "",
        position_world_m: [0, 0, 0],
        orientation_xyzw: [0, 0, 0, 1],
      }),
    ).toBe(false);
    // A valid full pose passes.
    expect(
      withDestination({
        relation: "on",
        visible_label: "tray",
        position_world_m: [1, 2, 3],
        orientation_xyzw: [0, 0, 0, 1],
      }),
    ).toBe(true);
  });
  it("enforces zero retries/regrasps and the integer-steps success coupling", () => {
    const withSuccess = (patch: Record<string, unknown>) =>
      sceneIntakeCommand.safeParse({
        ...command(),
        task: { ...command().task, success: { ...command().task.success, ...patch } },
      }).success;
    expect(withSuccess({ maximum_retries: 1 })).toBe(false);
    expect(withSuccess({ maximum_regrasps: 1 })).toBe(false);
    expect(withSuccess({ minimum_lift_m: 0 })).toBe(false);
    // 15 * 24.5 = 367.5 is not a whole number of steps.
    expect(withSuccess({ maximum_episode_seconds: 24.5 })).toBe(false);
    // 20 Hz * 24 s = 480 steps is valid.
    expect(withSuccess({ control_frequency_hz: 20 })).toBe(true);
  });
});

describe("registered public scene intake", () => {
  it("uses the authenticated owner and publisher binding without a capture record", async () => {
    const request = command();
    request.source_session_id = "public-source-one";
    request.execution.allowed_providers = ["vast", "openai"];
    const task = { ...request.task,
      subject: { description: "small rigid object", source_instance_id: "12" },
      support: { description: "table", source_instance_id: "13" },
      destination: { relation: "on", visible_label: "green spot", position_world_m: [.4, .2, .75],
        orientation_xyzw: [0, 0, 0, 1], kind: "green_region", radius_m: .07 } };
    Object.assign(request, { task });
    const item: Record<string, any> = {
      schema_version: "task_evaluation_public_scene_source_choice.v1", source_kind: "public_scene",
      binding_id: request.source_session_id, source_content_digest: sha("c"), rights_reference: sha("f"),
      claim_scope: "development_only", task_proposal: task, task_proposal_digest: sceneDigest(task),
      required_providers: ["vast", "openai"],
    };
    item.choice_digest = sceneDigest(item);
    const catalog: Record<string, any> = { schema_version: "task_evaluation_public_scene_catalog.v1",
      provider_mutation_performed: false, sources: [item] };
    catalog.catalog_digest = sceneDigest(catalog);
    process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify({
      vast: { digest: sha("e"), label: "Private processing", url: "https://vast.ai/terms" },
      openai: { digest: sha("e"), label: "Private processing", url: "https://openai.com/policies/services-agreement/" },
    });
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: any, init: any) => {
      calls.push(String(url));
      if (String(url).endsWith("task-evaluation-public-scene-sources"))
        return new Response(JSON.stringify(catalog), { status: 200 });
      return new Response(JSON.stringify(accepted(JSON.parse(init.body))), { status: 202 });
    }));
    const base = await app();
    const post = () => realFetch(base, { method: "POST", headers: { "content-type": "application/json", "x-user": "owner" },
      body: JSON.stringify(request) });
    const response = await post();
    expect(response.status).toBe(202);
    expect(stored()[1].request.source).toEqual({ kind: "public_scene", binding_id: "public-source-one", content_digest: sha("c") });
    expect(stored()[1].request.owner).toEqual({ user_id: "owner", organization_id: "user:owner" });
    expect(stored()[1].request.consent.rights_reference).toBe(sha("f"));
    expect(store.rows.has("captureUploadSessions/public-source-one")).toBe(false);
    expect(stored()[1].request.task.destination.kind).toBe("green_region");
    const before = calls.length;
    expect((await post()).status).toBe(202);
    expect(calls.length).toBe(before);
    await processSceneIntakeQueue();
    expect(calls.some((url) => url.endsWith("task-evaluation-scene-intents"))).toBe(true);
  });

  it("refuses changed tasks and missing image-processing authority before forwarding", () => {
    const raw = command(); raw.source_session_id = "public-source-one";
    const parsed = sceneIntakeCommand.parse(raw);
    const choice: Record<string, any> = { schema_version: "task_evaluation_public_scene_source_choice.v1",
      source_kind: "public_scene", binding_id: raw.source_session_id, source_content_digest: sha("c"),
      rights_reference: sha("f"), claim_scope: "development_only", task_proposal: parsed.task,
      task_proposal_digest: sceneDigest(parsed.task), required_providers: ["vast", "openai"] };
    choice.choice_digest = sceneDigest(choice);
    expect(() => buildSceneIntake(parsed, sceneOwner({ uid: "owner" }), choice)).toThrow("public_scene_required_provider_missing");
    parsed.execution.allowed_providers.push("openai");
    parsed.task.subject.description = "different object";
    expect(() => buildSceneIntake(parsed, sceneOwner({ uid: "owner" }), choice)).toThrow();
  });
});


it("reserves hosted SAM from the Blueprint cap once and rejects overspend, changed requests and revoked consent", async () => {
  sponsoredCapture();
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const spend = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
    resource_class: "evaluator_api" as const, provider: "meta" as const, maximum_cost_usd: 3, request_count: 1 };
  const first = await reserveWebsitePreparationSpend("req1", spend);
  expect(first).toMatchObject({ status: "admitted", external_disclosure_allowed: true });
  expect(await reserveWebsitePreparationSpend("req1", spend)).toEqual({ ...first, status: "already_reserved" });
  expect(Object.keys(store.rows.get("inboundRequests/req1").website_preparation_reservations)).toHaveLength(1);
  await expect(reserveWebsitePreparationSpend("req1", { ...spend, maximum_cost_usd: 1 })).rejects.toThrow("idempotency_conflict");
  await expect(reserveWebsitePreparationSpend("req1", { ...spend, allocation_binding_digest: sha("2") })).rejects.toThrow("budget_exhausted");
  await reserveWebsitePreparationSpend("req1", { ...spend, allocation_binding_digest: sha("2"), maximum_cost_usd: 2 });
  await expect(reserveWebsitePreparationSpend("req1", { ...spend, allocation_binding_digest: sha("3"), maximum_cost_usd: .001 })).rejects.toThrow("budget_exhausted");
  store.rows.get("inboundRequests/req1").consent_revoked = true;
  await expect(reserveWebsitePreparationSpend("req1", spend)).rejects.toThrow("source_revoked");
});

it("reserves image edits and SAM against the same sponsor cap and checks the selected provider terms", async () => {
  sponsoredCapture();
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const image = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("4"),
    resource_class: "openai_api_candidate" as const, provider: "openai" as const, maximum_cost_usd: 4, request_count: 1 };
  const receipt = await reserveWebsitePreparationSpend("req1", image);
  expect(receipt).toMatchObject({ status: "admitted", resource_class: "openai_api_candidate", provider: "openai" });
  expect(await reserveWebsitePreparationSpend("req1", image)).toEqual({ ...receipt, status: "already_reserved" });
  await expect(reserveWebsitePreparationSpend("req1", { ...image, provider: "meta" })).rejects.toThrow("provider_resource_mismatch");
  await expect(reserveWebsitePreparationSpend("req1", { ...image, allocation_binding_digest: sha("5"),
    resource_class: "evaluator_api", provider: "meta", maximum_cost_usd: 2 })).rejects.toThrow("budget_exhausted");
  const terms = JSON.parse(process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON!);
  terms.openai.digest = sha("f");
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify(terms);
  await expect(reserveWebsitePreparationSpend("req1", image)).rejects.toThrow("provider_terms_not_configured_or_changed");
});

it("funds a single Marble operation from the same upstream cap with explicit World Labs terms", async () => {
  sponsoredCapture();
  const terms = JSON.parse(process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON!);
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify({ ...terms, world_labs: terms.openai });
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const spend = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("7"),
    resource_class: "provider_reconstruction_api" as const, provider: "world_labs" as const,
    maximum_cost_usd: 2.48, request_count: 1 };
  expect(await reserveWebsitePreparationSpend("req1", spend)).toMatchObject({ status: "admitted", provider: "world_labs" });
  expect(await reserveWebsitePreparationSpend("req1", spend)).toMatchObject({ status: "already_reserved" });
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify(terms);
  await expect(reserveWebsitePreparationSpend("req1", spend)).rejects.toThrow("provider_terms_not_configured_or_changed");
});

it("reserves MapAnything GPU work under the same website cap without a robot-team payment", async () => {
  sponsoredCapture();
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const spend = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("8"),
    resource_class: "gpu_render" as const, provider: "vast" as const, maximum_cost_usd: 2, request_count: 1 };
  expect(await reserveWebsitePreparationSpend("req1", spend)).toMatchObject({ status: "admitted", provider: "vast" });
  expect(await reserveWebsitePreparationSpend("req1", spend)).toMatchObject({ status: "already_reserved" });
  await expect(reserveWebsitePreparationSpend("req1", { ...spend, provider: "openai" })).rejects.toThrow("provider_resource_mismatch");
});


it("bounds Gemini analysis and review by the shared preparation cap and Google terms", async () => {
  sponsoredCapture();
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const spend = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("9"),
    resource_class: "evaluator_api" as const, provider: "google" as const, maximum_cost_usd: 1.04, request_count: 1 };
  await expect(reserveWebsitePreparationSpend("req1", spend)).rejects.toThrow("provider_terms_not_configured_or_changed");
  const terms = JSON.parse(process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON!);
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify({ ...terms, google: terms.openai });
  expect(await reserveWebsitePreparationSpend("req1", spend)).toMatchObject({ status: "admitted", provider: "google" });
  expect(await reserveWebsitePreparationSpend("req1", spend)).toMatchObject({ status: "already_reserved" });
  await expect(reserveWebsitePreparationSpend("req1", { ...spend, resource_class: "gpu_render" })).rejects.toThrow("provider_resource_mismatch");
  await reserveWebsitePreparationSpend("req1", { ...spend, allocation_binding_digest: sha("a"), maximum_cost_usd: .27 });
  await expect(reserveWebsitePreparationSpend("req1", { ...spend, allocation_binding_digest: sha("b"), maximum_cost_usd: 4 })).rejects.toThrow("budget_exhausted");
});


it("amends only preparation request count while retaining money, native authority, expiry and reservations", async () => {
  sponsoredCapture();
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const spend = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
    resource_class: "evaluator_api" as const, provider: "meta" as const,
    maximum_cost_usd: 1, request_count: grant.max_paid_attempts };
  const first = await reserveWebsitePreparationSpend("req1", spend);
  const next = { ...spend, allocation_binding_digest: sha("2"), request_count: 1 };
  await expect(reserveWebsitePreparationSpend("req1", next)).rejects.toThrow("budget_exhausted");
  const input = { authority_digest: grant.authority_digest, max_requests: 32,
    approved_by: grant.owner.user_id, approval_reference: "owner-reply:test-32" };
  await amendWebsitePreparationRequestLimit("req1", input);
  expect(store.rows.get("inboundRequests/req1").website_preparation_limit_amendment).toBeUndefined();
  const receipt = await amendWebsitePreparationRequestLimit("req1", input, true);
  expect(await amendWebsitePreparationRequestLimit("req1", input, true)).toEqual(receipt);
  const extension = { ...input, max_requests: 48, approval_reference: "owner-reply:test-48" };
  expect(await amendWebsitePreparationRequestLimit("req1", extension)).toMatchObject({
    max_requests: 48, prior_amendment_digest: receipt.amendment_digest });
  expect(store.rows.get("inboundRequests/req1").website_preparation_limit_extension).toBeUndefined();
  const extended = await amendWebsitePreparationRequestLimit("req1", extension, true);
  expect(await amendWebsitePreparationRequestLimit("req1", extension, true)).toEqual(extended);
  await expect(amendWebsitePreparationRequestLimit("req1", { ...extension, max_requests: 64 }, true))
    .rejects.toThrow("amendment_conflict");
  expect(await loadWebsiteSceneSponsorship("req1")).toEqual(grant);
  expect(await reserveWebsitePreparationSpend("req1", spend)).toEqual({ ...first, status: "already_reserved" });
  expect(await reserveWebsitePreparationSpend("req1", next)).toMatchObject({ status: "admitted" });
  expect(await reserveWebsitePreparationSpend("req1", { ...next, allocation_binding_digest: sha("3"),
    request_count: 32 })).toMatchObject({ status: "admitted" });
  await expect(reserveWebsitePreparationSpend("req1", { ...next, allocation_binding_digest: sha("4"),
    request_count: 32 })).rejects.toThrow("budget_exhausted");
  await expect(reserveWebsitePreparationSpend("req1", { ...next, allocation_binding_digest: sha("5"),
    maximum_cost_usd: 4 })).rejects.toThrow("budget_exhausted");
});

it("rejects stale, unauthorized, revoked and tampered preparation amendments", async () => {
  sponsoredCapture();
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const input = { authority_digest: grant.authority_digest, max_requests: 32,
    approved_by: grant.owner.user_id, approval_reference: "owner-reply:test-32" };
  await expect(amendWebsitePreparationRequestLimit("req1", { ...input, authority_digest: sha("f") }, true)).rejects.toThrow("binding_invalid");
  await expect(amendWebsitePreparationRequestLimit("req1", { ...input, approved_by: "stranger" }, true)).rejects.toThrow("binding_invalid");
  await expect(amendWebsitePreparationRequestLimit("req1", { ...input, max_requests: 65 }, true)).rejects.toThrow();
  const row = store.rows.get("inboundRequests/req1");
  row.consent_revoked = true;
  await expect(amendWebsitePreparationRequestLimit("req1", input, true)).rejects.toThrow("source_revoked");
  row.consent_revoked = false;
  await amendWebsitePreparationRequestLimit("req1", input, true);
  store.rows.get("inboundRequests/req1").website_preparation_limit_amendment.max_requests = 31;
  await expect(reserveWebsitePreparationSpend("req1", {
    task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
    resource_class: "evaluator_api", provider: "meta", maximum_cost_usd: 1, request_count: 1,
  })).rejects.toThrow("amendment_invalid");
});


it("settles final Marble billing without resetting request count or granting another generation", async () => {
  sponsoredCapture();
  const terms = JSON.parse(process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON!);
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify({ ...terms, world_labs: terms.openai });
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const spend = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
    resource_class: "provider_reconstruction_api" as const, provider: "world_labs" as const,
    maximum_cost_usd: 2.48, request_count: 1 };
  const first = await reserveWebsitePreparationSpend("req1", spend);
  const next = { ...spend, allocation_binding_digest: sha("2"), resource_class: "gpu_render" as const,
    provider: "vast" as const, maximum_cost_usd: 3 };
  await expect(reserveWebsitePreparationSpend("req1", next)).rejects.toThrow("budget_exhausted");
  const settlement = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
    provider: "world_labs" as const, operation_id: "op-one", operation_done: true as const,
    total_credits: 1600, provider_receipt_digest: sha("a") };
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1/preparation-settlement");
  const response = await realFetch(base, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", settlement }) });
  expect(response.status).toBe(200);
  const receipt = await response.json();
  expect(receipt).toMatchObject({ status: "settled", actual_cost_usd: 1.28 });
  expect(await settleWebsitePreparationSpend("req1", settlement)).toEqual(receipt);
  await expect(settleWebsitePreparationSpend("req1", { ...settlement, total_credits: 1 })).rejects.toThrow("idempotency_conflict");
  expect(await reserveWebsitePreparationSpend("req1", spend)).toEqual({ ...first, status: "already_reserved" });
  expect(await reserveWebsitePreparationSpend("req1", next)).toMatchObject({ status: "admitted" });
  await expect(reserveWebsitePreparationSpend("req1", { ...next, allocation_binding_digest: sha("3"),
    maximum_cost_usd: .01 })).rejects.toThrow("budget_exhausted");
  expect(await loadWebsiteSceneSponsorship("req1")).toEqual(grant);
});

it("releases only the quote after a signed pre-generation credit rejection", async () => {
  sponsoredCapture();
  const terms = JSON.parse(process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON!);
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify({ ...terms, world_labs: terms.openai });
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const first = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
    resource_class: "provider_reconstruction_api" as const, provider: "world_labs" as const,
    maximum_cost_usd: 2.48, request_count: 1 };
  const second = { ...first, allocation_binding_digest: sha("2"), maximum_cost_usd: 3 };
  await reserveWebsitePreparationSpend("req1", first);
  await expect(reserveWebsitePreparationSpend("req1", second)).rejects.toThrow("budget_exhausted");
  const rejection = { task_context_digest: grant.task_context_digest,
    allocation_binding_digest: first.allocation_binding_digest, provider: "world_labs" as const,
    rejection_code: "insufficient_api_credits_before_generation" as const, provider_receipt_digest: sha("a") };
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1/preparation-settlement");
  const response = await realFetch(base, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", settlement: rejection }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: "settled", actual_cost_usd: 0, ...rejection });
  expect(await settleWebsitePreparationSpend("req1", rejection)).toMatchObject({ actual_cost_usd: 0 });
  await expect(settleWebsitePreparationSpend("req1", { ...rejection, provider_receipt_digest: sha("b") }))
    .rejects.toThrow("idempotency_conflict");
  expect(await reserveWebsitePreparationSpend("req1", second)).toMatchObject({ status: "admitted" });
  expect((await reserveWebsitePreparationSpend("req1", first)).status).toBe("already_reserved");
  await expect(settleWebsitePreparationSpend("req1", { ...rejection, rejection_code: "unknown" as any })).rejects.toThrow();
});

it("releases the unused image-edit quote only after every covered request completed", async () => {
  sponsoredCapture();
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const spend = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
    resource_class: "openai_api_candidate" as const, provider: "openai" as const,
    maximum_cost_usd: 2.4, request_count: 1 };
  const first = await reserveWebsitePreparationSpend("req1", spend);
  const next = { ...spend, allocation_binding_digest: sha("2"), maximum_cost_usd: 2.7 };
  await expect(reserveWebsitePreparationSpend("req1", next)).rejects.toThrow("budget_exhausted");
  const settlement = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
    provider: "openai" as const, completed_request_count: 1, provider_charge_amount_usd: 0.53,
    usage_receipt_digest: sha("a") };
  // A partial batch leaves an uncertain request holding its quote.
  await expect(settleWebsitePreparationSpend("req1", { ...settlement, completed_request_count: 2 }))
    .rejects.toThrow("settlement_invalid");
  await expect(settleWebsitePreparationSpend("req1", { ...settlement, provider_charge_amount_usd: 2.41 }))
    .rejects.toThrow("settlement_invalid");
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1/preparation-settlement");
  const response = await realFetch(base, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", settlement }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: "settled", actual_cost_usd: 0.53 });
  await expect(settleWebsitePreparationSpend("req1", { ...settlement, provider_charge_amount_usd: 0.1 }))
    .rejects.toThrow("idempotency_conflict");
  expect(await reserveWebsitePreparationSpend("req1", spend)).toEqual({ ...first, status: "already_reserved" });
  expect(await reserveWebsitePreparationSpend("req1", next)).toMatchObject({ status: "admitted" });
});

it("cannot release a reservation using missing, mismatched or excessive provider billing", async () => {
  sponsoredCapture();
  const terms = JSON.parse(process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON!);
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify({ ...terms, world_labs: terms.openai });
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const settlement = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
    provider: "world_labs" as const, operation_id: "op-one", operation_done: true as const,
    total_credits: 1600, provider_receipt_digest: sha("a") };
  await expect(settleWebsitePreparationSpend("req1", settlement)).rejects.toThrow("settlement_invalid");
  await reserveWebsitePreparationSpend("req1", { task_context_digest: grant.task_context_digest,
    allocation_binding_digest: sha("1"), resource_class: "provider_reconstruction_api", provider: "world_labs",
    maximum_cost_usd: 2.48, request_count: 1 });
  await expect(settleWebsitePreparationSpend("req1", { ...settlement, task_context_digest: sha("b") })).rejects.toThrow("settlement_invalid");
  await expect(settleWebsitePreparationSpend("req1", { ...settlement, total_credits: 3101 })).rejects.toThrow("settlement_invalid");
  await expect(settleWebsitePreparationSpend("req1", { ...settlement, operation_done: false as any })).rejects.toThrow();
  expect(store.rows.get("inboundRequests/req1").website_preparation_reservations["1".repeat(64)].settlement).toBeUndefined();
});

it("releases only provider charged Vast capacity after a bound terminal rental", async () => {
  sponsoredCapture();
  const terms = JSON.parse(process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON!);
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify({ ...terms, vast: terms.openai });
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const admission = { task_context_digest: grant.task_context_digest,
    allocation_binding_digest: sha("1"), resource_class: "gpu_render" as const,
    provider: "vast" as const, maximum_cost_usd: .5, request_count: 1 };
  await reserveWebsitePreparationSpend("req1", admission);
  const settlement = { task_context_digest: grant.task_context_digest,
    allocation_binding_digest: admission.allocation_binding_digest, provider: "vast" as const,
    instance_id: "52151169", provider_charge_source: "instance-52151169",
    provider_charge_amount_usd: .01, provider_charge_receipt_digest: sha("2"),
    execution_result_digest: sha("3"), teardown_receipt_digest: sha("4"), provider_zero_digest: sha("5") };
  await expect(settleWebsitePreparationSpend("req1", { ...settlement,
    provider_charge_source: "instance-9" })).rejects.toThrow();
  const receipt = await settleWebsitePreparationSpend("req1", settlement);
  expect(receipt).toMatchObject({ status: "settled", actual_cost_usd: .01 });
  expect(await settleWebsitePreparationSpend("req1", settlement)).toEqual(receipt);
  await expect(settleWebsitePreparationSpend("req1", { ...settlement,
    provider_charge_amount_usd: .011 })).rejects.toThrow("idempotency_conflict");
  await expect(settleWebsitePreparationSpend("req1", { ...settlement,
    provider_charge_amount_usd: .51 })).rejects.toThrow("settlement_invalid");
});


it("admits only explicitly authorized development surfaces without creating a second native budget", async () => {
  sponsoredCapture();
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1");
  const post = (operation: string, extra = {}) => realFetch(`${base}/${operation}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", ...extra }),
  });
  const grant = await (await post("scene-sponsorship")).json();
  const test = {
    kind: "authored_surface_component_test",
    label: "Development test on an authored surface; captured scene integration pending.",
    claim_scope: "development_only", source_task_context_digest: grant.task_context_digest,
    source_preparation_digest: sha("b"), captured_scene_integration: "pending",
    captured_scene_evaluation_allowed: false, source_scene_blockers: ["support_surface_not_found_under_subject"],
  };
  const request = {
    schema_version: "task_evaluation_scene_intake_request.v1", submission_id: grant.capture_id,
    owner: grant.owner, consent: grant.consent,
    source: { kind: "mesh", binding_id: `website-development-${"a".repeat(32)}`, content_digest: sha("a") },
    task: { ...command().task, task_id: `website-${grant.task_context_digest.slice(7, 27)}-development`,
      subject: { description: "blue object", geometry_origin: "removed_before_reconstruction", test_environment: test },
      destination: { ...command().task.destination, mode: "existing_support_surface" } },
    execution: { ...command().execution, max_total_spend_usd: grant.max_total_spend_usd,
      max_paid_attempts: grant.max_paid_attempts, expires_at_epoch: grant.expires_at_epoch,
      allowed_providers: ["vast", "openai"] },
  };
  expect((await post("prepared-scene", { request })).status).toBe(409);
  process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_TASK_DIGESTS = JSON.stringify([grant.task_context_digest]);
  expect((await post("prepared-scene", { request })).status).toBe(202);
  expect((await post("prepared-scene", { request })).status).toBe(202);
  expect([...store.rows.keys()].filter(k => k.startsWith("taskEvaluationSceneIntakes/"))).toHaveLength(1);
  expect((await post("prepared-scene", { request: { ...request, submission_id: `${request.submission_id}-extra` } })).status).toBe(409);
  expect((await post("prepared-scene", { request: { ...request, task: { ...request.task,
    subject: { ...request.task.subject, test_environment: { ...test, captured_scene_evaluation_allowed: true } } } } })).status).toBe(409);
  const originalRequest = { ...request, source: { ...request.source, kind: "gaussian_splat", binding_id: `website-splat-${"a".repeat(32)}` },
    task: { ...request.task, task_id: `website-${grant.task_context_digest.slice(7, 27)}`,
      subject: { description: "blue object", geometry_origin: "removed_before_reconstruction" } } };
  // Same grant/submission cannot fund both the synthetic test and a second scene.
  expect((await post("prepared-scene", { request: originalRequest })).status).toBe(409);

  // Web and worker can have different runtime config. Preserve the real
  // refusal, don't spend a transport attempt, and resume the same grant.
  const fetcher = vi.fn(async (_url: any, init: any) =>
    new Response(JSON.stringify(accepted(JSON.parse(init.body)))));
  vi.stubGlobal("fetch", fetcher);
  process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_TASK_DIGESTS = "[]";
  await processSceneIntakeQueue();
  expect(stored()[1].blocker).toBe("website_scene_development_test_not_authorized");
  expect(stored()[1].state).toBe("forward_blocked");
  expect(stored()[1].forward_attempt_count).toBe(0);
  expect(fetcher).not.toHaveBeenCalled();
  process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_TASK_DIGESTS = JSON.stringify([grant.task_context_digest]);
  stored()[1].next_forward_at_ms = 0;
  await processSceneIntakeQueue();
  expect(stored()[1].state).toBe("accepted");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(request);
  expect(await loadWebsiteSceneSponsorship("req1")).toEqual(grant);
});

it("admits the separately labeled drawer fixture under the same scene sponsorship", async () => {
  sponsoredCapture();
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1");
  const post = (operation: string, extra = {}) => realFetch(`${base}/${operation}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", ...extra }),
  });
  const grant = await (await post("scene-sponsorship")).json();
  const test = {
    kind: "development_drawer_fixture",
    label: "Development drawer fixture; captured scene integration pending.",
    claim_scope: "development_only", source_task_context_digest: grant.task_context_digest,
    source_preparation_digest: sha("b"), captured_scene_integration: "pending",
    captured_scene_evaluation_allowed: false,
    source_scene_blockers: ["website_registration_anchor_frame_missing", "support_surface_not_found_under_subject"],
  };
  const request = {
    schema_version: "task_evaluation_scene_intake_request.v1", submission_id: grant.capture_id,
    owner: grant.owner, consent: grant.consent,
    source: { kind: "mesh", binding_id: `website-development-${"a".repeat(32)}`, content_digest: sha("a") },
    task: { task_id: `website-${grant.task_context_digest.slice(7, 27)}-development`,
      strategy: "articulated_open_close",
      subject: { description: "middle drawer of the wood-front cabinet", geometry_origin: "removed_before_reconstruction", test_environment: test },
      support: { description: "authored development surface" },
      articulation: { assembly_label: "three-drawer wood-front cabinet", part_label: "middle drawer",
        joint_type: "prismatic", estimated_usable_stroke_m: 0.1222,
        travel_authority: "object_prior_estimate_from_estimated_visible_bounds",
        estimated_front_normal_world: [0, -1, 0], lock_status: "unknown",
        part_observed_open_in_footage: false, physical_measurement_proven: false },
      success: { control_frequency_hz: 15, maximum_episode_seconds: 30,
        minimum_opening_fraction_of_estimated_stroke: 0.6, minimum_hold_seconds: 1,
        maximum_retries: 0 } },
    execution: { ...command().execution, max_total_spend_usd: grant.max_total_spend_usd,
      max_paid_attempts: grant.max_paid_attempts, expires_at_epoch: grant.expires_at_epoch,
      allowed_providers: ["vast", "openai"] },
  };
  process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_TASK_DIGESTS = JSON.stringify([grant.task_context_digest]);
  const acceptedFixture = await post("prepared-scene", { request });
  expect(acceptedFixture.status, await acceptedFixture.text()).toBe(202);
  expect((await post("prepared-scene", { request: { ...request, task: { ...request.task,
    subject: { ...request.task.subject, test_environment: { ...test,
      label: "Development test on an authored surface; captured scene integration pending." } } } } })).status).toBe(409);
});

it("binds scoped Claude terms through preparation and rechecks them before forwarding", async () => {
  sponsoredCapture();
  const inbound = store.rows.get("inboundRequests/req1");
  inbound.request.capture_region = "us";
  inbound.request.claude_authoring_consent = { granted: true,
    statement_version: "2026-09-24.v1", recorded_at_iso: new Date().toISOString() };
  const terms = JSON.parse(process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON!);
  terms.anthropic = { digest: sha("d"), label: "Anthropic commercial API terms",
    url: "https://www.anthropic.com/legal/commercial-terms" };
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify(terms);
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1");
  const post = (operation: string, extra = {}) => realFetch(`${base}/${operation}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", ...extra }),
  });
  const grant = await (await post("scene-sponsorship")).json();
  expect(grant).toMatchObject({ authoring_provider: "anthropic",
    anthropic_provider_terms_reference: sha("d"), max_total_spend_usd: 20 });
  const test = { kind: "authored_surface_component_test",
    label: "Development test on an authored surface; captured scene integration pending.",
    claim_scope: "development_only", source_task_context_digest: grant.task_context_digest,
    source_preparation_digest: sha("b"), captured_scene_integration: "pending",
    captured_scene_evaluation_allowed: false, source_scene_blockers: ["support_surface_not_found_under_subject"] };
  const request = { schema_version: "task_evaluation_scene_intake_request.v1",
    submission_id: grant.capture_id, owner: grant.owner, consent: grant.consent,
    source: { kind: "mesh", binding_id: `website-development-${"a".repeat(32)}`, content_digest: sha("a") },
    task: { ...command().task, task_id: `website-${grant.task_context_digest.slice(7, 27)}-development`,
      subject: { description: "blue object", geometry_origin: "removed_before_reconstruction", test_environment: test } },
    execution: { ...command().execution, max_total_spend_usd: grant.max_total_spend_usd,
      max_paid_attempts: grant.max_paid_attempts, expires_at_epoch: grant.expires_at_epoch,
      allowed_providers: ["vast", "openai", "anthropic"] } };
  process.env.BLUEPRINT_WEBSITE_DEVELOPMENT_TEST_TASK_DIGESTS = JSON.stringify([grant.task_context_digest]);
  const prepared = await post("prepared-scene", { request });
  expect(prepared.status, await prepared.text()).toBe(202);
  expect((await post("prepared-scene", { request: { ...request, execution: {
    ...request.execution, allowed_providers: ["vast", "openai"] } } })).status).toBe(409);
  const fetcher = vi.fn(async (_url: any, init: any) =>
    new Response(JSON.stringify(accepted(JSON.parse(init.body)))));
  vi.stubGlobal("fetch", fetcher);
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify({ ...terms,
    anthropic: { ...terms.anthropic, digest: sha("c") } });
  await processSceneIntakeQueue();
  expect(stored()[1].state).toBe("forward_blocked");
  expect(stored()[1].forward_attempt_count).toBe(0);
  expect(fetcher).not.toHaveBeenCalled();
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify(terms);
  stored()[1].next_forward_at_ms = 0;
  await processSceneIntakeQueue();
  expect(stored()[1].state).toBe("accepted");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("signs a scoped Sol managed-agent policy only after owner disclosure and an operator guard receipt", async () => {
  sponsoredCapture();
  const inbound = store.rows.get("inboundRequests/req1");
  inbound.request.capture_mode = "self_capture";
  inbound.request.capture_region = "us";
  inbound.request.sol_agents_api_consent = { granted: true,
    statement_version: "2026-09-24.v1", recorded_at_iso: new Date().toISOString() };
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("website_agents_api_task_not_authorized");
  const context = projectWebsiteTaskContext(
    store.rows.get("siteTaskBriefs/req1"), projectWebsiteCaptureRights(inbound));
  process.env.BLUEPRINT_WEBSITE_AGENTS_API_TASK_DIGESTS = JSON.stringify([context.context_digest]);
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("website_agents_api_policy_not_configured");
  const guard = sha("f");
  const policy = { schema_version: "scene_configuration_agents_api_policy.v1",
    disclosure_scope: "task_asset_source_frames_and_metric_envelope",
    session_retention: "until_deleted", trace_retention: "provider_default",
    region: "us", budget_policy: "project_guard_accepted_uncertainty",
    project_guard_receipt_digest: guard, ttl_seconds: 1800, maximum_review_cycles: 3 };
  process.env.BLUEPRINT_WEBSITE_AGENTS_API_POLICY_JSON = JSON.stringify(policy);
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  expect(grant).toMatchObject({ authoring_provider: "openai",
    authoring_agent_runtime: "openai_agents_api", authoring_model: "gpt-6-sol",
    agents_api_policy: { project_guard_receipt_digest: guard } });
  expect(await loadWebsiteSceneSponsorship("req1", true)).toEqual(grant);
  process.env.BLUEPRINT_WEBSITE_AGENTS_API_POLICY_JSON = JSON.stringify({ ...policy,
    project_guard_receipt_digest: sha("a") });
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("website_scene_sponsorship_changed");
  delete inbound.website_scene_sponsorship;
  inbound.request.sol_agents_api_consent.granted = false;
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("website_agents_api_disclosure_authority_invalid");
});

it("refuses Claude sponsorship without disclosure or configured Anthropic terms", async () => {
  sponsoredCapture();
  const inbound = store.rows.get("inboundRequests/req1");
  inbound.request.capture_region = "us";
  inbound.request.claude_authoring_consent = { granted: false,
    statement_version: "2026-09-24.v1", recorded_at_iso: new Date().toISOString() };
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("disclosure_authority_invalid");
  inbound.request.claude_authoring_consent.granted = true;
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("provider_terms_not_configured");
  expect(inbound.website_scene_sponsorship).toBeUndefined();
});


describe("site-only scene preparation", () => {
  it("accepts preparation without selecting robot-team policies", () => {
    const value = command();
    const parsed = sceneIntakeCommand.parse({ ...value,
      execution: { ...value.execution, purpose: "scene_preparation", policy_candidates: [] } });
    expect(parsed.execution.purpose).toBe("scene_preparation");
    expect(parsed.execution.policy_candidates).toEqual([]);
  });
  it("keeps policy evaluation and preparation scopes distinct", () => {
    const value = command();
    expect(sceneIntakeCommand.safeParse({ ...value,
      execution: { ...value.execution, policy_candidates: [] } }).success).toBe(false);
    expect(sceneIntakeCommand.safeParse({ ...value,
      execution: { ...value.execution, purpose: "scene_preparation" } }).success).toBe(false);
    expect(sceneIntakeCommand.safeParse({ ...value,
      execution: { ...value.execution, purpose: "anything", policy_candidates: [] } }).success).toBe(false);
    expect(sceneIntakeCommand.safeParse(value).success).toBe(true);
  });
});


it("accepts the Pipeline's signed cumulative budget readback without rewriting consent", async () => {
  const request = { owner: { user_id: "owner", organization_id: "user:owner" } };
  const status = pipelineStatus(request, { effective_execution_budget: {
    max_total_spend_usd: 60, max_paid_attempts: 16,
    extension_digest: sha("c"), extension_count: 1,
  } });
  const fetcher = vi.fn(async () => new Response(JSON.stringify(status)));
  vi.stubGlobal("fetch", fetcher);
  expect(await scenePipelineRequest(request, "scene-one")).toEqual(status);
  fetcher.mockImplementation(async () => new Response(JSON.stringify({ ...status,
    effective_execution_budget: { ...status.effective_execution_budget, max_total_spend_usd: 61 } })));
  await expect(scenePipelineRequest(request, "scene-one")).rejects.toThrow("pipeline_receipt_binding_invalid");
  fetcher.mockImplementation(async () => new Response(JSON.stringify(pipelineStatus(request, {
    effective_execution_budget: { ...status.effective_execution_budget, max_paid_attempts: 0 },
  }))));
  await expect(scenePipelineRequest(request, "scene-one")).rejects.toThrow("pipeline_status_receipt_invalid");
});

it.each(["saved_execution_setup_required", "saved_setup_unreadable"])("reopens a team selection and retries %s without reserving a provider attempt", async (failure) => {
  const url=await app();
  await realFetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(command())});
  const row=stored()[1];
  row.request.task.evaluation_source={evaluation_run_id:"team-one",source_launch_id:"source-one"};
  row.request_digest=sceneDigest(row.request);
  const selection=await import("../utils/teamEvaluationSelection");
  const rebuild=vi.spyOn(selection,"rebuildTeamEvaluation").mockRejectedValueOnce(new Error(failure));
  const fetcher=vi.fn(async(_url:any,init:any)=>new Response(JSON.stringify(accepted(JSON.parse(init.body)))));
  vi.stubGlobal("fetch",fetcher);
  try {
    await processSceneIntakeQueue();
    expect(stored()[1].blocker).toBe(failure);
    expect(stored()[1].forward_attempt_count).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
    expect(rebuild).toHaveBeenCalledTimes(1);
    stored()[1].next_forward_at_ms=0;
    rebuild.mockResolvedValue(structuredClone(stored()[1].request));
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("accepted");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).task.evaluation_source.evaluation_run_id).toBe("team-one");
  } finally {rebuild.mockRestore();}
});


it("reads one retained request for its exact owner only",async()=>{
  const url=await app();
  const created=await realFetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(command())});
  const receipt=await created.json();
  const read=await realFetch(`${url}/${receipt.id}`);
  expect(read.status).toBe(200);
  expect(await read.json()).toMatchObject({id:receipt.id,request_digest:receipt.request_digest});
  expect((await realFetch(`${url}/${receipt.id}`,{headers:{"x-user":"other"}})).status).toBe(404);
});
