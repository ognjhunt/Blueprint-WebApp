import { BareBack, BareButton, BareGroup, BareRows, BareScreen } from "@/components/bare/Bare";
import { SEO } from "@/components/SEO";
import { COMPANY } from "@/data/company";
import { REPLY_TIMELINE } from "@/data/betaTimelines";
import { QUESTIONS_SEO_DESCRIPTION, START_JOB } from "@/lib/publicCopy";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

/**
 * Questions, bare bones: the one details screen for the public pages, in short labelled rows. It holds what the beta
 * page, "Jobs we support" and "About" said (both redirect here or to How it works).
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
          <BareRows title="The beta" rows={[
            { key: "cost", label: "Cost", value: <>Free. Blueprint takes no cut of any work you agree. <a href="/refunds">Paid before the beta?</a></> },
            { key: "reply", label: "Reply", value: REPLY_TIMELINE },
            { key: "company", label: "Setting it up", value: "A company we've approved quotes it. You agree the price and terms with them." },
          ]} />
          <BareRows title="Your answer" rows={[
            { key: "jobs", label: "Jobs", value: "One job that repeats, with known objects. We check jobs where something is picked up and put down; other jobs we keep and hold." },
            { key: "see", label: "You see", value: "The robot most likely to fit · which did best in the simulation · what was ruled out · who already uses it · how sure we are" },
            { key: "simulation", label: "Simulation", value: "We test the top options on your job in a simulation of your site: each robot's reach, and public control software on a research robot." },
            { key: "isnt", label: "It isn't", value: "A test at your site. It does not certify performance or safety." },
          ]} />
          <BareRows title="Your video" rows={[
            { key: "private", label: "Private", value: "Your video, address and contacts stay private." },
            { key: "sharing", label: "Sharing", value: "Only if you press the button, and without your name." },
            { key: "stop", label: "Stopping", value: "You can stop us using your video at any time, from your job page." },
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
