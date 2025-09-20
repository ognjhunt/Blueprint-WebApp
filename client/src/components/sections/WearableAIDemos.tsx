import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, PlayCircle, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const buildEmbedUrl = (query: string) =>
  `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(
    query,
  )}&modestbranding=1&rel=0&color=white`;

export default function WearableAIDemos() {
  const demos = useMemo(
    () => [
      {
        id: "toolkit-overview",
        label: "Toolkit overview",
        query: "Meta Wearables Device Access Toolkit demo",
        title: "Device Access Toolkit overview",
        summary:
          "How the new tooling connects spatial maps, sensor streams, and AI agents so your staff can orchestrate a venue hands-free.",
        takeaways: [
          "Stream real-time spatial anchors into your own AI flows",
          "Provision wearables for teams in minutes, not weeks",
          "Bring your existing CRM or ticketing data into the experience",
        ],
        cta: {
          href: "https://developers.meta.com/blog/introducing-meta-wearables-device-access-toolkit/",
          label: "Read the announcement",
        },
      },
      {
        id: "ops-insights",
        label: "Operations insights",
        query: "Meta Wearables ambient operations demo",
        title: "Ambient operations for live venues",
        summary:
          "AI agents surface guidance for floor teams, flag service issues, and capture proof-of-performance across every shift.",
        takeaways: [
          "Hands-free checklists with instant verification",
          "Escalations routed to the right person automatically",
          "Metrics dashboards update from what the glasses see",
        ],
        cta: {
          href: "https://www.meta.com/blog/connect-2025-day-2-keynote-recap-vr-development-use-cases-wearable-device-access-toolkit/",
          label: "Keynote recap",
        },
      },
      {
        id: "guest-experience",
        label: "Guest experience",
        query: "Wearable AI concierge demo",
        title: "AI concierge moments for guests",
        summary:
          "See how guided tours, premium retail, and hospitality teams are prototyping guest journeys that adapt to each visitor in real time.",
        takeaways: [
          "Trigger narratives from geofenced anchors",
          "Upsell add-ons with context-aware prompts",
          "Support multilingual guests on the fly",
        ],
        cta: {
          href: "https://developers.meta.com/wearables/faq",
          label: "Toolkit FAQ",
        },
      },
    ],
    [],
  );

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
                We curate the best examples from the new wearable device access toolkits so your team can see what is possible for retail floors, cultural venues, and guest-driven destinations. No vendor lock-in—use any smart glasses launching this year.
              </p>
            </div>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" />
                <span>Built to help location owners pilot safely with enterprise policies, privacy controls, and flexible integrations.</span>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" />
                <span>Blueprint packages these demos with onboarding, staff training, and analytics dashboards from day one.</span>
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

          <div className="grid gap-6 lg:grid-cols-1">
            {demos.map((demo, index) => (
              <motion.div
                key={demo.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                viewport={{ once: true, amount: 0.3 }}
                className="h-full"
              >
                <Card className="bg-white/5 border-white/10 backdrop-blur-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className="aspect-video bg-black/60">
                      <iframe
                        title={`${demo.title} video`}
                        src={buildEmbedUrl(demo.query)}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full border-0"
                      />
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
                        <PlayCircle className="h-4 w-4" />
                        {demo.label}
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-white">{demo.title}</h3>
                        <p className="text-sm md:text-base text-slate-300">
                          {demo.summary}
                        </p>
                      </div>
                      <ul className="grid gap-2 text-sm text-slate-300">
                        {demo.takeaways.map((point) => (
                          <li
                            key={point}
                            className="flex items-start gap-2"
                          >
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                      <div>
                        <Button
                          asChild
                          variant="link"
                          className="px-0 text-emerald-200 hover:text-emerald-100"
                        >
                          <a href={demo.cta.href} target="_blank" rel="noreferrer">
                            {demo.cta.label}
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
