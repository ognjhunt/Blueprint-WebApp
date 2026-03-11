import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  Boxes,
  Braces,
  Cloud,
  Database,
  Play,
  ShieldCheck,
  TimerReset,
} from "lucide-react";

type SiteWorldCard = {
  id: string;
  siteName: string;
  industry: string;
  taskLane: string;
  status: string;
  exportFormat: string;
  rate: string;
  graphicTone: string;
};

const workflowSteps = [
  {
    title: "1. Blueprint qualifies the site",
    description:
      "A site enters the catalog only after Blueprint has the layout, task lane, constraints, and pass bar in one place.",
    icon: <ShieldCheck className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "2. The site world is hosted for sessions",
    description:
      "Blueprint runs the site-specific environment and keeps the runtime, billing, and export layer out of your way.",
    icon: <Cloud className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "3. Teams run and export",
    description:
      "Robot teams open session-hours, step policies through the environment, and export the rollout data they generate.",
    icon: <Database className="h-5 w-5 text-slate-700" />,
  },
];

const siteWorldCards: SiteWorldCard[] = [
  {
    id: "sw-chi-01",
    siteName: "Midwest Grocery Backroom",
    industry: "Retail backroom",
    taskLane: "Case pick and shelf replenishment",
    status: "Open now",
    exportFormat: "RLDS + video",
    rate: "$18 / session-hour",
    graphicTone: "from-emerald-100 via-white to-emerald-50",
  },
  {
    id: "sw-atl-02",
    siteName: "Atlanta Parcel Sort Lane",
    industry: "Parcel logistics",
    taskLane: "Induct, handoff, and tote reset",
    status: "Open now",
    exportFormat: "RLDS + JSON events",
    rate: "$22 / session-hour",
    graphicTone: "from-sky-100 via-white to-sky-50",
  },
  {
    id: "sw-phx-03",
    siteName: "Phoenix Line-Side Cart Feed",
    industry: "Light manufacturing",
    taskLane: "Cart fetch and station handoff",
    status: "Reserved windows",
    exportFormat: "HDF5 + video",
    rate: "$26 / session-hour",
    graphicTone: "from-amber-100 via-white to-orange-50",
  },
  {
    id: "sw-dal-04",
    siteName: "Dallas Laundry Sort Floor",
    industry: "Service operations",
    taskLane: "Bag lift, sort, and station transfer",
    status: "Open now",
    exportFormat: "RLDS + MP4",
    rate: "$16 / session-hour",
    graphicTone: "from-violet-100 via-white to-fuchsia-50",
  },
  {
    id: "sw-col-05",
    siteName: "Cold-Chain Pick Module",
    industry: "Food distribution",
    taskLane: "Bin pick under temperature constraints",
    status: "Open now",
    exportFormat: "RLDS + sensor logs",
    rate: "$24 / session-hour",
    graphicTone: "from-cyan-100 via-white to-cyan-50",
  },
  {
    id: "sw-jer-06",
    siteName: "Returns Triage Room",
    industry: "E-commerce returns",
    taskLane: "Item triage and tote routing",
    status: "Open now",
    exportFormat: "JSONL + video",
    rate: "$19 / session-hour",
    graphicTone: "from-rose-100 via-white to-rose-50",
  },
];

const teamBenefits = [
  "Open session-hours on listed site worlds",
  "Start from standard task presets and eval starts",
  "Export the rollout data your team generates",
  "Reserve private capacity when a site matters enough",
];

const pricingLanes = [
  {
    title: "Open access",
    price: "$18 to $26 / session-hour",
    detail:
      "Usage-based access to listed site worlds. Best for experiments, quick checks, and synthetic rollout generation.",
  },
  {
    title: "Export package",
    price: "$450 / export job",
    detail:
      "Bundle episodes, summary metrics, and media into a clean export when your team wants to move results into its own stack.",
  },
  {
    title: "Reserved capacity",
    price: "$6,000 / month",
    detail:
      "Private windows on selected site worlds for longer runs, shared team access, and steadier throughput.",
  },
];

const runtimeNotes = [
  {
    title: "The base model is not the whole product",
    description:
      "Model labs can build the foundation layer. Teams still need a catalog, session runtime, metering, and export path.",
  },
  {
    title: "Blueprint is the wrapper layer",
    description:
      "We host site-specific environments, keep them organized by site and task lane, and expose them in a form robot teams can actually use.",
  },
];

const sdkSnippet = `session = blueprint.site_worlds.create(
  site_id="sw-chi-01",
  robot="humanoid_v2",
  task="case_pick"
)

obs = session.reset()

while not done:
  action = policy(obs)
  obs, reward, done, info = session.step(action)

session.export(format="rlds")`;

function SiteWorldGraphic({ tone }: { tone: string }) {
  return (
    <div className={`relative h-40 overflow-hidden rounded-2xl bg-gradient-to-br ${tone}`}>
      <div className="absolute inset-4 rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm" />
      <div className="absolute left-8 top-8 h-14 w-24 rounded-xl border border-slate-300 bg-white/90" />
      <div className="absolute right-8 top-10 h-10 w-16 rounded-lg border border-slate-300 bg-slate-100/90" />
      <div className="absolute bottom-8 left-10 h-12 w-14 rounded-lg border border-slate-300 bg-slate-100/90" />
      <div className="absolute bottom-10 right-12 h-16 w-28 rounded-2xl border border-slate-300 bg-white/90" />
      <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-slate-900 text-white shadow-sm">
        <Boxes className="h-4 w-4" />
      </div>
    </div>
  );
}

export default function SiteWorlds() {
  return (
    <>
      <SEO
        title="Site Worlds | Blueprint"
        description="Open site-specific hosted environments by the session-hour. Robot teams can run experiments, generate rollouts, and export the data they create."
        canonical="/site-worlds"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <header className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Site Worlds
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Open site-specific robot environments by the hour.
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
                Blueprint turns site-specific worlds into hosted environments that robot teams can
                actually use. Open a session. Run experiments. Generate rollouts. Export the data
                your team creates.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#catalog"
                  className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Browse site worlds
                </a>
                <a
                  href="#runtime"
                  className="inline-flex items-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  See the runtime
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">What this service is</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Foundation labs can build generic world models. Blueprint handles the site catalog,
                session runtime, exports, and billing layer that makes those worlds usable by robot
                teams.
              </p>
              <div className="mt-5 grid gap-3">
                {runtimeNotes.map((note) => (
                  <div key={note.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">{note.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{note.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </header>

          <section className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                How it works
              </p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                Three steps. No extra product theory.
              </h2>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {workflowSteps.map((step) => (
                <article key={step.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-2">{step.icon}</div>
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="catalog" className="mt-12">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Sample catalog
                </p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  Six site worlds a robot team could open today.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Placeholder data, but the product shape is the point. Each environment is scoped
                  to a real task lane, usage-based, and export-ready.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                6 listed sites • open access by the session-hour
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {siteWorldCards.map((site) => (
                <article key={site.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <SiteWorldGraphic tone={site.graphicTone} />
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {site.industry}
                      </p>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                        {site.status}
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-bold tracking-tight text-slate-900">
                      {site.siteName}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{site.taskLane}</p>
                    <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500">Export</span>
                        <span className="font-medium text-slate-900">{site.exportFormat}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500">Access</span>
                        <span className="font-medium text-slate-900">{site.rate}</span>
                      </div>
                    </div>
                    <a
                      href="#pricing"
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-slate-700"
                    >
                      Open on usage-based access
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-12 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                What teams get
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                A simple access model for experimentation.
              </h2>
              <ul className="mt-5 space-y-3">
                {teamBenefits.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                    <Play className="mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article id="runtime" className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center gap-2">
                <Braces className="h-5 w-5 text-slate-700" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Runtime shape
                </p>
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Teams should open a session, not manage raw checkpoints.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Blueprint hosts the environment and exposes it as a runtime. The team asks for a
                site, steps actions through it, and exports results. That is easier to buy and
                easier to use than shipping raw site-specific weights around.
              </p>
              <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-950 p-5 text-sm leading-6 text-slate-100">
                <code>{sdkSnippet}</code>
              </pre>
            </article>
          </section>

          <section id="pricing" className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Pricing shape
              </p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                Public pricing can stay simple.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                The cleanest model is usage-based access for listed site worlds, plus a clear
                charge for exports and a reserved lane for heavier users.
              </p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {pricingLanes.map((lane) => (
                <article key={lane.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {lane.title}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{lane.price}</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{lane.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Why now
                </p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  Generic world models are getting better. Exact sites still matter.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  The model-builder field is still small, and most teams do not need another base
                  model vendor. They need the service layer that turns a site-specific world into
                  something they can open, meter, and export from. That is the job this page is
                  describing.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <TimerReset className="h-4 w-4" />
                  Practical note
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Site worlds are useful for adaptation, experiment loops, and synthetic data
                  generation. They still sit next to qualification and real validation, not above
                  them.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#catalog"
                className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Browse example sites
              </a>
              <a
                href="/contact?interest=site-worlds"
                className="inline-flex items-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Bring a site into the catalog
              </a>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
