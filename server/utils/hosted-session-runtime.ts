import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import type { DeploymentReadinessSummary, PipelineAttachment, QualificationState } from "../types/inbound-request";
import type {
  RobotProfile,
  RuntimeManifestSummary,
  ScenarioCatalogEntry,
  StartStateCatalogEntry,
  TaskCatalogEntry,
} from "../types/hosted-session";
import { getPublicSiteWorldById } from "./site-worlds";
import { parseGsUri } from "./pipeline-dashboard";

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
  defaultRuntimeBackend: string;
  availableRuntimeBackends: string[];
  availableScenarioVariants: string[];
  availableStartStates: string[];
  runtimeManifest: RuntimeManifestSummary;
  taskCatalog: TaskCatalogEntry[];
  scenarioCatalog: ScenarioCatalogEntry[];
  startStateCatalog: StartStateCatalogEntry[];
  robotProfiles: RobotProfile[];
  exportModes: string[];
  siteWorldSpecUri: string;
  siteWorldRegistrationUri: string;
  siteWorldHealthUri: string;
  runtimeBaseUrl?: string | null;
  websocketBaseUrl?: string | null;
  sceneMemoryManifestUri: string;
  conditioningBundleUri: string;
  presentationWorldManifestUri?: string | null;
  runtimeDemoManifestUri?: string | null;
  presentationDemoBlockers: string[];
  priceLabel?: string | null;
  qualificationState?: QualificationState | null;
  deploymentReadiness?: DeploymentReadinessSummary | null;
  readinessDecisionUri?: string | null;
  humanActionsRequiredUri?: string | null;
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

export async function readHostedRuntimeArtifactJson(uri?: string | null): Promise<Record<string, unknown> | null> {
  const normalized = String(uri || "").trim();
  if (!normalized) {
    return null;
  }

  try {
    if (normalized.startsWith("gs://")) {
      if (!storageAdmin) {
        return null;
      }
      const { bucket, objectPath } = parseGsUri(normalized);
      const [buffer] = await storageAdmin.bucket(bucket).file(objectPath).download();
      const payload = JSON.parse(buffer.toString("utf-8")) as Record<string, unknown>;
      return payload && typeof payload === "object" ? payload : null;
    }

    const fs = await import("node:fs/promises");
    const text = await fs.readFile(normalized, "utf-8");
    const payload = JSON.parse(text) as Record<string, unknown>;
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

export async function resolveHostedRuntime(siteWorldId: string): Promise<HostedRuntimeResolution> {
  const site = await getPublicSiteWorldById(siteWorldId);
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

  const siteWorldSpecUri = artifactUri(
    pipelinePrefix,
    artifacts.site_world_spec_uri,
    "evaluation_prep/site_world_spec.json",
  );
  const siteWorldRegistrationUri = artifactUri(
    pipelinePrefix,
    artifacts.site_world_registration_uri,
    "evaluation_prep/site_world_registration.json",
  );
  const siteWorldHealthUri = artifactUri(
    pipelinePrefix,
    artifacts.site_world_health_uri,
    "evaluation_prep/site_world_health.json",
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
  const presentationWorldManifestUri = String(
    artifacts.presentation_world_manifest_uri || artifacts.preview_simulation_manifest_uri || "",
  ).trim() || null;
  const presentationDemoBlockers: string[] = [];
  if (!presentationWorldManifestUri) {
    presentationDemoBlockers.push("missing presentation package");
  }
  if (!(site.runtimeManifest?.launchable ?? true)) {
    presentationDemoBlockers.push("site not launchable yet");
  }

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
  if (!siteWorldSpecUri) {
    throw new HostedSessionRuntimeError(
      "missing_site_world_spec",
      "This site is missing the site-world spec required for hosted sessions.",
    );
  }
  if (!siteWorldRegistrationUri) {
    throw new HostedSessionRuntimeError(
      "missing_site_world_registration",
      "This site is missing the site-world registration required for hosted sessions.",
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
    defaultRuntimeBackend: site.defaultRuntimeBackend,
    availableRuntimeBackends: site.availableRuntimeBackends,
    availableScenarioVariants: site.scenarioVariants,
    availableStartStates: site.startStates,
    runtimeManifest: site.runtimeManifest || {
      defaultBackend: site.defaultRuntimeBackend,
      runtimeBaseUrl: null,
      websocketBaseUrl: null,
      supportedCameras: site.robotProfiles.flatMap((profile) => profile.observationCameras.map((camera) => camera.id)),
      launchableBackends: site.availableRuntimeBackends,
      exportModes: site.exportModes,
      supportsStepRollout: true,
      supportsBatchRollout: true,
      supportsCameraViews: true,
      supportsStream: true,
      healthStatus: "unknown",
      launchable: true,
    },
    taskCatalog: site.taskCatalog,
    scenarioCatalog: site.scenarioCatalog,
    startStateCatalog: site.startStateCatalog,
    robotProfiles: site.robotProfiles,
    exportModes: site.exportModes,
    siteWorldSpecUri,
    siteWorldRegistrationUri,
    siteWorldHealthUri,
    runtimeBaseUrl: site.runtimeManifest?.runtimeBaseUrl ?? null,
    websocketBaseUrl: site.runtimeManifest?.websocketBaseUrl ?? null,
    sceneMemoryManifestUri,
    conditioningBundleUri,
    presentationWorldManifestUri,
    runtimeDemoManifestUri: presentationWorldManifestUri,
    presentationDemoBlockers,
    priceLabel: site.packages[1]?.priceLabel ?? null,
    qualificationState:
      String(inbound?.data?.qualification_state || site.deploymentReadiness?.qualification_state || "").trim() || null,
    deploymentReadiness:
      (inbound?.data?.deployment_readiness as DeploymentReadinessSummary | undefined) || site.deploymentReadiness || null,
    readinessDecisionUri: String(artifacts.readiness_decision_uri || "").trim() || null,
    humanActionsRequiredUri: String(artifacts.human_actions_required_uri || "").trim() || null,
  };
}
