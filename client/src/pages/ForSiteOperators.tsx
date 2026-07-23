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

const matchSteps = [
  {
    step: "01",
    title: "Site-task brief",
    body: "Blueprint turns your workflow into a brief: the desired outcome, operating environment, payload, reach, mobility, human interaction, operating hours, integrations, and pilot acceptance criteria.",
    proof: "Workflow · constraints · acceptance criteria",
  },
  {
    step: "02",
    title: "Capture the task area",
    body: "A vetted capturer records the exact area under approved windows. Restricted zones are withheld from the package, not inferred away later.",
    proof: "Capture window · privacy notes · withheld zones",
  },
  {
    step: "03",
    title: "Qualify a candidate pool",
    body: "Only compatible robot teams enter. A fixed arm, mobile manipulator, AMR, and humanoid solve different problems — candidates pass a capability and embodiment gate before they are ranked together.",
    proof: "Capability gate · embodiment gate · compatible pool",
  },
  {
    step: "04",
    title: "Blind, common evaluation",
    body: "Every qualified team gets the same challenge packet and is evaluated under the same site, task, scenario distribution, paired seeds, episode limits, and scoring and uncertainty rules.",
    proof: "Same site · paired seeds · same scoring",
  },
  {
    step: "05",
    title: "Shortlist & pilot brief",
    body: "You receive the two or three strongest teams, with capability and integration gaps, comparative performance, major failure modes, review media, and a structured onsite pilot brief.",
    proof: "Top 2–3 teams · gaps · pilot brief",
  },
  {
    step: "06",
    title: "You run the pilot diligence",
    body: "Commercial, safety, physical-pilot, and deployment diligence happens directly between you and the shortlisted teams. Blueprint got you to a short, credible list — not a deployment guarantee.",
    proof: "Direct diligence · onsite pilot · your decision",
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
    title: "A repeatable task",
    body: "Recurring handling, picking, tending, or transport work worth automating and worth ranking robot teams against.",
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
    label: "Robot Match",
    value: "$5,000",
    unit: "/ campaign",
    caption: "One fixed-price campaign: brief, capture, candidate qualification, evaluation, and shortlist.",
  },
  {
    label: "Robot teams",
    value: "Free",
    caption: "Compatible teams participate free during a sponsored campaign — never pay-to-play.",
  },
  {
    label: "No active project",
    value: "Free",
    caption: "No campaign yet? Register interest to be considered for a future Robot Match — request-first, no self-serve listing.",
  },
  {
    label: "Provenance",
    value: "Always on",
    caption: "Rights and privacy travel with every capture and stay operator-controlled.",
  },
];

export default function ForSiteOperators() {
  return (
    <>
      <SEO
        title="For Site Operators | Blueprint"
        description="Robot Match: Blueprint turns your workflow into a shared evaluation challenge, compares compatible robot teams against your captured site, and recommends the two or three strongest for an onsite pilot — with access, rights, and privacy operator-controlled."
        canonical="/for-site-operators"
        jsonLd={[
          webPageJsonLd({
            path: "/for-site-operators",
            name: "Blueprint for Site Operators",
            description:
              "Robot Match compares compatible robot teams against a captured real site and returns the two or three strongest candidates for an onsite pilot, with operator-controlled rights and access.",
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
            alt="Captured loading dock used as a Robot Match evaluation site"
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
                    Robot Match · For Site Operators
                  </Eyebrow>
                  <h1 className="mt-6 max-w-[40rem] font-display text-[clamp(3rem,5.4vw,5rem)] font-medium leading-[0.95] tracking-[-0.045em] text-[color:var(--text-on-ink)]">
                    Find the robot teams worth piloting.
                  </h1>
                  <p className="mt-6 max-w-[34rem] text-[1.1rem] leading-[1.7] text-[color:var(--text-on-ink)] opacity-80">
                    Want to pilot robots but do not know which teams belong onsite?
                    Blueprint turns your workflow into a shared evaluation challenge,
                    compares compatible robot teams against your captured site, and
                    recommends the two or three strongest for a field pilot.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-2">
                    <ProofChip light>Compatible teams only</ProofChip>
                    <ProofChip light>One captured site, one task</ProofChip>
                    <ProofChip light>Shortlist + pilot brief</ProofChip>
                  </div>
                  <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                    <Button asChild variant="brass" size="lg" iconRight={<ArrowRight />}>
                      <a href="/contact/site-operator?buyerType=site_operator&interest=robot-match&requestedOutputs=Robot%20Match&source=for-site-operators">
                        Find robot teams for my site
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
                      <Eyebrow tone="onInk">The Robot Match standard</Eyebrow>
                      <StatusChip tone="proof" square dot={false}>
                        Controlled
                      </StatusChip>
                    </div>
                    <p className="mt-4 text-sm leading-[1.7] text-[color:var(--text-on-ink)] opacity-75">
                      Compatible teams are ranked on the same site and task, under
                      paired seeds — and your site stays operator-controlled
                      throughout.
                    </p>
                    <div className="mt-5 flex flex-col gap-2 font-mono text-[12px] uppercase tracking-[0.1em] text-ink-300">
                      <span className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-brass" />
                        Capability gate · before ranking
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-brass" />
                        Shortlist · two or three teams
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-brass" />
                        Access &amp; rights · operator-controlled
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        {/* How Robot Match works — 6 steps */}
        <section className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
          <EditorialSectionIntro
            eyebrow="How Robot Match works"
            title="From a workflow to a short, credible pilot list."
            description="Six steps turn a desired deployment into a shared, blind evaluation of compatible robot teams — so you organize one structured comparison instead of several unstructured pilots. Sample values below are illustrative."
            className="max-w-3xl"
          />
          <TileGrid cols={3} className="mt-10">
            {matchSteps.map((item) => (
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

        {/* Who pays + the capability gate */}
        <section className="border-y border-line bg-inset">
          <div className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
            <div className="grid gap-6 lg:grid-cols-2">
              <ProofBoundary level="info" title="Who pays">
                You pay for the campaign. Robot teams participate free while
                campaigns are sponsored, so the ranking never looks pay-to-play. No
                active project yet? Registering interest is free and request-first —
                not a self-serve supply listing — and you are only charged when you
                commission a Robot Match.
              </ProofBoundary>
              <ProofBoundary level="warn" title="Not every robot solves the same problem">
                A fixed arm, mobile manipulator, AMR, and humanoid solve different
                versions of the workflow. Candidates must first pass a capability and
                embodiment gate; incompatible systems are labeled, not ranked in the
                same table as if they competed head-to-head.
              </ProofBoundary>
            </div>
          </div>
        </section>

        {/* Rights & commercialization */}
        <section className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.46fr_0.54fr]">
            <EditorialSectionIntro
              eyebrow="Rights & commercialization"
              title="Your site stays yours."
              description="Capturing your site for a Robot Match does not hand it over. Commercial use is opt-in and scoped, and the rights packet that travels with the capture is something you can actually read — and revoke."
            />
            <Card
              tone="card"
              eyebrow="Sample rights packet"
              title="Robot Match capture scope"
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
                  Real rights and export sharing remain request-scoped. The example
                  above is illustrative — no capture window or scope is granted until
                  you approve it.
                </ProofBoundary>
              </div>
            </Card>
          </div>
        </section>

        {/* What a good site is */}
        <section className="border-t border-line bg-inset">
          <div className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
            <EditorialSectionIntro
              eyebrow="What makes a strong Match"
              title="The sites that make a good challenge."
              description="Robot Match works for real indoor facilities with a repeatable, robot-relevant task — not one narrow template."
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
          </div>
        </section>

        {/* Pricing */}
        <section className="border-y border-line bg-inset">
          <div className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
            <EditorialSectionIntro
              eyebrow="Pricing"
              title="One campaign. $5,000. A shortlist you can pilot."
              description="Robot Match is a single fixed-price campaign — requirements, capture, candidate qualification, evaluation, and a shortlist. Robot-team participation and registering interest are free."
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
              <ProofBoundary level="info" title="What a campaign includes">
                One deployment task, one captured site area, up to five qualified
                robot teams, standardized evaluation, the top two or three shortlist,
                and a structured onsite pilot brief.
              </ProofBoundary>
              <ProofBoundary level="warn" title="What it does not promise">
                The shortlist estimates suitability for an onsite pilot. It does not
                prove physical performance, safety, reliability, or deployment
                readiness — and it can come back inconclusive. Blueprint never
                manufactures a winner.
              </ProofBoundary>
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="mx-auto max-w-[88rem] px-7 py-16 lg:py-20">
          <EditorialCtaBand
            eyebrow="Next step"
            title="Turn one workflow into a short, credible pilot list."
            description="Start a Robot Match to compare compatible robot teams on your captured site. Access, rights, capture windows, and pricing are confirmed per scope — and no capture happens until you approve it."
            imageSrc={HERO_IMAGE}
            imageAlt="Captured operator facility used as a Robot Match evaluation site"
            primaryHref="/contact/site-operator?buyerType=site_operator&interest=robot-match&source=for-site-operators-cta"
            primaryLabel="Find robot teams for my site"
            secondaryHref="/governance"
            secondaryLabel="Review rights &amp; privacy"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
