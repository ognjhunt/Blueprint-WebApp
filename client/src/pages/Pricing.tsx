/**
 * Pricing, in the minimal public design language.
 *
 * One number a robot team has to read, and one a site has to read. The page
 * that stood here sold episodes — a rate, two round sizes, the gap each count
 * could resolve, and the audit literature behind the choice — which asked the
 * buyer to solve a statistics problem before it could read a price. The
 * episode counts still exist; they are ours to set now, and they live in
 * `@/lib/evaluationPricing` below its operating-constants line, off this page
 * entirely.
 *
 * What is left is the arithmetic: entries × tasks × $99, with the definition of
 * an entry next to it, because "one policy on one embodiment" is the only part
 * of this model a buyer can get wrong.
 *
 * Every figure is still computed from the pricing module, so nothing here can
 * drift from what the API quotes.
 */
import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import {
  billingRules,
  entryBoundaries,
  entryDefinition,
  entryModel,
  entryPrice,
  formatPrice,
  included,
  includedLimit,
  quoteEntries,
  quoteExamples,
  siteAssessment,
} from "@/lib/evaluationPricing";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  "Sites pay nothing to find out whether a robot can do the job. Robot teams pay $99 for each policy they put on a site task — and nothing more.";

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
          <h1>Sites pay nothing.<br />Robot teams pay {formatPrice(entryPrice)} an entry.</h1>
          <p>
            One payer. A site records a walkthrough and gets an answer; robot teams pay for each
            policy they put on a task, and that is what funds it.
          </p>
        </header>

        <div className="ms-price-split">
          <section aria-labelledby="site-price-title">
            <p className="ms-eyebrow">If you operate a site</p>
            <p className="ms-price">
              <span className="ms-price-figure">{formatPrice(siteAssessment.amount)}</span>
              <span className="ms-price-unit">{siteAssessment.unit}</span>
            </p>
            <h2 id="site-price-title">{siteAssessment.summary}</h2>
            <ul className="ms-price-list">
              {siteAssessment.covers.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="ms-price-note"><strong>{siteAssessment.allIn}</strong></p>
            <p className="ms-price-note">{siteAssessment.bounded}</p>
            {/*
              Said plainly on the page rather than buried in terms. A site that
              pays nothing is not the customer, and letting someone discover
              that later is the dishonest version of this model.
            */}
            <p className="ms-price-note">{siteAssessment.whatWeGetFromIt}</p>
            <p className="ms-price-note">
              <strong>What is not free:</strong> {siteAssessment.whatIsNotFree}
            </p>
            <a className="ms-text-link" href="/contact/site-operator">
              Start a task assessment <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>

          <section aria-labelledby="team-price-title">
            <p className="ms-eyebrow">If you build robots</p>
            <p className="ms-price">
              <span className="ms-price-figure">{formatPrice(entryPrice)}</span>
              <span className="ms-price-unit">per entry</span>
            </p>
            <h2 id="team-price-title">{entryModel.summary}</h2>
            <p className="ms-price-note">{entryModel.detail}</p>
            <ul className="ms-price-list">
              {entryModel.notCharged.map((item) => <li key={item}>{item}</li>)}
            </ul>
            {/*
              The first question a team should ask about a model where the
              seller sizes the run: can a richer rival buy a longer one?
              Answered here rather than left to be discovered.
            */}
            <p className="ms-price-note"><strong>{entryModel.fairness}</strong></p>
            <a className="ms-text-link" href="/contact/robot-team">
              Apply as a robot team <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>
        </div>

        {/*
          The only part of a flat price a buyer can get wrong: whether a second
          embodiment, or a second policy, is a second bill. Both are. So the
          definition sits directly under the number rather than in the rules.
        */}
        <section className="ms-price-block" aria-labelledby="entry-title">
          <h2 id="entry-title">What one entry is</h2>
          <p className="ms-price-definition">{entryDefinition}</p>
          <ul className="ms-price-list">
            {entryBoundaries.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="ms-price-block" aria-labelledby="quote-title">
          <h2 id="quote-title">What it comes to</h2>
          <div className="ms-price-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">What you enter</th>
                  <th scope="col">Entries</th>
                  <th scope="col">Price</th>
                </tr>
              </thead>
              <tbody>
                {quoteExamples.map((example) => {
                  const quote = quoteEntries(example.entries, example.tasks);
                  return (
                    <tr key={example.label}>
                      <th scope="row">
                        {example.label}
                        <span>
                          {example.entries} {example.entries === 1 ? "entry" : "entries"} ×{" "}
                          {example.tasks} {example.tasks === 1 ? "task" : "tasks"}
                        </span>
                      </th>
                      <td>{quote.units}</td>
                      <td>{formatPrice(quote.usd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="ms-price-note">
            Entries × tasks × {formatPrice(entryPrice)}. You see that arithmetic and the balance it
            leaves before anything runs.
          </p>
        </section>

        <section className="ms-price-block" aria-labelledby="included-title">
          <h2 id="included-title">What {formatPrice(entryPrice)} covers</h2>
          <p className="ms-price-lede">
            We handle the evaluation itself. There is no budget to choose, no episode count to size,
            and no tier to upgrade.
          </p>
          <ul className="ms-price-list">
            {included.map((item) => <li key={item}>{item}</li>)}
          </ul>
          {/* A flat price is a promise about cost, not about certainty. The
              difference is the easiest thing here for a buyer to misread. */}
          <p className="ms-price-note"><strong>{includedLimit}</strong></p>
        </section>

        <section className="ms-price-block" aria-labelledby="rules-title">
          <h2 id="rules-title">Billing rules</h2>
          <ol className="ms-price-rules">
            {billingRules.map((item) => (
              <li key={item.rule}>
                <h3>{item.rule}</h3>
                <p>{item.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <p className="ms-price-basis">
          This is a starting price we intend to test with buyers, not an industry rate. No
          independent source establishes a market price for site-task robot evaluation.
        </p>

        <div className="ms-how-cta">
          <a className="ms-button ms-button-large" href="/contact/site-operator">
            Start a task assessment <ArrowRight size={20} aria-hidden="true" />
          </a>
          <a className="ms-text-link" href="/contact/robot-team">
            Apply as a robot team <ArrowRight size={20} aria-hidden="true" />
          </a>
        </div>
      </article>
    </>
  );
}
