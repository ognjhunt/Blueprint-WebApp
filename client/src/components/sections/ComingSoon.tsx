import { Video, Eye, Hand, Sparkles, Clock, ArrowRight, Database, Layers } from "lucide-react";

const comingSoonFeatures = [
  {
    icon: <Video className="h-6 w-6" />,
    title: "First-Person Manipulation Videos",
    description:
      "Photorealistic egocentric footage of hands interacting with objects in your scenes: grasping, opening, sliding, placing.",
  },
  {
    icon: <Database className="h-6 w-6" />,
    title: "Policy-Specific Datasets",
    description:
      "Each scene ships with video data covering multiple manipulation policies: drawer pulls, cabinet opens, pick-and-place sequences, and more.",
  },
  {
    icon: <Eye className="h-6 w-6" />,
    title: "Pretrain Embodied Models",
    description:
      "Use egocentric video for vision-language-action pretraining before fine-tuning on your simulation environments.",
  },
];

export default function ComingSoon() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      {/* Background gradient accent */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-r from-violet-200/30 via-indigo-200/30 to-cyan-200/30 blur-3xl" />
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white/80 backdrop-blur-sm shadow-xl">
        {/* Header Section */}
        <div className="border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white px-8 py-10 sm:px-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-violet-600">
                <Clock className="h-3.5 w-3.5" />
                Coming Soon
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                Future Offerings
              </h2>
              <p className="max-w-2xl text-lg text-zinc-600">
                Extending our SimReady catalog with egocentric video datasets, generated
                from every scene using dynamic world models.
              </p>
            </div>
            <div className="hidden md:block">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-violet-500/20 blur-xl" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
                  <Sparkles className="h-10 w-10 text-violet-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8 sm:p-12">
          {/* DWM Feature Highlight */}
          <div className="mb-12 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/50 p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                    Egocentric Video Data
                  </p>
                  <h3 className="text-2xl font-bold text-zinc-900">
                    More Value from Every Scene
                  </h3>
                </div>
                <p className="text-zinc-600 leading-relaxed">
                  We're using Dynamic World Models to generate first-person manipulation
                  video from each SimReady scene in our catalog. Buy the scene for Isaac Sim
                  training and evaluation, or add egocentric video datasets for pretraining
                  your vision-language-action models.
                </p>
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-semibold text-zinc-900 mb-3">Two ways to use each scene:</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">1</div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900">SimReady USD for simulation</p>
                        <p className="text-xs text-zinc-500">Physics-accurate scenes for RL training & policy evaluation</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">2</div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900">Egocentric video for pretraining</p>
                        <p className="text-xs text-zinc-500">First-person manipulation clips across multiple policies</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Pretraining Data", "Multi-Policy Coverage", "Scene-Matched Pairs"].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                  {/* Visual representation of the data product */}
                  <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                      Example: Kitchen Scene Bundle
                    </p>
                  </div>
                  <div className="p-5 space-y-4">
                    {/* Scene asset */}
                    <div className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100">
                        <Layers className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-zinc-900">kitchen_residential_004.usd</p>
                        <p className="text-xs text-zinc-500">SimReady scene • Isaac Sim compatible</p>
                      </div>
                    </div>

                    {/* Video datasets */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">+ Egocentric Video Packs</p>
                      {[
                        { policy: "Cabinet door opens", clips: "240 clips" },
                        { policy: "Drawer pull sequences", clips: "180 clips" },
                        { policy: "Pick-and-place items", clips: "320 clips" },
                      ].map((item) => (
                        <div key={item.policy} className="flex items-center gap-3 rounded-lg border border-violet-100 bg-violet-50/50 p-2.5">
                          <Video className="h-4 w-4 text-violet-600" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-zinc-800">{item.policy}</p>
                          </div>
                          <span className="text-xs text-violet-600 font-medium">{item.clips}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-3 -right-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm">
                  Bundle & Save
                </div>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid gap-6 md:grid-cols-3">
            {comingSoonFeatures.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-zinc-200 bg-white p-6 transition-all duration-300 hover:border-violet-200 hover:shadow-md"
              >
                <div className="mb-4 inline-flex rounded-xl bg-zinc-100 p-3 text-zinc-700 transition-colors group-hover:bg-violet-100 group-hover:text-violet-600">
                  {feature.icon}
                </div>
                <h4 className="mb-2 text-lg font-bold text-zinc-900">
                  {feature.title}
                </h4>
                <p className="text-sm leading-relaxed text-zinc-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          {/* Research Attribution */}
          <div className="mt-12 flex flex-col items-center justify-between gap-6 rounded-xl border border-zinc-100 bg-zinc-50 p-6 sm:flex-row">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-white p-2 shadow-sm">
                <Sparkles className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  Powered by Dynamic World Models
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Scene-action-conditioned video diffusion for photorealistic egocentric generation.
                </p>
              </div>
            </div>
            <a
              href="/contact?interest=egocentric-video"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Get early access
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
