import { CTAButtons } from "@/components/site/CTAButtons";
import { LogoWall } from "@/components/site/LogoWall";
import { TileGrid } from "@/components/site/TileGrid";
import { WaitlistForm } from "@/components/site/WaitlistForm";
import { environmentCategories, syntheticDatasets } from "@/data/content"; //yeetasdasddasdsadsadsdanjnkjsdasdasd

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
    title: "Simulation-ready handoff",
    description:
      "Physics materials, collision proxies, and semantic schemas tuned for leading robotics simulators out of the box.",
  },
];

const labBullets = [
  "Articulated containers (doors, drawers, racks)",
  "Pick-place props with clean colliders",
  "Simulation packages validated in our QA stack",
  "Annotation-ready semantics on request",
];

const artistBullets = [
  "Join a network shipping scenes to leading labs",
  "Focus on fidelity—we’ll handle the pipeline",
  "Paid per scene, bonuses for articulation coverage",
];

const offeringCards = [
  {
    title: "Synthetic SimReady Scenes Marketplace",
    description:
      "Daily synthetic dataset drops with plug-and-play USD, randomizer scripts, and policy validation notes.",
    bullets: [
      "Filter by policy, object coverage, and facility archetype",
      "Variants + scripting so labs can train without touching pipelines",
      "Pricing starts around $50/scene depending on scale",
    ],
    ctaLabel: "Browse drops",
    ctaHref: "/environments",
  },
  {
    title: "Real-world SimReady capture",
    description:
      "We scan your exact facility, rebuild it in USD, and return a validated scene tuned to your deployment stack.",
    bullets: [
      "On-site capture crews for kitchens, warehouses, labs, and more",
      "Plug-and-play handoff for Isaac 4.x/5.x, URDF, or custom formats",
      "Site-specific randomizers + QA so you ship with confidence",
    ],
    ctaLabel: "Book a capture",
    ctaHref: "/contact",
  },
];

export default function Home() {
  const datasetPreview = syntheticDatasets.slice(0, 3);

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
              High-fidelity scenes, physics-clean assets, delivered fast. Pick
              from our synthetic marketplace—new datasets publish daily with
              variants, randomizers, and plug-and-play USD—or send us to your
              actual site and we’ll return a SimReady digital twin tuned to your
              deployment stack. Either path keeps labs out of DCC tools so they
              can focus on training and proving ROI sooner.
            </p>
          </div>
          <CTAButtons
            primaryHref="/environments"
            primaryLabel="Browse Synthetic Marketplace"
            secondaryHref="/contact"
            secondaryLabel="Book a Real-World Capture"
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
              Kitchens, groceries, warehouse lanes, labs, offices, retail,
              utility, and more. The synthetic marketplace blends scan-derived
              references with procedural scale so you get the layouts, objects,
              and articulation policies you actually deploy.
            </p>
            <p>
              Need something site-specific? Add on our capture service and the
              same team will rebuild your exact facility with plugs for Isaac
              and your QA stack.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2">
          {offeringCards.map((offering) => (
            <article
              key={offering.title}
              className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6"
            >
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  {offering.title.includes("Synthetic") ? "Marketplace" : "Capture"}
                </p>
                <h3 className="text-2xl font-semibold text-slate-900">
                  {offering.title}
                </h3>
                <p className="text-sm text-slate-600">{offering.description}</p>
              </div>
              <ul className="space-y-3 text-sm text-slate-600">
                {offering.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                <a
                  href={offering.ctaHref}
                  className="inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                >
                  {offering.ctaLabel}
                </a>
              </div>
            </article>
          ))}
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
              <h3 className="text-lg font-semibold text-slate-900">
                {item.title}
              </h3>
              <p className="mt-3 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">
              Synthetic marketplace highlights
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Here’s a peek at today’s drops. Filter every dataset by policy,
              location type, objects, variants, and cadence in the full
              marketplace.
            </p>
          </div>
          <a
            href="/environments"
            className="text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
          >
            Explore marketplace
          </a>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {datasetPreview.map((dataset) => (
            <article
              key={dataset.slug}
              className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white"
            >
              <div className="relative h-48 w-full">
                <img
                  src={dataset.heroImage}
                  alt={dataset.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {dataset.isNew ? (
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900">
                    New drop
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    {dataset.locationType}
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {dataset.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {dataset.description}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
                  <div>
                    <dt className="uppercase tracking-[0.2em]">$/scene</dt>
                    <dd className="text-base font-semibold text-slate-900">
                      ${dataset.pricePerScene}
                    </dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.2em]">Scenes</dt>
                    <dd className="text-base font-semibold text-slate-900">
                      {dataset.sceneCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.2em]">Variants</dt>
                    <dd className="text-base font-semibold text-slate-900">
                      {dataset.variantCount}
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  {dataset.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-slate-200 px-3 py-1"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-auto">
                  <a
                    href={`/environments?dataset=${dataset.slug}`}
                    className="text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                  >
                    See details
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">
              Environment families we cover daily
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Use these archetypes to anchor your wishlist or capture brief.
              We keep releasing variants that span aisle widths, heights, and
              policy complexity so your models see the long tail.
            </p>
          </div>
          <a
            href="/environments"
            className="text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
          >
            View full taxonomy
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
              From real-world location to SimReady scene in three moves.
            </h2>
          </div>
          <div className="md:col-span-2 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                01 • Generate
              </span>
              <p className="mt-3 text-sm text-slate-600">
                Start from on-site captures or thoroughly documented real-world
                locations. We clean topology, UVs, and materials to create
                watertight, PBR-ready geometry.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                02 • Prep
              </span>
              <p className="mt-3 text-sm text-slate-600">
                Artist finishing adds precise pivots, separated links, and
                optional joint rigs. Colliders are authored and tuned for
                contact-rich tasks.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                03 • Sim authoring
              </span>
              <p className="mt-3 text-sm text-slate-600">
                Final packaging with physics materials, articulation limits, and
                simulation validation. Annotation exports available on request.
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
                Real-world capture waitlist
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                Turn any facility into a SimReady digital twin.
              </h3>
              <p className="mt-3 max-w-xl text-sm text-slate-600">
                Share the address you care about and we’ll coordinate a capture
                window. Expect delivery in days—not months—with USD, URDF, and
                QA reports ready for your simulator.
              </p>
            </div>
            <WaitlistForm />
          </div>
        </div>
      </section>
    </div>
  );
}
