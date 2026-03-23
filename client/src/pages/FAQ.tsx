import { SEO } from "@/components/SEO";

const faqs = [
  {
    question: "What is a world model?",
    answer:
      "A Blueprint world model is a site-specific digital representation of one real facility and one real workflow. Teams use it to review the site, plan evaluation work, and open hosted sessions before a visit.",
  },
  {
    question: "What does a buyer actually receive?",
    answer:
      "Each listing spells it out. In general, buyers get a site package, hosted session access, or both, along with notes about the workflow, exports, and any limits on reuse or sharing.",
  },
  {
    question: "What is a hosted session?",
    answer:
      "It is a browser-based way to inspect and rerun a specific site setup without passing files around first. It is useful for internal review, debugging, and customer-facing walkthroughs.",
  },
  {
    question: "Is this a deployment guarantee?",
    answer:
      "No. Blueprint helps teams get grounded on the real site earlier. It does not replace stack-specific validation, safety review, or the final on-site signoff.",
  },
  {
    question: "How do buying and scoping work?",
    answer:
      "Teams can browse the catalog, inspect a sample site, and contact Blueprint with the site, task, and embodiment they care about. From there the next step is a site package, hosted session, or a scoped follow-up.",
  },
  {
    question: "What if the exact site is not already listed?",
    answer:
      "Blueprint can scope fresh capture or a site-specific follow-up. The public catalog is the starting point, not the full universe of available work.",
  },
];

export default function FAQ() {
  return (
    <>
      <SEO
        title="FAQ | Blueprint"
        description="Answers about Blueprint world models, hosted sessions, buyer deliverables, and how teams buy access to a real site."
        canonical="/faq"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              FAQ
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Straight answers about what Blueprint sells.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              This page is here to remove guesswork. If a team is deciding whether Blueprint is
              useful, these are usually the first questions that come up.
            </p>
          </div>

          <div className="mt-12 space-y-4">
            {faqs.map((item) => (
              <section key={item.question} className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="text-xl font-semibold text-slate-900">{item.question}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
