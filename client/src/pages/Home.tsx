import { BareBig, BareButton, BareFine, BareGroup, BareLabel, BareLinks, BareScreen } from "@/components/bare/Bare";
import { BareSteps } from "@/components/bare/BareForm";
import { PilotPreview } from "@/components/site/PilotPreview";
import { SEO } from "@/components/SEO";
import { FOR_ROBOT_COMPANIES, HOME_LABEL, HOME_SEO_DESCRIPTION, HOME_SEO_TITLE, HOME_START_HELPER, HOME_TITLE, PUBLIC_LIMITS,
  START_JOB, STEP_COMPANY, STEP_SEND, STEP_TEST, STEP_TEST_LINE } from "@/lib/publicCopy";
import { organizationJsonLd, webPageJsonLd, websiteJsonLd } from "@/lib/seoStructuredData";

/**
 * Home, bare bones: one question ("Which robot could do your job?"), three steps, one button. The moving example
 * beside it (below the button on a phone) is a small version of the real answer screen, marked as an example.
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
              <BareBig as="h1">{HOME_TITLE}</BareBig>
            </BareGroup>
            <BareGroup>
              <BareSteps id="how-it-works" label="How it works" steps={[
                { key: "send", title: STEP_SEND },
                { key: "test", title: STEP_TEST, line: STEP_TEST_LINE },
                { key: "company", title: STEP_COMPANY },
              ]} />
            </BareGroup>
            <BareGroup>
              <BareButton href="/contact/site-operator" helper={HOME_START_HELPER}>{START_JOB}</BareButton>
            </BareGroup>
            <BareLinks links={[
              { key: "how", label: "How it works", href: "/how-it-works" },
              { key: "companies", label: FOR_ROBOT_COMPANIES, href: "/partners" },
            ]} />
            <BareFine>{PUBLIC_LIMITS}</BareFine>
          </BareScreen>
          <PilotPreview />
        </div>
      </div>
    </>
  );
}
