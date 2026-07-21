import { ArrowRight, Check } from "lucide-react";

import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

import {
  Button,
  Card,
  DataField,
  Eyebrow,
  MetricStat,
  ProofBoundary,
  StatusChip,
} from "@/components/blueprint";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { TileGrid } from "@/components/site/TileGrid";

const HERO_IMAGE = "/redesign/pov/loading-dock.jpg";

const supplySteps = [
  {
    step: "01",
    title: "Register the facility",
    body: "Tell Blueprint what the site is, which zones stay restricted, and whether commercialization is even on the table.",
    proof: "Site profile · restricted zones · commercial flag",
  },
  {
    step: "02",
    title: "Approve capture windows",
    body: "Choose when a vetted capturer can walk the route, what privacy rules travel with the asset, and what stays off-limits.",
    proof: "Capture window · privacy notes · access scope",
  },
  {
    step: "03",
    title: "Package & label",
    body: "The walkthrough becomes a site package with manifest and provenance. Restricted areas are withheld, not inferred away later.",
    proof: "Capture manifest · provenance record · withheld zones",
  },
  {
    step: "04",
    title: "Decide commercial use",
    body: "Operator approval, access boundaries, and downstream usage stay attached to the package — readable, revocable, and scoped.",
    proof: "Rights packet · access window · downstream scope",
  },
];

const rightsFields = [
  { label: "Site owner", value: "Operator of record" },
  { label: "Capture basis", value: "Approved walkthrough" },
  { label: "Use scope", value: "Evaluation · review-scoped" },
  { label: "Restricted zones", value: "Withheld from package" },
  { label: "Commercial use", value: "Opt-in · per request" },
  { label: "Revocation", value: "Operator-controlled" },
];

const goodSite = [
  {
    title: "Real indoor route",
    body: "Aisles, cells, docks, and back-of-house paths a robot would actually traverse — not a staged demo floor.",
  },
  {
    title: "Stable layout",
    body: "Fixtures and zones that persist between visits, so a captured package stays representative of the live site.",
  },
  {
    title: "Clear access rules",
    body: "Known restricted areas and privacy expectations you can state up front and that travel with the asset.",
  },
  {
    title: "Repeatable tasks",
    body: "Recurring handling, picking, tending, or transport work that robot teams want to evaluate against.",
  },
];

const facilityTypes = [
  "Warehouse",
  "Distribution center",
  "Retail backroom",
  "Grocery store",
  "Cold storage",
  "Manufacturing line",
  "Packing & kitting",
  "Loading dock",
  "Industrial facility",
  "Campus & logistics",
];

const pricingMetrics = [
  {
    label: "Review fee",
    value: "$5k",
    unit: "/ site",
    caption: "Operator-side fee for the one-time facility review; not a payout.",
  },
  {
    label: "Site monitoring",
    value: "$30–40k",
    unit: "/ yr",
    caption: "Only when a deployed site needs repeated policy-update checks.",
  },
  {
    label: "Access control",
    value: "Operator",
    caption: "Windows and scope stay operator-controlled.",
  },
  {
    label: "Provenance",
    value: "Always on",
    caption: "Rights and privacy travel with every export.",
  },
];

export default function ForSiteOperators() {
  return (
    <>
      <SEO
        title="For Site Operators | Blueprint"
        description="Blueprint helps site operators control access, privacy, and commercialization around real-site robot evaluation — with rights and provenance kept visible."
        canonical="/for-site-operators"
        jsonLd={[
          webPageJsonLd({
            path: "/for-site-operators",
            name: "Blueprint for Site Operators",
            description:
              "How site operators control access, privacy, rights, and commercialization when a captured real site becomes a robot evaluation surface.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "For Site Operators", path: "/for-site-operators" },
          ]),
        ]}
      />

      <div className="bg-canvas text-ink">
        {/* Hero */}
        <section className="relative">
          <MonochromeMedia
            src={HERO_IMAGE}
            alt="Captured loading dock used as an operator supply site"
            loading="eager"
            radius="none"
            overlay="heroL"
            className="min-h-[44rem]"
            imageClassName="min-h-[44rem]"
          >
            <div className="bp-evidence-grid pointer-events-none absolute inset-0 opacity-40" />
            <RouteTraceOverlay className="opacity-70" />
            <div className="absolute inset-0">
              <div className="mx-auto grid h-full max-w-[88rem] items-end gap-10 px-7 py-14 lg:grid-cols-[0.62fr_0.38fr] lg:py-20">
                <div className="flex min-h-[34rem] flex-col justify-end">
                  <Eyebrow tone="brass" rule>
                    For Site Operators
                  </Eyebrow>
                  <h1 className="mt-6 max-w-[40rem] font-display text-[clamp(3rem,5.4vw,5rem)] font-medium leading-[0.95] tracking-[-0.045em] text-[color:var(--text-on-ink)]">
                    Supply a real site without losing the boundary.
                  </h1>
                  <p className="mt-6 max-w-[34rem] text-[1.1rem] leading-[1.7] text-[color:var(--text-on-ink)] opacity-80">
                    Turn a facility into a captured evaluation site — and keep
                    access, privacy, and commercial use explicit. You approve the
                    windows, the scope, and whether commercialization happens at all.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-2">
                    <ProofChip light>Access stays explicit</ProofChip>
                    <ProofChip light>Privacy travels with the asset</ProofChip>
                    <ProofChip light>Commercial use stays bounded</ProofChip>
                  </div>
                  <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                    <Button asChild variant="brass" size="lg" iconRight={<ArrowRight />}>
                      <a href="/contact/site-operator?source=for-site-operators">
                        Start site review
                      </a>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="lg"
                      className="text-[color:var(--text-on-ink)] hover:bg-white/5"
                    >
                      <a href="/governance">Review rights &amp; privacy</a>
                    </Button>
                  </div>
                </div>
                <div className="hidden items-end justify-end lg:flex">
                  <div className="w-full max-w-[20rem] border border-white/10 bg-[rgba(13,13,11,0.5)] p-5 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                      <Eyebrow tone="onInk">Operator standard</Eyebrow>
                      <StatusChip tone="proof" square dot={false}>
                        Controlled
                      </StatusChip>
                    </div>
                    <p className="mt-4 text-sm leading-[1.7] text-[color:var(--text-on-ink)] opacity-75">
                      The operator sees what is allowed, when capture happens, and
                      who can use the resulting asset.
                    </p>
                    <div className="mt-5 flex flex-col gap-2 font-mono text-[12px] uppercase tracking-[0.1em] text-ink-300">
                      <span className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-brass" />
                        Capture windows · approved
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-brass" />
                        Restricted zones · withheld
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-brass" />
                        Commercial use · opt-in
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        {/* How supply works — 4 steps */}
        <section className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
          <EditorialSectionIntro
            eyebrow="How supply works"
            title="From a facility to a controlled supply site."
            description="Four steps move a real facility into evaluation supply while keeping the operator's rules readable at every stage. Sample values below are illustrative."
            className="max-w-3xl"
          />
          <TileGrid cols={4} className="mt-10">
            {supplySteps.map((item) => (
              <div key={item.step} className="flex h-full flex-col bg-white p-6">
                <span className="font-mono text-[0.8rem] font-semibold text-brass-deep">
                  {item.step}
                </span>
                <h3 className="mt-4 text-title-m font-semibold tracking-tight text-ink-900">
                  {item.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-[1.7] text-ink-500">
                  {item.body}
                </p>
                <p className="mt-6 border-t border-line-soft pt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-400">
                  {item.proof}
                </p>
              </div>
            ))}
          </TileGrid>
        </section>

        {/* Rights & commercialization */}
        <section className="border-y border-line bg-inset">
          <div className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.46fr_0.54fr]">
              <EditorialSectionIntro
                eyebrow="Rights & commercialization"
                title="Operator approval stays attached, not inferred."
                description="Commercial use is opt-in and scoped. The rights packet that travels with a package is something the operator can actually read — and revoke."
              />
              <Card
                tone="card"
                eyebrow="Sample rights packet"
                title="Site supply scope"
                headerRight={
                  <StatusChip tone="info" square dot={false}>
                    Illustrative
                  </StatusChip>
                }
              >
                <div className="flex flex-col">
                  {rightsFields.map((f, i) => (
                    <DataField
                      key={f.label}
                      label={f.label}
                      value={f.value}
                      border={i < rightsFields.length - 1}
                    />
                  ))}
                </div>
                <div className="mt-6">
                  <ProofBoundary level="proof" title="Operator-controlled scope">
                    Real rights and export sharing remain listing- and
                    request-scoped. The example above is illustrative — no scope is
                    granted until an operator approves it.
                  </ProofBoundary>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* What a good site is */}
        <section className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
          <EditorialSectionIntro
            eyebrow="What a good site is"
            title="The facilities that make strong packages."
            description="Blueprint supply works for real indoor facilities with repeatable robot-relevant work — not one narrow template."
            className="max-w-3xl"
          />
          <TileGrid cols={4} className="mt-10">
            {goodSite.map((item) => (
              <div key={item.title} className="flex h-full flex-col bg-white p-6">
                <h3 className="text-title-m font-semibold tracking-tight text-ink-900">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-[1.7] text-ink-500">{item.body}</p>
              </div>
            ))}
          </TileGrid>

          <div className="mt-10 grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
            <MonochromeMedia
              src="/redesign/pov/cold-storage.jpg"
              alt="Captured cold-storage facility — review support, not real-world proof"
              overlay="bg"
              className="min-h-[20rem]"
            >
              <span className="absolute left-3 top-3">
                <StatusChip tone="ink" square dot={false}>
                  Review support
                </StatusChip>
              </span>
            </MonochromeMedia>
            <div className="self-center">
              <Eyebrow tone="muted" rule>
                Eligible facility types
              </Eyebrow>
              <div className="mt-5 flex flex-wrap gap-2">
                {facilityTypes.map((item) => (
                  <span
                    key={item}
                    className="rounded-sm border border-line-strong bg-white px-3.5 py-2 text-sm text-ink-700"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing & monitoring */}
        <section className="border-y border-line bg-inset">
          <div className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
            <EditorialSectionIntro
              eyebrow="Pricing & monitoring"
              title="One review to enter supply. Monitoring only when deployed."
              description="The $5k figure is an illustrative operator-side review fee, not a promised payout. Yearly monitoring is separate and applies only when a deployed site needs repeated policy-update checks under a cap."
              className="max-w-3xl"
            />
            <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-line bg-[#ded7c8] sm:grid-cols-2 xl:grid-cols-4">
              {pricingMetrics.map((m) => (
                <div key={m.label} className="bg-white p-6">
                  <MetricStat
                    label={m.label}
                    value={m.value}
                    unit={m.unit}
                    caption={m.caption}
                  />
                </div>
              ))}
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <ProofBoundary level="info" title="What a supply review covers">
                The supply review walks site participation, privacy, capture windows,
                and commercial posture. It does not assume a deployment or imply any
                guaranteed downstream use.
              </ProofBoundary>
              <ProofBoundary level="warn" title="Monitoring is conditional">
                Yearly monitoring is scoped only to deployed sites with recurring
                policy-update checks. It is not implied by a supply review and is
                never auto-enabled.
              </ProofBoundary>
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Bring the facility into scope without losing control."
            description="Start a site supply review to talk through participation, privacy, capture windows, and commercial posture. Use yearly monitoring only when a deployed site needs repeated policy-update checks."
            imageSrc={HERO_IMAGE}
            imageAlt="Captured operator facility"
            primaryHref="/contact/site-operator?source=for-site-operators-cta"
            primaryLabel="Start site review"
            secondaryHref="/governance"
            secondaryLabel="Review rights &amp; privacy"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
