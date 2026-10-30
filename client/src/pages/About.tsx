import { SEO } from "@/components/SEO";
import { COMPANY } from "@/data/company";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  "Blueprint tests robots and policies on a business's recurring job in a simulation of its site and shows an estimate of what's likely to work. Start with the work you need done.";

const principles = [
  "Start from the real job at a real site, not a demo.",
  "Keep a site's footage and details private unless the site chooses to share them.",
  "Say what a result does not show: a simulation result is not a physical test.",
  "Report failures and unknowns instead of manufacturing a green light.",
  "Make the evidence, total costs and responsibilities clear before a customer agrees a pilot.",
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
          Blueprint helps businesses find the right way to automate recurring work. You start with the job.
          We analyze your video, reconstruct the site in simulation, test robots and policies (the AI software that
          controls a robot) on the job, and show you an estimate of what&apos;s likely to work. Then we work alongside
          a deployment company on your site. The beta is free for sites and partners.
        </p>

        <section>
          <h2>How it works</h2>
          <ol>
            <li>A site sends video of recurring work. We analyze it and draft a job brief for the site to review.</li>
            <li>We reconstruct the site in simulation and test many robots and policies on the job ourselves.</li>
            <li>The site sees an estimate of what&apos;s likely to work, or &ldquo;held&rdquo; if we can&apos;t simulate that kind of job yet.</li>
            <li>We work alongside a deployment company on the real site; the site agrees the pilot directly with that company.</li>
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
