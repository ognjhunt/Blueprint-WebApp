import { BareBack, BareButton, BareGroup, BareRows, BareScreen } from "@/components/bare/Bare";
import { SEO } from "@/components/SEO";
import { COMPANY } from "@/data/company";
import { EVERYDAY_ANSWERS, FREE_FOR_SITES, INTRODUCIBLE_ANSWERS, JOBS_THAT_FIT, QUESTIONS_SEO_DESCRIPTION, START_JOB, TESTED_ANSWERS } from "@/lib/publicCopy";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

/**
 * Questions, bare bones: the one details screen for the public pages, in short labelled rows: what a site pays (nothing),
 * the job packet, how deployment companies respond, the video's privacy, and who we are.
 */
export default function Beta() {
  return (
    <>
      <SEO title="Questions | Blueprint" description={QUESTIONS_SEO_DESCRIPTION} canonical="/beta" jsonLd={[
        webPageJsonLd({ path: "/beta", name: "Blueprint questions", description: QUESTIONS_SEO_DESCRIPTION }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Questions", path: "/beta" }]),
      ]} />
      <div className="bare-page">
        <BareScreen>
          <BareBack href="/how-it-works" />
          <h1>Questions</h1>
          <BareRows id="scope" title="For sites" rows={[
            { key: "cost", label: "Cost", value: FREE_FOR_SITES },
            { key: "jobs", label: "Jobs", value: JOBS_THAT_FIT },
            { key: "where", label: "Where", value: "We take videos only from sites in the United States." },
          ]} />
          <BareRows title="Your job packet" rows={[
            { key: "packet", label: "What's in it", value: "Your video and job description, a first look, and a simulation of your site when ready." },
            { key: "first-look", label: "First look", value: "An estimate of which robots could fit, based on published specs and prior use." },
            { key: "limits", label: "Simulation", value: "A simulation helps companies review your job. It does not certify performance or safety." },
          ]} />
          <BareRows title="Deployment companies" rows={[
            { key: "responses", label: "Responses", value: `A company can answer ${EVERYDAY_ANSWERS}. Once the simulation can be downloaded, it can also answer ${TESTED_ANSWERS}. We can't promise any will say yes.` },
            { key: "meet", label: "Introductions", value: `Press Introduce us beside a company that answered ${INTRODUCIBLE_ANSWERS}. We email the company your name, address and contact details, and email you theirs.` },
            { key: "company", label: "Setting it up", value: "You agree any work and its terms with the company directly." },
          ]} />
          <BareRows title="Your video" rows={[
            { key: "private", label: "Who sees it", value: "We share it, without its sound, with the deployment companies we approve, so they can decide whether they can do your job. Your name, address and contact details go to a company only if you ask for an introduction." },
            { key: "sharing", label: "Sharing", value: "Sending a job means we share it. You agree to that once, when you send. If your job page asks you to agree, we share the job only after you do." },
            { key: "stop", label: "Stopping", value: "You can stop us using your video at any time, from your job page. Your job then leaves every company's view at once. We ask any company that saved a copy to delete it, but we cannot take that copy back." },
          ]} />
          <BareRows id="who-we-are" title="Who we are" rows={[
            { key: "company", label: "Company", value: COMPANY.legalName },
            { key: "address", label: "Address", value: COMPANY.mailingAddress },
            { key: "email", label: "Email", value: <a href={`mailto:${COMPANY.emails.hello}`}>{COMPANY.emails.hello}</a> },
            { key: "privacy", label: "Privacy", value: <a href={`mailto:${COMPANY.emails.privacy}`}>{COMPANY.emails.privacy}</a> },
          ]} />
          <BareGroup>
            <BareButton href="/contact/site-operator?source=beta">{START_JOB}</BareButton>
          </BareGroup>
        </BareScreen>
      </div>
    </>
  );
}
