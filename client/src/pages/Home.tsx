import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialMetricStrip,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { siteWorldCards } from "@/data/siteWorlds";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import {
  getEditorialFeaturedSites,
  getEditorialSiteLocation,
} from "@/lib/siteEditorialContent";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";

const productPaths = [
  {
    title: "Site Package",
    body:
      "License the exact-site package when your team wants geometry, routes, metadata, and exports inside its own stack.",
    href: "/pricing",
    label: "View package path",
  },
  {
    title: "Hosted Evaluation",
    body:
      "Start with the managed runtime when you need reruns, review, and proof before moving files or sending the team on-site.",
    href: "/exact-site-hosted-review",
    label: "See hosted path",
    dark: true,
  },
];

const proofItems = [
  "Capture provenance stays attached to the site record.",
  "Package and hosted paths stay tied to the same facility.",
  "Rights, freshness, and restrictions stay visible before purchase.",
];

function HomeSiteCard({
  title,
  href,
  image,
  location,
}: {
  title: string;
  href: string;
  image: string;
  location: string;
}) {
  return (
    <a
      href={href}
      className="group relative overflow-hidden rounded-[1.7rem] border border-black/10 bg-slate-950 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.38)]"
    >
      <MonochromeMedia
        src={image}
        alt={title}
        className="min-h-[23rem] rounded-none"
        imageClassName="min-h-[23rem] transition duration-700 group-hover:scale-[1.03]"
        overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.76))]"
      />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/54">
          {location}
        </p>
        <h3 className="font-editorial mt-3 text-[2rem] leading-[0.95] tracking-[-0.04em]">
          {title}
        </h3>
        <div className="mt-5 inline-flex items-center text-sm font-semibold text-white/82">
          Explore
          <ArrowRight className="ml-2 h-4 w-4" />
        </div>
      </div>
    </a>
  );
}

export default function Home() {
  const featuredSites = useMemo(
    () => getEditorialFeaturedSites(siteWorldCards, 3),
    [],
  );
  const heroSite = featuredSites[0];

  const metrics = useMemo(
    () => [
      {
        label: "Catalog",
        detail: "World-model listings stay tied to exact sites, not generic benchmark scenes.",
      },
      {
        label: "Buying paths",
        detail: "Package and hosted evaluation remain legible on the same public surface.",
      },
      {
        label: "Proof",
        detail: "The sample listing makes provenance, rights, and hosted posture inspectable first.",
      },
      {
        label: "Decision",
        detail: "The site is visible before a team commits travel, rollout spend, or stack work.",
      },
    ],
    [],
  );

  if (!heroSite) {
    return null;
  }

  return (
    <>
      <SEO
        title="Blueprint | Site-Specific World Models For Real Facilities"
        description="Blueprint helps robot teams inspect, license, and run exact-site world-model products built from real capture."
        canonical="/"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.homeHero}
            alt={heroSite.siteName}
            className="min-h-[42rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[42rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_34%,rgba(0,0,0,0.18)_78%)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_45%)]" />
            <RouteTraceOverlay className="opacity-60" />

            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.62fr_0.38fr] lg:px-10 lg:py-16">
                <div className="flex min-h-[34rem] flex-col justify-end">
                <EditorialSectionLabel light>Blueprint</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 max-w-[34rem] text-[3.7rem] leading-[0.9] tracking-[-0.06em] text-white sm:text-[5.2rem]">
                  Site-specific world models for real facilities.
                </h1>
                <p className="mt-6 max-w-[28rem] text-base leading-8 text-white/72 sm:text-[1.03rem]">
                  Browse the site first, then move into the package path or the hosted path only when one real facility actually matters.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="/world-models"
                    className="inline-flex items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Explore Sites
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/contact?persona=robot-team&interest=evaluation-package"
                    className="inline-flex items-center justify-center border border-white/16 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/8"
                  >
                    Request Access
                  </a>
                </div>
              </div>

                <div className="hidden items-end justify-end lg:flex">
                  <div className="w-full max-w-[18rem] border border-white/16 bg-black/34 p-5 text-white shadow-[0_24px_60px_-40px_rgba(0,0,0,0.58)] backdrop-blur-sm">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/44">
                    Catalog on site
                  </p>
                  <h2 className="mt-4 text-lg font-semibold">{heroSite.siteName}</h2>
                  <p className="mt-2 text-sm text-white/58">
                    {getEditorialSiteLocation(heroSite)}
                  </p>
                  <div className="mt-5 border-t border-white/10 pt-4 text-sm text-white/68">
                    One exact site. Two buying paths. Proof stays attached.
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10">
          <EditorialMetricStrip items={metrics} />
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <EditorialSectionIntro
            eyebrow="Real places"
            title="Real places. Real capture. Real buying surfaces."
            description="The site itself stays legible instead of disappearing behind a generic robotics story."
            className="max-w-3xl"
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {featuredSites.map((site) => (
              <HomeSiteCard
                key={site.id}
                title={site.siteName}
                href={`/world-models/${site.id}`}
                image={
                  site.id === featuredSites[0]?.id
                    ? editorialGeneratedAssets.groceryBackroom
                    : site.id === featuredSites[1]?.id
                      ? editorialGeneratedAssets.warehouseAisle
                      : editorialGeneratedAssets.homeHero
                }
                location={getEditorialSiteLocation(site)}
              />
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.44fr_0.56fr] lg:px-10">
            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Products"
                title="Two ways to work with one exact site."
                description="The catalog opens with the site, then the buyer chooses how far to go."
              />
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-2">
              {productPaths.map((path) => (
                <div
                  key={path.title}
                  className={path.dark ? "bg-slate-950 p-6 text-white" : "bg-white p-6 text-slate-950"}
                >
                  <p className={`text-[11px] uppercase tracking-[0.18em] ${path.dark ? "text-white/44" : "text-slate-400"}`}>
                    {path.title}
                  </p>
                  <h3 className="font-editorial mt-4 text-[2.3rem] leading-[0.92] tracking-[-0.04em]">
                    {path.title}
                  </h3>
                  <p className={`mt-4 text-sm leading-7 ${path.dark ? "text-white/68" : "text-slate-600"}`}>
                    {path.body}
                  </p>
                  <a
                    href={path.href}
                    className={`mt-6 inline-flex items-center text-sm font-semibold ${path.dark ? "text-white" : "text-slate-950"}`}
                  >
                    {path.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid overflow-hidden rounded-[2rem] border border-black/10 bg-white lg:grid-cols-[0.46fr_0.54fr]">
            <MonochromeMedia
              src={editorialGeneratedAssets.proofBoardDeliverables}
              alt="Blueprint public proof surface"
              className="min-h-[32rem] rounded-none"
              imageClassName="min-h-[32rem]"
              overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.4))]"
            >
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:58px_58px] opacity-30" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white lg:p-8">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/48">
                  Public proof surface
                </p>
                <h2 className="font-editorial mt-4 max-w-[20rem] text-[3rem] leading-[0.94] tracking-[-0.05em]">
                  One site, shown before the sales motion starts.
                </h2>
              </div>
            </MonochromeMedia>

            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Proof"
                title="See what attaches before it commits."
                description="Blueprint’s public surface should already show the core trust boundary."
              />
              <div className="mt-8 space-y-3">
                {proofItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-full border border-black/10 bg-white px-5 py-4 text-sm text-slate-700"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/sample-deliverables"
                  className="inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  View sample deliverables
                </a>
                <a
                  href="/proof"
                  className="inline-flex items-center justify-center border border-black/10 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  See hosted review
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Start"
            title="Start with the site that matters."
            description="Browse a real listing, open the hosted path, or send a short brief tied to one exact facility."
            imageSrc={editorialGeneratedAssets.homeHero}
            imageAlt="Blueprint hosted runtime still"
            primaryHref="/world-models"
            primaryLabel="Explore Sites"
            secondaryHref="/contact?persona=robot-team"
            secondaryLabel="Request Access"
          />
        </section>
      </div>
    </>
  );
}
