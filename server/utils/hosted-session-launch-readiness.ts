import type {
  HostedRuntimeSessionConfig,
  HostedSessionLaunchBlockerDetail,
  HostedSessionRecord,
  PresentationDemoReadinessStatus,
  PresentationLaunchState,
} from "../types/hosted-session";
import {
  readHostedRuntimeArtifactJson,
  type HostedRuntimeResolution,
} from "./hosted-session-runtime";
import { resolvePresentationDemoLaunchConfig } from "./presentation-demo-runtime";

export interface ModeLaunchReadiness {
  status: PresentationDemoReadinessStatus | "runtime_live_ready" | "runtime_live_unavailable";
  launchable: boolean;
  blockers: string[];
  blocker_details: HostedSessionLaunchBlockerDetail[];
  presentationWorldManifestUri?: string | null;
  runtimeDemoManifestUri?: string | null;
  uiBaseUrl?: string | null;
}

export interface HostedSessionLaunchReadiness {
  entitled: boolean;
  status: ModeLaunchReadiness["status"];
  launchable: boolean;
  blockers: string[];
  blocker_details: HostedSessionLaunchBlockerDetail[];
  presentationWorldManifestUri?: string | null;
  runtimeDemoManifestUri?: string | null;
  presentation_demo: ModeLaunchReadiness;
  runtime_only: ModeLaunchReadiness;
}

function addBlocker(details: HostedSessionLaunchBlockerDetail[], blocker: HostedSessionLaunchBlockerDetail) {
  if (!details.some((item) => item.code === blocker.code && item.message === blocker.message && item.source === blocker.source)) {
    details.push(blocker);
  }
}

function stringsFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => {
      if (typeof item === "string") {
        return [item.trim()];
      }
      if (item && typeof item === "object") {
        const payload = item as Record<string, unknown>;
        return [String(payload.message || payload.reason || payload.category || payload.code || "").trim()];
      }
      return [];
    })
    .filter(Boolean);
}

function qualificationStateMessage(state: string) {
  switch (state) {
    case "not_ready_yet":
      return "This site is currently marked not ready yet for launch.";
    case "needs_more_evidence":
      return "This site needs more evidence before launch.";
    case "submitted":
      return "This site has not completed qualification yet.";
    case "capture_requested":
      return "This site is still waiting on capture completion.";
    case "qa_passed":
      return "This site passed QA but has not completed qualification.";
    case "in_review":
      return "This site is still under qualification review.";
    case "needs_refresh":
      return "This site needs a refresh before launch.";
    default:
      return `This site is in qualification state ${state.replaceAll("_", " ")}.`;
  }
}

function extractArtifactBlockers(
  payload: Record<string, unknown> | null,
  source: HostedSessionLaunchBlockerDetail["source"],
  prefix: string,
) {
  const details: HostedSessionLaunchBlockerDetail[] = [];
  if (!payload) {
    return details;
  }

  const categories = [
    ...stringsFromUnknown(payload.blocker_categories),
    ...stringsFromUnknown(payload.blockerCategories),
  ];
  categories.forEach((category, index) => {
    addBlocker(details, {
      code: `${prefix}_category_${index + 1}`,
      message: `${prefix.replaceAll("_", " ")} blocker: ${category}`,
      source,
    });
  });

  const messages = [
    ...stringsFromUnknown(payload.blockers),
    ...stringsFromUnknown(payload.reasons),
    ...stringsFromUnknown(payload.actions),
    ...stringsFromUnknown(payload.required_actions),
    ...stringsFromUnknown(payload.pending_actions),
  ];
  messages.forEach((message, index) => {
    addBlocker(details, {
      code: `${prefix}_${index + 1}`,
      message,
      source,
    });
  });

  return details;
}

export function buildPresentationLaunchState(params: {
  presentationRuntime?: HostedSessionRecord["presentationRuntime"];
  readiness?: ModeLaunchReadiness | null;
  runtime?: HostedRuntimeResolution;
}): PresentationLaunchState {
  const blockers = params.readiness?.blockers || [];
  const blockerDetails = params.readiness?.blocker_details || [];
  const liveViewer = params.presentationRuntime?.status === "live" && params.presentationRuntime?.uiBaseUrl;
  return {
    status: liveViewer ? "live_viewer" : blockerDetails.length > 0 ? "blocked" : "artifact_backed",
    mode:
      params.readiness?.status === "runtime_live_ready" || params.readiness?.status === "runtime_live_unavailable"
        ? undefined
        : params.readiness?.status,
    blockers,
    blockerDetails,
    presentationWorldManifestUri:
      params.runtime?.presentationWorldManifestUri ?? params.readiness?.presentationWorldManifestUri ?? null,
    runtimeDemoManifestUri:
      params.runtime?.runtimeDemoManifestUri ?? params.readiness?.runtimeDemoManifestUri ?? null,
    uiBaseUrl: liveViewer ? params.presentationRuntime?.uiBaseUrl || null : params.readiness?.uiBaseUrl || null,
  };
}

async function buildQualificationBlockers(
  runtime: HostedRuntimeResolution,
): Promise<HostedSessionLaunchBlockerDetail[]> {
  void runtime;
  void qualificationStateMessage;
  void extractArtifactBlockers;
  return [];
}

export async function buildPresentationDemoReadiness(params: {
  runtime: HostedRuntimeResolution;
  accessBlockers: string[];
}): Promise<ModeLaunchReadiness> {
  const details = await buildQualificationBlockers(params.runtime);
  params.accessBlockers.forEach((message, index) =>
    addBlocker(details, { code: `access_${index + 1}`, message, source: "access" }),
  );

  const [presentationWorldManifest, runtimeDemoManifest] = await Promise.all([
    readHostedRuntimeArtifactJson(params.runtime.presentationWorldManifestUri),
    readHostedRuntimeArtifactJson(params.runtime.runtimeDemoManifestUri),
  ]);
  const presentationManifestRegistered =
    params.runtime.presentationWorldManifestDeclared === true
      ? true
      : Boolean(params.runtime.presentationWorldManifestUri && presentationWorldManifest);
  const runtimeDemoManifestRegistered =
    params.runtime.runtimeDemoManifestDeclared === true
      ? true
      : Boolean(params.runtime.runtimeDemoManifestUri && runtimeDemoManifest);

  if (!presentationManifestRegistered) {
    addBlocker(details, {
      code: "missing_presentation_package",
      message: "This site is missing the presentation package required for embedded demos.",
      source: "presentation_demo",
    });
  }
  if (!runtimeDemoManifestRegistered) {
    addBlocker(details, {
      code: "missing_runtime_demo_manifest",
      message: "This site is missing the runtime demo manifest required for live presentation launch.",
      source: "presentation_demo",
    });
  }
  if (presentationManifestRegistered && !presentationWorldManifest) {
    addBlocker(details, {
      code: "presentation_manifest_unreadable",
      message: "Presentation artifacts are registered but could not be resolved on this host.",
      source: "presentation_demo",
    });
  }
  if (runtimeDemoManifestRegistered && !runtimeDemoManifest) {
    addBlocker(details, {
      code: "runtime_demo_manifest_unreadable",
      message: "Runtime demo artifacts are registered but could not be resolved on this host.",
      source: "presentation_demo",
    });
  }

  const config = await resolvePresentationDemoLaunchConfig({
    sessionId: "readiness-check",
    runtime: params.runtime,
  }).catch(() => null);

  const status =
    !presentationManifestRegistered || !runtimeDemoManifestRegistered
      ? "presentation_assets_missing"
      : config?.uiBaseUrl
        ? "presentation_ui_live"
        : "presentation_ui_unconfigured";

  return {
    status,
    launchable:
      (status === "presentation_ui_live" || status === "presentation_ui_unconfigured") &&
      details.length === 0,
    blockers: details.map((item) => item.message),
    blocker_details: details,
    presentationWorldManifestUri: params.runtime.presentationWorldManifestUri ?? null,
    runtimeDemoManifestUri: params.runtime.runtimeDemoManifestUri ?? null,
    uiBaseUrl: config?.uiBaseUrl || null,
  };
}

async function buildRuntimeOnlyReadiness(params: {
  runtime: HostedRuntimeResolution;
  accessBlockers: string[];
  runtimeSessionConfig?: HostedRuntimeSessionConfig | null;
}): Promise<ModeLaunchReadiness> {
  const details = await buildQualificationBlockers(params.runtime);
  params.accessBlockers.forEach((message, index) =>
    addBlocker(details, { code: `access_${index + 1}`, message, source: "access" }),
  );

  const [siteWorldSpec, siteWorldRegistration, siteWorldHealth] = await Promise.all([
    readHostedRuntimeArtifactJson(params.runtime.siteWorldSpecUri),
    readHostedRuntimeArtifactJson(params.runtime.siteWorldRegistrationUri),
    readHostedRuntimeArtifactJson(params.runtime.siteWorldHealthUri),
  ]);

  if (!siteWorldSpec && !params.runtime.allowBlockedSiteWorld) {
    addBlocker(details, {
      code: "missing_runtime_site_world_spec",
      message: "This site is missing the site-world spec required for hosted runtime launch.",
      source: "runtime",
    });
  }
  if (!siteWorldRegistration && !params.runtime.allowBlockedSiteWorld) {
    addBlocker(details, {
      code: "missing_runtime_registration",
      message: "This site is missing the site-world registration required for hosted runtime launch.",
      source: "runtime",
    });
  }
  if (!siteWorldHealth && !params.runtime.allowBlockedSiteWorld) {
    addBlocker(details, {
      code: "missing_runtime_health",
      message: "This site is missing the site-world health record required for hosted runtime launch.",
      source: "runtime",
    });
  }

  const siteWorldId = String(
    params.runtime.siteWorldId || siteWorldRegistration?.site_world_id || "",
  ).trim();
  const runtimeBaseUrl = String(params.runtime.runtimeBaseUrl || siteWorldRegistration?.runtime_base_url || "").trim();
  if (siteWorldRegistration && (!siteWorldId || !runtimeBaseUrl)) {
    addBlocker(details, {
      code: "runtime_handle_missing",
      message: "The site-world registration does not include a live runtime handle yet.",
      source: "runtime",
    });
  }

  if (runtimeBaseUrl && siteWorldId && !params.runtime.runtimeSiteWorldRecord) {
    addBlocker(details, {
      code: "runtime_probe_failed",
      message: "The hosted runtime handle is registered, but the runtime did not answer the site-world readiness probe.",
      source: "runtime",
    });
  }

  if (
    (params.runtime.runtimeHealthRecord?.launchable === false || siteWorldHealth?.launchable === false) &&
    params.runtime.allowBlockedSiteWorld !== true &&
    params.runtimeSessionConfig?.unsafe_allow_blocked_site_world !== true
  ) {
    const liveBlockers = stringsFromUnknown(params.runtime.runtimeHealthRecord?.blockers);
    const artifactBlockers = stringsFromUnknown(siteWorldHealth?.blockers);
    addBlocker(details, {
      code: "runtime_unlaunchable",
      message:
        `The site-world runtime is not launchable: ${liveBlockers.join(", ") || artifactBlockers.join(", ") || "blocked"}`,
      source: "runtime",
    });
  }

  return {
    status: details.length === 0 ? "runtime_live_ready" : "runtime_live_unavailable",
    launchable: details.length === 0,
    blockers: details.map((item) => item.message),
    blocker_details: details,
    presentationWorldManifestUri: params.runtime.presentationWorldManifestUri ?? null,
    runtimeDemoManifestUri: params.runtime.runtimeDemoManifestUri ?? null,
  };
}

export async function buildLaunchReadiness(params: {
  runtime: HostedRuntimeResolution;
  entitled: boolean;
  accessBlockers: string[];
  runtimeSessionConfig?: HostedRuntimeSessionConfig | null;
}): Promise<HostedSessionLaunchReadiness> {
  const [presentationDemo, runtimeOnly] = await Promise.all([
    buildPresentationDemoReadiness({
      runtime: params.runtime,
      accessBlockers: params.accessBlockers,
    }),
    buildRuntimeOnlyReadiness({
      runtime: params.runtime,
      accessBlockers: params.accessBlockers,
      runtimeSessionConfig: params.runtimeSessionConfig,
    }),
  ]);

  return {
    entitled: params.entitled,
    status: presentationDemo.status,
    launchable: presentationDemo.launchable,
    blockers: presentationDemo.blockers,
    blocker_details: presentationDemo.blocker_details,
    presentationWorldManifestUri: presentationDemo.presentationWorldManifestUri ?? null,
    runtimeDemoManifestUri: presentationDemo.runtimeDemoManifestUri ?? null,
    presentation_demo: presentationDemo,
    runtime_only: runtimeOnly,
  };
}
