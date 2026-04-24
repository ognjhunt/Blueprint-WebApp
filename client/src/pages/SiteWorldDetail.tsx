import { useEffect, useMemo, useState } from "react";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import {
  EditorialCtaBand,
  EditorialFilmstrip,
  MonochromeMedia,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { getSiteWorldById } from "@/data/siteWorlds";
import { hasAnyRole } from "@/lib/adminAccess";
import { withCsrfHeader } from "@/lib/csrf";
import { editorialRefreshAssets } from "@/lib/editorialRefreshAssets";
import {
  pickProofStoryForSite,
  sampleExportTree,
  sampleHostedRunRows,
} from "@/lib/proofEvidence";
import {
  getSiteWorldCommercialStatus,
  getSiteWorldPlainEnglishProof,
  getSiteWorldPlainEnglishRestrictions,
  getSiteWorldPlainEnglishStatus,
  getSiteWorldProofDepth,
  getSiteWorldPublicProofSummary,
  getSiteWorldStatusBadges,
  isPublicSampleSiteWorld,
} from "@/lib/siteWorldCommercialStatus";
import { fetchSiteWorldDetail } from "@/lib/siteWorldsApi";
import type { PublicSiteWorldRecord } from "@/types/inbound-request";
import { ArrowLeft, ArrowRight, ExternalLink, RefreshCw } from "lucide-react";

interface SiteWorldDetailProps {
  params: {
    slug: string;
  };
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
    summary:
      "The listing is still anchored in the native package and hosted path. The optional interactive preview has not been requested yet.",
  },
  queued: {
    label: "Queued",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    summary: "World Labs accepted the request and the interactive preview is still queued.",
  },
  processing: {
    label: "Processing",
    tone: "border-sky-200 bg-sky-50 text-sky-700",
    summary: "The provider-generated preview is still rendering from the walkthrough artifacts.",
  },
  ready: {
    label: "Ready",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    summary: "The optional interactive preview is ready to open in a new tab.",
  },
  failed: {
    label: "Failed",
    tone: "border-rose-200 bg-rose-50 text-rose-700",
    summary:
      "The last interactive-preview attempt failed. The native package and hosted path remain the primary contract.",
  },
};

function formatDateValue(value?: string | null, fallback = "Request-scoped") {
  if (!value) return fallback;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return timestamp.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function humanizeLabel(value?: string | null, fallback = "Request-scoped") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatCaptureDate(site: PublicSiteWorldRecord) {
  return formatDateValue(site.deploymentReadiness?.freshness_date);
}

function formatReviewDate(site: PublicSiteWorldRecord) {
  return formatDateValue(site.deploymentReadiness?.freshness_date);
}

function formatFreshnessState(site: PublicSiteWorldRecord) {
  if (site.deploymentReadiness?.recapture_required) return "Recapture required";
  return humanizeLabel(site.deploymentReadiness?.recapture_status);
}

const sampleArtifactLinks = [
  {
    label: "Sample manifest",
    href: "/samples/sample-site-package-manifest.json",
    body: "Representative package fields, capture provenance, route lanes, export modes, and quality checks.",
  },
  {
    label: "Sample rights sheet",
    href: "/samples/sample-rights-sheet.md",
    body: "Representative rights class, sharing limits, redaction handling, and buyer-use boundaries.",
  },
  {
    label: "Sample export bundle",
    href: "/samples/sample-export-bundle.json",
    body: "Representative export file tree and technical handoff shape.",
  },
  {
    label: "Sample hosted report",
    href: "/samples/sample-hosted-review-report.md",
    body: "Representative hosted-review notes, run evidence, and follow-up questions.",
  },
] as const;

function getArtifactSourceUri(site: PublicSiteWorldRecord | null | undefined, sourceId: string) {
  return site?.artifactExplorer?.sources.find((source) => source.id === sourceId)?.uri || null;
}

function deriveWorldLabsStatus(site: PublicSiteWorldRecord | null | undefined): WorldLabsStatus {
  const preview = site?.worldLabsPreview;
  if (!preview) return "not_requested";
  if (preview.launchUrl && preview.worldId) return "ready";
  if (preview.failureReason || preview.status === "failed") return "failed";
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
  const slug = String(params?.slug || "").trim();
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
          ? "Interactive preview requested. Refresh while the provider is still rendering."
          : payload.preview.status === "ready"
            ? "Interactive preview refreshed. It is ready to open."
            : "Interactive preview status refreshed.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : `worldlabs_${action}_failed`;
      setWorldLabsAdminError(message);
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
          className="mt-6 inline-flex items-center bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Back to World Models
        </a>
      </div>
    );
  }

  const commercialStatus = getSiteWorldCommercialStatus(site);
  const isPublicSample = isPublicSampleSiteWorld(site);
  const publicProofSummary = getSiteWorldPublicProofSummary(site);
  const worldLabsPreview = site.worldLabsPreview || null;
  const proofStory = pickProofStoryForSite(site.id);
  const statusBadges = getSiteWorldStatusBadges(site);
  const worldLabsStatus = deriveWorldLabsStatus(site);
  const worldLabsStatusCopy = WORLDLABS_STATUS_COPY[worldLabsStatus];
  const worldLabsRequestManifestUri =
    worldLabsPreview?.requestManifestUri || getArtifactSourceUri(site, "worldlabs-request");
  const worldLabsInputVideoUri = getArtifactSourceUri(site, "worldlabs-input-video");
  const hasRequiredWorldLabsArtifacts =
    Boolean(worldLabsRequestManifestUri) && Boolean(worldLabsInputVideoUri);
  const canRefreshWorldLabsStatus = Boolean(
    worldLabsPreview?.operationId || worldLabsPreview?.operationManifestUri,
  );

  const trustRows = [
    { label: "Proof depth", value: getSiteWorldProofDepth(site), width: "72%" },
    { label: "Public proof", value: publicProofSummary, width: "84%" },
    { label: "Capture date", value: formatCaptureDate(site), width: "64%" },
    { label: "Freshness", value: formatFreshnessState(site), width: "58%" },
    { label: "Status", value: commercialStatus.label, width: "88%" },
  ];

  const overviewRows = [
    { title: "Site code", value: site.siteCode || "Current listing" },
    { title: "Industry", value: site.industry || "Exact-site walkthrough" },
    { title: "Workflow lane", value: site.taskLane || site.sampleTask || "Current workflow" },
    { title: "Runtime", value: site.runtime || "Hosted evaluation" },
  ];

  const taskRows = [
    {
      title: site.sampleTask || site.taskCatalog[0]?.taskText || "Primary lane",
      body: "Base workflow lane tied to the exact site.",
      image: editorialRefreshAssets.detailHeroWarehouse,
      imageClassName: "object-cover object-center",
      meta: "Base lane",
    },
    {
      title: "Lighting variation",
      body: "Same site, adjusted lighting assumptions.",
      image: editorialRefreshAssets.detailProofCapture,
      imageClassName: "object-cover object-center",
      meta: "1.2 km est. path",
    },
    {
      title: "Clutter variation",
      body: "Same route, more clutter and occlusion.",
      image: editorialRefreshAssets.detailSitePlan,
      imageClassName: "object-cover object-center",
      meta: "620 m est. path",
    },
    {
      title: "Export review",
      body: "Package and hosted outputs read back against the same exact site.",
      image: editorialRefreshAssets.detailProofCapture,
      imageClassName: "object-cover object-right",
      meta: "480 m est. path",
    },
  ];

  const previewFrames = [
    {
      src: editorialRefreshAssets.detailSitePlan,
      alt: "Site overview map",
      time: "00",
      title: "Overview",
    },
    {
      src: editorialRefreshAssets.detailHeroWarehouse,
      alt: "Staging entry",
      time: "01",
      title: "Staging",
    },
    {
      src: editorialRefreshAssets.detailProofCapture,
      alt: "Capture proof",
      time: "02",
      title: "Proof",
    },
    {
      src: editorialRefreshAssets.detailHeroWarehouse,
      alt: "Route lane",
      time: "03",
      title: "Route",
    },
    {
      src: editorialRefreshAssets.detailProofCapture,
      alt: "Restriction board",
      time: "04",
      title: "Review",
    },
  ];

  const restrictionCards = [
    {
      title: "Current public status",
      body: getSiteWorldPlainEnglishStatus(site),
    },
    {
      title: "Proof and fidelity",
      body: getSiteWorldPlainEnglishProof(site),
    },
    {
      title: "Restrictions and change",
      body: getSiteWorldPlainEnglishRestrictions(site),
    },
    {
      title: "Artifacts visible today",
      body: isPublicSample
        ? "Sample manifest, rights sheet, export bundle, and hosted-review report are linked below."
        : "This commercial listing shows site metadata, price, trust fields, and request-scoped paths. Listing-specific screenshots or export previews open during follow-up.",
    },
  ];
  const visibleNowRows = [
    ["Visible now", isPublicSample ? "Sample route, reference stills, representative artifact layout, and hosted request path." : "Site metadata, workflow lane, pricing frame, trust fields, and request path."],
    ["Gated", "Package files, raw exports, live hosted runtime, and listing-specific commercial proof open through request review."],
    ["Why gated", "Rights, privacy, freshness, and buyer context need to remain attached before access expands."],
  ];

  const scenePackage = site.packages[0];
  const hostedPackage = site.packages[1];

  return (
    <>
      <SEO
        title={`${site.siteName} | World Models | Blueprint`}
        description={`${site.siteName} is a site-specific world model listing for buyer review, hosted evaluation, and package access.`}
        canonical={`/world-models/${site.id}`}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialRefreshAssets.detailHeroWarehouse}
            alt={site.siteName}
            className="min-h-[44rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[44rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.86)_0%,rgba(0,0,0,0.58)_32%,rgba(0,0,0,0.14)_74%)]"
          >
            <RouteTraceOverlay className="opacity-90" />
            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[96rem] items-end gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[0.46fr_0.54fr] lg:px-10 lg:py-14">
                <div className="text-white">
                  <a
                    href="/world-models"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white/72 transition hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to World Models
                  </a>
                  <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-white/54">
                    Exact site
                  </p>
                  <h1 className="font-editorial mt-5 max-w-[24rem] text-[4.4rem] leading-[0.88] tracking-[-0.08em] sm:text-[5.8rem]">
                    {site.siteName}
                  </h1>
                  <p className="mt-4 text-lg text-white/86">{site.siteAddress}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {statusBadges.slice(0, 3).map((badge) => (
                      <span
                        key={badge.id}
                        className="rounded-full border border-white/16 bg-black/24 px-4 py-2 text-sm text-white/78"
                      >
                        {badge.label}
                      </span>
                    ))}
                    <span className="rounded-full border border-white/16 bg-black/24 px-4 py-2 text-sm text-white/78">
                      Capture: {formatCaptureDate(site)}
                    </span>
                    <span className="rounded-full border border-white/16 bg-black/24 px-4 py-2 text-sm text-white/78">
                      Review: {formatReviewDate(site)}
                    </span>
                  </div>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <a
                      href={scenePackage?.actionHref || "/contact?persona=robot-team"}
                      className="inline-flex items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                    >
                      Request package access
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                    <a
                      href={`/world-models/${site.id}/start`}
                      className="inline-flex items-center justify-center border border-white/16 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/8"
                    >
                      Start hosted evaluation
                    </a>
                  </div>
                </div>

                <div className="flex justify-start lg:justify-end">
                  <div className="w-full max-w-[18rem] border border-white/14 bg-black/36 p-5 text-white shadow-[0_24px_60px_-40px_rgba(0,0,0,0.52)] backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">
                      Trust snapshot
                    </p>
                    <div className="mt-5 space-y-4">
                      {trustRows.map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between gap-3 text-sm text-white/78">
                            <span>{item.label}</span>
                            <span className="max-w-[9rem] text-right text-white/62">{item.value}</span>
                          </div>
                          <div className="mt-2 h-px w-full bg-white/12">
                            <div className="h-px bg-white" style={{ width: item.width }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="sticky top-[72px] z-20 border-b border-black/10 bg-white/96 backdrop-blur">
          <div className="mx-auto grid max-w-[96rem] gap-3 px-5 py-4 text-sm sm:px-8 lg:grid-cols-[1fr_auto] lg:px-10">
            <div className="grid gap-3 md:grid-cols-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Package</p>
                <p className="mt-1 font-semibold text-slate-950">{scenePackage?.priceLabel || "Request scoped"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Hosted</p>
                <p className="mt-1 font-semibold text-slate-950">{hostedPackage?.priceLabel || "Request scoped"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Proof</p>
                <p className="mt-1 font-semibold text-slate-950">{getSiteWorldProofDepth(site)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Capture</p>
                <p className="mt-1 font-semibold text-slate-950">{formatCaptureDate(site)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Review</p>
                <p className="mt-1 font-semibold text-slate-950">{formatReviewDate(site)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <a
                href={scenePackage?.actionHref || "/contact?persona=robot-team"}
                className="inline-flex items-center justify-center bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Package access
              </a>
              <a
                href={`/world-models/${site.id}/start`}
                className="inline-flex items-center justify-center border border-black/10 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Hosted setup
              </a>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[96rem] gap-4 px-5 py-10 sm:px-8 lg:grid-cols-[0.38fr_0.62fr] lg:px-10 lg:py-12">
            <div className="bg-[#f5f3ef] p-6 lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Listing status
              </p>
              <h2 className="font-editorial mt-4 text-[2.8rem] leading-[0.94] tracking-[-0.05em] text-slate-950">
                What is real, sample, and gated.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-700">
                The listing is allowed to look polished without pretending every downstream
                artifact is open. Buyers should be able to see exactly what the public page
                proves and what still needs request review.
              </p>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-3">
                {visibleNowRows.map(([label, value]) => (
                  <div key={label} className="border border-black/10 bg-[#f8f6f1] p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                    <p className="mt-3 text-sm leading-7 text-slate-700">{value}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {statusBadges.map((badge) => (
                  <div key={badge.id} className={`border px-4 py-3 ${badge.tone}`}>
                    <p className="text-sm font-semibold">{badge.label}</p>
                    <p className="mt-2 text-xs leading-5 opacity-80">{badge.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[96rem] gap-px px-5 py-10 lg:grid-cols-2 sm:px-8 lg:px-10">
            <div className="border border-black/10 p-6 lg:p-8">
              <h2 className="font-editorial text-[2.8rem] leading-[0.94] tracking-[-0.05em] text-slate-950">
                Site overview
              </h2>
              <p className="mt-2 max-w-[26rem] text-sm leading-7 text-slate-700">
                {site.summary}
              </p>
              <div className="mt-6 overflow-hidden border border-black/10 bg-[#f5f3ef]">
                <MonochromeMedia
                  src={editorialRefreshAssets.detailSitePlan}
                  alt={`${site.siteName} site plan`}
                  className="aspect-[4/3] rounded-none"
                  imageClassName="aspect-[4/3] object-cover"
                  overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))]"
                />
              </div>
              <div className="mt-4 divide-y divide-black/10 border border-black/10">
                {overviewRows.map((row) => (
                  <div key={row.title} className="grid grid-cols-[0.78fr_0.22fr] gap-3 px-4 py-4 text-sm text-slate-700">
                    <span>{row.title}</span>
                    <span className="text-right text-slate-950">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-black/10 p-6 lg:p-8">
              <h2 className="font-editorial text-[2.8rem] leading-[0.94] tracking-[-0.05em] text-slate-950">
                Tasks in this world model
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                Pre-configured evaluation lanes for hosted review.
              </p>
              <div className="mt-6 space-y-3">
                {taskRows.map((row, index) => (
                  <div key={`${row.title}-${index}`} className="grid gap-3 border border-black/10 bg-[#f8f6f1] p-3 sm:grid-cols-[0.32fr_0.5fr_0.18fr]">
                    <MonochromeMedia
                      src={row.image}
                      alt={row.title}
                      className="aspect-[16/9] rounded-none"
                      imageClassName={`aspect-[16/9] ${row.imageClassName}`}
                      overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.14))]"
                    />
                    <div>
                      <p className="text-[1.4rem] leading-[1.02] tracking-[-0.04em] text-slate-950">
                        {row.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{row.body}</p>
                    </div>
                    <div className="text-right text-sm text-slate-700">
                      <div className="font-semibold text-slate-950">{row.meta}</div>
                      <div className="mt-4 h-12 border-l border-dashed border-black/20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10">
            <h2 className="font-editorial text-[2.6rem] leading-[0.94] tracking-[-0.05em] text-slate-950">
              Hosted evaluation preview
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              See the site through the review experience before moving into a deeper scoped session.
            </p>
            <div className="mt-6 bg-slate-950 p-4">
              <EditorialFilmstrip frames={previewFrames} />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="border border-black/10 bg-white p-6 lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Proof of fidelity
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {isPublicSample
                  ? "Captured sample with representative public artifacts."
                  : "Listing proof fields with request-scoped artifacts."}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-[0.34fr_0.33fr_0.33fr]">
                <MonochromeMedia
                  src={editorialRefreshAssets.detailProofCapture}
                  alt="Capture proof"
                  className="aspect-square rounded-none border border-black/10"
                  imageClassName="aspect-square object-cover"
                  overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]"
                />
                <MonochromeMedia
                  src={editorialRefreshAssets.detailHeroWarehouse}
                  alt="Warehouse still"
                  className="aspect-square rounded-none border border-black/10"
                  imageClassName="aspect-square object-cover object-center"
                  overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]"
                />
                <div className="border border-black/10 bg-[#f8f6f1] p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Capture manifest
                  </p>
                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <div>Session ID: {site.captureId}</div>
                    <div>Frames: capture-backed</div>
                    <div>Coverage: {publicProofSummary}</div>
                    <div>Capture date: {formatCaptureDate(site)}</div>
                    <div>Freshness: {formatFreshnessState(site)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-black/10 bg-white p-6 lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Restrictions and change
              </p>
              <p className="mt-2 text-sm text-slate-700">Know what is stable and what stays bounded.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {restrictionCards.map((card) => (
                  <div key={card.title} className="border border-black/10 bg-[#f8f6f1] p-4">
                    <p className="text-sm font-semibold text-slate-950">{card.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{card.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {!isPublicSample ? (
        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <div className="grid gap-4 lg:grid-cols-[0.4fr_0.6fr]">
              <div className="overflow-hidden border border-black/10 bg-slate-950 text-white">
                <MonochromeMedia
                  src={proofStory.image}
                  alt={proofStory.locationName}
                  className="min-h-[32rem] rounded-none"
                  imageClassName="min-h-[32rem]"
                  overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.72))]"
                >
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                      {proofStory.label}
                    </p>
                    <h2 className="font-editorial mt-4 text-[2.8rem] leading-[0.94] tracking-[-0.05em]">
                      {proofStory.locationName}
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-white/72">
                      {proofStory.locationType} / {proofStory.city}
                    </p>
                  </div>
                </MonochromeMedia>
              </div>

              <div className="grid gap-4">
                <div className="border border-black/10 bg-[#f5f3ef] p-6 lg:p-8">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Evidence packet preview
                  </p>
                  <h2 className="font-editorial mt-4 text-[2.8rem] leading-[0.94] tracking-[-0.05em] text-slate-950">
                    Public capture story for this listing.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-700">
                    This composite story shows the missing buyer evidence shape for a public-facing location: capture cue, guardrails, robot question, hosted report rows, and export tree. Replace it with listing-specific proof when the real packet is available.
                  </p>
                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    {[
                      ["Capture app cue", proofStory.captureAppCue],
                      ["Buyer", `${proofStory.buyerPersona}, ${proofStory.buyerRole}`],
                      ["Capture mode", proofStory.captureMode],
                    ].map(([label, value]) => (
                      <div key={label} className="border border-black/10 bg-white p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="border border-black/10 bg-white p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Evidence opened</p>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                      {proofStory.evidenceOpened.map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-black/10 bg-white p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Guardrails</p>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                      {proofStory.guardrails.map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border border-black/10 bg-slate-950 p-5 text-white">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">Decision note</p>
                  <p className="mt-4 text-sm leading-7 text-white/74">{proofStory.decisionNote}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[0.58fr_0.42fr]">
              <div className="border border-black/10 bg-[#f5f3ef] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Hosted report rows</p>
                <div className="mt-4 divide-y divide-black/10 border border-black/10 bg-white">
                  {sampleHostedRunRows.map((row) => (
                    <div key={row.run} className="grid gap-3 p-4 text-sm leading-6 text-slate-700 md:grid-cols-[0.16fr_0.28fr_0.36fr_0.2fr]">
                      <span className="font-semibold text-slate-950">{row.run}</span>
                      <span>{row.scenario}</span>
                      <span>{row.observation}</span>
                      <span className="text-slate-950">{row.output}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-black/10 bg-[#f5f3ef] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Export tree</p>
                <div className="mt-4 grid gap-2 font-mono text-[12px] leading-6 text-slate-700">
                  {sampleExportTree.slice(0, 6).map((item) => (
                    <div key={item} className="border border-black/10 bg-white px-3 py-2">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        ) : null}

        {isPublicSample ? (
          <section className="border-y border-black/10 bg-white">
            <div className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10">
              <div className="grid gap-4 lg:grid-cols-[0.36fr_0.64fr]">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Public sample artifacts
                  </p>
                  <h2 className="font-editorial mt-3 text-[2.8rem] leading-[0.94] tracking-[-0.05em] text-slate-950">
                    Inspect the deliverable shape.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-700">
                    These files are representative samples, not customer proof. They show the
                    manifest, rights, export, and hosted-report structure a buyer reviews.
                  </p>
                  <a
                    href="/sample-evaluation"
                    className="mt-6 inline-flex items-center justify-center bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Open end-to-end sample
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sampleArtifactLinks.map((artifact) => (
                    <a
                      key={artifact.href}
                      href={artifact.href}
                      className="group border border-black/10 bg-[#f8f6f1] p-5 transition hover:bg-white"
                    >
                      <p className="flex items-center justify-between gap-4 text-sm font-semibold text-slate-950">
                        {artifact.label}
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{artifact.body}</p>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {worldLabsPreview || isAdmin ? (
          <section className="border-y border-black/10 bg-white">
            <div className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10">
              <div className="grid gap-4 lg:grid-cols-[0.6fr_0.4fr]">
                <div className="border border-black/10 bg-[#f8f6f1] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Interactive preview
                      </p>
                      <h2 className="mt-2 text-[2rem] leading-[0.96] tracking-[-0.05em] text-slate-950">
                        Optional provider-generated preview
                      </h2>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${worldLabsStatusCopy.tone}`}
                    >
                      {worldLabsStatusCopy.label}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-700">{worldLabsStatusCopy.summary}</p>
                  {worldLabsPreview?.failureReason ? (
                    <p className="mt-4 text-sm text-rose-700">
                      Last generation error: {worldLabsPreview.failureReason}
                    </p>
                  ) : null}
                  {worldLabsPreview?.launchUrl ? (
                    <a
                      href={worldLabsPreview.launchUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-6 inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Open interactive preview
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  ) : null}
                  {isAdmin ? (
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={worldLabsAction !== null || !hasRequiredWorldLabsArtifacts}
                        onClick={() => void runWorldLabsAdminAction("generate")}
                        className="inline-flex items-center justify-center bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {worldLabsAction === "generate" ? "Requesting..." : "Generate preview"}
                      </button>
                      <button
                        type="button"
                        disabled={worldLabsAction !== null || !canRefreshWorldLabsStatus}
                        onClick={() => void runWorldLabsAdminAction("refresh")}
                        className="inline-flex items-center justify-center border border-black/10 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`mr-2 h-4 w-4 ${worldLabsAction === "refresh" ? "animate-spin" : ""}`}
                        />
                        Refresh status
                      </button>
                    </div>
                  ) : null}
                  {worldLabsAdminError ? (
                    <p className="mt-4 text-sm text-rose-700">{worldLabsAdminError}</p>
                  ) : null}
                  {worldLabsAdminNotice ? (
                    <p className="mt-4 text-sm text-emerald-700">{worldLabsAdminNotice}</p>
                  ) : null}
                </div>

                <div className="border border-black/10 bg-slate-950 p-6 text-white">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">
                    Listing boundary
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-white/74">
                    <div>The native package and hosted path stay primary on this listing.</div>
                    <div>Interactive preview is optional and does not redefine the trust surface.</div>
                    <div>Public proof, freshness, and rights remain visible even without the preview.</div>
                  </div>
                  <div className="mt-6 border-t border-white/10 pt-4 text-sm text-white/62">
                    {worldLabsPreview?.operationId ? `Operation: ${worldLabsPreview.operationId}` : "No live operation id"}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4 lg:grid-cols-2">
            <div id="scene-package" className="border border-black/10 bg-white p-6 lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Site package
              </p>
              <h2 className="mt-3 text-[2.1rem] leading-[0.98] tracking-[-0.05em] text-slate-950">
                Buy the site package.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-700">{scenePackage.summary}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {scenePackage.deliverables.map((item) => (
                  <div key={item} className="border border-black/10 bg-[#f8f6f1] px-4 py-4 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-6 border border-black/10 bg-[#f8f6f1] p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Best fit</p>
                <p className="mt-2 text-lg text-slate-950">Teams that want all the site data in their own stack</p>
                <p className="mt-3 text-sm text-slate-700">{scenePackage.priceLabel}</p>
              </div>
              <a
                href={scenePackage.actionHref}
                className="mt-6 inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {scenePackage.actionLabel}
              </a>
            </div>

            <div id="hosted-sessions" className="border border-black/10 bg-white p-6 lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Hosted evaluation
              </p>
              <h2 className="mt-3 text-[2.1rem] leading-[0.98] tracking-[-0.05em] text-slate-950">
                Start hosted evaluation for this site.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-700">
                {hostedPackage?.summary
                  || "Use the managed hosted path when the team wants reruns, review, and exports on the same site before moving the package."}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {(hostedPackage?.deliverables || site.exportArtifacts).slice(0, 4).map((item) => (
                  <div key={item} className="border border-black/10 bg-[#f8f6f1] px-4 py-4 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-6 border border-black/10 bg-slate-950 p-5 text-white">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">Best fit</p>
                <p className="mt-2 text-lg">Teams that want to run the site now</p>
                <p className="mt-3 text-sm text-white/72">{hostedPackage?.priceLabel || "Request scoped review"}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={`/world-models/${site.id}/start`}
                  className="inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Start hosted evaluation
                </a>
                <a
                  href={hostedPackage?.actionHref || "/contact?persona=robot-team"}
                  className="inline-flex items-center justify-center border border-black/10 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Request hosted evaluation
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 pb-10 sm:px-8 lg:px-10">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Ready to evaluate this site?"
            description="Request access to start a hosted evaluation, or take the package path when your team wants the site data inside its own stack."
            imageSrc={editorialRefreshAssets.detailHeroWarehouse}
            imageAlt={site.siteName}
            primaryHref={scenePackage?.actionHref || "/contact?persona=robot-team"}
            primaryLabel="Request package access"
            secondaryHref={`/world-models/${site.id}/start`}
            secondaryLabel="Start hosted evaluation"
          />
        </section>
      </div>
    </>
  );
}
