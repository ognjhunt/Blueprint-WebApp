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
import { editorialRefreshAssets } from "@/lib/editorialRefreshAssets";
import { privateGeneratedAssets } from "@/lib/privateGeneratedAssets";

const roleOptions: LaunchAccessRole[] = [
  "capturer",
  "site_operator",
  "capturer_and_site_operator",
];

const signalReasons = [
  {
    title: "We track real city demand",
    body: "Future-city requests help Blueprint prioritize launch planning, capturer recruitment, and operator outreach.",
    icon: RadioTower,
  },
  {
    title: "Local operators matter",
    body: "If you can open doors, validate access rules, or host early capture, that changes how quickly a city becomes actionable.",
    icon: ShieldCheck,
  },
  {
    title: "Early people get contacted first",
    body: "We use this list to reach back out when a city opens, when we need local capturers, or when we want power users to help shape rollout.",
    icon: UserRoundPlus,
  },
] as const;

export default function CaptureLaunchAccess() {
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const { data: publicLaunchStatus } = usePublicLaunchStatus();
  const supportedCities = publicLaunchStatus?.supportedCities ?? [];
  const prefilledCity = normalizeLaunchAccessCity(searchParams.get("city"));
  const source = searchParams.get("source")?.trim() || "capture_app_launch_access";

  const [email, setEmail] = useState("");
  const [city, setCity] = useState(prefilledCity);
  const [role, setRole] = useState<LaunchAccessRole>("capturer");
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
        description="Tell Blueprint which city you are in, whether you can capture or operate locally, and get notified as the rollout moves toward your market."
        canonical="/capture-app/launch-access"
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[96rem] gap-px lg:grid-cols-[0.58fr_0.42fr]">
            <div className="bg-[#f5f3ef] px-8 py-10 lg:px-12 lg:py-14">
              <EditorialSectionLabel>Capture rollout request</EditorialSectionLabel>
              <h1 className="font-editorial mt-6 max-w-[12ch] text-[4.2rem] leading-[0.88] tracking-[-0.08em] text-slate-950 sm:text-[5.6rem]">
                Help us open your city sooner.
              </h1>
              <p className="mt-6 max-w-[31rem] text-base leading-8 text-slate-700">
                Leave a city signal if Blueprint is not live where you are yet. We use this list to
                prioritize rollout, identify boots-on-the-ground capturers, and find site operators
                who can help us unlock a market faster.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <ProofChip>Future-city demand</ProofChip>
                <ProofChip>{selectedRoleLabel}</ProofChip>
                {city ? <ProofChip>{city}</ProofChip> : null}
              </div>
              <div className="mt-8 grid max-w-[34rem] gap-4 border-t border-black/10 pt-5 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Purpose</p>
                  <p className="mt-2 text-sm text-slate-900">City launch signal</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Who it finds</p>
                  <p className="mt-2 text-sm text-slate-900">Capturers, operators, city leads</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">What happens next</p>
                  <p className="mt-2 text-sm text-slate-900">Launch queue + follow-up</p>
                </div>
              </div>
            </div>

            <MonochromeMedia
              src={privateGeneratedAssets.captureAppAisle}
              alt="Blueprint capture lane"
              className="min-h-[34rem] rounded-none"
              loading="eager"
              imageClassName="min-h-[34rem]"
              overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.34))]"
            >
              <div className="absolute inset-x-0 bottom-0 p-6 lg:p-8">
                <div className="max-w-[22rem] rounded-[1.6rem] border border-white/10 bg-black/55 p-5 text-white backdrop-blur-sm">
                  <EditorialSectionLabel light>Why this matters</EditorialSectionLabel>
                  <p className="mt-4 text-sm leading-7 text-white/76">
                    This is not just a passive newsletter list. It is the intake we use to spot
                    markets with enough real local support to justify opening sooner.
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
                  <article key={reason.title} className="border border-black/10 bg-white p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[#f5f3ef] text-slate-900">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-editorial text-[2rem] leading-[0.95] tracking-[-0.05em] text-slate-950">
                          {reason.title}
                        </h2>
                        <p className="mt-4 text-sm leading-7 text-slate-700">{reason.body}</p>
                      </div>
                    </div>
                  </article>
                );
              })}

              <div className="border border-black/10 bg-white p-6">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <MapPinned className="h-4 w-4" />
                  Current launch cities
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {supportedCities.length ? (
                    supportedCities.map((launchCity) => (
                      <span
                        key={launchCity.citySlug}
                        className="inline-flex rounded-full border border-black/10 bg-[#f5f3ef] px-3 py-2 text-sm text-slate-800"
                      >
                        {launchCity.displayName}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm leading-7 text-slate-600">
                      Current launch cities will appear here once the public roster is available.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-black/10 bg-white p-6 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.22)] lg:p-7">
              <EditorialSectionLabel>Leave a city signal</EditorialSectionLabel>
              <h2 className="font-editorial mt-4 text-[2.6rem] leading-[0.92] tracking-[-0.06em] text-slate-950">
                Tell us where you are and how you can help.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-700">
                We will use this to keep you updated, notify you when launch planning reaches your
                city, and potentially pull you in early as a local power user.
              </p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Email
                  </span>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="w-full border border-black/10 bg-[#f8f6f1] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    City
                  </span>
                  <input
                    required
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="Durham, NC"
                    className="w-full border border-black/10 bg-[#f8f6f1] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    How can you help?
                  </span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as LaunchAccessRole)}
                    className="w-full border border-black/10 bg-[#f8f6f1] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                  >
                    {roleOptions.map((option) => (
                      <option key={option} value={option}>
                        {getLaunchAccessRoleLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Organization or site
                  </span>
                  <input
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    placeholder="Triangle Robotics or Durham Warehouse District"
                    className="w-full border border-black/10 bg-[#f8f6f1] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Phone (optional)
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Best number if we need local follow-up"
                    className="w-full border border-black/10 bg-[#f8f6f1] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Notes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    placeholder="Tell us what kinds of sites you could help capture or unlock in your city."
                    className="w-full resize-none border border-black/10 bg-[#f8f6f1] px-4 py-3 text-sm leading-7 text-slate-950 outline-none transition focus:border-slate-400"
                  />
                </label>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {status === "loading" ? "Saving your city signal…" : "Request launch access"}
                  <ArrowRight className="h-4 w-4" />
                </button>

                {message ? (
                  <p className={`text-sm leading-7 ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>
                    {message}
                  </p>
                ) : null}
              </form>

              <div className="mt-6 border-t border-black/10 pt-4 text-sm leading-7 text-slate-600">
                We only use this for Blueprint launch updates and local rollout follow-up. If your
                city starts moving, this is the list we come back to.
              </div>
              <a
                href="mailto:hello@tryblueprint.io?subject=Blueprint%20future%20city%20launch"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-slate-700 hover:underline"
              >
                <Mail className="h-4 w-4" />
                Prefer email? Write to hello@tryblueprint.io
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-black/10 bg-white">
          <div className="mx-auto grid max-w-[96rem] gap-px lg:grid-cols-[0.44fr_0.56fr]">
            <MonochromeMedia
              src={editorialRefreshAssets.cityMapBoard}
              alt="Blueprint launch board"
              className="min-h-[26rem] rounded-none"
              imageClassName="min-h-[26rem]"
              overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.18))]"
            />
            <div className="bg-[#f5f3ef] px-8 py-10 lg:px-12 lg:py-12">
              <EditorialSectionLabel>What this queue does</EditorialSectionLabel>
              <h2 className="font-editorial mt-5 max-w-[12ch] text-[3.2rem] leading-[0.92] tracking-[-0.06em] text-slate-950">
                Demand, capturers, and operator access in one place.
              </h2>
              <p className="mt-5 max-w-[34rem] text-base leading-8 text-slate-700">
                We use this future-city intake to see where buyer demand is building, where we have
                people who can actually capture, and where local site operators can help us move
                from research into a real launch plan.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
