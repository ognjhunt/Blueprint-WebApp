import { BareBig, BareButton, BareGroup, BareScreen } from "@/components/bare/Bare";
import { BareSteps } from "@/components/bare/BareForm";
import { DemoQuotes } from "@/components/site/DemoQuotes"; // DEMO: invented quotes, demo PR only
import { PilotPreview } from "@/components/site/PilotPreview";
import { SEO } from "@/components/SEO";
import { FREE_FOR_SITES, HOME_SEO_DESCRIPTION, HOME_SEO_TITLE, HOME_SUB_LINE, HOME_TITLE, HOW_STEPS, START_JOB } from "@/lib/publicCopy";
import { organizationJsonLd, webPageJsonLd, websiteJsonLd } from "@/lib/seoStructuredData";

export default function Home() {
  return (
    <>
      <SEO title={HOME_SEO_TITLE} description={HOME_SEO_DESCRIPTION} canonical="/" jsonLd={[organizationJsonLd(), websiteJsonLd(),
        webPageJsonLd({ path: "/", name: "Blueprint", description: HOME_SEO_DESCRIPTION })]} />
      <div className="bare-page">
        <div className="bare-home">
          <BareScreen>
            <div className="bare-home-intro">
              <BareBig as="h1" sub={HOME_SUB_LINE}>{HOME_TITLE}</BareBig>
            </div>
            <BareGroup className="bare-home-start">
              <BareButton href="/contact/site-operator" helper={FREE_FOR_SITES}>{START_JOB}</BareButton>
            </BareGroup>
            <BareGroup>
              <BareSteps id="how-it-works" label="How it works" steps={HOW_STEPS.map(({ key, title }) => ({ key, title }))} />
            </BareGroup>
            {/* DEMO: invented quotes for the internal showing; never merge. */}
            <DemoQuotes />
          </BareScreen>
          <PilotPreview />
        </div>
      </div>
    </>
  );
}
