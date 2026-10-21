import { SEO } from "@/components/SEO";
import { COMPANY } from "@/data/company";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  "Blueprint helps businesses assess suitable automation for recurring jobs, compare delivery proposals and plan measured pilots. Start with the work you need done.";

const principles = [
  "Start from the real job at a real site, not a demo.",
  "Keep a site's footage and details private unless the site chooses to share them.",
  "Say what a result does not show: a simulation result is not a physical test.",
  "Report failures and unknowns instead of manufacturing a green light.",
  "Make the evidence, total costs and responsibilities clear before a customer chooses a delivery partner.",
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
          Blueprint helps businesses find a suitable way to automate recurring work. Start with the job:
          we help define the requirements, assess options, test where needed and choose a delivery
          partner for a measured pilot. The beta is free for sites and partners.
        </p>

        <section>
          <h2>How it works</h2>
          <ol>
            <li>A site describes recurring work and reviews a job brief with us. Video is optional at the start.</li>
            <li>We assess suitable approaches, delivery feasibility and the evidence needed for the decision.</li>
            <li>The customer reviews delivery proposals, chooses a partner and agrees a measured pilot directly with that company.</li>
            <li>We record the outcome so the next decision can build on what was learned.</li>
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
