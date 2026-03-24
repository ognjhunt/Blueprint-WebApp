import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { ArrowRight, Calendar, CheckCircle2, Clock, Mail } from "lucide-react";
import { withCsrfHeader } from "@/lib/csrf";
import { normalizeInterestToLane } from "@/lib/contactInterest";
import { useAuth } from "@/contexts/AuthContext";
import type {
  BuyerType,
  InboundRequestPayload,
  RequestedLane,
  SubmitInboundRequestResponse,
  UTMParams,
} from "@/types/inbound-request";

type Persona = "robot_team" | "site_operator";

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

function getUTMParams(): UTMParams {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("utm_source") || null,
    medium: params.get("utm_medium") || null,
    campaign: params.get("utm_campaign") || null,
    term: params.get("utm_term") || null,
    content: params.get("utm_content") || null,
  };
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

export function ContactForm() {
  const { currentUser, userData } = useAuth();
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const interest = searchParams.get("interest")?.trim() ?? "";
  const buyerTypeParam = searchParams.get("buyerType")?.trim() ?? "";
  const personaParam = searchParams.get("persona")?.trim() ?? "";
  const interestLane = normalizeInterestToLane(interest);
  const hostedMode = interestLane === "deeper_evaluation" && buyerTypeParam === "robot_team";
  const persona = getPersonaFromSearch(personaParam, buyerTypeParam, hostedMode);

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
  const [taskStatement, setTaskStatement] = useState("");
  const [targetRobotTeam, setTargetRobotTeam] = useState("");
  const [operatingConstraints, setOperatingConstraints] = useState("");
  const [privacySecurityConstraints, setPrivacySecurityConstraints] = useState("");
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
      setSiteLocation(prefills.siteLocation || userData?.siteLocation || "");
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
    if (!privacySecurityConstraints && userData?.privacySecurityConstraints) {
      setPrivacySecurityConstraints(userData.privacySecurityConstraints);
    }
  }, [
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
    : [interestLane || "qualification"];

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
    if (persona === "site_operator" && !operatingConstraints.trim()) {
      missingFields.push("Access rules");
    }

    if (missingFields.length > 0) {
      setStatus("error");
      setMessage(`Please fill in: ${missingFields.join(", ")}`);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    const requestId = generateRequestId();
    const payload: InboundRequestPayload = {
      requestId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company.trim(),
      roleTitle: jobTitle.trim(),
      email: email.trim().toLowerCase(),
      budgetBucket: "Undecided/Unsure",
      requestedLanes,
      buyerType,
      siteName: siteName.trim(),
      siteLocation: siteLocation.trim(),
      taskStatement: persona === "robot_team" ? taskStatement.trim() : "Operator intake",
      operatingConstraints: operatingConstraints.trim() || undefined,
      privacySecurityConstraints: privacySecurityConstraints.trim() || undefined,
      targetRobotTeam: persona === "robot_team" ? targetRobotTeam.trim() || undefined : undefined,
      details: detailsMessage.trim() || undefined,
      context: {
        sourcePageUrl: typeof window !== "undefined" ? window.location.href : "",
        referrer: getReferrer() || undefined,
        utm: getUTMParams(),
        timezoneOffset: new Date().getTimezoneOffset(),
        locale: typeof navigator !== "undefined" ? navigator.language : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      },
      honeypot: honeypot || undefined,
    };

    setStatus("loading");
    setMessage("");

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
    } catch (error) {
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
              ? "Facility inquiry received"
              : "Robot-team inquiry received"}
        </h2>
        <p className="mt-4 text-zinc-600">
          {hostedMode
            ? "Blueprint now has the request details for this hosted evaluation follow-up."
            : persona === "site_operator"
              ? "Blueprint now has the facility details, access notes, and governance context needed for a follow-up."
              : "Blueprint now has the request details needed for a follow-up."}
        </p>
        <div className="mt-8 rounded-xl bg-zinc-50 p-6 text-left">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">What happens next?</h3>
          <div className="space-y-3 text-sm text-zinc-600">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-indigo-100 p-1 text-indigo-600">
                <Clock className="h-3 w-3" />
              </div>
              <p>Blueprint reviews the request and confirms the most credible next step.</p>
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
              <p>If the request looks workable, the next reply will narrow the scope instead of reopening the whole intake from scratch.</p>
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
    <form className="space-y-6" onSubmit={handleSubmit}>
      {hostedMode ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-zinc-700">
          You are requesting a hosted evaluation for a specific site. Keep the submission tight.
          {siteName ? ` Site: ${siteName}.` : ""}
          {siteLocation ? ` Location: ${siteLocation}.` : ""}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="contact-first-name" className="mb-1 block text-sm font-medium text-zinc-700">First name</label>
          <input
            id="contact-first-name"
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder="First name*"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="contact-last-name" className="mb-1 block text-sm font-medium text-zinc-700">Last name</label>
          <input
            id="contact-last-name"
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder="Last name*"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="contact-company" className="mb-1 block text-sm font-medium text-zinc-700">
            {persona === "site_operator" ? "Company or operator" : "Company"}
          </label>
          <input
            id="contact-company"
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder={persona === "site_operator" ? "Operator or company*" : "Company name*"}
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-1 block text-sm font-medium text-zinc-700">Work email</label>
          <input
            id="contact-email"
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder="Work email*"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>

      {persona === "robot_team" ? (
        <>
          <div>
            <label htmlFor="contact-task" className="mb-1 block text-sm font-medium text-zinc-700">What do you need?</label>
            <textarea
              id="contact-task"
              className="min-h-24 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
              placeholder="Describe the evaluation, package, workflow, or deployment question you need help with.*"
              value={taskStatement}
              onChange={(event) => setTaskStatement(event.target.value)}
            />
          </div>
          {!hostedMode ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="contact-site-name" className="mb-1 block text-sm font-medium text-zinc-700">
                  Site name
                </label>
                <input
                  id="contact-site-name"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                  placeholder="Optional site or customer name"
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="contact-site-location" className="mb-1 block text-sm font-medium text-zinc-700">Site location</label>
                <input
                  id="contact-site-location"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                  placeholder="Optional city, state, or facility address"
                  value={siteLocation}
                  onChange={(event) => setSiteLocation(event.target.value)}
                />
              </div>
            </div>
          ) : null}
          <div>
            <label htmlFor="contact-embodiment" className="mb-1 block text-sm font-medium text-zinc-700">Robot setup</label>
            <input
              id="contact-embodiment"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
              placeholder="Optional robot, embodiment, or stack"
              value={targetRobotTeam}
              onChange={(event) => setTargetRobotTeam(event.target.value)}
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="contact-title" className="mb-1 block text-sm font-medium text-zinc-700">Title</label>
            <input
              id="contact-title"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
              placeholder="Ops lead, facility manager, innovation lead"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="contact-site-name" className="mb-1 block text-sm font-medium text-zinc-700">
                Facility name
              </label>
              <input
                id="contact-site-name"
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                placeholder="Facility name*"
                value={siteName}
                onChange={(event) => setSiteName(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="contact-site-location" className="mb-1 block text-sm font-medium text-zinc-700">Site location</label>
              <input
                id="contact-site-location"
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                placeholder="City, state, or facility address*"
                value={siteLocation}
                onChange={(event) => setSiteLocation(event.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="contact-access-rules" className="mb-1 block text-sm font-medium text-zinc-700">Access rules</label>
            <textarea
              id="contact-access-rules"
              className="min-h-24 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
              placeholder="Hours, escort requirements, restricted areas, or other operating rules.*"
              value={operatingConstraints}
              onChange={(event) => setOperatingConstraints(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="contact-privacy-notes" className="mb-1 block text-sm font-medium text-zinc-700">
              Privacy and security notes
            </label>
            <textarea
              id="contact-privacy-notes"
              className="min-h-24 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
              placeholder="Camera limits, redaction needs, safety or security restrictions."
              value={privacySecurityConstraints}
              onChange={(event) => setPrivacySecurityConstraints(event.target.value)}
            />
          </div>
        </>
      )}

      <div>
        <label htmlFor="contact-notes" className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
        <textarea
          id="contact-notes"
          className="min-h-24 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
          placeholder={
            persona === "site_operator"
              ? "Anything else Blueprint should know about the facility or approval path."
              : "Optional site or workflow notes, timing, or constraints."
          }
          value={detailsMessage}
          onChange={(event) => setDetailsMessage(event.target.value)}
        />
      </div>

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

      {message ? <p className="text-sm text-red-600">{message}</p> : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex items-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60"
      >
        {status === "loading"
          ? "Submitting..."
          : hostedMode
            ? "Request hosted evaluation"
            : persona === "site_operator"
              ? "Send facility inquiry"
              : "Send request"}
        <ArrowRight className="ml-2 h-4 w-4" />
      </button>
    </form>
  );
}
