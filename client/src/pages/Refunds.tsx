import { SEO } from "@/components/SEO";
import { COMPANY } from "@/data/company";
import { pilotReplacementPolicy } from "@/lib/evaluationPricing";
import { legalUpdatePending, PREVIOUS_TERMS_URL, TERMS_URL } from "@/lib/legalAcceptance";

/** Restates existing commercial commitments; it does not introduce paid beta checkout. */
export default function Refunds() {
  const applicableTerms = legalUpdatePending() ? PREVIOUS_TERMS_URL : TERMS_URL;
  return <>
    <SEO title="Refunds and cancellations | Blueprint" description="The beta is free. How to request a refund for a prior purchase or discuss a pilot cancellation." canonical="/refunds" />
    <article className="ms-legal ms-container">
      <h1>Refunds and cancellations</h1>
      <p>This page explains the refund commitments in our <a href={applicableTerms}>applicable Terms of Service</a>. It does not replace the terms of a prior purchase or a signed agreement.</p>
      <section>
        <h2>The beta is free</h2>
        <p>Blueprint charges sites and partners nothing for submitting a job, building the simulation, the evaluation or its result. There are no paid private evaluations, top-ups or checkout during the beta, so there is no new Blueprint fee to refund.</p>
      </section>
      <section>
        <h2>Purchases made before the free beta</h2>
        <p>You can request a refund of any unused balance bought before the free beta. Existing refund and settlement terms continue to apply to those purchases. If we end the Service for a reason other than your breach of the Terms, we refund any unused balance bought before the free beta.</p>
        <p>Email <a href={`mailto:${COMPANY.emails.hello}?subject=Refund%20request`}>{COMPANY.emails.hello}</a> from your account email. Include the receipt or purchase reference, if you have it, and what you would like us to review. Do not send card numbers, passwords or API keys.</p>
        <p>We review the purchase and its applicable terms and tell you the outcome. A request is not confirmation that a refund has been issued. Any confirmed refund and expected processing time will be explained in our reply.</p>
      </section>
      <section>
        <h2>Physical pilots and cancellations</h2>
        <p>The site and the deployment company agree the physical pilot&rsquo;s scope, dates, price and cancellation terms directly. Blueprint takes no cut. Contact the party you contracted with about those payments; Blueprint cannot refund money paid directly to a deployment company.</p>
        <p>{pilotReplacementPolicy} Contact <a href={`mailto:${COMPANY.emails.hello}`}>{COMPANY.emails.hello}</a> with your job link to discuss a replacement or a cancellation.</p>
      </section>
      <section>
        <h2>Your rights and contact</h2>
        <p>This page does not limit any refund or consumer rights that cannot be waived under applicable law.</p>
        <p>{COMPANY.legalName}, {COMPANY.mailingAddress}. Legal questions: <a href={`mailto:${COMPANY.emails.legal}`}>{COMPANY.emails.legal}</a>.</p>
      </section>
    </article>
  </>;
}
