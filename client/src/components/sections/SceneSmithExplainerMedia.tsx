import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SCENESMITH_PAPER_URL,
  SCENESMITH_PROJECT_URL,
  SCENESMITH_REPO_URL,
  scenesmithMedia,
} from "@/data/scenesmithMedia";
import { ExternalLink, Film, FileVideo, Link2 } from "lucide-react";

type FailureState = Record<string, boolean>;

interface SceneSmithExplainerMediaProps {
  id?: string;
}

export default function SceneSmithExplainerMedia({
  id = "videoSection",
}: SceneSmithExplainerMediaProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedMedia, setFailedMedia] = useState<FailureState>({});

  const activeMedia = scenesmithMedia[activeIndex] ?? scenesmithMedia[0];
  const hasFailed = !!failedMedia[activeMedia.id];

  const previewSrc = useMemo(() => {
    if (hasFailed) {
      return activeMedia.fallbackPoster;
    }
    return activeMedia.src;
  }, [activeMedia, hasFailed]);

  const markMediaFailed = (mediaId: string) => {
    setFailedMedia((prev) => ({
      ...prev,
      [mediaId]: true,
    }));
  };

  return (
    <section id={id} className="bg-[#0B1220] py-20 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-wider text-cyan-100">
              <Film className="h-4 w-4 text-cyan-300" />
              SceneSmith Visual Explainers
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              See the pipeline mechanics, not just the claims.
            </h2>
            <p className="text-base leading-relaxed text-slate-300">
              These loops show the same core scene-generation and evaluation flow
              powering Blueprint&apos;s robotics data pipeline. We are embedding
              upstream project visuals first so teams can quickly understand
              workflow, then swapping to custom Blueprint assets in place later.
            </p>

            <div
              data-testid="scenesmith-attribution"
              className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300"
            >
              <p className="font-semibold text-white">Visuals from SceneSmith</p>
              <p>
                Source links:
                {" "}
                <a
                  href={SCENESMITH_REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-cyan-200 underline decoration-cyan-400/50 underline-offset-4 hover:text-cyan-100"
                >
                  GitHub repository
                </a>
                {" "}
                ·
                {" "}
                <a
                  href={SCENESMITH_PAPER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-cyan-200 underline decoration-cyan-400/50 underline-offset-4 hover:text-cyan-100"
                >
                  Project paper
                </a>
                {" "}
                ·
                {" "}
                <a
                  href={SCENESMITH_PROJECT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-cyan-200 underline decoration-cyan-400/50 underline-offset-4 hover:text-cyan-100"
                >
                  Project page
                </a>
              </p>
              <p className="text-xs text-slate-400">
                Externally hosted media may change or become unavailable over
                time; fallback posters are shown automatically if a source fails.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-2xl">
              <div className="aspect-video w-full">
                {activeMedia.kind === "video" && !hasFailed ? (
                  <video
                    className="h-full w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    poster={activeMedia.fallbackPoster}
                    onError={() => markMediaFailed(activeMedia.id)}
                  >
                    <source src={previewSrc} />
                  </video>
                ) : (
                  <img
                    src={previewSrc}
                    alt={activeMedia.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={() => markMediaFailed(activeMedia.id)}
                  />
                )}
              </div>

              <div className="space-y-3 border-t border-white/10 bg-[#0F172A] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                  Explainer
                </p>
                <h3
                  data-testid="scenesmith-spotlight-title"
                  className="text-xl font-semibold text-white"
                >
                  {activeMedia.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  {activeMedia.summary}
                </p>
                <p className="text-xs text-slate-400">{activeMedia.attribution}</p>
                <Button
                  asChild
                  variant="outline"
                  className="border-cyan-300/40 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20 hover:text-white"
                >
                  <a
                    href={activeMedia.sourceHref}
                    target="_blank"
                    rel="noreferrer"
                    data-testid="scenesmith-source-cta"
                  >
                    {activeMedia.sourceLabel}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {scenesmithMedia.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`rounded-xl border p-3 text-left transition ${
                      isActive
                        ? "border-cyan-300/60 bg-cyan-500/10"
                        : "border-white/10 bg-white/5 hover:border-cyan-300/40 hover:bg-white/10"
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                      {item.kind === "video" ? (
                        <FileVideo className="h-3.5 w-3.5" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5" />
                      )}
                      {item.kind === "video" ? "Video" : "Loop"}
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold text-white">
                      {item.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
