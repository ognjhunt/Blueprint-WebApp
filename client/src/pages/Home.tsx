import { BareBig, BareButton, BareGroup, BareLabel, BareLinks, BareScreen } from "@/components/bare/Bare";
import { BareSteps } from "@/components/bare/BareForm";
import { PilotPreview } from "@/components/site/PilotPreview";
import { SEO } from "@/components/SEO";
import { FOR_DEPLOYMENT_COMPANIES_LINK, HOME_LABEL, HOME_SEO_DESCRIPTION, HOME_SEO_TITLE, HOME_START_HELPER, HOME_SUB_LINE, HOME_TITLE,
  START_JOB, STEP_ANSWER, STEP_SEND, STEP_SIMULATE } from "@/lib/publicCopy";
import { organizationJsonLd, webPageJsonLd, websiteJsonLd } from "@/lib/seoStructuredData";

/**
 * Home, bare bones: the outcome a site wants, three steps and one button (owner, 2026-11-12). The moving example card
 * beside it (below the button on a phone) is back where it was on 11 Nov: a small version of a site's job page once
 * deployment companies answer, marked as an example.
 */
export default function Home() {
  return (
    <>
      <SEO title={HOME_SEO_TITLE} description={HOME_SEO_DESCRIPTION} canonical="/" jsonLd={[organizationJsonLd(), websiteJsonLd(),
        webPageJsonLd({ path: "/", name: "Blueprint", description: HOME_SEO_DESCRIPTION })]} />
      <div className="bare-page">
        <div className="bare-home">
          <BareScreen>
            <BareGroup>
              <BareLabel>{HOME_LABEL}</BareLabel>
              <BareBig as="h1" sub={HOME_SUB_LINE}>{HOME_TITLE}</BareBig>
            </BareGroup>
            <BareGroup>
              <BareSteps id="how-it-works" label="How it works" steps={[
                { key: "send", title: STEP_SEND },
                { key: "simulate", title: STEP_SIMULATE },
                { key: "answer", title: STEP_ANSWER },
              ]} />
            </BareGroup>
            <BareGroup>
              <BareButton href="/contact/site-operator" helper={HOME_START_HELPER}>{START_JOB}</BareButton>
            </BareGroup>
            <BareLinks links={[
              { key: "how", label: "How it works", href: "/how-it-works" },
              { key: "companies", label: FOR_DEPLOYMENT_COMPANIES_LINK, href: "/partners" },
            ]} />
          </BareScreen>
          <PilotPreview />
        </div>
      </div>
    </>
  );
}
