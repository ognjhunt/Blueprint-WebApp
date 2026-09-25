import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { entryDefinition, entryPrice, formatPrice, siteAssessment } from "@/lib/evaluationPricing";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  `A site's initial task assessment is free. Robot teams pay ${formatPrice(entryPrice)} per evaluation entry. Physical pilots and Blueprint's pilot coordination are agreed separately.`;

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
              needs to change if it is not. No card required.
            </p>
            <a className="ms-text-link" href="/contact/site-operator">
              Start a task assessment <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>

          <section aria-labelledby="team-price-title">
            <p className="ms-eyebrow">For robot teams</p>
            <p className="ms-price">
              <span className="ms-price-figure">{formatPrice(entryPrice)}</span>
              <span className="ms-price-unit">per evaluation entry</span>
            </p>
            <h2 id="team-price-title">Task evaluation</h2>
            <p className="ms-price-note">
              {entryDefinition} Applying is free. You see the total before a run. No subscription
              or later supplier commission on that entry.
            </p>
            <a className="ms-text-link" href="/contact/robot-team">
              Apply for early access <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>
        </div>

        <section className="ms-price-block" aria-labelledby="pilot-service-title">
          <h2 id="pilot-service-title">Physical pilots</h2>
          <p>
            For a suitable task, Blueprint can prepare, coordinate, and measure a trial for a fixed,
            site-approved fee. The robot provider or integrator quotes installation and operation
            separately. The site approves the scope and costs before work begins.
          </p>
          <a className="ms-text-link" href="/terms">Evaluation billing details in our Terms</a>
        </section>
      </article>
    </>
  );
}
