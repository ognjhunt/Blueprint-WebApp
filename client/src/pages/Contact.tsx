import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import {
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { normalizeInterestToLane } from "@/lib/contactInterest";
import { getDemandCityMessaging } from "@/lib/cityDemandMessaging";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import { Mail, MessageSquare, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useSearch } from "wouter";

function cleanParam(value: string | null) {
  return String(value || "").trim();
}

export default function Contact() {
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const interest = cleanParam(searchParams.get("interest"));
  const buyerType = cleanParam(searchParams.get("buyerType"));
  const personaParam = cleanParam(searchParams.get("persona"));
  const sourcePath = cleanParam(searchParams.get("path"));
  const source = cleanParam(searchParams.get("source"));
  const siteName = cleanParam(searchParams.get("siteName"));
  const siteWorldId = cleanParam(searchParams.get("siteWorldId"));
  const siteLocation = cleanParam(searchParams.get("siteLocation"));
  const taskStatement = cleanParam(searchParams.get("taskStatement"));
  const targetRobotTeam = cleanParam(searchParams.get("targetRobotTeam"));
  const scenario = cleanParam(searchParams.get("scenario"));
  const requestedOutputs = cleanParam(searchParams.get("requestedOutputs"));
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
      ? robotTeamCityMessaging.requestHeroBody
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
        ? "Use this form if you run the facility and need to talk through capture access, privacy rules, or whether the site belongs in the catalog."
        : "Use this form if your team needs one exact site for evaluation, site-specific data, release comparison, or package access.";

  const responseBody = hostedMode
    ? "Fill out the short form and Blueprint will follow up to confirm the site, robot setup, and the next step toward a hosted evaluation."
      : robotTeamCityMessaging
      ? robotTeamCityMessaging.requestResponseBody
      : persona === "site_operator"
        ? "Blueprint reviews the facility details, access rules, and privacy notes first so the next reply can narrow the path quickly."
        : "Blueprint reviews the site, task, and robot details first. The reply points your team toward the package path, hosted evaluation path, or the follow-up question that actually matters.";

  const expectedNextStep =
    sourcePath === "hosted-evaluation"
      ? "Blueprint confirms the site, robot setup, requested outputs, and hosted-review scope."
      : sourcePath === "package-access"
        ? "Blueprint confirms rights, export scope, and package access for the requested site."
        : interest
          ? "Blueprint routes the request to the right package, hosted-review, or follow-up path."
          : "";

  const sourceAwareRows = [
    [
      "Path",
      sourcePath === "hosted-evaluation"
        ? "Hosted evaluation"
        : sourcePath === "package-access"
          ? "Package access"
          : interest
            ? (normalizeInterestToLane(interest) || interest).replaceAll("_", " ")
            : "",
    ],
    ["Site", siteName],
    ["Listing", siteWorldId],
    ["Location", siteLocation],
    ["Robot", targetRobotTeam],
    ["Task", taskStatement],
    ["Scenario", scenario],
    ["Outputs", requestedOutputs],
    ["Expected next step", expectedNextStep],
    ["Source", source],
  ].filter(([, value]) => Boolean(value));
  const hasSourceContext = sourceAwareRows.length > 0;

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
      href: "/world-models",
      label: "Inspect the sample listing",
      detail: "Best when your team wants to validate the proof style before any outreach.",
    },
  ];

  return (
    <>
      <SEO title={seoTitle} description={seoDescription} canonical="/contact" />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.scopingRoom}
            alt="Contact hero"
            className="min-h-[38rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[38rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.72)_34%,rgba(255,255,255,0.2)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto h-full max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
                <div className="flex h-full max-w-[36rem] flex-col justify-end">
                <div className="inline-flex items-center gap-2 border border-black/10 bg-white/82 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {badgeLabel}
                </div>
                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] sm:text-[5rem]">
                  {heroTitle}
                </h1>
                <p className="mt-6 text-base leading-8 text-slate-700">{heroBody}</p>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-[0.56fr_0.44fr]">
            <div className="border border-black/10 bg-white p-6 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.22)]">
              {hasSourceContext ? (
                <div className="mb-6 border border-black/10 bg-[#f8f6f1] p-5">
                  <EditorialSectionLabel>Request context</EditorialSectionLabel>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    This form is carrying the site and path you came from so the follow-up can
                    start with the right package or hosted-evaluation request.
                  </p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {sourceAwareRows.map(([label, value]) => (
                      <div key={label} className="border border-black/10 bg-white px-4 py-3 text-sm">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                        <p className="mt-2 text-slate-800">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <ContactForm />
            </div>
            <div className="space-y-4">
              {robotTeamCityMessaging ? (
                <div className="border border-black/10 bg-white p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black/10 bg-[#f5f3ef] text-slate-950">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        {robotTeamCityMessaging.label}
                      </p>
                      <h2 className="font-editorial mt-3 text-[2rem] leading-[0.95] tracking-[-0.04em] text-slate-950">
                        {robotTeamCityMessaging.requestCardTitle}
                      </h2>
                      <p className="mt-4 text-sm leading-7 text-slate-600">
                        {robotTeamCityMessaging.requestCardBody}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="bg-slate-950 p-6 text-white">
                <EditorialSectionLabel light>What happens after you send this</EditorialSectionLabel>
                <p className="mt-4 text-sm leading-7 text-white/72">{responseBody}</p>
                <div className="mt-6 border-t border-white/10 pt-4 text-sm leading-7 text-white/68">
                  Rights, privacy, and proof boundaries stay explicit instead of being deferred into vague sales language.
                </div>
              </div>

              <div className="border border-black/10 bg-white p-6">
                <EditorialSectionLabel>Fastest Paths</EditorialSectionLabel>
                <div className="mt-4 space-y-3">
                  {fastPaths.map((path) => (
                    <a key={path.href} href={path.href} className="block border border-black/10 bg-[#f5f3ef] px-4 py-4 transition hover:bg-white">
                      <p className="font-medium text-slate-950">{path.label}</p>
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
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
