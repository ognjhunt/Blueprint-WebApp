/**
 * Pricing, in the minimal public design language.
 *
 * The page's whole job is to keep two bills apart. A site is buying a scoped
 * assessment of one task; a robot team is buying execution. Readers arriving
 * from either side kept reading the other side's number as their own, so the
 * two prices are split into two columns above everything else and nothing
 * further down mixes them.
 *
 * Every figure here is computed from `@/lib/episodePricing` rather than typed
 * into the copy, so the rate cannot drift out of sync with the examples: a
 * change to `episodeRate` re-prices the quote table, the budget ladder and the
 * staged-testing comparison together.
 *
 * What the page deliberately does not do is imply a standard. The budget
 * ladder is Blueprint's own starting scope, and it says so — there is no
 * published episode count that settles a close comparison, and quoting one as
 * though there were would be exactly the borrowed authority this repo forbids.
 */
import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import {
  balanceModel,
  billingRules,
  episodeBoundaries,
  episodeBudgets,
  episodeDefinition,
  episodeRate,
  episodesForBalance,
  formatCount,
  formatPrice,
  quoteEpisodes,
  quoteExamples,
  siteAssessment,
  stagedExample,
} from "@/lib/episodePricing";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  "Two prices. A site pays $2,500 once for a scoped site-task assessment. Robot teams pay $0.50 per episode from a prepaid balance — no subscription.";

/** "$5–$10" for a range, "$25" for a point, "$250+" for an open top end. */
function budgetCost(each: readonly [number, number | null]) {
  const [low, high] = each;
  const from = formatPrice(quoteEpisodes(1, low).usd);
  if (high === null) return `${from}+`;
  if (high === low) return from;
  return `${from}–${formatPrice(quoteEpisodes(1, high).usd)}`;
}

const sampleBalance = 200;

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
          <h1>Sites pay for the assessment.<br />Robot teams pay for episodes.</h1>
          <p>Two prices, two payers. No subscription on either side.</p>
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
            <p className="ms-price-note">{siteAssessment.evaluationBudget}</p>
            <p className="ms-price-note">{siteAssessment.notCharged}</p>
            <a className="ms-text-link" href="/contact/site-operator">
              Discuss your site <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>

          <section aria-labelledby="team-price-title">
            <p className="ms-eyebrow">If you build robots</p>
            <p className="ms-price">
              <span className="ms-price-figure">{formatPrice(episodeRate)}</span>
              <span className="ms-price-unit">per episode</span>
            </p>
            <h2 id="team-price-title">{balanceModel.summary}</h2>
            <ul className="ms-price-list">
              {balanceModel.notCharged.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="ms-price-note">
              Your balance is held in dollars, so a rate that differs for an unusual workload stays
              honest. {formatPrice(sampleBalance)} is {formatCount(episodesForBalance(sampleBalance))}{" "}
              standard episodes.
            </p>
            <a className="ms-text-link" href="/contact/robot-team">
              Apply as a robot team <ArrowRight size={20} aria-hidden="true" />
            </a>
          </section>
        </div>

        <section className="ms-price-block" aria-labelledby="episode-title">
          <h2 id="episode-title">What one episode is</h2>
          <p className="ms-price-definition">{episodeDefinition}</p>
          <ul className="ms-price-list">
            {episodeBoundaries.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="ms-price-block" aria-labelledby="quote-title">
          <h2 id="quote-title">What that comes to</h2>
          <div className="ms-price-table">
            <table>
              <thead>
                <tr><th scope="col">What you run</th><th scope="col">Episodes</th><th scope="col">Price</th></tr>
              </thead>
              <tbody>
                {quoteExamples.map((example) => {
                  const quote = quoteEpisodes(example.checkpoints, example.episodesEach);
                  return (
                    <tr key={example.label}>
                      <th scope="row">
                        {example.label}
                        <span>{example.checkpoints} × {formatCount(example.episodesEach)} episodes</span>
                      </th>
                      <td>{formatCount(quote.episodes)}</td>
                      <td>{formatPrice(quote.usd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="ms-price-note">
            Checkpoints × episodes × {formatPrice(episodeRate)}. You see that arithmetic and the
            balance it leaves before anything runs.
          </p>
        </section>

        <section className="ms-price-block" aria-labelledby="budget-title">
          <h2 id="budget-title">How many episodes to buy</h2>
          <p className="ms-price-lede">
            Start at 50 and spend more only on the candidates still close enough to argue about.
            These are Blueprint's starting budgets, not an industry standard — no published episode
            count settles a close comparison, and we will not quote one as though it did.
          </p>
          <dl className="ms-price-rows">
            {episodeBudgets.map((budget) => (
              <div key={budget.stage}>
                <dt>{budget.stage}</dt>
                <dd className="ms-price-rows-figure">
                  {budget.episodes} episodes<span>{budgetCost(budget.each)} per checkpoint</span>
                </dd>
                <dd>{budget.purpose}</dd>
              </div>
            ))}
          </dl>
          <p className="ms-price-note">
            {stagedExample.staged.label} is {formatCount(stagedExample.staged.episodes)} episodes —{" "}
            {formatPrice(quoteEpisodes(1, stagedExample.staged.episodes).usd)}.{" "}
            {stagedExample.flat.label} is {formatCount(stagedExample.flat.episodes)} —{" "}
            {formatPrice(quoteEpisodes(1, stagedExample.flat.episodes).usd)}. Same six checkpoints,
            and the cheap route eliminates the weak ones first.
          </p>
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
          These are starting prices we intend to test with buyers, not an industry rate. No
          independent source establishes a market price for site-task robot evaluation, and neither
          number is derived from one.
        </p>

        <div className="ms-how-cta">
          <a className="ms-button ms-button-large" href="/contact/site-operator">
            Discuss your site <ArrowRight size={20} aria-hidden="true" />
          </a>
          <a className="ms-text-link" href="/contact/robot-team">
            Apply as a robot team <ArrowRight size={20} aria-hidden="true" />
          </a>
        </div>
      </article>
    </>
  );
}
