import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
} from "@/components/site/editorial";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import { ArrowRight } from "lucide-react";

const benefits = [
  "Turn the facility into a sellable digital asset without losing control of the rules.",
  "Keep scheduling, privacy, permission, and downstream-usage boundaries explicit.",
  "Approve commercialization only when the operator can actually read the scope.",
];

const controls = [
  {
    title: "Register the facility",
    body: "Tell Blueprint what the site is, what restrictions matter, and whether commercialization is even on the table.",
  },
  {
    title: "Approve capture windows",
    body: "Choose when capture can happen, which zones stay restricted, and what privacy rules travel with the asset.",
  },
  {
    title: "Approve commercial use",
    body: "Operator approval, access boundaries, and downstream usage stay attached instead of being inferred later.",
  },
];

const facilityTypes = [
  "Warehouse",
  "Retail store",
  "Grocery store",
  "Office building",
  "Restaurant",
  "Hotel",
  "Gym",
  "Campus",
  "Medical clinic",
  "Industrial facility",
];

export default function ForSiteOperators() {
  return (
    <>
      <SEO
        title="For Site Operators | Blueprint"
        description="Blueprint helps site operators control access, privacy, permissions, and commercialization around site-specific world-model products."
        canonical="/for-site-operators"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.operatorControlEntry}
            alt="Operator control hero"
            className="min-h-[40rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[40rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.76)_0%,rgba(0,0,0,0.46)_36%,rgba(0,0,0,0.12)_80%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.62fr_0.38fr] lg:px-10 lg:py-16">
                <div className="flex min-h-[32rem] flex-col justify-end">
                <EditorialSectionLabel light>For Site Operators</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 max-w-[36rem] text-[3.7rem] leading-[0.9] tracking-[-0.06em] text-white sm:text-[5rem]">
                  Control how your facility becomes a world-model asset.
                </h1>
                <p className="mt-6 max-w-[30rem] text-base leading-8 text-white/72">
                  Register the site, define access and privacy rules, and decide whether Blueprint can commercialize approved capture under terms you can actually inspect.
                </p>
                <div className="mt-8 flex flex-wrap gap-2">
                  <ProofChip light>Access stays explicit</ProofChip>
                  <ProofChip light>Privacy travels with the asset</ProofChip>
                  <ProofChip light>Commercial use stays bounded</ProofChip>
                </div>
              </div>
                <div className="hidden items-end justify-end lg:flex">
                  <div className="w-full max-w-[18rem] border border-white/14 bg-black/36 p-5 text-white backdrop-blur-sm">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/44">Operator standard</p>
	                  <p className="mt-4 text-sm leading-7 text-white/66">
	                    The operator sees what is allowed, when capture happens, and who can use the resulting asset.
	                  </p>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialSectionIntro
            eyebrow="Operator value"
            title="What operators get."
            description="The point is to make the control layer product-visible without turning it into a legal page."
            className="max-w-3xl"
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {benefits.map((item, index) => (
              <div
                key={item}
                className={index === 1 ? "bg-slate-950 p-6 text-white" : "bg-white p-6 text-slate-950"}
              >
                <p className={`text-sm leading-7 ${index === 1 ? "text-white/72" : "text-slate-600"}`}>
                  {item}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.44fr_0.56fr] lg:px-10 lg:py-12">
            <div className="bg-[#f5f3ef] px-6 py-8 lg:px-8 lg:py-10">
              <EditorialSectionIntro
	                eyebrow="Controls"
	                title="How it works and what you control."
	                description="Operator rules stay readable in the workflow itself."
	              />
            </div>
            <div className="grid gap-px bg-black/10">
              {controls.map((item) => (
                <div key={item.title} className="bg-white px-6 py-7">
                  <h2 className="font-editorial text-[2.1rem] leading-[0.94] tracking-[-0.04em] text-slate-950">
                    {item.title}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-6 lg:grid-cols-[0.4fr_0.6fr]">
            <MonochromeMedia
              src={editorialGeneratedAssets.proofBoardGovernance}
              alt="Governance proof board"
              className="min-h-[26rem]"
              overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.18))]"
            />
            <div>
              <EditorialSectionIntro
	                eyebrow="Eligibility"
	                title="What kinds of spaces fit."
	                description="The governance layer works for real indoor facilities, not just one narrow template."
	              />
              <div className="mt-8 flex flex-wrap gap-2">
                {facilityTypes.map((item) => (
                  <span key={item} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-slate-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Bring the facility into scope without losing the boundary."
            description="Use the operator path when you need to talk through site participation, privacy, capture windows, or commercial posture."
            imageSrc={editorialGeneratedAssets.operatorControlEntry}
            imageAlt="Operator facility image"
            primaryHref="/contact/site-operator"
            primaryLabel="List your site"
            secondaryHref="/governance"
            secondaryLabel="Review rights and privacy"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
