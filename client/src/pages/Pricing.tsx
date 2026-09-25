import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { entryPrice, formatPrice, pilotIntroductionFeeCapUsd, siteAssessment } from "@/lib/evaluationPricing";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  "Submit a robot task for free. Agree to Blueprint's 5% pilot fee, capped at $5,000, before free evaluation; pay only if you buy an introduced provider's pilot.";

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description={description}
        canonical="/pricing"
        jsonLd={[
          webPageJsonLd({ path: "/pricing", name: "Blueprint pricing", description }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
        ]}
      />

      <article className="ms-pricing ms-container">
        <header className="ms-pricing-intro">
          <p className="ms-eyebrow">Pricing</p>
          <h1>One task. Clear costs.</h1>
          <p>Show us the task. Review the offer. Buy the pilot only if it makes sense.</p>
        </header>

        <div className="ms-price-split">
          <section aria-labelledby="site-price-title">
            <p className="ms-eyebrow">For sites</p>
            <p className="ms-price">
              <span className="ms-price-figure">{formatPrice(siteAssessment.amount)}</span>
              <span className="ms-price-unit">to submit a task and review an offer</span>
            </p>
            <h2 id="site-price-title">Review an offer</h2>
            <p className="ms-price-note">
              Share one recurring task. Initial screening is free. Before we invite teams to evaluate,
              an authorized buyer agrees to the fee below for this task. No card required to start.
            </p>
            <a className="ms-text-link" href="/contact/site-operator">
              Start a task assessment <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>

          <section aria-labelledby="team-price-title">
            <p className="ms-eyebrow">For robot teams</p>
            <p className="ms-price">
              <span className="ms-price-figure">{formatPrice(0)}</span>
              <span className="ms-price-unit">to apply or evaluate an invited task</span>
            </p>
            <h2 id="team-price-title">Evaluate a matched task</h2>
            <p className="ms-price-note">
              Matched evaluations are free. You can accept the site's proposed pilot terms, suggest
              changes, or decline. Optional self-directed runs cost {formatPrice(entryPrice)} per entry,
              with no later supplier commission on that entry.
            </p>
            <a className="ms-text-link" href="/contact/robot-team">
              Apply for early access <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>
        </div>

        <section className="ms-price-block" aria-labelledby="pilot-service-title">
          <h2 id="pilot-service-title">If you buy a pilot</h2>
          <p>
            Blueprint charges the site 5% of the introduced provider's physical pilot price, capped at
            {" "}{formatPrice(pilotIntroductionFeeCapUsd)}. A {formatPrice(20000)} pilot means a {formatPrice(1000)}
            {" "}Blueprint fee. The site may propose the provider price and conditions; the provider
            may accept or counter. The provider handles installation. You can contract directly;
            the agreed fee still applies. No pilot purchase, no Blueprint fee.
          </p>
          <a className="ms-text-link" href="/terms">Fee details in our Terms</a>
        </section>
      </article>
    </>
  );
}
