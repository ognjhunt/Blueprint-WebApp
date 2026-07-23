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
      "Site-specific robot ranking, sold as two fixed-price campaigns: a Policy Shortlist for robot teams and a Robot Match for site operators. Each captures the real site and task, evaluates comparable candidates under the same protocol, and returns the two or three strongest for an onsite pilot. World models and simulation are internal support inside those campaigns, not the primary offer or ground truth.",
  },
  {
    question: "What does a campaign return?",
    answer:
      "The top two or three candidates, with confidence and uncertainty, the major failure patterns, scenario-level performance, review media, and a recommended onsite pilot plan. A Robot Match adds each team's capability and integration gaps. We stand behind the ordering (rank fidelity) inside the measured site, task, and threshold scope — not a calibrated success guarantee, and not a deployment guarantee.",
  },
  {
    question: "What if no candidate is strong enough?",
    answer:
      "The result can be “ranking inconclusive” or “no candidate met the threshold,” and Blueprint reports it honestly. Every candidate receives one verdict — shortlisted, viable but below shortlist, insufficient evidence, incompatible, or below minimum threshold. Blueprint never manufactures a winner; you are buying a better pilot decision, not a guaranteed one.",
  },
  {
    question: "Where is the evidence strongest today?",
    answer:
      robotPolicyEvaluationBeachhead +
      " That beachhead is where a campaign ranks candidates most confidently right now — never a guarantee or safety certification.",
  },
  {
    question: "Is the published 0.929 correlation a Blueprint result?",
    answer:
      "No. SC3-Eval reports a 0.929 closed-loop Pearson correlation across seven VLA policies. Blueprint cites that third-party research as category context; a Blueprint result exists only when a specific owned run records its own evidence.",
  },
  {
    question: "Do robot teams pay to join a Robot Match?",
    answer:
      "No. During a sponsored Robot Match, compatible robot teams participate for free, so the ranking never looks pay-to-play. Later, once a site benchmark is established, teams can submit to it for a small, uniform $250–500 fee that never affects ranking or placement. Every candidate first passes a capability and embodiment gate.",
  },
  {
    question: "Are the sites page and run dashboard filled with samples?",
    answer:
      "No. Public site cards come only from current Pipeline-backed capture records, and the buyer run dashboard lists only records owned by the signed-in buyer. When no record exists, the interface shows an empty request path instead of invented supply or analytics.",
  },
  {
    question: "How do capturers and site operators participate?",
    answer:
      "Capturers are recruited, reviewed, and paid supply: they apply for assignments and see payout terms before work begins. Site operators are the buyers of a Robot Match and the controllers of access — they define access windows, privacy, restricted areas, rights, and commercial posture, and nothing is captured until they approve it. No application, capture, payout, or downstream use is treated as approved until the system that owns that state records it.",
  },
  {
    question: "Does a purchase prove execution or deployment readiness?",
    answer:
      "No. Payment, entitlement, queued execution, simulator output, ranking evidence, and field validation are separate states. The report separates the ranking inside Blueprint's evaluator from estimated onsite-pilot suitability and from unproven physical performance, safety, reliability, and deployment readiness. Blueprint reports each boundary separately.",
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
                  The questions that usually decide fit.
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
                    Browse site packages
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
