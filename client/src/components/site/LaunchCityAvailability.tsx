import { ArrowRight, MapPinned } from "lucide-react";
import { usePublicLaunchStatus } from "@/hooks/usePublicLaunchStatus";
import { joinLaunchCityLabels } from "@/lib/publicLaunchStatus";
import { filterToServedCities, serviceArea } from "@/data/serviceArea";

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
        shell: "border-runway-line bg-runway-panel text-runway-text",
        badge: "border-runway-line bg-runway-panel text-runway-mute",
        body: "text-runway-mute",
        chip: "border-runway-line bg-runway-deep/80 text-runway-text hover:border-runway-mute",
        note: "border-runway-line bg-runway-deep/70 text-runway-mute",
        primary: "bg-runway-panel text-runway-text hover:bg-runway-line-soft",
        secondary: "border-runway-line text-runway-text hover:bg-runway-deep",
      };
    // `paper` addressed CSS variables that were scoped to a page-level light
    // palette; that palette is gone, so the branch resolved to nothing. It
    // falls through to the panel treatment, and the prop stays for callers.
    case "paper":
    case "light":
    default:
      return {
        shell: "border-runway-line bg-runway-panel text-runway-text",
        badge: "border-runway-line bg-runway-deep text-runway-mute",
        body: "text-runway-mute",
        chip: "border-runway-line bg-runway-deep text-runway-text hover:border-runway-line-strong hover:bg-runway-raised",
        note: "border-runway-signal-dim bg-runway-signal/[0.06] text-runway-mute",
        primary:
          "border border-runway-signal bg-runway-signal text-runway-signal-ink hover:border-runway-signal-lit hover:bg-runway-signal-lit",
        secondary: "border-runway-line-strong text-runway-text hover:border-runway-signal hover:text-runway-signal",
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
  // The launch-status endpoint can return a metro Blueprint does not actually
  // serve — coverage policies exist for several cities as prepared work for
  // expansion. A reader does not distinguish Blueprint's capturer program from
  // its deployment program, so the public list is filtered to the declared
  // service area rather than trusting whatever the backend returns. See
  // `@/data/serviceArea`.
  const supportedCities = filterToServedCities(data?.supportedCities ?? []);
  const supportedCitySummary = supportedCities.length
    ? `Current open public capture market: ${joinLaunchCityLabels(supportedCities)}.`
    : `Blueprint operates in ${serviceArea.city} only right now.`;

  return (
    <section className={`rounded-none border p-6 sm:p-7 ${classes.shell} ${className}`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${classes.badge}`}>
            <MapPinned className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h2 className="mt-4 font-display text-2xl font-semibold uppercase tracking-[0.005em] sm:text-3xl">{title}</h2>
          <p className={`mt-3 text-sm leading-7 sm:text-base ${classes.body}`}>{description}</p>
          <div className={`mt-4 rounded-none border px-4 py-3 text-sm leading-6 ${classes.note}`}>
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
