import { ArrowRight, ExternalLink } from "lucide-react";
import { ExactSiteSparkViewer } from "@/components/site/ExactSiteSparkViewer";
import {
  publicDemoHref,
  siteMotionLoopPosterSrc,
  siteMotionLoopVideoSrc,
} from "@/lib/marketingProof";

interface ExactSitePreviewSite {
  id: string;
  siteName: string;
  siteAddress?: string | null;
  sceneId?: string | null;
  captureId?: string | null;
  siteSubmissionId?: string | null;
  pipelinePrefix?: string | null;
  runtimeReferenceImageUrl?: string | null;
  presentationReferenceImageUrl?: string | null;
  worldLabsPreview?: {
    status?: string | null;
    launchUrl?: string | null;
    thumbnailUrl?: string | null;
    panoUrl?: string | null;
    spzUrls?: string[] | null;
    caption?: string | null;
    generationSourceType?: string | null;
  } | null;
}

interface ExactSitePreviewSectionProps {
  site: ExactSitePreviewSite;
  primaryHref: string;
  onCtaClick?: (ctaId: string, ctaLabel: string, destination: string, source: string) => void;
}

function shortId(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "request-scoped";
  return normalized.length > 18 ? `${normalized.slice(0, 8)}...${normalized.slice(-6)}` : normalized;
}

function firstPreviewUrl(values?: string[] | null) {
  return Array.isArray(values) ? values.map((value) => String(value || "").trim()).find(Boolean) || null : null;
}

export function ExactSitePreviewSection({
  site,
  primaryHref,
  onCtaClick,
}: ExactSitePreviewSectionProps) {
  const preview = site.worldLabsPreview || null;
  const spzUrl = firstPreviewUrl(preview?.spzUrls);
  const hasProviderFallback = Boolean(preview?.panoUrl || preview?.thumbnailUrl);
  const previewLabel = spzUrl
    ? "Self-hosted SPZ preview"
    : hasProviderFallback
      ? "Provider preview fallback"
      : "Sample/generated preview fallback";
  const previewCopy = spzUrl
    ? "A World Labs SPZ asset is attached to this site package, so the preview renders in Blueprint's browser viewer instead of an iframe."
    : hasProviderFallback
      ? "The SPZ file is not attached yet, so this module shows the provider preview media while keeping the self-hosted path ready."
      : "No public SPZ is attached to the sample package yet, so this module uses a truthful generated motion-loop preview and keeps the SPZ path ready.";
  const posterFallback =
    preview?.thumbnailUrl ||
    site.presentationReferenceImageUrl ||
    site.runtimeReferenceImageUrl ||
    siteMotionLoopPosterSrc;

  const proofRows = [
    ["Capture route", shortId(site.captureId || site.siteSubmissionId)],
    ["Package/proof", shortId(site.pipelinePrefix || site.sceneId)],
    ["Preview state", previewLabel],
  ];

  return (
    <section
      className="border-b border-black/10 bg-[#101310] text-white"
      data-home-section="exact-site-preview"
    >
      <div className="mx-auto grid max-w-[88rem] gap-0 px-5 py-10 sm:px-8 lg:grid-cols-[0.42fr_0.58fr] lg:px-10 lg:py-12">
        <div className="flex flex-col justify-between border-y border-white/12 py-7 pr-0 lg:border-y-0 lg:border-l lg:py-9 lg:pl-7 lg:pr-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9fb5a4]">
              Blueprint Exact-Site Preview
            </p>
            <h2 className="font-editorial mt-5 max-w-[34rem] text-[3rem] leading-[0.9] tracking-[-0.05em] text-white sm:text-[4.1rem]">
              Real capture route to explorable site preview.
            </h2>
            <p className="mt-6 max-w-[32rem] text-base leading-8 text-white/74">
              Blueprint starts with a real walkthrough, packages the proof and rights boundaries,
              then opens a hosted review path. This module is labeled as a {previewLabel.toLowerCase()}{" "}
              when generated/provider media stands in for the self-hosted SPZ asset.
            </p>
          </div>

          <div className="mt-8 divide-y divide-white/12 border-y border-white/12">
            {proofRows.map(([label, value]) => (
              <div key={label} className="grid gap-2 py-4 sm:grid-cols-[0.34fr_0.66fr]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">{label}</p>
                <p className="text-sm leading-6 text-white/76">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={primaryHref}
              onClick={() =>
                onCtaClick?.(
                  "home_exact_site_preview_primary",
                  "Request exact-site preview",
                  primaryHref,
                  "home-exact-site-preview",
                )
              }
              className="inline-flex items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Request exact-site preview
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <a
              href={publicDemoHref}
              onClick={() =>
                onCtaClick?.(
                  "home_exact_site_preview_sample",
                  "Open sample package",
                  publicDemoHref,
                  "home-exact-site-preview",
                )
              }
              className="inline-flex items-center justify-center border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Open sample package
            </a>
          </div>
        </div>

        <div className="relative border-x border-b border-white/12 lg:border-y lg:border-r">
          <ExactSiteSparkViewer
            spzUrl={spzUrl}
            panoUrl={preview?.panoUrl}
            thumbnailUrl={preview?.thumbnailUrl}
            videoSrc={siteMotionLoopVideoSrc}
            posterSrc={posterFallback}
          />
          <div className="absolute left-4 top-4 max-w-[18rem] border border-white/12 bg-black/38 p-4 text-white backdrop-blur-sm sm:left-5 sm:top-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">
              {previewLabel}
            </p>
            <p className="mt-3 text-sm leading-6 text-white/74">{previewCopy}</p>
            {preview?.launchUrl ? (
              <a
                href={preview.launchUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-flex items-center text-sm font-semibold text-white"
              >
                Open provider preview
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
