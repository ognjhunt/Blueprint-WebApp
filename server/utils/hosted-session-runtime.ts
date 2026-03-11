import { getSiteWorldById } from "../../client/src/data/siteWorlds";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { PipelineAttachment } from "../types/inbound-request";

export class HostedSessionRuntimeError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface HostedRuntimeResolution {
  siteWorldId: string;
  siteName: string;
  siteAddress: string;
  scene_id: string;
  capture_id: string;
  site_submission_id: string;
  pipeline_prefix: string;
  runtimeManifestUri: string;
  sceneMemoryManifestUri: string;
  conditioningBundleUri: string;
  previewSimulationManifestUri?: string | null;
  taskAnchorManifestUri: string;
  taskRunManifestUri: string;
  priceLabel?: string | null;
}

async function resolveInboundRequestBySiteSubmissionId(siteSubmissionId: string) {
  if (!db) {
    return null;
  }

  const snapshot = await db
    .collection("inboundRequests")
    .where("site_submission_id", "==", siteSubmissionId)
    .limit(1)
    .get();

  const matched = snapshot.docs[0];
  if (!matched) {
    return null;
  }

  return {
    id: matched.ref.id,
    data: matched.data() as Record<string, unknown>,
  };
}

function artifactUri(
  pipelinePrefix: string,
  explicitValue: unknown,
  fallbackRelative: string,
): string {
  const explicit = String(explicitValue || "").trim();
  if (explicit) {
    return explicit;
  }
  const bucket = process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com";
  return `gs://${bucket}/${pipelinePrefix}/${fallbackRelative}`;
}

export async function resolveHostedRuntime(siteWorldId: string): Promise<HostedRuntimeResolution> {
  const site = getSiteWorldById(siteWorldId);
  if (!site) {
    throw new HostedSessionRuntimeError("site_not_found", "Site world could not be found.");
  }

  const inbound = await resolveInboundRequestBySiteSubmissionId(site.siteSubmissionId);
  const pipeline = (inbound?.data?.pipeline as PipelineAttachment | undefined) ?? undefined;
  const artifacts = pipeline?.artifacts ?? {};
  const pipelinePrefix = String(pipeline?.pipeline_prefix || site.pipelinePrefix || "").trim();

  if (!pipelinePrefix) {
    throw new HostedSessionRuntimeError(
      "site_not_launchable",
      "This site does not have a pipeline prefix for hosted-session launch.",
    );
  }

  const runtimeManifestUri = artifactUri(
    pipelinePrefix,
    artifacts.hosted_session_runtime_manifest_uri,
    "evaluation_prep/hosted_session_runtime_manifest.json",
  );
  const sceneMemoryManifestUri = artifactUri(
    pipelinePrefix,
    artifacts.scene_memory_manifest_uri,
    "scene_memory/scene_memory_manifest.json",
  );
  const conditioningBundleUri = artifactUri(
    pipelinePrefix,
    artifacts.conditioning_bundle_uri,
    "scene_memory/conditioning_bundle.json",
  );
  const taskAnchorManifestUri = artifactUri(
    pipelinePrefix,
    artifacts.task_anchor_manifest_uri,
    "evaluation_prep/task_anchor_manifest.json",
  );
  const taskRunManifestUri = artifactUri(
    pipelinePrefix,
    artifacts.task_run_manifest_uri,
    "evaluation_prep/task_run_manifest.json",
  );
  const previewSimulationManifestUri = artifactUri(
    pipelinePrefix,
    artifacts.preview_simulation_manifest_uri,
    "preview_simulation/preview_simulation_manifest.json",
  );

  if (!sceneMemoryManifestUri) {
    throw new HostedSessionRuntimeError(
      "missing_scene_memory",
      "This site is missing the scene-memory manifest required for hosted sessions.",
    );
  }
  if (!conditioningBundleUri) {
    throw new HostedSessionRuntimeError(
      "missing_scene_memory",
      "This site is missing the conditioning bundle required for hosted sessions.",
    );
  }
  if (!taskAnchorManifestUri) {
    throw new HostedSessionRuntimeError(
      "missing_task_anchor_manifest",
      "This site is missing the task anchor manifest required for hosted sessions.",
    );
  }
  if (!taskRunManifestUri) {
    throw new HostedSessionRuntimeError(
      "missing_task_anchor_manifest",
      "This site is missing the task run manifest required for hosted sessions.",
    );
  }

  return {
    siteWorldId: site.id,
    siteName: site.siteName,
    siteAddress: site.siteAddress,
    scene_id: site.sceneId,
    capture_id: site.captureId,
    site_submission_id: site.siteSubmissionId,
    pipeline_prefix: pipelinePrefix,
    runtimeManifestUri,
    sceneMemoryManifestUri,
    conditioningBundleUri,
    previewSimulationManifestUri,
    taskAnchorManifestUri,
    taskRunManifestUri,
    priceLabel: site.packages[1]?.priceLabel ?? null,
  };
}
