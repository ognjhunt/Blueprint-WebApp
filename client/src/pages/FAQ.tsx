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
    question: "What does exact-site proof mean versus adjacent-site proof?",
    answer:
      "Exact-site proof means the facility in the package or hosted session is the actual place the buyer cares about. Adjacent-site proof means a clearly labeled nearby or similar site is being used to answer an earlier or lower-risk question. Blueprint should label that distinction instead of letting a buyer infer it.",
  },
  {
    question: "What is a session-hour?",
    answer: "One hour of self-serve hosted runtime on one exact site. It covers the live session time used to run, rerun, inspect, and export results.",
  },
  {
    question: "What does 'self-serve' mean today?",
    answer:
      "It means the hosted path is structured around a buyer-visible runtime session and export loop on one exact site. It does not mean the buyer is dropped into an unbounded generic platform. A buyer can bring a policy, checkpoint, stack adapter, teleop surface, or evaluation contract into the scoping conversation and Blueprint confirms the right session path from there.",
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
    question: "What does 'request-scoped commercial review' mean?",
    answer:
      "Request-scoped commercial review means the public listing is readable, not that Blueprint is claiming blanket site approval. The listing tells a buyer what is publicly inspectable now, while rights, privacy, export scope, and commercialization details stay attached to the request-specific review path.",
  },
  {
    question: "Can this work with different robots and runtimes?",
    answer:
      "Yes. The stable contract is the capture truth, the rights and provenance metadata, the site package, and the hosted-session contract. The runtime backend can change without changing that buyer-facing contract.",
  },
  {
    question: "How fast does Blueprint usually respond?",
    answer:
      "Public-listing and hosted-evaluation questions usually get a first reply within 1 business day. Request-scoped rights, privacy, or export review usually gets a first scoped answer within 2 business days. Private-site and unusual support requests are confirmed in follow-up once the real scope is clear.",
  },
  {
    question: "What can a team bring into hosted evaluation today?",
    answer:
      "Start with the exact site, the workflow lane, and the robot setup that matters. Hosted evaluation scoping can center on a policy name, checkpoint reference, stack adapter, teleop surface, containerized runtime entrypoint, or a narrower evaluation contract for the job your team needs to answer first.",
  },
  {
    question: "When should we not buy exact-site work yet?",
    answer:
      "If your team does not have a target facility or workflow lane yet, exact-site work is usually too early. Generic simulation, broader discovery, or earlier rights review is often the better first step until one real site and one real question matter.",
  },
  {
    question: "What if the exact site we care about is not in the catalog?",
    answer:
      "The public catalog is the starting point, not the full inventory. If your team needs a specific facility, use the contact path and say which site, workflow, and robot question matter.",
  },
  {
    question: "What happens after we submit a brief?",
    answer:
      "Blueprint reviews the site, the robot setup, and the workflow question first. The reply should narrow the path quickly: package access, hosted evaluation, or a custom quote. The goal is to avoid reopening discovery from scratch.",
  },
  {
    question: "Why can a listing be public while the commercial path is still request-scoped?",
    answer:
      "Public means Blueprint is willing to expose the site, proof shape, and trust labels for inspection. Request-scoped means rights, privacy, export scope, or buyer-specific commercial terms still need to be confirmed against the exact request before access expands.",
  },
  {
    question: "What turns a listing from listing-only into proof-rich?",
    answer:
      "A proof-rich listing has more than metadata. It should include stronger public proof such as screenshots, runtime stills, buyer-readable trust cards, sample artifact previews, and clearer disclosure of what is live now versus illustrative or request-scoped.",
  },
  {
    question: "What scenario variation controls are live today?",
    answer:
      "Scenario variation is listing-specific. Public listings show the scenario types Blueprint is prepared to disclose now, while deeper or private variation controls are confirmed during hosted-evaluation or package scoping.",
  },
  {
    question: "What do public demo, public proof, and export ready mean?",
    answer:
      "Public demo means the listing is a stronger public sample surface. Public proof means there are concrete assets a buyer can inspect today, such as screenshots or artifact previews. Export ready means the listing documents export surfaces that can be part of the commercial path, subject to the listing's rights and privacy rules.",
  },
  {
    question: "Can we book time instead of starting with a form?",
    answer:
      "Yes. Use the dedicated booking path when your team already has a real facility or listing in mind and wants a fast scoping conversation around hosted evaluation or package access.",
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
