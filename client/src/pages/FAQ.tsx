import { SEO } from "@/components/SEO";
import { ArrowRight } from "lucide-react";

const faqs = [
  {
    question: "What is a Blueprint world model?",
    answer:
      "A digital environment built from real capture of one indoor facility and one workflow lane. It is not a generic benchmark scene or a synthetic environment generator.",
  },
  {
    question: "What does a buyer actually receive with the site package?",
    answer:
      "The walkthrough media, timestamps, camera poses, intrinsics, site notes, and any available depth or geometry artifacts for that facility, plus rights, privacy, and provenance metadata.",
  },
  {
    question: "What is hosted evaluation?",
    answer:
      "A Blueprint-managed runtime session on one exact site. Your team can rerun tasks, review failures, compare checkpoints, and export results without moving data into its own stack first.",
  },
  {
    question: "What does exact-site proof mean versus adjacent-site proof?",
    answer:
      "Exact-site proof means the facility in the package or hosted session is the actual place the buyer cares about. Adjacent-site proof means a clearly labeled nearby or similar site is being used to answer an earlier or lower-risk question.",
  },
  {
    question: "How close is this to a deployment guarantee?",
    answer:
      "It is not a deployment guarantee. The point is to ground the team on the real site sooner and cut bad assumptions earlier, not to replace safety review, stack-specific validation, or on-site signoff.",
  },
  {
    question: "What if the exact site we care about is not in the catalog?",
    answer:
      "The public catalog is the starting point, not the full inventory. If your team needs a specific facility, use the contact path and say which site, workflow, and robot question matter.",
  },
  {
    question: "How fast does Blueprint usually respond?",
    answer:
      "Public-listing and hosted-evaluation questions usually get a first reply within 1 business day. Request-scoped rights, privacy, or export review usually gets a first scoped answer within 2 business days.",
  },
  {
    question: "Can we book time instead of starting with a form?",
    answer:
      "Yes. Use the dedicated booking path when your team already has a real facility or listing in mind and wants a fast scoping conversation around package access or hosted review.",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

export default function FAQ() {
  return (
    <>
      <SEO
        title="FAQ | Blueprint"
        description="Straight answers about Blueprint world models, site packages, hosted evaluation, proof boundaries, and how to start."
        canonical="/faq"
      />

      <div className="overflow-hidden bg-[#f6f1e8] text-slate-950">
        <section className="relative border-b border-black/10">
          <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_40%),radial-gradient(circle_at_82%_12%,_rgba(14,116,144,0.11),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.78),_rgba(246,241,232,0.96))]" />
          <div className="absolute left-[-7rem] top-20 h-56 w-56 rounded-full bg-[#dde7df] blur-3xl" />
          <div className="absolute right-[-8rem] top-12 h-72 w-72 rounded-full bg-[#eadfca] blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <SectionLabel>FAQ</SectionLabel>
              <h1 className="font-editorial mt-5 text-[3.35rem] leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-[4.4rem]">
                The questions that usually decide fit.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.05rem]">
                The fastest way to evaluate Blueprint is to answer the few questions that actually change the next step: what the product is, what the buyer gets, what it is not, and how to start.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="grid gap-4 lg:grid-cols-2">
            {faqs.map((item, index) => (
              <article
                key={item.question}
                className={
                  index === 2
                    ? "rounded-[1.9rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]"
                    : "rounded-[1.9rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]"
                }
              >
                <h2
                  className={
                    index === 2
                      ? "text-2xl font-semibold tracking-tight text-white"
                      : "text-2xl font-semibold tracking-tight text-slate-900"
                  }
                >
                  {item.question}
                </h2>
                <p
                  className={
                    index === 2
                      ? "mt-4 text-sm leading-7 text-white/78"
                      : "mt-4 text-sm leading-7 text-slate-600"
                  }
                >
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="pb-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[2.15rem] border border-black/10 bg-slate-950 px-6 py-8 text-white shadow-[0_26px_70px_-48px_rgba(15,23,42,0.85)] sm:px-8">
              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                    Next Step
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/72">
                    If one real site already matters, the fastest way forward is to send Blueprint a short brief tied to that facility and workflow question.
                  </p>
                </div>
                <div className="grid gap-3">
                  <a
                    href="/contact?persona=robot-team"
                    className="inline-flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Talk to Blueprint about a real site
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
