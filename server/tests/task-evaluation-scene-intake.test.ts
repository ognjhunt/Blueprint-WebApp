// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWebsiteSceneSponsorship, websiteSceneSponsorship, reserveWebsitePreparationSpend, amendWebsitePreparationRequestLimit, amendWebsitePreparationSpendLimit, settleWebsitePreparationSpend, loadWebsiteAtlasConfiguration } from "../utils/websiteSceneSponsorship";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "../utils/websiteTaskContext";
import { WEBSITE_JOB_WINDOW_DEFAULT_SECONDS, WEBSITE_JOB_WINDOW_MAX_SECONDS } from "../utils/websiteJobWindow";
import { familyScreeningFixture, navigationScreeningFixture } from "./fixtures/beta-policy-screening";
import producerFamilyStatus from "./fixtures/pipeline-family-prepared-status.v1.json";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { WEBSITE_NAVIGATION_REISSUE } from "../utils/websitePreparationRevision";
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
    const field = (value: any, path: string) => path.split(".").reduce((item, key) => item?.[key], value);
    return {
      // Equality only, for the job-ceiling ledger reads inside a transaction.
      get: async () => ({
        docs: [...store.rows.keys()]
          .filter((key) => key.startsWith(`${collection}/`) && !key.slice(collection.length + 1).includes("/")
            && filters.every(([path, , value]) => field(store.rows.get(key), path) === value))
          .map(snapshot),
      }),
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
          set: (ref: any, value: unknown) => store.rows.set(ref.key, structuredClone(value)),
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
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { assertWithinWebsiteJobCeiling, transactionJobLedgerReader, websiteJobSpend } from "../utils/websiteJobCeiling";
import {
  buildSceneIntake,
  processSceneIntakeQueue,
  SCENE_FORWARD_RETRY_MAX_MS,
  SCENE_TERMINAL_CLOSEOUT_POLL_LIMIT,
  sceneDigest,
  sceneForwardRetryDelayMs,
  sceneIntakeCommand,
  sceneOwner,
  scenePipelineRequest,
  SPONSORSHIP_CHANGED_CONFIRM_MS,
} from "../utils/taskEvaluationSceneIntake";
import { createRateLimitedAlerter } from "../utils/opsProcessAlerts";

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
  vi.unstubAllEnvs();
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

it("issues a seven-day execution window, the most the Pipeline accepts, and refuses a longer one", async () => {
  sponsoredCapture();
  const policy = JSON.parse(process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON!);
  process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON = JSON.stringify({ ...policy, ttl_seconds: 7 * 86400 });
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  expect(grant.expires_at_epoch - grant.consent.accepted_at_epoch).toBe(7 * 86400);
  store.rows.delete("inboundRequests/req1");
  sponsoredCapture();
  process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON = JSON.stringify({ ...policy, ttl_seconds: 7 * 86400 + 1 });
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("not_configured");
});

describe("the website job window is one policy value", () => {
  const DAY = 86400;
  const setPolicy = (changes: Record<string, unknown>, drop?: string) => {
    const policy = { ...JSON.parse(process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON!), ...changes };
    if (drop) delete policy[drop];
    process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON = JSON.stringify(policy);
  };

  it("defaults to the owner-approved seven days, the bound the Pipeline mirrors", async () => {
    // blueprint_pipeline/website_job_window.py WEBSITE_JOB_WINDOW_MAX_SECONDS must equal this.
    expect(WEBSITE_JOB_WINDOW_MAX_SECONDS).toBe(7 * DAY);
    expect(WEBSITE_JOB_WINDOW_DEFAULT_SECONDS).toBeLessThanOrEqual(WEBSITE_JOB_WINDOW_MAX_SECONDS);
    sponsoredCapture();
    setPolicy({}, "ttl_seconds");
    const grant = await loadWebsiteSceneSponsorship("req1", true);
    expect(grant.expires_at_epoch - grant.consent.accepted_at_epoch).toBe(WEBSITE_JOB_WINDOW_DEFAULT_SECONDS);
    // Leaving the length out and naming the default are the same policy.
    setPolicy({ ttl_seconds: WEBSITE_JOB_WINDOW_DEFAULT_SECONDS });
    expect(await loadWebsiteSceneSponsorship("req1", false)).toEqual(grant);
  });

  it("keeps an issued grant on its own window when only the length changes, and refuses any other change", async () => {
    sponsoredCapture();
    setPolicy({ ttl_seconds: DAY });
    const day = await loadWebsiteSceneSponsorship("req1", true);
    expect(day.expires_at_epoch - day.consent.accepted_at_epoch).toBe(DAY);
    // The owner moves the window to seven days: the one-day grant still reads, unchanged.
    setPolicy({ ttl_seconds: 7 * DAY });
    expect(await loadWebsiteSceneSponsorship("req1", false)).toEqual(day);
    expect(await loadWebsiteSceneSponsorship("req1", true)).toEqual(day);
    const input = { requestId: "req1", brief: store.rows.get("siteTaskBriefs/req1"),
      record: store.rows.get("inboundRequests/req1") };
    expect(websiteSceneSponsorship({ ...input, now: day.expires_at_epoch - 1 })).toEqual(day);
    // It gains no time: it still ends at the expiry it was issued with.
    expect(() => websiteSceneSponsorship({ ...input, now: day.expires_at_epoch })).toThrow("consent_expired");
    expect(store.rows.get("inboundRequests/req1").website_scene_sponsorship).toEqual(day);
    // Caps and attempts stay bound: any other policy change still refuses the grant.
    setPolicy({ max_paid_attempts: 3 });
    await expect(loadWebsiteSceneSponsorship("req1", false)).rejects.toThrow("website_scene_sponsorship_changed");
    setPolicy({ max_paid_attempts: 2, native_max_spend_usd: 19 });
    await expect(loadWebsiteSceneSponsorship("req1", false)).rejects.toThrow("website_scene_sponsorship_changed");
    // A new upload gets the new length.
    store.rows.delete("inboundRequests/req1");
    sponsoredCapture();
    setPolicy({ ttl_seconds: 7 * DAY });
    const week = await loadWebsiteSceneSponsorship("req1", true);
    expect(week.expires_at_epoch - week.consent.accepted_at_epoch).toBe(7 * DAY);
  });

  it("lets an owner extension add at most seven days past a seven-day grant's own expiry", async () => {
    sponsoredCapture();
    setPolicy({ ttl_seconds: 7 * DAY });
    const grant = await loadWebsiteSceneSponsorship("req1", true);
    const raw = grant.expires_at_epoch;
    const input = { requestId: "req1", brief: store.rows.get("siteTaskBriefs/req1"),
      record: store.rows.get("inboundRequests/req1"), now: raw + 6 * DAY };
    expect(() => websiteSceneSponsorship(input)).toThrow("consent_expired");
    expect(websiteSceneSponsorship({ ...input, executionWindowUntil: raw + 6 * DAY + 3600 })).toEqual(grant);
    expect(() => websiteSceneSponsorship({ ...input, now: raw + 7 * DAY, executionWindowUntil: raw + 30 * DAY }))
      .toThrow("consent_expired");
    expect(store.rows.get("inboundRequests/req1").website_scene_sponsorship).toEqual(grant);
  });

  it("queues and forwards a scene prepared days after a seven-day grant was issued", async () => {
    sponsoredCapture();
    setPolicy({ ttl_seconds: 7 * DAY });
    const record = store.rows.get("inboundRequests/req1");
    // Issued three days ago: past the former one-day window, inside the new one.
    record.website_scene_sponsorship = websiteSceneSponsorship({ requestId: "req1",
      brief: store.rows.get("siteTaskBriefs/req1"), record, now: Date.now() / 1000 - 3 * DAY });
    const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1");
    const post = (operation: string, extra = {}) => realFetch(`${base}/${operation}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", ...extra }),
    });
    const grant = await (await post("scene-sponsorship")).json();
    expect(grant).toEqual(record.website_scene_sponsorship);
    expect(grant.expires_at_epoch - grant.consent.accepted_at_epoch).toBe(7 * DAY);
    const request = {
      schema_version: "task_evaluation_scene_intake_request.v1", submission_id: grant.capture_id,
      owner: grant.owner, consent: grant.consent,
      source: { kind: "gaussian_splat", binding_id: `website-splat-${"a".repeat(32)}`, content_digest: sha("a") },
      task: { ...command().task, task_id: `website-${grant.task_context_digest.slice(7, 27)}`,
        subject: { description: "box", geometry_origin: "removed_before_reconstruction" } },
      execution: { ...command().execution, max_total_spend_usd: grant.max_total_spend_usd,
        max_paid_attempts: grant.max_paid_attempts, expires_at_epoch: grant.expires_at_epoch,
        allowed_providers: ["vast", "openai"] },
    };
    expect((await post("prepared-scene", { request })).status).toBe(202);
    const fetcher = vi.fn(async (_url: any, init: any) => new Response(JSON.stringify(accepted(JSON.parse(init.body)))));
    vi.stubGlobal("fetch", fetcher);
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("accepted");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(request);
  });
});

it("derives a supplementary preparation binding without renewing the original allowance or expiry", async () => {
  sponsoredCapture();
  const root = await loadWebsiteSceneSponsorship("req1", true);
  const record = store.rows.get("inboundRequests/req1");
  const binding = { schema_version: "website_capture_continuation.v1", capture_id: "supplement-test",
    original_capture_id: "walkthrough-req1", coordinate_frames_independent: true, lineage: [{ synthetic: true }] };
  const value = websiteSceneSponsorship({ requestId: "req1", brief: store.rows.get("siteTaskBriefs/req1"), record,
    now: root.consent.accepted_at_epoch + 10, captureId: "supplement-test", captureBinding: binding });
  expect(value).toMatchObject({ capture_id: "supplement-test", continuation_parent_authority_digest: root.authority_digest,
    expires_at_epoch: root.expires_at_epoch, upstream_max_spend_usd: root.upstream_max_spend_usd,
    max_total_spend_usd: root.max_total_spend_usd, max_paid_attempts: root.max_paid_attempts });
  expect(value.task_context_digest).not.toBe(root.task_context_digest);
  expect(record.website_scene_sponsorship).toEqual(root);
  expect(() => websiteSceneSponsorship({ requestId: "req1", brief: store.rows.get("siteTaskBriefs/req1"),
    record: { ...record, consent_revoked: true }, now: root.consent.accepted_at_epoch + 10,
    captureId: "supplement-test", captureBinding: binding })).toThrow("source_revoked");
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

// Owner decision 2026-11-11: the screen no longer gates the simulation for a job
// whose video arrived after the change. The jobs above, without the marker,
// were uploaded before it and stay held for the owner to decide.
it.each(["needs_conversation", "not_now", undefined])("funds a %s job uploaded after the screen stopped gating, with exactly a qualified job's amounts", async (disposition) => {
  const { sceneScreenGateEndedMarker } = await import("../utils/sceneScreenGate");
  sponsoredCapture();
  const qualified = await loadWebsiteSceneSponsorship("req1", true);
  sponsoredCapture();
  const record = store.rows.get("inboundRequests/req1");
  record.site_task_triage = disposition ? { disposition } : undefined;
  record.scene_screen_gate_ended = sceneScreenGateEndedMarker("req1", new Date().toISOString());
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  expect(store.rows.get("inboundRequests/req1").website_scene_sponsorship).toEqual(grant);
  const money = (value: any) => ({ policy_digest: value.policy_digest, owner: value.owner, sponsor: value.sponsor,
    preparation_max_total_spend_usd: value.preparation_max_total_spend_usd, upstream_max_spend_usd: value.upstream_max_spend_usd,
    max_total_spend_usd: value.max_total_spend_usd, max_paid_attempts: value.max_paid_attempts,
    scene_configuration_max_retries: value.scene_configuration_max_retries, automatic_budget_extension: value.automatic_budget_extension,
    ttl: value.expires_at_epoch - value.consent.accepted_at_epoch, spend_authorized: value.consent.spend_authorized });
  expect(money(grant)).toEqual(money(qualified));
});

it.each(["not_now", "needs_conversation"])("funds a %s job marked when it was created, after the change", async (disposition) => {
  const { sceneScreenGateEndedMarker } = await import("../utils/sceneScreenGate");
  sponsoredCapture();
  const record = store.rows.get("inboundRequests/req1");
  record.site_task_triage = { disposition };
  record.scene_screen_gate_ended = sceneScreenGateEndedMarker("req1", "2026-11-11T12:00:00Z", "job_created");
  await expect(loadWebsiteSceneSponsorship("req1", true)).resolves.toMatchObject({ request_id: "req1" });
});

it("still refuses a job uploaded after the change when no account owns its video", async () => {
  const { sceneScreenGateEndedMarker } = await import("../utils/sceneScreenGate");
  sponsoredCapture();
  const record = store.rows.get("inboundRequests/req1");
  record.site_task_triage = { disposition: "not_now" };
  record.scene_screen_gate_ended = sceneScreenGateEndedMarker("req1", new Date().toISOString());
  delete record.account_owner_uid;
  await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("website_scene_site_unclaimed");
  expect(store.rows.get("inboundRequests/req1").website_scene_sponsorship).toBeUndefined();
});

it("does not release a held job from a marker for another capture or a malformed one", async () => {
  const { sceneScreenGateEndedMarker } = await import("../utils/sceneScreenGate");
  sponsoredCapture();
  const record = store.rows.get("inboundRequests/req1");
  record.site_task_triage = { disposition: "not_now" };
  for (const marker of [{ ...sceneScreenGateEndedMarker("req1", new Date().toISOString()), capture_id: "walkthrough-other" },
    { ...sceneScreenGateEndedMarker("req1", "not a time") }, { schema_version: "scene_screen_gate_ended.v0" }]) {
    record.scene_screen_gate_ended = marker;
    await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("website_scene_site_not_qualified");
  }
});

it("funds a qualified job's scene whatever kind its brief screen reads", async () => {
  // The screen's task-kind reading is a hint; the Pipeline holds a job it cannot score with a typed code.
  sponsoredCapture();
  store.rows.get("inboundRequests/req1").site_task_scope = { supported: false, kind: null, reason: "mobile" };
  await expect(loadWebsiteSceneSponsorship("req1", true)).resolves.toMatchObject({ request_id: "req1" });
  expect(store.rows.get("inboundRequests/req1").website_scene_sponsorship).toMatchObject({ request_id: "req1" });
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

function preparedFamilyTask(taskContextDigest: string) {
  return { task_id: `website-${taskContextDigest.slice(7, 27)}`, strategy: "button_press",
    task_success_contract_digest: sha("b"), native_runtime_contract_digest: sha("c"),
    task_family_runtime_selection: { runtime_id: "qualified-button-runtime", runtime_catalog_digest: sha("d") },
    policy_selection: { candidate_id: "qualified-policy", catalog_digest: sha("e"), configuration_digest: sha("f") } };
}

it.each(["evaluation", "preparation", "family"])("queues the signed prepared website scene once, forwards without team payment and revokes withdrawn consent (%s)", async (mode) => {
  const preparationOnly = mode !== "evaluation";
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
    task: mode === "family" ? preparedFamilyTask(grant.task_context_digest)
      : { ...command().task, task_id: `website-${grant.task_context_digest.slice(7, 27)}`,
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
  if (mode === "family") {
    expect(stored()[1].request.task).not.toHaveProperty("subject");
    expect(store.rows.get("inboundRequests/req1").website_scene_sponsorship).toEqual(grant);
    expect(stored()[1].request_digest).toBe(sceneDigest(request));
    const headers = fetcher.mock.calls[0][1].headers;
    expect(headers["x-blueprint-pipeline-signature"]).toBe(`sha256=${createHmac("sha256", "test-key")
      .update(`${headers["x-blueprint-pipeline-timestamp"]}.blueprint-webapp.${headers["x-blueprint-pipeline-nonce"]}.${fetcher.mock.calls[0][1].body}`).digest("hex")}`);
  }
  store.rows.get("inboundRequests/req1").consent_revoked = true;
  stored()[1].next_forward_at_ms = 0;
  await processSceneIntakeQueue();
  expect(stored()[1].state).toBe("closeout_pending");
  expect(stored()[1].revocation_receipt.scope).toBe("future_execution");
  // A rights revoke: the Pipeline's later withdrawn outcome is the site's own (C-04).
  expect(stored()[1].revocation_cause).toBe("source_revoked");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

// A navigation job's scene kept as filmed (navigationSceneIntake): the record's digests, no subject,
// support or destination. Owner, 2026-11-07: it reserves $0 and grants no construction allowance.
function navigationTask(taskContextDigest: string) {
  return { task_id: `website-${taskContextDigest.slice(7, 27)}`, strategy: "goal_region_navigation",
    geometry_origin: "kept_as_filmed", navigation_task_spec_digest: sha("1"), compiled_task_spec_digest: sha("2"),
    task_success_contract_digest: sha("3"), runtime_contract_digest: sha("4"), scene_revision_digest: sha("5") };
}
function navigationReference(task: ReturnType<typeof navigationTask>) {
  return { schema_version: "website_navigation_preparation_result.v1", digest: task.scene_revision_digest,
    task_kind: task.strategy, navigation_task_spec_digest: task.navigation_task_spec_digest,
    compiled_task_spec_digest: task.compiled_task_spec_digest, task_success_contract_digest: task.task_success_contract_digest,
    runtime_contract_digest: task.runtime_contract_digest, native_application_claimed: false,
    policy_episode_claimed: false, paid_construction_performed: false };
}
function sponsoredRoute() {
  return app().then(url => {
    const base = url.replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1");
    return (operation: string, extra = {}) => realFetch(`${base}/${operation}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", ...extra }),
    });
  });
}
function navigationRequest(grant: Record<string, any>) {
  return {
    schema_version: "task_evaluation_scene_intake_request.v1", submission_id: grant.capture_id,
    owner: grant.owner, consent: grant.consent,
    source: { kind: "gaussian_splat", binding_id: `website-splat-${"a".repeat(32)}`, content_digest: sha("a") },
    task: navigationTask(grant.task_context_digest),
    execution: { ...command().execution, max_total_spend_usd: grant.max_total_spend_usd,
      max_paid_attempts: grant.max_paid_attempts, expires_at_epoch: grant.expires_at_epoch,
      allowed_providers: ["vast", "openai"], purpose: "scene_preparation", policy_candidates: [] },
  };
}
const intakeRows = () => [...store.rows.keys()].filter(key => key.startsWith("taskEvaluationSceneIntakes/"));

it("queues a navigation intake with the job's own consent and rights, reserving $0 and granting no construction allowance", async () => {
  // An unflagged grant (automatic budget extension off) refuses at the ceiling exactly as before.
  vi.stubEnv("BLUEPRINT_WEBSITE_AUTOMATIC_BUDGET_EXTENSION", "false");
  sponsoredCapture();
  const post = await sponsoredRoute();
  const grant = await (await post("scene-sponsorship")).json();
  expect(grant.consent.task_confirmed).toBe(true);
  const request = navigationRequest(grant);
  // The job's ledgers already hold its whole $100 owner-default ceiling.
  const record = store.rows.get("inboundRequests/req1");
  record.website_preparation_reservations = { ["b".repeat(64)]: { admission: { provider: "world_labs_atlas",
    resource_class: "provider_reconstruction_api", maximum_cost_usd: 100, request_count: 1 } } };
  const ledger = () => websiteJobSpend({ record: store.rows.get("inboundRequests/req1"),
    reader: transactionJobLedgerReader(dbAdmin as any, { get: (ref: any) => ref.get() }, "req1") });
  // A rigid intake still reserves its whole native allowance, so it is refused exactly as before.
  const rigid = { ...request, task: { ...command().task, task_id: request.task.task_id,
    subject: { description: "box", geometry_origin: "removed_before_reconstruction" } } };
  const refused = await post("prepared-scene", { request: rigid });
  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ code: "website_scene_preparation_budget_exhausted" });
  expect(intakeRows()).toHaveLength(0);
  // The navigation intake reserves $0, so a spent ceiling does not refuse it.
  const admitted = await post("prepared-scene", { request });
  expect(admitted.status).toBe(202);
  expect((await post("prepared-scene", { request })).status).toBe(202);
  expect(intakeRows()).toHaveLength(1);
  const [, row] = stored();
  expect(row.request).toEqual(request);
  expect(row.request.consent).toEqual(grant.consent);
  expect(row.command.consent).toEqual(Object.fromEntries(Object.entries(grant.consent)
    .filter(([key]) => key !== "accepted_by" && key !== "accepted_at_epoch")));
  // No construction allowance: the job's ledger counts nothing for it.
  expect((await ledger()).native_construction_micros).toBe(0);
  expect((await ledger()).total_micros).toBe(100_000_000);
  expect(store.rows.get("inboundRequests/req1").website_scene_sponsorship).toEqual(grant);
  // Forwarded, then completed by the Pipeline without paid configuration: still nothing counted.
  const fetcher = vi.fn(async (_url: any, init: any) => new Response(JSON.stringify(init?.body
    ? accepted(JSON.parse(init.body))
    : pipelineStatus(request, { status: "completed", phase: "navigation_scene_prepared", blockers: [], attempts: [],
      result_reference: navigationReference(request.task) }))));
  vi.stubGlobal("fetch", fetcher);
  await processSceneIntakeQueue();
  expect(stored()[1].state).toBe("accepted");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(request);
  expect((await ledger()).native_construction_micros).toBe(0);
  stored()[1].next_forward_at_ms = 0;
  await processSceneIntakeQueue();
  expect(stored()[1].state).toBe("completed");
  expect(stored()[1].pipeline_status.result_reference.digest).toBe(request.task.scene_revision_digest);
  expect((await ledger()).native_construction_micros).toBe(0);
});

// Owner decision 2026-11-11: on a flagged grant nothing passes the job's safety limit, a navigation intake included.
// It adds $0, so it is refused only once the job is already past the limit; everything else about it is unchanged.
it.each([["flagged", true], ["unflagged", false]])("a navigation intake on a %s grant and the job's safety limit", async (_label, flagged) => {
  if (!flagged) vi.stubEnv("BLUEPRINT_WEBSITE_AUTOMATIC_BUDGET_EXTENSION", "false");
  sponsoredCapture();
  const post = await sponsoredRoute();
  const grant = await (await post("scene-sponsorship")).json();
  expect(Boolean(grant.automatic_budget_extension)).toBe(flagged);
  const request = navigationRequest(grant);
  const held = (usd: number) => { store.rows.get("inboundRequests/req1").website_preparation_reservations = { ["b".repeat(64)]: {
    admission: { provider: "world_labs_atlas", resource_class: "provider_reconstruction_api", maximum_cost_usd: usd, request_count: 1 } } }; };
  // Already past the $100 default safety limit: refused on a flagged grant with the job's one alert, admitted as before otherwise.
  held(100.000001);
  const past = await post("prepared-scene", { request });
  expect(past.status).toBe(flagged ? 409 : 202);
  expect(store.rows.has("opsWebsiteJobOverBudgetAlerts/req1-safety-limit")).toBe(flagged);
  if (!flagged) return;
  expect(await past.json()).toEqual({ code: "website_scene_preparation_budget_exhausted" });
  expect(intakeRows()).toHaveLength(0);
  expect(store.rows.get("opsWebsiteJobOverBudgetAlerts/req1-safety-limit").safety_limit).toMatchObject({
    stage: "scene_intake", safety_limit_usd: 100, additional_cost_usd: 0 });
  // At the limit exactly it adds nothing, so it is admitted, with no note.
  held(100);
  const admitted = await post("prepared-scene", { request });
  expect(admitted.status).toBe(202);
  expect(stored()[1]).not.toHaveProperty("over_budget");
});

// Owner decision 2026-11-11: a hold that cannot be read never stops a navigation intake main admits; it is reported once.
it("admits a flagged navigation intake beside an unreadable hold, as main does, and reports the hold once", async () => {
  sponsoredCapture();
  const post = await sponsoredRoute();
  const grant = await (await post("scene-sponsorship")).json();
  expect(grant.automatic_budget_extension).toBe(true);
  store.rows.get("inboundRequests/req1").website_preparation_reservations = { broken: { admission: { provider: "world_labs_atlas" } } };
  expect((await post("prepared-scene", { request: navigationRequest(grant) })).status).toBe(202);
  expect(store.rows.has("opsWebsiteJobOverBudgetAlerts/req1-safety-limit")).toBe(false);
  expect(store.rows.get("opsWebsiteJobOverBudgetAlerts/req1-spend-unreadable")?.spend_unreadable)
    .toMatchObject({ stage: "scene_intake", records: ["preparation reservation broken"] });
});

it("refuses an unconfirmed brief's navigation intake by name and stores nothing", async () => {
  sponsoredCapture();
  store.rows.get("siteTaskBriefs/req1").confirmedAtIso = null;
  const brief = store.rows.get("siteTaskBriefs/req1"), record = store.rows.get("inboundRequests/req1");
  const expected = projectWebsiteTaskContext(brief, projectWebsiteCaptureRights(record), { purpose: "scene_preparation" });
  const post = await sponsoredRoute();
  // Scene preparation goes on from the video; the grant's consent reads the brief as unconfirmed.
  const grant = await (await post("scene-sponsorship", { purpose: "scene_preparation",
    expected_task_context_digest: expected.context_digest })).json();
  expect(grant.consent.task_confirmed).toBe(false);
  const request = navigationRequest(grant);
  const refused = await post("prepared-scene", { request });
  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ code: "website_task_context_not_confirmed" });
  // A caller cannot confirm it: the consent is the grant's own, so a rewritten one is refused too.
  const forged = await post("prepared-scene", { request: { ...request, consent: { ...request.consent, task_confirmed: true } } });
  expect(forged.status).toBe(409);
  expect(await forged.json()).toEqual({ code: "website_task_context_not_confirmed" });
  expect(intakeRows()).toHaveLength(0);
});

it.each(["subject", "destination", "origin", "digest", "policies", "evaluation", "scope", "consent", "spend"])(
  "refuses a navigation intake with a changed %s and stores nothing", async fault => {
    sponsoredCapture();
    const post = await sponsoredRoute();
    const grant = await (await post("scene-sponsorship")).json();
    const request: Record<string, any> = navigationRequest(grant);
    if (fault === "subject") request.task.subject = { description: "box", geometry_origin: "removed_before_reconstruction" };
    if (fault === "destination") request.task.destination = command().task.destination;
    if (fault === "origin") request.task.geometry_origin = "removed_before_reconstruction";
    if (fault === "digest") delete request.task.runtime_contract_digest;
    if (fault === "policies") request.execution.policy_candidates = command().execution.policy_candidates;
    if (fault === "evaluation") delete request.execution.purpose;
    if (fault === "scope") request.task.task_id = "website-another-task-context";
    if (fault === "consent") request.consent = { ...request.consent, rights_reference: sha("9") };
    if (fault === "spend") request.execution.max_total_spend_usd = 0.5;
    const response = await post("prepared-scene", { request });
    expect([400, 409]).toContain(response.status);
    expect(intakeRows()).toHaveLength(0);
  });

// The job's Atlas result was published again and its scene half derived anew (the library-aisle splat
// rebuild): the Pipeline re-issues the capture's navigation intake under its own submission.
function reissuedNavigation(request: Record<string, any>, atlasResult: string, sceneRevision: string,
  parent: string = request.submission_id) {
  const { submission_id: _submission, ...body } = structuredClone(request);
  body.source = { kind: "gaussian_splat", binding_id: `website-splat-${sceneRevision.slice(7, 39)}`, content_digest: sceneRevision };
  body.task = { ...body.task, scene_revision_digest: sceneRevision, [WEBSITE_NAVIGATION_REISSUE]: {
    capture_id: request.submission_id, parent_submission_id: parent, atlas_result_digest: atlasResult } };
  return { ...body, submission_id: `website-reissue-${crossRuntimeDigest(body).slice(7)}` };
}

it("takes a re-issued navigation intake as a new intake of the same capture, reserving $0 like the first", async () => {
  sponsoredCapture();
  const post = await sponsoredRoute();
  const grant = await (await post("scene-sponsorship")).json();
  const request = navigationRequest(grant);
  // Every ledger of the job is already spent: a navigation intake adds nothing to check.
  store.rows.get("inboundRequests/req1").website_preparation_reservations = { ["b".repeat(64)]: { admission: {
    provider: "world_labs_atlas", resource_class: "provider_reconstruction_api", maximum_cost_usd: 100, request_count: 1 } } };
  expect((await post("prepared-scene", { request })).status).toBe(202);
  // The re-derived scene half under the capture's own submission is a changed request, refused by name.
  const changed = { ...request, task: { ...request.task, scene_revision_digest: sha("7") } };
  const conflict = await post("prepared-scene", { request: changed });
  expect(conflict.status).toBe(409);
  expect(await conflict.json()).toEqual({ code: "idempotency_conflict" });
  // Re-issued, it is a new intake of the same capture: its own id, the capture as its source session,
  // the job's consent unchanged, and still nothing counted against the job's ledgers.
  const reissue = reissuedNavigation(request, sha("a"), sha("7"));
  const accepted = await post("prepared-scene", { request: reissue });
  expect(accepted.status).toBe(202);
  const receipt = await accepted.json();
  expect(receipt.id).toBe(`scene-${sceneDigest({ owner: reissue.owner, submission_id: reissue.submission_id }).slice(7)}`);
  expect((await post("prepared-scene", { request: reissue })).status).toBe(202);
  expect(intakeRows()).toHaveLength(2);
  const row = store.rows.get(`taskEvaluationSceneIntakes/${receipt.id}`);
  expect(row.source_session_id).toBe(grant.capture_id);
  expect(row.command.source_session_id).toBe(grant.capture_id);
  expect(row.request).toEqual(reissue);
  expect(row.request.consent).toEqual(grant.consent);
  expect(row.state).toBe("forward_pending");
  const ledger = await websiteJobSpend({ record: store.rows.get("inboundRequests/req1"),
    reader: transactionJobLedgerReader(dbAdmin as any, { get: (ref: any) => ref.get() }, "req1") });
  expect(ledger.native_construction_micros).toBe(0);
  // A re-issue of the re-issue chains to it; a forged one is refused and stores nothing.
  const again = reissuedNavigation(request, sha("b"), sha("8"), reissue.submission_id);
  expect((await post("prepared-scene", { request: again })).status).toBe(202);
  expect(intakeRows()).toHaveLength(3);
  for (const forged of [
    { ...reissue, task: { ...reissue.task, [WEBSITE_NAVIGATION_REISSUE]: {
      ...reissue.task[WEBSITE_NAVIGATION_REISSUE], capture_id: "walkthrough-other" } } },
    { ...reissue, submission_id: `website-reissue-${"0".repeat(64)}` },
    reissuedNavigation({ ...request, submission_id: "walkthrough-other" }, sha("c"), sha("9")),
  ]) expect((await post("prepared-scene", { request: forged })).status).toBe(409);
  expect(intakeRows()).toHaveLength(3);
});

it("still refuses an unconfirmed brief's re-issued navigation intake by name", async () => {
  sponsoredCapture();
  store.rows.get("siteTaskBriefs/req1").confirmedAtIso = null;
  const brief = store.rows.get("siteTaskBriefs/req1"), record = store.rows.get("inboundRequests/req1");
  const expected = projectWebsiteTaskContext(brief, projectWebsiteCaptureRights(record), { purpose: "scene_preparation" });
  const post = await sponsoredRoute();
  const grant = await (await post("scene-sponsorship", { purpose: "scene_preparation",
    expected_task_context_digest: expected.context_digest })).json();
  const refused = await post("prepared-scene", { request: reissuedNavigation(navigationRequest(grant), sha("a"), sha("7")) });
  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ code: "website_task_context_not_confirmed" });
  expect(intakeRows()).toHaveLength(0);
});

it("grants a new prepared scene its native allowance only while the job's one ceiling has room", async () => {
  // An unflagged grant (automatic budget extension off) refuses at the ceiling exactly as before.
  vi.stubEnv("BLUEPRINT_WEBSITE_AUTOMATIC_BUDGET_EXTENSION", "false");
  sponsoredCapture();
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1");
  const post = (operation: string, extra = {}) => realFetch(`${base}/${operation}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", ...extra }),
  });
  const grant = await (await post("scene-sponsorship")).json();
  const request = {
    schema_version: "task_evaluation_scene_intake_request.v1", submission_id: grant.capture_id,
    owner: grant.owner, consent: grant.consent,
    source: { kind: "gaussian_splat", binding_id: `website-splat-${"a".repeat(32)}`, content_digest: sha("a") },
    task: { ...command().task, task_id: `website-${grant.task_context_digest.slice(7, 27)}`,
      subject: { description: "box", geometry_origin: "removed_before_reconstruction" } },
    execution: { ...command().execution, max_total_spend_usd: grant.max_total_spend_usd,
      max_paid_attempts: grant.max_paid_attempts, expires_at_epoch: grant.expires_at_epoch,
      allowed_providers: ["vast", "openai"], purpose: "scene_preparation", policy_candidates: [] },
  };
  // No Atlas grant or policy names a ceiling here, so the owner default ($100) applies:
  // $80.50 already held plus this intake's $20 native allowance does not fit.
  const record = store.rows.get("inboundRequests/req1");
  record.website_preparation_reservations = { ["b".repeat(64)]: { admission: { provider: "world_labs_atlas",
    resource_class: "provider_reconstruction_api", maximum_cost_usd: 80.5, request_count: 1 } } };
  const refused = await post("prepared-scene", { request });
  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ code: "website_scene_preparation_budget_exhausted" });
  expect([...store.rows.keys()].filter(key => key.startsWith("taskEvaluationSceneIntakes/"))).toHaveLength(0);
  // An unflagged refusal at the ceiling is exactly as before: no safety-limit alert (owner decision 2026-11-11).
  expect(store.rows.has("opsWebsiteJobOverBudgetAlerts/req1-safety-limit")).toBe(false);
  // Settling the hold below its maximum makes room; nothing was reset or rewritten.
  record.website_preparation_reservations["b".repeat(64)].settlement = { actual_cost_usd: 80, status: "settled" };
  expect((await post("prepared-scene", { request })).status).toBe(202);
  // The existing intake is never re-admitted, so a replay is unaffected by later holds.
  record.website_preparation_reservations["c".repeat(64)] = { admission: { maximum_cost_usd: 5 } };
  expect((await post("prepared-scene", { request })).status).toBe(202);
  expect([...store.rows.keys()].filter(key => key.startsWith("taskEvaluationSceneIntakes/"))).toHaveLength(1);
});

it("keeps a prepared scene's native allowance held while every delivery's response is lost, past twenty tries and after the window ends", async () => {
  sponsoredCapture();
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1");
  const post = (operation: string, extra = {}) => realFetch(`${base}/${operation}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", ...extra }),
  });
  const grant = await (await post("scene-sponsorship")).json();
  const request = {
    schema_version: "task_evaluation_scene_intake_request.v1", submission_id: grant.capture_id,
    owner: grant.owner, consent: grant.consent,
    source: { kind: "gaussian_splat", binding_id: `website-splat-${"a".repeat(32)}`, content_digest: sha("a") },
    task: { ...command().task, task_id: `website-${grant.task_context_digest.slice(7, 27)}`,
      subject: { description: "box", geometry_origin: "removed_before_reconstruction" } },
    execution: { ...command().execution, max_total_spend_usd: grant.max_total_spend_usd,
      max_paid_attempts: grant.max_paid_attempts, expires_at_epoch: grant.expires_at_epoch,
      allowed_providers: ["vast", "openai"], purpose: "scene_preparation", policy_candidates: [] },
  };
  expect((await post("prepared-scene", { request })).status).toBe(202);
  const ceiling = (additionalCostUsd: number) => assertWithinWebsiteJobCeiling({
    record: store.rows.get("inboundRequests/req1"), captureId: grant.capture_id, additionalCostUsd,
    reader: transactionJobLedgerReader(dbAdmin as any, { get: (ref: any) => ref.get() }, "req1") });
  // The Pipeline receives (and may accept) every delivery, but its response never arrives.
  const fetcher = vi.fn(async () => { throw new TypeError("fetch failed"); });
  vi.stubGlobal("fetch", fetcher);
  for (let tick = 0; tick < 25; tick++) {
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
  }
  // No retry count runs out any more: a Pipeline outage does not end the job.
  expect(stored()[1]).toMatchObject({ state: "forward_blocked", blocker: "pipeline_transport_failed",
    forwarding_started: true, forward_attempt_count: 25, forward_failure_count: 25 });
  expect(fetcher).toHaveBeenCalledTimes(25);
  // The window is the give-up timer: past it nothing more is sent and the intake is terminal.
  const clock = vi.spyOn(Date, "now").mockReturnValue((grant.expires_at_epoch + 1) * 1000);
  try {
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
  } finally { clock.mockRestore(); }
  expect(stored()[1]).toMatchObject({ state: "blocked", blocker: "consent_expired", forwarding_started: true });
  expect(stored()[1]).not.toHaveProperty("receipt");
  expect(stored()[1]).not.toHaveProperty("pipeline_status");
  expect(fetcher).toHaveBeenCalledTimes(25);
  // A local "blocked" does not prove the Pipeline stopped: the whole $20 stays held
  // against the owner default $100 ceiling, so only $80 of new spend fits.
  expect((await ceiling(80)).spend.native_construction_micros).toBe(20_000_000);
  await expect(ceiling(80.000001)).rejects.toThrow("website_scene_preparation_budget_exhausted");
});

it.each(["scope", "success_digest", "native_digest", "runtime_digest", "context", "revoked", "expired"])("rejects changed family %s before forwarding without granting spend", async corruption => {
  sponsoredCapture();
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1");
  const post = (operation: string, extra = {}) => realFetch(`${base}/${operation}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", ...extra }),
  });
  const grant = await (await post("scene-sponsorship")).json();
  const request = {
    schema_version: "task_evaluation_scene_intake_request.v1", submission_id: grant.capture_id,
    owner: grant.owner, consent: grant.consent,
    source: { kind: "gaussian_splat", binding_id: `website-splat-${"a".repeat(32)}`, content_digest: sha("a") },
    task: preparedFamilyTask(grant.task_context_digest),
    execution: { ...command().execution, purpose: "scene_preparation", policy_candidates: [],
      max_total_spend_usd: grant.max_total_spend_usd, max_paid_attempts: grant.max_paid_attempts,
      expires_at_epoch: grant.expires_at_epoch, allowed_providers: ["vast", "openai"] },
  };
  if (corruption === "scope") {
    request.task.task_id = "website-another-task-context";
    expect((await post("prepared-scene", { request })).status).toBe(409);
    expect(stored()).toBeUndefined();
    return;
  }
  expect((await post("prepared-scene", { request })).status).toBe(202);
  if (corruption === "success_digest") stored()[1].request.task.task_success_contract_digest = sha("f");
  if (corruption === "native_digest") stored()[1].request.task.native_runtime_contract_digest = sha("f");
  if (corruption === "runtime_digest") stored()[1].request.task.task_family_runtime_selection.runtime_catalog_digest = sha("f");
  if (corruption === "context") store.rows.get("siteTaskBriefs/req1").summary = "A different captured job";
  if (corruption === "revoked") store.rows.get("inboundRequests/req1").consent_revoked = true;
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const clock = corruption === "expired" ? vi.spyOn(Date, "now").mockReturnValue((grant.expires_at_epoch + 1) * 1000) : null;
  try { await processSceneIntakeQueue(); }
  finally { clock?.mockRestore(); }
  expect(fetcher).not.toHaveBeenCalled();
  expect(stored()[1].state).not.toBe("accepted");
  expect(store.rows.get("inboundRequests/req1").website_scene_sponsorship).toEqual(grant);
});
describe("persistent authenticated scene intake", () => {
  it("refuses a sign-in without a verified invited email before any record is queued for the Pipeline", async () => {
    vi.stubEnv("BLUEPRINT_INVITEE_ALLOWLIST", "invited@site.example");
    try {
      const url = await app();
      const before = store.rows.size;
      const response = await realFetch(url, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(command()) });
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: "invitee_email_unverified" });
      expect(store.rows.size).toBe(before);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("retains the actual Python handoff-to-progression family's public status without changing numeric or source identities", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(producerFamilyStatus.status))));
    const value = await scenePipelineRequest(producerFamilyStatus.request, producerFamilyStatus.receipt.intent_id);
    expect(value).toEqual(producerFamilyStatus.status);
    expect(sceneIntakeCommand.shape.task.parse(producerFamilyStatus.request.task)).toEqual(producerFamilyStatus.request.task);
    expect(value.result_reference.digest).toBe(producerFamilyStatus.source.scene_revision_digest);
  });
  it.each(["valid", "phase", "legacy_task", "native", "catalog", "claim"])("preserves a digest-bound typed family CPU preparation status (%s)", async fault => {
    const { intake } = familyScreeningFixture();
    const request: Record<string, any> = structuredClone(intake.request);
    const reference = structuredClone(intake.pipeline_status.result_reference);
    if (fault === "legacy_task") request.task = command().task;
    if (fault === "native") reference.native_runtime_contract_digest = sha("f");
    if (fault === "catalog") reference.task_family_runtime_selection.runtime_catalog_digest = sha("f");
    if (fault === "claim") reference.native_application_claimed = true;
    const status = pipelineStatus(request, { status: "completed", phase: fault === "phase" ? "scene_prepared" : "family_native_prepared",
      result_reference: reference });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(status))));
    const observed = scenePipelineRequest(request, "scene-one");
    if (fault === "valid") expect(await observed).toEqual(status);
    else await expect(observed).rejects.toThrow(/pipeline_(family_preparation_binding|status_receipt)_invalid/);
  });
  it.each(["valid", "phase", "family_phase", "revision", "runtime", "claim", "task", "running"])(
    "preserves a navigation intent's completion without paid configuration only for its own request (%s)", async fault => {
      const { intake } = navigationScreeningFixture();
      const request: Record<string, any> = structuredClone(intake.request);
      const reference = structuredClone(intake.pipeline_status.result_reference);
      if (fault === "revision") reference.digest = sha("f");
      if (fault === "runtime") request.task.runtime_contract_digest = sha("f");
      if (fault === "claim") reference.paid_construction_performed = true;
      if (fault === "task") request.task = command().task;
      const phase = fault === "phase" ? "scene_prepared" : fault === "family_phase" ? "family_native_prepared"
        : "navigation_scene_prepared";
      const status = pipelineStatus(request, { status: fault === "running" ? "running" : "completed", phase,
        blockers: [], attempts: [], result_reference: reference });
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(status))));
      const observed = scenePipelineRequest(request, "scene-one");
      if (fault === "valid") expect(await observed).toEqual(status);
      else await expect(observed).rejects.toThrow(/pipeline_(navigation_preparation_binding|family_preparation_binding|status_receipt)_invalid/);
    });
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
  it("an owner-approved time-only extension of the same intent moves only the forward expiry", async () => {
    const url = await app();
    await realFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command()),
    });
    const record = stored()[1];
    const raw = record.request.execution.expires_at_epoch;
    const caps = structuredClone(record.request.execution);
    record.receipt = { intent_id: "scene-one", intent_digest: sha("a") };
    const extension = {
      schema_version: "task_evaluation_scene_execution_window_extension_notice.v1",
      intent_id: "scene-one", intent_digest: sha("a"), extension_digest: sha("7"),
      original_expires_at_epoch: raw, expires_at_epoch: raw + 86400, issued_at_epoch: raw + 60,
      authorization_reference: "founder approval (time only)", authorized_via: "operator_door",
      received_at_iso: "2026-10-31T12:00:00Z",
    };
    record.execution_window_extensions = [{ ...extension, intent_digest: sha("b") }];
    const fetcher = vi.fn(async () => new Response("{}", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    const clock = vi.spyOn(Date, "now").mockReturnValue((raw + 3600) * 1000);
    try {
      // An extension that does not bind this intent changes nothing.
      await processSceneIntakeQueue();
      expect(stored()[1].blocker).toBe("consent_expired");
      expect(fetcher).not.toHaveBeenCalled();
      Object.assign(stored()[1], { state: "forward_pending", next_forward_at_ms: 0,
        execution_window_extensions: [extension] });
      await processSceneIntakeQueue();
      expect(stored()[1].blocker).not.toBe("consent_expired");
      expect(fetcher).toHaveBeenCalled();
      expect(stored()[1].request.execution).toEqual(caps);
      // Past the extended end it is expired again.
      clock.mockReturnValue((raw + 86400) * 1000);
      Object.assign(stored()[1], { state: "forward_pending", next_forward_at_ms: 0 });
      await processSceneIntakeQueue();
      expect(stored()[1].blocker).toBe("consent_expired");
    } finally {
      clock.mockRestore();
    }
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
  it("requires whole-object coverage evidence for a hinged door, and admits a door seen open", () => {
    const withTask = (task: unknown) => sceneIntakeCommand.safeParse({ ...command(), task }).success;
    const coverage = { schema_version: "website_assembly_coverage.v1", status: "complete",
      digest: `sha256:${"c".repeat(64)}`, reference_frame_count: 12 };
    const door = { ...articulatedTask().articulation, assembly_label: "dishwasher", part_label: "dishwasher door",
      joint_type: "revolute", estimated_usable_stroke_m: undefined, estimated_usable_swing_rad: 1.4,
      part_observed_open_in_footage: true };
    // Surfaces from the depth-sampling frames alone are not the whole appliance.
    expect(withTask({ ...articulatedTask(), articulation: door })).toBe(false);
    expect(withTask({ ...articulatedTask(), articulation: { ...door, whole_object_coverage: { ...coverage, status: "incomplete" } } })).toBe(false);
    expect(withTask({ ...articulatedTask(), articulation: { ...door, whole_object_coverage: { ...coverage, reference_frame_count: 17 } } })).toBe(true);
    expect(withTask({ ...articulatedTask(), articulation: { ...door, whole_object_coverage: { ...coverage, reference_frame_count: 0 } } })).toBe(false);
    expect(withTask({ ...articulatedTask(), articulation: { ...door, whole_object_coverage: coverage } })).toBe(true);
    // Drawers from Pipeline deploys that predate coverage still pass until every deploy produces it.
    expect(withTask(articulatedTask())).toBe(true);
    expect(withTask({ ...articulatedTask(), articulation: { ...articulatedTask().articulation, whole_object_coverage: coverage } })).toBe(true);
  });
  it.each(["gravity_loaded", "unknown"])("retains an explicit %s mechanism estimate", mode => {
    const gravity_response = { mode, reason: "Estimate from the retained task review." };
    const task = articulatedTask();
    const parsed = sceneIntakeCommand.parse({ ...command(), task: {
      ...task, articulation: { ...task.articulation, gravity_response },
    } });
    expect(parsed.task).toMatchObject({ articulation: { gravity_response } });
  });
  it("admits an explicit counterbalance estimate for a covered revolute task", () => {
    const task = articulatedTask();
    const gravity_response = { mode: "counterbalanced", reason: "Explicit mechanism estimate; not a physical measurement." };
    const parsed = sceneIntakeCommand.parse({ ...command(), task: { ...task, articulation: {
      ...task.articulation, joint_type: "revolute", estimated_usable_stroke_m: undefined,
      estimated_usable_swing_rad: 1.4, gravity_response,
      whole_object_coverage: { schema_version: "website_assembly_coverage.v1", status: "complete",
        digest: `sha256:${"c".repeat(64)}`, reference_frame_count: 20 },
    } } });
    expect(parsed.task).toMatchObject({ articulation: { gravity_response, physical_measurement_proven: false } });
  });
  it("refuses malformed estimates and an unsupported counterbalance mode for a slide", () => {
    const task = articulatedTask();
    for (const gravity_response of [true, null, { mode: "weightless", reason: "unsupported" },
      { mode: "unknown", reason: " " }, { mode: "counterbalanced", reason: "Unsupported on this prismatic joint." }]) {
      expect(sceneIntakeCommand.safeParse({ ...command(), task: {
        ...task, articulation: { ...task.articulation, gravity_response },
      } }).success).toBe(false);
    }
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
  it("accepts a destination on a distinct support surface and refuses a malformed one", () => {
    const withDestination = (destination: unknown) =>
      sceneIntakeCommand.safeParse({
        ...command(),
        task: { ...command().task, destination },
      }).success;
    const onDesk = {
      relation: "on",
      mode: "existing_support_surface",
      visible_label: "desk",
      position_world_m: [0.4, 0, 0.74],
      orientation_xyzw: [0, 0, 0, 1],
      support: { description: "desk top", aabb_min_xyz: [0, -0.4, 0.72], aabb_max_xyz: [1.2, 0.4, 0.74] },
    };
    expect(withDestination(onDesk)).toBe(true);
    expect(withDestination({ ...onDesk, support: { ...onDesk.support, aabb_min_xyz: [0, -0.4, 0.74] } })).toBe(true);
    expect(withDestination({ ...onDesk, support: { ...onDesk.support, aabb_max_xyz: [1.2, 0.4, 0.7] } })).toBe(false);
    expect(withDestination({ ...onDesk, support: { ...onDesk.support, face_indices: [1, 2] } })).toBe(false);
    expect(withDestination({ ...onDesk, support: { description: " " , aabb_min_xyz: [0, 0, 0], aabb_max_xyz: [1, 1, 1] } })).toBe(false);
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


it("requires source-bound Atlas consent and preserves separate budgets across retries", async () => {
  sponsoredCapture();
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const spend = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
    resource_class: "provider_reconstruction_api" as const, provider: "world_labs_atlas" as const,
    source_video_digest: sha("a"), maximum_cost_usd: 3, request_count: 1 };
  await expect(reserveWebsitePreparationSpend("req1", spend)).rejects.toThrow("website_atlas_source_consent_required");
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify({
    ...JSON.parse(process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON!),
    world_labs_atlas: { digest: sha("b"), label: "Atlas beta terms", url: "https://atlas-beta.worldlabs.ai/docs" },
  });
  process.env.BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON = JSON.stringify([{
    schema_version: "website_atlas_authorization.v1", request_id: "req1", capture_id: "walkthrough-req1",
    task_context_digest: grant.task_context_digest, source_video_digest: sha("a"), provider_terms_reference: sha("b"),
    accepted_by: "blueprint-preparation", approval_reference: "owner test", private_processing_authorized: true,
    provider_training_authorized: false, provider_retention: "project_library_retention_approved",
    maximum_cost_usd: 5, maximum_requests: 2, expires_at_epoch: Date.now() / 1000 + 3600, claim_scope: "development_only",
  }]);
  try {
    const original = store.rows.get("inboundRequests/req1").website_scene_sponsorship;
    const expired = { ...original, expires_at_epoch: Date.now() / 1000 - 60 };
    const { authority_digest: _digest, ...rawExpired } = expired;
    expired.authority_digest = sceneDigest(rawExpired);
    store.rows.get("inboundRequests/req1").website_scene_sponsorship = expired;
    const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1/preparation-spend");
    const response = await realFetch(base, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", spend }) });
    expect(response.status).toBe(200);
    const receipt = await response.json();
    expect(receipt).toMatchObject({ status: "admitted", provider: "world_labs_atlas", source_video_digest: sha("a") });
    // The successful Atlas-only route did not extend the old grant.
    expect(store.rows.get("inboundRequests/req1").website_scene_sponsorship).toEqual(expired);
    expect(await reserveWebsitePreparationSpend("req1", spend)).toMatchObject({ status: "already_reserved" });
    const authorizations = JSON.parse(process.env.BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON!);
    authorizations[0].planner = { provider: "openai", provider_terms_reference: sha("e"), private_processing_authorized: true,
      provider_training_authorized: false, approval_reference: "owner requests automatic production planning" };
    process.env.BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON = JSON.stringify(authorizations);
    process.env.BLUEPRINT_WEBSITE_ATLAS_RUNTIME_POLICY_JSON = JSON.stringify({ schema_version: "website_atlas_runtime_policy.v1",
      model: "gpt-6.1-sol", maximum_review_cost_usd: .5, pose_input_cost_usd: .01, rgbd_view_cost_usd: .05,
      rate_card_reference: "https://atlas-beta.worldlabs.ai/docs/billing", reviewed_by: "operator", reviewed_on: "2026-10-21" });
    const configuration = await loadWebsiteAtlasConfiguration("req1", "walkthrough-req1", {
      task_context_digest: grant.task_context_digest, source_video_digest: sha("a") });
    expect(configuration).toMatchObject({ remaining_cost_usd: 2, dispatch_authorized: false });
    expect(configuration).not.toHaveProperty("remaining_requests");
    await reserveWebsitePreparationSpend("req1", { ...spend, allocation_binding_digest: sha("7"),
      provider: "openai", resource_class: "openai_api_candidate", maximum_cost_usd: .5 });
    expect((await loadWebsiteAtlasConfiguration("req1", "walkthrough-req1", {
      task_context_digest: grant.task_context_digest, source_video_digest: sha("a") })).remaining_cost_usd).toBe(1.5);
    // Money is the hard stop: a third request past maximum_requests is admitted while dollars remain.
    expect(await reserveWebsitePreparationSpend("req1", { ...spend, allocation_binding_digest: sha("8"),
      maximum_cost_usd: .01 })).toMatchObject({ status: "admitted" });
    await expect(reserveWebsitePreparationSpend("req1", { ...spend, allocation_binding_digest: sha("2") }))
      .rejects.toThrow("budget_exhausted");
    store.rows.get("inboundRequests/req1").website_scene_sponsorship = original;
    await reserveWebsitePreparationSpend("req1", { ...spend, allocation_binding_digest: sha("3"),
      provider: "meta", resource_class: "evaluator_api", maximum_cost_usd: 5 });
    await expect(reserveWebsitePreparationSpend("req1", { ...spend, allocation_binding_digest: sha("4"),
      source_video_digest: sha("c"), maximum_cost_usd: 1 })).rejects.toThrow("source_consent_required");
  } finally { delete process.env.BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON;
    delete process.env.BLUEPRINT_WEBSITE_ATLAS_RUNTIME_POLICY_JSON; }
});

// Owner-approved 2026-11-03: a verified, time-only window of the native grant's bound
// scene intent keeps native/Marble reservations open; Atlas grants keep their own clock.
it("an intent window extends a native reservation but never an Atlas one or Atlas auxiliary work", async () => {
  sponsoredCapture();
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify({
    ...JSON.parse(process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON!),
    world_labs_atlas: { digest: sha("b"), label: "Atlas beta terms", url: "https://atlas-beta.worldlabs.ai/docs" },
  });
  const atlasExpiry = Date.now() / 1000 + 3600;
  process.env.BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON = JSON.stringify([{
    schema_version: "website_atlas_authorization.v1", request_id: "req1", capture_id: "walkthrough-req1",
    task_context_digest: grant.task_context_digest, source_video_digest: sha("a"), provider_terms_reference: sha("b"),
    accepted_by: "blueprint-preparation", approval_reference: "owner test", private_processing_authorized: true,
    provider_training_authorized: false, provider_retention: "project_library_retention_approved",
    maximum_cost_usd: 5, maximum_requests: 2, expires_at_epoch: atlasExpiry, claim_scope: "development_only",
  }]);
  try {
    // The native grant expired an hour ago; its bound intent holds a verified window for six more days.
    const record = store.rows.get("inboundRequests/req1");
    const { authority_digest: _digest, ...raw } = { ...record.website_scene_sponsorship,
      expires_at_epoch: Date.now() / 1000 - 3600 };
    const expired = { ...raw, authority_digest: sceneDigest(raw) };
    record.website_scene_sponsorship = expired;
    const until = expired.expires_at_epoch + 6 * 86400;
    store.rows.set("taskEvaluationSceneIntakes/intake-one", { website_request_id: "req1", state: "completed",
      root_sponsorship_digest: expired.authority_digest, sponsorship_digest: expired.authority_digest,
      request: { execution: { expires_at_epoch: expired.expires_at_epoch } },
      receipt: { intent_id: "scene-one", intent_digest: sha("8") },
      execution_window_extensions: [{ schema_version: "task_evaluation_scene_execution_window_extension_notice.v1",
        intent_id: "scene-one", intent_digest: sha("8"), extension_digest: sha("7"),
        original_expires_at_epoch: expired.expires_at_epoch, expires_at_epoch: until,
        issued_at_epoch: expired.expires_at_epoch + 60, authorization_reference: "owner approval (time only)",
        authorized_via: "operator_door", received_at_iso: new Date().toISOString() }] });
    record.website_scene_sponsorship_execution_window = { schema_version: "website_scene_sponsorship_execution_window.v1",
      scope: "execution_time_only", authority_digest: expired.authority_digest, intent_id: "scene-one",
      intake_id: "intake-one", extension_digest: sha("7"), original_expires_at_epoch: expired.expires_at_epoch,
      expires_at_epoch: until };
    const atlas = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
      resource_class: "provider_reconstruction_api" as const, provider: "world_labs_atlas" as const,
      source_video_digest: sha("a"), maximum_cost_usd: 1, request_count: 1 };
    expect(await reserveWebsitePreparationSpend("req1", atlas))
      .toMatchObject({ status: "admitted", expires_at_epoch: atlasExpiry });
    await expect(reserveWebsitePreparationSpend("req1", { ...atlas, allocation_binding_digest: sha("2"),
      provider: "meta", resource_class: "evaluator_api", atlas_auxiliary: true })).rejects.toThrow("consent_expired");
    expect(await reserveWebsitePreparationSpend("req1", { task_context_digest: grant.task_context_digest,
      allocation_binding_digest: sha("3"), resource_class: "gpu_render", provider: "vast",
      maximum_cost_usd: 1, request_count: 1 }))
      .toMatchObject({ status: "admitted", sponsorship_digest: expired.authority_digest, expires_at_epoch: until });
    expect(store.rows.get("inboundRequests/req1").website_scene_sponsorship).toEqual(expired);
  } finally { delete process.env.BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON; }
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
  const nextExtension = { ...extension, max_requests: 64, approval_reference: "owner-reply:test-64" };
  const before = structuredClone(store.rows.get("inboundRequests/req1"));
  expect(await amendWebsitePreparationRequestLimit("req1", nextExtension)).toMatchObject({ max_requests: 64 });
  expect(store.rows.get("inboundRequests/req1")).toEqual(before);
  const newest = await amendWebsitePreparationRequestLimit("req1", nextExtension, true);
  expect(await amendWebsitePreparationRequestLimit("req1", nextExtension, true)).toEqual(newest);
  const after = store.rows.get("inboundRequests/req1");
  expect(after.website_preparation_amendment_history).toEqual([receipt, extended]);
  expect(after.website_preparation_limit_amendment.max_requests).toBe(48);
  expect(after.website_preparation_limit_extension.prior_amendment_digest)
    .toBe(after.website_preparation_limit_amendment.amendment_digest);
  expect(after.website_preparation_reservations).toEqual(before.website_preparation_reservations);
  expect(after.website_scene_sponsorship).toEqual(before.website_scene_sponsorship);
  await expect(amendWebsitePreparationRequestLimit("req1", extension, true)).rejects.toThrow("amendment_conflict");
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

it("raises only the upstream preparation dollar cap by the owner, retaining prior approvals and usage", async () => {
  sponsoredCapture();
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const spend = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
    resource_class: "evaluator_api" as const, provider: "meta" as const, maximum_cost_usd: 4, request_count: 1 };
  const first = await reserveWebsitePreparationSpend("req1", spend);
  const next = { ...spend, allocation_binding_digest: sha("2"), maximum_cost_usd: 2.48 };
  await expect(reserveWebsitePreparationSpend("req1", next)).rejects.toThrow("budget_exhausted");
  const input = { authority_digest: grant.authority_digest, upstream_max_spend_usd: 10,
    approved_by: grant.owner.user_id, approval_reference: "owner-reply:raise-upstream-10" };
  await expect(amendWebsitePreparationSpendLimit("req1", { ...input, approved_by: "stranger" }, true))
    .rejects.toThrow("binding_invalid");
  await expect(amendWebsitePreparationSpendLimit("req1", { ...input, upstream_max_spend_usd: 16 }, true))
    .rejects.toThrow("out_of_bounds");
  await expect(amendWebsitePreparationSpendLimit("req1", { ...input, upstream_max_spend_usd: 5 }, true))
    .rejects.toThrow("out_of_bounds");
  await amendWebsitePreparationSpendLimit("req1", input);
  expect(store.rows.get("inboundRequests/req1").website_preparation_spend_amendment).toBeUndefined();
  const receipt = await amendWebsitePreparationSpendLimit("req1", input, true);
  expect(await amendWebsitePreparationSpendLimit("req1", input, true)).toEqual(receipt);
  await expect(amendWebsitePreparationSpendLimit("req1", { ...input, upstream_max_spend_usd: 9 }, true))
    .rejects.toThrow("amendment_conflict");
  const increase = { ...input, upstream_max_spend_usd: 12, approval_reference: "owner-reply:raise-upstream-12" };
  const before = structuredClone(store.rows.get("inboundRequests/req1"));
  await amendWebsitePreparationSpendLimit("req1", increase);
  expect(store.rows.get("inboundRequests/req1")).toEqual(before);
  const increased = await amendWebsitePreparationSpendLimit("req1", increase, true);
  expect(await amendWebsitePreparationSpendLimit("req1", increase, true)).toEqual(increased);
  const after = store.rows.get("inboundRequests/req1");
  expect(after.website_preparation_amendment_history).toEqual([receipt]);
  expect(after.website_preparation_reservations).toEqual(before.website_preparation_reservations);
  await expect(amendWebsitePreparationSpendLimit("req1", { ...increase, upstream_max_spend_usd: 16 }, true))
    .rejects.toThrow("out_of_bounds");
  // The grant itself, its native cap and existing reservations are unchanged.
  expect(await loadWebsiteSceneSponsorship("req1")).toEqual(grant);
  expect(await reserveWebsitePreparationSpend("req1", spend)).toEqual({ ...first, status: "already_reserved" });
  expect(await reserveWebsitePreparationSpend("req1", next)).toMatchObject({ status: "admitted" });
  await expect(reserveWebsitePreparationSpend("req1", { ...next, allocation_binding_digest: sha("3"),
    maximum_cost_usd: 6 })).rejects.toThrow("budget_exhausted");
  // A tampered amendment fails closed rather than widening the cap.
  store.rows.get("inboundRequests/req1").website_preparation_spend_amendment.upstream_max_spend_usd = 15;
  await expect(amendWebsitePreparationSpendLimit("req1", { ...increase, upstream_max_spend_usd: 15 }, true))
    .rejects.toThrow("spend_amendment_invalid");
  await expect(reserveWebsitePreparationSpend("req1", { ...next, allocation_binding_digest: sha("4"),
    maximum_cost_usd: 0.1 })).rejects.toThrow("spend_amendment_invalid");
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

it("settles torn-down Vast probe holds at their labelled ledger estimates so the upstream cap counts what ran", async () => {
  // capture-447ae4f4: four $1 probe holds and $0.32 already used left $4.32 held of $5,
  // so the next $1 hold was refused while the four runs' ledgers estimated $0.62.
  sponsoredCapture();
  const policy = JSON.parse(process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON!);
  process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON = JSON.stringify({ ...policy, max_paid_attempts: 16 });
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const probe = (key: string) => ({ task_context_digest: grant.task_context_digest, allocation_binding_digest: sha(key),
    resource_class: "gpu_render" as const, provider: "vast" as const, maximum_cost_usd: 1, request_count: 1 });
  await reserveWebsitePreparationSpend("req1", { task_context_digest: grant.task_context_digest,
    allocation_binding_digest: sha("0"), resource_class: "evaluator_api", provider: "meta",
    maximum_cost_usd: .32, request_count: 1 });
  const estimates: Record<string, number> = { 1: .133313, 2: .16524, 3: .234989, 4: .087939 };
  for (const key of Object.keys(estimates)) await reserveWebsitePreparationSpend("req1", probe(key));
  await expect(reserveWebsitePreparationSpend("req1", probe("5"))).rejects.toThrow("budget_exhausted");
  const settlement = (key: string) => ({ task_context_digest: grant.task_context_digest,
    allocation_binding_digest: sha(key), provider: "vast" as const, instance_id: `5903504${key}`,
    provider_charge_basis: "adapter_budget_ledger_estimate" as const, provider_charge_amount_usd: estimates[key],
    budget_ledger_digest: sha("b"), execution_result_digest: sha("c"), teardown_receipt_digest: sha("d"),
    provider_zero_digest: sha("f"), continuing_spend_from_this_run: false as const,
    all_staged_objects_absent: true as const });
  const original = structuredClone(store.rows.get("inboundRequests/req1").website_preparation_reservations);
  // Never for a run that may still spend or left objects staged, never as a posted charge, never above the quote.
  for (const changed of [{ continuing_spend_from_this_run: true }, { all_staged_objects_absent: false },
    { provider_charge_basis: "provider_billed" }, { provider_charge_source: "instance-59035041" },
    { provider_charge_amount_usd: 1.000001 }, { provider_charge_amount_usd: -0.01 }, { instance_id: "0" },
    { budget_ledger_digest: "missing" }, { task_context_digest: sha("e") }, { allocation_binding_digest: sha("9") }]) {
    await expect(settleWebsitePreparationSpend("req1", { ...settlement("1"), ...changed } as any)).rejects.toThrow();
    expect(store.rows.get("inboundRequests/req1").website_preparation_reservations).toEqual(original);
  }
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1/preparation-settlement");
  const response = await realFetch(base, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", settlement: settlement("1") }) });
  expect(response.status).toBe(200);
  const first = await response.json();
  expect(first).toEqual({ ...settlement("1"), actual_cost_usd: .133313, status: "settled" });
  expect(await settleWebsitePreparationSpend("req1", settlement("1"))).toEqual(first);
  await expect(settleWebsitePreparationSpend("req1", { ...settlement("1"), provider_charge_amount_usd: .2 }))
    .rejects.toThrow("idempotency_conflict");
  for (const key of ["2", "3", "4"]) await settleWebsitePreparationSpend("req1", settlement(key));
  const retained = store.rows.get("inboundRequests/req1").website_preparation_reservations;
  for (const key of Object.keys(original)) {
    // Append-only: each admission (and its request count) is kept as reserved.
    expect(retained[key].admission).toEqual(original[key].admission);
    expect(retained[key].command_digest).toEqual(original[key].command_digest);
  }
  // $0.32 + $0.621481 settled, so the next $1 probe hold fits under the $5 upstream cap.
  expect(await reserveWebsitePreparationSpend("req1", probe("5"))).toMatchObject({ status: "admitted" });
});


it("settles a proved unallocated Vast refusal without replenishing requests or losing its admission", async () => {
  sponsoredCapture();
  const terms = JSON.parse(process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON!);
  process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON = JSON.stringify({ ...terms, vast: terms.openai });
  const grant = await loadWebsiteSceneSponsorship("req1", true);
  const input = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
    resource_class: "gpu_render" as const, provider: "vast" as const, maximum_cost_usd: .5, request_count: 1 };
  await reserveWebsitePreparationSpend("req1", input);
  const original = structuredClone(store.rows.get("inboundRequests/req1").website_preparation_reservations);
  const settlement = { task_context_digest: grant.task_context_digest, allocation_binding_digest: sha("1"),
    provider: "vast" as const, allocation_status: "not_created" as const, provider_create_attempted: false as const,
    provider_mutations_performed: 0 as const, provider_instance_ids: [] as never[], provider_charge_amount_usd: 0 as const,
    all_staged_objects_absent: true as const, continuing_spend_from_this_run: false as const,
    execution_result_digest: sha("2"), adapter_result_digest: sha("3"), teardown_receipt_digest: sha("4"),
    staged_object_absence_digest: sha("5"), watchdog_receipt_digest: sha("6") };
  for (const changed of [{ provider_create_attempted: true }, { provider_mutations_performed: 1 },
    { provider_instance_ids: [123] }, { provider_charge_amount_usd: .01 }, { all_staged_objects_absent: false },
    { continuing_spend_from_this_run: true }, { watchdog_receipt_digest: "missing" },
    { instance_id: "123" }, { task_context_digest: sha("b") }, { allocation_binding_digest: sha("b") }]) {
    await expect(settleWebsitePreparationSpend("req1", { ...settlement, ...changed } as any)).rejects.toThrow();
    expect(store.rows.get("inboundRequests/req1").website_preparation_reservations).toEqual(original);
  }
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1/preparation-settlement");
  const response = await realFetch(base, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", settlement }) });
  expect(response.status).toBe(200);
  const receipt = await response.json();
  expect(receipt).toMatchObject({ status: "settled", actual_cost_usd: 0, allocation_status: "not_created" });
  expect(await settleWebsitePreparationSpend("req1", settlement)).toEqual(receipt);
  const retained = store.rows.get("inboundRequests/req1").website_preparation_reservations;
  expect(Object.keys(retained)).toEqual(Object.keys(original));
  expect(retained["1".repeat(64)].admission).toEqual(original["1".repeat(64)].admission);
  expect(retained["1".repeat(64)].admission.request_count).toBe(1);
  await expect(settleWebsitePreparationSpend("req1", { ...settlement, adapter_result_digest: sha("b") }))
    .rejects.toThrow("idempotency_conflict");
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
  const rootDigest = stored()[1].root_sponsorship_digest;
  expect(rootDigest).toBe(grant.authority_digest);
  stored()[1].root_sponsorship_digest = sha("f");
  await processSceneIntakeQueue();
  expect(stored()[1].blocker).toBe("website_scene_sponsorship_binding_invalid");
  expect(stored()[1].forward_attempt_count).toBe(0);
  expect(fetcher).not.toHaveBeenCalled();
  // Offline repair of the deliberately corrupted ledger restores the same
  // original grant; no provider or second allowance is created.
  stored()[1].root_sponsorship_digest = rootDigest;
  stored()[1].state = "forward_pending";
  stored()[1].next_forward_at_ms = 0;
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
    authoring_agent_runtime: "openai_agents_api", authoring_model: "gpt-6.1-sol",
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

it("reads a settled attempt's retained hold, sealed inside status_digest, and still reads statuses without it", async () => {
  const request = { owner: { user_id: "owner", organization_id: "user:owner" } };
  const row = { attempt_id: "scene-configuration-one", source_commit: "d".repeat(40), runtime_digest: sha("e"),
    input_digest: sha("f"), provider: "vast", maximum_spend_usd: 31, status: "cancelled_before_execution" };
  const settled = { ...row, retained_spend_usd: 21.630673, retained_spend_basis: "artisan_proven_authoring_without_allocation" };
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  for (const attempts of [[row], [settled], [{ ...settled, retained_spend_usd: 0, retained_spend_basis: "launch_never_queued" }]]) {
    const status = pipelineStatus(request, { attempts });
    fetcher.mockImplementationOnce(async () => new Response(JSON.stringify(status)));
    expect(await scenePipelineRequest(request, "scene-one")).toEqual(status);
  }
  // The figure is part of the Pipeline's seal.
  const status = pipelineStatus(request, { attempts: [settled] });
  fetcher.mockImplementationOnce(async () => new Response(JSON.stringify({ ...status,
    attempts: [{ ...settled, retained_spend_usd: 0 }] })));
  await expect(scenePipelineRequest(request, "scene-one")).rejects.toThrow("pipeline_receipt_binding_invalid");
  for (const attempt of [
    { ...settled, retained_spend_usd: -1 },
    { ...settled, retained_spend_usd: "21.63" },
    { ...settled, retained_spend_basis: "Proven Spend" },
    { ...row, retained_spend_usd: 21.630673 },
    { ...row, retained_spend_basis: "terminal_launch_unreconciled" },
  ]) {
    fetcher.mockImplementationOnce(async () => new Response(JSON.stringify(pipelineStatus(request, { attempts: [attempt] }))));
    await expect(scenePipelineRequest(request, "scene-one")).rejects.toThrow("pipeline_status_receipt_invalid");
  }
});

// C-04: the Pipeline's one outcome for the intent, sealed by itself and inside status_digest.
function sceneOutcome(kind: string, terminal: unknown, reasonCode: string, overrides: Record<string, unknown> = {}) {
  const value = { schema_version: "task_evaluation_scene_intent_outcome.v1", intent_id: "scene-one",
    intent_digest: sha("d"), kind, terminal, reason_category: "capability_limit", reason_code: reasonCode,
    decided_at_epoch: 1793000000.25, ...overrides };
  return { ...value, outcome_digest: sceneDigest(value) };
}

/** A website job's prepared scene, admitted under its grant and waiting to be forwarded. */
async function preparedWebsiteScene() {
  sponsoredCapture();
  const base = (await app()).replace(/\/intakes$/, "/internal/creator-captures/walkthrough-req1");
  const post = (operation: string, extra = {}) => realFetch(`${base}/${operation}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: "req1", scene_id: "site-req1", ...extra }),
  });
  const grant = await (await post("scene-sponsorship")).json();
  const sceneRequest = {
    schema_version: "task_evaluation_scene_intake_request.v1", submission_id: grant.capture_id,
    owner: grant.owner, consent: grant.consent,
    source: { kind: "gaussian_splat", binding_id: `website-splat-${"a".repeat(32)}`, content_digest: sha("a") },
    task: { ...command().task, task_id: `website-${grant.task_context_digest.slice(7, 27)}`,
      subject: { description: "box", geometry_origin: "removed_before_reconstruction" } },
    execution: { ...command().execution, max_total_spend_usd: grant.max_total_spend_usd,
      max_paid_attempts: grant.max_paid_attempts, expires_at_epoch: grant.expires_at_epoch,
      allowed_providers: ["vast", "openai"], purpose: "scene_preparation", policy_candidates: [] },
  };
  expect((await post("prepared-scene", { request: sceneRequest })).status).toBe(202);
  return sceneRequest;
}

describe("the intent's outcome (C-04)", () => {
  const request = { owner: { user_id: "owner", organization_id: "user:owner" } };
  const respond = (fetcher: ReturnType<typeof vi.fn>, value: unknown) =>
    fetcher.mockImplementationOnce(async () => new Response(JSON.stringify(value)));

  it("reads a status with or without an outcome, and refuses an outcome that does not bind to it", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    // Older Pipelines send no outcome: the status reads exactly as before.
    const plain = pipelineStatus(request, { status: "blocked", phase: "preparation", blockers: ["x"], attempts: [] });
    respond(fetcher, plain);
    expect(await scenePipelineRequest(request, "scene-one")).toEqual(plain);
    // An outcome is kept as sent, sealed inside status_digest like result_run_id.
    const held = pipelineStatus(request, { status: "blocked", phase: "preparation", attempts: [],
      blockers: ["website_task_family_unknown"], outcome: sceneOutcome("held", true, "task_family_unsupported") });
    respond(fetcher, held);
    expect(await scenePipelineRequest(request, "scene-one")).toEqual(held);
    // A reason added later still parses, and so does a kind added later (review, 2026-11-12): the status read never
    // fails on it; such an outcome is simply not adopted (`adoptedSceneOutcome`).
    respond(fetcher, pipelineStatus(request, { outcome: sceneOutcome("setup_repair", false, "a_later_reason",
      { reason_category: "a_later_category" }) }));
    await expect(scenePipelineRequest(request, "scene-one")).resolves.toMatchObject({ outcome: { reason_code: "a_later_reason" } });
    respond(fetcher, pipelineStatus(request, { outcome: sceneOutcome("finished", true, "task_family_unsupported") }));
    await expect(scenePipelineRequest(request, "scene-one")).resolves.toMatchObject({ outcome: { kind: "finished" } });
    for (const outcome of [
      { ...sceneOutcome("held", true, "task_family_unsupported"), detail: "extra" },
      sceneOutcome("held", "yes", "task_family_unsupported"),
      sceneOutcome("held", true, "Task-Family Unsupported"),
      sceneOutcome("held", true, "task_family_unsupported", { reason_category: "" }),
      sceneOutcome("held", true, "task_family_unsupported", { decided_at_epoch: "now" }),
      sceneOutcome("held", true, "task_family_unsupported", { schema_version: "task_evaluation_scene_intent_outcome.v2" }),
      // Its own seal, and the intent it names, must match.
      { ...sceneOutcome("held", true, "task_family_unsupported"), outcome_digest: sha("0") },
      sceneOutcome("held", true, "task_family_unsupported", { intent_id: "scene-two" }),
      sceneOutcome("held", true, "task_family_unsupported", { intent_digest: sha("1") }),
    ]) {
      respond(fetcher, pipelineStatus(request, { outcome }));
      await expect(scenePipelineRequest(request, "scene-one")).rejects.toThrow("pipeline_status_receipt_invalid");
    }
    // status_digest still covers the outcome: one swapped after sealing is refused.
    respond(fetcher, { ...held, outcome: sceneOutcome("withdrawn", true, "authority_revoked") });
    await expect(scenePipelineRequest(request, "scene-one")).rejects.toThrow("pipeline_receipt_binding_invalid");
  });

  it("stops polling once the outcome is terminal and keeps polling a wait", async () => {
    const url = await app();
    await realFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command()) });
    let outcome = sceneOutcome("awaiting_spend_approval", false, "spend_cap_reached", { reason_category: "spend_approval" });
    const fetcher = vi.fn(async (_url: any, init: any) => new Response(JSON.stringify(init.method === "POST"
      ? accepted(JSON.parse(init.body))
      : pipelineStatus(stored()[1].request, { status: "blocked", phase: "preparation",
        blockers: ["scene_intake_spend_cap_exhausted"], attempts: [], outcome }))));
    vi.stubGlobal("fetch", fetcher);
    const poll = async () => { stored()[1].next_forward_at_ms = 0; await processSceneIntakeQueue(); };
    await processSceneIntakeQueue();
    await poll();
    expect(stored()[1]).toMatchObject({ state: "accepted", blocker: null,
      pipeline_status: { outcome: { kind: "awaiting_spend_approval", terminal: false } } });
    expect(stored()[1].next_forward_at_ms).toBeLessThan(Number.MAX_SAFE_INTEGER);
    outcome = sceneOutcome("held", true, "task_family_unsupported");
    await poll();
    expect(stored()[1]).toMatchObject({ state: "blocked", blocker: null, next_forward_at_ms: Number.MAX_SAFE_INTEGER,
      pipeline_status: { outcome: { kind: "held", terminal: true } } });
    await poll();
    expect(fetcher.mock.calls.map((call: any[]) => call[1]?.method)).toEqual(["POST", "GET", "GET"]);
    // Not a website job: no site is owed an email.
    expect(stored()[1].scene_outcome_notification_pending).toBeUndefined();
  });

  it("keeps the read-only closeout of a reserved attempt after a terminal outcome", async () => {
    const url = await app();
    await realFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command()) });
    const fetcher = vi.fn(async (_url: any, init: any) => new Response(JSON.stringify(init.method === "POST"
      ? accepted(JSON.parse(init.body))
      // Expired with an attempt still reserved, and the expiry already decided as the ending.
      : pipelineStatus(stored()[1].request, { outcome: sceneOutcome("setup_repair", true, "authority_expired",
        { reason_category: "authority_expired" }) }))));
    vi.stubGlobal("fetch", fetcher);
    await processSceneIntakeQueue();
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("closeout_pending");
    expect(stored()[1].next_forward_at_ms).toBeLessThan(Number.MAX_SAFE_INTEGER);
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("closeout_pending");
    expect(fetcher.mock.calls.map((call: any[]) => call[1]?.method)).toEqual(["POST", "GET", "GET"]);
  });

  it("owes a website job one email for a terminal outcome and none for a wait", async () => {
    const sceneRequest = await preparedWebsiteScene();
    let outcome = sceneOutcome("awaiting_site", false, "site_consent_required", { reason_category: "site_action" });
    const fetcher = vi.fn(async (_url: any, init: any) => new Response(JSON.stringify(init.method === "POST"
      ? accepted(JSON.parse(init.body))
      : pipelineStatus(stored()[1].request, { status: "needs_input", phase: "source", attempts: [],
        blockers: ["website_atlas_source_consent_required"], outcome }))));
    vi.stubGlobal("fetch", fetcher);
    const poll = async () => { stored()[1].next_forward_at_ms = 0; await processSceneIntakeQueue(); };
    await processSceneIntakeQueue();
    await poll();
    expect(stored()[1]).toMatchObject({ state: "accepted", pipeline_status: { outcome: { kind: "awaiting_site" } } });
    expect(stored()[1].scene_outcome_notification_pending).toBeUndefined();
    outcome = sceneOutcome("held", true, "task_family_unsupported");
    await poll();
    const [key, intake] = stored();
    expect(intake).toMatchObject({ state: "blocked", next_forward_at_ms: Number.MAX_SAFE_INTEGER,
      scene_outcome_notification_pending: true, scene_outcome_notification_intent: {
        schema_version: "scene_outcome_notification.v1", request_id: "req1", intake_id: key.split("/")[1],
        kind: "held", outcome_digest: outcome.outcome_digest, event_id: `held-${outcome.outcome_digest.slice(7)}` } });
    expect(fetcher.mock.calls.map((call: any[]) => call[1]?.method)).toEqual(["POST", "GET", "GET"]);
  });

  it("records why the WebApp revoked a website intent, so its own revoke never reads as the site's withdrawal", async () => {
    const sceneRequest = await preparedWebsiteScene();
    const fetcher = vi.fn(async (_url: any, init: any) => {
      if (init.method === "GET") return new Response(JSON.stringify(pipelineStatus(stored()[1].request, {
        status: "running", phase: "configuration", blockers: [], attempts: [] })));
      const payload = JSON.parse(init.body);
      return new Response(JSON.stringify(payload.intent_digest ? revocationReceipt(sceneRequest) : accepted(payload)));
    });
    vi.stubGlobal("fetch", fetcher);
    await processSceneIntakeQueue();
    // The brief behind the grant is gone: the WebApp revokes for its own reason, not a rights one.
    store.rows.delete("siteTaskBriefs/req1");
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue();
    expect(stored()[1]).toMatchObject({ state: "closeout_pending", revocation_cause: "task_brief_missing",
      revocation_receipt: { scope: "future_execution" } });
  });
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


// Beta endings: a Pipeline outage, a configuration slip or a quiet Pipeline must not end a job
// or leave it waiting for ever. Only the job's own window, or the site's rights, ends it.
describe("a Pipeline outage, an unreadable grant and the end of the window", () => {
  const MINUTE = 60_000;
  /** The Pipeline as it answers a healthy website intent: accept, report it running, confirm a revoke. */
  function healthyPipeline(sceneRequest: any, status: Record<string, any> = {}) {
    return vi.fn(async (url: any, init: any) => {
      if (init.method === "GET") return new Response(JSON.stringify(pipelineStatus(stored()[1].request, {
        status: "running", phase: "configuration", blockers: [], attempts: [], ...status })));
      const payload = JSON.parse(init.body);
      return new Response(JSON.stringify(String(url).endsWith("/revoke") ? revocationReceipt(sceneRequest) : accepted(payload)));
    });
  }
  const revokes = (fetcher: ReturnType<typeof vi.fn>) =>
    fetcher.mock.calls.filter((call: any[]) => String(call[0]).endsWith("/revoke")).length;
  const tick = async (deps: Parameters<typeof processSceneIntakeQueue>[1] = {}) => {
    stored()[1].next_forward_at_ms = 0;
    await processSceneIntakeQueue(10, { alert: async () => ({}), ...deps });
  };
  const otherPolicy = () => { process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON = JSON.stringify({
    ...JSON.parse(process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON!), max_paid_attempts: 3 }); };

  it("backs a failed forward off from one minute to fifteen, with jitter, and is still retrying after twenty failures", async () => {
    expect([1, 2, 3, 4, 5, 6, 40].map(failures => sceneForwardRetryDelayMs(failures, () => 1)))
      .toEqual([1, 2, 4, 8, 15, 15, 15].map(minutes => minutes * MINUTE));
    expect(sceneForwardRetryDelayMs(1, () => 0)).toBe(MINUTE / 2);
    expect(sceneForwardRetryDelayMs(9, () => 0)).toBe(SCENE_FORWARD_RETRY_MAX_MS / 2);
    for (const failures of [1, 3, 7, 30]) {
      const wait = sceneForwardRetryDelayMs(failures);
      expect(wait).toBeGreaterThanOrEqual(MINUTE / 2);
      expect(wait).toBeLessThanOrEqual(SCENE_FORWARD_RETRY_MAX_MS);
    }

    const sceneRequest = await preparedWebsiteScene();
    const down = vi.fn(async () => { throw new TypeError("fetch failed"); });
    vi.stubGlobal("fetch", down);
    const start = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(start);
    try {
      const waits: number[] = [];
      for (let failure = 1; failure <= 25; failure++) {
        await tick({ random: () => 1 });
        waits.push(stored()[1].next_forward_at_ms - start);
      }
      expect(waits.slice(0, 6)).toEqual([1, 2, 4, 8, 15, 15].map(minutes => minutes * MINUTE));
      expect(new Set(waits.slice(5))).toEqual(new Set([SCENE_FORWARD_RETRY_MAX_MS]));
      expect(stored()[1]).toMatchObject({ state: "forward_blocked", blocker: "pipeline_transport_failed",
        forward_attempt_count: 25, forward_failure_count: 25 });
      expect(down).toHaveBeenCalledTimes(25);
      // Nothing is sent before the backoff has run.
      await processSceneIntakeQueue(10);
      expect(down).toHaveBeenCalledTimes(25);
      // The Pipeline is back: the same intake is delivered and the backoff starts over.
      const up = healthyPipeline(sceneRequest);
      vi.stubGlobal("fetch", up);
      await tick();
      expect(stored()[1]).toMatchObject({ state: "accepted", blocker: null, forward_failure_count: 0 });
      expect(JSON.parse(up.mock.calls[0][1].body)).toEqual(sceneRequest);
    } finally { clock.mockRestore(); }
  });

  it("stops retrying a forward when the window ends, and at once for a code that is terminal", async () => {
    const sceneRequest = await preparedWebsiteScene();
    const down = vi.fn(async () => new Response("{}", { status: 503 }));
    vi.stubGlobal("fetch", down);
    await tick();
    expect(stored()[1]).toMatchObject({ state: "forward_blocked", blocker: "pipeline_intake_http_503" });
    const clock = vi.spyOn(Date, "now").mockReturnValue((sceneRequest.execution.expires_at_epoch + 1) * 1000);
    try { await tick(); } finally { clock.mockRestore(); }
    expect(stored()[1]).toMatchObject({ state: "blocked", blocker: "consent_expired" });
    expect(down).toHaveBeenCalledTimes(1);

    // The site's withdrawal, a broken binding and changed stored bytes each end the intake on the first read.
    for (const [code, damage] of [
      ["source_revoked", () => { store.rows.get("inboundRequests/req1").consent_revoked = true; }],
      ["website_scene_sponsorship_binding_invalid", () => { stored()[1].root_sponsorship_digest = sha("0"); }],
      ["stored_request_digest_invalid", () => { stored()[1].request.submission_id = "another"; }],
    ] as const) {
      store.rows.clear();
      await new Promise<void>(resolve => server!.close(() => resolve()));
      await preparedWebsiteScene();
      damage();
      await tick();
      expect(stored()[1]).toMatchObject({ state: "blocked", blocker: code, forward_attempt_count: 0 });
    }
    expect(down).toHaveBeenCalledTimes(1);
  });

  it("names a failed request, a refused one and an error on this side differently", async () => {
    const url = await app();
    const submit = async () => {
      store.rows.delete(stored()?.[0] ?? "");
      await realFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command()) });
    };
    await realFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command()) });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await tick();
    expect(stored()[1]).toMatchObject({ state: "forward_blocked", blocker: "pipeline_transport_failed", forward_attempt_count: 1 });
    await submit();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>bad gateway</html>")));
    await tick();
    expect(stored()[1].blocker).toBe("pipeline_transport_failed");
    await submit();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 502 })));
    await tick();
    expect(stored()[1].blocker).toBe("pipeline_intake_http_502");
    await submit();
    // The stored command no longer parses: nothing was sent, so this is not a transport failure.
    const never = vi.fn();
    vi.stubGlobal("fetch", never);
    stored()[1].command.submission_id = "";
    await tick();
    expect(stored()[1]).toMatchObject({ state: "forward_blocked", blocker: "scene_intake_local_error", forward_attempt_count: 0 });
    expect(never).not.toHaveBeenCalled();
  });

  it.each([["does not parse", "{not json"], ["is unset", undefined], ["fails its schema", JSON.stringify({ owner: "nobody" })]])(
    "never revokes when the grant policy %s, and raises one alert", async (_case, value) => {
      const sceneRequest = await preparedWebsiteScene();
      const fetcher = healthyPipeline(sceneRequest);
      vi.stubGlobal("fetch", fetcher);
      await tick();
      expect(stored()[1].state).toBe("accepted");
      if (value === undefined) delete process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON;
      else process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON = value;
      // The existing ops alert path keeps a repeated alert to one per window.
      const sent = vi.fn(async (_message: string) => ({ sent: true }));
      const alert = createRateLimitedAlerter({ send: sent });
      for (let pass = 0; pass < 3; pass++) await tick({ alert });
      expect(stored()[1]).toMatchObject({ state: "accepted", blocker: null });
      expect(stored()[1]).not.toHaveProperty("revocation_receipt");
      expect(stored()[1]).not.toHaveProperty("revocation_cause");
      expect(revokes(fetcher)).toBe(0);
      // The read-only status poll went on: the job is kept as it is, not frozen.
      expect(fetcher.mock.calls.filter((call: any[]) => call[1]?.method === "GET")).toHaveLength(3);
      expect(sent).toHaveBeenCalledTimes(1);
      expect(sent.mock.calls[0][0]).toMatch(/Nothing was revoked/);
      expect(sent.mock.calls[0][0]).toMatch(/BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON/);
      // Money fails closed meanwhile: no new grant and no new reservation.
      await expect(loadWebsiteSceneSponsorship("req1", true)).rejects.toThrow("website_scene_sponsorship_not_configured");
      await expect(reserveWebsitePreparationSpend("req1", { task_context_digest: sha("a"), allocation_binding_digest: sha("b"),
        resource_class: "gpu_render", provider: "vast", maximum_cost_usd: 1, request_count: 1 }))
        .rejects.toThrow("website_scene_sponsorship_not_configured");
    });

  it("forwards nothing while the grant policy cannot be read, and forwards once it reads again", async () => {
    const sceneRequest = await preparedWebsiteScene();
    const policy = process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON!;
    process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON = "{not json";
    const fetcher = healthyPipeline(sceneRequest);
    vi.stubGlobal("fetch", fetcher);
    const alert = vi.fn(async () => ({}));
    await tick({ alert });
    expect(stored()[1]).toMatchObject({ state: "forward_blocked", blocker: "website_scene_sponsorship_not_configured",
      forward_attempt_count: 0 });
    expect(fetcher).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
    process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON = policy;
    await tick({ alert });
    expect(stored()[1].state).toBe("accepted");
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it("never revokes for a job record with no stored grant, and raises the alert", async () => {
    const sceneRequest = await preparedWebsiteScene();
    const fetcher = healthyPipeline(sceneRequest);
    vi.stubGlobal("fetch", fetcher);
    await tick();
    delete store.rows.get("inboundRequests/req1").website_scene_sponsorship;
    const alert = vi.fn(async (_key: string, _message: string) => ({}));
    await tick({ alert });
    expect(stored()[1].state).toBe("accepted");
    expect(revokes(fetcher)).toBe(0);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]).toEqual(["website_scene_grant_read", expect.stringMatching(/no stored grant/)]);
  });

  it("still revokes at once when the site withdraws, even while the grant policy cannot be read", async () => {
    const sceneRequest = await preparedWebsiteScene();
    const fetcher = healthyPipeline(sceneRequest);
    vi.stubGlobal("fetch", fetcher);
    await tick();
    process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON = "{not json";
    store.rows.get("inboundRequests/req1").consent_revoked = true;
    const alert = vi.fn(async () => ({}));
    await tick({ alert });
    expect(stored()[1]).toMatchObject({ state: "closeout_pending", revocation_cause: "source_revoked",
      revocation_receipt: { scope: "future_execution" } });
    expect(revokes(fetcher)).toBe(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it("revokes for a changed grant only after consecutive reads over the confirmation period", async () => {
    const sceneRequest = await preparedWebsiteScene();
    const policy = process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON!;
    const fetcher = healthyPipeline(sceneRequest);
    vi.stubGlobal("fetch", fetcher);
    await tick();
    const start = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(start);
    const alert = vi.fn(async (_key: string, _message: string) => ({}));
    try {
      // The worker holds another policy value than the one the grant was issued under (a deploy).
      otherPolicy();
      await expect(loadWebsiteSceneSponsorship("req1", false)).rejects.toThrow("website_scene_sponsorship_changed");
      for (const minute of [0, 1, 2]) {
        clock.mockReturnValue(start + minute * MINUTE);
        await tick({ alert });
        expect(stored()[1]).toMatchObject({ state: "accepted", sponsorship_changed_observation: { first_seen_at_ms: start, count: minute + 1 } });
      }
      expect(alert).toHaveBeenCalledTimes(3);
      expect(alert.mock.calls[0][1]).toMatch(/does not match the policy this process holds/);
      // The deploy finished: both services hold the same value again, and the count starts over.
      process.env.BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON = policy;
      clock.mockReturnValue(start + 3 * MINUTE);
      await tick({ alert });
      expect(stored()[1]).toMatchObject({ state: "accepted", sponsorship_changed_observation: null });
      expect(revokes(fetcher)).toBe(0);
      // A change that stays: the third consecutive read after the period revokes, as it always did.
      otherPolicy();
      const again = start + 4 * MINUTE;
      for (const elapsed of [0, 7 * MINUTE, SPONSORSHIP_CHANGED_CONFIRM_MS - 1]) {
        clock.mockReturnValue(again + elapsed);
        await tick({ alert });
        expect(stored()[1].state).toBe("accepted");
      }
      expect(revokes(fetcher)).toBe(0);
      clock.mockReturnValue(again + SPONSORSHIP_CHANGED_CONFIRM_MS);
      await tick({ alert });
      expect(stored()[1]).toMatchObject({ state: "closeout_pending", revocation_cause: "website_scene_sponsorship_changed" });
      expect(revokes(fetcher)).toBe(1);
    } finally { clock.mockRestore(); }
  });

  it("keeps an unforwarded intake retrying through a changed grant read until it is confirmed", async () => {
    const sceneRequest = await preparedWebsiteScene();
    const fetcher = healthyPipeline(sceneRequest);
    vi.stubGlobal("fetch", fetcher);
    const start = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(start);
    try {
      otherPolicy();
      for (const elapsed of [0, MINUTE, 3 * MINUTE]) {
        clock.mockReturnValue(start + elapsed);
        await tick();
        expect(stored()[1]).toMatchObject({ state: "forward_blocked", blocker: "website_scene_sponsorship_changed" });
      }
      clock.mockReturnValue(start + SPONSORSHIP_CHANGED_CONFIRM_MS);
      await tick();
      expect(stored()[1]).toMatchObject({ state: "blocked", blocker: "website_scene_sponsorship_changed" });
      expect(fetcher).not.toHaveBeenCalled();
    } finally { clock.mockRestore(); }
  });

  it("stops polling an accepted intake when its window has ended, without releasing its budget", async () => {
    const url = await app();
    await realFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command()) });
    const fetcher = healthyPipeline(null);
    vi.stubGlobal("fetch", fetcher);
    await tick();
    await tick();
    expect(stored()[1]).toMatchObject({ state: "accepted", pipeline_status: { status: "running" } });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const expiry = stored()[1].request.execution.expires_at_epoch;
    const clock = vi.spyOn(Date, "now").mockReturnValue(expiry * 1000);
    try {
      await tick();
      expect(stored()[1]).toMatchObject({ state: "expired", blocker: "consent_expired",
        next_forward_at_ms: Number.MAX_SAFE_INTEGER, pipeline_status: { status: "running" } });
      // Only the Pipeline's own word releases the hold on the intent's budget.
      expect(stored()[1]).not.toHaveProperty("closeout_complete");
      await processSceneIntakeQueue(10);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally { clock.mockRestore(); }
  });

  it("gives an attempt with money reserved the bounded read-only closeout at the window's end, whatever the Pipeline answers", async () => {
    const url = await app();
    await realFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command()) });
    const reserved = pipelineStatus({ owner: { user_id: "owner", organization_id: "user:owner" } }).attempts;
    // The Pipeline still says "running" after the window: it has not looked at the intent again.
    const fetcher = healthyPipeline(null, { attempts: reserved });
    vi.stubGlobal("fetch", fetcher);
    await tick();
    await tick();
    expect(stored()[1]).toMatchObject({ state: "accepted", pipeline_status: { attempts: [{ maximum_spend_usd: 2 }] } });
    const expiry = stored()[1].request.execution.expires_at_epoch;
    const clock = vi.spyOn(Date, "now").mockReturnValue((expiry + 1) * 1000);
    try {
      await tick();
      expect(stored()[1]).toMatchObject({ state: "closeout_pending", closeout_poll_count: 1 });
      // An unreachable Pipeline counts against the same bound.
      vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
      await tick();
      expect(stored()[1]).toMatchObject({ state: "closeout_pending", closeout_poll_count: 2, blocker: "pipeline_transport_failed" });
      stored()[1].closeout_poll_count = SCENE_TERMINAL_CLOSEOUT_POLL_LIMIT - 1;
      await tick();
      expect(stored()[1]).toMatchObject({ state: "blocked", blocker: "terminal_closeout_poll_cap_exhausted" });
    } finally { clock.mockRestore(); }

    // The same from an accepted intake whose every poll fails after the window.
    store.rows.delete(stored()[0]);
    await realFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command()) });
    vi.stubGlobal("fetch", fetcher);
    await tick();
    await tick();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const late = vi.spyOn(Date, "now").mockReturnValue((stored()[1].request.execution.expires_at_epoch + 1) * 1000);
    try {
      await tick();
      expect(stored()[1]).toMatchObject({ state: "closeout_pending", closeout_poll_count: 1 });
    } finally { late.mockRestore(); }
  });
});
