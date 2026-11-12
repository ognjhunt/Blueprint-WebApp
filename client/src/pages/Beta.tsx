import { BareBack, BareButton, BareGroup, BareRows, BareScreen } from "@/components/bare/Bare";
import { SEO } from "@/components/SEO";
import { COMPANY } from "@/data/company";
import { REPLY_TIMELINE } from "@/data/betaTimelines";
import { QUESTIONS_SEO_DESCRIPTION, START_JOB } from "@/lib/publicCopy";
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
            { key: "cost", label: "Cost", value: <>Free for sites. <a href="/refunds">Refunds and cancellations</a></> },
            { key: "reply", label: "Reply", value: REPLY_TIMELINE },
            { key: "jobs", label: "Jobs", value: "One job that repeats, with known objects. Pick-up-and-put-down jobs fit best; other jobs still go to companies, and their simulation waits until we can build one." },
          ]} />
          <BareRows title="Your job packet" rows={[
            { key: "packet", label: "What's in it", value: "Your sentence for the job, a first look on paper, a simulation of your site, and what counts as done." },
            { key: "first-look", label: "First look", value: "The robot most likely to fit, from published specifications and where it has been used." },
            { key: "trial", label: "Early trial", value: "Sometimes we also try openly available robot software in the simulation. It is a trial, not a prediction of any company's robot." },
            { key: "isnt", label: "It isn't", value: "A test at your site. It does not certify performance or safety." },
          ]} />
          <BareRows title="Deployment companies" rows={[
            { key: "responses", label: "Responses", value: "A company can say it is interested, that the job is not a fit, or that it would need something. We can't promise any will say yes." },
            { key: "meet", label: "Meeting a company", value: "Beside each interested company, press Introduce us. We give each of you the other's details. Up to three for each job." },
            { key: "company", label: "Setting it up", value: "You agree any work and its terms with the company directly." },
          ]} />
          <BareRows title="Your video" rows={[
            { key: "private", label: "Your video", value: "We share it, without its sound, with the deployment companies we approve, so they can decide whether they can do your job. Your name, address and contact details go to a company only if you ask for an introduction." },
            { key: "sharing", label: "Sharing", value: "It is part of sending a job. A job started before 12 November 2026 is shared only if you agree on its job page." },
            { key: "stop", label: "Stopping", value: "You can stop us using your video at any time, from your job page. Your job then leaves every company's view at once." },
          ]} />
          <BareRows id="who-we-are" title="Who we are" rows={[
            { key: "company", label: "Company", value: COMPANY.legalName },
            { key: "address", label: "Address", value: COMPANY.mailingAddress },
            { key: "where", label: "Where", value: "Sites in the United States film their own job." },
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
