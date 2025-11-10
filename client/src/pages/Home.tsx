import { CTAButtons } from "@/components/site/CTAButtons";
import { LogoWall } from "@/components/site/LogoWall";
import { TileGrid } from "@/components/site/TileGrid";
import { WaitlistForm } from "@/components/site/WaitlistForm";
import { environmentCategories } from "@/data/content";

const whySimReady = [
  {
    title: "Contact-accurate geometry",
    description:
      "Watertight topology with sub-millimeter tolerances so perception and policy transfer hold up.",
  },
  {
    title: "Correct pivots & joints",
    description:
      "Every articulated component ships with validated axes, limits, and authored USD skeletons.",
  },
  {
    title: "USD + Isaac-ready",
    description:
      "Physics materials, collision proxies, and semantic schemas tuned for Isaac Sim out of the box.",
  },
];

const labBullets = [
  "Articulated containers (doors, drawers, racks)",
  "Pick-place props with clean colliders",
  "USD stages validated in Isaac",
  "Replicator-ready semantics on request",
];

const artistBullets = [
  "Join a network shipping scenes to leading labs",
  "Focus on fidelity—we’ll handle the pipeline",
  "Paid per scene, bonuses for articulation coverage",
];

export default function Home() {
  return (
    <div className="space-y-24 pb-24">
      <section className="mx-auto grid max-w-6xl gap-16 px-4 pt-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-10">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-500">
              SimReady Environment Network
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
              SimReady worlds for robotic training.
            </h1>
            <p className="max-w-xl text-lg text-slate-600">
              High-fidelity scenes, physics-clean assets, delivered fast. Blueprint finishes procedural and real-world environments so your robots can prove ROI in simulation before hardware hits the floor.
            </p>
          </div>
          <CTAButtons
            primaryHref="/environments"
            primaryLabel="Browse Environment Network"
            secondaryHref="/contact"
            secondaryLabel="Request a Scene"
          />
          <LogoWall />
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-10">
          <div className="absolute -top-24 right-8 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="relative space-y-6 text-sm text-slate-600">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Network coverage
            </p>
            <p>
              Kitchens, groceries, warehouse lanes, labs, offices, retail, utility, and more. Each environment ships with articulated policies, pickable props, semantic labels, and Isaac validation reports.
            </p>
            <p>
              Add on our on-site capture service to transform your real facility into a SimReady digital twin. Join the waitlist below.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-3xl font-semibold text-slate-900">Why SimReady</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {whySimReady.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
            >
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-3 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">
              Environment Network
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              60+ scene archetypes spanning robotic kitchens, warehouses, retail, offices, and labs. Browse categories below or jump into the full catalog.
            </p>
          </div>
          <a
            href="/environments"
            className="text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
          >
            View all scenes
          </a>
        </div>
        <TileGrid
          items={environmentCategories.map((category) => ({
            label: category.title,
            href: `/environments?category=${category.slug}`,
            description: category.summary,
          }))}
        />
      </section>

      <section className="mx-auto max-w-6xl space-y-12 px-4 sm:px-6">
        <div className="grid gap-12 md:grid-cols-3">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              How it works
            </p>
            <h2 className="text-3xl font-semibold text-slate-900">
              From seed mesh to SimReady scene in three moves.
            </h2>
          </div>
          <div className="md:col-span-2 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                01 • Generate
              </span>
              <p className="mt-3 text-sm text-slate-600">
                Start from Seed3D captures and internal asset libraries. We clean topology, UVs, and materials to create watertight, PBR-ready geometry.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                02 • Prep
              </span>
              <p className="mt-3 text-sm text-slate-600">
                Blender finishing adds precise pivots, separated links, and optional joint rigs. Colliders are authored and tuned for contact-rich tasks.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                03 • Sim authoring
              </span>
              <p className="mt-3 text-sm text-slate-600">
                Final USD staging with physics materials, articulation limits, and Isaac validation. Replicator annotations available on request.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-12 md:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              For robotics labs
            </p>
            <h3 className="text-2xl font-semibold text-slate-900">
              Open. Slide. Pick. Place. Repeat.
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {labBullets.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              For 3D artists
            </p>
            <h3 className="text-2xl font-semibold text-slate-900">
              Join the network building the worlds robots learn in.
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {artistBullets.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <a
              href="/careers"
              className="inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
            >
              Apply
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 md:p-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Coming soon
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                On-site capture → SimReady digital twin.
              </h3>
              <p className="mt-3 max-w-xl text-sm text-slate-600">
                We scan your facility, rebuild it in USD, and return a validated digital twin in days—not months. Join the waitlist to reserve an on-site capture slot.
              </p>
            </div>
            <WaitlistForm />
          </div>
        </div>
      </section>
    </div>
  );
}
