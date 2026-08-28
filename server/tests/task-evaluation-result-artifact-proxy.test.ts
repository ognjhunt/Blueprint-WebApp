import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";

import {
  configuredArtifactEndpoint,
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
] as const;

afterEach(() => {
  for (const name of ENVIRONMENT_NAMES) delete process.env[name];
});

describe("Task Evaluation Result artifact origin", () => {
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
});
