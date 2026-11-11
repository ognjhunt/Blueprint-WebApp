import { SEO } from "@/components/SEO";
import { COMPANY } from "@/data/company";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description =
  "Blueprint checks real robots against a business's recurring job by their published specifications, tests control policies on it in a simulation of its site and says how sure it is. Start with the work you need done.";

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
          We analyze your video, check real robot models against the job by their published specifications, check the
          picked robot&apos;s reach and arm path in a simulation of your site, and compare public control policies (the
          software that drives a robot) on the job on a research arm. You see which robot most likely fits, how sure we
          are and what the simulation found. Then you can share the job with deployment
          companies we&apos;ve approved. The beta is free for sites and partners.
        </p>

        <section>
          <h2>How it works</h2>
          <ol>
            <li>A site sends an email and a video of recurring work. We draft the job description from the video for the site to review.</li>
            <li>We check real robot models against the job by their published specifications and show which most likely fits, a runner-up, what was ruled out and why, who already uses those robots for work like this (with sources) and how sure we are.</li>
            <li>We reconstruct the site in simulation, check the picked robot&apos;s reach and arm path there and compare public control policies on the job on a research arm. The site sees what the simulation found and how much that result can be trusted, or &ldquo;held&rdquo; if we can&apos;t simulate that kind of job yet.</li>
            <li>The site can share an anonymised job card with deployment companies Blueprint has approved, and agrees any pilot directly with one of them.</li>
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
            <div><dt>Where we work</dt><dd>Sites in the United States film their own job.</dd></div>
            <div><dt>Contact</dt><dd><a href={`mailto:${COMPANY.emails.hello}`}>{COMPANY.emails.hello}</a></dd></div>
            <div><dt>Privacy</dt><dd><a href={`mailto:${COMPANY.emails.privacy}`}>{COMPANY.emails.privacy}</a></dd></div>
          </dl>
        </section>
      </article>
    </>
  );
}
