import { describe, expect, it } from "vitest";

import {
  buildCanaryArtifactInventory,
  resolvedCanaryCandidates,
} from "./policyCanaryResultPortal";

function resultWithArtifacts(delivered: unknown[], billingReceipt: unknown) {
  return {
    publication: {
      result_delivery: {
        artifacts: delivered,
        episodes: [],
        candidate_results: [],
        reproducibility: {},
      },
      policy_canary_result: {
        reproducibility: { billing_receipt: billingReceipt },
      },
    },
  } as never;
}

describe("buildCanaryArtifactInventory", () => {
  it("keeps the richer delivered artifact when a sparse closure descriptor repeats its id", () => {
    const rich = {
      artifact_id: "billing-1",
      role: "closure_billing",
      relative_path: "official_billing_reconciliation.json",
      sha256: `sha256:${"a".repeat(64)}`,
      digest: `sha256:${"a".repeat(64)}`,
      size_bytes: 4187,
      content_type: "application/json",
    };
    const sparse = {
      artifact_id: "billing-1",
      digest: rich.digest,
      size_bytes: rich.size_bytes,
    };

    const artifacts = buildCanaryArtifactInventory(resultWithArtifacts([rich], sparse));

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      role: "closure_billing",
      relative_path: "official_billing_reconciliation.json",
      content_type: "application/json",
    });
  });

  it("normalizes a sparse descriptor instead of crashing portal sorting and labels", () => {
    const sparse = {
      artifact_id: "provider-zero-1",
      digest: `sha256:${"b".repeat(64)}`,
      size_bytes: 468,
    };

    const artifacts = buildCanaryArtifactInventory(resultWithArtifacts([], sparse));

    expect(artifacts).toEqual([
      expect.objectContaining({
        artifact_id: "provider-zero-1",
        role: "unclassified_artifact",
        relative_path: "provider-zero-1",
        content_type: "application/octet-stream",
      }),
    ]);
  });
});

describe("resolvedCanaryCandidates", () => {
  it("falls back to stable candidate ids and episode checkpoint evidence", () => {
    const result = {
      publication: {
        result_delivery: {
          candidate_results: [
            { candidate_id: "pi05_droid" },
            { candidate_id: "groot_n17_droid" },
          ],
          episodes: [
            {
              policy_candidate_id: "pi05_droid",
              policy_checkpoint_digest: `sha256:${"c".repeat(64)}`,
            },
          ],
        },
      },
    } as never;

    expect(resolvedCanaryCandidates(result)).toEqual([
      {
        candidate_id: "pi05_droid",
        display_name: "pi05_droid",
        checkpoint_digest: `sha256:${"c".repeat(64)}`,
      },
      {
        candidate_id: "groot_n17_droid",
        display_name: "groot_n17_droid",
        checkpoint_digest: "Unavailable — not delivered",
      },
    ]);
  });
});
