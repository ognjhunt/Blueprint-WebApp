import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
} from "@/components/site/editorial";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";

const companyCards = [
  {
    title: "What Blueprint is",
    body:
      "A product for turning one real facility into site-specific world models, hosted evaluation, and clear trust details tied to the same capture-backed source record.",
  },
  {
    title: "What Blueprint is not",
    body:
      "Not a generic AI marketplace, not a model demo, and not a deployment guarantee pretending uncertainty has disappeared.",
  },
];

const storySteps = [
  "A robot team has one real facility and one workflow question before a field visit starts.",
  "Blueprint's job is to make that site usable earlier through truthful proof, package framing, and hosted evaluation.",
  "That lets the team decide whether to keep moving on the exact site instead of spending time on vague assumptions.",
];

export default function About() {
  return (
    <>
      <SEO
        title="About | Blueprint"
        description="Why Blueprint exists and how it turns real facilities into site-specific world models, hosted evaluation, and trust details a robot team can evaluate."
        canonical="/about"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.homeHero}
            alt="About Blueprint hero"
            className="min-h-[40rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[40rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_34%,rgba(0,0,0,0.18)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.62fr_0.38fr] lg:px-10 lg:py-16">
                <div className="flex min-h-[32rem] flex-col justify-end">
                <EditorialSectionLabel light>About Blueprint</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 max-w-[36rem] text-[3.7rem] leading-[0.9] tracking-[-0.06em] text-white sm:text-[5rem]">
                  Blueprint exists to make one real site legible earlier.
                </h1>
                <p className="mt-6 max-w-[30rem] text-base leading-8 text-white/70">
                  Blueprint helps robot teams evaluate one exact facility sooner, choose the right product path, and keep rights, privacy, provenance, and hosted-access boundaries readable along the way.
                </p>
              </div>
                <div className="hidden flex-wrap content-end gap-2 lg:flex lg:justify-end">
                  <ProofChip light>Real-site products</ProofChip>
                  <ProofChip light>Rights and provenance stay visible</ProofChip>
                  <ProofChip light>Built for serious robot-team decisions</ProofChip>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4 lg:grid-cols-[0.38fr_0.62fr]">
            <div className="bg-slate-950 p-6 text-white">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Founder note</p>
              <h2 className="font-editorial mt-4 text-[2.4rem] leading-[0.94] tracking-[-0.04em]">
                Built by Nijel Hunt.
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/70">
                Background in robotics simulation, 3D capture, and deployment operations. Blueprint is built around the gap between an interesting robotics demo and serious site-specific deployment work.
              </p>
            </div>
            <div className="bg-white p-6">
              <EditorialSectionIntro
                eyebrow="Company framing"
                title="What Blueprint is and what it is not."
              />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {companyCards.map((card) => (
                  <div key={card.title} className="border border-black/10 bg-[#f5f3ef] p-5">
                    <h2 className="font-editorial text-[1.9rem] leading-[0.95] tracking-[-0.04em] text-slate-950">
                      {card.title}
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-slate-600">{card.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <EditorialSectionIntro
              eyebrow="Decision story"
              title="Why this matters before the expensive part starts."
              className="max-w-3xl"
            />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {storySteps.map((step, index) => (
                <div key={step} className="bg-[#f5f3ef] p-6">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">0{index + 1}</p>
                  <p className="mt-4 text-sm leading-7 text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Start with the public proof or bring one exact site."
            description="Browse the public catalog if you want to evaluate the proof style first, or contact Blueprint when the facility is already known."
            imageSrc={editorialGeneratedAssets.scopingRoom}
            imageAlt="Blueprint scoping room"
            primaryHref="/world-models"
            primaryLabel="Explore world models"
            secondaryHref="/contact?persona=robot-team"
            secondaryLabel="Contact Blueprint"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
