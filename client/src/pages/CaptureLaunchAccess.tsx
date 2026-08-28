import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { ArrowRight, Mail, MapPinned, RadioTower, ShieldCheck, UserRoundPlus } from "lucide-react";
import { SEO } from "@/components/SEO";
import {
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
} from "@/components/site/editorial";
import { withCsrfHeader } from "@/lib/csrf";
import { usePublicLaunchStatus } from "@/hooks/usePublicLaunchStatus";
import { analyticsEvents } from "@/lib/analytics";
import { buildLaunchAccessWaitlistPayload, getLaunchAccessRoleLabel, normalizeLaunchAccessCity, type LaunchAccessRole } from "@/lib/launchAccess";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const roleOptions: LaunchAccessRole[] = [
  "capturer",
  "site_operator",
  "capturer_and_site_operator",
];

const signalReasons = [
  {
    title: "We track real city demand",
    body: "Future-city requests help Blueprint prioritize launch planning, approved assignments, capturer recruitment, and operator outreach.",
    icon: RadioTower,
  },
  {
    title: "Local capturers and operators matter",
    body: "If you can capture public-area-only routes, validate access rules, or host early capture, that changes how quickly a city can open.",
    icon: ShieldCheck,
  },
  {
    title: "Early signals get reviewed first",
    body: "We use this list to reach back out when a city opens, when we need local capturers, or when approved assignments need a local review queue.",
    icon: UserRoundPlus,
  },
] as const;

export default function CaptureLaunchAccess() {
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const {
    data: publicLaunchStatus,
    loading: launchStatusLoading,
    error: launchStatusError,
  } = usePublicLaunchStatus();
  const supportedCities = publicLaunchStatus?.supportedCities ?? [];
  const prefilledCity = normalizeLaunchAccessCity(searchParams.get("city"));
  const prefilledRole = roleOptions.includes(searchParams.get("role") as LaunchAccessRole)
    ? (searchParams.get("role") as LaunchAccessRole)
    : "capturer";
  const source = searchParams.get("source")?.trim() || "capture_app_launch_access";

  const [email, setEmail] = useState("");
  const [city, setCity] = useState(prefilledCity);
  const [role, setRole] = useState<LaunchAccessRole>(prefilledRole);
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const selectedRoleLabel = getLaunchAccessRoleLabel(role);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const payload = buildLaunchAccessWaitlistPayload({
        email,
        city,
        role,
        company,
        notes,
        phone,
        source,
      });

      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to submit launch access request: ${response.status}`);
      }

      analyticsEvents.waitlistSignup(payload.locationType);
      setStatus("success");
      setMessage(
        `You’re on the list for ${payload.market}. We’ll keep you updated and may reach out early if we need local capturers, site operators, or city leads.`,
      );
      setEmail("");
      setCompany("");
      setNotes("");
      setPhone("");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("Something went wrong while saving your city signal. Please try again.");
    }
  }

  return (
    <>
      <SEO
        title="Request Launch Access | Blueprint Capture"
        description="Tell Blueprint which city you are in, whether you can complete public-area capture or operate locally, and get notified when launch review reaches your market."
        canonical="/capture-app/launch-access"
        jsonLd={[
          webPageJsonLd({
            path: "/capture-app/launch-access",
            name: "Blueprint Capture Launch Access",
            description:
              "A public city signal path for future paid capture assignments, local capturers, and site operators who can support launch review.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Capture", path: "/capture" },
            { name: "Launch Access", path: "/capture-app/launch-access" },
          ]),
        ]}
      />

      <div className="bg-runway-deep text-runway-body">
        <section className="border-b border-runway-line bg-runway-panel">
          <div className="mx-auto grid max-w-[96rem] gap-px lg:grid-cols-[0.58fr_0.42fr]">
            <div className="bg-runway-deep px-8 py-10 lg:px-12 lg:py-14">
              <EditorialSectionLabel>Capture rollout request</EditorialSectionLabel>
              <h1 className="font-editorial mt-6 max-w-[12ch] font-display uppercase text-[4.2rem] leading-[0.88] tracking-[0.005em] text-runway-text sm:text-[5.6rem]">
                Signal demand for paid capture in your city.
              </h1>
              <p className="mt-6 max-w-[31rem] text-base leading-8 text-runway-body">
                Leave a local capturer or operator signal if Blueprint is not live where you are
                yet. We use this list to prioritize rollout, identify people who can complete
                public-area-only capture candidates, and find site operators who can help a market
                open without implying assignments are already available.
              </p>
              <p className="mt-4 max-w-[31rem] text-sm leading-7 text-runway-mute">
                Approved assignments stay gated. Payout is conditional on the assignment shown
                before capture, one complete walkthrough, and review after upload.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <ProofChip>Future-city demand</ProofChip>
                <ProofChip>{selectedRoleLabel}</ProofChip>
                {city ? <ProofChip>{city}</ProofChip> : null}
              </div>
              <div className="mt-8 grid max-w-[34rem] gap-4 border-t border-runway-line pt-5 sm:grid-cols-3">
                <div>
                  <p className="runway-meta">Purpose</p>
                  <p className="mt-2 text-sm text-runway-text">Paid capture demand</p>
                </div>
                <div>
                  <p className="runway-meta">Who it finds</p>
                  <p className="mt-2 text-sm text-runway-text">Capturers, operators, city leads</p>
                </div>
                <div>
                  <p className="runway-meta">What happens next</p>
                  <p className="mt-2 text-sm text-runway-text">Launch review + follow-up</p>
                </div>
              </div>
            </div>

            <MonochromeMedia
              src={publicCaptureGeneratedAssets.captureAppHero}
              alt="Blueprint capture route"
              className="min-h-[34rem] rounded-none"
              loading="eager"
              imageClassName="min-h-[34rem]"
              overlayClassName="bg-[linear-gradient(180deg,rgba(12,15,14,0.2),rgba(12,15,14,0.72))]"
            >
              <div className="absolute inset-x-0 bottom-0 p-6 lg:p-8">
                <div className="max-w-[22rem] border border-runway-line bg-runway-black/70 p-5 backdrop-blur-sm">
                  <EditorialSectionLabel light>Why this matters</EditorialSectionLabel>
                  <p className="mt-4 text-sm leading-7 text-runway-mute">
                    This is how we spot
                    markets with enough real local support to justify opening paid field capture.
                  </p>
                </div>
              </div>
            </MonochromeMedia>
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-[0.56fr_0.44fr]">
            <div className="space-y-4">
              {signalReasons.map((reason) => {
                const Icon = reason.icon;
                return (
                  <article key={reason.title} className="runway-panel p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-runway-line bg-runway-raised text-runway-mute">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-editorial font-display uppercase text-[2rem] leading-[0.95] tracking-[0.005em] text-runway-text">
                          {reason.title}
                        </h2>
                        <p className="mt-4 text-sm leading-7 text-runway-body">{reason.body}</p>
                      </div>
                    </div>
                  </article>
                );
              })}

              <div className="runway-panel p-6">
                <div className="runway-meta flex items-center gap-2">
                  <MapPinned className="h-4 w-4" />
                  Current launch cities
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {launchStatusLoading ? (
                    <p className="text-sm leading-7 text-runway-mute">
                      Reviewing public capture-market status before showing open cities.
                    </p>
                  ) : launchStatusError ? (
                    <p className="text-sm leading-7 text-runway-mute">
                      Launch status unavailable. This page will not assume a city is open from
                      saved fallback copy.
                    </p>
                  ) : supportedCities.length ? (
                    supportedCities.map((launchCity) => (
                      <span
                        key={launchCity.citySlug}
                        className="runway-chip runway-chip-live"
                      >
                        {launchCity.displayName}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm leading-7 text-runway-mute">
                      No open public capture market is listed here right now. Leave your city and
                      Blueprint will route it through launch review.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="runway-panel p-6 lg:p-7">
              <EditorialSectionLabel>Leave a city signal</EditorialSectionLabel>
              <h2 className="font-editorial mt-4 font-display uppercase text-[2.6rem] leading-[0.92] tracking-[0.005em] text-runway-text">
                Tell us where you are and what you can capture.
              </h2>
              <p className="mt-4 text-sm leading-7 text-runway-body">
                We will use this to keep you updated, notify you when launch planning reaches your
                city, and potentially pull you in early as a local capturer or operator reviewer.
              </p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                <label className="block">
                  <span className="runway-label">
                    Email
                  </span>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="runway-input"
                  />
                </label>

                <label className="block">
                  <span className="runway-label">
                    City
                  </span>
                  <input
                    required
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="Durham, NC"
                    className="runway-input"
                  />
                </label>

                <label className="block">
                  <span className="runway-label">
                    How can you help?
                  </span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as LaunchAccessRole)}
                    className="runway-input"
                  >
                    {roleOptions.map((option) => (
                      <option key={option} value={option}>
                        {getLaunchAccessRoleLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="runway-label">
                    Organization or site
                  </span>
                  <input
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    placeholder="Triangle Robotics or Durham Warehouse District"
                    className="runway-input"
                  />
                </label>

                <label className="block">
                  <span className="runway-label">
                    Phone (optional)
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Best number if we need local follow-up"
                    className="runway-input"
                  />
                </label>

                <label className="block">
                  <span className="runway-label">
                    Notes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    placeholder="Tell us what public-facing routes, public-area-only capture candidates, or operator access you could help with in your city."
                    className="runway-input resize-none leading-7"
                  />
                </label>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="runway-cta w-full disabled:opacity-60"
                >
                  {status === "loading" ? "Saving your city signal..." : "Request launch access"}
                  <ArrowRight className="h-4 w-4" />
                </button>

                {message ? (
                  <p className={`text-sm leading-7 ${status === "error" ? "text-runway-red" : "text-runway-green"}`}>
                    {message}
                  </p>
                ) : null}
              </form>

              <div className="mt-6 border-t border-runway-line pt-4 text-sm leading-7 text-runway-mute">
                We only use this for Blueprint launch updates and local rollout follow-up. If your
                city enters launch planning, this is the list we come back to before opening
                approved assignments.
              </div>
              <a
                href="mailto:hello@tryblueprint.io?subject=Blueprint%20future%20city%20launch"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-runway-text transition hover:text-runway-signal"
              >
                <Mail className="h-4 w-4" />
                Prefer email? Write to hello@tryblueprint.io
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-runway-line bg-runway-panel">
          <div className="mx-auto grid max-w-[96rem] gap-px lg:grid-cols-[0.44fr_0.56fr]">
            <MonochromeMedia
              src={publicCaptureGeneratedAssets.everydayPlacesCollage}
              alt="Blueprint launch board"
              className="min-h-[26rem] rounded-none"
              imageClassName="min-h-[26rem]"
              overlayClassName="bg-[linear-gradient(180deg,rgba(12,15,14,0.14),rgba(12,15,14,0.5))]"
            />
            <div className="bg-runway-deep px-8 py-10 lg:px-12 lg:py-12">
              <EditorialSectionLabel>What this queue does</EditorialSectionLabel>
              <h2 className="font-editorial mt-5 max-w-[12ch] font-display uppercase text-[3.2rem] leading-[0.92] tracking-[0.005em] text-runway-text">
                Buyer demand, local capturers, and site access in one place.
              </h2>
              <p className="mt-5 max-w-[34rem] text-base leading-8 text-runway-body">
                We use this future-city intake to see where buyer demand is building, where we have
                people who can actually capture, and where local site operators can help us move
                from research into a real launch plan with public-area-only, privacy-safe capture rules.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
