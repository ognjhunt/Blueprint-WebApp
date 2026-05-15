import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { editorialRefreshAssets } from "@/lib/editorialRefreshAssets";
import { ArrowRight } from "lucide-react";

const updates = [
  {
    index: "01",
    slug: "why-real-capture-matters",
    title: "Why real capture matters",
    body:
      "Robot teams do not just need a polished scene. They need the route, occlusions, access limits, freshness, and capture context that make one site different from another.",
    sections: [
      "Blueprint starts from real capture because site geometry, signage, lighting, clutter, and public-facing route limits are the product context.",
      "A generated or generic benchmark can help teams reason, but it cannot replace the provenance attached to one actual facility or route.",
      "That is why public samples are labeled as samples and request packets stay tied to capture records, rights limits, and freshness review.",
    ],
  },
  {
    index: "02",
    slug: "inside-a-site-package",
    title: "What is inside a site package",
    body:
      "A site package is the buyer-readable container for one exact site: manifest, route notes, capture basis, rights limits, export scope, and hosted-review context.",
    sections: [
      "The package starts with a manifest so a buyer can see the site id, capture id, route, asset tree, and included or gated deliverables.",
      "The rights sheet travels with the package. It explains use limits, sharing posture, redaction handling, and operator or privacy boundaries.",
      "Exports open only when the request supports them. The public sample teaches the file shape without implying customer proof or live fulfillment.",
    ],
  },
  {
    index: "03",
    slug: "how-hosted-review-works",
    title: "How hosted review works",
    body:
      "Hosted review is the managed review layer before a robot team takes files into its own stack or commits field time to one site.",
    sections: [
      "A buyer names the site, robot workflow, task, scenario, and outputs they need to inspect.",
      "Blueprint checks account access, package readiness, proof, rights, and hosted-session availability before claiming anything can launch.",
      "When available, the review room keeps run notes, observations, limits, and export decisions attached to the same exact-site package.",
    ],
  },
];

export default function Blog() {
  return (
    <>
      <SEO
        title="Updates | Blueprint"
        description="Short product notes from Blueprint on capture supply, world-model packages, hosted access, and buyer workflow."
        canonical="/updates"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[96rem] gap-px lg:grid-cols-[0.42fr_0.58fr]">
            <div className="px-8 py-10 lg:px-12 lg:py-14">
              <EditorialSectionLabel>Updates</EditorialSectionLabel>
              <h1 className="font-editorial mt-6 max-w-[26rem] text-[4rem] leading-[0.88] tracking-[-0.07em] text-slate-950 sm:text-[5.2rem]">
                Notes on exact-site world models.
              </h1>
              <p className="mt-6 max-w-[28rem] text-base leading-8 text-slate-700">
                Product updates from the capture-backed catalog, hosted review path, and buyer proof workflow.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="/world-models"
                  className="inline-flex w-full items-center justify-center bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
                >
                  Explore world models
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="/proof"
                  className="inline-flex w-full items-center justify-center border border-black/10 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:w-auto"
                >
                  See proof
                </a>
              </div>
              <div className="mt-8 h-1 w-24 bg-slate-950" />
            </div>
            <MonochromeMedia
              src={editorialRefreshAssets.blogHeroTripod}
              alt="Blueprint blog hero capture rig"
              className="min-h-[26rem] rounded-none"
              loading="eager"
              imageClassName="min-h-[26rem] object-cover object-center"
              overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]"
            />
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 py-5 sm:px-8 lg:px-10">
          <div className="grid gap-4 lg:grid-cols-3">
            {updates.map((item, index) => (
              <a
                key={item.title}
                href={`#${item.slug}`}
                className="group block border border-black/10 bg-white transition hover:-translate-y-0.5 hover:bg-[#f8f6f1]"
              >
                <MonochromeMedia
                  src={
                    index % 3 === 0
                      ? editorialRefreshAssets.helpDossier
                      : index % 3 === 1
                        ? editorialRefreshAssets.blogHeroTripod
                        : editorialRefreshAssets.blogPackageBook
                  }
                  alt={item.title}
                  className="aspect-[4/4.1] rounded-none"
                  imageClassName={
                    index % 3 === 0
                      ? "aspect-[4/4.1] object-cover object-top"
                      : index % 3 === 1
                        ? "aspect-[4/4.1] object-cover object-center"
                        : "aspect-[4/4.1] object-cover object-left"
                  }
                  overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]"
                />
                <div className="px-5 py-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    {item.index}
                  </p>
                  <div className="mt-3 h-px w-10 bg-slate-950/15" />
                  <h2 className="mt-5 text-[2rem] leading-[0.95] tracking-[-0.05em] text-slate-950">
                    {item.title}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-700">{item.body}</p>
                  <div className="mt-5 inline-flex items-center text-sm font-semibold text-slate-700">
                    Read note
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 py-5 sm:px-8 lg:px-10">
          <div className="grid gap-4">
            {updates.map((item) => (
              <article
                key={item.slug}
                id={item.slug}
                className="scroll-mt-24 border border-black/10 bg-white p-6 sm:p-8 lg:p-10"
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Product note {item.index}
                </p>
                <h2 className="font-editorial mt-4 max-w-[30rem] text-[3rem] leading-[0.94] tracking-[-0.05em] text-slate-950">
                  {item.title}
                </h2>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-700">
                  {item.body}
                </p>
                <div className="mt-7 grid gap-px bg-black/10 md:grid-cols-3">
                  {item.sections.map((section) => (
                    <p key={section} className="bg-[#f8f6f1] p-5 text-sm leading-7 text-slate-700">
                      {section}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 pb-10 sm:px-8 lg:px-10">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Ready to go deeper?"
            description="Move from the notes into the world-model catalog or the proof surface."
            imageSrc={editorialRefreshAssets.blogHeroTripod}
            imageAlt="Blueprint blog hero"
            primaryHref="/world-models"
            primaryLabel="Explore world models"
            secondaryHref="/proof"
            secondaryLabel="See proof"
          />
        </section>
      </div>
    </>
  );
}
