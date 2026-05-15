import { ArrowRight, MapPinned } from "lucide-react";
import { usePublicLaunchStatus } from "@/hooks/usePublicLaunchStatus";
import { joinLaunchCityLabels } from "@/lib/publicLaunchStatus";

type CtaLink = {
  href: string;
  label: string;
};

type LaunchCityAvailabilityProps = {
  eyebrow?: string;
  title: string;
  description: string;
  className?: string;
  tone?: "light" | "paper" | "dark";
  primaryCta?: CtaLink;
  secondaryCta?: CtaLink;
};

function toneClasses(tone: LaunchCityAvailabilityProps["tone"]) {
  switch (tone) {
    case "dark":
      return {
        shell: "border-slate-800 bg-slate-950 text-white",
        badge: "border-slate-700 bg-slate-900 text-slate-300",
        body: "text-slate-300",
        chip: "border-slate-700 bg-slate-900/80 text-slate-100 hover:border-slate-600",
        note: "border-slate-800 bg-slate-900/70 text-slate-300",
        primary: "bg-white text-slate-950 hover:bg-slate-100",
        secondary: "border-slate-700 text-white hover:bg-slate-900",
      };
    case "paper":
      return {
        shell: "border-[color:var(--line)] bg-[color:var(--panel)] text-[color:var(--ink)]",
        badge:
          "border-[color:var(--line-strong)] bg-white text-[color:var(--leaf-deep)]",
        body: "text-[color:var(--ink-soft)]",
        chip:
          "border-[color:var(--line)] bg-white text-[color:var(--ink)] hover:border-[color:var(--line-strong)]",
        note:
          "border-[color:var(--amber)]/30 bg-[color:var(--amber)]/8 text-[color:var(--ink-soft)]",
        primary: "bg-[color:var(--ink)] text-white hover:bg-[color:var(--leaf-deep)]",
        secondary:
          "border-[color:var(--line-strong)] text-[color:var(--ink)] hover:bg-[color:var(--paper)]",
      };
    case "light":
    default:
      return {
        shell: "border-slate-200 bg-white text-slate-950",
        badge: "border-slate-200 bg-slate-50 text-slate-700",
        body: "text-slate-600",
        chip: "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-slate-100",
        note: "border-sky-200 bg-sky-50 text-slate-700",
        primary: "bg-slate-950 text-white hover:bg-slate-800",
        secondary: "border-slate-300 text-slate-900 hover:bg-slate-100",
      };
  }
}

export function LaunchCityAvailability({
  eyebrow = "Current capture rollout",
  title,
  description,
  className = "",
  tone = "light",
  primaryCta,
  secondaryCta,
}: LaunchCityAvailabilityProps) {
  const { data, loading } = usePublicLaunchStatus();
  const classes = toneClasses(tone);
  const supportedCities = data?.supportedCities ?? [];
  const supportedCitySummary = supportedCities.length
    ? `Current open public capture markets: ${joinLaunchCityLabels(supportedCities)}.`
    : "No open public capture market is listed here right now.";

  return (
    <section className={`rounded-[1.8rem] border p-6 sm:p-7 ${classes.shell} ${className}`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${classes.badge}`}>
            <MapPinned className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
          <p className={`mt-3 text-sm leading-7 sm:text-base ${classes.body}`}>{description}</p>
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-6 ${classes.note}`}>
            <span className="font-semibold">
              {loading ? "Reviewing public capture-market status..." : supportedCitySummary}
            </span>{" "}
            Only approved launch cities open capture access and public capture cards. Nearby places can enter review for future launch, but they do not show as open until Blueprint approves them.
          </div>
        </div>

        {(primaryCta || secondaryCta) ? (
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
            {primaryCta ? (
              <a
                href={primaryCta.href}
                className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${classes.primary}`}
              >
                {primaryCta.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            ) : null}
            {secondaryCta ? (
              <a
                href={secondaryCta.href}
                className={`inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-semibold transition ${classes.secondary}`}
              >
                {secondaryCta.label}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      {supportedCities.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {supportedCities.map((city) => (
            <a
              key={city.citySlug}
              href={`/city/${city.citySlug}`}
              className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${classes.chip}`}
            >
              {city.displayName}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
