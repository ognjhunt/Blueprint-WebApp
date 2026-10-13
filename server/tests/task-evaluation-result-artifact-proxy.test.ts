import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

import {
  ARTIFACT_ORIGIN_HEADER_TIMEOUT_MS,
  configuredArtifactEndpoint,
  describeResultArtifactRegistryConfig,
  probeTaskEvaluationResultArtifact,
  probeTaskEvaluationResultArtifactMetadata,
  signedPipelineHeaders,
} from "../utils/taskEvaluationResultArtifactProxy";

const ENVIRONMENT_NAMES = [
  "TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE",
  "TASK_EVALUATION_RUN_EXECUTE_URL",
  "TASK_EVALUATION_LAUNCH_URL",
  "TASK_EVALUATION_RUN_FORWARD_TOKEN",
  "TASK_EVALUATION_RUN_FORWARD_CLIENT_ID",
  "ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN",
  "ROBOT_EVAL_JOB_REQUEST_FORWARD_CLIENT_ID",
  "ROBOT_EVAL_JOB_REQUEST_FORWARD_URL",
  "TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET",
] as const;

afterEach(() => {
  for (const name of ENVIRONMENT_NAMES) delete process.env[name];
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Task Evaluation Result artifact origin", () => {
  it("probes a sealed empty telemetry file without requesting a nonexistent byte", async () => {
    process.env.TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE = "https://pipeline.example/{run_id}/{artifact_id}";
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "fixture-key";
    const expected = { sha256: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", size_bytes: 0 };
    const fetchMock = vi.fn(async (_url, options) => options.headers.range
      ? { status: 416, ok: false, headers: new Headers({ "content-range": "bytes */0" }) }
      : { status: 200, ok: true, body: { cancel: vi.fn() },
        headers: new Headers({ "content-length": "0", "x-blueprint-artifact-sha256": expected.sha256 }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(probeTaskEvaluationResultArtifactMetadata({ runId: "run", artifactId: "empty-telemetry", expected }))
      .resolves.toEqual({ status: "admitted", metadata: expected });
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("range");
    await expect(probeTaskEvaluationResultArtifactMetadata({ runId: "run", artifactId: "empty-telemetry",
      expected: { ...expected, sha256: `sha256:${"f".repeat(64)}` } })).resolves.toEqual({ status: "unavailable", reason: "artifact_registry_digest_mismatch", httpStatus: 200 });
  });

  it("exposes digest and total size for registry-only artifacts without buffering their bodies", async () => {
    process.env.TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE = "https://pipeline.example/runs/{run_id}/artifacts/{artifact_id}";
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "canonical-forward-token";
    const cancel = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 206, ok: true, body: { cancel },
      headers: new Headers({ "content-length": "1", "content-range": "bytes 0-0/8192",
        "x-blueprint-artifact-sha256": `sha256:${"a".repeat(64)}` }) }));
    await expect(probeTaskEvaluationResultArtifactMetadata({ runId: "run-1", artifactId: "registry-only" }))
      .resolves.toEqual({ status: "admitted", metadata: { sha256: `sha256:${"a".repeat(64)}`, size_bytes: 8192 } });
    await expect(probeTaskEvaluationResultArtifactMetadata({ runId: "run-1", artifactId: "registry-only",
      expected: { sha256: `sha256:${"b".repeat(64)}`, size_bytes: 8192 } })).resolves.toEqual({ status: "unavailable", reason: "artifact_registry_digest_mismatch", httpStatus: 206 });
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("derives the artifact route from the canonical production launch URL", () => {
    process.env.TASK_EVALUATION_LAUNCH_URL =
      "https://pipeline.example/api/live-pipeline/task-evaluation-launches";
    expect(configuredArtifactEndpoint("run / one", "artifact / one")).toBe(
      "https://pipeline.example/api/live-pipeline/task-evaluation-runs/"
        + "run%20%2F%20one/artifacts/artifact%20%2F%20one",
    );
  });

  it("reuses the canonical Pipeline forward token without exposing it", () => {
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "canonical-forward-token";
    const headers = signedPipelineHeaders();
    expect(headers?.["x-blueprint-pipeline-client-id"]).toBe("blueprint-webapp");
    expect(headers?.["x-blueprint-pipeline-signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(JSON.stringify(headers)).not.toContain("canonical-forward-token");
  });

  it("prefers canonical credentials when deprecated credentials also exist", () => {
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "canonical-forward-token";
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_CLIENT_ID = "blueprint-webapp";
    process.env.TASK_EVALUATION_RUN_FORWARD_TOKEN = "deprecated-forward-token";
    process.env.TASK_EVALUATION_RUN_FORWARD_CLIENT_ID = "deprecated-client";
    const headers = signedPipelineHeaders("exact-body");
    expect(headers?.["x-blueprint-pipeline-client-id"]).toBe("blueprint-webapp");
    const expected = createHmac("sha256", "canonical-forward-token")
      .update(`${headers?.["x-blueprint-pipeline-timestamp"]}.blueprint-webapp.${headers?.["x-blueprint-pipeline-nonce"]}.exact-body`)
      .digest("hex");
    expect(headers?.["x-blueprint-pipeline-signature"]).toBe(`sha256=${expected}`);
  });

  it("fails closed when no exact route or token is configured", () => {
    process.env.TASK_EVALUATION_LAUNCH_URL = "https://pipeline.example/unrelated";
    expect(configuredArtifactEndpoint("run", "artifact")).toBe("");
    expect(signedPipelineHeaders()).toBeNull();
  });

  it("probes the sealed per-run registry with a bounded signed read", async () => {
    process.env.TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE =
      "https://pipeline.example/runs/{run_id}/artifacts/{artifact_id}";
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "canonical-forward-token";
    const cancel = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({ status: 206, ok: true, body: { cancel }, headers: new Headers({ "content-length": "1", "content-range": "bytes 0-0/1", "x-blueprint-artifact-sha256": `sha256:${"a".repeat(64)}` }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(probeTaskEvaluationResultArtifact({
      runId: "run-1",
      artifactId: "frame-1",
    })).resolves.toBe("admitted");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://pipeline.example/runs/run-1/artifacts/frame-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          range: "bytes=0-0",
          "x-blueprint-pipeline-signature": expect.stringMatching(/^sha256=/),
        }),
      }),
    );
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("distinguishes a registry miss from an unavailable origin", async () => {
    process.env.TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE =
      "https://pipeline.example/runs/{run_id}/artifacts/{artifact_id}";
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "canonical-forward-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, ok: false }));
    await expect(probeTaskEvaluationResultArtifact({
      runId: "run-1",
      artifactId: "missing",
    })).resolves.toBe("not_found");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 500, ok: false }));
    await expect(probeTaskEvaluationResultArtifact({
      runId: "run-1",
      artifactId: "frame-1",
    })).resolves.toBe("unavailable");
  });
  it("cancels refused probe bodies and bounds a hanging admission probe", async () => {
    process.env.TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE="https://pipeline.example/{run_id}/{artifact_id}";
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN="fixture-key";
    const cancel=vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({status:404,ok:false,body:{cancel}}));
    await expect(probeTaskEvaluationResultArtifact({runId:"run",artifactId:"frame"})).resolves.toBe("not_found");
    expect(cancel).toHaveBeenCalledOnce();
    vi.useFakeTimers(); let signal!:AbortSignal;
    vi.stubGlobal("fetch",vi.fn((_url,options)=>new Promise((_resolve,reject)=>{signal=options.signal;signal.addEventListener("abort",()=>reject(new Error("timeout")));})));
    const pending=probeTaskEvaluationResultArtifact({runId:"run",artifactId:"frame"});
    await vi.advanceTimersByTimeAsync(ARTIFACT_ORIGIN_HEADER_TIMEOUT_MS);
    await expect(pending).resolves.toBe("unavailable");expect(signal.aborted).toBe(true);
  });

});

describe("result artifact registry configuration diagnosis", () => {
  it("derives the registry from the canonical job-request URL exactly as launches do", () => {
    // Production default: TASK_EVALUATION_LAUNCH_URL is optional when the
    // job-request URL is canonical. The registry used to resolve to nothing here.
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL = "https://pipeline.example/api/live-pipeline/job-requests";
    expect(configuredArtifactEndpoint("run-1", "review-video")).toBe(
      "https://pipeline.example/api/live-pipeline/task-evaluation-runs/run-1/artifacts/review-video");
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "canonical-forward-token";
    process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET = "ticket-secret";
    expect(describeResultArtifactRegistryConfig()).toMatchObject({ ready: true, endpointSource: "job_request_forward_url",
      endpointHost: "pipeline.example", missing: [] });
  });

  it("refuses a template that would send every artifact to one URL", () => {
    process.env.TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE = "https://pipeline.example/artifacts";
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL = "https://pipeline.example/api/live-pipeline/job-requests";
    expect(configuredArtifactEndpoint("run", "artifact")).toBe("");
    expect(describeResultArtifactRegistryConfig().issues).toContain("artifact_registry_template_invalid");
  });

  it("uses an execute URL only when it ends in /execute", () => {
    process.env.TASK_EVALUATION_RUN_EXECUTE_URL = "https://pipeline.example/runs/{run_id}/start";
    expect(configuredArtifactEndpoint("run", "artifact")).toBe("");
    process.env.TASK_EVALUATION_RUN_EXECUTE_URL = "https://pipeline.example/runs/{run_id}/execute";
    expect(configuredArtifactEndpoint("run", "artifact")).toBe("https://pipeline.example/runs/run/artifacts/artifact");
  });

  it("names every missing item when nothing is configured", async () => {
    const config = describeResultArtifactRegistryConfig();
    expect(config.ready).toBe(false);
    expect(config.issues).toEqual(["artifact_registry_endpoint_not_configured", "artifact_registry_signing_token_not_configured"]);
    expect(config.detail).toMatch(/ROBOT_EVAL_JOB_REQUEST_FORWARD_URL/);
    expect(config.detail).toMatch(/ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN/);
    expect(config.detail).toMatch(/TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET/);
    await expect(probeTaskEvaluationResultArtifactMetadata({ runId: "run", artifactId: "video" })).resolves.toMatchObject({
      status: "unavailable", reason: "artifact_registry_endpoint_not_configured", missingConfig: expect.stringContaining("TASK_EVALUATION_LAUNCH_URL") });
    process.env.TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE = "https://pipeline.example/{run_id}/{artifact_id}";
    await expect(probeTaskEvaluationResultArtifactMetadata({ runId: "run", artifactId: "video" })).resolves.toMatchObject({
      status: "unavailable", reason: "artifact_registry_signing_token_not_configured" });
  });

  it.each([
    [{ status: 401, ok: false }, "artifact_registry_credentials_rejected", 401],
    [{ status: 502, ok: false }, "artifact_registry_origin_error", 502],
    [{ status: 206, ok: true, body: null, headers: new Headers() }, "artifact_registry_empty_response", 206],
    [{ status: 206, ok: true, body: {}, headers: new Headers({ "content-range": "bytes 0-0/9", "content-length": "1" }) }, "artifact_registry_digest_header_missing", 206],
    [{ status: 206, ok: true, body: {}, headers: new Headers({ "content-range": "bytes 0-1/9", "content-length": "2",
      "x-blueprint-artifact-sha256": `sha256:${"a".repeat(64)}` }) }, "artifact_registry_range_or_size_mismatch", 206],
  ])("classifies an origin response as %#", async (response, reason, httpStatus) => {
    process.env.TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE = "https://pipeline.example/{run_id}/{artifact_id}";
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "fixture-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ headers: new Headers(), ...response }));
    await expect(probeTaskEvaluationResultArtifactMetadata({ runId: "run", artifactId: "video" }))
      .resolves.toEqual({ status: "unavailable", reason, httpStatus });
  });

  it("names a refused redirect and an unreachable origin", async () => {
    process.env.TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE = "https://pipeline.example/{run_id}/{artifact_id}";
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "fixture-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new TypeError("fetch failed"), { cause: new Error("unexpected redirect") })));
    await expect(probeTaskEvaluationResultArtifactMetadata({ runId: "run", artifactId: "video" }))
      .resolves.toEqual({ status: "unavailable", reason: "artifact_registry_redirect_refused" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new TypeError("fetch failed"), { cause: new Error("ECONNREFUSED") })));
    await expect(probeTaskEvaluationResultArtifactMetadata({ runId: "run", artifactId: "video" }))
      .resolves.toEqual({ status: "unavailable", reason: "artifact_registry_unreachable" });
  });
});
