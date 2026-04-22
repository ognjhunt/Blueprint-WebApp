import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialFilmstrip,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
} from "@/components/site/editorial";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import { hostedFilmstripFrames } from "@/lib/siteEditorialContent";
import { ArrowRight } from "lucide-react";

const trustCards = [
  {
    title: "What stays explicit",
    body: "Hosted review is not a deployment guarantee. Rights, privacy, restrictions, and export boundaries stay visible and irreversible commitments remain human-gated.",
  },
  {
    title: "When this is a fit",
    body: "Use this path when one real facility already matters and the team needs run evidence before moving files around or sending people on-site.",
  },
  {
    title: "Typical first reply",
    body: "Public-listing and hosted-review questions usually get a first reply within 1 business day. Rights or export review usually gets a first scoped answer within 2 business days.",
  },
];

export default function ExactSiteHostedReview() {
  return (
    <>
      <SEO
        title="Exact-Site Hosted Review | Blueprint"
        description="Blueprint's hosted review path for one exact site: a capture-backed managed run with review surfaces, export framing, and a clear next step."
        canonical="/exact-site-hosted-review"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.hostedReviewHero}
            alt="Hosted review hero"
            className="min-h-[42rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[42rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_34%,rgba(0,0,0,0.18)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.6fr_0.4fr] lg:px-10 lg:py-16">
                <div className="flex min-h-[34rem] flex-col justify-end selection:bg-white/20 selection:text-white">
                <EditorialSectionLabel light>Hosted Review</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 max-w-[36rem] text-[3.7rem] leading-[0.9] tracking-[-0.06em] text-white sm:text-[5rem]">
                  Review before you buy.
                </h1>
                <p className="mt-6 max-w-[30rem] text-base leading-8 text-white/[0.86]">
                  Hosted evaluation of one exact-site world model. See how the robot perceives, plans, and acts inside your facility before your team commits.
                </p>
                <div className="mt-8 flex flex-wrap gap-2">
                  <ProofChip light>Request access</ProofChip>
                  <ProofChip light>Review runs</ProofChip>
                  <ProofChip light>Export artifacts</ProofChip>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="/contact?persona=robot-team&interest=evaluation-package"
                    className="inline-flex items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Scope hosted review
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/sample-deliverables"
                    className="inline-flex items-center justify-center border border-white/[0.16] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                  >
                    See sample deliverables
                  </a>
                </div>
              </div>

                <div className="hidden items-end justify-end lg:flex">
                  <div className="w-full max-w-[24rem] overflow-hidden border border-white/[0.14] bg-black/[0.42] text-white backdrop-blur-sm">
                  <div className="border-b border-white/10 px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-white/[0.44]">
                    Hosted evaluation workspace
                  </div>
                  <div className="grid gap-3 p-5">
                    <div className="rounded-[1rem] border border-white/10 bg-white/[0.08] p-4 text-sm text-white/[0.72]">
                      Site: one exact facility
                    </div>
                    <div className="rounded-[1rem] border border-white/10 bg-white/[0.08] p-4 text-sm text-white/[0.72]">
                      Review: reruns, observations, exports
                    </div>
                    <div className="rounded-[1rem] border border-white/10 bg-white/[0.08] p-4 text-sm text-white/[0.72]">
                      Output: next commercial step stays explicit
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-6 lg:grid-cols-[0.38fr_0.62fr]">
            <EditorialSectionIntro
              eyebrow="Preview"
              title="The hosted path should feel concrete."
              description="A buyer should understand setup, rerun, and export flow at a glance."
            />
            <div className="overflow-hidden border border-black/10 bg-slate-950 p-4 text-white">
              <EditorialFilmstrip frames={hostedFilmstripFrames.map((frame, index) => ({
                ...frame,
                src:
                  index % 2 === 0
                    ? editorialGeneratedAssets.warehouseAisle
                    : editorialGeneratedAssets.groceryBackroom,
              }))} />
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <div className="grid gap-4 lg:grid-cols-[0.5fr_0.5fr]">
              <MonochromeMedia
                src={editorialGeneratedAssets.hostedReviewHero}
                alt="Hosted review interior"
                className="min-h-[28rem]"
                overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.24))]"
              />
              <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
                <EditorialSectionIntro
                  eyebrow="Commercial shape"
                  title="Hosted review sits between listing and commitment."
                  description="It is the managed review room for one site, not a generic benchmark console."
                />
                <div className="mt-8 space-y-3 text-sm leading-7 text-slate-700">
                  <div>1. Pick the site and workflow.</div>
                  <div>2. Confirm the robot setup in scope.</div>
                  <div>3. Run the hosted review and inspect the evidence.</div>
                  <div>4. Decide the next commercial step with the proof still attached.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialSectionIntro
            eyebrow="Trust and fit"
            title="What this path is good for and what it does not claim."
            className="max-w-3xl"
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {trustCards.map((card, index) => (
              <div
                key={card.title}
                className={index === 1 ? "bg-slate-950 p-6 text-white" : "bg-white p-6 text-slate-950"}
              >
                <h2 className="font-editorial text-[2rem] leading-[0.95] tracking-[-0.04em]">
                  {card.title}
                </h2>
                <p className={`mt-4 text-sm leading-7 ${index === 1 ? "text-white/[0.72]" : "text-slate-600"}`}>
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Open the hosted path only after the site feels real."
            description="Hosted evaluation is the clearest way to choose the right world model before package access or a broader program."
            imageSrc={editorialGeneratedAssets.hostedReviewHero}
            imageAlt="Hosted review hero"
            primaryHref="/contact?persona=robot-team&interest=evaluation-package"
            primaryLabel="Request access"
            secondaryHref="/world-models"
            secondaryLabel="Inspect sample listing"
          />
        </section>
      </div>
    </>
  );
}
