import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialFaq,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";

const faqs = [
  {
    question: "What is a Blueprint world model?",
    answer:
      "A digital environment built from real capture of one indoor facility and one workflow lane. It is not a generic benchmark scene or a synthetic environment generator.",
  },
  {
    question: "What does a buyer actually receive with the site package?",
    answer:
      "The walkthrough media, timestamps, camera poses, intrinsics, site notes, and any available depth or geometry artifacts for that facility, plus rights, privacy, and provenance metadata.",
  },
  {
    question: "What is hosted evaluation?",
    answer:
      "A Blueprint-managed runtime session on one exact site. Your team can rerun tasks, review failures, compare checkpoints, and export results without moving data into its own stack first.",
  },
  {
    question: "How close is this to a deployment guarantee?",
    answer:
      "It is not a deployment guarantee. The point is to ground the team on the real site sooner and cut bad assumptions earlier, not to replace safety review, stack-specific validation, or on-site signoff.",
  },
  {
    question: "What if the exact site we care about is not in the catalog?",
    answer:
      "The public catalog is the starting point, not the full inventory. If your team needs a specific facility, use the contact path and say which site, workflow, and robot question matter.",
  },
  {
    question: "Can we book time instead of starting with a form?",
    answer:
      "Yes. Use the dedicated booking path when your team already has a real facility or listing in mind and wants a fast scoping conversation around package access or hosted review.",
  },
];

export default function FAQ() {
  return (
    <>
      <SEO
        title="FAQ | Blueprint"
        description="Straight answers about Blueprint world models, site packages, hosted evaluation, proof boundaries, and how to start."
        canonical="/faq"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.homeHero}
            alt="FAQ hero"
            className="min-h-[38rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[38rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_34%,rgba(0,0,0,0.18)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto h-full max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
                <div className="flex h-full max-w-[34rem] flex-col justify-end">
                <EditorialSectionLabel light>FAQ</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] text-white sm:text-[5rem]">
                  The questions that usually decide fit.
                </h1>
                <p className="mt-6 text-base leading-8 text-white/72">
                  The fastest way to evaluate Blueprint is to answer the few questions that actually change the next step.
                </p>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialFaq
            title="FAQ"
            description="Clear answers about what the product is, what the buyer gets, what it is not, and how to start."
            items={faqs}
          />
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Talk to Blueprint about a real site."
            description="If one real facility already matters, the fastest move is to send a short brief tied to that site and workflow question."
            imageSrc={editorialGeneratedAssets.scopingRoom}
            imageAlt="Scoping room"
            primaryHref="/contact?persona=robot-team"
            primaryLabel="Talk to Blueprint about a real site"
            dark
          />
        </section>
      </div>
    </>
  );
}
