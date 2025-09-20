import React, { useCallback, useMemo, useState } from "react";
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

interface DemoVideo {
  src: string;
  poster?: string;
}

interface DemoItem {
  id: string;
  label: string;
  title: string;
  summary: string;
  takeaways: string[];
  video?: DemoVideo;
  cta?: {
    href: string;
    label: string;
  };
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
          "Provision wearables for teams in minutes, not weeks",
          "Bring your existing CRM or ticketing data into the experience",
        ],
        video: {
          src: "https://video-iad3-1.xx.fbcdn.net/o1/v/t2/f2/m366/AQPXC5WLYmWjMl5lVSWuDWN1vu37spzOHlF4uzmw73qP2siqAi2g2mRZdlX4-zjMefiwm8w53KHYOWSzLHCSLMMSgZL-9VR4Bdh5y0IwOkLQbA.mp4?_nc_cat=104&_nc_sid=5e9851&_nc_ht=video-iad3-1.xx.fbcdn.net&_nc_ohc=Xga8QuhljNcQ7kNvwEUN530&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5GQUNFQk9PSy4uQzIuMTI4MC5kYXNoX2gyNjQtYmFzaWMtZ2VuMl83MjBwIiwieHB2X2Fzc2V0X2lkIjoxMTE5NTUwOTAzNjUzNTg3LCJ2aV91c2VjYXNlX2lkIjoxMDEyOCwiZHVyYXRpb25fcyI6NjgsInVybGdlbl9zb3VyY2UiOiJ3d3cifQ%3D%3D&ccb=17-1&vs=1d69130f66cf348a&_nc_vs=HBksFQIYRWZiX2VwaGVtZXJhbC85RDRFODQ4RENCRDRCNTc2MkU3REEwMzAwNUNEQTJBM19tdF8xX3ZpZGVvX2Rhc2hpbml0Lm1wNBUAAsgBEgAVAhhFZmJfZXBoZW1lcmFsLzI4NDhFMkFBQ0U1RjE5MkZBMDQ0RTU0MzJFNTZBN0I2X210XzBfYXVkaW9fZGFzaGluaXQubXA0FQICyAESACgAGAAbAogHdXNlX29pbAExEnByb2dyZXNzaXZlX3JlY2lwZQExFQAAJqbT3J64jv0DFQIoAkMyLBdAUSGp--dsixgZZGFzaF9oMjY0LWJhc2ljLWdlbjJfNzIwcBEAdQJloJ4BAA&_nc_gid=f2vBQE6yFqqnTZ56oNJceA&_nc_zt=28&oh=00_AfZgdKNv9Wd_egNuoyTv156WvGtw62EnoAYuc9QPCbnxxw&oe=68D4CB48&bitrate=1770721&tag=dash_h264-basic-gen2_720p",
          poster:
            "https://scontent-iad3-1.xx.fbcdn.net/v/t39.8562-6/548188212_1699223114095834_542585472648218615_n.png?stp=dst-webp_s750x1000&_nc_cat=108&ccb=1-7&_nc_sid=9a942e&_nc_ohc=kdQCLGFDjuUQ7kNvwH0VWAe&_nc_oc=AdnR21knKGD1DW1U5KTczvt-3bsX9Myfj2IIJFIN7_npAaNv0asqNJvhQJEAMzway2Y&_nc_zt=14&_nc_ht=scontent-iad3-1.xx&_nc_gid=f2vBQE6yFqqnTZ56oNJceA&oh=00_AfaGcWnKflxzSy0fuWqecbmz_uQlcqIHdWXyBVi83WpeMQ&oe=68D4DDA8",
        },
        cta: {
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
        video: {
          src: "https://video-iad3-1.xx.fbcdn.net/o1/v/t2/f2/m366/AQOfbFEXuemitCSyFYMkUleZFnnX8xiyccGYlxigbezBLYSxAJJceU0isMsE2NxlIQkPsNR3HCTXFEgUT38liCMqk-uq2osbvqMlf_CxLl_q3A.mp4?_nc_cat=110&_nc_sid=5e9851&_nc_ht=video-iad3-1.xx.fbcdn.net&_nc_ohc=p0YOfE-XwWUQ7kNvwFTUPI5&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5GQUNFQk9PSy4uQzIuMTI4MC5kYXNoX2gyNjQtYmFzaWMtZ2VuMl83MjBwIiwieHB2X2Fzc2V0X2lkIjoxNzkwOTAzOTUxNTE3MjU5LCJ2aV91c2VjYXNlX2lkIjoxMDEyOCwiZHVyYXRpb25fcyI6NDAsInVybGdlbl9zb3VyY2UiOiJ3d3cifQ%3D%3D&ccb=17-1&vs=107fcb7ec3968498&_nc_vs=HBksFQIYRWZiX2VwaGVtZXJhbC84QTQzREQwQTVBNTgxRTlFRUQzMDc4RDcxOUMwRkY5Ql9tdF8xX3ZpZGVvX2Rhc2hpbml0Lm1wNBUAAsgBEgAVAhhFZmJfZXBoZW1lcmFsL0Q5NEMxRTFDNDlCOTVCQUI3Q0M4OTM2M0NCRTZEMTg2X210XzBfYXVkaW9fZGFzaGluaXQubXA0FQICyAESACgAGAAbAogHdXNlX29pbAExEnByb2dyZXNzaXZlX3JlY2lwZQExFQAAJpaZ252qtK4GFQIoAkMyLBdARAUeuFHrhRgZZGFzaF9oMjY0LWJhc2ljLWdlbjJfNzIwcBEAdQJloJ4BAA&_nc_gid=f2vBQE6yFqqnTZ56oNJceA&_nc_zt=28&oh=00_AfZ5cfadqU_ieErsxdSqDcaD62DIhZbIxgsQWfTf1xq00w&oe=68D4D63A&bitrate=1143813&tag=dash_h264-basic-gen2_720p",
          poster:
            "https://scontent-iad3-2.xx.fbcdn.net/v/t39.8562-6/550056226_2458289637891753_6937586902776504960_n.png?stp=dst-webp_s750x1000&_nc_cat=103&ccb=1-7&_nc_sid=9a942e&_nc_ohc=GFj4OiSseoAQ7kNvwF441sB&_nc_oc=AdnF1fsqD2ijlRLR9s8BMPcLQbz2Ne8qjjQQN9ujjDPXcDSZH8t670WGtSXcjYfnYf8&_nc_zt=14&_nc_ht=scontent-iad3-2.xx&_nc_gid=f2vBQE6yFqqnTZ56oNJceA&oh=00_AfaYsTqvg4YejVDJZ7Mpw195JjwM8eOv7Mb-LSyxBVi5rg&oe=68D4FB9C",
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
        video: {
          src: "https://video-iad3-2.xx.fbcdn.net/o1/v/t2/f2/m366/AQOpB7fAYRH0eAWQPslcVhfP0lXFQJBxJJ-gK6IEgph9LcL7DV5brB_uaFtvh4KnUUnha8CaUhRSq2kOlQSdbj9FIoE4_NVDYb0dVuBZbjr0-Q.mp4?_nc_cat=103&_nc_sid=5e9851&_nc_ht=video-iad3-2.xx.fbcdn.net&_nc_ohc=e3u7iyYJL90Q7kNvwGvlPl0&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5GQUNFQk9PSy4uQzIuNzE4LmRhc2hfaDI2NC1iYXNpYy1nZW4yXzcyMHAiLCJ4cHZfYXNzZXRfaWQiOjE1Nzg2MDI1ODk3NzYxMjQsInZpX3VzZWNhc2VfaWQiOjEwMTI4LCJkdXJhdGlvbl9zIjoxNCwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=9c7770334bf9c4ea&_nc_vs=HBksFQIYRWZiX2VwaGVtZXJhbC8zNjQ2QjE1QjM5MDIwQURFQkI2RTMyRTZCRDUwMTlBMF9tdF8xX3ZpZGVvX2Rhc2hpbml0Lm1wNBUAAsgBEgAVAhhFZmJfZXBoZW1lcmFsLzA4NDlBOTNFQjgxOENDNjg4QjY0OEI0MjQ4MTJFOTlBX210XzBfYXVkaW9fZGFzaGluaXQubXA0FQICyAESACgAGAAbAogHdXNlX29pbAExEnByb2dyZXNzaXZlX3JlY2lwZQExFQAAJvij1-nh7s0FFQIoAkMyLBdALeVgQYk3TBgZZGFzaF9oMjY0LWJhc2ljLWdlbjJfNzIwcBEAdQJloJ4BAA&_nc_gid=f2vBQE6yFqqnTZ56oNJceA&_nc_zt=28&oh=00_AfY9pqKdebFMzqa-dpNOF_cfwAjNR5ixk1yL7Fa4XzE70Q&oe=68D4DEDD&bitrate=6533188&tag=dash_h264-basic-gen2_720p",
          poster:
            "https://scontent-iad3-2.xx.fbcdn.net/v/t39.8562-6/548214674_1187855100030899_2148333067274879233_n.png?stp=dst-webp_s750x1000&_nc_cat=105&ccb=1-7&_nc_sid=9a942e&_nc_ohc=kHN4yUWvewcQ7kNvwGdnmWN&_nc_oc=AdkGvRrZD69Qdj3V5_YdQdvu7SnLZ4ko-RdoV2S8vXoNG8rSwN0AgILRiD9vD27ngFc&_nc_zt=14&_nc_ht=scontent-iad3-2.xx&_nc_gid=f2vBQE6yFqqnTZ56oNJceA&oh=00_AfY-L9KIOhKWtP9Vq2-aoqXZrzOWrStQMAkdGjhcHncTzQ&oe=68D4EC20",
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
        video: {
          src: "https://video-iad3-1.xx.fbcdn.net/o1/v/t2/f2/m366/AQNm8lK0TVyPz0HcEzupngaAUoPzZiQ0DkhC2TWcP6IZWQMRcZIqPA51GRkl3KqzstdTBUtk6aeWbTFwE9-wvwWMtz061Gzkw2ZmQSCYAdojfQ.mp4?_nc_cat=107&_nc_sid=5e9851&_nc_ht=video-iad3-1.xx.fbcdn.net&_nc_ohc=DY0JNq0u_90Q7kNvwHUtlJ3&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5GQUNFQk9PSy4uQzIuNTkwLmRhc2hfaDI2NC1iYXNpYy1nZW4yXzcyMHAiLCJ4cHZfYXNzZXRfaWQiOjcwODQyODg5MjI1MjU3OCwidmlfdXNlY2FzZV9pZCI6MTAxMjgsImR1cmF0aW9uX3MiOjE5LCJ1cmxnZW5fc291cmNlIjoid3d3In0%3D&ccb=17-1&vs=9bf5c8ab7ea8c98c&_nc_vs=HBksFQIYRWZiX2VwaGVtZXJhbC8wRjQ1MkMxNkI2MUUwRkY5OEVEMzJDQzJDMzQ0MkI4M19tdF8xX3ZpZGVvX2Rhc2hpbml0Lm1wNBUAAsgBEgAVAhhFZmJfZXBoZW1lcmFsLzA0NEMxNjhDNzMzQ0E3RUQ5QjkwMjI2NkYwQjc0NTg4X210XzBfYXVkaW9fZGFzaGluaXQubXA0FQICyAESACgAGAAbAogHdXNlX29pbAExEnByb2dyZXNzaXZlX3JlY2lwZQExFQAAJsSmxcf-k8ICFQIoAkMyLBdAM4AAAAAAABgZZGFzaF9oMjY0LWJhc2ljLWdlbjJfNzIwcBEAdQJloJ4BAA&_nc_gid=f2vBQE6yFqqnTZ56oNJceA&_nc_zt=28&oh=00_AfaFXXQlwePix2Zx0QVCeE5enevBvyeoIfR88pIMv-6G1Q&oe=68D4EDC9&bitrate=1750702&tag=dash_h264-basic-gen2_720p",
          poster:
            "https://scontent-iad3-1.xx.fbcdn.net/v/t39.8562-6/550307918_4057713344540556_7233568772010734251_n.png?stp=dst-webp_s750x1000&_nc_cat=104&ccb=1-7&_nc_sid=9a942e&_nc_ohc=nQWR3tzh5WgQ7kNvwEkrV7X&_nc_oc=AdmchPuoQFgzGFZE7oithoIBQSkfk5K9Ddmt6A34QYvOCtxClo31eSxYRGJlpUYxu0c&_nc_zt=14&_nc_ht=scontent-iad3-1.xx&_nc_gid=f2vBQE6yFqqnTZ56oNJceA&oh=00_AfZrOD-dy7kpgHeZNC0KstZcbSDxfIsMC5qAvPUfmRLOZw&oe=68D4F0C8",
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

  return (
    <section
      id="wearableAIDemos"
      className="bg-[#0E172A] py-16 md:py-24 border-t border-white/5"
    >
      <div className="container mx-auto px-4">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)] items-start">
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
                href="https://developers.meta.com/blog/introducing-meta-wearables-device-access-toolkit/"
                target="_blank"
                rel="noreferrer"
              >
                Explore the toolkit updates
              </a>
            </Button>
          </div>

          <div className="space-y-6">
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
                        {activeDemo.video ? (
                          <video
                            key={`${activeDemo.id}-${activeIndex}`}
                            autoPlay
                            muted
                            loop
                            playsInline
                            poster={activeDemo.video.poster}
                            className="h-full w-full object-cover"
                          >
                            <source
                              src={activeDemo.video.src}
                              type="video/mp4"
                            />
                          </video>
                        ) : null}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0E172A] via-transparent to-transparent opacity-60" />
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

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {demos.map((demo, index) => {
                const isActive = index === activeIndex;
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
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-200">
                      {index + 1}
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
