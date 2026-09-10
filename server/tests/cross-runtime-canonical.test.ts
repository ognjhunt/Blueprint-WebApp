// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  crossRuntimeArtifactDigest,
  crossRuntimeCanonicalJson,
  crossRuntimeDigest,
} from "../utils/crossRuntimeCanonical";
import { parsePipelinePolicyCanaryPublication } from "../utils/policyCanaryWebappSyncContract";
import { canonicalArtifactDigest, stableJson } from "../utils/taskCandidateContract";
import { parseVerifiedTaskEvaluationRunPublication } from "../utils/taskEvaluationRunContract";
import {
  decodeTaskEvaluationRunPublication,
  encodeTaskEvaluationRunPublication,
  publicationFromResultRecord,
} from "../utils/taskEvaluationRunPublicationStorage";
import publicationFixture from "./fixtures/pipeline-policy-canary-mixed-case-publication.v4.json";

const failures = { PolicyEpisodeError: 1, cell_not_completed_before_terminal_failure: 9 };

describe("Pipeline cross-runtime canonical artifacts", () => {
  // Golden digests and the publication fixture were sealed with Python rfc8785,
  // the producer used by Pipeline, rather than the TypeScript implementation.
  it("matches Python for nested mixed-case labels and ECMAScript numbers", () => {
    const value = { candidate_results: [{ failure_counts: failures }, { failure_counts: failures }] };
    expect(crossRuntimeDigest(value)).toBe("sha256:c1735fb68c2c1626df1f058ca8751bb83c40a46016ed54cb591fadcddf636826");
    expect(crossRuntimeArtifactDigest({ ...value, projection_digest: "excluded" }, "projection_digest"))
      .toBe(crossRuntimeDigest(value));
    expect(crossRuntimeDigest({ numbers: [1.0, -0.0, 1e-7, 1e-6, 0.125, Number.MAX_SAFE_INTEGER] }))
      .toBe("sha256:75c04096ae54ccffb5c631715e3d8a19f7e7d6d542281d34903543bbc2fc0825");
    expect(crossRuntimeCanonicalJson(failures))
      .toBe('{"PolicyEpisodeError":1,"cell_not_completed_before_terminal_failure":9}');
  });

  it("accepts the original Python-sealed delivery and projection without changing their labels or digests", () => {
    const original = structuredClone(publicationFixture);
    expect(parsePipelinePolicyCanaryPublication(original)).toEqual({ ok: true, publication: original });
    expect(parseVerifiedTaskEvaluationRunPublication(original)).toEqual({ ok: true, publication: original });
    expect(original).toEqual(publicationFixture);
    for (const candidate of original.policy_canary_result.candidate_results) {
      expect(candidate.failure_counts).toEqual(failures);
    }
  });

  it("rejects tampering and a locale-sorted replacement digest on either Pipeline-owned artifact", () => {
    for (const [key, field, blocker] of [
      ["result_delivery", "delivery_digest", "policy_canary_delivery_digest_mismatch"],
      ["policy_canary_result", "projection_digest", "policy_canary_projection_digest_mismatch"],
    ] as const) {
      const value = structuredClone(publicationFixture);
      value[key][field] = canonicalArtifactDigest(value[key], field);
      expect(value[key][field]).not.toBe(publicationFixture[key][field]);
      expect(parsePipelinePolicyCanaryPublication(value)).toMatchObject({
        ok: false, blockers: expect.arrayContaining([blocker]),
      });
    }
    const changedLabel = structuredClone(publicationFixture);
    const candidate = changedLabel.policy_canary_result.candidate_results[0];
    candidate.failure_counts.PolicyEpisodeError += 1;
    expect(parsePipelinePolicyCanaryPublication(changedLabel)).toMatchObject({
      ok: false, blockers: ["policy_canary_projection_digest_mismatch"],
    });
  });

  it.each([Number.MAX_SAFE_INTEGER + 1, Number.POSITIVE_INFINITY, Number.NaN, undefined])(
    "returns a typed digest refusal for unsupported JSON data (%s)",
    (number) => {
      const value = structuredClone(publicationFixture);
      Object.assign(value.policy_canary_result.candidate_results[0].metrics, { unsupported_value: number });
      expect(parsePipelinePolicyCanaryPublication(value)).toMatchObject({
        ok: false, blockers: ["policy_canary_projection_digest_mismatch"],
      });
    },
  );

  it("retains the producer digest through compressed persistence and the stored-result reader", () => {
    const storage = encodeTaskEvaluationRunPublication(publicationFixture);
    const publication = publicationFromResultRecord({ publication_storage: storage });
    expect(publication).toEqual(publicationFixture);
    expect(parseVerifiedTaskEvaluationRunPublication(publication))
      .toEqual({ ok: true, publication: publicationFixture });
    expect(publicationFromResultRecord({ publication: publicationFixture })).toEqual(publicationFixture);
  });
});

describe("Website-owned persisted hash compatibility", () => {
  it("preserves mixed-case legacy artifact digests and serialized publication bytes", () => {
    const value = { failure_counts: failures };
    const legacyDigest = "sha256:a769950387ac813de4abab330f4a354079559239a495afcfad5b4043d6581b57";
    expect(stableJson(value)).toBe('{"failure_counts":{"cell_not_completed_before_terminal_failure":9,"PolicyEpisodeError":1}}');
    expect(canonicalArtifactDigest({ ...value, digest: legacyDigest }, "digest")).toBe(legacyDigest);
    expect(crossRuntimeDigest(value)).toBe("sha256:e6a33c32760c905657f6a894739811111a0a2b11916dce95a0f11cdde60efb5a");
    const storage = encodeTaskEvaluationRunPublication(value);
    expect(storage.payload_sha256).toBe(legacyDigest);
    const historicalStorage = {
      schema_version: "task_evaluation_run_publication_gzip.v1",
      encoding: "gzip+base64",
      payload_sha256: legacyDigest,
      uncompressed_size_bytes: 90,
      compressed_size_bytes: 99,
      payload_base64: "H4sIAAAAAAACEy3LMQrAIAwAwL9k7tKx7u79QbAxghCNRB2K+Pcuvf0WpJBlGiPprKODW0AsglUHkpYmPDjiw0mNcbCVXIPgn8BdB9wqmV7fctfI3kwN3Ln3BzFXTTJaAAAA",
    };
    expect(decodeTaskEvaluationRunPublication(historicalStorage)).toEqual(value);
  });
});
