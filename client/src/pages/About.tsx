import { SEO } from "@/components/SEO";
import { COMPANY } from "@/data/company";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  "Blueprint helps businesses turn one recurring task into a scoped, funded, measurable robot pilot and decide what happens afterward.";

const principles = [
  "Start from the real task at a real site, not a demo.",
  "Keep a site's footage and details private unless the site chooses to share them.",
  "Say what a result does not show: a simulation result is not a physical test.",
  "Report failures and unknowns instead of manufacturing a green light.",
  "Keep initial screening free and agree on any paid pilot coordination before work begins.",
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
        <h1>We help one real task reach a measured robot pilot.</h1>
        <p className="ms-about-lead">
          Blueprint works with a business to define a recurring job, check which robot providers
          can credibly support it, and arrange a bounded physical trial with a budget and clear
          measures. We stay involved when the business decides whether to stop, change, extend,
          or deploy regularly.
        </p>

        <section>
          <h2>How it works</h2>
          <ol>
            <li>A site describes one repeated task and can film it on a phone. Initial screening is free.</li>
            <li>We confirm the requirements, budget range, timing, decision owner, and provider capability. Simulation can help answer specific questions when useful.</li>
            <li>For a credible fit, we help scope and measure a paid physical pilot. The provider or integrator installs and operates the robot; the site approves the commitment.</li>
            <li>We review the physical results with the site and help decide what to purchase next.</li>
          </ol>
          <p><a href="/how-it-works">More on how it works</a> · <a href="/pricing">Pricing</a></p>
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
            <div><dt>Where we work</dt><dd>Sites in the United States film their own task. In-person capture visits: {COMPANY.visitServiceArea}.</dd></div>
            <div><dt>Contact</dt><dd><a href={`mailto:${COMPANY.emails.hello}`}>{COMPANY.emails.hello}</a></dd></div>
            <div><dt>Privacy</dt><dd><a href={`mailto:${COMPANY.emails.privacy}`}>{COMPANY.emails.privacy}</a></dd></div>
          </dl>
        </section>
      </article>
    </>
  );
}
