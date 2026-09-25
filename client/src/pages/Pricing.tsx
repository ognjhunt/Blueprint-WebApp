import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { entryDefinition, entryPrice, formatPrice, siteAssessment } from "@/lib/evaluationPricing";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  `A site's initial task assessment is free. Invited robot teams join site-funded pilot projects at no charge; optional self-directed evaluations cost ${formatPrice(entryPrice)} per entry. Physical pilot costs are agreed separately.`;

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
            For a suitable task, Blueprint can prepare, coordinate, and measure a trial for a fixed,
            site-approved fee. The site agrees to that scope before we invite teams into the funded
            project. The robot provider or integrator quotes installation and operation separately.
            All costs are approved before work begins.
          </p>
          <a className="ms-text-link" href="/terms">Evaluation billing details in our Terms</a>
        </section>
      </article>
    </>
  );
}
