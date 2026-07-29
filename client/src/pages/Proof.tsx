import { ArrowRight, ExternalLink } from "lucide-react";

import { SEO } from "@/components/SEO";
import { ProofBoundary } from "@/components/blueprint";
import {
  ClaimCeilingFigure,
  FigureFrame,
  ProvenanceChainFigure,
} from "@/components/site/figures";
import { CinematicMedia, Reveal, Stagger } from "@/components/site/motion";
import {
  Accent,
  BigCta,
  MonoNote,
  Section,
  SectionHead,
  StatementList,
} from "@/components/site/publicSections";
import {
  robotPolicyEvaluationBeachhead,
  robotPolicyEvaluationBoundary,
  robotPolicyResearchSignals,
  robotPolicyResearchSignalsNote,
} from "@/data/robotPolicyEvaluationClaims";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const requestHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=task-evaluation-run&path=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=proof";

const evidenceLayers = [
  {
    title: "The request packet",
    body: "One site, one task, one decision, the claims under it, the thresholds, and the candidates if any exist. Everything downstream is scoped to that packet — a result never travels to a different site, task, or robot class.",
  },
  {
    title: "Evidence gathered for that packet",
    body: "Geometry, real observations, simulation traces, generated review material, provider output, or physical rollouts — each carrying the method profile it was qualified under and the envelope it is valid inside.",
  },
  {
    title: "Research signals, clearly labelled",
    body: "Published work can motivate why a method is worth qualifying. It is category evidence, cited as such. It is never presented as a Blueprint result, an accuracy guarantee, or a physical claim.",
  },
];

export default function Proof() {
  return (
    <>
      <SEO
        title="Proof | Blueprint"
        description="Blueprint keeps policy evaluation claims scoped to the site, task, robot, and evidence behind each run."
        canonical="/proof"
        image={`https://tryblueprint.io${wamPolicyEvalAssets.rolloutStrip}`}
        jsonLd={[
          webPageJsonLd({
            path: "/proof",
            name: "Blueprint proof boundaries",
            description:
              "Explains public samples, request packets, and real robot validation boundaries.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Proof", path: "/proof" },
          ]),
          faqJsonLd([
            {
              question: "Does the 0.929 result mean Blueprint claims 93% external accuracy?",
              answer:
                "No. SC3-Eval reports a 0.929 closed-loop Pearson correlation across seven VLA policies. Blueprint cites it as research evidence for ranking workflows, not as an external accuracy guarantee.",
            },
            {
              question: "What does a Task Evaluation Run return?",
              answer:
                "It returns per-claim outcomes, selected evidence methods, a validation envelope, uncertainty, disagreements, a claim ceiling, the next experiment, physical-evidence needs, and exact artifacts. A ranking appears only when supported; abstention never implies a winner.",
            },
          ]),
        ]}
      />

      {/* ---------------------------------------------------------- hero ---- */}
      <section className="relative isolate overflow-hidden bg-ink">
        <div aria-hidden className="bp-evidence-grid absolute inset-0 opacity-[0.12]" />
        <div className="relative mx-auto max-w-[88rem] px-5 pb-16 pt-16 sm:px-8 lg:px-10 lg:pb-20 lg:pt-24">
          <Reveal y="1.75rem" className="max-w-[48rem]">
            <div className="flex items-center gap-4">
              <span aria-hidden className="h-px w-10 bg-brass/70" />
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-brass">
                Proof and boundaries
              </span>
            </div>
            <h1 className="mt-7 font-display text-[clamp(2.6rem,5.2vw,4.8rem)] font-medium leading-[0.99] tracking-[-0.045em] text-[color:var(--text-on-ink)]">
              What we claim, and what we refuse to.
            </h1>
            <p className="mt-7 max-w-[40rem] text-[1.0625rem] leading-[1.75] text-white/70">
              Every claim on this site is scoped to a site, a task, a robot class, and the evidence
              behind one run. Anything that would need proof we do not have — a ranking on demand,
              a field guarantee, a safety sign-off — is named here as something we will not say.
            </p>
            <div className="mt-9">
              <a
                href={requestHref}
                className="inline-flex h-12 items-center justify-center gap-2 bg-brass px-6 text-sm font-semibold tracking-[-0.01em] text-ink transition-colors duration-200 hover:bg-brass-lit"
              >
                Request a Task Evaluation Run
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-7 max-w-[38rem] text-[13px] leading-6 text-white/45">
              {robotPolicyEvaluationBeachhead}
            </p>
          </Reveal>
        </div>

        <div className="relative mx-auto max-w-[88rem] px-5 pb-20 sm:px-8 lg:px-10 lg:pb-24">
          <Reveal delay={100}>
            <CinematicMedia
              src={wamPolicyEvalAssets.rolloutStrip}
              alt="Generated review-support rollout frames of a mobile robot navigating a warehouse aisle and making a rigid tote pick"
              caption="Rollout frames · generated review support"
              meta="Not a measured result"
              wash="none"
              className="aspect-[16/7] w-full"
            />
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- ceiling ---- */}
      <Section tone="canvas">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              index="01"
              eyebrow="The ceiling"
              title={
                <>
                  The limit is part of the deliverable, <Accent>not the small print</Accent>.
                </>
              }
              lede="Each run states the strongest claim its evidence permits. Below that line is what you can act on; above it is what no amount of virtual evidence will turn into a promise."
            />
            <Reveal className="mt-8">
              <ProofBoundary level="warn" title="Evidence boundary">
                {robotPolicyEvaluationBoundary}
              </ProofBoundary>
            </Reveal>
          </div>

          <FigureFrame
            eyebrow="Figure 01 — Claim ceiling"
            title="What a run carries, and what sits above the line"
            kind="schematic"
            note="Schematic. The hatched rows are never delivered by a run at any price or evidence strength."
          >
            <ClaimCeilingFigure />
          </FigureFrame>
        </div>
      </Section>

      {/* --------------------------------------------------------- layers ---- */}
      <Section tone="paper">
        <SectionHead
          index="02"
          eyebrow="What backs a result"
          title={
            <>
              Three layers, and <Accent>they are never mixed up</Accent>.
            </>
          }
          lede="A scoped request, the evidence gathered for it, and clearly labelled outside research. Category evidence never gets promoted into a Blueprint result."
          align="wide"
        />
        <div className="mt-12">
          <StatementList items={evidenceLayers} />
        </div>
      </Section>

      {/* ------------------------------------------------------ provenance ---- */}
      <Section tone="ink">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <SectionHead
              index="03"
              eyebrow="Provenance"
              title={
                <>
                  A number you cannot trace <Accent onInk>is not evidence</Accent>.
                </>
              }
              lede="Every figure in a result can be walked back to the capture, the rights record, the exact testbed version and digest, the method profile, and the permitted uses it was released under."
              onInk
            />
            <div className="mt-8">
              <MonoNote label="What this rules out" onInk>
                Metrics quoted outside their matched robot, task, and site envelope. Exports
                presented as proof that training happened. User notes treated as physical outcomes.
              </MonoNote>
            </div>
          </div>

          <FigureFrame
            eyebrow="Figure 02 — Chain of custody"
            title="What a claim can be walked back through"
            kind="schematic"
            onInk
            note="Field names, not a real run."
          >
            <ProvenanceChainFigure onInk />
          </FigureFrame>
        </div>
      </Section>

      {/* -------------------------------------------------------- research ---- */}
      <Section tone="white">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-16">
          <div>
            <SectionHead
              index="04"
              eyebrow="What we cite"
              title={
                <>
                  Outside research, <Accent>labelled as outside research</Accent>.
                </>
              }
              lede={robotPolicyResearchSignalsNote}
            />
          </div>

          <Stagger className="grid gap-px bg-line sm:grid-cols-2" step={90}>
            {robotPolicyResearchSignals.map((signal) => (
              <a
                key={signal.label}
                href={signal.href}
                rel="noreferrer"
                className="group bg-white p-6 transition-colors duration-200 hover:bg-canvas"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-[1.5rem] font-medium tracking-[-0.02em] text-ink-900">
                    {signal.label}
                  </h3>
                  <ExternalLink
                    className="h-4 w-4 shrink-0 text-ink-400 transition-colors group-hover:text-brass-deep"
                    aria-hidden
                  />
                </div>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-brass-deep">
                  {signal.stat}
                </p>
                <p className="mt-3 text-[13.5px] leading-6 text-ink-500">{signal.body}</p>
              </a>
            ))}
          </Stagger>
        </div>

        <Reveal className="mt-10">
          <ProofBoundary level="info" title="On the 0.929 figure specifically">
            SC3-Eval reports a 0.929 closed-loop Pearson correlation across seven VLA policies. That
            is third-party research context for why generated-observation review can support policy
            comparison. It is not a Blueprint result, an accuracy claim, or a deployment claim, and
            it does not transfer to your site.
          </ProofBoundary>
        </Reveal>
      </Section>

      <BigCta
        eyebrow="Scoped, or not said"
        title={
          <>
            Ask us for a claim <br className="hidden sm:block" />
            and you get its boundaries with it.
          </>
        }
        body="Describe the decision you need to make. The result will tell you what the evidence supports, what it does not, and what it would take to close the difference."
        imageSrc="/redesign/pov/machine-tending.jpg"
        imageAlt="Guarded industrial machine station used as a real site-task"
        primaryHref="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=proof-cta"
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/how-it-works"
        secondaryLabel="How a run works"
        footnote="A Task Evaluation Run returns only the bounded decision, partial decision, or abstention supported by its evidence envelope — never a safety certification."
      />
    </>
  );
}
