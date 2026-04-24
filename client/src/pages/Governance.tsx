import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialFaq,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
} from "@/components/site/editorial";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";
import { trustFaqItems } from "@/lib/siteEditorialContent";

const readableCards = [
  {
    title: "Provenance and freshness",
    body: "Blueprint shows the facility identifier, capture timing, freshness state, approval path, and proof depth before a buyer treats a site as current enough for review.",
  },
  {
    title: "Rights and restrictions",
    body: "Rights class, export entitlements, restricted zones, and sharing limits stay attached to the listing and manifest instead of being inferred from marketing copy.",
  },
  {
    title: "Hosted-access boundary",
    body: "Hosted sessions separate what is launchable, what remains human-gated, and which outputs are examples versus confirmed exports.",
  },
  {
    title: "Redaction and retention",
    body: "Buyer-facing records identify whether privacy processing ran, whether raw media is retained, and what remains visible or exportable.",
  },
  {
    title: "Public-facing capture",
    body: "Grocery aisles, retail floors, lobbies, museums, and common corridors can enter review when the capture stays in lawful public-facing areas and privacy guardrails remain visible.",
  },
];

const publishedToday = [
  "Proof depth, freshness, and commercial status on listings",
  "Readable manifest, export bundle, and rights-sheet layouts for buyer inspection",
  "Hosted-access language that separates public proof from example UI",
  "Privacy, retention, redaction, and restriction framing in the buyer path",
  "Public-capture examples for everyday locations without claiming customer results",
];

const notClaimed = [
  "Blanket site approval unless the listing says so explicitly",
  "Unrestricted commercialization or export rights by default",
  "Deployment guarantees, safety certification, or customer result claims",
  "Any certification or compliance posture Blueprint has not published explicitly",
  "Permission to capture restricted, private, or employee-only areas without explicit approval",
];

const publicCaptureBoundarySteps = [
  "Allowed common areas remain visually separated from restricted checkout or counter zones.",
  "Redaction review runs before buyer-visible evidence is framed.",
  "The buyer packet keeps manifest, rights, route frames, and export scope together.",
];

const operatorMatrix = [
  ["Site authority", "Who can approve capture, listing visibility, hosted review, and buyer access."],
  ["Capture window", "Dates, hours, routes, escort needs, and recapture constraints."],
  ["Restricted zones", "Private, employee-only, payment, screen, sensitive, or no-record areas."],
  ["Commercial posture", "Whether buyer review, licensing, export, or revenue sharing is allowed."],
  ["Change control", "How takedown, refresh, redaction, or revocation requests are handled."],
];

const governanceArtifacts = [
  {
    title: "Operator participation sheet",
    body: "Authority, facility type, capture windows, restricted zones, privacy rules, and commercialization interest.",
  },
  {
    title: "Buyer proof packet",
    body: "Listing metadata, manifest, rights sheet, hosted report, export scope, and proof-depth label.",
  },
  {
    title: "Capturer route rules",
    body: "Lawful public-facing route, no restricted/private areas, stop-on-objection, and review-gated submission.",
  },
  {
    title: "Redaction and retention note",
    body: "What was removed, what raw media is retained, what is buyer-visible, and what remains request-gated.",
  },
];

export default function Governance() {
  return (
    <>
      <SEO
        title="Governance | Blueprint"
        description="Blueprint's trust page for rights, privacy, provenance, restrictions, and hosted-access boundaries."
        canonical="/governance"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={publicCaptureGeneratedAssets.governancePublicCaptureExplainer}
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
            title="What a buyer can read before access."
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
          <div className="mx-auto grid max-w-[88rem] gap-4 px-5 py-10 sm:px-8 lg:grid-cols-[0.58fr_0.42fr] lg:px-10 lg:py-12">
            <MonochromeMedia
              src={publicCaptureGeneratedAssets.governancePublicCaptureExplainer}
              alt="Public capture trust workflow showing allowed area, restricted area, redaction review, and buyer packet"
              className="min-h-[28rem]"
              imageClassName="min-h-[28rem]"
              overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.18))]"
            />
            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Public-capture boundary"
                title="The rules are operational, not just legal copy."
                description="Everyday public-facing places only work when the listing shows what was allowed, what was restricted, what was redacted, and what the buyer may inspect."
              />
              <div className="mt-7 space-y-3">
                {publicCaptureBoundarySteps.map((item) => (
                  <div key={item} className="border border-black/10 bg-white p-4 text-sm leading-7 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
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
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Not claimed</p>
                <div className="mt-5 space-y-3 text-sm leading-7 text-white/70">
                  {notClaimed.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-4 px-5 py-10 sm:px-8 lg:grid-cols-[0.42fr_0.58fr] lg:px-10 lg:py-12">
            <div className="bg-slate-950 p-6 text-white lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Operational control matrix</p>
              <h2 className="font-editorial mt-4 text-[2.7rem] leading-[0.94] tracking-[-0.05em]">
                Operator control is a product surface.
              </h2>
              <p className="mt-5 text-sm leading-7 text-white/70">
                A serious site owner needs more than a generic contact form. The public site now explains which fields Blueprint expects before a facility is listed, captured, or commercialized.
              </p>
            </div>
            <div className="divide-y divide-black/10 border border-black/10 bg-white">
              {operatorMatrix.map(([label, detail]) => (
                <div key={label} className="grid gap-3 p-4 text-sm leading-6 text-slate-700 md:grid-cols-[0.26fr_0.74fr]">
                  <span className="font-semibold text-slate-950">{label}</span>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialSectionIntro
            eyebrow="Governance artifacts"
            title="The trust details become files and fields, not vibes."
            description="These artifacts are public-facing descriptions of the records Blueprint expects to attach to real listings, hosted sessions, and capture workflows."
            className="max-w-3xl"
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {governanceArtifacts.map((item) => (
              <div key={item.title} className="border border-black/10 bg-white p-5">
                <h2 className="font-editorial text-[2rem] leading-[0.95] tracking-[-0.04em]">{item.title}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialFaq
            title="FAQ"
            description="This page answers boundary questions in buyer language while the legal pages remain the formal baseline."
            items={trustFaqItems}
          />
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Inspect trust details on a real listing."
            description="Use a public listing to see how rights, provenance, privacy, and hosted-access boundaries show up in the product itself."
            imageSrc={publicCaptureGeneratedAssets.governancePublicCaptureExplainer}
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
