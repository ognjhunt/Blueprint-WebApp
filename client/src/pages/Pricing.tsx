import { ArrowRight, Check } from "lucide-react";

import { SEO } from "@/components/SEO";
import { ProofBoundary } from "@/components/blueprint";
import { EditorialFaq } from "@/components/site/editorial";
import { FigureFrame, ScopeDriverFigure } from "@/components/site/figures";
import { CinematicMedia, Reveal, Stagger } from "@/components/site/motion";
import {
  Accent,
  BigCta,
  MonoNote,
  Section,
  SectionHead,
} from "@/components/site/publicSections";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const requestHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=pricing";

const included = [
  ["One decision", "A single decision-oriented request against one real site-task."],
  ["A pinned testbed", "The exact Site-Task Testbed ID, version, and digest the run ran against."],
  ["Scoping of the question", "Claims, thresholds and units, false-safe consequence, acceptable risk, budget, and deadline."],
  ["A qualified evidence plan", "Method selection per claim, with the reason each method was chosen."],
  ["The answer, or the abstention", "Positive, negative, partial, blocked, or explicitly abstained."],
  ["The limits around it", "Validation envelope, unsupported conditions, coverage, uncertainty, disagreements, and claim ceiling."],
  ["The next move", "The cheapest stronger experiment, and whether it has to be physical."],
  ["The receipts", "Exact evidence provenance, artifact versions and digests, and permitted-use eligibility."],
];

const notIncluded = [
  "A subscription, retainer, or seat licence.",
  "A separate evidence package, data package, or post-training add-on.",
  "A vendor submission fee for candidates entering your run.",
  "A guaranteed ranking, winner, shortlist, or field recommendation.",
  "Safety approval or a deployment sign-off of any kind.",
];

const faqItems = [
  {
    question: "Why is there no price on this page?",
    answer:
      "Because the honest number depends on your decision. Two runs on the same site can differ by an order of magnitude if one needs geometry and the other needs a robot on the floor. You get a scoped quote before anything is authorised, and the server owns that number — the website cannot accept a client-supplied price as authoritative.",
  },
  {
    question: "How is a Task Evaluation Run priced?",
    answer:
      "Each run is quoted from the decision, evidence already available, number of candidates and scenarios, compute, deadline, rights constraints, and any physical work required. Blueprint does not publish an invented fixed price.",
  },
  {
    question: "Do robot teams and site operators buy different products?",
    answer:
      "No. They are two personas using the same Task Evaluation Run, request contract, workflow, result model, and intake. A robot team may bring policies; a site operator may begin with the task and missing evidence.",
  },
  {
    question: "Does every run return a ranking or winner?",
    answer:
      "No. Valid outcomes include bounded positive or negative decisions, elimination of an incompatible candidate, partial decisions, explicit abstention, or a request for the next evidence needed.",
  },
  {
    question: "Is post-training a separate add-on?",
    answer:
      "No. A qualifying evidence artifact may be marked eligible for evaluation or post-training use inside a run. Eligibility does not prove that training occurred or that a policy improved.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Task Evaluation Run pricing | Blueprint"
        description="One scoped Task Evaluation Run, quoted according to the decision, evidence, candidates, scenarios, compute, timing, rights, and physical requirements."
        canonical="/pricing"
        jsonLd={[
          webPageJsonLd({
            path: "/pricing",
            name: "Task Evaluation Run pricing",
            description: "One scoped Task Evaluation Run with request-for-quote pricing.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
          faqJsonLd(faqItems),
        ]}
      />

      {/* ---------------------------------------------------------- hero ---- */}
      <section className="relative isolate overflow-hidden bg-ink">
        <div aria-hidden className="bp-evidence-grid absolute inset-0 opacity-[0.12]" />
        <div className="relative mx-auto grid max-w-[88rem] gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)] lg:items-center lg:px-10 lg:pb-24 lg:pt-24">
          <Reveal y="1.75rem">
            <div className="flex items-center gap-4">
              <span aria-hidden className="h-px w-10 bg-brass/70" />
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-brass">
                One product · scoped engagement
              </span>
            </div>
            <h1 className="mt-7 font-display text-[clamp(2.6rem,5.2vw,4.8rem)] font-medium leading-[0.99] tracking-[-0.045em] text-[color:var(--text-on-ink)]">
              You pay for the evidence the decision needs.
            </h1>
            <p className="mt-7 max-w-[40rem] text-[1.0625rem] leading-[1.75] text-white/70">
              No campaign price, no subscription, no submission fee. One run is scoped and quoted
              from the decision in front of you — the claims under it, the evidence already in hand,
              the strength the answer has to reach — and you see that quote before anything is
              authorised.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={requestHref}
                className="inline-flex h-12 items-center justify-center gap-2 bg-brass px-6 text-sm font-semibold tracking-[-0.01em] text-ink transition-colors duration-200 hover:bg-brass-lit"
              >
                Request a Task Evaluation Run
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/how-it-works"
                className="inline-flex h-12 items-center justify-center border border-white/25 px-6 text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-on-ink)] transition-colors duration-200 hover:border-white/50 hover:bg-white/5"
              >
                How a run works
              </a>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-3">
              {["One scoped run", "Quote before authorization", "Decision or abstention"].map((chip) => (
                <li
                  key={chip}
                  className="inline-flex items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/55"
                >
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brass" />
                  {chip}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={140} y="2.5rem">
            <CinematicMedia
              src="/redesign/pov/machine-tending.jpg"
              alt="Guarded machine-tending station where a scoped evaluation would run"
              caption="Machine tending · scoped decision"
              meta="Illustrative"
              priority
              wash="soft"
              className="aspect-[4/3] w-full"
            />
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- drivers ---- */}
      <Section tone="canvas">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              index="01"
              eyebrow="What moves a quote"
              title={
                <>
                  Seven things change the number. <Accent>None of them is a tier</Accent>.
                </>
              }
              lede="A screening question answered from geometry and existing capture sits at one end. A safety-adjacent question that needs a robot on the floor sits at the other. A run can be scoped near the cheap end whenever an elimination would already settle the decision — a candidate that cannot fit or reach is answerable without simulation at all."
            />
            <div className="mt-8">
              <MonoNote label="Server-owned">
                The website records your budget and timing constraints. It never accepts a
                client-supplied price as authoritative — authorization and any transaction stay tied
                to server-owned records.
              </MonoNote>
            </div>
          </div>

          <FigureFrame
            eyebrow="Figure 01 — Scope drivers"
            title="Where a run sits on each axis"
            kind="concept"
            note="Conceptual ranges, not a price table. The markers show one illustrative scoping across the axes, not a distribution of completed runs; your own quote comes from your own decision and evidence, and no figure here implies a dollar amount."
          >
            <ScopeDriverFigure />
          </FigureFrame>
        </div>
      </Section>

      {/* -------------------------------------------------------- included ---- */}
      <Section tone="paper">
        <SectionHead
          index="02"
          eyebrow="The engagement"
          title={
            <>
              One scoped run. <Accent>Everything the answer rests on</Accent> comes with it.
            </>
          }
          lede="The quote covers only what is needed to answer the requested decision at the required evidence strength — and the whole envelope around that answer ships as part of the work."
          align="wide"
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)] lg:gap-8">
          <Stagger className="grid gap-px bg-line sm:grid-cols-2" step={60}>
            {included.map(([title, body]) => (
              <article key={title} className="bg-white p-5">
                <div className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brass-deep" aria-hidden />
                  <div>
                    <h3 className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink-900">
                      {title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-6 text-ink-500">{body}</p>
                  </div>
                </div>
              </article>
            ))}
          </Stagger>

          <Reveal delay={120}>
            <div className="h-full border border-white/10 bg-ink p-6 sm:p-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-brass">
                Not in scope, ever
              </p>
              <h3 className="mt-4 font-display text-[1.6rem] font-medium leading-tight tracking-[-0.025em] text-[color:var(--text-on-ink)]">
                What no quote will include.
              </h3>
              <ul className="mt-6 space-y-3.5">
                {notIncluded.map((item) => (
                  <li key={item} className="flex gap-3 text-[13.5px] leading-6 text-white/65">
                    <span aria-hidden className="mt-2.5 h-px w-3 shrink-0 bg-brass/70" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal className="mt-8">
          <ProofBoundary level="warn" title="No guaranteed outcome">
            A quote authorizes the work, not a result. It does not buy a ranking, a winner, a field
            recommendation, a deployment, safety approval, or a successful physical outcome.
          </ProofBoundary>
        </Reveal>
      </Section>

      {/* ------------------------------------------------------------ faq ---- */}
      <Section tone="canvas">
        <SectionHead
          index="03"
          eyebrow="Straight answers"
          title={
            <>
              The questions we get <Accent>before the quote</Accent>.
            </>
          }
          align="wide"
        />
        <div className="mt-12">
          <EditorialFaq items={faqItems} />
        </div>
      </Section>

      <BigCta
        eyebrow="Start with the decision"
        title={
          <>
            Describe the decision. <br className="hidden sm:block" />
            Get a scope, then a quote.
          </>
        }
        body="The site-task, the claims, thresholds, consequences, evidence you already have, budget, timing, and restrictions. We scope the evidence plan with you before anything is authorised."
        imageSrc="/redesign/pov/factory-conveyor.jpg"
        imageAlt="Real industrial site used to define a task evaluation"
        primaryHref="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=pricing-cta"
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/how-it-works"
        secondaryLabel="See how it works"
      />
    </>
  );
}
