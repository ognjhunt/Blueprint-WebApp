import { SEO } from "@/components/SEO";
import {
  Book,
  Box,
  Cpu,
  Layers,
  ArrowRight,
  Zap,
  RefreshCw,
  Settings2,
  Eye,
  Target,
  Shuffle,
  FileCode,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Database,
  Clock,
} from "lucide-react";

// --- Glossary Terms ---
const glossaryTerms = [
  {
    term: "SimReady",
    definition:
      "An NVIDIA specification for 3D assets optimized for physics simulation. SimReady assets include precise geometry, physics properties (mass, inertia, friction), collision meshes, and material definitions that enable accurate robotic training in simulators like Isaac Sim.",
    category: "Standards",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    term: "Sim2Real Transfer",
    definition:
      "The process of transferring a policy or model trained in simulation to a real-world robot. Success depends on how well the simulation matches reality—including physics accuracy, visual fidelity, and sensor noise modeling.",
    category: "Training",
    icon: <ArrowRight className="h-5 w-5" />,
  },
  {
    term: "Domain Randomization",
    definition:
      "A technique where simulation parameters (lighting, textures, object positions, physics properties) are randomly varied during training. This forces the model to learn robust features that transfer better to the unpredictable real world.",
    category: "Training",
    icon: <Shuffle className="h-5 w-5" />,
  },
  {
    term: "USD (Universal Scene Description)",
    definition:
      "Pixar's open-source scene description format, now the standard for robotics simulation. USD enables non-destructive layering, physics schemas, and efficient streaming of large environments. Isaac Sim uses USD as its native format.",
    category: "Formats",
    icon: <FileCode className="h-5 w-5" />,
  },
  {
    term: "URDF (Unified Robot Description Format)",
    definition:
      "An XML format for describing robot models including links, joints, and dynamics. URDF is widely used in ROS (Robot Operating System) and is the standard for defining robot kinematics and dynamics.",
    category: "Formats",
    icon: <FileCode className="h-5 w-5" />,
  },
  {
    term: "Isaac Sim",
    definition:
      "NVIDIA's robotics simulation platform built on Omniverse. It provides photorealistic rendering, accurate physics simulation, synthetic data generation, and direct integration with ROS/ROS2 for training and testing robotic systems.",
    category: "Platforms",
    icon: <Cpu className="h-5 w-5" />,
  },
  {
    term: "MuJoCo",
    definition:
      "Multi-Joint dynamics with Contact. A fast, accurate physics engine designed for model-based control and reinforcement learning research. Known for its stability with complex contact dynamics and articulated bodies.",
    category: "Platforms",
    icon: <Cpu className="h-5 w-5" />,
  },
  {
    term: "Digital Twin",
    definition:
      "A virtual replica of a physical environment or system. In robotics, digital twins enable testing policies in simulation before real-world deployment, reducing risk and iteration time.",
    category: "Concepts",
    icon: <Layers className="h-5 w-5" />,
  },
  {
    term: "Collision Mesh / Collider",
    definition:
      "A simplified geometry used for physics collision detection. Well-authored colliders are watertight, convex where possible, and optimized for performance while maintaining accuracy for contact-rich manipulation tasks.",
    category: "Physics",
    icon: <Box className="h-5 w-5" />,
  },
  {
    term: "Articulation",
    definition:
      "The connection of rigid bodies through joints (revolute, prismatic, fixed). Proper articulation in simulation requires accurate joint limits, friction coefficients, and drive parameters for realistic behavior.",
    category: "Physics",
    icon: <Settings2 className="h-5 w-5" />,
  },
  {
    term: "Physics Materials",
    definition:
      "Properties assigned to surfaces that define how objects interact: friction (static/dynamic), restitution (bounciness), and density. Critical for realistic contact behavior in manipulation tasks.",
    category: "Physics",
    icon: <Zap className="h-5 w-5" />,
  },
  {
    term: "Perception Training",
    definition:
      "Training computer vision models (object detection, segmentation, pose estimation) using synthetic data. Simulation allows generating vast labeled datasets with perfect ground truth annotations.",
    category: "Training",
    icon: <Eye className="h-5 w-5" />,
  },
  {
    term: "Policy",
    definition:
      "In reinforcement learning, a policy is a mapping from observations to actions. Policies are trained in simulation to perform tasks like grasping, navigation, or manipulation, then deployed to real robots.",
    category: "Training",
    icon: <Target className="h-5 w-5" />,
  },
  {
    term: "Replicator",
    definition:
      "NVIDIA's synthetic data generation framework in Isaac Sim. It enables automated domain randomization, camera placement, and annotation generation for training perception models at scale.",
    category: "Tools",
    icon: <RefreshCw className="h-5 w-5" />,
  },
];

// --- FAQ Items ---
const faqItems = [
  {
    question: "Why can't I just use any 3D model for robotics simulation?",
    answer:
      "Standard 3D models are optimized for visual rendering, not physics simulation. They often have non-watertight geometry, incorrect scale, missing mass/inertia properties, no collision meshes, and unvalidated joint definitions. These issues cause physics instabilities, unrealistic behavior, and policies that fail to transfer to real robots.",
  },
  {
    question: "What makes a scene 'SimReady'?",
    answer:
      "SimReady scenes include: precise geometry with sub-millimeter tolerances, physics-accurate collision meshes, validated articulation with joint limits and friction, correct mass and inertia tensors, PBR materials with physics properties, and semantic annotations for perception training.",
  },
  {
    question: "How do I know if my simulation will transfer to reality?",
    answer:
      "The sim2real gap is minimized by: accurate physics parameters, domain randomization during training, sensor noise modeling, and using environments that closely match your deployment context. Our marketplace scenes are validated for sim2real transfer in our QA pipeline.",
  },
  {
    question: "What's the difference between USD and URDF?",
    answer:
      "URDF is specifically for robot descriptions (kinematic chains, actuators). USD is a general scene description format that can contain environments, props, lighting, and robots. Isaac Sim converts URDF robots to USD and places them in USD environments for training.",
  },
  {
    question: "Do I need expensive hardware for simulation?",
    answer:
      "Basic RL training can run on consumer GPUs. Photorealistic rendering and large-scale parallel simulation benefit from RTX GPUs. Cloud options (AWS, GCP with NVIDIA instances) are available for teams without local hardware.",
  },
  {
    question: "How much training data do I need?",
    answer:
      "For perception: typically 10K-100K diverse synthetic images. For RL policies: millions of environment steps (achievable in hours with parallel simulation). Our scenes include domain randomization configs that maximize data diversity.",
  },
];

// --- Process Steps ---
const processSteps = [
  {
    number: "01",
    title: "Choose Your Environment",
    description:
      "Browse our marketplace for pre-built SimReady scenes matching your deployment context (kitchens, warehouses, labs, retail). Each scene includes physics metadata and task scaffolds.",
  },
  {
    number: "02",
    title: "Configure Domain Randomization",
    description:
      "Use included Replicator scripts to randomize lighting, textures, object positions, and physics parameters. This builds robustness into your trained models.",
  },
  {
    number: "03",
    title: "Train Your Policy",
    description:
      "Load scenes in Isaac Sim or MuJoCo. Our task logic includes action/observation spaces, reward functions, and parallel environment configs for vectorized RL training.",
  },
  {
    number: "04",
    title: "Deploy to Reality",
    description:
      "Transfer your trained policy to real hardware. Our sim2real validation notes help you understand expected transfer quality and fine-tuning requirements.",
  },
];

export default function Learn() {
  const categories = [...new Set(glossaryTerms.map((t) => t.category))];

  return (
    <>
      <SEO
        title="Getting Started with Simulation | Blueprint"
        description="Learn the fundamentals of robotics simulation: how simulation complements real-world data, SimReady assets, sim2real transfer, domain randomization, and more. A comprehensive guide for teams new to simulated robotic training."
        canonical="/learn"
      />
      <div className="relative min-h-screen bg-white font-sans text-zinc-900">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 to-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-1.5 text-sm font-medium text-indigo-600">
                <Book className="h-4 w-4" />
                Educational Resource
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
                Getting Started with Simulation
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-zinc-600">
                Whether you're a robotics lab exploring sim2real training or an
                engineer evaluating synthetic data pipelines, this guide covers
                the essential concepts you need to understand.
              </p>
            </div>
          </div>
        </section>

        {/* Simulation as Complement Section */}
        <section className="py-16 bg-gradient-to-r from-emerald-50 to-indigo-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 mb-4">
                  <TrendingUp className="h-3 w-3" />
                  Key Insight
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                  Simulation Complements Real-World Data
                </h2>
                <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
                  The most successful robotics teams don't choose between simulation and
                  real-world data—they use both. Simulation provides the scale and diversity
                  your models need, while real data anchors them to reality.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    { icon: <TrendingUp className="h-4 w-4" />, text: "38% average performance boost when combining sim + real data" },
                    { icon: <Clock className="h-4 w-4" />, text: "27x faster data generation than human teleop" },
                    { icon: <Database className="h-4 w-4" />, text: "10,000x more edge case coverage than real capture alone" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-zinc-700">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        {item.icon}
                      </span>
                      {item.text}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <a
                    href="/why-simulation"
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    Learn Why Simulation Matters
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-6">
                  The Complement Model
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 rounded-xl bg-emerald-50 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <Database className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900">Simulation Data</p>
                      <p className="text-sm text-zinc-600">Scale, diversity, edge cases</p>
                    </div>
                    <p className="ml-auto text-2xl font-bold text-emerald-600">99%</p>
                  </div>
                  <div className="flex items-center justify-center text-zinc-300">
                    <span className="text-2xl">+</span>
                  </div>
                  <div className="flex items-center gap-4 rounded-xl bg-indigo-50 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      <Target className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900">Real-World Data</p>
                      <p className="text-sm text-zinc-600">Reality anchoring, validation</p>
                    </div>
                    <p className="ml-auto text-2xl font-bold text-indigo-600">1%</p>
                  </div>
                  <div className="flex items-center justify-center text-zinc-300">
                    <span className="text-2xl">=</span>
                  </div>
                  <div className="rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 p-4 text-white text-center">
                    <p className="text-lg font-bold">Better Real-World Performance</p>
                    <p className="text-sm opacity-90">Research-backed optimal mix</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Start Process */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                How Simulation Training Works
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                From scene selection to real-world deployment in four steps
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {processSteps.map((step) => (
                <div
                  key={step.number}
                  className="relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <span className="mb-4 block font-mono text-2xl font-bold text-indigo-600">
                    {step.number}
                  </span>
                  <h3 className="mb-2 text-lg font-bold text-zinc-900">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-600">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Glossary */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                Essential Glossary
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                Key terms and concepts for robotics simulation
              </p>
            </div>

            {categories.map((category) => (
              <div key={category} className="mb-12">
                <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-zinc-400">
                  {category}
                </h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {glossaryTerms
                    .filter((t) => t.category === category)
                    .map((term) => (
                      <div
                        key={term.term}
                        className="group rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-md"
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                            {term.icon}
                          </div>
                          <h4 className="text-lg font-bold text-zinc-900">
                            {term.term}
                          </h4>
                        </div>
                        <p className="text-sm leading-relaxed text-zinc-600">
                          {term.definition}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-zinc-100 bg-zinc-50/50 py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                Frequently Asked Questions
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                Common questions from teams new to simulation
              </p>
            </div>

            <div className="space-y-6">
              {faqItems.map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-zinc-200 bg-white p-6"
                >
                  <h3 className="mb-3 text-lg font-bold text-zinc-900">
                    {item.question}
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-600">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-zinc-950 px-8 py-16 text-center shadow-2xl sm:px-16">
              <div className="absolute top-0 right-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-indigo-900/30 blur-3xl" />
              <div className="absolute bottom-0 left-0 -mb-12 -ml-12 h-64 w-64 rounded-full bg-emerald-900/20 blur-3xl" />

              <div className="relative z-10">
                <h2 className="text-3xl font-bold text-white sm:text-4xl">
                  Ready to explore SimReady scenes?
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
                  Browse our marketplace for physics-accurate environments with
                  domain randomization configs, task logic, and sim2real
                  validation notes.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
                  <a
                    href="/marketplace"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Browse Marketplace
                  </a>
                  <a
                    href="/solutions"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
                  >
                    Learn More About Solutions
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
