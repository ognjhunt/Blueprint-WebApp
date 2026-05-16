import { ArrowRight, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ExactSiteSparkViewer,
  type ExactSiteCameraPath,
} from "@/components/site/ExactSiteSparkViewer";
import {
  onlineOrderPickEvalPosterSrc,
  onlineOrderPickEvalVideoSrc,
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
    plyUrls?: string[] | null;
    caption?: string | null;
    generationSourceType?: string | null;
  } | null;
}

interface ExactSitePreviewSectionProps {
  site: ExactSitePreviewSite;
  primaryHref: string;
  onCtaClick?: (ctaId: string, ctaLabel: string, destination: string, source: string) => void;
}

interface GroceryEvalTask {
  id: string;
  label: string;
  role: string;
  objective: string;
  route: string;
  evaluationFocus: string;
  cameraPath: ExactSiteCameraPath;
  generatedVideo?: {
    src: string;
    poster: string;
    label: string;
  };
}

const groceryEvalTasks: GroceryEvalTask[] = [
  {
    id: "online-order-pick",
    label: "Pick an online order item",
    role: "Humanoid picker",
    objective: "Navigate from aisle entry to a shelf face and inspect the target zone before a tote handoff.",
    route: "Aisle entry -> shelf face -> close SKU check -> handoff angle",
    evaluationFocus: "Reachability, shelf visibility, aisle clearance",
    generatedVideo: {
      src: onlineOrderPickEvalVideoSrc,
      poster: onlineOrderPickEvalPosterSrc,
      label: "Generated online-order pick evaluation clip",
    },
    cameraPath: {
      id: "online-order-pick",
      label: "Online order pick path",
      keyframes: [
        { time: 0, position: [-0.42, 0.18, 1], target: [-0.08, -0.02, 0], fov: 44 },
        { time: 0.28, position: [-0.18, 0.12, 0.76], target: [0.02, -0.03, 0], fov: 38 },
        { time: 0.62, position: [0.08, 0.06, 0.56], target: [0.14, -0.03, 0], fov: 32 },
        { time: 1, position: [0.32, 0.14, 0.76], target: [0.06, -0.02, 0], fov: 40 },
      ],
    },
  },
  {
    id: "spill-safety-sweep",
    label: "Check for spill or blocked aisle",
    role: "Store safety robot",
    objective: "Run a low-angle pass through the walkable lane and inspect the floor plane for intervention.",
    route: "Cross-aisle -> floor sweep -> obstacle angle -> exit view",
    evaluationFocus: "Floor visibility, route width, occlusion risk",
    cameraPath: {
      id: "spill-safety-sweep",
      label: "Spill and blockage sweep path",
      keyframes: [
        { time: 0, position: [0.46, 0.16, 1.02], target: [0.14, -0.08, 0], fov: 48 },
        { time: 0.3, position: [0.22, 0.08, 0.72], target: [0.04, -0.13, 0], fov: 40 },
        { time: 0.7, position: [-0.08, 0.02, 0.58], target: [-0.12, -0.15, 0], fov: 35 },
        { time: 1, position: [-0.42, 0.14, 0.86], target: [-0.08, -0.08, 0], fov: 44 },
      ],
    },
  },
  {
    id: "restock-endcap",
    label: "Restock an endcap display",
    role: "Shelf-service humanoid",
    objective: "Approach a promotional shelf zone, inspect the facing, then pull back to a stocking stance.",
    route: "Service lane -> endcap face -> close facing -> stocking stance",
    evaluationFocus: "Shelf alignment, working distance, local collision margin",
    cameraPath: {
      id: "restock-endcap",
      label: "Endcap restock path",
      keyframes: [
        { time: 0, position: [-0.12, 0.26, 1.08], target: [0.02, 0.02, 0], fov: 46 },
        { time: 0.34, position: [0.18, 0.18, 0.78], target: [0.16, 0, 0], fov: 38 },
        { time: 0.68, position: [0.34, 0.08, 0.58], target: [0.22, -0.02, 0], fov: 33 },
        { time: 1, position: [0.04, 0.16, 0.84], target: [0.08, 0, 0], fov: 42 },
      ],
    },
  },
  {
    id: "misplaced-item-return",
    label: "Return a misplaced item",
    role: "Inventory recovery robot",
    objective: "Trace a short recovery route from a scan position to the likely shelf bay and verify placement context.",
    route: "Scan point -> shelf bay -> close placement -> route back",
    evaluationFocus: "Localization, shelf context, reversible path",
    cameraPath: {
      id: "misplaced-item-return",
      label: "Misplaced item return path",
      keyframes: [
        { time: 0, position: [0.2, 0.2, 1.04], target: [-0.02, 0, 0], fov: 45 },
        { time: 0.25, position: [-0.14, 0.16, 0.82], target: [-0.18, -0.02, 0], fov: 39 },
        { time: 0.58, position: [-0.32, 0.08, 0.62], target: [-0.26, -0.04, 0], fov: 34 },
        { time: 1, position: [-0.06, 0.18, 0.82], target: [-0.14, -0.02, 0], fov: 42 },
      ],
    },
  },
];

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
  const [activeEvalTaskId, setActiveEvalTaskId] = useState(groceryEvalTasks[0].id);
  const [cameraPathRunKey, setCameraPathRunKey] = useState(0);
  const preview = site.worldLabsPreview || null;
  const spzUrl = firstPreviewUrl(preview?.spzUrls);
  const plyUrl = firstPreviewUrl(preview?.plyUrls);
  const hasSplatPreview = Boolean(spzUrl || plyUrl);
  const hasProviderFallback = Boolean(preview?.panoUrl || preview?.thumbnailUrl);
  const previewLabel = hasSplatPreview
    ? "Self-hosted sample splat preview"
    : hasProviderFallback
      ? "Provider preview fallback"
      : "Sample/generated preview fallback";
  const previewCopy = hasSplatPreview
    ? "A self-hosted sample splat asset is attached here, so the preview can render in Blueprint's browser viewer instead of an iframe. It is sample/generated media, not customer proof."
    : hasProviderFallback
      ? "The SPZ file is not attached yet, so this module shows the provider preview media while keeping the self-hosted path ready."
      : "No public SPZ is attached to the sample package yet, so this module uses a truthful generated motion-loop preview and keeps the SPZ path ready.";
  const posterFallback =
    preview?.thumbnailUrl ||
    site.presentationReferenceImageUrl ||
    site.runtimeReferenceImageUrl ||
    siteMotionLoopPosterSrc;
  const splatOptions = useMemo(
    () =>
      [
        spzUrl
          ? {
              url: spzUrl,
              label: "Classroom SPZ preview",
              format: "spz" as const,
              detail:
                "Load the self-hosted sample SPZ in-browser. It is a generated classroom splat used to prove the hosted preview path.",
            }
          : null,
        plyUrl
          ? {
              url: plyUrl,
              label: "InteriorGS PLY preview",
              format: "ply" as const,
              detail:
                "Load the InteriorGS PLY splat in-browser. It is dataset media, not Blueprint customer proof.",
            }
          : null,
      ].filter((option): option is NonNullable<typeof option> => Boolean(option)),
    [plyUrl, spzUrl],
  );
  const activeEvalTask =
    groceryEvalTasks.find((task) => task.id === activeEvalTaskId) || groceryEvalTasks[0];
  const runEvalTask = (taskId: string) => {
    setActiveEvalTaskId(taskId);
    setCameraPathRunKey((current) => current + 1);
  };

  const proofRows = [
    ["Reference route", shortId(site.captureId || site.siteSubmissionId)],
    ["Package/proof", shortId(site.pipelinePrefix || site.sceneId)],
    ["Preview state", "Task-conditioned sample path"],
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
              Hosted Site-World Eval Preview
            </p>
            <h2 className="font-editorial mt-4 max-w-[34rem] text-[2.5rem] leading-[0.92] tracking-normal text-white sm:text-[3.35rem]">
              Choose a site task. Inspect the route.
            </h2>
            <p className="mt-5 max-w-[32rem] text-sm leading-7 text-white/74">
              A hosted evaluation would start from a site-specific task, then use the site package
              to inspect local context before live robot work. These grocery tasks drive sample
              camera paths only; they do not claim a real robot policy has completed the task.
            </p>
          </div>

          <div className="mt-6 space-y-2" aria-label="Sample grocery robot task paths">
            {groceryEvalTasks.map((task) => {
              const isActive = task.id === activeEvalTask.id;
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => runEvalTask(task.id)}
                  className={`group w-full border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-white/70 bg-white text-slate-950"
                      : "border-white/12 bg-white/[0.03] text-white hover:border-white/42 hover:bg-white/[0.08]"
                  }`}
                  aria-pressed={isActive}
                >
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      isActive ? "text-slate-500" : "text-white/42"
                    }`}
                  >
                    {task.role}
                  </span>
                  <span className="mt-2 block text-sm font-semibold leading-5">{task.label}</span>
                  <span
                    className={`mt-2 block text-xs leading-5 ${
                      isActive ? "text-slate-600" : "text-white/58"
                    }`}
                  >
                    {task.route}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 divide-y divide-white/12 border-y border-white/12">
            {proofRows.map(([label, value]) => (
              <div key={label} className="grid gap-2 py-2.5 sm:grid-cols-[0.34fr_0.66fr]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">{label}</p>
                <p className="text-sm leading-6 text-white/76">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
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
            splatOptions={splatOptions}
            cameraPath={activeEvalTask.cameraPath}
            cameraPathRunKey={cameraPathRunKey}
            panoUrl={preview?.panoUrl}
            thumbnailUrl={preview?.thumbnailUrl}
            videoSrc={siteMotionLoopVideoSrc}
            posterSrc={posterFallback}
            taskVideoSrc={activeEvalTask.generatedVideo?.src}
            taskVideoPosterSrc={activeEvalTask.generatedVideo?.poster}
            taskVideoLabel={activeEvalTask.generatedVideo?.label}
          />
          <div className="absolute left-4 top-4 max-w-[18rem] border border-white/12 bg-black/38 p-4 text-white backdrop-blur-sm sm:left-5 sm:top-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">
              Active eval task
            </p>
            <p className="mt-3 text-base font-semibold leading-6 text-white">{activeEvalTask.label}</p>
            <p className="mt-3 text-sm leading-6 text-white/74">{activeEvalTask.objective}</p>
            <div className="mt-4 border-t border-white/12 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
                Evaluation focus
              </p>
              <p className="mt-2 text-xs leading-5 text-white/68">{activeEvalTask.evaluationFocus}</p>
            </div>
            <p className="mt-4 text-xs leading-5 text-white/48">
              {previewCopy}
            </p>
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
