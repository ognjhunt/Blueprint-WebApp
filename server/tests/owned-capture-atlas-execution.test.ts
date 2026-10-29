// @vitest-environment node
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { executeOwnedAtlas, retryOwnedAtlas, inspectOwnedAtlas, ownedAtlasBundleRequest,
  ownedAtlasExecutionSchema } from "../utils/ownedCaptureAtlasExecution";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

const plan = JSON.parse(readFileSync(new URL("./fixtures/owned-capture-atlas-plan.json", import.meta.url), "utf8")).plan;
const fixture = JSON.parse(readFileSync(new URL("./fixtures/owned-capture-atlas-execution.json", import.meta.url), "utf8"));
let value: any, sent: any[];

beforeEach(() => {
  value = structuredClone(fixture.execution); sent = [];
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "https://pipeline.example.test/api/live-pipeline");
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN", "hermetic-test-token");
  vi.stubGlobal("fetch", vi.fn(async (url: URL, options: any) => {
    sent.push({ url: String(url), ...options });
    return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function assertSigned(command: any) {
  const headers = command.headers;
  const signature = createHmac("sha256", "hermetic-test-token")
    .update(`${headers["x-blueprint-pipeline-timestamp"]}.blueprint-webapp.${headers["x-blueprint-pipeline-nonce"]}.${command.body}`)
    .digest("hex");
  expect(headers["x-blueprint-pipeline-signature"]).toBe(`sha256=${signature}`);
  expect(headers["content-type"]).toBe("application/json");
}

it("accepts the exact Python-generated draft execution with no robot or metric upgrade", () => {
  expect(ownedAtlasExecutionSchema.parse(value)).toEqual(value);
  expect(Object.values(value.proof_boundary).every(flag => flag === false)).toBe(true);
  expect(value.scale_status).toBe("unscaled_provider_world_units");
});

it("accepts the actual Python ready status and preserves its normal reconstruction and unknown bill", () => {
  const ready = JSON.parse(readFileSync(new URL("./fixtures/owned-atlas-ready-status.json", import.meta.url), "utf8"));
  const parsed = ownedAtlasExecutionSchema.parse(ready);
  expect(parsed).toEqual(ready);
  expect(parsed.reconstruction?.execution_result.cost_usd).toBeNull();
  expect(parsed.reconstruction?.execution_result.cost_status).toBe("unknown");
  expect(parsed.reconstruction?.execution_result.proof_boundary.provider_reconstruction_was_remote).toBe(true);
  expect(parsed.scale_status).toBe("unscaled_provider_world_units");
});

it.each(["plan", "source", "intake", "authorization", "non-ready", "nested-digest", "outer-digest", "producer-bytes", "producer-body"])(
  "refuses a ready projection with changed %s", change => {
    const ready = JSON.parse(readFileSync(new URL("./fixtures/owned-atlas-ready-status.json", import.meta.url), "utf8"));
    const reconstruction = ready.reconstruction;
    if (change === "plan") reconstruction.plan_id = "another-plan";
    if (change === "source") reconstruction.reconstruction_plan.source_capture.capture_digest = "sha256:" + "f".repeat(64);
    if (change === "intake") reconstruction.reconstruction_plan.source_capture.intake_id = "another-intake";
    if (["source", "intake"].includes(change)) {
      reconstruction.reconstruction_plan.reconstruction_plan_digest = crossRuntimeArtifactDigest(reconstruction.reconstruction_plan, "reconstruction_plan_digest");
      reconstruction.execution_result.reconstruction_plan_digest = reconstruction.reconstruction_plan.reconstruction_plan_digest;
    }
    if (change === "authorization") reconstruction.execution_result.authorization_digest = "sha256:" + "f".repeat(64);
    if (change === "non-ready") { ready.state = "failed"; ready.bundle = null; }
    if (change === "producer-bytes") reconstruction.reconstruction_plan_canonical_json += " ";
    if (change === "producer-body") reconstruction.reconstruction_plan_canonical_json = reconstruction.reconstruction_plan_canonical_json.replace("local_adoption_only", "provider_execution");
    if (change !== "nested-digest") reconstruction.execution_result.execution_result_digest = crossRuntimeArtifactDigest(reconstruction.execution_result, "execution_result_digest");
    else reconstruction.execution_result.known_cost_subtotal_usd = 1;
    if (change !== "outer-digest") ready.execution_digest = crossRuntimeArtifactDigest(ready, "execution_digest");
    else ready.revision++;
    expect(ownedAtlasExecutionSchema.safeParse(ready).success).toBe(false);
  },
);

it("signs the entire owner/source/task execute command and rejects redirects", async () => {
  await expect(executeOwnedAtlas(plan, "real-fixture-owner", "owned-execution-1")).resolves.toEqual(value);
  expect(sent).toHaveLength(1); const command = sent[0];
  expect(command.url).toBe("https://pipeline.example.test/api/live-pipeline/reconstructions/atlas-execute");
  expect(command.method).toBe("POST"); expect(command.redirect).toBe("error"); assertSigned(command);
  expect(JSON.parse(command.body)).toEqual({ schema_version: "owned_capture_atlas_execution_submission.v1",
    plan_id: plan.plan_id, owner_user_id: "real-fixture-owner", task_context_digest: plan.source_context.context_digest,
    source_video_digest: plan.source_video_digest, idempotency_key: "owned-execution-1" });
});

it("binds status and bundle owner/plan/digest in signed bodies with no unsigned target parameters", async () => {
  await inspectOwnedAtlas(plan, "real-fixture-owner");
  expect(sent[0].url).toBe("https://pipeline.example.test/api/live-pipeline/reconstructions/atlas-inspect");
  expect(JSON.parse(sent[0].body)).toEqual({ schema_version: "owned_capture_atlas_inspection_submission.v1",
    plan_id: plan.plan_id, owner_user_id: "real-fixture-owner" }); assertSigned(sent[0]);
  const bundle = ownedAtlasBundleRequest(plan.plan_id, "real-fixture-owner", "sha256:" + "7".repeat(64));
  expect(bundle).not.toBeNull(); assertSigned(bundle);
  expect(String(bundle!.url)).toBe("https://pipeline.example.test/api/live-pipeline/reconstructions/atlas-bundle");
  expect(JSON.parse(bundle!.body)).toEqual({ schema_version: "owned_capture_atlas_bundle_submission.v1",
    plan_id: plan.plan_id, owner_user_id: "real-fixture-owner", digest: "sha256:" + "7".repeat(64) });
});

it("binds an explicit retry to its own signed contract, source and original owner", async () => {
  await retryOwnedAtlas(plan, "real-fixture-owner", "owned-retry-1");
  assertSigned(sent[0]); expect(sent[0].url.endsWith("/reconstructions/atlas-retry")).toBe(true);
  expect(JSON.parse(sent[0].body)).toEqual({ schema_version: "owned_capture_atlas_retry_submission.v1",
    plan_id: plan.plan_id, owner_user_id: "real-fixture-owner", task_context_digest: plan.source_context.context_digest,
    source_video_digest: plan.source_video_digest, idempotency_key: "owned-retry-1" });
});

it.each(["plan_id", "capture_id", "intake_id", "plan_digest", "task_context_digest", "source_video_digest"])(
  "refuses a self-consistent response for a different %s", async field => {
    value[field] = field.endsWith("digest") ? "sha256:" + "f".repeat(64)
      : field === "plan_id" ? "reconstruction-atlas-" + "f".repeat(24) : "different-source";
    value.execution_digest = crossRuntimeArtifactDigest(value, "execution_digest");
    await expect(inspectOwnedAtlas(plan, "owner")).rejects.toThrow("result_source_mismatch");
  });

it.each(["hash", "metric", "robot", "partial_download"])("refuses %s integrity/claim corruption", async change => {
  if (change === "hash") value.execution_digest = "sha256:" + "f".repeat(64);
  if (change === "metric") value.proof_boundary.metric_or_collision_qualification_established = true;
  if (change === "robot") value.proof_boundary.robot_execution_established = true;
  if (change === "partial_download") value.bundle = { digest: "sha256:" + "a".repeat(64), size_bytes: 10,
    filename: "fixture.zip", manifest_digest: "sha256:" + "b".repeat(64) };
  if (change !== "hash") value.execution_digest = crossRuntimeArtifactDigest(value, "execution_digest");
  await expect(inspectOwnedAtlas(plan, "owner")).rejects.toThrow();
});

it("does not send source commands to a configured credential-bearing origin", async () => {
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL", "https://user:password@pipeline.example.test");
  await expect(inspectOwnedAtlas(plan, "owner")).rejects.toThrow("delivery_not_configured");
  expect(sent).toEqual([]);
});
