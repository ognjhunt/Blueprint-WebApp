import { describe, expect, it } from "vitest";

import {
  decodeTaskEvaluationRunPublication,
  encodeTaskEvaluationRunPublication,
  publicationFromResultRecord,
} from "../utils/taskEvaluationRunPublicationStorage";

describe("Task Evaluation Run publication storage", () => {
  it("round-trips a multi-megabyte evidence publication below Firestore's ceiling", () => {
    const publication = {
      schema_version: "task_evaluation_run_publication.v4",
      run_id: "scene839873-policy-canary-001",
      artifacts: Array.from({ length: 6_000 }, (_, index) => ({
        artifact_id: index.toString(16).padStart(32, "0"),
        role: "lossless_policy_input_frame",
        digest: `sha256:${index.toString(16).padStart(64, "0")}`,
        relative_path: `cell_runs/${index % 10}/episodes/frame-${index}.png`,
      })),
    };

    const storage = encodeTaskEvaluationRunPublication(publication);
    expect(Buffer.byteLength(JSON.stringify(publication), "utf8")).toBeGreaterThan(1_000_000);
    expect(Buffer.byteLength(JSON.stringify(storage), "utf8")).toBeLessThan(900_000);
    expect(decodeTaskEvaluationRunPublication(storage)).toEqual(publication);
    expect(publicationFromResultRecord({ publication_storage: storage })).toEqual(publication);
  });

  it("fails closed when the compressed bytes or digest are changed", () => {
    const storage = encodeTaskEvaluationRunPublication({ run_id: "run-1" });
    expect(decodeTaskEvaluationRunPublication({
      ...storage,
      payload_sha256: `sha256:${"0".repeat(64)}`,
    })).toBeNull();
    expect(decodeTaskEvaluationRunPublication({
      ...storage,
      payload_base64: `${storage.payload_base64.slice(0, -4)}AAAA`,
    })).toBeNull();
  });
});
