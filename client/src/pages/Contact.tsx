import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import { normalizeInterestToLane } from "@/lib/contactInterest";
import { getDemandCityMessaging } from "@/lib/cityDemandMessaging";
import { Mail, MessageSquare, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useSearch } from "wouter";

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
      {children}
    </p>
  );
}

export default function Contact() {
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const interest = searchParams.get("interest")?.trim() ?? "";
  const buyerType = searchParams.get("buyerType")?.trim() ?? "";
  const personaParam = searchParams.get("persona")?.trim() ?? "";
  const cityMessaging = getDemandCityMessaging(searchParams.get("city"));
  const hostedMode =
    normalizeInterestToLane(interest) === "deeper_evaluation" && buyerType === "robot_team";
  const persona =
    hostedMode || personaParam === "robot-team" || buyerType === "robot_team"
      ? "robot_team"
      : personaParam === "site-operator" || buyerType === "site_operator"
        ? "site_operator"
        : "robot_team";
  const robotTeamCityMessaging = persona === "robot_team" ? cityMessaging : null;

  const seoTitle = hostedMode
    ? "Request Hosted Evaluation | Blueprint"
    : robotTeamCityMessaging
      ? `For ${robotTeamCityMessaging.shortLabel} Robot Teams | Blueprint`
      : persona === "site_operator"
        ? "For Site Operators | Blueprint"
        : "For Robot Teams | Blueprint";
  const seoDescription = hostedMode
    ? "Request a hosted robot-team evaluation for a site-specific world model."
    : robotTeamCityMessaging
      ? `Send Blueprint a short ${robotTeamCityMessaging.shortLabel} buyer brief anchored in exact-site proof, workflow context, and truthful next steps.`
      : persona === "site_operator"
        ? "Talk to Blueprint about facility participation, access rules, and governance."
        : "Send Blueprint a short brief about the site, task, and robot setup you want to evaluate.";

  const badgeLabel = hostedMode
    ? "Hosted Evaluation"
    : robotTeamCityMessaging
      ? `For Robot Teams • ${robotTeamCityMessaging.shortLabel}`
      : persona === "site_operator"
        ? "For Site Operators"
        : "For Robot Teams";
  const heroTitle = hostedMode
    ? "Request a hosted evaluation for this site."
    : robotTeamCityMessaging
      ? robotTeamCityMessaging.requestHeroTitle
      : persona === "site_operator"
        ? "Tell us about the facility and the rules around it."
        : "Tell us the site, task, and robot in a few lines.";
  const heroBody = hostedMode
    ? "Confirm the site, the task, and the robot setup. Blueprint will use that to line up the right hosted evaluation path for your team."
    : robotTeamCityMessaging
      ? robotTeamCityMessaging.requestHeroBody
      : persona === "site_operator"
        ? "Use this form if you run the facility and need to talk through capture access, privacy rules, or whether the site should be listed at all."
        : "Use this form if your team needs one exact site for evaluation, site-specific data, release comparison, or package access. A short brief is enough if you are still figuring out fit.";
  const responseTitle = hostedMode ? "Hosted evaluation request" : "What happens after you send this";
  const responseBody = hostedMode
    ? "Fill out the short form and Blueprint will follow up to confirm the site, robot setup, and the next step toward a hosted evaluation."
    : robotTeamCityMessaging
      ? robotTeamCityMessaging.requestResponseBody
      : persona === "site_operator"
        ? "Blueprint reviews the facility details, access rules, and privacy notes first so the next reply can narrow the path quickly."
        : "Blueprint reviews the site, task, and robot details first. The reply should point your team toward the package path, hosted evaluation, or a short follow-up question.";

  const afterInquiry = [
    "Blueprint reviews the site, task, and robot context first.",
    "The next reply narrows the package path, hosted evaluation path, or the follow-up question that actually matters.",
    "Rights, privacy, and proof boundaries stay explicit instead of being deferred into vague sales language.",
  ];

  const fastPaths = [
    {
      href: "/book-exact-site-review",
      label: "Book a scoping call",
      detail: "Best when the site is already known and your team wants a fast human pass.",
    },
    {
      href: "/exact-site-hosted-review",
      label: "See hosted evaluation",
      detail: "Best when your team wants the runtime path explained before it writes a brief.",
    },
    {
      href: "/world-models/siteworld-f5fd54898cfb",
      label: "Inspect the sample listing",
      detail: "Best when your team wants to validate the proof style before any outreach.",
    },
  ];

  const responseCadence = [
    "Public-listing or hosted-evaluation questions: typical first reply within 1 business day.",
    "Request-scoped rights, privacy, or export review: typical first scoped answer within 2 business days.",
    "Private-site and unusual support requests: timing confirmed in the first follow-up once scope is clear.",
  ];

  return (
    <>
      <SEO title={seoTitle} description={seoDescription} canonical="/contact" />

      <div className="overflow-hidden bg-[#f6f1e8] text-slate-950">
        <section className="relative border-b border-black/10">
          <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_40%),radial-gradient(circle_at_82%_12%,_rgba(14,116,144,0.12),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.78),_rgba(246,241,232,0.96))]" />
          <div className="absolute left-[-7rem] top-20 h-56 w-56 rounded-full bg-[#dce7df] blur-3xl" />
          <div className="absolute right-[-8rem] top-12 h-72 w-72 rounded-full bg-[#eadfca] blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/82 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                <MessageSquare className="h-3.5 w-3.5" />
                {badgeLabel}
              </div>
              <h1 className="font-editorial mt-5 text-[3.3rem] leading-[0.95] tracking-[-0.05em] text-slate-950 sm:text-[4.35rem]">
                {heroTitle}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.05rem]">
                {heroBody}
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="grid gap-8 lg:grid-cols-[0.98fr_1.02fr]">
            <div className="rounded-[1.95rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]">
              <ContactForm />
            </div>

            <div className="space-y-4">
              {robotTeamCityMessaging ? (
                <article className="rounded-[1.85rem] border border-sky-200 bg-sky-50/88 p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                        {robotTeamCityMessaging.label}
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-slate-900">
                        {robotTeamCityMessaging.requestCardTitle}
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        {robotTeamCityMessaging.requestCardBody}
                      </p>
                      <ul className="mt-4 space-y-2 text-sm text-slate-700">
                        {robotTeamCityMessaging.requestCardPoints.map((point) => (
                          <li key={point} className="flex items-start gap-2">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ) : null}

              <article className="rounded-[1.85rem] border border-black/10 bg-slate-950 p-6 text-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.75)]">
                <SectionLabel>{responseTitle}</SectionLabel>
                <p className="mt-4 text-sm leading-7 text-white/76">{responseBody}</p>
                <ul className="mt-5 space-y-3 text-sm leading-7 text-white/78">
                  {afterInquiry.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/45" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                    Typical response cadence
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-white/76">
                    {responseCadence.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/45" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="rounded-[1.85rem] border border-black/10 bg-white/88 p-6 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]">
                <SectionLabel>Fastest Paths</SectionLabel>
                <div className="mt-4 space-y-3">
                  {fastPaths.map((path) => (
                    <a
                      key={path.href}
                      href={path.href}
                      className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
                    >
                      <p className="text-sm font-semibold text-slate-900">{path.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{path.detail}</p>
                    </a>
                  ))}
                </div>
                <a
                  href="mailto:hello@tryblueprint.io?subject=Blueprint%20brief"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-slate-700 hover:underline"
                >
                  <Mail className="h-4 w-4" />
                  Email a short brief to hello@tryblueprint.io
                </a>
              </article>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
