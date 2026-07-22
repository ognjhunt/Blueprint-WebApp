import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialFaq,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import {
  robotPolicyEvaluationBeachhead,
  robotPolicyScreeningValue,
} from "@/data/robotPolicyEvaluationClaims";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import { ArrowRight } from "lucide-react";

const faqs = [
  {
    question: "What does Blueprint sell?",
    answer:
      "Blueprint sells one core thing today: a site-specific Task Evaluation Run that ranks your robot policies on a captured real-site task envelope — cheap screening before you spend field or pilot time. Provenance-checked data packages are a later, related offer off the same captures; world models and simulation are internal supporting tools, never the primary offer or ground truth.",
  },
  {
    question: "What does a Task Evaluation Run return?",
    answer:
      "The run ranks and orders your candidate policies on the same site, task, robot profile, and policy set so your team can screen before committing field or pilot budget. You get a scoped comparison: episode metrics, policy ordering, failure clusters, uncertainty and missing-proof labels, plus review-support media. We stand behind the ordering (rank fidelity), not a calibrated success guarantee. It is an estimate inside that envelope, not a deployment guarantee.",
  },
  {
    question: "Where is the evidence strongest today?",
    answer:
      robotPolicyEvaluationBeachhead +
      " That beachhead is where a Task Evaluation Run screens policies most confidently right now — never a guarantee or safety certification.",
  },
  {
    question: "Is the published 0.929 correlation a Blueprint result?",
    answer:
      "No. SC3-Eval reports a 0.929 closed-loop Pearson correlation across seven VLA policies. Blueprint cites that third-party research as category context; a Blueprint result exists only when a specific owned run records its own evidence.",
  },
  {
    question: "Are the sites page and run dashboard filled with samples?",
    answer:
      "No. Public site cards come only from current Pipeline-backed capture records, and the buyer run dashboard lists only records owned by the signed-in buyer. When no record exists, the interface shows an empty request path instead of invented supply or analytics.",
  },
  {
    question: "What if the exact site is not publicly listed?",
    answer:
      "Tell Blueprint the facility type, workflow, access window, and robot question. Blueprint can scope a new capture with the operator or review private inventory without implying that access, rights, or city coverage already exists.",
  },
  {
    question: "Who is the buyer, and how do capturers and site operators participate?",
    answer:
      "The robot or foundation-model team is the buyer. Capturers are recruited, reviewed, and paid supply: they apply for assignments and see payout terms before work begins. Site operators are access and lighthouse partners who define access, privacy, restricted areas, rights, and commercial posture. No application, capture, payout, or downstream use is treated as approved until the system that owns that state records it.",
  },
  {
    question: "Does a purchase prove execution or deployment readiness?",
    answer:
      "No. Payment, entitlement, queued execution, simulator output, ranking evidence, and field validation are separate states. Blueprint reports each boundary separately and never promotes checkout or startup into a successful run claim.",
  },
  {
    question: "What is a Policy Improvement Run? (follow-on)",
    answer:
      "A Policy Improvement Run is a later, follow-on offer, not the core product. After a Task Evaluation Run, Blueprint can turn evaluation failures into a request-scoped improvement package: prioritized failure clusters, scenario or curriculum recommendations, and a sealed regression set. If your team exposes an approved trainable adapter, controller, reward, or fine-tuning path, the scope can also include an improved policy artifact; source-code access is not always required.",
  },
];

export default function FAQ() {
  return (
    <>
      <SEO
        title="FAQ | Blueprint"
        description="Straight answers about Blueprint's one core service — a site-specific Task Evaluation Run that ranks your robot policies on a captured real-site task envelope so you can screen before spending field or pilot time — plus proof boundaries and how to start."
        canonical="/faq"
        jsonLd={[
          webPageJsonLd({
            path: "/faq",
            name: "Blueprint FAQ",
            description:
              "Questions and answers about Blueprint's site-specific Task Evaluation Run — ranking robot policies on a captured real-site task envelope — plus proof boundaries and buyer next steps.",
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
            alt="Generated preview / review support: warehouse navigation and rigid pick-and-place, the scenes a Task Evaluation Run screens today"
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
                  One run that ranks your robot policies.
                </h1>
                <p className="mt-6 text-base leading-8 text-white/70">
                  {robotPolicyScreeningValue}
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a
                    href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&source=faq-hero"
                    className="inline-flex w-full items-center justify-center bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:w-auto"
                  >
                    Talk to Blueprint about a real site
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/sites"
                    className="inline-flex w-full items-center justify-center border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                  >
                    See captured real-site task envelopes
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
            primaryLabel="Talk to Blueprint about a real site"
            dark
          />
        </section>
      </div>
    </>
  );
}
