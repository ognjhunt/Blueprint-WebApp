import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialFaq,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
} from "@/components/site/editorial";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import { trustFaqItems } from "@/lib/siteEditorialContent";

const readableCards = [
  {
    title: "Provenance and freshness",
    body: "A buyer should be able to see the facility identifier, capture date, freshness state, approval path, and proof depth before deciding whether the site is current enough for review.",
  },
  {
    title: "Rights and restrictions",
    body: "Rights class, export entitlements, restricted zones, and sharing limits should stay attached to the listing and manifest instead of being inferred from marketing copy.",
  },
  {
    title: "Hosted-access boundary",
    body: "Hosted sessions should make it clear what is launchable, what remains human-gated, and which outputs are illustrative layouts versus confirmed buyer-facing exports.",
  },
  {
    title: "Redaction and retention",
    body: "A buyer should be able to tell whether privacy processing ran, whether raw media is retained, and what remains visible or exportable.",
  },
];

const publishedToday = [
  "Proof depth, freshness, and commercial-status disclosure on listing surfaces",
  "Readable manifest, export bundle, and rights-sheet layouts for buyer inspection",
  "Hosted-access language that separates public proof from illustrative UI",
  "Privacy, retention, redaction, and restriction framing in the buyer path",
];

const notClaimed = [
  "Blanket site approval unless the listing says so explicitly",
  "Unrestricted commercialization or export rights by default",
  "Deployment guarantees, safety certification, or customer outcome claims",
  "Any certification or compliance posture Blueprint has not published explicitly",
];

export default function Governance() {
  return (
    <>
      <SEO
        title="Governance | Blueprint"
        description="Blueprint's buyer-readable trust page for rights, privacy, provenance, restrictions, and hosted-access boundaries."
        canonical="/governance"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.proofBoardGovernance}
            alt="Governance hero"
            className="min-h-[38rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[38rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.74)_34%,rgba(255,255,255,0.2)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.62fr_0.38fr] lg:px-10 lg:py-16">
                <div className="flex max-w-[34rem] flex-col justify-end">
                <EditorialSectionLabel>Governance</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] sm:text-[5rem]">
                  Proof stays attached.
                </h1>
                <p className="mt-6 text-base leading-8 text-slate-700">
                  Every Blueprint world model is built from a real place, with inspectable proof of where, when, how, and under what rights it was captured.
                </p>
              </div>
                <div className="hidden flex-wrap content-end gap-2 lg:flex lg:justify-end">
                  <ProofChip>Rights stay explicit</ProofChip>
                  <ProofChip>Hosted access stays bounded</ProofChip>
                  <ProofChip>No trust claims beyond the listing</ProofChip>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialSectionIntro
            eyebrow="Readable trust"
            title="What a buyer should be able to read."
            className="max-w-3xl"
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {readableCards.map((card) => (
              <div key={card.title} className="bg-white p-6">
                <h2 className="font-editorial text-[2rem] leading-[0.95] tracking-[-0.04em] text-slate-950">
                  {card.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
            <EditorialSectionIntro
              eyebrow="Truth boundary"
              title="What Blueprint shows and what it does not claim."
              className="max-w-3xl"
            />
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="bg-[#f5f3ef] p-6">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Published today</p>
                <div className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
                  {publishedToday.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-950 p-6 text-white">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">Not claimed</p>
                <div className="mt-5 space-y-3 text-sm leading-7 text-white/72">
                  {notClaimed.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialFaq
            title="FAQ"
            description="The trust surface should answer the remaining boundary questions without collapsing into a legal page."
            items={trustFaqItems}
          />
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Inspect the trust surface on a real listing."
            description="Use the public proof surface when you want to see how rights, provenance, privacy, and hosted-access boundaries show up in the product itself."
            imageSrc={editorialGeneratedAssets.proofBoardGovernance}
            imageAlt="Governance proof board"
            primaryHref="/world-models"
            primaryLabel="Inspect sample listing"
            secondaryHref="/contact?persona=robot-team"
            secondaryLabel="Contact for scoped review"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
