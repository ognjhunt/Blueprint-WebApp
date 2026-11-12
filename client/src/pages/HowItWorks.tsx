import { BareBack, BareButton, BareGroup, BareLinks, BareScreen } from "@/components/bare/Bare";
import { BareSteps } from "@/components/bare/BareForm";
import { SEO } from "@/components/SEO";
import { HOW_SEO_DESCRIPTION, HOW_STEPS, JOBS_THAT_FIT, START_JOB } from "@/lib/publicCopy";
import { webPageJsonLd } from "@/lib/seoStructuredData";

/** How it works, bare bones: what goes into a job packet and where it goes, one line each, and which jobs fit (the old "Jobs we support"). */
export default function HowItWorks() {
  return <>
    <SEO title="How it works | Blueprint" description={HOW_SEO_DESCRIPTION} canonical="/how-it-works"
      jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description: HOW_SEO_DESCRIPTION })} />
    <div className="bare-page">
      <BareScreen>
        <BareBack href="/" />
        <h1>How it works</h1>
        <BareGroup>
          <BareSteps label="Steps" steps={HOW_STEPS.map(step => ({ ...step }))} />
        </BareGroup>
        <BareGroup>
          <p className="bare-helper" id="job-fit">{JOBS_THAT_FIT}</p>
        </BareGroup>
        <BareGroup>
          <BareButton href="/contact/site-operator" helper="Free for sites.">{START_JOB}</BareButton>
        </BareGroup>
        <BareLinks links={[{ key: "questions", label: "Questions", href: "/beta" }]} />
      </BareScreen>
    </div>
  </>;
}
