import { ContactForm } from "@/components/site/ContactForm";
import { environmentPolicies } from "@/data/content";

export default function Contact() {
  const corePolicies = environmentPolicies.slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pb-24 pt-16 sm:px-6">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Build your training coverage</p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Start with the dataset your lab actually needs.
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Labs are tuning the same manipulation families everyone is benchmarking going into 2025 and 2026—dexterous pick-
          place, articulated access, panel interaction, mixed-SKU logistics, and precision insertion. That’s why we lead with
          dataset programs that hit those policy tracks while still making it easy to request a specific kitchen, warehouse
          aisle, or other hero scene. Share what your robot needs and we’ll align on scope, delivery, and budget within one
          business day.
        </p>
      </header>
      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Policy coverage</span>
          <h2 className="text-xl font-semibold text-slate-900">Top robotics policy tracks for 2025/2026</h2>
          <p className="text-sm text-slate-600">
            Every request we ship maps back to the policy benchmarks labs are actively training right now. Use these to anchor
            your brief or call out variants you need us to capture.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {corePolicies.map((policy) => (
            <article key={policy.slug} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{policy.focus}</span>
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{policy.cadence}</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-slate-900">{policy.title}</h3>
                <p className="text-sm text-slate-600">{policy.summary}</p>
              </div>
              <ul className="mt-auto flex flex-col gap-2 text-sm text-slate-600">
                {policy.coverage.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <ContactForm />
    </div>
  );
}