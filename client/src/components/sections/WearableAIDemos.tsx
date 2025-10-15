import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  PlayCircle,
  ExternalLink,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Media model supports either YouTube or a direct MP4.
 * We use youtube-nocookie embeds for stable hosting and autoplay reliability.
 */
type DemoMedia =
  | {
      kind: "youtube";
      /** The YouTube video ID, e.g. "xlViEqrQG3s" */
      id: string;
      /** Optional poster for thumbnail tiles; falls back to ytimg if omitted */
      poster?: string;
    }
  | {
      kind: "mp4";
      src: string;
      poster?: string;
    };

interface DemoItem {
  id: string;
  label: string;
  title: string;
  summary: string;
  takeaways: string[];
  media?: DemoMedia;
  cta?: {
    href: string;
    label: string;
  };
}

/**
 * Renders either a <video> element (for MP4) or a YouTube iframe.
 * - For MP4: mutes + plays inline + attempts autoplay on ready.
 * - For YouTube: uses autoplay=1&mute=1&playsinline=1&loop=1&playlist=<id>
 * The `mediaKey` ensures we hard-reload on index change for reliable autoplay.
 */
function DemoPlayer({
  media,
  mediaKey,
  className,
  onReady,
}: {
  media?: DemoMedia;
  mediaKey: string;
  className?: string;
  onReady?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!media || media.kind !== "mp4") return;
    const el = videoRef.current;
    if (!el) return;

    const tryPlay = () => {
      el.muted = true;
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.catch(() => {
          // If autoplay fails, we leave it muted with a first-frame poster showing.
          // User can still click to start if controls are added later.
        });
      }
    };

    const onCanPlay = () => {
      tryPlay();
      onReady?.();
    };

    tryPlay();
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("loadeddata", onCanPlay);
    return () => {
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("loadeddata", onCanPlay);
    };
  }, [media, mediaKey, onReady]);

  if (!media) return null;

  if (media.kind === "youtube") {
    const { id } = media;
    // Autoplay on selection; loop requires playlist param with the same id.
    const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${id}&rel=0&modestbranding=1&controls=0`;
    return (
      <iframe
        key={mediaKey}
        src={src}
        title="Demo video"
        className={className}
        loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }

  // MP4 fallback path if you ever add a stable .mp4 asset
  return (
    <video
      key={mediaKey}
      ref={videoRef}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={media.poster}
      className={className}
      // controls // Uncomment if you want visible controls for MP4 sources
    >
      <source src={media.src} type="video/mp4" />
    </video>
  );
}

export default function WearableAIDemos() {
  const demos = useMemo<DemoItem[]>(
    () => [
      {
        id: "toolkit-overview",
        label: "Toolkit overview",
        title: "Device Access Toolkit overview",
        summary:
          "How the new tooling connects spatial maps, sensor streams, and AI agents so your staff can orchestrate a venue hands-free.",
        takeaways: [
          "Stream real-time spatial anchors into your own AI flows",
          "Provision wearables for teams in minutes, not days",
          "Bring your existing CRM or ticketing data into the experience",
        ],
        media: {
          // Official Meta Developers short overview video
          // https://www.youtube.com/watch?v=xlViEqrQG3s
          kind: "youtube",
          id: "xlViEqrQG3s",
        },
        cta: {
          // Official announcement (Meta Developers blog)
          href: "https://developers.meta.com/blog/introducing-meta-wearables-device-access-toolkit/",
          label: "Read the announcement",
        },
      },
      {
        id: "ops-insights",
        label: "Operations insights",
        title: "Ambient operations for live venues",
        summary:
          "AI agents surface guidance for floor teams, flag service issues, and capture proof-of-performance across every shift.",
        takeaways: [
          "Hands-free checklists with instant verification",
          "Escalations routed to the right person automatically",
          "Metrics dashboards update from what the glasses see",
        ],
        media: {
          // Meta Connect 2025 Keynote Highlights
          // https://www.youtube.com/watch?v=DVPBtodhAaA
          kind: "youtube",
          id: "DVPBtodhAaA",
        },
        cta: {
          href: "https://www.meta.com/blog/connect-2025-day-2-keynote-recap-vr-development-use-cases-wearable-device-access-toolkit/",
          label: "Keynote recap",
        },
      },
      {
        id: "guest-experience",
        label: "Guest experience",
        title: "AI concierge moments for guests",
        summary:
          "See how guided tours, premium retail, and hospitality teams are prototyping guest journeys that adapt to each visitor in real time.",
        takeaways: [
          "Trigger narratives from geofenced anchors",
          "Upsell add-ons with context-aware prompts",
          "Support multilingual guests on the fly",
        ],
        media: {
          // Developer Voices session highlighting real-world use cases
          // https://www.youtube.com/watch?v=BeAPM1MB61k
          kind: "youtube",
          id: "BeAPM1MB61k",
        },
        cta: {
          href: "https://developers.meta.com/wearables/faq",
          label: "Toolkit FAQ",
        },
      },
      {
        id: "staff-training",
        label: "Staff training",
        title: "Rapid onboarding for frontline teams",
        summary:
          "Show how wearable prompts guide staff through safety checklists, guest recovery moments, and upsell opportunities from day one.",
        takeaways: [
          "Role-based guidance with secure sign-on",
          "Session replays capture what teams learn",
          "Integrates with LMS and workforce platforms",
        ],
        media: {
          // Developer Preview deep-dive
          // https://www.youtube.com/watch?v=U0Ha6AmXBS0
          kind: "youtube",
          id: "U0Ha6AmXBS0",
        },
        cta: {
          href: "https://developers.meta.com/wearables/faq",
          label: "See FAQ guidance",
        },
      },
    ],
    [],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const activeDemo = demos[activeIndex];

  const goTo = useCallback(
    (direction: "next" | "prev") => {
      setActiveIndex((prev) => {
        if (direction === "next") {
          return (prev + 1) % demos.length;
        }
        return (prev - 1 + demos.length) % demos.length;
      });
    },
    [demos.length],
  );

  const selectIndex = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  // Optional: pause autoplay if the card scrolls out of view (accessibility courtesy)
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [inViewport, setInViewport] = useState(true);
  useEffect(() => {
    const node = containerRef.current;
    if (!node || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setInViewport(entry?.isIntersecting ?? true);
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Changing this key forces a reload so the selected video autoplays immediately.
  const mediaKey = `${activeDemo.id}-${activeIndex}-${inViewport ? "in" : "out"}`;

  return (
    <section
      id="wearableAIDemos"
      className="bg-[#0E172A] py-16 md:py-24 border-t border-white/5"
    >
      <div className="container mx-auto px-4">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)] items-start">
          {/* Left column: section copy */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wide text-slate-200">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              Wearable AI in-market demos
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-black leading-tight text-white">
                Prototype-ready experiences for every kind of location
              </h2>
              <p className="text-slate-300 text-base md:text-lg max-w-xl">
                We curate the best examples from the new wearable device access
                toolkits so your team can see what is possible for retail
                floors, cultural venues, and guest-driven destinations. No
                vendor lock-in—use any smart glasses launching this year.
              </p>
            </div>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" />
                <span>
                  Built to help location owners pilot safely with enterprise
                  policies, privacy controls, and flexible integrations.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" />
                <span>
                  Blueprint packages these demos with onboarding, staff
                  training, and analytics dashboards from day one.
                </span>
              </div>
            </div>
            <Button
              asChild
              variant="secondary"
              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 border border-emerald-400/40"
            >
              <a
                href="https://developers.meta.com/wearables/"
                target="_blank"
                rel="noreferrer"
              >
                Explore the toolkit updates
              </a>
            </Button>
          </div>

          {/* Right column: media + details */}
          <div className="space-y-6" ref={containerRef}>
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="relative">
                  <div className="aspect-video bg-black/60">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={activeDemo.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35 }}
                        className="h-full w-full"
                      >
                        {activeDemo.media ? (
                          <DemoPlayer
                            media={activeDemo.media}
                            mediaKey={mediaKey}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Gradient overlay for readability */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0E172A] via-transparent to-transparent opacity-60" />

                  {/* Prev/next buttons */}
                  <div className="absolute inset-y-0 left-0 flex items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => goTo("prev")}
                      className="pointer-events-auto ml-3 rounded-full border border-white/20 bg-black/40 text-white/80 hover:bg-white/10"
                      aria-label="Previous demo"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="absolute inset-y-0 right-0 flex items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => goTo("next")}
                      className="pointer-events-auto mr-3 rounded-full border border-white/20 bg-black/40 text-white/80 hover:bg-white/10"
                      aria-label="Next demo"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Details panel */}
                <div className="p-6 space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
                    <PlayCircle className="h-4 w-4" />
                    {activeDemo.label}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-white">
                      {activeDemo.title}
                    </h3>
                    <p className="text-sm md:text-base text-slate-300">
                      {activeDemo.summary}
                    </p>
                  </div>
                  <ul className="grid gap-2 text-sm text-slate-300">
                    {activeDemo.takeaways.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  {activeDemo.cta ? (
                    <div>
                      <Button
                        asChild
                        variant="link"
                        className="px-0 text-emerald-200 hover:text-emerald-100"
                      >
                        <a
                          href={activeDemo.cta.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {activeDemo.cta.label}
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Selector tiles */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {demos.map((demo, index) => {
                const isActive = index === activeIndex;
                // Derive a YouTube thumbnail if using YT
                const thumb =
                  demo.media?.kind === "youtube"
                    ? (demo.media.poster ??
                      `https://i.ytimg.com/vi/${demo.media.id}/hqdefault.jpg`)
                    : demo.media?.poster;

                return (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => selectIndex(index)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      isActive
                        ? "border-emerald-300/60 bg-emerald-300/10 text-white"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-emerald-300/30 hover:text-white"
                    }`}
                    aria-pressed={isActive}
                  >
                    <span className="relative flex-shrink-0 h-9 w-9 overflow-hidden rounded-full bg-emerald-400/10 text-emerald-200">
                      {thumb ? (
                        // tiny circular preview
                        <img
                          src={thumb}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          {index + 1}
                        </span>
                      )}
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">{demo.label}</p>
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {demo.summary}
                      </p>
                    </div>
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
