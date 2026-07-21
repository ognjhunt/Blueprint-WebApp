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
              <div className="border-b border-black/10 bg-[#f7f3eb] p-8 xl:border-b-0 xl:border-r lg:p-10">
                <SurfaceMiniLabel>{guide.persona} cohort</SurfaceMiniLabel>
                <h1 className="mt-5 text-[clamp(3.2rem,5.8vw,5.1rem)] font-semibold uppercase leading-[0.86] tracking-[-0.09em]">
                  {guide.title}
                </h1>
                <p className="mt-5 max-w-[22rem] text-sm uppercase tracking-[0.18em] text-black/50">
                  {guide.summary}
                </p>
                <div className="mt-8 overflow-hidden rounded-[1.8rem] border border-black/10 bg-white">
                  <img src={guide.heroImage} alt={guide.heroAlt} className="h-full w-full object-cover" />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <SurfacePill>External beta</SurfacePill>
                  <SurfacePill>Review-gated</SurfacePill>
                </div>
              </div>

              <div className="bg-white p-8 lg:p-10">
                <div className="grid gap-5 md:grid-cols-2">
                  {guide.sections.map((section) => (
                    <SurfaceCard key={section.title} className="h-full">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-[#faf6ef]">
                          <ListChecks className="h-4.5 w-4.5 text-black/65" />
                        </div>
                        <SurfaceMiniLabel>{section.title}</SurfaceMiniLabel>
                      </div>
                      <p className="mt-4 text-sm leading-7 text-black/60">{section.body}</p>
                      <ul className="mt-4 space-y-3 text-sm leading-7 text-black/60">
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </SurfaceCard>
                  ))}
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[0.58fr_0.42fr]">
                  <SurfaceCard className="bg-[#111110] text-white">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4.5 w-4.5 text-white/65" />
                      <SurfaceMiniLabel className="text-white/50">Escalate</SurfaceMiniLabel>
                    </div>
                    <div className="mt-5 divide-y divide-white/10 border border-white/10">
                      {guide.escalation.map((item) => (
                        <p key={item} className="p-4 text-sm leading-7 text-white/65">
                          {item}
                        </p>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard className="bg-[#faf7f1]">
                    <div className="flex items-center gap-3">
                      <LifeBuoy className="h-4.5 w-4.5 text-black/60" />
                      <SurfaceMiniLabel>Single support path</SurfaceMiniLabel>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-black/60">
                      Keep support attached to the account, request, capture, package, or session id. Use one channel unless Blueprint gives you a named operator thread.
                    </p>
                    <a href={`mailto:${betaSupportEmail}`} className="mt-5 inline-flex items-center gap-3 text-sm font-semibold">
                      <Mail className="h-4 w-4" />
                      {betaSupportEmail}
                    </a>
                    <Link href={guide.primaryAction.href} className="mt-5 inline-flex items-center gap-3 text-sm font-semibold">
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
