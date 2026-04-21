import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";

const contractCards = [
  {
    title: "Sample manifest layout",
    body: "Site identifier, capture date, proof depth, rights class, and export scope laid out before the buyer call starts.",
  },
  {
    title: "Buyer-readable rights sheet",
    body: "Usage, sharing, export scope, and restrictions attached as a visible artifact rather than implied in copy.",
  },
  {
    title: "Sample export bundle",
    body: "Representative hosted and package outputs shown as a concrete artifact family, not an abstract promise.",
  },
];

const packageItems = [
  "Walkthrough media, timestamps, and camera poses tied to one real facility",
  "Geometry, maps, and route structures when the capture supports them",
  "Site notes, provenance, privacy, and rights metadata",
  "A package your team can move into its own stack",
];

const hostedItems = [
  "Repeatable runs on the same exact site",
  "Rollout video, failure review, and checkpoint comparison",
  "Dataset, raw bundle, and export generation tied to the listing",
  "A browser-accessible review path with no local setup required",
];

export default function SampleDeliverables() {
  return (
    <>
      <SEO
        title="Deliverables | Blueprint"
        description="See the sample contracts, exports, and package-vs-hosted deliverables tied to one exact-site Blueprint listing."
        canonical="/sample-deliverables"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.proofBoardDeliverables}
            alt="Sample deliverables hero"
            className="min-h-[38rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[38rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.72)_34%,rgba(255,255,255,0.2)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto h-full max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
                <div className="flex h-full max-w-[34rem] flex-col justify-end">
                <EditorialSectionLabel>Deliverables</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] sm:text-[5rem]">
                  Sample deliverables from one real site.
                </h1>
                <p className="mt-6 text-base leading-8 text-slate-700">
                  The point is to make the manifest, rights sheet, and package-versus-hosted output shape obvious before the buyer conversation starts.
                </p>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialSectionIntro
            eyebrow="Contracts"
            title="See the sample contract before the call."
            description="The artifact layout should show what the buyer is evaluating without requiring a long explanation."
            className="max-w-3xl"
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {contractCards.map((card, index) => (
              <div
                key={card.title}
                className={index === 2 ? "bg-slate-950 p-6 text-white" : "bg-white p-6 text-slate-950"}
              >
                <h2 className="font-editorial text-[2rem] leading-[0.95] tracking-[-0.04em]">
                  {card.title}
                </h2>
                <p className={`mt-4 text-sm leading-7 ${index === 2 ? "text-white/72" : "text-slate-600"}`}>
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <EditorialSectionIntro
              eyebrow="Paths"
              title="Package and hosted paths, side by side."
              description="The product difference should feel visual and immediate."
              className="max-w-3xl"
            />
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="overflow-hidden border border-black/10 bg-[#f5f3ef]">
                <MonochromeMedia
                  src={editorialGeneratedAssets.warehouseAisle}
                  alt="Site package"
                  className="aspect-[16/10] rounded-none"
                  overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.24))]"
                />
                <div className="p-6">
                  <h2 className="font-editorial text-[2.3rem] leading-[0.94] tracking-[-0.04em] text-slate-950">
                    Site package
                  </h2>
                  <div className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
                    {packageItems.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="overflow-hidden border border-black/10 bg-slate-950 text-white">
                <MonochromeMedia
                  src={editorialGeneratedAssets.hostedReviewHero}
                  alt="Hosted evaluation"
                  className="aspect-[16/10] rounded-none"
                  overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.3))]"
                />
                <div className="p-6">
                  <h2 className="font-editorial text-[2.3rem] leading-[0.94] tracking-[-0.04em]">
                    Hosted evaluation
                  </h2>
                  <div className="mt-5 space-y-3 text-sm leading-7 text-white/72">
                    {hostedItems.map((item) => (
                      <div key={item}>{item}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Inspect the artifact shape before you buy the path."
            description="Move into the sample listing, then continue into package or hosted review only when the site and proof already make sense."
            imageSrc={editorialGeneratedAssets.proofBoardDeliverables}
            imageAlt="Deliverables proof board"
            primaryHref="/world-models"
            primaryLabel="View sample listing"
            secondaryHref="/contact?persona=robot-team"
            secondaryLabel="Talk to Blueprint"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
