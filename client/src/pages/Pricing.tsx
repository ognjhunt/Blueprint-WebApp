import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { entryPrice, formatPrice, pilotServiceStartingFeeUsd, siteAssessment } from "@/lib/evaluationPricing";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  "Submit one task, review evaluation results and a provider-backed robot pilot offer for free. Approve the provider price and Blueprint fee before paid work.";

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
              Share one recurring task. We check fit and show you the evidence and a provider-approved
              pilot offer when one is credible. You approve the provider's price and Blueprint's fee
              together before paid work. No card required to start.
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
              Matched evaluations are free. You confirm the pilot scope and price; the site decides
              whether to buy it. Optional self-directed runs cost {formatPrice(entryPrice)} per entry,
              with no later supplier commission on that entry.
            </p>
            <a className="ms-text-link" href="/contact/robot-team">
              Apply for early access <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>
        </div>

        <section className="ms-price-block" aria-labelledby="pilot-service-title">
          <h2 id="pilot-service-title">If you approve a pilot</h2>
          <p>
            You see one itemized offer: the provider's pilot price plus Blueprint's scoped coordination
            and measurement fee, starting at {formatPrice(pilotServiceStartingFeeUsd)}. You approve the
            total before work begins. The provider handles installation and operation; both parties may
            invoice their own charges separately.
          </p>
          <a className="ms-text-link" href="/terms">Evaluation billing details in our Terms</a>
        </section>
      </article>
    </>
  );
}
