import type { HostedSessionRecord } from "../types/hosted-session";
import { parseGsUri } from "./pipeline-dashboard";
import { readHostedRuntimeArtifactJson } from "./hosted-session-runtime";

/**
 * Resolution of authoritative published artifact URIs for a hosted session.
 *
 * Presentation-demo sessions render canonical frames straight from published
 * GCS artifacts. These helpers pick the published bucket, rewrite the
 * local-dev `gs://local-blueprint/...` placeholder onto it, and walk a site
 * world's canonical health payload to find the frame asset for a camera.
 */

export function preferredPublishedArtifactBucket(session: HostedSessionRecord) {
  const candidates = [
    session.siteModel?.siteWorldHealthUri,
    session.siteModel?.siteWorldSpecUri,
    session.launchContext.site_world_health_uri,
    session.launchContext.site_world_spec_uri,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value.startsWith("gs://")) {
      continue;
    }
    const { bucket } = parseGsUri(value);
    if (bucket && bucket !== "local-blueprint") {
      return bucket;
    }
  }
  return null;
}

export function normalizePublishedArtifactUri(uri: string, session: HostedSessionRecord) {
  const normalized = String(uri || "").trim();
  if (!normalized.startsWith("gs://local-blueprint/")) {
    return normalized;
  }
  const publishedBucket = preferredPublishedArtifactBucket(session);
  if (!publishedBucket) {
    return normalized;
  }
  const { objectPath } = parseGsUri(normalized);
  return `gs://${publishedBucket}/${objectPath}`;
}

export async function authoritativeFrameArtifactUriForSession(session: HostedSessionRecord, cameraId: string) {
  const healthPayload =
    (await readHostedRuntimeArtifactJson(session.siteModel?.siteWorldHealthUri || session.launchContext.site_world_health_uri)) || {};
  const canonicalWorldModel =
    healthPayload.canonical_world_model && typeof healthPayload.canonical_world_model === "object"
      ? (healthPayload.canonical_world_model as Record<string, unknown>)
      : {};
  const supportingAssets = Array.isArray(canonicalWorldModel.supporting_assets)
    ? (canonicalWorldModel.supporting_assets as Array<Record<string, unknown>>)
    : [];
  const expectedName = `${cameraId}-frame0.png`;
  const supportingMatch = supportingAssets.find((asset) => String(asset?.name || "").trim() === expectedName);
  const supportingUri = String(supportingMatch?.uri || "").trim();
  if (supportingUri) {
    return normalizePublishedArtifactUri(supportingUri, session);
  }
  const primaryAssetUri = String(canonicalWorldModel.primary_asset_uri || "").trim();
  if (!primaryAssetUri.startsWith("gs://")) {
    return null;
  }
  if (!primaryAssetUri.endsWith(".mp4")) {
    return normalizePublishedArtifactUri(primaryAssetUri, session);
  }
  return normalizePublishedArtifactUri(primaryAssetUri.replace(/\.mp4$/i, "-frame0.png"), session);
}
