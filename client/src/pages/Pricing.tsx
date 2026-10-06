import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { formatPrice, pilotFeeUsd, pilotReplacementPolicy } from "@/lib/evaluationPricing";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  `Start a job assessment for free. Get one recommended pilot. Blueprint charges ${formatPrice(pilotFeeUsd)} per job only when you book it.`;

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
          <h1>No pilot, no fee.</h1>
          <p>
            Start with a free job assessment. We pick the robot team and send you one recommended pilot.
            Pay {formatPrice(pilotFeeUsd)} only when you book it.
          </p>
        </header>

        <div className="ms-price-split">
          <section aria-labelledby="site-price-title">
            <p className="ms-eyebrow">For sites</p>
            <p className="ms-price">
              <span className="ms-price-figure">{formatPrice(pilotFeeUsd)}</span>
              <span className="ms-price-unit">per job, only when you book the pilot</span>
            </p>
            <h2 id="site-price-title">Get a recommended pilot</h2>
            <p className="ms-price-note">
              We pick one robot team that passed the evaluation for your job, fits your budget, and
              wants to run your pilot. You get one recommended pilot: what it tests, what you provide,
              the cost, the dates and what is still uncertain. Book it in one step. One fee per job.
            </p>
            <p className="ms-price-note"><a className="ms-text-link" href="/how-it-works#warehouse-task">See how a pilot works <ArrowRight size={16} aria-hidden="true" /></a></p>
            <a className="ms-text-link" href="/contact/site-operator">
              Start a job assessment <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>

          <section aria-labelledby="team-price-title">
            <p className="ms-eyebrow">For robot teams</p>
            <p className="ms-price">
              <span className="ms-price-figure">{formatPrice(0)}</span>
              <span className="ms-price-unit">to join and evaluate invited jobs</span>
            </p>
            <h2 id="team-price-title">Evaluate real site jobs</h2>
            <p className="ms-price-note">
              Evaluate for a pilot for free when invited. The site sees your results and can consider
              you for the pilot.
            </p>
            <a className="ms-text-link" href="/contact/robot-team">
              Apply for early access <ArrowRight size={20} aria-hidden="true" />
            </a>

          </section>
        </div>

        <section className="ms-price-block" id="pilot-fee" aria-labelledby="pilot-fee-title">
          <h2 id="pilot-fee-title">When you commit</h2>
          <p>
            Submitting a job, screening, evaluation and our recommendation are free. You agree to the
            fee once, when you book the recommended pilot. If you do not book, or we find no credible
            fit, you owe nothing.
          </p>
          <details className="ms-task-interest ms-visitor-detail">
            <summary>What if the provider pulls out or changes the offer?</summary>
            <p>{pilotReplacementPolicy} <a href="mailto:hello@tryblueprint.io">Contact us</a> with your job link.</p>
          </details>
        </section>

        <section className="ms-price-block" aria-labelledby="pilot-title">
          <h2 id="pilot-title">The pilot itself</h2>
          <p>
            The robot team prices and runs the pilot, and the recommended pilot shows that cost before
            you book. Blueprint coordinates it and takes no cut of the pilot or any deployment that follows.
          </p>
          <a className="ms-text-link" href="/terms">Fee details in our Terms</a>
        </section>
      </article>
    </>
  );
}
