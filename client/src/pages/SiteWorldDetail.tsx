import { useEffect, useMemo, useState } from "react";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import { ProofModule } from "@/components/site/ProofModule";
import { getSiteWorldById, siteWorldCards } from "@/data/siteWorlds";
import { hasAnyRole } from "@/lib/adminAccess";
import { withCsrfHeader } from "@/lib/csrf";
import { fetchSiteWorldDetail } from "@/lib/siteWorldsApi";
import type { PublicSiteWorldRecord } from "@/types/inbound-request";
import { AlertCircle, ArrowLeft, ExternalLink, Play, RefreshCw, ScanLine, Sparkles } from "lucide-react";

interface SiteWorldDetailProps {
  params: {
    slug: string;
  };
}

const hostedSessionSteps = [
  {
    title: "Pick the site",
    detail: "Pick the exact site you want to test so the run stays tied to one real place.",
  },
  {
    title: "Start the hosted session",
    detail: "Blueprint brings up the managed hosted run built from that site.",
  },
  {
    title: "Choose robot, sensors, task, policy/checkpoint, and scenario variation",
    detail: "Choose the robot setup, the task, the policy, and the variation you want to run.",
  },
  {
    title: "Receive the starting observation",
    detail: "The session returns the first view of the site so the policy has a starting point.",
  },
  {
    title: "Let the policy choose an action",
    detail: "The policy decides what to do next, such as move, turn, lift, grasp, or stop.",
  },
  {
    title: "Get the next observation",
    detail: "The hosted world model advances the run one step and returns the next view.",
  },
  {
    title: "Repeat until success, failure, or timeout",
    detail: "Keep looping until the task succeeds, fails, or times out.",
  },
  {
    title: "Score the run, export results, and compare policies",
    detail: "Review the results, export the outputs, and compare checkpoints side by side.",
  },
];

const worldModelUseCases = [
  {
    title: "Check deployment fit",
    detail:
      "See if your robot can move through this site, see the task, and finish the job before a field visit.",
  },
  {
    title: "Make site-specific data",
    detail:
      "Render runs from this exact site, vary scenarios, and export outputs for training or debugging.",
  },
  {
    title: "Compare releases",
    detail:
      "Run the same task on the same site after each software update so regressions are easy to spot.",
  },
  {
    title: "Train and demo",
    detail:
      "Use the exact site for customer demos, operator walkthroughs, and shared remote review.",
  },
];

interface SupportBlock {
  title: string;
  items: string[];
}

type WorldLabsPreviewState = NonNullable<PublicSiteWorldRecord["worldLabsPreview"]>;
type WorldLabsStatus = WorldLabsPreviewState["status"];

interface AdminWorldLabsResponse {
  ok?: boolean;
  preview?: PublicSiteWorldRecord["worldLabsPreview"];
  error?: string;
}

const WORLDLABS_STATUS_COPY: Record<
  WorldLabsStatus,
  { label: string; tone: string; summary: string }
> = {
  not_requested: {
    label: "Not requested",
    tone: "border-slate-200 bg-slate-100 text-slate-700",
    summary: "The pipeline artifacts are ready, but Marble generation has not been requested yet.",
  },
  queued: {
    label: "Queued",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    summary: "World Labs accepted the request and Marble is still waiting to start.",
  },
  processing: {
    label: "Processing",
    tone: "border-sky-200 bg-sky-50 text-sky-700",
    summary: "World Labs is still building the interactive Marble world from the walkthrough.",
  },
  ready: {
    label: "Ready",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    summary: "The Marble world is ready and can be launched in a new tab.",
  },
  failed: {
    label: "Failed",
    tone: "border-rose-200 bg-rose-50 text-rose-700",
    summary: "The last Marble generation attempt failed. Review the failure reason, then retry.",
  },
};

function formatTimestamp(value?: string | null) {
  if (!value) return "Not available yet";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }
  return timestamp.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStatusLabel(status: WorldLabsStatus) {
  return WORLDLABS_STATUS_COPY[status].label;
}

function getArtifactSourceUri(site: PublicSiteWorldRecord | null | undefined, sourceId: string) {
  return (
    site?.artifactExplorer?.sources.find((source) => source.id === sourceId)?.uri ||
    null
  );
}

function deriveWorldLabsStatus(site: PublicSiteWorldRecord | null | undefined): WorldLabsStatus {
  const preview = site?.worldLabsPreview;
  if (!preview) {
    return "not_requested";
  }
  if (preview.launchUrl && preview.worldId) {
    return "ready";
  }
  if (preview.failureReason || preview.status === "failed") {
    return "failed";
  }
  if (preview.operationId || preview.operationManifestUri) {
    return preview.status === "queued" ? "queued" : "processing";
  }

  const hasRequestManifest =
    Boolean(preview.requestManifestUri) || Boolean(getArtifactSourceUri(site, "worldlabs-request"));
  const hasInputVideo = Boolean(getArtifactSourceUri(site, "worldlabs-input-video"));
  return hasRequestManifest && hasInputVideo ? "not_requested" : preview.status;
}

function applyWorldLabsPreview(
  current: PublicSiteWorldRecord | null | undefined,
  preview: PublicSiteWorldRecord["worldLabsPreview"],
) {
  if (!current || !preview) {
    return current;
  }
  return {
    ...current,
    worldLabsPreview: preview,
  };
}

export default function SiteWorldDetail({ params }: SiteWorldDetailProps) {
  const { currentUser, userData, tokenClaims } = useAuth();
  const slug = useMemo(() => {
    const routeSlug = String(params?.slug || "").trim().replace(/^\/+|\/+$/g, "");
    if (routeSlug) {
      return routeSlug;
    }

    if (typeof window === "undefined") {
      return "";
    }

    const segments = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (segments[0] === "world-models" && segments[1]) {
      return segments[1];
    }

    return "";
  }, [params?.slug]);

  const fallbackSite = getSiteWorldById(slug) as PublicSiteWorldRecord | null;
  const [site, setSite] = useState<PublicSiteWorldRecord | null>(fallbackSite);
  const [worldLabsAction, setWorldLabsAction] = useState<"generate" | "refresh" | null>(null);
  const [worldLabsAdminError, setWorldLabsAdminError] = useState<string | null>(null);
  const [worldLabsAdminNotice, setWorldLabsAdminNotice] = useState<string | null>(null);
  const isAdmin = hasAnyRole(["admin", "ops"], userData, tokenClaims);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    setWorldLabsAction(null);
    setWorldLabsAdminError(null);
    setWorldLabsAdminNotice(null);
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      setSite(null);
      return;
    }

    let cancelled = false;
    fetchSiteWorldDetail(slug)
      .then((item) => {
        if (!cancelled) {
          setSite(item as typeof fallbackSite);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSite(getSiteWorldById(slug));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const relatedSites = useMemo(() => {
    if (!site) return [];
    return siteWorldCards.filter((item) => item.id !== site.id).slice(0, 3);
  }, [site]);

  void relatedSites;

  const worldLabsPreview = site?.worldLabsPreview || null;
  const nativeWorldModelPrimary =
    Boolean(site?.deploymentReadiness?.native_world_model_primary) || Boolean(site?.siteWorldSpecUri);
  const worldLabsStatus = deriveWorldLabsStatus(site);
  const worldLabsStatusCopy = WORLDLABS_STATUS_COPY[worldLabsStatus];
  const worldLabsRequestManifestUri =
    worldLabsPreview?.requestManifestUri || getArtifactSourceUri(site, "worldlabs-request");
  const worldLabsInputManifestUri = getArtifactSourceUri(site, "worldlabs-input-manifest");
  const worldLabsInputVideoUri = getArtifactSourceUri(site, "worldlabs-input-video");
  const hasRequiredWorldLabsArtifacts =
    Boolean(worldLabsRequestManifestUri) && Boolean(worldLabsInputVideoUri);
  const missingWorldLabsArtifactFields = [
    !worldLabsRequestManifestUri ? "worldlabs_request_manifest_uri" : null,
    !worldLabsInputVideoUri ? "worldlabs_input_video_uri" : null,
  ].filter(Boolean) as string[];
  const canRefreshWorldLabsStatus = Boolean(
    worldLabsPreview?.operationId || worldLabsPreview?.operationManifestUri,
  );
  const shouldShowWorldLabsSection = Boolean(worldLabsPreview) || isAdmin;
  const isDemoWalkthrough = site?.id === "siteworld-f5fd54898cfb";

  const runWorldLabsAdminAction = async (action: "generate" | "refresh") => {
    if (!site || !currentUser) {
      return;
    }

    setWorldLabsAction(action);
    setWorldLabsAdminError(null);
    setWorldLabsAdminNotice(null);

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(
        `/api/admin/site-worlds/${encodeURIComponent(site.id)}/worldlabs-preview/${action}`,
        {
          method: "POST",
          headers: {
            ...(await withCsrfHeader({})),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      const payload = (await response.json().catch(() => ({}))) as AdminWorldLabsResponse;
      if (!response.ok || !payload.preview) {
        throw new Error(payload.error || `worldlabs_${action}_failed`);
      }

      setSite((currentSite) => applyWorldLabsPreview(currentSite, payload.preview) || currentSite);
      setWorldLabsAdminNotice(
        action === "generate"
          ? "Marble generation requested. Use refresh while World Labs is still processing."
          : payload.preview.status === "ready"
            ? "Marble status refreshed. The interactive preview is ready to launch."
            : "Marble status refreshed.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : `worldlabs_${action}_failed`;
      const friendlyMessage =
        message === "worldlabs_operation_missing"
          ? "No World Labs operation exists yet. Generate a Marble preview first."
          : message;
      setWorldLabsAdminError(friendlyMessage);
    } finally {
      setWorldLabsAction(null);
    }
  };

  if (!site) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900">Site world not found</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          The listing you are looking for is not available.
        </p>
        <a
          href="/world-models"
          className="mt-6 inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Back to World Models
        </a>
      </div>
    );
  }

  const scenePackage = site.packages[0];
  const hostedSessions = site.packages[1];
  const supportBlocks: SupportBlock[] = [
    {
      title: "What goes in",
      items: [
        site.sampleRobot,
        site.runtime,
        site.sampleTask,
        site.samplePolicy,
        site.scenarioVariants.join(", "),
      ],
    },
    {
      title: "What comes back",
      items: [
        `Starting observation from ${site.siteName}`,
        "Step-by-step observations as the run progresses",
        "Rewards or success signals for the run",
        "Rollout video for each episode",
        "Metrics and failure cases for review",
      ],
    },
    {
      title: "What teams do with this world model",
      items: [
        "Check deployment fit before travel",
        "Generate site-specific data",
        "Compare releases on the same setup",
        "Train operators or run customer demos",
      ],
    },
  ];

  return (
    <>
      <SEO
        title={`${site.siteName} | World Models | Blueprint`}
        description={`${site.siteName} is a site-specific world model that robot teams can use for tuning, evaluation, and data generation before a site visit.`}
        canonical={`/world-models/${site.id}`}
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <a
            href="/world-models"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to World Models
          </a>

          <header className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {site.industry}
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                {site.siteName}
              </h1>
              <p className="mt-3 text-base font-medium text-slate-500">{site.siteAddress}</p>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600 sm:text-[1.08rem]">
                {site.summary}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Use this listing to ground one deployment question on the real site, compare the
                package with the hosted evaluation path, and decide how your team should test it
                before the real visit.
              </p>
              <p className="mt-2 text-sm text-slate-500">{site.bestFor}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                  {site.taskLane}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                  {site.runtime}
                </span>
              </div>
            </div>

            <aside className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
              <p className="text-sm font-semibold text-slate-900">What you can buy on this listing</p>
              <div className="mt-4 space-y-2.5">
                <a
                  href="#scene-package"
                  className="block rounded-2xl border border-slate-300 bg-white p-4 transition hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900">Scene Package</p>
                  <p className="mt-1 text-sm text-slate-600">{scenePackage.priceLabel}</p>
                </a>
                <a
                  href="#hosted-sessions"
                  className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900">Hosted evaluation</p>
                  <p className="mt-1 text-sm text-slate-600">{hostedSessions.priceLabel}</p>
                </a>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Buy the package if your team wants the site files. Request hosted evaluation if you
                want runtime evidence, release comparison, or failure review on the same site.
              </p>
            </aside>
          </header>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
            <SiteWorldGraphic site={site as Parameters<typeof SiteWorldGraphic>[0]["site"]} />
          </section>

          {isDemoWalkthrough ? (
            <div className="mt-8">
              <ProofModule
                eyebrow="Public walkthrough"
                title="See the public proof path before you ask for more."
                description="This sample is the cleanest public example on the site. It shows the walkthrough, the package framing, and the hosted side in one place."
                caption="Silent proof reel built from the current demo assets."
                compact={true}
              />
            </div>
          ) : null}

          <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 sm:px-7 sm:py-7">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Why teams use this site
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                What teams use this listing for.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                The point is to answer one real deployment question before the expensive part
                starts.
              </p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {worldModelUseCases.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.detail}</p>
                </article>
              ))}
            </div>
          </section>

          {site.deploymentReadiness ? (
            <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-950 px-5 py-6 text-slate-100 sm:px-7 sm:py-7">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Deployment Readiness
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <p className="text-sm font-semibold text-white">Current site status</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {String(site.deploymentReadiness.qualification_state || "unknown").replaceAll("_", " ")}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Benchmark coverage: {site.deploymentReadiness.benchmark_coverage_status || "missing"}
                    {typeof site.deploymentReadiness.benchmark_task_count === "number"
                      ? ` · ${site.deploymentReadiness.benchmark_task_count} tasks`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Export readiness: {site.deploymentReadiness.export_readiness_status || "missing"}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Refresh state: {site.deploymentReadiness.recapture_required ? "Needs refresh" : site.deploymentReadiness.recapture_status || "Current"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <p className="text-sm font-semibold text-white">Capability envelope</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    <li>Embodiment: {site.deploymentReadiness.capability_envelope?.embodiment_type || "Not specified"}</li>
                    <li>
                      Minimum path width: {site.deploymentReadiness.capability_envelope?.minimum_path_width_m ?? "N/A"} m
                    </li>
                    <li>
                      Maximum reach: {site.deploymentReadiness.capability_envelope?.maximum_reach_m ?? "N/A"} m
                    </li>
                    <li>
                      Sensors: {(site.deploymentReadiness.capability_envelope?.sensor_requirements || []).join(", ") || "Not specified"}
                    </li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <p className="text-sm font-semibold text-white">Rights and compliance</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    <li>
                      Export entitlements: {(site.deploymentReadiness.rights_and_compliance?.export_entitlements || []).join(", ") || "Review required"}
                    </li>
                    <li>
                      Consent scope: {(site.deploymentReadiness.rights_and_compliance?.consent_scope || []).join(", ") || "Review required"}
                    </li>
                    <li>
                      Retention policy: {site.deploymentReadiness.rights_and_compliance?.retention_policy || "Not specified"}
                    </li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <p className="text-sm font-semibold text-white">Evidence gaps</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    {(site.deploymentReadiness.missing_evidence || []).length > 0 ? (
                      site.deploymentReadiness.missing_evidence?.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>No flagged evidence gaps on the current readiness package.</li>
                    )}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {shouldShowWorldLabsSection ? (
            <section className="mt-8 rounded-3xl border border-slate-200 bg-white px-5 py-6 sm:px-7 sm:py-7">
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5 text-slate-700" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Interactive Preview
                </p>
              </div>
              <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                    Launch the fallback World Labs preview.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    This is an optional provider-generated demo layer built from the walkthrough.
                    Blueprint treats the internal geometry, retrieval, scene-memory, and site-world
                    artifacts as the primary package and uses World Labs only as a secondary fallback
                    when an external preview is still useful.
                  </p>
                  {nativeWorldModelPrimary ? (
                    <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                      Native Blueprint world-model artifacts are the primary path for this site.
                      World Labs is secondary and does not define readiness truth.
                    </p>
                  ) : null}
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      Status: {formatStatusLabel(worldLabsStatus)}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      Model: {worldLabsPreview?.model || "Pending"}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      Panorama: {worldLabsPreview?.panoUrl ? "Available" : "Not available yet"}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      SPZ export: {(worldLabsPreview?.spzUrls || []).length > 0 ? "Available" : "Not available yet"}
                    </div>
                  </div>
                  <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    {worldLabsStatusCopy.summary}
                  </p>
                  {worldLabsPreview?.caption ? (
                    <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                      {worldLabsPreview.caption}
                    </p>
                  ) : null}
                  {worldLabsPreview?.failureReason ? (
                    <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
                      Last generation error: {worldLabsPreview.failureReason}
                    </p>
                  ) : null}
                  {isAdmin ? (
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-slate-700" />
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Admin Marble Controls
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${worldLabsStatusCopy.tone}`}
                        >
                          {worldLabsStatusCopy.label}
                        </span>
                        <button
                          type="button"
                          disabled={worldLabsAction !== null || !hasRequiredWorldLabsArtifacts}
                          onClick={() => {
                            void runWorldLabsAdminAction("generate");
                          }}
                          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {worldLabsAction === "generate" ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          Generate Marble Preview
                        </button>
                        <button
                          type="button"
                          disabled={worldLabsAction !== null || !canRefreshWorldLabsStatus}
                          onClick={() => {
                            void runWorldLabsAdminAction("refresh");
                          }}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                        >
                          <RefreshCw
                            className={`mr-2 h-4 w-4 ${worldLabsAction === "refresh" ? "animate-spin" : ""}`}
                          />
                          Refresh Marble Status
                        </button>
                      </div>
                      {!hasRequiredWorldLabsArtifacts ? (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <div>
                              Pipeline output is required before Marble generation can run for this
                              site-world. Missing required artifact fields:{" "}
                              <span className="font-semibold">
                                {missingWorldLabsArtifactFields.join(", ")}
                              </span>
                              .
                              {!worldLabsInputManifestUri ? (
                                <> The supporting `worldlabs_input_manifest_uri` artifact is also missing.</>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {worldLabsAdminError ? (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
                          {worldLabsAdminError}
                        </div>
                      ) : null}
                      {worldLabsAdminNotice ? (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700">
                          {worldLabsAdminNotice}
                        </div>
                      ) : null}
                      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Operation ID
                          </dt>
                          <dd className="mt-2 break-all text-sm text-slate-700">
                            {worldLabsPreview?.operationId || "Not available yet"}
                          </dd>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            World ID
                          </dt>
                          <dd className="mt-2 break-all text-sm text-slate-700">
                            {worldLabsPreview?.worldId || "Not available yet"}
                          </dd>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Failure Reason
                          </dt>
                          <dd className="mt-2 break-words text-sm text-slate-700">
                            {worldLabsPreview?.failureReason || "No failure recorded"}
                          </dd>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Last Updated
                          </dt>
                          <dd className="mt-2 text-sm text-slate-700">
                            {formatTimestamp(worldLabsPreview?.lastUpdatedAt)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Fallback launch state
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {worldLabsStatus === "ready" ? "Ready to launch" : "Waiting on generation"}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    The World Labs viewer opens in a new tab because their viewer cannot be embedded
                    inside Blueprint.
                  </p>
                  {worldLabsPreview?.launchUrl ? (
                    <a
                      href={worldLabsPreview.launchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Launch fallback preview
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  ) : (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      Preview not ready yet. Keep using the grounded Blueprint artifacts until generation completes.
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          <section
            id="scene-package"
            className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 sm:px-7 sm:py-7"
          >
            <div className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-slate-700" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Site Package
              </p>
            </div>
            <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  Buy the site package.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Use this when your team wants the grounded site package for internal review,
                  integration work, or your own tooling.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {scenePackage.deliverables.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Best fit
                </p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  Teams that want the site files and package notes
                </p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Starting price
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{scenePackage.priceLabel}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Use this when your team wants the captured site package for review, integration,
                  or downstream internal work.
                </p>
                <a
                  href={scenePackage.actionHref}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  {scenePackage.actionLabel}
                </a>
              </div>
            </div>
          </section>

          <section
            id="hosted-sessions"
            className="mt-8 rounded-3xl border border-slate-200 bg-white px-5 py-6 sm:px-7 sm:py-7"
          >
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-slate-700" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Hosted evaluation
              </p>
            </div>
            <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  Request hosted evaluation for this site.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Hosted evaluation is for the questions teams ask before a visit: can this robot
                  handle the lane, what fails first, and how do releases compare on the same site?
                  Use it for repeatable testing, site-specific data generation, policy adaptation,
                  and remote demos.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {hostedSessions.deliverables.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
                    >
                      {item}
                    </div>
                  ))}
                  {site.startStates.map((state) => (
                    <div
                      key={state}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
                    >
                      {state}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Best fit
                </p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  Teams that want to run the site now
                </p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Self-serve starting rate
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{hostedSessions.priceLabel}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  That rate is for self-serve hosted evaluation time. Managed, priority, or
                  higher-touch work is scoped separately when the job needs more support.
                </p>
                <a
                  href={hostedSessions.actionHref}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {hostedSessions.actionLabel}
                </a>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 sm:px-7 sm:py-7">
            <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Simple eval loop
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              What hosted evaluation looks like
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              One site. One task. One robot question. Start the session, run the task, compare the
              result, and export what matters.
            </p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {hostedSessionSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-8 grid gap-4 lg:grid-cols-3">
            {supportBlocks.map((block) => (
              <article
                key={block.title}
                className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <h2 className="text-xl font-bold text-slate-900">{block.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-900 px-5 py-6 text-white sm:px-7 sm:py-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              Example
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              A sample eval loop for {site.siteName}
            </h2>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-200">
              A team picks {site.siteName}, chooses {site.sampleRobot}, and tests{" "}
              {site.samplePolicy} on the task to {site.sampleTask.toLowerCase()}. They run a few
              variations like {site.scenarioVariants.slice(0, 2).join(" and ").toLowerCase()} to
              see whether the lane is viable, what breaks first, and whether the checkpoint is
              ready for a real visit. Then they review the rollout video, metrics, failure cases,
              and exported data.
            </p>
          </section>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 sm:px-7 sm:py-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Related sites
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {relatedSites.map((relatedSite) => (
                <a
                  key={relatedSite.id}
                  href={`/world-models/${relatedSite.id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {relatedSite.industry}
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{relatedSite.siteName}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {relatedSite.taskLane}
                  </p>
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
