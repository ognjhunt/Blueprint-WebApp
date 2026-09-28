// @vitest-environment node
import express from "express";
import { createServer } from "node:http";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { modelBytesDigest } from "../utils/policyModelArtifact";

const state = vi.hoisted(() => ({
  protected: true, save: vi.fn(), remove: vi.fn(), register: vi.fn(),
}));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {}, storageAdmin: { bucket: () => ({
    getMetadata: async () => [{ iamConfiguration: {
      uniformBucketLevelAccess: { enabled: state.protected }, publicAccessPrevention: "enforced",
    } }],
    file: () => ({ save: state.save, delete: state.remove,
      getMetadata: async () => [{ size: 4, generation: "123" }] }),
  }) },
}));
vi.mock("../utils/robotCheckpoints", () => ({ registerCheckpoint: state.register }));

const modelInterface = {
  schema_version: "blueprint.policy_model_interface.v1", runner_profile: "onnx_state_mlp_cpu_v1",
  input_name: "state", output_name: "actions", state_fields: [{ name: "joint_position", width: 2, unit: "radian" }],
  preprocessing: "embedded_in_model_graph",
  action_schema: { chunk_rows: 1, channels: [
    { name: "joint", raw_accepted_bounds: [-1, 1], unit: "radian" },
    { name: "gripper", raw_accepted_bounds: [0, 1], unit: "fraction" },
  ] },
};

beforeEach(() => {
  state.protected = true;
  vi.clearAllMocks();
  state.register.mockImplementation(async (params) => ({ registered: true, checkpoint: { checkpointId: "checkpoint-1", ...params } }));
  process.env.POLICY_MODEL_PRIVATE_STORAGE_BUCKET = "blueprint-private-policy-models";
});
afterEach(() => { delete process.env.POLICY_MODEL_PRIVATE_STORAGE_BUCKET; });

async function upload(interfaceValue: unknown = modelInterface, name = "policy.onnx") {
  const { receivePolicyModel, storePolicyModel } = await import("../routes/policy-model-upload");
  const app = express();
  // Only storage behavior is exercised here. Auth uses the real agent route's
  // key/account middleware and is covered by robot-team-self-serve.test.ts.
  app.post("/upload", (_req, res, next) => { res.locals.policyModelTeamId = "team-1"; next(); }, receivePolicyModel, storePolicyModel);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const body = new FormData();
    body.append("model", new Blob([new Uint8Array([1, 2, 3, 4])]), name);
    body.append("interface", JSON.stringify(interfaceValue));
    body.append("label", "v1");
    const result = await fetch(`http://127.0.0.1:${address.port}/upload`, { method: "POST", body });
    return { status: result.status, body: await result.json() };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

it("stores private digest-bound bytes and marks compatibility pending validation", async () => {
  const result = await upload();
  expect(result.status).toBe(201);
  const artifact = state.register.mock.calls[0][0].modelArtifact;
  expect(artifact.sha256).toBe(modelBytesDigest(Buffer.from([1, 2, 3, 4])));
  expect(artifact.storage_generation).toBe("123");
  expect(artifact.compatibility_status).toBe("uploaded_pending_runner_validation");
  expect(state.save.mock.calls[0][1].preconditionOpts).toEqual({ ifGenerationMatch: 0 });
  expect(JSON.stringify(result.body)).not.toContain("signedUrl");
});

it("refuses public-capable storage and unsupported runner/format", async () => {
  state.protected = false;
  expect((await upload()).body.code).toBe("policy_model_private_store_protection_required");
  expect(state.save).not.toHaveBeenCalled();
  expect((await upload({ ...modelInterface, runner_profile: "caller_python" })).status).toBe(400);
  expect((await upload(modelInterface, "policy.pkl")).status).toBe(400);
  expect((await upload({ ...modelInterface, state_fields: [{ name: "joint_position", width: 2 }] })).status).toBe(400);
  expect((await upload({ ...modelInterface, preprocessing: "caller_python" })).status).toBe(400);
});

it("removes only this upload if checkpoint persistence fails", async () => {
  state.register.mockRejectedValue(new Error("store unavailable"));
  expect((await upload()).status).toBe(503);
  expect(state.remove).toHaveBeenCalledOnce();
});

it("refuses missing storage configuration before a write", async () => {
  delete process.env.POLICY_MODEL_PRIVATE_STORAGE_BUCKET;
  expect((await upload()).status).toBe(503);
  expect(state.save).not.toHaveBeenCalled();
});
