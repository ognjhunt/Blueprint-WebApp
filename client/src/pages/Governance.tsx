import { Check, LockKeyhole, ShieldCheck, X } from "lucide-react";

import { SEO } from "@/components/SEO";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const accessLadder = [
  [
    "01",
    "Anonymous",
    "Task type, broad region, operating window, and expected volume.",
  ],
  [
    "02",
    "Benchmark",
    "Object ranges, task metrics, environment class, and acceptance criteria.",
  ],
  [
    "03",
    "Controlled test",
    "Approved code runs against the hosted model; raw files do not leave Blueprint.",
  ],
  [
    "04",
    "Shortlist",
    "Detailed layouts and integrations go only to teams the site approves.",
  ],
  [
    "05",
    "Training rights",
    "Adaptation, retention, and general model training are negotiated separately.",
  ],
] as const;

const permissions = [
  ["Evaluate only", "Can this existing robot or policy perform the task?"],
  [
    "Adapt for this site",
    "May the provider tune the system for this deployment?",
  ],
  ["Retain improvements", "May the provider keep the site-specific learning?"],
  [
    "General model training",
    "May site data improve a model used for other customers?",
  ],
] as const;

export default function Governance() {
  return (
    <>
      <SEO
        title="Site data controls | Blueprint"
        description="Progressive access keeps raw site models controlled while qualified robot teams run approved evaluations. Training rights stay separate."
        canonical="/governance"
        jsonLd={[
          webPageJsonLd({
            path: "/governance",
            name: "Blueprint site data controls",
            description:
              "Progressive access, controlled evaluation, and separate training rights.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Governance", path: "/governance" },
          ]),
        ]}
      />

      <PageHero
        eyebrow="Site data control"
        title="Let robot teams test the site without giving them the site."
        body="Blueprint works like a clean room: qualified teams can run approved evaluations against the hosted testbed, while the underlying facility files remain controlled."
        chips={[
          "No public twin download",
          "Site approves access",
          "Training rights separate",
        ]}
        ctaHref="/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=governance"
        ctaLabel="Submit a site task"
        secondaryHref="/for-site-operators"
        secondaryLabel="Site-operator use case"
        imageSrc="/redesign/pov/retail-backroom.jpg"
        imageAlt="Retail backroom with operator-controlled capture boundaries"
        imageCaption="Operator-approved scope"
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="Progressive access"
            title="More detail only when the opportunity earns it."
            onInk
          />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-lg border border-white/15 bg-white/15 lg:grid-cols-5">
            {accessLadder.map(([number, title, body]) => (
              <li key={number} className="bg-ink p-6">
                <span className="font-mono text-micro text-brass">
                  {number}
                </span>
                <h2 className="mt-4 text-title-m font-semibold tracking-tight text-white">
                  {title}
                </h2>
                <p className="mt-3 text-caption leading-6 text-ink-300">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="Evaluation is not training"
            title="Four permissions. Four different values."
            lede="A provider may be allowed to test an existing policy without being allowed to train on site videos, objects, layouts, or process behavior."
          />
          <div className="mt-14 divide-y divide-line border-y border-line">
            {permissions.map(([title, body], index) => (
              <Reveal key={title} delay={index * 0.04}>
                <div className="grid gap-3 py-5 sm:grid-cols-[0.3fr_0.7fr] sm:gap-10">
                  <p className="flex items-center gap-3 text-body-s font-semibold text-ink-900">
                    {index === 0 ? (
                      <Check
                        className="h-4 w-4 text-proof-fg"
                        aria-hidden="true"
                      />
                    ) : (
                      <LockKeyhole
                        className="h-4 w-4 text-brass-deep"
                        aria-hidden="true"
                      />
                    )}
                    {title}
                  </p>
                  <p className="text-body-s leading-7 text-ink-500">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="The control model"
            title="What stays inside. What may come out."
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-2">
            <article className="bg-white p-7 lg:p-9">
              <ShieldCheck
                className="h-6 w-6 text-proof-fg"
                aria-hidden="true"
              />
              <h2 className="mt-5 text-title-l font-semibold tracking-tight text-ink-900">
                Inside Blueprint
              </h2>
              <p className="mt-4 text-body-s leading-7 text-ink-500">
                Raw capture, detailed layouts, restricted zones, source media,
                hosted testbed files, and approved robot submissions.
              </p>
            </article>
            <article className="bg-white p-7 lg:p-9">
              <X className="h-6 w-6 text-warn-fg" aria-hidden="true" />
              <h2 className="mt-5 text-title-l font-semibold tracking-tight text-ink-900">
                Returned to each team
              </h2>
              <p className="mt-4 text-body-s leading-7 text-ink-500">
                Completion rate, cycle-time estimate, reach or collision
                failures, fleet and charging assumptions, edge cases, and
                integration burden—within the permissions granted.
              </p>
            </article>
          </div>
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="Your floor, your rules"
        title="Set the boundary before capture starts."
        body="Define restricted areas, approved viewers, permitted evaluations, and training rights as separate choices."
        primaryHref="/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=governance-cta"
        primaryLabel="Submit a site task"
        secondaryHref="/proof"
        secondaryLabel="Read the proof boundary"
        imageSrc="/redesign/pov/cold-storage.jpg"
        imageAlt="Cold-storage aisle captured within operator-approved limits"
      />
    </>
  );
}
