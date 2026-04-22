import { Bell, Lock, Search, ShieldCheck } from "lucide-react";
import { SEO } from "@/components/SEO";
import {
  SurfaceBrowserFrame,
  SurfaceButton,
  SurfaceCard,
  SurfaceMiniLabel,
  SurfacePage,
  SurfaceSection,
  SurfaceSidebar,
  SurfaceTopBar,
} from "@/components/site/privateSurface";
import { privateGeneratedAssets } from "@/lib/privateGeneratedAssets";

const queueCards = [
  {
    title: "Protected Request 01",
    location: "Private facility review",
    score: "72",
    meta: ["Under review", "High priority", "Protected"],
    image: privateGeneratedAssets.privateFacilityAerial,
  },
  {
    title: "Protected Request 02",
    location: "Evidence package intake",
    score: "58",
    meta: ["Evidence pending", "Standard"],
    image: privateGeneratedAssets.facilityPlanBoard,
  },
  {
    title: "Protected Request 03",
    location: "Hosted review preparation",
    score: "81",
    meta: ["Ready for review", "Priority"],
    image: privateGeneratedAssets.privateFacilityAerial,
  },
] as const;

const railItems = ["Portal", "Requests", "Assignments", "Calendar", "Compliance", "Reports"] as const;

export default function Portal() {
  return (
    <>
      <SEO
        title="Portal | Blueprint"
        description="Private operations hub for protected Blueprint requests, assignments, and review workflows."
        canonical="/portal"
        noIndex
      />

      <SurfacePage>
        <SurfaceTopBar eyebrow="Private Workspace" rightLabel="Invite Only" />
        <SurfaceSection className="py-8">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <SurfaceMiniLabel>Portal</SurfaceMiniLabel>
              <h1 className="mt-4 text-[3.6rem] font-semibold tracking-[-0.08em] leading-[0.92]">
                Private operations hub
              </h1>
              <p className="mt-3 max-w-[36rem] text-base leading-8 text-black/62">
                Protected request queue, assignment overview, and compliance context for invite-only
                Blueprint workflows.
              </p>
            </div>
            <div className="hidden rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black/62 lg:flex lg:items-center lg:gap-3">
              <Lock className="h-4 w-4" />
              Guest view
            </div>
          </div>

          <SurfaceBrowserFrame dark className="border-black/0 shadow-[0_30px_120px_rgba(0,0,0,0.14)]">
            <div className="grid xl:grid-cols-[0.18fr_0.82fr]">
              <div className="border-r border-white/10 bg-[#0f0f0e] p-5">
                <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
                  <SurfaceMiniLabel className="text-white/46">Private workspace</SurfaceMiniLabel>
                  <p className="mt-3 text-sm font-semibold text-white">Invite-only surface</p>
                </div>
                <div className="mt-5 space-y-2">
                  {railItems.map((item, index) => (
                    <div
                      key={item}
                      className={`rounded-[1rem] px-3 py-2.5 text-sm ${
                        index === 0 ? "bg-white/12 font-semibold text-white" : "text-white/58"
                      }`}
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <SurfaceMiniLabel className="text-white/46">Protected access</SurfaceMiniLabel>
                  <p className="mt-3 text-sm leading-7 text-white/64">
                    Queue contents, exports, and downstream review state remain visible only to
                    authenticated operators.
                  </p>
                </div>
              </div>

              <div className="bg-[#f8f4ed] p-6 lg:p-7">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="relative min-w-[18rem] flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/32" />
                    <input
                      readOnly
                      value=""
                      placeholder="Search requests, sites, IDs, assignees..."
                      className="h-12 w-full rounded-[1rem] border border-black/10 bg-white pl-11 pr-4 text-sm outline-none placeholder:text-black/34"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white">
                      <Bell className="h-4 w-4 text-black/48" />
                    </div>
                    <SurfaceButton className="px-4">New request</SurfaceButton>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.35fr]">
                  <div className="space-y-4">
                    {queueCards.map((card) => (
                      <div key={card.title} className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-white">
                        <div className="grid md:grid-cols-[0.32fr_0.68fr]">
                          <img src={card.image} alt={card.title} className="h-full min-h-[12rem] w-full object-cover" />
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <SurfaceMiniLabel>Request queue</SurfaceMiniLabel>
                                <p className="mt-3 text-[1.9rem] font-semibold tracking-[-0.05em]">{card.title}</p>
                                <p className="mt-2 text-sm text-black/54">{card.location}</p>
                              </div>
                              <div className="text-right">
                                <SurfaceMiniLabel>Trust score</SurfaceMiniLabel>
                                <p className="mt-2 text-[2rem] font-semibold tracking-[-0.06em]">{card.score}</p>
                              </div>
                            </div>
                            <div className="mt-5 flex flex-wrap gap-2">
                              {card.meta.map((item) => (
                                <span key={item} className="rounded-full border border-black/10 bg-[#faf7f1] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/54">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <SurfaceCard className="bg-white">
                      <SurfaceMiniLabel>Request metadata</SurfaceMiniLabel>
                      <p className="mt-4 text-sm leading-7 text-black/60">
                        Representative private-surface layout for review queues, deadlines,
                        assignment, and protection state.
                      </p>
                    </SurfaceCard>
                    <SurfaceCard className="bg-white">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-4.5 w-4.5 text-black/54" />
                        <SurfaceMiniLabel>Compliance</SurfaceMiniLabel>
                      </div>
                      <p className="mt-4 text-sm leading-7 text-black/60">
                        All request data is protected and access is strictly role-scoped.
                      </p>
                    </SurfaceCard>
                  </div>
                </div>
              </div>
            </div>
          </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
    </>
  );
}
