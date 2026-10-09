import { SEO } from "@/components/SEO";
import { COMPANY } from "@/data/company";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  "Blueprint helps businesses assess one recurring task using real-site evidence and decide what to explore next.";

const principles = [
  "Start from the real job at a real site, not a demo.",
  "Keep a site's footage and details private unless the site chooses to share them.",
  "Say what a result does not show: a simulation result is not a physical test.",
  "Report failures and unknowns instead of manufacturing a green light.",
  "Show material findings and a provider-approved offer before anyone buys a pilot.",
] as const;

export default function About() {
  return (
    <>
      <SEO
        title="About | Blueprint"
        description={description}
        canonical="/about"
        jsonLd={[
          webPageJsonLd({ path: "/about", name: "About Blueprint", description }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        ]}
      />
      <article className="ms-legal ms-about ms-container">
        <p className="ms-eyebrow">About</p>
        <h1>We start with one real job.</h1>
        <p className="ms-about-lead">
          Blueprint helps a business describe one recurring job and review an initial assessment
          grounded in the available evidence. Our beta asks what is supported,
          what is uncertain, and what a useful next step would be.
        </p>

        <section>
          <h2>How it works</h2>
          <ol>
            <li>Show us a real job, your desired outcome, and permitted footage or a conversation about the work.</li>
            <li>Invited beta participants receive a free initial assessment and share feedback.</li>
            <li>Any later evaluation, integration, or physical pilot has its scope and cost agreed separately before proceeding.</li>
          </ol>
          <p><a href="/how-it-works">More on how it works</a> · <a href="/beta">Beta program</a></p>
        </section>

        <section>
          <h2>What we hold ourselves to</h2>
          <ul>
            {principles.map((principle) => <li key={principle}>{principle}</li>)}
          </ul>
        </section>

        <section>
          <h2>The company</h2>
          <dl className="ms-about-facts">
            <div><dt>Company</dt><dd>{COMPANY.legalName}</dd></div>
            <div><dt>Mailing address</dt><dd>{COMPANY.mailingAddress}</dd></div>
            <div><dt>Where we work</dt><dd>Sites in the United States film their own job. In-person capture visits: {COMPANY.visitServiceArea}.</dd></div>
            <div><dt>Contact</dt><dd><a href={`mailto:${COMPANY.emails.hello}`}>{COMPANY.emails.hello}</a></dd></div>
            <div><dt>Privacy</dt><dd><a href={`mailto:${COMPANY.emails.privacy}`}>{COMPANY.emails.privacy}</a></dd></div>
          </dl>
        </section>
      </article>
    </>
  );
}
