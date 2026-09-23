import { SEO } from "@/components/SEO";
import { COMPANY } from "@/data/company";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  "Blueprint Robotics, Inc. makes the first months of a robot deployment fast: a site films one task, and robot teams are tested against it before anyone commits to a pilot.";

const principles = [
  "Start from the real task at a real site, not a demo.",
  "Keep a site's footage and details private unless the site chooses to share them.",
  "Say what a result does not show: a simulation result is not a physical test.",
  "Report failures and unknowns instead of manufacturing a green light.",
  "Charge robot teams one flat, published price, and sites nothing to find out.",
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
        <h1>We make the first months of a robot deployment fast.</h1>
        <p className="ms-about-lead">
          Robots can already do a great deal of real work. What slows a deployment is the work
          before a pilot: understanding one site's task, recreating its conditions, and finding out
          which robot actually fits. Blueprint does that work once per site, so every robot team can
          be tested against the same real task.
        </p>

        <section>
          <h2>How it works</h2>
          <ol>
            <li>A site films one repeated task on a phone. It costs the site nothing.</li>
            <li>We rebuild the work area as a simulated scene and check whether a robot evaluation would hold up there.</li>
            <li>Robot teams run their policies against the scene. The site sees who fits, and why, before anyone commits to a physical pilot.</li>
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
