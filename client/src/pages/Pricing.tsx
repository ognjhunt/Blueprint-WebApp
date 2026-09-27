import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { entryPrice, formatPrice, matchFeeUsd, matchReplacementPolicy } from "@/lib/evaluationPricing";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  `Start a task assessment for free. Authorize matching when you are ready. Blueprint charges ${formatPrice(matchFeeUsd)} per task when a qualifying robot team is introduced.`;

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
            Start with a free task assessment. Choose whether to open your task to pilot proposals.
            Pay {formatPrice(matchFeeUsd)} when we introduce a qualifying match.
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
            <p className="ms-price-note"><a className="ms-text-link" href="/how-it-works#match-package">See what a match includes <ArrowRight size={16} aria-hidden="true" /></a></p>
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
          <details className="ms-task-interest ms-visitor-detail">
            <summary>Optional self-directed robot evaluations</summary>
            <p>
              Invited evaluations are free within the invitation's scope. Approved teams can also
              choose a listed task and buy a self-directed run for {formatPrice(entryPrice)}:
              {" "}one robot running one policy on one task. You see the plan and price before authorizing a run.
            </p>
          </details>
          </section>
        </div>

        <section className="ms-price-block" id="match-fee" aria-labelledby="match-fee-title">
          <h2 id="match-fee-title">When you commit</h2>
          <p>
            Submitting a task is free. After reviewing your brief, you explicitly authorize the fee
            when you open it to proposals. We invoice at introduction, even if you choose not to buy
            the pilot. If no team matches, you owe nothing.
          </p>
          <details className="ms-task-interest ms-visitor-detail">
            <summary>What if the provider pulls out or changes the offer?</summary>
            <p>{matchReplacementPolicy} <a href="mailto:hello@tryblueprint.io">Contact us</a> with your task link.</p>
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
