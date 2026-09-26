import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { formatPrice, matchFeeUsd } from "@/lib/evaluationPricing";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  `No match, no fee. Tell Blueprint about one recurring task for free. When we find a robot team that can do it and wants your pilot, we introduce you. Our fee is ${formatPrice(matchFeeUsd)}.`;

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
            Tell us about the task for free. When we find a robot team that can do it and wants your
            pilot, we introduce you right away. Our fee is {formatPrice(matchFeeUsd)}. If we don't find
            one, you pay nothing.
          </p>
        </header>

        <div className="ms-price-split">
          <section aria-labelledby="site-price-title">
            <p className="ms-eyebrow">For sites</p>
            <p className="ms-price">
              <span className="ms-price-figure">{formatPrice(matchFeeUsd)}</span>
              <span className="ms-price-unit">per task, only if we find a match</span>
            </p>
            <h2 id="site-price-title">Find a robot team</h2>
            <p className="ms-price-note">
              A match is a robot team that passed the evaluation for your task, fits your budget, and
              wants to run your pilot. You get every team that matches, their full results, and a pilot
              brief you both start from. One fee per task, however many teams match.
            </p>
            <a className="ms-text-link" href="/contact/site-operator">
              Start a task assessment <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>

          <section aria-labelledby="team-price-title">
            <p className="ms-eyebrow">For robot teams</p>
            <p className="ms-price">
              <span className="ms-price-figure">{formatPrice(0)}</span>
              <span className="ms-price-unit">to join and evaluate matched tasks</span>
            </p>
            <h2 id="team-price-title">Evaluate real site tasks</h2>
            <p className="ms-price-note">
              Evaluate the site tasks we match you to for free. If you pass and want the pilot, we
              introduce you to the site.
            </p>
            <a className="ms-text-link" href="/contact/robot-team">
              Apply for early access <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>
        </div>

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
