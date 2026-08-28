import { AlertTriangle, ArrowRight, LifeBuoy, ListChecks, Mail } from "lucide-react";
import { Link } from "wouter";
import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import {
  SurfaceBrowserFrame,
  SurfaceCard,
  SurfaceMiniLabel,
  SurfacePage,
  SurfacePill,
  SurfaceSection,
  SurfaceTopBar,
} from "@/components/site/privateSurface";
import type { BetaCohortGuide } from "@/lib/betaCohortGuides";
import { betaSupportEmail } from "@/lib/betaCohortGuides";

type BetaCohortGuidePageProps = {
  guide: BetaCohortGuide;
};

const panelCard = "rounded-none border-runway-line bg-runway-panel";
const bandCard = "rounded-none border-runway-line bg-runway-black";
const sectionHeading =
  "font-display text-[1.35rem] font-semibold uppercase leading-[1.05] tracking-[0.005em] text-runway-text";
const prose = "text-[16px] leading-[1.7] text-runway-body";
const metaPill =
  "rounded-none border-runway-line bg-runway-panel font-mono text-[10px] tracking-[0.16em] text-runway-mute";

export function BetaCohortGuidePage({ guide }: BetaCohortGuidePageProps) {
  return (
    <>
      <SEO
        title={`${guide.title} | Blueprint`}
        description={guide.summary}
        canonical={guide.path}
        jsonLd={[
          webPageJsonLd({
            path: guide.path,
            name: guide.title,
            description: guide.summary,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: guide.title, path: guide.path },
          ]),
        ]}
      />

      <SurfacePage>
        <SurfaceTopBar eyebrow={guide.eyebrow} rightLabel="Beta Support Guide" />
        <SurfaceSection className="py-8">
          <SurfaceBrowserFrame>
            <div className="grid gap-0 xl:grid-cols-[0.38fr_0.62fr]">
              <div className="border-b border-runway-line bg-runway-black p-8 xl:border-b-0 xl:border-r lg:p-10">
                <SurfaceMiniLabel className="font-mono text-runway-faint">{guide.persona} cohort</SurfaceMiniLabel>
                <h1 className="mt-5 font-display uppercase text-[clamp(3.2rem,5.8vw,5.1rem)] font-semibold uppercase leading-[0.86] tracking-[0.005em] text-runway-text">
                  {guide.title}
                </h1>
                <p className="mt-5 max-w-[30ch] text-[16px] leading-[1.7] text-runway-body">
                  {guide.summary}
                </p>
                <div className="mt-8 overflow-hidden border border-runway-line bg-runway-panel">
                  <img src={guide.heroImage} alt={guide.heroAlt} className="h-full w-full object-cover" />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <SurfacePill className={metaPill}>External beta</SurfacePill>
                  <SurfacePill className={metaPill}>Review-gated</SurfacePill>
                </div>
              </div>

              <div className="bg-runway-deep p-8 lg:p-10">
                <div className="grid gap-5 md:grid-cols-2">
                  {guide.sections.map((section) => (
                    <SurfaceCard key={section.title} className={`${panelCard} h-full`}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center border border-runway-line bg-runway-black">
                          <ListChecks className="h-4.5 w-4.5 text-runway-mute" />
                        </div>
                        <h2 className={sectionHeading}>{section.title}</h2>
                      </div>
                      <p className={`mt-4 max-w-[68ch] ${prose}`}>{section.body}</p>
                      <ul className={`mt-4 max-w-[68ch] space-y-3 ${prose}`}>
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </SurfaceCard>
                  ))}
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[0.58fr_0.42fr]">
                  <SurfaceCard className={bandCard}>
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4.5 w-4.5 text-runway-signal" />
                      <h2 className={sectionHeading}>Escalate</h2>
                    </div>
                    <div className="mt-5 divide-y divide-runway-line-soft border border-runway-line">
                      {guide.escalation.map((item) => (
                        <p key={item} className={`p-4 ${prose}`}>
                          {item}
                        </p>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard className={panelCard}>
                    <div className="flex items-center gap-3">
                      <LifeBuoy className="h-4.5 w-4.5 text-runway-mute" />
                      <h2 className={sectionHeading}>Single support path</h2>
                    </div>
                    <p className={`mt-4 max-w-[68ch] ${prose}`}>
                      Keep support attached to the account, request, capture, package, or session id. Use one channel unless Blueprint gives you a named operator thread.
                    </p>
                    <a href={`mailto:${betaSupportEmail}`} className="mt-5 inline-flex items-center gap-3 font-mono text-[13px] text-runway-signal">
                      <Mail className="h-4 w-4" />
                      {betaSupportEmail}
                    </a>
                    <Link href={guide.primaryAction.href} className="runway-cta mt-6 w-full">
                      {guide.primaryAction.label}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </SurfaceCard>
                </div>
              </div>
            </div>
          </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
    </>
  );
}
