import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearch } from "wouter";
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
import { normalizeInterestToLane } from "@/lib/contactInterest";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import type {
  BudgetBucket,
  BuyerType,
  InboundRequestPayload,
  PlaceLocationMetadata,
  ProofPathPreference,
  RequestedLane,
  SubmitInboundRequestResponse,
} from "@/types/inbound-request";

type Persona = "robot_team" | "site_operator";

function getDefaultRequestedLane(persona: Persona): RequestedLane {
  return persona === "site_operator" ? "qualification" : "deeper_evaluation";
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
  personaParam: string,
  buyerTypeParam: string,
  hostedMode: boolean,
): Persona {
  if (hostedMode) return "robot_team";
  if (personaParam === "site-operator") return "site_operator";
  if (personaParam === "robot-team") return "robot_team";
  if (buyerTypeParam === "site_operator") return "site_operator";
  return "robot_team";
}

const labelClassName = "mb-1.5 block text-sm font-semibold text-slate-800";
const inputClassName =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";
const textareaClassName =
  "min-h-24 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";
const helperClassName = "mt-1.5 text-xs leading-5 text-slate-500";

function RequiredMark() {
  return (
    <span className="ml-1 text-slate-500" aria-hidden="true">
      *
    </span>
  );
}

function FormSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-black/10 pt-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-950">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

export function ContactForm() {
  const { currentUser, userData } = useAuth();
  const search = useSearch();
  const [location] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const interest = searchParams.get("interest")?.trim() ?? "";
  const buyerTypeParam = searchParams.get("buyerType")?.trim() ?? "";
  const personaParam = searchParams.get("persona")?.trim() ?? "";
  const interestLane = normalizeInterestToLane(interest);
  const hostedMode = interestLane === "deeper_evaluation" && buyerTypeParam === "robot_team";
  const persona =
    location === "/contact/site-operator"
      ? "site_operator"
      : getPersonaFromSearch(personaParam, buyerTypeParam, hostedMode);
  const searchDemandAttribution = useMemo(
    () => getDemandAttributionFromSearchParams(searchParams),
    [searchParams],
  );
  const analyticsDemandAttribution = hasDemandAttribution(searchDemandAttribution)
    ? searchDemandAttribution
    : undefined;
  const hasPrefilledOptionalContext = Boolean(
    searchParams.get("siteLocation")?.trim()
      || searchParams.get("targetRobotTeam")?.trim(),
  );
  const [showOptionalDetails, setShowOptionalDetails] = useState(
    hostedMode || hasPrefilledOptionalContext,
  );

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [siteLocationMetadata, setSiteLocationMetadata] =
    useState<PlaceLocationMetadata | null>(null);
  const [taskStatement, setTaskStatement] = useState("");
  const [targetSiteType, setTargetSiteType] = useState("");
  const [targetRobotTeam, setTargetRobotTeam] = useState("");
  const [budgetBucket, setBudgetBucket] = useState<BudgetBucket>("Undecided/Unsure");
  const [proofPathPreference, setProofPathPreference] = useState<ProofPathPreference>(
    hostedMode ? "exact_site_required" : "need_guidance",
  );
  const [operatingConstraints, setOperatingConstraints] = useState("");
  const [captureRights, setCaptureRights] = useState("");
  const [privacySecurityConstraints, setPrivacySecurityConstraints] = useState("");
  const [commercializationPreference, setCommercializationPreference] = useState("");
  const [humanGateTopics, setHumanGateTopics] = useState("");
  const [detailsMessage, setDetailsMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const prefills = useMemo(
    () => ({
      siteName: searchParams.get("siteName")?.trim() ?? "",
      siteLocation: searchParams.get("siteLocation")?.trim() ?? "",
      taskStatement: searchParams.get("taskStatement")?.trim() ?? "",
      targetRobotTeam: searchParams.get("targetRobotTeam")?.trim() ?? "",
    }),
    [searchParams],
  );

  useEffect(() => {
    const displayName = userData?.name || currentUser?.displayName || "";
    const trimmedName = displayName.trim();
    const [defaultFirstName, ...restName] = trimmedName ? trimmedName.split(/\s+/) : [];

    if (!firstName && defaultFirstName) setFirstName(defaultFirstName);
    if (!lastName && restName.length > 0) setLastName(restName.join(" "));
    if (!company && (userData?.company || userData?.organizationName)) {
      setCompany(userData.company || userData.organizationName || "");
    }
    if (!jobTitle && userData?.jobTitle) setJobTitle(userData.jobTitle);
    if (!email && currentUser?.email) setEmail(currentUser.email);
    if (!siteName && (prefills.siteName || userData?.siteName)) {
      setSiteName(prefills.siteName || userData?.siteName || "");
    }
    if (!siteLocation && (prefills.siteLocation || userData?.siteLocation)) {
      const defaultSiteLocation = prefills.siteLocation || userData?.siteLocation || "";
      setSiteLocation(defaultSiteLocation);
      setSiteLocationMetadata(
        userData?.siteLocationMetadata || {
          source: "manual",
          formattedAddress: defaultSiteLocation,
        },
      );
    }
    if (!taskStatement && (prefills.taskStatement || userData?.taskStatement)) {
      setTaskStatement(prefills.taskStatement || userData?.taskStatement || "");
    }
    if (!targetRobotTeam && (prefills.targetRobotTeam || userData?.targetRobotTeam)) {
      setTargetRobotTeam(prefills.targetRobotTeam || userData?.targetRobotTeam || "");
    }
    if (!operatingConstraints && userData?.operatingConstraints) {
      setOperatingConstraints(userData.operatingConstraints);
    }
    if (!captureRights && userData?.captureRights) {
      setCaptureRights(userData.captureRights);
    }
    if (!privacySecurityConstraints && userData?.privacySecurityConstraints) {
      setPrivacySecurityConstraints(userData.privacySecurityConstraints);
    }
  }, [
    captureRights,
    company,
    currentUser,
    email,
    firstName,
    jobTitle,
    lastName,
    operatingConstraints,
    persona,
    prefills,
    privacySecurityConstraints,
    siteLocation,
    siteName,
    targetRobotTeam,
    taskStatement,
    userData,
  ]);

  const buyerType: BuyerType = persona;
  const requestedLanes: RequestedLane[] = hostedMode
    ? ["deeper_evaluation"]
    : [interestLane || getDefaultRequestedLane(persona)];
  const requestedLane = requestedLanes[0] || "qualification";
  const requiredFieldSummary =
    persona === "site_operator"
      ? ["Name", "Operator", "Work email", "Facility", "Location", "Access rules"]
      : ["Name", "Company", "Work email", "Role", "First question", "Site or site class"];

  useEffect(() => {
    analyticsEvents.contactRequestStarted({
      persona,
      hostedMode,
      requestedLane,
      authenticated: Boolean(currentUser?.uid),
      prefilledSiteContext: Boolean(prefills.siteName || prefills.siteLocation),
      ...(analyticsDemandAttribution
        ? { demandAttribution: analyticsDemandAttribution }
        : {}),
    });
    // We only want the baseline start event once per form visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const missingFields: string[] = [];
    if (!firstName.trim()) missingFields.push("First name");
    if (!lastName.trim()) missingFields.push("Last name");
    if (!company.trim()) missingFields.push(persona === "site_operator" ? "Company or operator" : "Company");
    if (!email.trim()) missingFields.push("Work email");
    if (persona === "site_operator" && !siteName.trim()) {
      missingFields.push("Facility name");
    }
    if (persona === "site_operator" && !siteLocation.trim()) {
      missingFields.push("Site location");
    }

    if (persona === "robot_team" && !taskStatement.trim()) {
      missingFields.push("What you need");
    }
    if (persona === "robot_team" && !jobTitle.trim()) {
      missingFields.push("Your role");
    }
    if (persona === "robot_team" && !siteName.trim() && !targetSiteType.trim()) {
      missingFields.push("Target site or site class");
    }
    if (persona === "site_operator" && !operatingConstraints.trim()) {
      missingFields.push("Access rules");
    }

    if (missingFields.length > 0) {
      analyticsEvents.contactRequestFailed({
        stage: "validation",
        errorType: "missing_required_fields",
        persona,
        hostedMode,
        requestedLane,
        ...(analyticsDemandAttribution
          ? { demandAttribution: analyticsDemandAttribution }
          : {}),
      });
      setStatus("error");
      setMessage(`Please fill in: ${missingFields.join(", ")}`);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      analyticsEvents.contactRequestFailed({
        stage: "validation",
        errorType: "invalid_email",
        persona,
        hostedMode,
        requestedLane,
        ...(analyticsDemandAttribution
          ? { demandAttribution: analyticsDemandAttribution }
          : {}),
      });
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    const requestId = generateRequestId();
    const operatorTaskStatement =
      detailsMessage.trim()
      || commercializationPreference.trim()
      || `Site operator claim for ${siteName.trim()}`;
    const payload: InboundRequestPayload = {
      requestId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company.trim(),
      roleTitle: jobTitle.trim(),
      email: email.trim().toLowerCase(),
      budgetBucket,
      requestedLanes,
      buyerType,
      siteName: siteName.trim(),
      siteLocation: siteLocation.trim(),
      siteLocationMetadata: resolvePlaceLocationMetadata(siteLocation, siteLocationMetadata),
      taskStatement: persona === "robot_team" ? taskStatement.trim() : operatorTaskStatement,
      targetSiteType: targetSiteType.trim() || siteName.trim() || undefined,
      proofPathPreference,
      existingStackReviewWorkflow: undefined,
      humanGateTopics: humanGateTopics.trim() || undefined,
      operatingConstraints: operatingConstraints.trim() || undefined,
      captureRights: persona === "site_operator" ? captureRights.trim() || undefined : undefined,
      privacySecurityConstraints: privacySecurityConstraints.trim() || undefined,
      targetRobotTeam: persona === "robot_team" ? targetRobotTeam.trim() || undefined : undefined,
      derivedScenePermission: persona === "site_operator" ? commercializationPreference.trim() || undefined : undefined,
      details: detailsMessage.trim() || undefined,
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
      hostedMode,
      requestedLane,
      authenticated: Boolean(currentUser?.uid),
      hasJobTitle: Boolean(jobTitle.trim()),
      hasSiteName: Boolean(siteName.trim()),
      hasSiteLocation: Boolean(siteLocation.trim()),
      hasTaskStatement: Boolean(taskStatement.trim()),
      hasOperatingConstraints: Boolean(operatingConstraints.trim()),
      hasPrivacySecurityConstraints: Boolean(privacySecurityConstraints.trim()),
      hasNotes: Boolean(detailsMessage.trim()),
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
        hostedMode,
        requestedLane,
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
        hostedMode,
        requestedLane,
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
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm md:p-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900">
          {hostedMode
            ? "Hosted evaluation request received"
            : persona === "site_operator"
              ? "Site claim received"
              : "Site review request received"}
        </h2>
        <p className="mt-4 text-zinc-600">
          {hostedMode
            ? "Blueprint now has the request details for this hosted evaluation follow-up."
            : persona === "site_operator"
              ? "Blueprint now has the site claim, access notes, and governance boundaries needed for a measured follow-up."
              : "Blueprint now has the site, task, and robot details needed to answer with a useful next step."}
        </p>
        <div className="mt-8 rounded-xl bg-zinc-50 p-6 text-left">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">What happens next?</h3>
          <div className="space-y-3 text-sm text-zinc-600">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-indigo-100 p-1 text-indigo-600">
                <Clock className="h-3 w-3" />
              </div>
              <p>Blueprint reviews the site, task, and robot details, then replies with the next useful step.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-indigo-100 p-1 text-indigo-600">
                <Mail className="h-3 w-3" />
              </div>
              <p>You get a follow-up from the team rather than a dead-end auto-response.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-indigo-100 p-1 text-indigo-600">
                <Calendar className="h-3 w-3" />
              </div>
              <p>If the request looks workable, the next reply narrows the scope instead of reopening discovery from scratch.</p>
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
    <form id="contact-form" className="space-y-7" onSubmit={handleSubmit} noValidate>
      <div className="border border-black/10 bg-[#f8f6f1] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Required first pass
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Keep the first pass short. Blueprint can ask for more detail after the site and workflow are clear.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:max-w-[20rem] md:justify-end">
            {requiredFieldSummary.map((field) => (
              <span
                key={field}
                className="border border-black/10 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      </div>

      {hostedMode ? (
        <div className="border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
          You are requesting a hosted evaluation for a specific site. Keep the submission tight.
          {siteName ? ` Site: ${siteName}.` : ""}
          {siteLocation ? ` Location: ${siteLocation}.` : ""}
        </div>
      ) : null}

      <FormSection eyebrow="01 Contact" title="Who should Blueprint follow up with?">
      <div className="grid gap-4 md:grid-cols-2">
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
          <label htmlFor="contact-last-name" className={labelClassName}>
            Last name
            <RequiredMark />
          </label>
          <input
            id="contact-last-name"
            className={inputClassName}
            placeholder="Last name*"
            autoComplete="family-name"
            aria-required="true"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="contact-company" className={labelClassName}>
            {persona === "site_operator" ? "Company or operator" : "Company"}
            <RequiredMark />
          </label>
          <input
            id="contact-company"
            className={inputClassName}
            placeholder={persona === "site_operator" ? "Operator or company*" : "Company name*"}
            autoComplete="organization"
            aria-required="true"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
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
      </div>
      </FormSection>

      {persona === "robot_team" ? (
        <>
          <FormSection eyebrow="02 Request" title="What should the next step be scoped around?">
          <div>
            <label htmlFor="contact-title" className={labelClassName}>
              Your role
              <RequiredMark />
            </label>
            <input
              id="contact-title"
              className={inputClassName}
              placeholder="Autonomy lead, deployment engineer, perception lead"
              autoComplete="organization-title"
              aria-required="true"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
            />
            <p className={helperClassName}>Use the role that owns the deployment, evaluation, or procurement question.</p>
          </div>
          <div>
            <label htmlFor="contact-task" className={labelClassName}>
              What should Blueprint help your team answer first?
              <RequiredMark />
            </label>
            <textarea
              id="contact-task"
              className={textareaClassName}
              placeholder="Describe the deployment question, site review, or package need you want answered first.*"
              aria-required="true"
              value={taskStatement}
              onChange={(event) => setTaskStatement(event.target.value)}
            />
            <p className={helperClassName}>One concrete question converts better than a broad discovery note.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="contact-site-name"
                className={labelClassName}
              >
                Site or facility
              </label>
              <input
                id="contact-site-name"
                className={inputClassName}
                placeholder={hostedMode ? "Prefilled from the listing when available" : "Facility name, customer site, or short site label"}
                value={siteName}
                onChange={(event) => setSiteName(event.target.value)}
              />
              <p className={helperClassName}>Use a real place when known. Otherwise use the closest site class.</p>
            </div>
            <div>
              <label htmlFor="contact-site-type" className={labelClassName}>
                Target site class
              </label>
              <input
                id="contact-site-type"
                className={inputClassName}
                placeholder="Warehouse, hotel corridor, grocery backroom"
                value={targetSiteType}
                onChange={(event) => setTargetSiteType(event.target.value)}
              />
              <p className={helperClassName}>Required only when you cannot name the exact site yet.</p>
            </div>
          </div>
          </FormSection>

          <div className="border-t border-black/10 pt-6">
            <button
              type="button"
              className="inline-flex w-full items-center justify-between border border-black/10 bg-[#f8f6f1] px-4 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-white"
              aria-expanded={showOptionalDetails}
              onClick={() => setShowOptionalDetails((current) => !current)}
            >
              <span>{showOptionalDetails ? "Hide optional details" : "Add robot, location, budget, or routing details"}</span>
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Optional
              </span>
            </button>
          </div>

          {showOptionalDetails ? (
            <FormSection eyebrow="03 Optional" title="Add detail only when it helps the first reply.">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="contact-embodiment"
                    className={labelClassName}
                  >
                    Robot or stack
                  </label>
                  <input
                    id="contact-embodiment"
                    className={inputClassName}
                    placeholder="Robot platform, stack, or policy/checkpoint name"
                    value={targetRobotTeam}
                    onChange={(event) => setTargetRobotTeam(event.target.value)}
                  />
                </div>
                <PlaceAutocompleteInput
                  id="contact-site-location"
                  label="Site location"
                  placeholder="City, state, facility address, or region"
                  value={siteLocation}
                  onChange={setSiteLocation}
                  onPlaceSelect={setSiteLocationMetadata}
                  labelClassName={labelClassName}
                  inputClassName={inputClassName}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="contact-budget" className={labelClassName}>
                    Budget or procurement range
                  </label>
                  <select
                    id="contact-budget"
                    className={inputClassName}
                    value={budgetBucket}
                    onChange={(event) => setBudgetBucket(event.target.value as BudgetBucket)}
                  >
                    <option value="Undecided/Unsure">Undecided/Unsure</option>
                    <option value="<$50K">&lt;$50K</option>
                    <option value="$50K-$300K">$50K-$300K</option>
                    <option value="$300K-$1M">$300K-$1M</option>
                    <option value=">$1M">&gt;$1M</option>
                  </select>
                </div>
                {!hostedMode ? (
                  <div>
                    <label htmlFor="contact-proof-path" className={labelClassName}>
                      Proof path
                    </label>
                    <select
                      id="contact-proof-path"
                      className={inputClassName}
                      value={proofPathPreference}
                      onChange={(event) => setProofPathPreference(event.target.value as ProofPathPreference)}
                    >
                      <option value="need_guidance">Need guidance</option>
                      <option value="exact_site_required">Exact site required</option>
                      <option value="adjacent_site_acceptable">Adjacent site acceptable</option>
                    </select>
                  </div>
                ) : null}
              </div>
              {!hostedMode ? (
              <div>
                <label htmlFor="contact-human-gates" className={labelClassName}>
                  Human-gated topics
                </label>
                <input
                  id="contact-human-gates"
                  className={inputClassName}
                  placeholder="Procurement, legal, security, customer approval"
                  value={humanGateTopics}
                  onChange={(event) => setHumanGateTopics(event.target.value)}
                />
              </div>
              ) : null}
              <div>
                <label htmlFor="contact-notes" className={labelClassName}>Optional notes</label>
                <textarea
                  id="contact-notes"
                  className={textareaClassName}
                  placeholder="Anything useful about timing, constraints, integrations, rights questions, or why this site matters now."
                  value={detailsMessage}
                  onChange={(event) => setDetailsMessage(event.target.value)}
                />
              </div>
            </FormSection>
          ) : null}
        </>
      ) : (
        <>
          <FormSection eyebrow="02 Site" title="What facility and access path are you bringing?">
            <div>
              <label htmlFor="contact-title" className={labelClassName}>Title</label>
              <input
                id="contact-title"
                className={inputClassName}
                placeholder="Ops lead, facility manager, innovation lead"
                autoComplete="organization-title"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="contact-site-name" className={labelClassName}>
                  Facility name
                  <RequiredMark />
                </label>
                <input
                  id="contact-site-name"
                  className={inputClassName}
                  placeholder="Facility name*"
                  aria-required="true"
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                />
              </div>
              <PlaceAutocompleteInput
                id="contact-site-location"
                label="Site location"
                placeholder="City, state, or facility address*"
                value={siteLocation}
                onChange={setSiteLocation}
                onPlaceSelect={setSiteLocationMetadata}
                required
                labelClassName={labelClassName}
                inputClassName={inputClassName}
              />
            </div>
            <div>
              <label htmlFor="contact-access-rules" className={labelClassName}>
                Access rules
                <RequiredMark />
              </label>
              <textarea
                id="contact-access-rules"
                className={textareaClassName}
                placeholder="Hours, escort requirements, restricted areas, or other operating rules.*"
                aria-required="true"
                value={operatingConstraints}
                onChange={(event) => setOperatingConstraints(event.target.value)}
              />
            </div>
          </FormSection>

          <div className="border-t border-black/10 pt-6">
            <button
              type="button"
              className="inline-flex w-full items-center justify-between border border-black/10 bg-[#f8f6f1] px-4 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-white"
              aria-expanded={showOptionalDetails}
              onClick={() => setShowOptionalDetails((current) => !current)}
            >
              <span>{showOptionalDetails ? "Hide optional boundary details" : "Add privacy, rights, or commercialization details"}</span>
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Optional
              </span>
            </button>
          </div>

          {showOptionalDetails ? (
            <FormSection eyebrow="03 Optional" title="Set extra boundaries before a call.">
              <div>
                <label htmlFor="contact-rights-notes" className={labelClassName}>
                  Rights and ownership notes
                </label>
                <textarea
                  id="contact-rights-notes"
                  className={textareaClassName}
                  placeholder="Who controls site approval, capture permission, owner review, or release terms."
                  value={captureRights}
                  onChange={(event) => setCaptureRights(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contact-privacy-notes" className={labelClassName}>
                  Privacy and security notes
                </label>
                <textarea
                  id="contact-privacy-notes"
                  className={textareaClassName}
                  placeholder="Camera limits, redaction needs, safety or security restrictions."
                  value={privacySecurityConstraints}
                  onChange={(event) => setPrivacySecurityConstraints(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contact-commercialization" className={labelClassName}>
                  Commercialization preference
                </label>
                <textarea
                  id="contact-commercialization"
                  className={textareaClassName}
                  placeholder="Whether the site can be listed for robot-team review, kept private, or discussed only after approval."
                  value={commercializationPreference}
                  onChange={(event) => setCommercializationPreference(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contact-notes" className={labelClassName}>Notes</label>
                <textarea
                  id="contact-notes"
                  className={textareaClassName}
                  placeholder="Anything else Blueprint should know about the facility or approval path."
                  value={detailsMessage}
                  onChange={(event) => setDetailsMessage(event.target.value)}
                />
              </div>
            </FormSection>
          ) : null}
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
          Submitting this form does not claim buyer fit, rights clearance, or a live capture commitment.
        </p>
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex w-full items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {status === "loading"
            ? "Submitting..."
            : hostedMode
              ? "Request hosted evaluation"
              : persona === "site_operator"
                ? "Submit site claim"
                : "Request site review"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
