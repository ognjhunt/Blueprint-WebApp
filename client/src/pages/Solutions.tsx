import { CTAButtons } from "@/components/site/CTAButtons";
import { WaitlistForm } from "@/components/site/WaitlistForm";

const proceduralSteps = [
  {
    title: "Author",
    description:
      "Procedural seed meshes and kitbashed assets routed through Blueprint finishing for watertight, UV’d geometry.",
  },
  {
    title: "Articulate",
    description:
      "We add pivots, joints, and clean colliders so your team can focus on policy authoring instead of asset repair.",
  },
  {
    title: "Validate",
    description:
      "Every delivery ships with simulation QA runs, semantic labels on request, and annotation-ready metadata.",
  },
];

const onsiteSteps = [
  {
    title: "Scan",
    description:
      "Lidar + photogrammetry capture of your facility with robotics-safe coverage and survey-grade alignment.",
  },
  {
    title: "Rebuild",
    description:
      "Blueprint engineers convert captures into SimReady scene packages with joints, colliders, and semantics.",
  },
  {
    title: "Prove",
    description:
      "Run in your preferred simulator to prove ROI before hardware deployment, with change orders handled in days.",
  },
];

export default function Solutions() {
  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 pb-24 pt-16 sm:px-6">
      <header className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Solutions
          </p>
          <h1 className="text-4xl font-semibold text-slate-900">
            Two ways to get SimReady scenes.
          </h1>
          <p className="text-sm text-slate-600">
            Whether you need procedural synthetic data grounded in documented kitchens, warehouses, utility rooms, and other real locations or a digital twin of a facility you operate, Blueprint delivers robotics-ready environments with precision pivots, physics materials, and simulation validation. Choose from non-exclusive catalog scenes or commission exclusive dataset programs tailored to your roadmap.
          </p>
          <CTAButtons
            primaryHref="/environments"
            primaryLabel="Browse scenes"
            secondaryHref="/contact"
            secondaryLabel="Talk to us"
          />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8">
          <h2 className="text-sm font-semibold text-slate-900">
            What makes a scene SimReady?
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            We measure every build against contact accuracy, articulated coverage, clean semantics, and integration readiness. Delivery includes validation videos, collider previews, and annotated scene files.
          </p>
        </div>
      </header>

      <section className="space-y-8">
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold text-slate-900">
            Procedural & Synthetic Scene Data
          </h2>
          <p className="max-w-3xl text-sm text-slate-600">
            Generate diverse training sets with curated procedural environments. Each scene begins with survey photos, scans, or CAD from real-world analogs so the layouts, sight lines, and clutter patterns match kitchens, grocery aisles, warehouse pick lanes, retail floors, and residential rooms your robots will encounter.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {proceduralSteps.map((step, index) => (
            <div key={step.title} className="rounded-3xl border border-slate-200 bg-white p-6">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                0{index + 1}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-3 text-sm text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          <p>
            Deliverables: Scene package with articulated assets, texture libraries, annotation schema (optional), simulation validation reel, change-log, and recommended policy tasks.
          </p>
        </div>
      </section>

      <section className="space-y-8" id="pricing">
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold text-slate-900">
            On-site SimReady Location (waitlist)
          </h2>
          <p className="max-w-3xl text-sm text-slate-600">
            Turn a real site into a validated digital twin. We scan, rebuild the space, and deliver SimReady scenes within days so your robotics team can prove ROI in simulation before rolling out hardware.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {onsiteSteps.map((step, index) => (
            <div key={step.title} className="rounded-3xl border border-slate-200 bg-white p-6">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                0{index + 1}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-3 text-sm text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="text-sm font-semibold text-slate-900">Reserve your slot</h3>
          <p className="mt-2 text-sm text-slate-600">
            Priority goes to facilities with active robotic deployments. Join the waitlist and we’ll coordinate capture windows, SLAs, and pricing.
          </p>
          <div className="mt-4">
            <WaitlistForm />
          </div>
        </div>
      </section>
    </div>
  );
}
