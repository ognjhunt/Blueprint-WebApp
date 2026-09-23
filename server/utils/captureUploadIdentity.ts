/**
 * The immutable upload identity a capture registration binds to.
 *
 * One validator for every path that records it: the native registration at
 * `POST /v1/creator/captures` and the website capture-link bundle completion.
 * Both must produce the same shape — `sha256:`-prefixed digests, a `gs://`
 * manifest URI inside the capture bucket, and
 * `verification_status: pending_pipeline_storage_readback` until Pipeline
 * reads the bytes back — because the storage readback and the scene-intake
 * binding compare against exactly these fields.
 */

const SHA256_DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

function optionalTrimmedString(value: unknown, maxLength = 400): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export interface ImmutableUploadIdentity {
  raw_bundle_digest: string;
  raw_manifest_uri: string;
  upload_completion_digest: string;
  verification_status: "pending_pipeline_storage_readback";
}

export function captureUploadIdentity(
  body: Record<string, unknown>,
  options: { bucket?: string } = {},
): { value: ImmutableUploadIdentity | null; error: string | null } {
  const rawBundleDigest = optionalTrimmedString(body.raw_bundle_digest, 80);
  const rawManifestUri = optionalTrimmedString(body.raw_manifest_uri, 800);
  const completionDigest = optionalTrimmedString(body.upload_completion_digest, 80);
  const supplied = [rawBundleDigest, rawManifestUri, completionDigest].filter(Boolean).length;
  if (supplied === 0) {
    return { value: null, error: null };
  }
  const bucket = String(
    options.bucket
      || process.env.BLUEPRINT_CAPTURE_STORAGE_BUCKET
      || "blueprint-8c1ca.appspot.com",
  ).trim();
  if (
    supplied !== 3
    || !SHA256_DIGEST_RE.test(rawBundleDigest || "")
    || !SHA256_DIGEST_RE.test(completionDigest || "")
    || !rawManifestUri?.startsWith(`gs://${bucket}/`)
    || !rawManifestUri.endsWith("/manifest.json")
    || rawManifestUri.includes("..")
  ) {
    return { value: null, error: "invalid_immutable_upload_identity" };
  }
  return {
    value: {
      raw_bundle_digest: rawBundleDigest!,
      raw_manifest_uri: rawManifestUri,
      upload_completion_digest: completionDigest!,
      verification_status: "pending_pipeline_storage_readback",
    },
    error: null,
  };
}
