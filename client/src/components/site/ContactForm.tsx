import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowRight, Calendar, CheckCircle2, Clock, Mail } from "lucide-react";
import { analyticsEvents, getSafeErrorType } from "@/lib/analytics";
import { withCsrfHeader } from "@/lib/csrf";
import {
  PlaceAutocompleteInput,
  resolvePlaceLocationMetadata,
} from "@/components/site/PlaceAutocompleteInput";
import {
  getDemandAttributionFromSearchParams,
  hasDemandAttribution,
} from "@/lib/demandAttribution";
import {
  defaultProofPathPreferenceForRequestPath,
  parseContactRequestPrefill,
  requestPathToCommercialRequestPath,
} from "@/lib/contactRequestPrefill";
import { useAuth } from "@/contexts/AuthContext";
import type {
  BuyerType,
  CommercialRequestPath,
  InboundRequestPayload,
  PlaceLocationMetadata,
  ProofPathPreference,
  RealSiteRobotEvalFitInput,
  RequestedLane,
  SubmitInboundRequestResponse,
} from "@/types/inbound-request";

type Persona = "robot_team" | "site_operator";

const inputClassName =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";
const textareaClassName =
  "min-h-24 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";
const labelClassName = "mb-1.5 block text-sm font-semibold text-slate-800";
const helperClassName = "mt-1.5 text-xs leading-5 text-slate-500";

const policyAccessMethods = [
  "Policy API endpoint",
  "Docker container",
  "Model checkpoint",
  "Recorded action trace",
  "High-level skill trace",
  "Teleop demo",
  "Sim controller plugin",
  "Assisted review",
  "Not sure yet",
];

const siteAccessBoundaryOptions = [
  {
    value: "Private review only",
    description: "Blueprint reviews the site privately before any buyer visibility.",
    captureRights:
      "Private review only; no marketplace listing or robot-team access without explicit operator approval.",
    derivedScenePermission:
      "No marketplace or robot-team use without explicit operator approval.",
  },
  {
    value: "Anonymized marketplace use",
    description: "Anonymized site/task use can be reviewed for marketplace fit.",
    captureRights:
      "Operator is open to anonymized marketplace use after Blueprint review.",
    derivedScenePermission:
      "Anonymized marketplace use allowed only after review and agreed terms.",
  },
  {
    value: "Ask before each robot-team use",
    description: "Blueprint must confirm approval before every robot-team use.",
    captureRights:
      "Ask before each robot-team use; approval is required per use.",
    derivedScenePermission:
      "Per-use operator approval required before robot-team access.",
  },
  {
    value: "Not sure yet",
    description: "Use this when the boundary needs a follow-up review.",
    captureRights:
      "Access boundary requires follow-up before listing or robot-team use.",
    derivedScenePermission:
      "Commercial use is undecided and requires follow-up before access changes.",
  },
] as const;

function RequiredMark() {
  return (
    <span className="ml-1 text-slate-500" aria-hidden="true">
      *
    </span>
  );
}

function clean(value: unknown): string {
  return String(value || "").trim();
}

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const randomValue = (Math.random() * 16) | 0;
    const resolved = character === "x" ? randomValue : (randomValue & 0x3) | 0x8;
    return resolved.toString(16);
  });
}

function getReferrer(): string | null {
  if (typeof document === "undefined") return null;
  return document.referrer || null;
}

function getPersonaFromSearch(
  routePath: string,
  personaParam: string,
  buyerTypeParam: string,
  prefillBuyerType: BuyerType,
): Persona {
  if (routePath === "/contact/site-operator") return "site_operator";
  if (personaParam === "site-operator") return "site_operator";
  if (buyerTypeParam === "site_operator") return "site_operator";
  if (prefillBuyerType === "site_operator") return "site_operator";
  return "robot_team";
}

function siteBoundaryFor(value: string) {
  return siteAccessBoundaryOptions.find((option) => option.value === value);
}

function hasRobotEvalFitText(value: RealSiteRobotEvalFitInput): boolean {
  return [
    value.siteCardInput?.siteType,
    value.taskCardInput?.task,
    value.taskCardInput?.requiredMetrics,
    value.scenarioCardInput?.normalScenario,
    value.evalCardInput?.robotOrPolicyTested,
    value.evalCardInput?.preferredReviewPath,
    value.evalCardInput?.resultsValidationExpectations,
  ].some((entry) => clean(entry));
}

function buildRouteDetails(prefill: ReturnType<typeof parseContactRequestPrefill>): string {
  return [
    prefill.scenario ? `Scenario: ${prefill.scenario}` : "",
    prefill.requestedOutputs ? `Requested outputs: ${prefill.requestedOutputs}` : "",
    prefill.episodeCount ? `Episode count: ${prefill.episodeCount}` : "",
    prefill.validationMode ? `Validation mode: ${prefill.validationMode}` : "",
    prefill.message ? `Message: ${prefill.message}` : "",
  ].filter(Boolean).join("\n");
}

function successCopy(commercialRequestPath: CommercialRequestPath) {
  if (commercialRequestPath === "site_claim") {
    return {
      title: "Site submission received",
      body:
        "Blueprint has the facility, location, and access boundary needed for a free site review.",
      next:
        "Blueprint reviews the site and boundary, then confirms what can be captured, listed, or shared with robot teams.",
    };
  }

  if (commercialRequestPath === "world_model") {
    return {
      title: "Policy Improvement Run request received",
      body:
        "Blueprint has the site, task, robot, policy, threshold, and access context needed to recommend an improvement scope and proof boundary.",
      next:
        "Blueprint reviews baseline fit, policy access method, candidate scope, test plan, rights posture, export format, and pricing before improvement work starts.",
    };
  }

  if (commercialRequestPath === "capture_access") {
    return {
      title: "Capture access request received",
      body:
        "Blueprint has the site or workflow target needed to review whether a new capture path should open.",
      next:
        "Blueprint checks access, rights/privacy posture, capture feasibility, and existing site-package coverage before recommending the next step.",
    };
  }

  return {
    title: "Policy Evaluation Run request received",
    body:
      "Blueprint has the site, task, policy, episode count, and validation context needed to recommend a scoped evaluation path.",
    next:
      "Blueprint reviews site/task fit, recommends episode count and validation mode, then confirms access and pricing terms before execution.",
  };
}

export function ContactForm() {
  const { currentUser, userData } = useAuth();
  const search = useSearch();
  const [location] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const requestPrefill = useMemo(
    () => parseContactRequestPrefill(searchParams, location),
    [location, searchParams],
  );
  const interest = searchParams.get("interest")?.trim() ?? "";
  const buyerTypeParam = searchParams.get("buyerType")?.trim() ?? "";
  const personaParam = searchParams.get("persona")?.trim() ?? "";
  const persona = getPersonaFromSearch(
    location,
    personaParam,
    buyerTypeParam,
    requestPrefill.buyerType,
  );
  const buyerType: BuyerType = persona;
  const isDataPackageRequest =
    persona === "robot_team" && requestPrefill.requestPath === "data-package";
  const commercialRequestPath: CommercialRequestPath =
    persona === "site_operator"
      ? "site_claim"
      : requestPrefill.requestPath === "hosted-review"
        ? "hosted_evaluation"
        : requestPathToCommercialRequestPath(requestPrefill.requestPath);
  const requestedLanes: RequestedLane[] =
    persona === "site_operator"
      ? ["qualification"]
      : isDataPackageRequest
        ? ["data_licensing"]
        : ["deeper_evaluation"];
  const requestedLane = requestedLanes[0];
  const proofPathPreference: ProofPathPreference =
    persona === "robot_team"
      ? "exact_site_required"
      : defaultProofPathPreferenceForRequestPath(requestPrefill.requestPath);
  const searchDemandAttribution = useMemo(
    () => getDemandAttributionFromSearchParams(searchParams),
    [searchParams],
  );
  const analyticsDemandAttribution = hasDemandAttribution(searchDemandAttribution)
    ? searchDemandAttribution
    : undefined;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [siteLocationMetadata, setSiteLocationMetadata] =
    useState<PlaceLocationMetadata | null>(null);
  const [targetSiteType, setTargetSiteType] = useState("");
  const [taskStatement, setTaskStatement] = useState("");
  const [targetRobotTeam, setTargetRobotTeam] = useState("");
  const [policyLabels, setPolicyLabels] = useState("");
  const [policyAccessMethod, setPolicyAccessMethod] = useState("");
  const [scenarioCount, setScenarioCount] = useState("");
  const [episodeCount, setEpisodeCount] = useState("");
  const [validationMode, setValidationMode] = useState("");
  const [observationSchema, setObservationSchema] = useState("");
  const [actionSchema, setActionSchema] = useState("");
  const [controlFrequency, setControlFrequency] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [accessBoundary, setAccessBoundary] = useState("");
  const [privacySecurityConstraints, setPrivacySecurityConstraints] = useState("");
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    const displayName = userData?.name || currentUser?.displayName || "";
    const trimmedName = displayName.trim();
    const [defaultFirstName, ...restName] = trimmedName ? trimmedName.split(/\s+/) : [];
    const fit = requestPrefill.realSiteRobotEvalFit;
    const routeDetails = buildRouteDetails(requestPrefill);

    if (!firstName && defaultFirstName) setFirstName(defaultFirstName);
    if (!lastName && restName.length > 0) setLastName(restName.join(" "));
    if (!company && (userData?.company || userData?.organizationName)) {
      setCompany(userData.company || userData.organizationName || "");
    }
    if (!email && currentUser?.email) setEmail(currentUser.email);
    if (!siteLocation && (requestPrefill.siteLocation || userData?.siteLocation)) {
      const defaultSiteLocation = requestPrefill.siteLocation || userData?.siteLocation || "";
      setSiteLocation(defaultSiteLocation);
      setSiteLocationMetadata(
        userData?.siteLocationMetadata || {
          source: "manual",
          formattedAddress: defaultSiteLocation,
        },
      );
    }
    if (!siteName) {
      const defaultSiteName =
        requestPrefill.siteName ||
        (persona === "robot_team" ? requestPrefill.targetSiteType || requestPrefill.siteLocation : "") ||
        userData?.siteName ||
        "";
      if (defaultSiteName) setSiteName(defaultSiteName);
    }
    if (!targetSiteType && requestPrefill.targetSiteType) {
      setTargetSiteType(requestPrefill.targetSiteType);
    }
    if (!taskStatement && (requestPrefill.taskStatement || requestPrefill.workflow || fit?.taskCardInput?.task)) {
      setTaskStatement(
        requestPrefill.taskStatement ||
          requestPrefill.workflow ||
          fit?.taskCardInput?.task ||
          "",
      );
    }
    if (!targetRobotTeam && (requestPrefill.targetRobotTeam || fit?.evalCardInput?.robotOrPolicyTested)) {
      setTargetRobotTeam(
        requestPrefill.targetRobotTeam || fit?.evalCardInput?.robotOrPolicyTested || "",
      );
    }
    if (!policyAccessMethod && fit?.evalCardInput?.preferredReviewPath) {
      setPolicyAccessMethod(fit.evalCardInput.preferredReviewPath);
    }
    if (!episodeCount && requestPrefill.episodeCount) {
      setEpisodeCount(requestPrefill.episodeCount);
      setShowOptionalDetails(true);
    }
    if (!validationMode && requestPrefill.validationMode) {
      setValidationMode(requestPrefill.validationMode);
      setShowOptionalDetails(true);
    }
    if (!notes && routeDetails) {
      setNotes(routeDetails);
      setShowOptionalDetails(true);
    }
    if (!accessBoundary && userData?.operatingConstraints) {
      setAccessBoundary(userData.operatingConstraints);
    }
    if (!privacySecurityConstraints && userData?.privacySecurityConstraints) {
      setPrivacySecurityConstraints(userData.privacySecurityConstraints);
    }
  }, [
    accessBoundary,
    company,
    currentUser,
    email,
    episodeCount,
    firstName,
    lastName,
    notes,
    persona,
    policyAccessMethod,
    privacySecurityConstraints,
    requestPrefill,
    siteLocation,
    siteName,
    targetRobotTeam,
    targetSiteType,
    taskStatement,
    userData,
    validationMode,
  ]);

  useEffect(() => {
    analyticsEvents.contactRequestStarted({
      persona,
      hostedMode: commercialRequestPath === "hosted_evaluation",
      requestedLane,
      commercialRequestPath,
      authenticated: Boolean(currentUser?.uid),
      prefilledSiteContext: Boolean(requestPrefill.siteName || requestPrefill.siteLocation),
      ...(analyticsDemandAttribution
        ? { demandAttribution: analyticsDemandAttribution }
        : {}),
    });
    // Baseline start event should fire once per form visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const missingFields: string[] = [];
    if (!firstName.trim()) missingFields.push("First name");
    if (!company.trim()) missingFields.push(persona === "site_operator" ? "Company / operator" : "Company");
    if (!email.trim()) missingFields.push("Work email");
    if (persona === "robot_team") {
      if (!siteName.trim() && !targetSiteType.trim()) missingFields.push("Target site or site type");
      if (!taskStatement.trim()) missingFields.push("Task + threshold");
    } else {
      if (!siteName.trim()) missingFields.push("Facility name or site type");
      if (!siteLocation.trim()) missingFields.push("City / location");
      if (!accessBoundary.trim()) missingFields.push("Access boundaries");
    }

    if (missingFields.length > 0) {
      analyticsEvents.contactRequestFailed({
        stage: "validation",
        errorType: "missing_required_fields",
        persona,
        hostedMode: commercialRequestPath === "hosted_evaluation",
        requestedLane,
        commercialRequestPath,
        ...(analyticsDemandAttribution
          ? { demandAttribution: analyticsDemandAttribution }
          : {}),
      });
      setStatus("error");
      setMessage(`Please add: ${missingFields.join(", ")}.`);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      analyticsEvents.contactRequestFailed({
        stage: "validation",
        errorType: "invalid_email",
        persona,
        hostedMode: commercialRequestPath === "hosted_evaluation",
        requestedLane,
        commercialRequestPath,
        ...(analyticsDemandAttribution
          ? { demandAttribution: analyticsDemandAttribution }
          : {}),
      });
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    const optionalDetails = [
      policyLabels.trim() ? `Policy/checkpoint labels: ${policyLabels.trim()}` : "",
      policyAccessMethod.trim() ? `Policy access method: ${policyAccessMethod.trim()}` : "",
      scenarioCount.trim() ? `Scenario count: ${scenarioCount.trim()}` : "",
      episodeCount.trim() ? `Episode count: ${episodeCount.trim()}` : "",
      validationMode.trim() ? `Validation mode: ${validationMode.trim()}` : "",
      observationSchema.trim() ? `Observation schema: ${observationSchema.trim()}` : "",
      actionSchema.trim() ? `Action schema: ${actionSchema.trim()}` : "",
      controlFrequency.trim() ? `Control frequency: ${controlFrequency.trim()}` : "",
      deadline.trim() ? `Deadline: ${deadline.trim()}` : "",
      notes.trim() ? `Notes: ${notes.trim()}` : "",
    ].filter(Boolean).join("\n");
    const siteBoundary = siteBoundaryFor(accessBoundary);
    const siteTaskStatement =
      `Site operator claim for ${siteName.trim()}. Access boundary: ${accessBoundary.trim()}.`;
    const robotEvalFit: RealSiteRobotEvalFitInput = {
      siteCardInput: {
        siteType: targetSiteType.trim() || siteName.trim(),
      },
      taskCardInput: {
        task: taskStatement.trim(),
        requiredMetrics: taskStatement.trim(),
      },
      scenarioCardInput: {
        normalScenario: episodeCount.trim()
          ? `${episodeCount.trim()} requested policy-evaluation episodes`
          : scenarioCount.trim()
            ? `${scenarioCount.trim()} requested scenarios`
            : "",
      },
      evalCardInput: {
        robotOrPolicyTested: targetRobotTeam.trim(),
        preferredReviewPath: policyAccessMethod.trim(),
        resultsValidationExpectations: optionalDetails,
      },
    };
    const requestId = generateRequestId();
    const payload: InboundRequestPayload = {
      requestId,
      firstName: firstName.trim(),
      lastName: lastName.trim() || "Not provided",
      company: company.trim(),
      roleTitle: persona === "site_operator" ? "Site operator" : "Robot team",
      email: email.trim().toLowerCase(),
      budgetBucket: "Undecided/Unsure",
      requestedLanes,
      buyerType,
      commercialRequestPath,
      siteName: siteName.trim(),
      siteLocation: siteLocation.trim(),
      siteLocationMetadata: resolvePlaceLocationMetadata(siteLocation, siteLocationMetadata),
      taskStatement: persona === "robot_team" ? taskStatement.trim() : siteTaskStatement,
      targetSiteType: targetSiteType.trim() || siteName.trim() || undefined,
      proofPathPreference,
      operatingConstraints: persona === "site_operator" ? accessBoundary.trim() : undefined,
      captureRights:
        persona === "site_operator" ? siteBoundary?.captureRights || undefined : undefined,
      privacySecurityConstraints:
        persona === "site_operator" ? privacySecurityConstraints.trim() || undefined : undefined,
      targetRobotTeam: persona === "robot_team" ? targetRobotTeam.trim() || undefined : undefined,
      derivedScenePermission:
        persona === "site_operator"
          ? siteBoundary?.derivedScenePermission || undefined
          : undefined,
      realSiteRobotEvalFit:
        persona === "robot_team" && hasRobotEvalFitText(robotEvalFit)
          ? robotEvalFit
          : undefined,
      details:
        persona === "robot_team"
          ? optionalDetails || undefined
          : privacySecurityConstraints.trim() || undefined,
      context: {
        sourcePageUrl: typeof window !== "undefined" ? window.location.href : "",
        referrer: getReferrer() || undefined,
        demandCity: searchDemandAttribution.demandCity,
        buyerChannelSource: searchDemandAttribution.buyerChannelSource,
        buyerChannelSourceCaptureMode:
          searchDemandAttribution.buyerChannelSourceCaptureMode,
        buyerChannelSourceRaw: searchDemandAttribution.buyerChannelSourceRaw,
        utm: searchDemandAttribution.utm,
        timezoneOffset: new Date().getTimezoneOffset(),
        locale: typeof navigator !== "undefined" ? navigator.language : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      },
      honeypot: honeypot || undefined,
    };

    setStatus("loading");
    setMessage("");
    analyticsEvents.contactRequestSubmitted({
      persona,
      hostedMode: commercialRequestPath === "hosted_evaluation",
      requestedLane,
      commercialRequestPath,
      authenticated: Boolean(currentUser?.uid),
      hasJobTitle: false,
      hasSiteName: Boolean(siteName.trim()),
      hasSiteLocation: Boolean(siteLocation.trim()),
      hasTaskStatement: Boolean(payload.taskStatement?.trim()),
      hasOperatingConstraints: Boolean(payload.operatingConstraints?.trim()),
      hasPrivacySecurityConstraints: Boolean(payload.privacySecurityConstraints?.trim()),
      hasNotes: Boolean(payload.details?.trim()),
      ...(analyticsDemandAttribution
        ? { demandAttribution: analyticsDemandAttribution }
        : {}),
    });

    try {
      const response = await fetch("/api/inbound-request", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      const json: SubmitInboundRequestResponse = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.message || "Failed to submit intake");
      }

      setSubmittedRequestId(json.siteSubmissionId || json.requestId);
      setStatus("success");
      analyticsEvents.contactRequestCompleted({
        persona,
        hostedMode: commercialRequestPath === "hosted_evaluation",
        requestedLane,
        commercialRequestPath,
        authenticated: Boolean(currentUser?.uid),
        ...(analyticsDemandAttribution
          ? { demandAttribution: analyticsDemandAttribution }
          : {}),
      });
    } catch (error) {
      analyticsEvents.contactRequestFailed({
        stage: "submission",
        errorType: getSafeErrorType(error),
        persona,
        hostedMode: commercialRequestPath === "hosted_evaluation",
        requestedLane,
        commercialRequestPath,
        ...(analyticsDemandAttribution
          ? { demandAttribution: analyticsDemandAttribution }
          : {}),
      });
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to submit intake. Please try again.",
      );
    }
  };

  if (status === "success") {
    const copy = successCopy(commercialRequestPath);

    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm md:p-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900">{copy.title}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-zinc-600">{copy.body}</p>
        <div className="mx-auto mt-8 max-w-2xl rounded-xl bg-zinc-50 p-6 text-left">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">
            What happens next?
          </h3>
          <div className="space-y-3 text-sm text-zinc-600">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-indigo-100 p-1 text-indigo-600">
                <Clock className="h-3 w-3" />
              </div>
              <p>{copy.next}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-indigo-100 p-1 text-indigo-600">
                <Mail className="h-3 w-3" />
              </div>
              <p>You get a request-specific follow-up, not an instant entitlement.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-indigo-100 p-1 text-indigo-600">
                <Calendar className="h-3 w-3" />
              </div>
              <p>Any access, rights, pricing, or hosted execution step is confirmed before it starts.</p>
            </div>
          </div>
        </div>
        {submittedRequestId ? (
          <p className="mt-6 text-xs uppercase tracking-[0.18em] text-zinc-400">
            Submission ID: {submittedRequestId}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form id="contact-form" className="space-y-6" onSubmit={handleSubmit} noValidate>
      {persona === "robot_team" ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="contact-first-name" className={labelClassName}>
                First name
                <RequiredMark />
              </label>
              <input
                id="contact-first-name"
                className={inputClassName}
                placeholder="First name*"
                autoComplete="given-name"
                aria-required="true"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="contact-email" className={labelClassName}>
                Work email
                <RequiredMark />
              </label>
              <input
                id="contact-email"
                type="email"
                className={inputClassName}
                placeholder="Work email*"
                autoComplete="email"
                aria-required="true"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="contact-company" className={labelClassName}>
                Company
                <RequiredMark />
              </label>
              <input
                id="contact-company"
                className={inputClassName}
                placeholder="Company*"
                autoComplete="organization"
                aria-required="true"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="contact-robot-policy" className={labelClassName}>
                Robot / policy name
              </label>
              <input
                id="contact-robot-policy"
                className={inputClassName}
                placeholder="Robot platform, stack, or policy name"
                value={targetRobotTeam}
                onChange={(event) => setTargetRobotTeam(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="contact-site-name" className={labelClassName}>
                Target site or site type
                <RequiredMark />
              </label>
              <input
                id="contact-site-name"
                className={inputClassName}
                placeholder="Exact facility, city, warehouse, lab, hotel"
                aria-required="true"
                value={siteName}
                onChange={(event) => setSiteName(event.target.value)}
              />
              <p className={helperClassName}>Use a real place if known; a site class is fine for first pass.</p>
            </div>
          </div>

          <div>
            <label htmlFor="contact-task" className={labelClassName}>
              Task + threshold
              <RequiredMark />
            </label>
            <textarea
              id="contact-task"
              className={textareaClassName}
              placeholder="Example: Tote transfer in a warehouse. Need a clear winner before field time."
              aria-required="true"
              value={taskStatement}
              onChange={(event) => setTaskStatement(event.target.value)}
            />
            <p className={helperClassName}>One concrete task and threshold is enough for the first pass.</p>
          </div>

          <div className="border-t border-black/10 pt-5">
            <button
              type="button"
              className="inline-flex w-full items-center justify-between border border-black/10 bg-[#f8f6f1] px-4 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-white"
              aria-expanded={showOptionalDetails}
              onClick={() => setShowOptionalDetails((current) => !current)}
            >
              <span>{showOptionalDetails ? "Hide optional details" : "Add optional details"}</span>
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Optional
              </span>
            </button>
          </div>

          {showOptionalDetails ? (
            <div className="grid gap-4 border-t border-black/10 pt-5 md:grid-cols-2">
              <div>
                <label htmlFor="contact-policy-labels" className={labelClassName}>
                  Policy / checkpoint labels
                </label>
                <input
                  id="contact-policy-labels"
                  className={inputClassName}
                  placeholder="policy_v1, policy_v2"
                  value={policyLabels}
                  onChange={(event) => setPolicyLabels(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contact-policy-access-method" className={labelClassName}>
                  Preferred policy access method
                </label>
                <select
                  id="contact-policy-access-method"
                  className={inputClassName}
                  value={policyAccessMethod}
                  onChange={(event) => setPolicyAccessMethod(event.target.value)}
                >
                  <option value="">Not selected</option>
                  {policyAccessMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="contact-episode-count" className={labelClassName}>
                  Episode count
                </label>
                <input
                  id="contact-episode-count"
                  className={inputClassName}
                  placeholder="100, 500, or custom"
                  value={episodeCount}
                  onChange={(event) => setEpisodeCount(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contact-validation-mode" className={labelClassName}>
                  Validation mode
                </label>
                <select
                  id="contact-validation-mode"
                  className={inputClassName}
                  value={validationMode}
                  onChange={(event) => setValidationMode(event.target.value)}
                >
                  <option value="">Not selected</option>
                  <option value="Virtual preflight">Virtual preflight</option>
                  <option value="Comparative policy eval">Comparative policy eval</option>
                  <option value="Real rollout validated">Real rollout validated</option>
                </select>
              </div>
              <div>
                <label htmlFor="contact-observation-schema" className={labelClassName}>
                  Observation schema
                </label>
                <input
                  id="contact-observation-schema"
                  className={inputClassName}
                  placeholder="RGB-D, robot state, task instruction"
                  value={observationSchema}
                  onChange={(event) => setObservationSchema(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contact-action-schema" className={labelClassName}>
                  Action schema
                </label>
                <input
                  id="contact-action-schema"
                  className={inputClassName}
                  placeholder="base, arm, gripper"
                  value={actionSchema}
                  onChange={(event) => setActionSchema(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contact-control-frequency" className={labelClassName}>
                  Control frequency
                </label>
                <input
                  id="contact-control-frequency"
                  className={inputClassName}
                  placeholder="20 Hz"
                  value={controlFrequency}
                  onChange={(event) => setControlFrequency(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contact-scenario-count" className={labelClassName}>
                  Scenario count
                </label>
                <input
                  id="contact-scenario-count"
                  className={inputClassName}
                  placeholder="Example: 50 normal, 25 edge cases"
                  value={scenarioCount}
                  onChange={(event) => setScenarioCount(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contact-deadline" className={labelClassName}>
                  Deadline
                </label>
                <input
                  id="contact-deadline"
                  className={inputClassName}
                  placeholder="Example: scoping answer by June 20"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contact-notes" className={labelClassName}>
                  Notes
                </label>
                <textarea
                  id="contact-notes"
                  className={textareaClassName}
                  placeholder="Additional context, constraints, integrations, or proof expectations."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="contact-first-name" className={labelClassName}>
                First name
                <RequiredMark />
              </label>
              <input
                id="contact-first-name"
                className={inputClassName}
                placeholder="First name*"
                autoComplete="given-name"
                aria-required="true"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="contact-email" className={labelClassName}>
                Work email
                <RequiredMark />
              </label>
              <input
                id="contact-email"
                type="email"
                className={inputClassName}
                placeholder="Work email*"
                autoComplete="email"
                aria-required="true"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="contact-company" className={labelClassName}>
                Company / operator
                <RequiredMark />
              </label>
              <input
                id="contact-company"
                className={inputClassName}
                placeholder="Company or operator*"
                autoComplete="organization"
                aria-required="true"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="contact-site-name" className={labelClassName}>
                Facility name or site type
                <RequiredMark />
              </label>
              <input
                id="contact-site-name"
                className={inputClassName}
                placeholder="Facility name or site type*"
                aria-required="true"
                value={siteName}
                onChange={(event) => setSiteName(event.target.value)}
              />
            </div>
            <PlaceAutocompleteInput
              id="contact-site-location"
              label="City / location"
              placeholder="City, state, or facility address*"
              value={siteLocation}
              onChange={setSiteLocation}
              onPlaceSelect={setSiteLocationMetadata}
              required
              labelClassName={labelClassName}
              inputClassName={inputClassName}
            />
          </div>

          <fieldset className="space-y-3">
            <legend className={labelClassName}>
              Access boundaries
              <RequiredMark />
            </legend>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Access boundaries">
              {siteAccessBoundaryOptions.map((option) => {
                const active = accessBoundary === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex min-h-[7rem] cursor-pointer flex-col justify-between border px-4 py-3 transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-black/10 bg-[#f8f6f1] text-slate-800 hover:bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="access-boundary"
                      value={option.value}
                      checked={active}
                      onChange={() => setAccessBoundary(option.value)}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold">{option.value}</span>
                    <span className={`mt-2 text-xs leading-5 ${active ? "text-white/70" : "text-slate-500"}`}>
                      {option.description}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="contact-privacy-notes" className={labelClassName}>
              Privacy, safety, or commercialization notes
            </label>
            <textarea
              id="contact-privacy-notes"
              className={textareaClassName}
              placeholder="Restricted areas, redaction needs, safety rules, approval workflow, or commercial-use concerns."
              value={privacySecurityConstraints}
              onChange={(event) => setPrivacySecurityConstraints(event.target.value)}
            />
          </div>
        </>
      )}

      <div className="hidden">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      {message ? (
        <div
          role="alert"
          aria-live="polite"
          className="border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          <p className="font-semibold text-red-800">Fix before sending</p>
          <p className="mt-1">{message}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-black/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-xs leading-5 text-slate-500">
          The next step is a request-specific review, not an automatic access,
          rights, payment, or execution commitment.
        </p>
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex w-full items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {status === "loading"
            ? "Submitting..."
            : persona === "site_operator"
              ? "Submit site free"
              : isDataPackageRequest
                ? "Request policy improvement"
              : "Request evaluation"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
