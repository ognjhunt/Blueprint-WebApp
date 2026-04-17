interface WhenNotToBuyModuleProps {
  className?: string;
  title?: string;
}

const reasons = [
  {
    title: "You do not have a target facility yet",
    body: "Exact-site work is strongest when one real site and one workflow lane already matter. If the question is still broad, generic sim or earlier discovery is usually cheaper first.",
  },
  {
    title: "You only need broad pretraining",
    body: "If the immediate goal is general pretraining or non-site-specific evaluation, a generic environment may be the better first step than a facility-grounded package.",
  },
  {
    title: "Rights or privacy boundaries are still undefined",
    body: "If capture permissions, redaction scope, export limits, or commercialization boundaries are unresolved, finish that review before buying exact-site work.",
  },
  {
    title: "You need a deployment guarantee",
    body: "Blueprint helps a team answer deployment questions earlier. It does not replace safety review, on-site validation, or the team's own stack-specific signoff.",
  },
];

export function WhenNotToBuyModule({
  className = "",
  title = "When not to buy exact-site work yet.",
}: WhenNotToBuyModuleProps) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-stone-50 px-5 py-6 sm:px-7 sm:py-7 ${className}`}>
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Buying boundary
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Exact-site work is high-signal when one facility and one workflow question already matter.
          It is the wrong first purchase when the team still needs broad discovery, undefined rights
          review, or a guarantee the product does not truthfully provide.
        </p>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {reasons.map((reason) => (
          <article key={reason.title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">{reason.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{reason.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
