import { SEO } from "@/components/SEO";
const faqs = [
  {
    question: "What is a Blueprint world model?",
    answer: "A digital environment built from real capture of one indoor facility and one workflow lane. It is not a generic benchmark scene or a synthetic environment generator — it represents one exact place.",
  },
  {
    question: "What does a buyer actually receive with the site package?",
    answer: "The walkthrough media, timestamps, camera poses, intrinsics, site notes, and any available depth or geometry artifacts for that facility. Privacy, rights, and provenance metadata are included so your team knows what it can use and how.",
  },
  {
    question: "What is hosted evaluation?",
    answer: "A Blueprint-managed runtime session on one exact site. Your team can rerun tasks, review failures, compare checkpoints, and export results without downloading or moving data into your own stack first.",
  },
  {
    question: "What is a session-hour?",
    answer: "One hour of self-serve hosted runtime on one exact site. It covers the live session time used to run, rerun, inspect, and export results.",
  },
  {
    question: "Why not just use a generic sim?",
    answer:
      "Generic sim is useful for broad pre-training and early iteration. Blueprint matters when the question depends on one exact site: its real geometry, occlusions, handoff points, and failure modes.",
  },
  {
    question: "What formats and exports should we expect?",
    answer:
      "The exact export set depends on the listing, but the public docs and listing notes should tell you what is stable versus what varies. Common outputs include walkthrough video, timestamps, camera poses, rollout video, dataset exports, and raw run bundles tied to the hosted session.",
  },
  {
    question: "Who can see our facility data?",
    answer:
      "Access follows the rights, privacy, and consent rules attached to the site. Blueprint keeps those controls on the listing instead of implying open access by default.",
  },
  {
    question: "How close is this to a deployment guarantee?",
    answer:
      "It is not a deployment guarantee. The point is to ground the team on the real site sooner and cut bad assumptions earlier, not to replace stack-specific validation, safety review, or on-site signoff.",
  },
  {
    question: "How fresh is the site data?",
    answer:
      "Freshness is a property of the listing, not a vague promise. If a package is stale, that should be visible as a refresh problem instead of being hidden in sales copy.",
  },
  {
    question: "Can this work with different robots and runtimes?",
    answer:
      "Yes. The stable contract is the capture truth, the rights and provenance metadata, the site package, and the hosted-session contract. The runtime backend can change without changing that buyer-facing contract.",
  },
  {
    question: "What if the exact site we care about is not in the catalog?",
    answer:
      "The public catalog is the starting point, not the full inventory. If your team needs a specific facility, use the contact path and say which site, workflow, and robot question matter.",
  },
];

export default function FAQ() {
  return (
    <>
      <SEO
        title="FAQ | Blueprint"
        description="Answers about Blueprint world models, site packages, hosted evaluation, exports, freshness, and buyer trust."
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
              Direct answers for first-time buyers evaluating the product.
            </p>
          </div>

          <div className="mt-12 space-y-4">
            {faqs.map((item) => (
              <section
                key={item.question}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
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
