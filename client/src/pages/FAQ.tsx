import { SEO } from "@/components/SEO";

const faqs = [
  {
    question: "What is a Blueprint world model?",
    answer:
      "It is a site-specific digital reconstruction of one real facility and one real workflow. Blueprint builds it from capture collected in the actual place. This is not a synthetic environment generator and it is not a generic benchmark scene.",
  },
  {
    question: "What does a buyer actually receive?",
    answer:
      "Each listing shows the same basic split: site package or hosted evaluation. The package usually includes walkthrough media, site notes, and any geometry or depth artifacts available for that site. Hosted evaluation is the managed runtime path for reruns, exports, and failure review.",
  },
  {
    question: "How is this priced?",
    answer:
      "Pricing is listing-specific because the useful output depends on the site and the access mode. The catalog shows site-package pricing and hosted-session pricing directly on each listing, and the pricing page summarizes the typical ranges.",
  },
  {
    question: "What formats and exports should we expect?",
    answer:
      "The exact export set depends on the listing, but Blueprint surfaces the package notes, runtime details, and export readiness on the site page. Common outputs include walkthrough video, camera poses, rollout video, RLDS-style datasets, and raw bundles tied to the hosted session.",
  },
  {
    question: "Who can see our facility data?",
    answer:
      "Access follows the rights and privacy rules attached to the site. Blueprint keeps the access mode, usage limits, and governance context visible instead of treating every site as open by default.",
  },
  {
    question: "How close is this to a deployment guarantee?",
    answer:
      "It is not a deployment guarantee. The point is to ground your team on the real site sooner, cut bad assumptions earlier, and make the first real visit less blind. You still need stack-specific validation, safety review, and on-site signoff.",
  },
  {
    question: "How fresh is the site data?",
    answer:
      "Freshness is a property of the listing, not a hand-wavy promise. When the readiness package has freshness metadata or a recapture state, the page shows it. If the site has changed enough that the package is stale, that should be treated as a refresh problem, not brushed aside in sales copy.",
  },
  {
    question: "What happens if the site changes after capture?",
    answer:
      "Then the value of the package depends on how much changed and what question your team is asking. Sometimes the existing package is still useful for planning and hosted review. Sometimes it needs a refresh. Blueprint keeps the refresh state visible when that information exists.",
  },
  {
    question: "Can this work with different robots and runtimes?",
    answer:
      "Yes. The stable layer is the capture, provenance, site package, hosted-evaluation contract, and buyer surface around it. Runtime backends can change without changing the core product.",
  },
  {
    question: "What robot embodiments have been tested?",
    answer:
      "Each listing names a sample robot profile so buyers can judge relevance quickly. That profile is there to ground the example, not to claim exclusive support for one robot family.",
  },
  {
    question: "What is a hosted session?",
    answer:
      "It is the managed browser path into one exact site. Teams use it to rerun the same setup, compare releases, inspect failures, and export results without passing files around first.",
  },
  {
    question: "What if the exact site we care about is not in the catalog?",
    answer:
      "The catalog is the public starting point, not the full supply of work Blueprint can support. If your team needs a specific site, use the contact path and say which facility, workflow, and robot question matter.",
  },
];

export default function FAQ() {
  return (
    <>
      <SEO
        title="FAQ | Blueprint"
        description="Answers about Blueprint world models, hosted sessions, exports, freshness, and how robot teams buy access to real site packages."
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
              Use this page to understand the product, the package-vs-hosted split, and what a
              buyer should know before requesting access.
            </p>
          </div>

          <div className="mt-12 space-y-4">
            {faqs.map((item) => (
              <section
                key={item.question}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-6"
              >
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
