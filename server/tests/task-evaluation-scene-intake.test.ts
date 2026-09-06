// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      destination: { description: "tray" },
      success: { description: "inside tray" },
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
      const body = JSON.parse(init.body);
      expect(body.owner).toEqual({
        user_id: "owner",
        organization_id: "user:owner",
      });
      const receipt = {
        schema_version: "task_evaluation_scene_intent_revocation.v1",
        intent_id: "scene-one",
        intent_digest: sha("d"),
        owner: body.owner,
        status: "revoked",
        revoked_at_epoch: Date.now() / 1000,
        scope: "future_execution",
        provider_mutation_performed: false,
      };
      return new Response(
        JSON.stringify({ ...receipt, receipt_digest: sceneDigest(receipt) }),
      );
    });
    await processSceneIntakeQueue();
    expect(stored()[1].state).toBe("revoked");
    expect(stored()[1].revocation_receipt.scope).toBe("future_execution");
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
