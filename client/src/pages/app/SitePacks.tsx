import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { ArrowRight, Plus, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { Button, Eyebrow, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { MonochromeMedia } from "@/components/site/editorial";
import { sitePacks } from "@/components/blueprint/app/mockData";

/**
 * Site & Task Packs — buyer-app pack catalog (/app/packs).
 *
 * Header + actions → 3-col card grid. Each card: a MonochromeMedia capture
 * point-of-view tile with a StatusChip overlay, site name, mono task, attribute
 * chips, and paired "View pack / Request run" links — both route to Site detail,
 * where the run is configured per site.
 *
 * Mock/illustrative data only — no backend. POV imagery is placeholder review
 * support, never real-world proof of performance.
 */
export default function SitePacks() {
  return (
    <AppShell active="packs" breadcrumb="packs">
      <Helmet>
        <title>Site &amp; Task Packs · Blueprint</title>
        <meta
          name="description"
          content="Captured site and task packs available for evaluation. Each pack pairs a validated real-site capture with a task; configure a run per site. Illustrative data, not live operational state."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[80rem] flex-col gap-8 px-4 py-8 lg:px-8">
        {/* Header + actions */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Eyebrow tone="brass" rule>
              Site &amp; task packs
            </Eyebrow>
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
              Captured sites, ready to evaluate
            </h1>
            <p className="max-w-[44rem] text-body-s text-ink-500">
              Each pack pairs a validated real-site capture with a task. Open a
              pack to inspect the capture manifest and configure a run on that
              site.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" iconLeft={<SlidersHorizontal />}>
              Filters
            </Button>
            <Button variant="action" iconLeft={<Plus />}>
              Request a capture
            </Button>
          </div>
        </header>

        {/* Pack card grid */}
        <section
          aria-label="Site and task packs"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {sitePacks.map((pack) => (
            <article
              key={pack.id}
              className="flex flex-col overflow-hidden rounded-md border border-line bg-white transition-colors hover:border-line-strong"
            >
              <MonochromeMedia
                src={`/redesign/pov/${pack.povId}.jpg`}
                alt={`${pack.name} — capture point of view`}
                radius="none"
                overlay="bg"
                className="aspect-[16/10] w-full"
              >
                <span className="absolute left-3 top-3">
                  <StatusChip tone={pack.status.tone} square>
                    {pack.status.label}
                  </StatusChip>
                </span>
                <span className="absolute bottom-3 right-3 rounded-xs bg-black/45 px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-white/85 backdrop-blur-sm">
                  Review media · not real-world proof
                </span>
              </MonochromeMedia>

              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-body font-semibold leading-snug text-ink-900">
                      {pack.name}
                    </h2>
                    <span className="shrink-0 font-mono text-[0.68rem] text-ink-400">
                      {pack.id}
                    </span>
                  </div>
                  <p className="font-mono text-[0.74rem] text-ink-500">
                    {pack.task}
                  </p>
                </div>

                <dl className="flex items-center justify-between gap-3 border-y border-line-soft py-2.5 text-caption text-ink-500">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-micro uppercase tracking-eyebrow text-ink-400">
                      Location
                    </dt>
                    <dd className="text-ink-700">{pack.city}</dd>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <dt className="text-micro uppercase tracking-eyebrow text-ink-400">
                      Episodes captured
                    </dt>
                    <dd className="font-mono text-[0.78rem] text-ink-800">
                      {pack.episodesAvailable}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-1.5">
                  {pack.attributes.map((attr) => (
                    <span
                      key={attr}
                      className="rounded-xs border border-line bg-sunken px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.06em] text-ink-600"
                    >
                      {attr}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex items-center gap-2 pt-2">
                  <Button
                    asChild
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    iconRight={<ArrowRight />}
                  >
                    <Link href={`/app/packs/${pack.id}`}>View pack</Link>
                  </Button>
                  <Button
                    asChild
                    variant="action"
                    size="sm"
                    className="flex-1"
                  >
                    <Link href={`/app/packs/${pack.id}`}>Request run</Link>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* Proof boundary */}
        <ProofBoundary
          level="info"
          title="What a pack is"
          icon={ShieldCheck}
        >
          A pack bundles a real-site capture, its task definition, and a signed
          provenance chain — rights and privacy scrubs included. Capture imagery
          shown here is monochrome review support, never real-world proof of
          policy performance. Runs are configured and priced per site.
        </ProofBoundary>
      </div>
    </AppShell>
  );
}
