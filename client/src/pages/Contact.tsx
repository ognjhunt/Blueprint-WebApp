import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import {
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { analyticsEvents } from "@/lib/analytics";
import { normalizeInterestToLane } from "@/lib/contactInterest";
import { getDemandCityMessaging } from "@/lib/cityDemandMessaging";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import { ArrowRight, CheckCircle2, Mail, MessageSquare, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useSearch } from "wouter";

function cleanParam(value: string | null) {
  return String(value || "").trim();
}

export default function Contact() {
  const search = useSearch();
  const [location] = useLocation();
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
  const normalizedInterestLane = normalizeInterestToLane(interest);
  const hostedMode =
    normalizedInterestLane === "deeper_evaluation" && buyerType === "robot_team";
  const captureRequestMode = sourcePath === "request-capture" && buyerType === "robot_team";
  const persona =
    hostedMode || personaParam === "robot-team" || buyerType === "robot_team"
      ? "robot_team"
      : personaParam === "site-operator" ||
          buyerType === "site_operator" ||
          location === "/contact/site-operator"
        ? "site_operator"
        : "robot_team";
  const robotTeamCityMessaging = persona === "robot_team" ? cityMessaging : null;
  const requestedLane =
    normalizedInterestLane || (persona === "site_operator" ? "qualification" : "deeper_evaluation");

  const seoTitle = captureRequestMode
    ? "Request Capture | Blueprint"
    : hostedMode
    ? "Request Hosted Evaluation | Blueprint"
    : robotTeamCityMessaging
      ? `For ${robotTeamCityMessaging.shortLabel} Robot Teams | Blueprint`
      : persona === "site_operator"
        ? "For Site Operators | Blueprint"
        : "For Robot Teams | Blueprint";
  const seoDescription = captureRequestMode
    ? "Ask Blueprint to capture the exact site or workflow your robot team needs to evaluate."
    : hostedMode
    ? "Request a hosted robot-team evaluation for a site-specific world model."
    : robotTeamCityMessaging
      ? robotTeamCityMessaging.requestHeroBody
      : persona === "site_operator"
        ? "Talk to Blueprint about facility participation, access rules, and governance."
        : "Tell Blueprint which site, workflow, and robot setup your team wants to evaluate.";

  const badgeLabel = captureRequestMode
    ? "Request Capture"
    : hostedMode
    ? "Hosted Evaluation"
    : robotTeamCityMessaging
      ? `For Robot Teams • ${robotTeamCityMessaging.shortLabel}`
      : persona === "site_operator"
        ? "For Site Operators"
        : "For Robot Teams";
  const heroTitle = captureRequestMode
    ? "Tell us the site or workflow to capture."
    : hostedMode
    ? "Request a hosted evaluation for this site."
    : robotTeamCityMessaging
      ? robotTeamCityMessaging.requestHeroTitle
      : persona === "site_operator"
        ? "Submit or claim a site for robot evaluation."
        : "Tell us the site, task, and robot in a few lines.";
  const heroBody = captureRequestMode
    ? "Name the place, workflow, and robot question. Blueprint will confirm whether we can open a capture path, point you to an existing site package, or ask one narrow follow-up."
    : hostedMode
    ? "Confirm the site, the task, and the robot setup. Blueprint will use that to line up the right hosted evaluation path for your team."
      : robotTeamCityMessaging
      ? robotTeamCityMessaging.requestHeroBody
      : persona === "site_operator"
        ? "Start with the facility, access rules, and privacy boundaries. A call comes later only when private areas, rights, or commercialization need a human pass."
        : "Use this form if your team needs one exact site for evaluation, site-specific data, release comparison, or package access.";

  const responseBody = captureRequestMode
    ? "Fill out the short form and Blueprint will reply with the capture option, hosted evaluation path, or the one missing detail we need first."
    : hostedMode
    ? "Fill out the short form and Blueprint will follow up to confirm the site, robot setup, and the next step toward a hosted evaluation."
      : robotTeamCityMessaging
      ? robotTeamCityMessaging.requestResponseBody
      : persona === "site_operator"
        ? "Blueprint reviews the facility details, access rules, privacy notes, and commercialization preference first. A call is only the next step when those details are specific enough to resolve."
        : "Blueprint reviews the site, task, and robot details first. The reply points your team toward package access, hosted evaluation, or one concrete follow-up question.";

  const expectedNextStep =
    sourcePath === "request-capture"
      ? "Blueprint confirms the requested site, workflow, robot setup, and whether a capture path can be opened."
      : sourcePath === "hosted-evaluation"
      ? "Blueprint confirms the site, robot setup, requested outputs, and hosted-review scope."
      : sourcePath === "package-access"
        ? "Blueprint confirms rights, export scope, and package access for the requested site."
        : interest
          ? "Blueprint confirms whether the next step is package access, hosted evaluation, or a narrower follow-up."
          : "";

  const sourceAwareRows = [
    [
      "Path",
      sourcePath === "hosted-evaluation"
        ? "Hosted evaluation"
        : sourcePath === "request-capture"
          ? "Request capture"
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

  const fastPaths =
    persona === "site_operator"
      ? [
          {
            href: "/contact/site-operator",
            label: "Submit or claim a site",
            detail: "Best first step when you can name the facility, access rules, and privacy boundaries.",
          },
          {
            href: "/governance",
            label: "Review governance",
            detail: "Best when privacy, restricted zones, rights, or commercialization rules come first.",
          },
          {
            href: "/capture-app/launch-access?role=site_operator",
            label: "List a site for robot evaluation",
            detail: "Best when your facility or city is not in an active capture window yet.",
          },
        ]
      : [
          {
            href: "/product",
            label: "See product",
            detail: "Best when your team wants to understand world models, site packages, and hosted review before sharing site details.",
          },
          {
            href: "/world-models",
            label: "Inspect the sample listing",
            detail: "Best when your team wants to validate the proof style before any outreach.",
          },
          {
            href: "/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&path=hosted-evaluation&source=contact-fast-path",
            label: "Request site review",
            detail: "Best when the site is already known and a structured first reply would save time.",
          },
        ];
  const primaryActionLabel =
    captureRequestMode
      ? "Start capture request"
      : hostedMode
        ? "Request hosted evaluation"
        : persona === "site_operator"
          ? "Start site claim"
          : "Request site review";
  const proofPoints =
    persona === "site_operator"
      ? ["Facility first", "Access rules visible", "Call only when needed"]
      : ["Site, task, robot first", "Proof boundaries visible", "Call only when useful"];
  const formSummary =
    persona === "site_operator"
      ? "Required: contact details, facility, location, and access rules."
      : "Required: contact details, role, first question, and a site or site class.";

  const trackContactCta = (
    ctaId: string,
    ctaLabel: string,
    destination: string,
    sourceName: string,
  ) => {
    analyticsEvents.contactPageCtaClicked({
      persona,
      ctaId,
      ctaLabel,
      destination,
      source: sourceName,
      requestedLane,
    });
  };

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonical={persona === "site_operator" ? "/contact/site-operator" : "/contact"}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.scopingRoom}
            alt="Contact hero"
            className="min-h-[45rem] rounded-none sm:min-h-[38rem]"
            loading="eager"
            imageClassName="min-h-[45rem] sm:min-h-[38rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.72)_34%,rgba(255,255,255,0.2)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto h-full max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
                <div className="flex h-full max-w-[36rem] flex-col justify-end">
                <div className="inline-flex items-center gap-2 border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {badgeLabel}
                </div>
                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] sm:text-[5rem]">
                  {heroTitle}
                </h1>
                <p className="mt-6 text-base leading-8 text-slate-700">{heroBody}</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a
                    href="#contact-intake"
                    onClick={() =>
                      trackContactCta(
                        "contact_hero_start",
                        primaryActionLabel,
                        "#contact-intake",
                        "contact-hero",
                      )
                    }
                    className="inline-flex items-center justify-center bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {primaryActionLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href={persona === "site_operator" ? "/governance" : "/world-models"}
                    onClick={() =>
                      trackContactCta(
                        "contact_hero_proof",
                        persona === "site_operator" ? "Review governance" : "Inspect sample listing",
                        persona === "site_operator" ? "/governance" : "/world-models",
                        "contact-hero",
                      )
                    }
                    className="inline-flex items-center justify-center border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
                  >
                    {persona === "site_operator" ? "Review governance" : "Inspect sample listing"}
                  </a>
                </div>
                <div className="mt-6 grid max-w-[31rem] gap-2 sm:grid-cols-3">
                  {proofPoints.map((point) => (
                    <div key={point} className="flex items-center gap-2 bg-white/75 px-3 py-2 text-xs font-semibold text-slate-700">
                      <CheckCircle2 className="h-3.5 w-3.5 text-slate-950" />
                      {point}
                    </div>
                  ))}
                </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section id="contact-intake" className="mx-auto max-w-[88rem] scroll-mt-8 px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-[0.56fr_0.44fr]">
            <div className="border border-black/10 bg-white p-6 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.22)]">
              <div className="mb-6 border-b border-black/10 pb-5">
                <EditorialSectionLabel>Start here</EditorialSectionLabel>
                <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div>
                    <h2 className="font-editorial text-[2.45rem] leading-[0.95] tracking-[-0.05em] text-slate-950">
                      Tell us the site and the decision you need to make.
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                      {formSummary} We will reply with the available package path, hosted evaluation option, capture request, or the one missing detail we need.
                    </p>
                  </div>
                  <div className="border border-black/10 bg-[#f8f6f1] px-4 py-3 text-sm text-slate-700">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Cadence
                    </p>
                    <p className="mt-2 font-medium text-slate-950">Short form first. Call only when useful.</p>
                  </div>
                </div>
              </div>
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
                <p className="mt-4 text-sm leading-7 text-white/70">{responseBody}</p>
                <div className="mt-6 border-t border-white/10 pt-4 text-sm leading-7 text-white/70">
                  Rights, privacy, and proof boundaries stay explicit instead of being deferred into vague sales language.
                </div>
              </div>

              <div className="border border-black/10 bg-white p-6">
                <EditorialSectionLabel>Fastest Paths</EditorialSectionLabel>
                <div className="mt-4 space-y-3">
                  {fastPaths.map((path) => (
                    <a
                      key={path.href}
                      href={path.href}
                      onClick={() =>
                        trackContactCta(
                          `contact_fast_path_${path.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
                          path.label,
                          path.href,
                          "contact-fast-paths",
                        )
                      }
                      className="block border border-black/10 bg-[#f5f3ef] px-4 py-4 transition hover:bg-white"
                    >
                      <p className="font-medium text-slate-950">{path.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{path.detail}</p>
                    </a>
                  ))}
                </div>
                <a
                  href="mailto:hello@tryblueprint.io?subject=Blueprint%20site%20review"
                  onClick={() =>
                    trackContactCta(
                      "contact_email_brief",
                      "Email a site review request to hello@tryblueprint.io",
                      "mailto:hello@tryblueprint.io?subject=Blueprint%20site%20review",
                      "contact-fast-paths",
                    )
                  }
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-slate-700 hover:underline"
                >
                  <Mail className="h-4 w-4" />
                  Email a site review request to hello@tryblueprint.io
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
