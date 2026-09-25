import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { entryDefinition, entryPrice, formatPrice, pilotServiceStartingFeeUsd, siteAssessment } from "@/lib/evaluationPricing";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  `A site's initial task assessment is free. Blueprint's pilot service starts at ${formatPrice(pilotServiceStartingFeeUsd)}, with provider costs quoted separately. Invited robot teams join funded pilot projects at no charge; optional self-directed evaluations cost ${formatPrice(entryPrice)} per entry.`;

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
          <p>Start with a free task assessment. Agree on any pilot work before it begins.</p>
        </header>

        <div className="ms-price-split">
          <section aria-labelledby="site-price-title">
            <p className="ms-eyebrow">For sites</p>
            <p className="ms-price">
              <span className="ms-price-figure">{formatPrice(siteAssessment.amount)}</span>
              <span className="ms-price-unit">to start</span>
            </p>
            <h2 id="site-price-title">Initial task assessment</h2>
            <p className="ms-price-note">
              Describe one recurring task. We assess whether a robot pilot is credible and what
              needs to change if it is not. No card required. A suitable pilot project is quoted
              separately for your approval.
            </p>
            <a className="ms-text-link" href="/contact/site-operator">
              Start a task assessment <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>

          <section aria-labelledby="team-price-title">
            <p className="ms-eyebrow">For robot teams</p>
            <p className="ms-price">
              <span className="ms-price-figure">{formatPrice(0)}</span>
              <span className="ms-price-unit">to apply or join an invited pilot project</span>
            </p>
            <h2 id="team-price-title">Bring a credible solution</h2>
            <p className="ms-price-note">
              Invited teams pay no evaluation entry fee for a site-funded pilot project. Optional
              self-directed runs outside that project cost {formatPrice(entryPrice)} per entry.
              {" "}{entryDefinition} There is no later supplier commission on a paid entry.
            </p>
            <a className="ms-text-link" href="/contact/robot-team">
              Apply for early access <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>
        </div>

        <section className="ms-price-block" aria-labelledby="pilot-service-title">
          <h2 id="pilot-service-title">Physical pilots</h2>
          <p>
            Blueprint's preparation, coordination, and measurement fee starts at {formatPrice(pilotServiceStartingFeeUsd)}
            {" "}for one task at one site. Provider installation and operation cost extra. Before you commit,
            we provide an itemized quote for the full trial. The result adds no extra Blueprint fee;
            any ongoing deployment is agreed separately.
          </p>
          <a className="ms-text-link" href="/terms">Evaluation billing details in our Terms</a>
        </section>
      </article>
    </>
  );
}
