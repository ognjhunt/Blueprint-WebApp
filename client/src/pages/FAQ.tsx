import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialFaq,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import { ArrowRight } from "lucide-react";

const faqs = [
  {
    question: "What does Blueprint actually sell?",
    answer:
      "Two things. Task Evaluation Runs rank robot policies on a real captured site against your task suite and thresholds, before you spend field time. Policy Improvement Runs are a sim-only loop that works the dominant failure modes the evaluation surfaced — twin/cousin scenarios, curriculum, sealed scenario tests, and an evidence report.",
  },
  {
    question: "What is a task pack?",
    answer:
      "The tasks, start states, and success thresholds every policy runs against on one captured site. Same site, same task, same thresholds — that is what makes the comparison fair.",
  },
  {
    question: "What does a buyer actually receive?",
    answer:
      "A ranked comparison with failure clusters and review media, plus the site package behind it: walkthrough media, timestamps, poses, site notes, available geometry, and the rights, privacy, and provenance metadata that travel with every export.",
  },
  {
    question: "Do we have to hand over our policy weights?",
    answer:
      "No. Evaluation and improvement are source-access optional: black-box runs work through an API endpoint, container, private-cloud runner, sim plugin, or action traces. An improved policy artifact is delivered only when you expose a trainable surface such as adapter hooks, a task head, a fine-tuning API, or a policy wrapper.",
  },
  {
    question: "Is a ranking a deployment guarantee?",
    answer:
      "No. A run reports an estimate of rank fidelity inside the matched robot, task, and site envelope. It grounds the pilot decision earlier — it does not replace safety review, stack-specific validation, or on-site signoff.",
  },
  {
    question: "Are the sites in the public library real customer sites?",
    answer:
      "The public library shows sample site packages with representative names — not live operator supply. Your run is scoped to a real captured site confirmed at request time, and real customer results are shown only after approval.",
  },
  {
    question: "What if the exact site we care about is not listed?",
    answer:
      "The library is the starting point, not the inventory. Tell us the place, workflow, and robot question that matter — new sites enter supply through a capture and rights review.",
  },
  {
    question: "How do capturers and site operators fit in?",
    answer:
      "Capturers are paid to record approved routes in real facilities, and site operators keep control of access, privacy, and commercialization, earning revenue share set in the rights packet before any buyer use.",
  },
];

export default function FAQ() {
  return (
    <>
      <SEO
        title="FAQ | Blueprint"
        description="Straight answers about Task Evaluation Runs, Policy Improvement Runs, task packs, proof boundaries, black-box policy access, and how to start."
        canonical="/faq"
        jsonLd={[
          webPageJsonLd({
            path: "/faq",
            name: "Blueprint FAQ",
            description:
              "Questions and answers about Task Evaluation Runs, Policy Improvement Runs, site packages, proof boundaries, and buyer next steps.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
          faqJsonLd(faqs),
        ]}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.homeHero}
            alt="FAQ hero"
            className="min-h-[38rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[38rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_34%,rgba(0,0,0,0.18)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto h-full max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
                <div className="flex h-full max-w-[34rem] flex-col justify-end">
                <EditorialSectionLabel light>FAQ</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] text-white sm:text-[5rem]">
                  The questions that usually decide fit.
                </h1>
                <p className="mt-6 text-base leading-8 text-white/70">
                  The fastest way to evaluate Blueprint is to answer the few questions that actually change the next step.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a
                    href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&source=faq-hero"
                    className="inline-flex w-full items-center justify-center bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:w-auto"
                  >
                    Request evaluation
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/sites"
                    className="inline-flex w-full items-center justify-center border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                  >
                    Browse sample site packages
                  </a>
                </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialFaq
            title="FAQ"
            description="Clear answers about what the product is, what the buyer gets, what it is not, and how to start."
            items={faqs}
          />
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Talk to Blueprint about a real site."
            description="If one real site already matters, tell Blueprint the place, workflow, and robot question your team needs answered."
            imageSrc={editorialGeneratedAssets.scopingRoom}
            imageAlt="Scoping room"
            primaryHref="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&source=faq-bottom"
            primaryLabel="Request evaluation"
            dark
          />
        </section>
      </div>
    </>
  );
}
