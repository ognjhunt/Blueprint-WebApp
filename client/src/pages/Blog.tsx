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
    title: "On real capture",
    body:
      "A few notes from the field on lighting, access, and getting the whole site.",
  },
  {
    index: "02",
    title: "What goes into a world model",
    body:
      "From raw scans to placeable geometry and behavior, the package stays tied to one facility.",
  },
	  {
	    index: "03",
	    title: "Inside a site package",
	    body:
	      "What is included, how it is structured, and why the buyer path stays readable.",
	  },
	  {
	    index: "04",
	    title: "Hosted evaluation in practice",
	    body:
	      "How a managed review room mirrors one real site instead of a generic benchmark.",
	  },
  {
    index: "05",
    title: "Fidelity over finish",
    body:
      "Why we prioritize accuracy, consistency, and provenance before polish.",
  },
  {
    index: "06",
    title: "Small decisions, big impact",
    body:
      "The implementation choices that decide whether a world-model product feels truthful or ornamental.",
  },
];

export default function Blog() {
  return (
    <>
      <SEO
        title="Blog | Blueprint"
        description="Short product notes from Blueprint on capture supply, world-model packages, hosted access, and buyer workflow."
        canonical="/blog"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[96rem] gap-px lg:grid-cols-[0.42fr_0.58fr]">
            <div className="px-8 py-10 lg:px-12 lg:py-14">
              <EditorialSectionLabel>Blog</EditorialSectionLabel>
              <h1 className="font-editorial mt-6 max-w-[26rem] text-[4rem] leading-[0.88] tracking-[-0.07em] text-slate-950 sm:text-[5.2rem]">
                Notes on how Blueprint is being packaged.
              </h1>
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
              <article key={item.title} className="border border-black/10 bg-white">
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
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 py-5 sm:px-8 lg:px-10">
          <div className="grid overflow-hidden border border-black/10 bg-slate-950 lg:grid-cols-[0.36fr_0.64fr]">
            <div className="px-6 py-8 text-white lg:px-8 lg:py-10">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Feature</p>
              <h2 className="font-editorial mt-5 max-w-[18rem] text-[2.9rem] leading-[0.94] tracking-[-0.05em]">
                A packaged digital twin, ready for site review.
              </h2>
              <p className="mt-5 max-w-[18rem] text-sm leading-7 text-white/70">
                How Blueprint brings survey, context, and behavior together in one deliverable.
              </p>
              <div className="mt-6 inline-flex items-center text-sm font-semibold text-white/85">
                Read feature
                <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            </div>
            <MonochromeMedia
              src={editorialRefreshAssets.blogPackageBook}
              alt="Blueprint package feature"
              className="min-h-[22rem] rounded-none"
              imageClassName="min-h-[22rem] object-cover object-center"
              overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.14))]"
            />
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 pb-10 sm:px-8 lg:px-10">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Ready to go deeper?"
            description="Move from the notes into the world-model catalog or the sample deliverables page."
            imageSrc={editorialRefreshAssets.blogHeroTripod}
            imageAlt="Blueprint blog hero"
            primaryHref="/world-models"
            primaryLabel="Explore world models"
            secondaryHref="/sample-deliverables"
            secondaryLabel="See deliverables"
          />
        </section>
      </div>
    </>
  );
}
