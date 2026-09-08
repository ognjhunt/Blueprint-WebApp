import type { User as FirebaseUser } from "firebase/auth";
import { buildCanaryArtifactInventory, normalizedArtifact } from "./policyCanaryResultPortal";
import type { TaskEvaluationResultArtifact, TaskEvaluationResultSiteRecord } from "./taskEvaluationResults";

export const MAX_CANARY_EVIDENCE_MANIFEST_BYTES = 8_000_000;
export const MAX_CANARY_MANIFEST_ARTIFACTS = 25_000;

export function canaryEvidenceManifestArtifact(result: TaskEvaluationResultSiteRecord) {
  const publication = result.publication;
  return normalizedArtifact(publication.policy_canary_result?.report?.evidence_manifest
    || publication.policy_canary_result?.reproducibility?.evidence_manifest
    || publication.result_delivery?.reproducibility?.evidence_manifest
    || buildCanaryArtifactInventory(result).find((artifact) => artifact.role === "evidence_manifest"));
}

export function mergeVerifiedCanaryManifest(
  result: TaskEvaluationResultSiteRecord,
  manifest: Record<string, unknown>,
): TaskEvaluationResultArtifact[] {
  const expectedResultDigest = result.publication.policy_canary_result?.report?.result_digest;
  if (manifest.schema_version !== "task_evaluation_policy_canary_evidence_manifest.v1"
    || manifest.run_id !== result.publication.run_id
    || (expectedResultDigest && manifest.result_digest !== expectedResultDigest)
    || !Array.isArray(manifest.artifacts) || manifest.artifacts.length > MAX_CANARY_MANIFEST_ARTIFACTS) {
    throw new Error("The full evidence manifest does not match this run");
  }
  const artifacts = new Map(buildCanaryArtifactInventory(result).map((artifact) => [artifact.artifact_id, artifact]));
  for (const value of manifest.artifacts) {
    const artifact = normalizedArtifact(value);
    if (!artifact || (artifact.digest && artifact.digest !== artifact.sha256) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(artifact.artifact_id)
      || !/^sha256:[0-9a-f]{64}$/.test(artifact.sha256)
      || !Number.isSafeInteger(artifact.size_bytes) || artifact.size_bytes < 0) {
      throw new Error("The full evidence manifest contains an invalid descriptor");
    }
    const prior = artifacts.get(artifact.artifact_id);
    if (prior && (prior.sha256 !== artifact.sha256 || prior.size_bytes !== artifact.size_bytes)) {
      throw new Error("The full evidence manifest conflicts with the published artifact binding");
    }
    artifacts.set(artifact.artifact_id, artifact);
  }
  return [...artifacts.values()].sort((left, right) => left.role.localeCompare(right.role) || left.artifact_id.localeCompare(right.artifact_id));
}

export async function loadCanaryEvidenceManifest(
  result: TaskEvaluationResultSiteRecord,
  user: FirebaseUser | null,
  signal?: AbortSignal,
) {
  const artifact = canaryEvidenceManifestArtifact(result);
  if (!artifact) throw new Error("No full evidence manifest was delivered");
  const { fetchVerifiedResultArtifactJson } = await import("./verifiedResultArtifactJson");
  const manifest = await fetchVerifiedResultArtifactJson(user, result.record_id, artifact,
    { signal, maximumBytes: MAX_CANARY_EVIDENCE_MANIFEST_BYTES });
  return mergeVerifiedCanaryManifest(result, manifest);
}
