import { BareBig, BareButton, BareFine, BareGroup, BareLabel, BareLinks, BareScreen } from "@/components/bare/Bare";
import { BareSteps } from "@/components/bare/BareForm";
import { SEO } from "@/components/SEO";
import { FOR_DEPLOYMENT_COMPANIES_LINK, HOME_LABEL, HOME_SEO_DESCRIPTION, HOME_SEO_TITLE, HOME_START_HELPER, HOME_TITLE, PUBLIC_LIMITS,
  START_JOB, STEP_PACKET, STEP_SEND, STEP_SHARE } from "@/lib/publicCopy";
import { organizationJsonLd, webPageJsonLd, websiteJsonLd } from "@/lib/seoStructuredData";

/**
 * Home, bare bones: what happens to a site's video, in three steps, and one button (frame of 2026-11-12). The
 * animated example of an invented result that used to sit beside it is removed, not replaced.
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
                { key: "packet", title: STEP_PACKET },
                { key: "share", title: STEP_SHARE },
              ]} />
            </BareGroup>
            <BareGroup>
              <BareButton href="/contact/site-operator" helper={HOME_START_HELPER}>{START_JOB}</BareButton>
            </BareGroup>
            <BareLinks links={[
              { key: "how", label: "How it works", href: "/how-it-works" },
              { key: "companies", label: FOR_DEPLOYMENT_COMPANIES_LINK, href: "/partners" },
            ]} />
            <BareFine>{PUBLIC_LIMITS}</BareFine>
          </BareScreen>
        </div>
      </div>
    </>
  );
}
