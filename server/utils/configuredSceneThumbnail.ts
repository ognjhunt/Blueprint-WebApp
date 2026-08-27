import { createHash } from "node:crypto";

import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import type { ConfiguredSceneOffering } from "./configuredSceneOfferingContract";
import { parseGsUri } from "./pipeline-dashboard";
import { resolveTaskEvaluationLaunchUrl } from "./taskEvaluationLaunchContract";
import { signedPipelineHeaders } from "./taskEvaluationResultArtifactProxy";

type ThumbnailReference = ConfiguredSceneOffering["presentation"]["task_thumbnail"];
const MAXIMUM_THUMBNAIL_BYTES = 16 * 1024 * 1024;

function configuredSceneReadbackEndpoint() {
  const launchUrl = resolveTaskEvaluationLaunchUrl();
  if (!/\/(?:task-evaluation-launches|launches)\/?$/.test(launchUrl)) return "";
  return launchUrl.replace(
    /\/(?:task-evaluation-launches|launches)\/?$/,
    "/task-evaluation-configured-scene-artifact-readback",
  );
}

export async function readConfiguredSceneThumbnail(reference: ThumbnailReference) {
  let buffer: Buffer;
  if (reference.uri.startsWith("gs://")) {
    if (!storageAdmin) throw new Error("configured_scene_thumbnail_store_unavailable");
    const { bucket, objectPath } = parseGsUri(reference.uri);
    [buffer] = await storageAdmin.bucket(bucket).file(objectPath).download();
  } else if (reference.uri.startsWith("s3://")) {
    const endpoint = configuredSceneReadbackEndpoint();
    const body = JSON.stringify(reference);
    const signatureHeaders = signedPipelineHeaders(body);
    if (!endpoint || !signatureHeaders) {
      throw new Error("configured_scene_thumbnail_origin_not_configured");
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...signatureHeaders },
      body,
    });
    if (!response.ok) throw new Error("configured_scene_thumbnail_origin_rejected");
    const contentLength = Number(response.headers.get("content-length") || "0");
    if (contentLength > MAXIMUM_THUMBNAIL_BYTES) {
      throw new Error("configured_scene_thumbnail_size_invalid");
    }
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    throw new Error("configured_scene_thumbnail_uri_unsupported");
  }
  const digest = `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
  if (
    buffer.byteLength !== reference.size_bytes
    || buffer.byteLength > MAXIMUM_THUMBNAIL_BYTES
    || digest !== reference.digest
  ) throw new Error("configured_scene_thumbnail_readback_mismatch");
  return buffer;
}
