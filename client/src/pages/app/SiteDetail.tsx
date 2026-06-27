import * as React from "react";
import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Rocket, ShieldCheck } from "lucide-react";

import {
  Button,
  Card,
  Checkbox,
  DataField,
  Eyebrow,
  Field,
  ProofBoundary,
  SelectField,
  StatusChip,
  Switch,
} from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { MonochromeMedia } from "@/components/site/editorial";
import { cn } from "@/lib/utils";
import {
  captureManifest,
  compareAgainstOptions,
  defaultSuccessThreshold,
  episodeOptions,
  findSitePack,
  policySelectOptions,
  robotProfileOptions,
  runCostByEpisodes,
  type SitePack,
} from "@/components/blueprint/app/mockData";

type EpisodeCount = (typeof episodeOptions)[number]["value"];

interface SiteDetailProps {
  params: { siteId: string };
}

/**
 * Site detail — buyer-app pack overview + paired run kickoff (/app/packs/:siteId).
 *
 * The key model: a run is configured *per site*. Left column carries the pack
 * overview (framed capture media + capture-manifest DataField card) and the
 * "Configure a run on this site" form. A sticky Run summary card mirrors the
 * form's live state — most notably the mono cost, which flips between $6.5k and
 * $15k as the 100/500 episode toggle changes.
 *
 * Mock/illustrative data only — no backend. Predicted outcomes are framed as
 * rank fidelity, never a guarantee; capture media is review support, not proof.
 */
export default function SiteDetail({ params }: SiteDetailProps) {
  const pack = findSitePack(params.siteId);

  if (!pack) {
    return <SiteNotFound siteId={params.siteId} />;
  }

  return <SiteDetailBody pack={pack} />;
}

function SiteDetailBody({ pack }: { pack: SitePack }) {
  const [robotProfile, setRobotProfile] = React.useState(
    robotProfileOptions[0]?.value ?? "",
  );
  const [episodes, setEpisodes] = React.useState<EpisodeCount>(500);
  const [policy, setPolicy] = React.useState(policySelectOptions[0]?.value ?? "");
  const [threshold, setThreshold] = React.useState(defaultSuccessThreshold);
  const [compareAgainst, setCompareAgainst] = React.useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      compareAgainstOptions.map((opt) => [opt.value, opt.defaultChecked]),
    ),
  );
  const [advisorySim, setAdvisorySim] = React.useState(true);

  const cost = runCostByEpisodes[episodes] ?? "—";
  const robotProfileLabel =
    robotProfileOptions.find((o) => o.value === robotProfile)?.label ?? "—";
  const policyLabel =
    policySelectOptions.find((o) => o.value === policy)?.label ?? "—";
  const baselineCount = Object.values(compareAgainst).filter(Boolean).length;

  // Illustrative paired run id for the kickoff CTA.
  const newRunId = "RUN-2061";

  return (
    <AppShell active="packs" breadcrumb={`packs / ${pack.id}`}>
      <Helmet>
        <title>{pack.name} · Site pack · Blueprint</title>
        <meta
          name="description"
          content={`Pack overview and per-site run kickoff for ${pack.name}. Inspect the capture manifest, then configure robot profile, episodes, policy and baselines. Illustrative data, not live operational state.`}
        />
      </Helmet>

      <div className="mx-auto flex max-w-[80rem] flex-col gap-8 px-4 py-8 lg:px-8">
        {/* Back link */}
        <Link
          href="/app/packs"
          className="inline-flex w-fit items-center gap-1.5 text-body-s font-semibold text-ink-500 transition-colors hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          All packs
        </Link>

        {/* Title row */}
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
              {pack.name}
            </h1>
            <StatusChip tone={pack.status.tone} square>
              {pack.status.label}
            </StatusChip>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.78rem] text-ink-500">
            <span>{pack.id}</span>
            <span className="text-ink-300">·</span>
            <span>{pack.task}</span>
            <span className="text-ink-300">·</span>
            <span>{pack.city}</span>
            <span className="text-ink-300">·</span>
            <span>Captured {pack.captured}</span>
          </div>
        </header>

        {/* Pack overview: capture media + manifest */}
        <section
          aria-label="Pack overview"
          className="grid grid-cols-1 gap-5 lg:grid-cols-[0.52fr_0.48fr]"
        >
          <div className="flex flex-col gap-2">
            <Eyebrow tone="muted">Capture point of view</Eyebrow>
            <MonochromeMedia
              src={`/redesign/pov/${pack.povId}.jpg`}
              alt={`${pack.name} — capture walkthrough still`}
              overlay="soft"
              radius="md"
              className="aspect-[16/10] w-full border border-line bp-focus-frame"
            >
              <span className="absolute bottom-3 right-3 rounded-xs bg-black/45 px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-white/85 backdrop-blur-sm">
                Review media · not real-world proof
              </span>
            </MonochromeMedia>
          </div>

          <Card eyebrow="Capture manifest" title="What's in this pack" pad="md">
            <div className="flex flex-col">
              {captureManifest.map((row, index) => (
                <DataField
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  mono={row.mono ?? true}
                  border={index < captureManifest.length - 1}
                  trailing={
                    row.badge ? (
                      <StatusChip tone={row.badge.tone} square dot={false}>
                        {row.badge.label}
                      </StatusChip>
                    ) : undefined
                  }
                />
              ))}
            </div>
          </Card>
        </section>

        {/* Paired run kickoff */}
        <section aria-label="Configure a run on this site" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Eyebrow tone="brass" rule>
              Paired run kickoff
            </Eyebrow>
            <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
              Configure a run on this site
            </h2>
            <p className="max-w-[44rem] text-body-s text-ink-500">
              A run is configured per site. Set the robot profile, episode budget,
              policy under test and baselines — the summary updates live.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.62fr_0.38fr]">
            {/* Config form */}
            <Card pad="md" className="flex flex-col gap-6">
              <SelectField
                label="Robot profile"
                placeholder="Select a robot profile"
                options={robotProfileOptions}
                value={robotProfile}
                onValueChange={setRobotProfile}
                hint="Embodiment the captured task is replayed against."
              />

              {/* Episode segmented toggle */}
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-caption font-semibold text-ink-800">
                  Episode budget
                </legend>
                <div
                  role="radiogroup"
                  aria-label="Episode budget"
                  className="inline-flex w-full overflow-hidden rounded-xs border border-line-strong"
                >
                  {episodeOptions.map((opt, index) => {
                    const selected = opt.value === episodes;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setEpisodes(opt.value)}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-body-s font-semibold transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-deep/60",
                          index > 0 && "border-l border-line-strong",
                          selected
                            ? "bg-brass text-ink"
                            : "bg-white text-ink-600 hover:bg-inset",
                        )}
                      >
                        <span>{opt.label}</span>
                        <span
                          className={cn(
                            "font-mono text-[0.78rem]",
                            selected ? "text-ink/80" : "text-ink-400",
                          )}
                        >
                          {opt.cost}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-caption text-ink-500">
                  More episodes widen scenario coverage and rank fidelity.
                </p>
              </fieldset>

              <SelectField
                label="Policy under test"
                placeholder="Select a policy"
                options={policySelectOptions}
                value={policy}
                onValueChange={setPolicy}
                hint="The checkpoint, API runner or VLA being evaluated."
              />

              <Field
                label="Success threshold"
                type="text"
                inputMode="decimal"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                hint="Pass bar applied to predicted success (0–1 ratio)."
                trailing={
                  <span className="font-mono text-[0.72rem] text-ink-400">
                    ratio
                  </span>
                }
              />

              {/* Compare-against baselines */}
              <fieldset className="flex flex-col gap-2.5">
                <legend className="text-caption font-semibold text-ink-800">
                  Compare against
                </legend>
                {compareAgainstOptions.map((opt) => (
                  <Checkbox
                    key={opt.value}
                    label={opt.label}
                    checked={compareAgainst[opt.value]}
                    onCheckedChange={(checked) =>
                      setCompareAgainst((prev) => ({
                        ...prev,
                        [opt.value]: checked === true,
                      }))
                    }
                  />
                ))}
              </fieldset>

              {/* Advisory sim switch */}
              <div className="flex items-start justify-between gap-4 border-t border-line-soft pt-5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-body-s font-medium text-ink-900">
                    Advisory simulation preflight
                  </span>
                  <span className="text-caption text-ink-500">
                    Sim is decision support only — never counted as real-world
                    proof.
                  </span>
                </div>
                <Switch
                  checked={advisorySim}
                  onCheckedChange={setAdvisorySim}
                  aria-label="Advisory simulation preflight"
                />
              </div>
            </Card>

            {/* Sticky run summary */}
            <div className="lg:sticky lg:top-6 lg:self-start">
              <Card
                eyebrow="Run summary"
                title="This run, on this site"
                pad="md"
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col">
                  <DataField label="Site" value={pack.name} mono={false} />
                  <DataField label="Pack" value={pack.id} />
                  <DataField label="Task" value={pack.task} mono={false} />
                  <DataField
                    label="Robot profile"
                    value={robotProfileLabel}
                    mono={false}
                  />
                  <DataField label="Episodes" value={String(episodes)} />
                  <DataField
                    label="Policy"
                    value={policyLabel}
                    mono={false}
                  />
                  <DataField
                    label="Threshold"
                    value={`success >= ${threshold || "—"}`}
                  />
                  <DataField
                    label="Baselines"
                    value={`${baselineCount} compared`}
                  />
                  <DataField
                    label="Advisory sim"
                    value={advisorySim ? "On (preflight only)" : "Off"}
                    border={false}
                    trailing={
                      advisorySim ? (
                        <StatusChip tone="warn" square dot={false}>
                          Sim
                        </StatusChip>
                      ) : undefined
                    }
                  />
                </div>

                {/* Live cost */}
                <div className="flex items-baseline justify-between border-t border-line-soft pt-4">
                  <span className="text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
                    Estimated cost
                  </span>
                  <span className="font-mono text-[1.5rem] font-medium leading-none tracking-tight text-ink-900">
                    {cost}
                  </span>
                </div>

                <ProofBoundary level="info" title="Estimate, not a guarantee">
                  Cost and predicted outcomes are estimates framed by rank
                  fidelity against prior validated runs — not a promise of field
                  performance. Rights, privacy and provenance ship with the run.
                </ProofBoundary>

                <Button
                  asChild
                  variant="brass"
                  full
                  iconLeft={<Rocket />}
                >
                  <Link href={`/app/runs/${newRunId}`}>
                    Kick off run on this site
                  </Link>
                </Button>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SiteNotFound({ siteId }: { siteId: string }) {
  return (
    <AppShell active="packs" breadcrumb="packs / not found">
      <Helmet>
        <title>Pack not found · Blueprint</title>
      </Helmet>
      <div className="mx-auto flex max-w-[48rem] flex-col gap-6 px-4 py-12 lg:px-8">
        <Link
          href="/app/packs"
          className="inline-flex w-fit items-center gap-1.5 text-body-s font-semibold text-ink-500 transition-colors hover:text-ink-800"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          All packs
        </Link>
        <Card pad="lg" className="flex flex-col gap-4">
          <Eyebrow tone="muted">Pack overview</Eyebrow>
          <h1 className="text-title-l font-semibold tracking-tight text-ink-900">
            We couldn't find that pack
          </h1>
          <p className="text-body-s text-ink-500">
            No site pack matches{" "}
            <span className="font-mono text-ink-700">{siteId}</span>. It may have
            been renamed or is outside your licensed sites.
          </p>
          <ProofBoundary level="warn" title="Missing pack">
            This view only lists packs within your access window. Check the pack
            catalog for the current set.
          </ProofBoundary>
          <Button asChild variant="action" className="w-fit" iconRight={<ArrowRight />}>
            <Link href="/app/packs">Back to packs</Link>
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
