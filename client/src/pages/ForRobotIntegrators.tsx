import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import {
  editorialGeneratedAssets,
} from "@/lib/editorialGeneratedAssets";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const useCases = [
  {
    title: "Tune before travel",
    body: "See the exact aisle, lane, or service zone before anyone gets on a plane.",
    image: editorialGeneratedAssets.homeHero,
  },
  {
    title: "Make site-specific data",
    body: "Generate exports and observations from the same facility your team actually cares about.",
    image: editorialGeneratedAssets.groceryBackroom,
  },
  {
    title: "Compare releases",
    body: "Run the same site after each autonomy update so regressions show up earlier.",
    image: editorialGeneratedAssets.warehouseAisle,
  },
];

const includedItems = [
  "A site-specific world model of one real facility and workflow lane",
  "Resettable runs on the same exact site so checkpoints are easier to compare",
  "Scenario changes and export bundles for debugging, tuning, or review",
  "Package and hosted paths tied back to the same source capture record",
];

export default function ForRobotIntegrators() {
  return (
    <>
      <SEO
        title="For Robot Integrators | Blueprint"
        description="Blueprint helps robot teams test one exact site before deployment with site-specific packages and hosted review built from real capture."
        canonical="/for-robot-integrators"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.warehouseAisle}
            alt="Robot team hero"
            className="min-h-[40rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[40rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_34%,rgba(0,0,0,0.18)_78%)]"
          >
            <RouteTraceOverlay className="opacity-60" />
            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.62fr_0.38fr] lg:px-10 lg:py-16">
                <div className="flex min-h-[32rem] flex-col justify-end">
                <EditorialSectionLabel light>For Robot Teams</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 max-w-[34rem] text-[3.7rem] leading-[0.9] tracking-[-0.06em] text-white sm:text-[5rem]">
                  Test the exact site before deployment.
                </h1>
                <p className="mt-6 max-w-[30rem] text-base leading-8 text-white/72">
                  Blueprint turns one real facility into a site-specific world model, data package, and hosted review path so the team can answer real deployment questions earlier.
                </p>
                <div className="mt-8 flex flex-wrap gap-2">
                  <ProofChip light>Tune before travel</ProofChip>
                  <ProofChip light>Make site-specific data</ProofChip>
                  <ProofChip light>Compare releases</ProofChip>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="/world-models"
                    className="inline-flex items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Explore world models
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/exact-site-hosted-review"
                    className="inline-flex items-center justify-center border border-white/16 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/8"
                  >
                    Request hosted evaluation
                  </a>
                </div>
              </div>

                <div className="hidden items-end justify-end lg:flex">
                  <div className="w-full max-w-[18rem] border border-white/14 bg-black/36 p-5 text-white backdrop-blur-sm">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/44">
                    Exact-site review
                  </p>
                  <p className="mt-4 text-lg font-semibold">One real facility. One real question.</p>
                  <p className="mt-3 text-sm leading-6 text-white/62">
                    The product is not generic environment access. The product is earlier certainty on one exact site.
                  </p>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialSectionIntro
            eyebrow="Common jobs"
            title="Use exact-site worlds for the work that usually gets expensive late."
            description="The strongest fit is when a buyer already knows the site and needs to de-risk a narrow deployment question."
            className="max-w-3xl"
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {useCases.map((item) => (
              <article
                key={item.title}
                className="overflow-hidden rounded-[1.8rem] border border-black/10 bg-white shadow-[0_24px_60px_-44px_rgba(15,23,42,0.24)]"
              >
                <MonochromeMedia
                  src={item.image}
                  alt={item.title}
                  className="aspect-[4/3] rounded-none"
                  overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.3))]"
                />
                <div className="p-6">
                  <h2 className="font-editorial text-[2.2rem] leading-[0.94] tracking-[-0.04em] text-slate-950">
                    {item.title}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.42fr_0.58fr] lg:px-10 lg:py-12">
            <div className="bg-slate-950 px-6 py-8 text-white lg:px-8 lg:py-10">
	              <EditorialSectionIntro
	                eyebrow="What this is"
	                title="A site-specific product, not a benchmark theater."
	                description="This path makes the deliverable and the truthful limits visible before the team moves deeper."
	                light
	              />
              <p className="mt-8 text-sm leading-7 text-white/68">
                This path works well for policy fine-tuning, training data generation, release comparison, and hosted evaluation. It does not replace final on-site safety validation or stack-specific signoff.
              </p>
            </div>
            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionLabel>Included</EditorialSectionLabel>
              <div className="mt-6 space-y-4">
                {includedItems.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-7 text-slate-700">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-950" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Move from curiosity to one real site."
            description="Start in the world-model catalog when you want to inspect current proof, or open the hosted-review path when a facility is already in scope."
            imageSrc={editorialGeneratedAssets.homeHero}
            imageAlt="Hosted review still"
            primaryHref="/world-models"
            primaryLabel="Explore world models"
            secondaryHref="/exact-site-hosted-review"
            secondaryLabel="Request hosted evaluation"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
