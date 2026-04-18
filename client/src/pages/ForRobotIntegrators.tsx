import { SEO } from "@/components/SEO";
import { ArrowRight, CheckCircle2, Gauge, GitBranchPlus, Play } from "lucide-react";

const useCaseCards = [
  {
    title: "Tune before travel",
    body: "Fine-tune the policy against the actual deployment layout before anyone gets on a plane.",
    icon: Gauge,
  },
  {
    title: "Make site-specific data",
    body: "Render runs from the exact site and export what matters for training, debugging, and internal review.",
    icon: Play,
  },
  {
    title: "Compare releases",
    body: "Run the same site and task after each autonomy update so regressions show up earlier.",
    icon: GitBranchPlus,
  },
];

const includedItems = [
  "A site-specific world model of one real site and workflow",
  "Resettable runs on the same site so checkpoints are easier to compare",
  "Scenario changes and rollout exports for debugging, tuning, or data work",
  "Package and hosted paths tied back to the same source capture record",
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

export default function ForRobotIntegrators() {
  return (
    <>
      <SEO
        title="For Robot Integrators | Blueprint"
        description="Blueprint helps robot teams test one exact site before deployment with site-specific packages and hosted review built from real capture."
        canonical="/for-robot-integrators"
      />

      <div className="overflow-hidden bg-[#f6f1e8] text-slate-950">
        <section className="relative border-b border-black/10">
          <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_40%),radial-gradient(circle_at_82%_12%,_rgba(14,116,144,0.12),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.78),_rgba(246,241,232,0.96))]" />
          <div className="absolute left-[-7rem] top-20 h-56 w-56 rounded-full bg-[#dce8e5] blur-3xl" />
          <div className="absolute right-[-8rem] top-12 h-72 w-72 rounded-full bg-[#eadfca] blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-black/10 bg-white/82 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                For Robot Teams
              </div>
              <h1 className="font-editorial mt-5 text-[3.35rem] leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-[4.45rem]">
                Test the exact site before deployment.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.05rem]">
                Blueprint turns a real facility into a site-specific world model, data package, and hosted evaluation path so your team can answer deployment questions before site visits, pilot spend, and rollout work begin.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="grid gap-4 lg:grid-cols-[0.42fr_0.58fr]">
            <article className="rounded-[1.9rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]">
              <SectionLabel>Integrator Value</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-white sm:text-[3rem]">
                Why integrators use this path.
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/76">
                The goal is not generic environment access. The goal is earlier answers on one real site, with package and hosted paths tied to the same capture truth.
              </p>
            </article>

            <article className="rounded-[1.9rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]">
              <SectionLabel>What This Is</SectionLabel>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                A site-specific world model, data package, and hosted evaluation path built from real capture of one facility and one workflow lane.
              </p>
            </article>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white/55">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <div className="max-w-2xl">
              <SectionLabel>Use Cases</SectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
                Common jobs on one exact site.
              </h2>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {useCaseCards.map((item, index) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className={
                      index === 1
                        ? "rounded-[1.85rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]"
                        : "rounded-[1.85rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]"
                    }
                  >
                    <div
                      className={
                        index === 1
                          ? "flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white"
                          : "flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-800"
                      }
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3
                      className={
                        index === 1
                          ? "mt-4 text-2xl font-semibold tracking-tight text-white"
                          : "mt-4 text-2xl font-semibold tracking-tight text-slate-900"
                      }
                    >
                      {item.title}
                    </h3>
                    <p
                      className={
                        index === 1
                          ? "mt-4 text-sm leading-7 text-white/78"
                          : "mt-4 text-sm leading-7 text-slate-600"
                      }
                    >
                      {item.body}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="max-w-2xl">
            <SectionLabel>Expectations</SectionLabel>
            <h2 className="font-editorial mt-4 text-4xl tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
              What you get and what it does not do.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <article className="rounded-[1.9rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]">
              <ul className="space-y-3">
                {includedItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[1.9rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]">
              <p className="text-sm leading-7 text-white/76">
                This works well for policy fine-tuning, training data generation, and release comparison. It does not replace final on-site safety validation or stack-specific signoff.
              </p>
            </article>
          </div>
        </section>

        <section className="pb-20">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:px-6 lg:flex-row lg:px-8">
            <a
              href="/world-models"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Explore world models
            </a>
            <a
              href="/exact-site-hosted-review"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Request hosted evaluation
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
