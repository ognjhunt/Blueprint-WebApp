import fs from "node:fs/promises";
import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { parseGsUri } from "./pipeline-dashboard";
import type { PresentationRuntimeState } from "../types/hosted-session";
import type { HostedRuntimeResolution } from "./hosted-session-runtime";

export class PresentationDemoRuntimeError extends Error {
  code: string;
  detail?: string | null;
  statusCode?: number | null;

  constructor(code: string, message: string, options?: { detail?: string | null; statusCode?: number | null }) {
    super(message);
    this.code = code;
    this.detail = options?.detail ?? null;
    this.statusCode = options?.statusCode ?? null;
  }
}

export function resolvePresentationDemoUiBaseUrl(params: {
  sessionId: string;
  siteWorldId: string;
  sceneId: string;
  captureId: string;
  manifest: Record<string, unknown>;
}) {
  const templateValues = {
    sessionId: params.sessionId,
    siteWorldId: params.siteWorldId,
    sceneId: params.sceneId,
    captureId: params.captureId,
  };
  const manifestUrl = String(
    params.manifest.ui_base_url || params.manifest.uiBaseUrl || params.manifest.public_ui_base_url || "",
  ).trim();
  if (manifestUrl) {
    return { url: manifestUrl, source: "manifest" as const };
  }
  const template = String(process.env.BLUEPRINT_PRESENTATION_DEMO_UI_BASE_URL_TEMPLATE || "").trim();
  if (template) {
    return { url: renderTemplate(template, templateValues), source: "template" as const };
  }
  const directUrl = String(process.env.BLUEPRINT_PRESENTATION_DEMO_UI_BASE_URL || "").trim();
  if (directUrl) {
    return { url: directUrl, source: "direct_env" as const };
  }
  return { url: "", source: null };
}

function renderTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, value),
    template,
  );
}

async function readTextFromUri(uri: string): Promise<string> {
  if (uri.startsWith("gs://")) {
    if (!storageAdmin) {
      throw new PresentationDemoRuntimeError(
        "artifact_download_unavailable",
        "Storage is not configured for presentation-demo artifacts.",
      );
    }
    const { bucket, objectPath } = parseGsUri(uri);
    const [buffer] = await storageAdmin.bucket(bucket).file(objectPath).download();
    return buffer.toString("utf-8");
  }
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new PresentationDemoRuntimeError(
        "artifact_download_failed",
        `Failed to fetch presentation-demo artifact: ${response.status}`,
      );
    }
    return response.text();
  }
  return fs.readFile(uri, "utf-8");
}

async function readJsonFromUri(uri?: string | null): Promise<Record<string, unknown>> {
  const normalized = String(uri || "").trim();
  if (!normalized) {
    return {};
  }
  try {
    const payload = JSON.parse(await readTextFromUri(normalized)) as Record<string, unknown>;
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return {};
  }
}

export async function resolvePresentationDemoLaunchConfig(params: {
  sessionId: string;
  runtime: HostedRuntimeResolution;
}) {
  const manifest = await readJsonFromUri(params.runtime.runtimeDemoManifestUri);
  const uiResolution = resolvePresentationDemoUiBaseUrl({
    sessionId: params.sessionId,
    siteWorldId: params.runtime.siteWorldId,
    sceneId: params.runtime.scene_id,
    captureId: params.runtime.capture_id,
    manifest,
  });
  const instanceId =
    String(manifest.instance_id || manifest.instanceId || "").trim() ||
    `vast-${params.runtime.siteWorldId}-${params.sessionId.slice(0, 8)}`;

  return {
    manifest,
    uiBaseUrl: uiResolution.url,
    uiBaseUrlSource: uiResolution.source,
    instanceId,
    expiresAt: resolveExpiresAt(manifest),
  };
}

function resolveExpiresAt(manifest: Record<string, unknown>) {
  const explicit = String(manifest.expires_at || manifest.expiresAt || "").trim();
  if (explicit) {
    return explicit;
  }
  const ttlSeconds = Math.max(300, Number(process.env.BLUEPRINT_PRESENTATION_DEMO_TTL_SECONDS || 7200));
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

export async function launchPresentationDemoRuntime(params: {
  sessionId: string;
  runtime: HostedRuntimeResolution;
  proxyPath: string;
}) {
  const { uiBaseUrl, instanceId, expiresAt } = await resolvePresentationDemoLaunchConfig({
    sessionId: params.sessionId,
    runtime: params.runtime,
  });
  if (!uiBaseUrl) {
    throw new PresentationDemoRuntimeError(
      "presentation_ui_unconfigured",
      "Presentation demo UI base URL is not configured.",
    );
  }

  const startupDelayMs = Math.max(0, Number(process.env.BLUEPRINT_PRESENTATION_DEMO_STARTUP_DELAY_MS || 0));
  if (startupDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, startupDelayMs));
  }

  const startedAt = new Date().toISOString();

  const state: PresentationRuntimeState = {
    provider: "vast",
    status: "live",
    uiBaseUrl,
    proxyPath: params.proxyPath,
    instanceId,
    startedAt,
    expiresAt,
    errorCode: null,
    errorMessage: null,
  };

  return state;
}

export async function stopPresentationDemoRuntime(params: {
  sessionId: string;
  presentationRuntime?: PresentationRuntimeState | null;
}) {
  const stopTemplate = String(process.env.BLUEPRINT_PRESENTATION_DEMO_STOP_URL_TEMPLATE || "").trim();
  if (stopTemplate) {
    const stopUrl = renderTemplate(stopTemplate, {
      sessionId: params.sessionId,
      instanceId: String(params.presentationRuntime?.instanceId || ""),
    });
    await fetch(stopUrl, { method: "POST" }).catch(() => null);
  }

  return {
    provider: "vast" as const,
    status: "stopped" as const,
    uiBaseUrl: params.presentationRuntime?.uiBaseUrl || null,
    proxyPath: params.presentationRuntime?.proxyPath || null,
    instanceId: params.presentationRuntime?.instanceId || null,
    startedAt: params.presentationRuntime?.startedAt || null,
    expiresAt: params.presentationRuntime?.expiresAt || null,
    errorCode: null,
    errorMessage: null,
  };
}
