import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { formatPrice, matchFeeUsd, matchReplacementPolicy } from "@/lib/evaluationPricing";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  `Start a job assessment for free. Authorize matching when you are ready. Blueprint charges ${formatPrice(matchFeeUsd)} per job when a qualifying robot team is introduced.`;

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
          <h1>No match, no fee.</h1>
          <p>
            Start with a free job assessment. Choose whether to open your job to pilot proposals.
            Pay {formatPrice(matchFeeUsd)} when we introduce a qualifying match.
          </p>
        </header>

        <div className="ms-price-split">
          <section aria-labelledby="site-price-title">
            <p className="ms-eyebrow">For sites</p>
            <p className="ms-price">
              <span className="ms-price-figure">{formatPrice(matchFeeUsd)}</span>
              <span className="ms-price-unit">per job, only if we find a match</span>
            </p>
            <h2 id="site-price-title">Find a robot team</h2>
            <p className="ms-price-note">
              A match is a robot team that passed the evaluation for your job, fits your budget, and
              wants to run your pilot. You get every team that matches, their full results, and a pilot
              brief you both start from. One fee per job, however many teams match.
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
              <span className="ms-price-unit">to join and evaluate matched jobs</span>
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

        <section className="ms-price-block" id="match-fee" aria-labelledby="match-fee-title">
          <h2 id="match-fee-title">When you commit</h2>
          <p>
            Submitting a job is free. After reviewing your brief, you explicitly authorize the fee
            when you open it to proposals. We invoice at introduction, even if you choose not to buy
            the pilot. If no team matches, you owe nothing.
          </p>
          <details className="ms-task-interest ms-visitor-detail">
            <summary>What if the provider pulls out or changes the offer?</summary>
            <p>{matchReplacementPolicy} <a href="mailto:hello@tryblueprint.io">Contact us</a> with your job link.</p>
          </details>
        </section>

        <section className="ms-price-block" aria-labelledby="pilot-title">
          <h2 id="pilot-title">The pilot itself</h2>
          <p>
            You and the robot team agree the pilot's price and terms directly. Blueprint takes no cut of
            the pilot or any deployment that follows.
          </p>
          <a className="ms-text-link" href="/terms">Fee details in our Terms</a>
        </section>
      </article>
    </>
  );
}
