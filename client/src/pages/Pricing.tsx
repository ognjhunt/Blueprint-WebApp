/**
 * Pricing, in the minimal public design language.
 *
 * The page keeps two bills apart, and keeps one of them out of a reader's way
 * entirely. A site is buying a decision and pays once, all-in; it should never
 * have to learn what an episode is to understand its own invoice, so no
 * per-unit rate appears anywhere in the site column. A robot team is buying
 * execution, and buys exactly one thing: screening.
 *
 * The four-tier ladder this page used to carry is gone. A menu of budgets asks
 * the buyer to solve a statistics problem in order to pick a line item, and the
 * honest answer — how many episodes separate two candidates — does not vary by
 * customer. Two fixed rounds answer it once.
 *
 * Every figure is computed from `@/lib/episodePricing`, so the rate, the quote
 * table and the round counts cannot drift apart. What each round resolves is
 * stated next to what it costs, including where it stops: screening never names
 * a winner, and the finalist round reports a tie it cannot separate rather than
 * inventing one.
 */
import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import {
  balanceModel,
  billingRules,
  episodeBoundaries,
  episodeDefinition,
  episodeRate,
  episodesForBalance,
  finalistRound,
  formatCount,
  formatPrice,
  quoteScreening,
  quoteExamples,
  rounds,
  screeningRound,
  shortlistRule,
  siteAssessment,
} from "@/lib/episodePricing";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  "Sites pay nothing to find out whether a robot can do the job. Robot teams pay $0.50 per episode to screen checkpoints against real sites — and nothing more if they are shortlisted.";

const sampleBalance = 200;
const perCheckpoint = quoteScreening(1);

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
          <h1>Sites pay nothing to find out.<br />Robot teams pay to be screened.</h1>
          <p>
            One payer. A site records a walkthrough and gets an answer; robot teams pay for
            access to real sites, and that is what funds it.
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
            <p className="ms-price-note">
              {balanceModel.detail} Screening one checkpoint is{" "}
              {formatCount(screeningRound.episodes)} episodes —{" "}
              <strong>{formatPrice(perCheckpoint.usd)}</strong>.
            </p>
            <ul className="ms-price-list">
              {balanceModel.notCharged.map((item) => <li key={item}>{item}</li>)}
            </ul>
            {/*
              The first question a team should ask about a model where vendors
              fund the system: can a richer rival buy a longer run? Answered
              here rather than left to be discovered.
            */}
            <p className="ms-price-note"><strong>{balanceModel.fairness}</strong></p>
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

        <section className="ms-price-block" aria-labelledby="rounds-title">
          <h2 id="rounds-title">The two rounds</h2>
          <p className="ms-price-lede">
            Every task runs the same two rounds, at the same two episode counts, for everyone. There
            is no budget to choose and no tier to upgrade.
          </p>
          <div className="ms-round-pair">
            {rounds.map((round) => (
              <article key={round.id} className="ms-round">
                <p className="ms-eyebrow">{round.name}</p>
                <p className="ms-round-count">
                  <span>{formatCount(round.episodes)}</span> episodes per candidate
                </p>
                <p className="ms-round-funder">{round.funder}</p>
                <p className="ms-round-purpose">{round.purpose}</p>
                <p className="ms-round-resolves">{round.resolves}</p>
                <p className="ms-round-limit">{round.limit}</p>
              </article>
            ))}
          </div>
          <p className="ms-round-rule">
            <strong>{shortlistRule.statement}</strong> {shortlistRule.detail}
          </p>
          <p className="ms-price-note">
            These are Blueprint's budgets, not an industry standard. Published protocols range from
            about ten trials per task on real hardware to five hundred per suite in simulation, and
            audits of that work find most reported improvements are not separable at the counts
            used. We state ours by what they resolve instead. A simulated ranking is still not a
            real-world ranking, and no episode count closes that gap.
          </p>
        </section>

        <section className="ms-price-block" aria-labelledby="episode-title">
          <h2 id="episode-title">What one episode is</h2>
          <p className="ms-price-definition">{episodeDefinition}</p>
          <ul className="ms-price-list">
            {episodeBoundaries.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="ms-price-block" aria-labelledby="quote-title">
          <h2 id="quote-title">What screening comes to</h2>
          <div className="ms-price-table">
            <table>
              <thead>
                <tr><th scope="col">Checkpoints entered</th><th scope="col">Episodes</th><th scope="col">Price</th></tr>
              </thead>
              <tbody>
                {quoteExamples.map((example) => {
                  const quote = quoteScreening(example.checkpoints);
                  return (
                    <tr key={example.label}>
                      <th scope="row">
                        {example.label}
                        <span>{example.checkpoints} × {formatCount(screeningRound.episodes)} episodes</span>
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
            Checkpoints × {formatCount(screeningRound.episodes)} × {formatPrice(episodeRate)}. You
            see that arithmetic and the balance it leaves before anything runs. If your checkpoint
            reaches the shortlist, the {formatCount(finalistRound.episodes)}-episode finalist round
            is run at Blueprint's cost and adds nothing to this bill.
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
