import { Video, Eye, Hand, Sparkles, Clock, ArrowRight } from "lucide-react";

const comingSoonFeatures = [
  {
    icon: <Video className="h-6 w-6" />,
    title: "Egocentric Video Generation",
    description:
      "Generate first-person manipulation videos directly from your SimReady scenes. Watch virtual hands interact with objects in photorealistic detail.",
  },
  {
    icon: <Hand className="h-6 w-6" />,
    title: "Dexterous Action Synthesis",
    description:
      "Model how human hands grasp, open, slide, and manipulate objects. Perfect for training embodied AI and validating manipulation policies.",
  },
  {
    icon: <Eye className="h-6 w-6" />,
    title: "Interactive Digital Twins",
    description:
      "Transform static 3D reconstructions into dynamic environments. See how scenes respond to manipulation before deploying real robots.",
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
                Extending our SimReady pipeline with video diffusion-based world models
                for embodied simulation and egocentric action synthesis.
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
            <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                    Powered by Dynamic World Models
                  </p>
                  <h3 className="text-2xl font-bold text-zinc-900">
                    Egocentric Video from Every Scene
                  </h3>
                </div>
                <p className="text-zinc-600 leading-relaxed">
                  Using advances in scene-action-conditioned video diffusion, we're building
                  the capability to generate first-person interaction videos from any SimReady
                  scene in your library. Upload a scene, specify a manipulation trajectory,
                  and receive photorealistic egocentric video of hands interacting with objects.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Video Diffusion", "Hand Tracking", "Scene Dynamics", "Sim2Real"].map((tag) => (
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
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900 p-1 shadow-lg">
                  <div className="rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-red-500" />
                      <span className="h-3 w-3 rounded-full bg-yellow-500" />
                      <span className="h-3 w-3 rounded-full bg-green-500" />
                      <span className="ml-4 text-xs text-zinc-500 font-mono">dwm_pipeline.py</span>
                    </div>
                    <pre className="text-xs text-zinc-300 overflow-x-auto font-mono">
                      <code>{`# Generate egocentric video from scene
from blueprint import DWMPipeline

pipeline = DWMPipeline()

# Load your SimReady scene
scene = pipeline.load_scene("kitchen_001.usd")

# Define hand trajectory for interaction
trajectory = pipeline.plan_grasp(
    target="cabinet_door_handle",
    action="pull_open"
)

# Generate egocentric video
video = pipeline.generate(
    scene=scene,
    hand_trajectory=trajectory,
    frames=120,
    fps=30
)

video.export("interaction_demo.mp4")`}</code>
                    </pre>
                  </div>
                </div>
                <div className="absolute -bottom-3 -right-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm">
                  Preview API
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
                  Built on Dexterous World Models Research
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Leveraging video diffusion breakthroughs for embodied simulation and egocentric action synthesis.
                </p>
              </div>
            </div>
            <a
              href="/contact?interest=dwm-preview"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Join waitlist
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
