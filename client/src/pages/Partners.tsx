import { BareBack, BareButton, BareFine, BareGroup, BareLabel, BareLinks, BareScreen, BareTicks } from "@/components/bare/Bare";
import { SEO } from "@/components/SEO";
import { PARTNERS_SEO_DESCRIPTION } from "@/lib/publicCopy";

/**
 * For robot companies, bare bones: one question ("Can my company see these jobs?") and one button. The answer rides
 * on a card only when the site shared it (design note, "The deployment opportunity"), so the tick says so.
 */
export default function Partners() {
  return <>
    <SEO title="For robot companies | Blueprint" description={PARTNERS_SEO_DESCRIPTION} canonical="/partners" />
    <div className="bare-page">
      <BareScreen>
        <BareBack href="/" />
        <BareGroup>
          <BareLabel>For robot companies</BareLabel>
          <h1>See jobs that sites choose to share.</h1>
        </BareGroup>
        <BareGroup>
          <BareTicks label="What you see" items={[
            { key: "summary", state: "yes", text: "A summary of the job, without the site's name" },
            { key: "answer", state: "yes", text: "Our answer, when the site shares it" },
            { key: "free", state: "yes", text: "Free during the beta" },
          ]} />
        </BareGroup>
        <BareGroup>
          <BareButton href="/contact/robot-team" helper="We approve each company by hand and email you. You agree any work with the site directly.">Apply to see jobs</BareButton>
        </BareGroup>
        <BareLinks links={[
          { key: "deployment", label: "Set robots up for sites", href: "/partners/deployment" },
          { key: "technology", label: "Make robots or robot software", href: "/partners/technology" },
        ]} />
        <BareFine>Our answers are a fit check and a simulation. Not a test at the site, and not a safety check.</BareFine>
      </BareScreen>
    </div>
  </>;
}
