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
import type { CommercialRequestPath } from "@/types/inbound-request";
import { ArrowRight, CheckCircle2, Mail, MessageSquare } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useSearch } from "wouter";

function cleanParam(value: string | null) {
  return String(value || "").trim();
}

function resolveCommercialRequestPath(params: {
  persona: "robot_team" | "site_operator";
  sourcePath: string;
  interest: string;
  hostedMode: boolean;
}): CommercialRequestPath {
  if (params.persona === "site_operator") return "site_claim";

  const sourcePath = params.sourcePath.toLowerCase();
  const interest = params.interest.toLowerCase();

  if (
    params.hostedMode ||
    sourcePath === "hosted-evaluation" ||
    interest === "hosted-evaluation" ||
    interest === "hosted-session"
  ) {
    return "hosted_evaluation";
  }

  if (
    sourcePath === "request-capture" ||
    sourcePath === "capture-access" ||
    interest === "capture-access"
  ) {
    return "capture_access";
  }

  return "world_model";
}

function resolveCommercialRequestPathFromDestination(
  destination: string,
  fallback: CommercialRequestPath,
): CommercialRequestPath {
  try {
    const url = new URL(destination, "https://tryblueprint.local");
    if (url.protocol === "mailto:") return fallback;

    const destinationInterest = cleanParam(url.searchParams.get("interest"));
    const destinationBuyerType = cleanParam(url.searchParams.get("buyerType"));
    const destinationPersona = cleanParam(url.searchParams.get("persona"));
    const destinationPath = cleanParam(url.searchParams.get("path"));

    if (
      !destinationInterest &&
      !destinationBuyerType &&
      !destinationPersona &&
      !destinationPath
    ) {
      return fallback;
    }

    const destinationHostedMode =
      destinationBuyerType === "robot_team" &&
      (destinationPath.toLowerCase() === "hosted-evaluation" ||
        destinationInterest.toLowerCase() === "hosted-evaluation" ||
        destinationInterest.toLowerCase() === "hosted-session");
    const resolvedPersona =
      destinationHostedMode ||
      destinationPersona === "robot-team" ||
      destinationBuyerType === "robot_team"
        ? "robot_team"
        : destinationPersona === "site-operator" || destinationBuyerType === "site_operator"
          ? "site_operator"
          : "robot_team";

    return resolveCommercialRequestPath({
      persona: resolvedPersona,
      sourcePath: destinationPath,
      interest: destinationInterest,
      hostedMode: destinationHostedMode,
    });
  } catch {
    return fallback;
  }
}

const contactRequestPathCopy: Record<
  CommercialRequestPath,
  {
    seoTitle: string;
    seoDescription: string;
    badgeLabel: string;
    heroTitle: string;
    heroBody: string;
    responseBody: string;
    primaryActionLabel: string;
    formSummary: string;
  }
> = {
  world_model: {
    seoTitle: "Request A World Model | Blueprint",
    seoDescription:
      "Ask Blueprint for a site-specific world model package, hosted evaluation path, or capture plan for your robot team.",
    badgeLabel: "Commercial Intake",
    heroTitle: "Request the site-specific world model your robot team needs.",
    heroBody:
      "Blueprint turns real-site capture into world-model packages and hosted evaluation paths for robot teams. Share the site, task, and robot context; the reply routes you toward package access, hosted evaluation, capture access, or one specific follow-up.",
    responseBody:
      "Blueprint reviews the buyer, site, task, and robot context first. The reply points your team toward package access, hosted evaluation, capture access, or a narrower follow-up without claiming access the backend has not proven.",
    primaryActionLabel: "Request world model",
    formSummary: "Required: contact details, role, request path, first question, and a site or site class.",
  },
  hosted_evaluation: {
    seoTitle: "Request Hosted Evaluation | Blueprint",
    seoDescription:
      "Request a hosted robot-team evaluation for a site-specific world model, subject to entitlement, proof, and runtime availability checks.",
    badgeLabel: "Hosted Evaluation",
    heroTitle: "Request a hosted evaluation for this site.",
    heroBody:
      "Confirm the site, task, and robot setup. Blueprint uses that to scope the hosted evaluation path and only confirms live availability after entitlement, proof, and runtime checks support it.",
    responseBody:
      "Blueprint reviews the site, robot setup, requested outputs, entitlement path, and hosted-session readiness before confirming whether a hosted evaluation can move forward.",
    primaryActionLabel: "Request hosted evaluation",
    formSummary: "Required: contact details, role, request path, hosted question, and the site or site class.",
  },
  capture_access: {
    seoTitle: "Request Capture Access | Blueprint",
    seoDescription:
      "Ask Blueprint to review capture access for a real site or workflow your robot team wants packaged into world-model outputs.",
    badgeLabel: "Capture Access",
    heroTitle: "Ask Blueprint to capture the site or workflow your team needs.",
    heroBody:
      "Name the place, workflow, and robot question. Blueprint will confirm whether a capture path can be opened, whether an existing package fits first, or which access detail is missing.",
    responseBody:
      "Blueprint reviews the requested site, workflow, access path, and robot need first. The reply confirms whether the next move is capture review, an existing package, hosted evaluation, or a specific blocker.",
    primaryActionLabel: "Request capture access",
    formSummary: "Required: contact details, role, request path, capture question, and a site or site class.",
  },
  site_claim: {
    seoTitle: "For Site Operators | Blueprint",
    seoDescription:
      "Talk to Blueprint about facility participation, access rules, privacy boundaries, and governance.",
    badgeLabel: "For Site Operators",
    heroTitle: "Submit or claim a site for robot evaluation.",
    heroBody:
      "Start with the facility, access rules, and privacy boundaries. A call comes later only when private areas, rights, or commercialization need a human pass.",
    responseBody:
      "Blueprint reviews the facility details, access rules, privacy notes, and commercialization preference first. A call is only the next step when those details are specific enough to resolve.",
    primaryActionLabel: "Start site claim",
    formSummary: "Required: contact details, facility, location, and access rules.",
  },
};

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
    buyerType === "robot_team" &&
    (sourcePath.toLowerCase() === "hosted-evaluation" ||
      interest.toLowerCase() === "hosted-evaluation" ||
      interest.toLowerCase() === "hosted-session");
  const persona =
    hostedMode || personaParam === "robot-team" || buyerType === "robot_team"
      ? "robot_team"
      : personaParam === "site-operator" ||
          buyerType === "site_operator" ||
          location === "/contact/site-operator"
        ? "site_operator"
        : "robot_team";
  const commercialRequestPath = resolveCommercialRequestPath({
    persona,
    sourcePath,
    interest,
    hostedMode,
  });
  const requestPathCopy = contactRequestPathCopy[commercialRequestPath];
  const robotTeamCityMessaging = persona === "robot_team" ? cityMessaging : null;
  const requestedLane =
    normalizedInterestLane || (persona === "site_operator" ? "qualification" : "deeper_evaluation");

  const seoTitle = robotTeamCityMessaging
    ? `For ${robotTeamCityMessaging.shortLabel} Robot Teams | Blueprint`
    : requestPathCopy.seoTitle;
  const seoDescription = robotTeamCityMessaging
    ? robotTeamCityMessaging.requestHeroBody
    : requestPathCopy.seoDescription;

  const badgeLabel = robotTeamCityMessaging
    ? `For Robot Teams • ${robotTeamCityMessaging.shortLabel}`
    : requestPathCopy.badgeLabel;
  const heroTitle = robotTeamCityMessaging
    ? robotTeamCityMessaging.requestHeroTitle
    : requestPathCopy.heroTitle;
  const heroBody = robotTeamCityMessaging
    ? robotTeamCityMessaging.requestHeroBody
    : requestPathCopy.heroBody;

  const responseBody = robotTeamCityMessaging
    ? robotTeamCityMessaging.requestResponseBody
    : requestPathCopy.responseBody;

  const expectedNextStep =
    sourcePath === "world-model"
      ? "Blueprint confirms the site, task, robot setup, and whether the first move is package access, hosted evaluation, or capture access."
      : sourcePath === "request-capture" || sourcePath === "capture-access"
      ? "Blueprint confirms the requested site, workflow, robot setup, and whether a capture path can be opened."
      : sourcePath === "hosted-evaluation"
      ? "Blueprint confirms the site, robot setup, requested outputs, and hosted-evaluation scope."
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
          ? "Capture access"
        : sourcePath === "capture-access"
          ? "Capture access"
        : sourcePath === "world-model"
          ? "World model"
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
            href: "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=contact-fast-path",
            label: "Request world model",
            detail: "Best when your team wants a site-specific package path for a concrete deployment or evaluation question.",
          },
          {
            href: "/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=contact-fast-path",
            label: "Request hosted evaluation",
            detail: "Best when the site is known and a hosted review could shorten technical evaluation.",
          },
          {
            href: "/contact?persona=robot-team&buyerType=robot_team&interest=capture-access&path=request-capture&source=contact-fast-path",
            label: "Request capture access",
            detail: "Best when your team needs Blueprint to review a new site or workflow before package work exists.",
          },
        ];
  const primaryActionLabel = requestPathCopy.primaryActionLabel;
  const proofPoints =
    persona === "site_operator"
      ? ["Facility first", "Access rules visible", "Call only when needed"]
      : ["Request path first", "Proof boundaries visible", "Call only when useful"];
  const formSummary = requestPathCopy.formSummary;

  const trackContactCta = (
    ctaId: string,
    ctaLabel: string,
    destination: string,
    sourceName: string,
  ) => {
    const destinationRequestPath = resolveCommercialRequestPathFromDestination(
      destination,
      commercialRequestPath,
    );
    analyticsEvents.contactPageCtaClicked({
      persona,
      ctaId,
      ctaLabel,
      destination,
      source: sourceName,
      requestedLane,
      commercialRequestPath: destinationRequestPath,
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
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.68)_36%,rgba(0,0,0,0.18)_82%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto h-full max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
                <div className="flex h-full max-w-[36rem] flex-col justify-end text-white">
                <div className="inline-flex items-center gap-2 border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {badgeLabel}
                </div>
                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] text-white sm:text-[5rem]">
                  {heroTitle}
                </h1>
                <p className="mt-6 text-base leading-8 text-white/82">{heroBody}</p>
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
                    className="inline-flex items-center justify-center bg-[#c7a775] px-5 py-3 text-sm font-semibold text-[#0d0d0b] transition hover:bg-[#d8bd8d]"
                  >
                    {primaryActionLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href={persona === "site_operator" ? "/governance" : "/world-models"}
                    onClick={() =>
                      trackContactCta(
                        "contact_hero_proof",
                        persona === "site_operator" ? "Review governance" : "Browse world models",
                        persona === "site_operator" ? "/governance" : "/world-models",
                        "contact-hero",
                      )
                    }
                    className="inline-flex items-center justify-center border border-white/15 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
                  >
                    {persona === "site_operator" ? "Review governance" : "Browse world models"}
                  </a>
                </div>
                <div className="mt-6 grid max-w-[31rem] gap-2 sm:grid-cols-3">
                  {proofPoints.map((point) => (
                    <div key={point} className="flex items-center gap-2 bg-black/45 px-3 py-2 text-xs font-semibold text-white/80">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#c7a775]" />
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
                      <MessageSquare className="h-5 w-5" />
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
