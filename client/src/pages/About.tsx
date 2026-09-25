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
        <h1>We help one real task reach a measured robot pilot.</h1>
        <p className="ms-about-lead">
          Blueprint helps a business describe one recurring job and receive a credible robot-pilot
          offer. A provider confirms the scope, price, and timing. We keep the task and outcome
          record so the business can decide whether to stop, change, or continue.
        </p>

        <section>
          <h2>How it works</h2>
          <ol>
            <li>Show us the task, including phone footage and rough economics. You can start while exploring.</li>
            <li>We check fit and use evaluation where helpful. A provider confirms its pilot scope and price; we add our scoped fee to one itemized offer.</li>
            <li>You approve the total. The provider installs and operates the robot; we coordinate the plan and keep the outcome record.</li>
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
