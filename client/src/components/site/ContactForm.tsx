import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { ArrowRight, Calendar, CheckCircle2, Clock, Mail } from "lucide-react";
import { withCsrfHeader } from "@/lib/csrf";
import { normalizeInterestToLane } from "@/lib/contactInterest";
import { useAuth } from "@/contexts/AuthContext";
import type {
  BudgetBucket,
  BuyerType,
  InboundRequestPayload,
  RequestedLane,
  SubmitInboundRequestResponse,
  UTMParams,
} from "@/types/inbound-request";

const budgetRanges: BudgetBucket[] = [
  "<$50K",
  "$50K-$300K",
  "$300K-$1M",
  ">$1M",
  "Undecided/Unsure",
];

const requestedLaneOptions: Array<{
  value: RequestedLane;
  label: string;
  description: string;
}> = [
  {
    value: "qualification",
    label: "Qualification",
    description: "Default intake and readiness review.",
  },
  {
    value: "deeper_evaluation",
    label: "Deeper evaluation",
    description: "Request additional review after qualification.",
  },
  {
    value: "managed_tuning",
    label: "Managed tuning",
    description: "Flag possible tuning work for later-stage follow-up.",
  },
];

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

export function ContactForm() {
  const { currentUser, userData } = useAuth();
  const search = useSearch();
  const interest = useMemo(
    () => new URLSearchParams(search).get("interest")?.trim() ?? "",
    [search]
  );

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<BudgetBucket | "">("");
  const [selectedBuyerType, setSelectedBuyerType] = useState<BuyerType>("site_operator");
  const [selectedLanes, setSelectedLanes] = useState<RequestedLane[]>(["qualification"]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [taskStatement, setTaskStatement] = useState("");
  const [workflowContext, setWorkflowContext] = useState("");
  const [operatingConstraints, setOperatingConstraints] = useState("");
  const [privacySecurityConstraints, setPrivacySecurityConstraints] = useState("");
  const [knownBlockers, setKnownBlockers] = useState("");
  const [targetRobotTeam, setTargetRobotTeam] = useState("");
  const [detailsMessage, setDetailsMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");

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
    if (!siteName && userData?.siteName) setSiteName(userData.siteName);
    if (!siteLocation && userData?.siteLocation) setSiteLocation(userData.siteLocation);
    if (!taskStatement && userData?.taskStatement) setTaskStatement(userData.taskStatement);
    if (!workflowContext && userData?.workflowContext) setWorkflowContext(userData.workflowContext);
    if (!operatingConstraints && userData?.operatingConstraints) {
      setOperatingConstraints(userData.operatingConstraints);
    }
    if (!privacySecurityConstraints && userData?.privacySecurityConstraints) {
      setPrivacySecurityConstraints(userData.privacySecurityConstraints);
    }
    if (!knownBlockers && userData?.knownBlockers) setKnownBlockers(userData.knownBlockers);
    if (!targetRobotTeam && userData?.targetRobotTeam) setTargetRobotTeam(userData.targetRobotTeam);
    if (!selectedBudget && userData?.budgetRange) setSelectedBudget(userData.budgetRange);
    if (userData?.buyerType) setSelectedBuyerType(userData.buyerType);
    if (userData?.requestedLanes?.length) setSelectedLanes(userData.requestedLanes);
  }, [
    company,
    currentUser,
    email,
    firstName,
    jobTitle,
    knownBlockers,
    lastName,
    operatingConstraints,
    privacySecurityConstraints,
    selectedBudget,
    siteLocation,
    siteName,
    targetRobotTeam,
    taskStatement,
    userData,
    workflowContext,
  ]);

  useEffect(() => {
    const lane = normalizeInterestToLane(interest);
    if (lane) {
      setSelectedLanes((current) => (current.includes(lane) ? current : [...current, lane]));
    }
  }, [interest]);

  const toggleLane = useCallback((lane: RequestedLane) => {
    setSelectedLanes((current) =>
      current.includes(lane) ? current.filter((entry) => entry !== lane) : [...current, lane]
    );
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const missingFields: string[] = [];
    if (!firstName.trim()) missingFields.push("First name");
    if (!lastName.trim()) missingFields.push("Last name");
    if (!company.trim()) missingFields.push("Company");
    if (!email.trim()) missingFields.push("Work email");
    if (!siteName.trim()) missingFields.push("Site name");
    if (!siteLocation.trim()) missingFields.push("Site location");
    if (!taskStatement.trim()) missingFields.push("Task statement");

    if (missingFields.length > 0) {
      setStatus("error");
      setMessage(`Please fill in: ${missingFields.join(", ")}`);
      return;
    }

    if (!selectedBudget) {
      setStatus("error");
      setMessage("Please select a project budget.");
      return;
    }

    if (selectedLanes.length === 0) {
      setStatus("error");
      setMessage("Please choose at least one requested lane.");
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
      budgetBucket: selectedBudget,
      requestedLanes: selectedLanes,
      buyerType: selectedBuyerType,
      siteName: siteName.trim(),
      siteLocation: siteLocation.trim(),
      taskStatement: taskStatement.trim(),
      workflowContext: workflowContext.trim() || undefined,
      operatingConstraints: operatingConstraints.trim() || undefined,
      privacySecurityConstraints: privacySecurityConstraints.trim() || undefined,
      knownBlockers: knownBlockers.trim() || undefined,
      targetRobotTeam: targetRobotTeam.trim() || undefined,
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
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to submit intake. Please try again."
      );
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm md:p-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900">Submission received</h2>
        <p className="mt-4 text-zinc-600">
          Blueprint now has the site, task, and constraints. We will review the submission and
          follow up with the right next step.
        </p>
        <div className="mt-8 rounded-xl bg-zinc-50 p-6 text-left">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">What happens next?</h3>
          <div className="space-y-3 text-sm text-zinc-600">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-indigo-100 p-1 text-indigo-600">
                <Clock className="h-3 w-3" />
              </div>
              <p>We review scope, evidence quality, and the likely qualification path.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-indigo-100 p-1 text-indigo-600">
                <Mail className="h-3 w-3" />
              </div>
              <p>If evidence is missing, we request a tighter capture pass instead of guessing.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-indigo-100 p-1 text-indigo-600">
                <Calendar className="h-3 w-3" />
              </div>
              <p>Qualified sites move toward handoff, deeper evaluation, or a later managed-tuning lane.</p>
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
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">First name</label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder="First name*"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Last name</label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder="Last name*"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Company</label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder="Company name*"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Work email</label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder="Work email*"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Title</label>
        <input
          className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
          placeholder="Operations lead, robotics lead, integrator, etc."
          value={jobTitle}
          onChange={(event) => setJobTitle(event.target.value)}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Buyer type</p>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { value: "site_operator", label: "Site operator" },
            { value: "robot_team", label: "Robot team" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedBuyerType(option.value as BuyerType)}
              className={`rounded-xl border px-4 py-3 text-left text-sm ${
                selectedBuyerType === option.value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Site name</label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder="Site name*"
            value={siteName}
            onChange={(event) => setSiteName(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Site location</label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder="City, state, or facility address*"
            value={siteLocation}
            onChange={(event) => setSiteLocation(event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Task statement</label>
        <textarea
          className="min-h-24 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
          placeholder="Describe the exact task Blueprint should qualify.*"
          value={taskStatement}
          onChange={(event) => setTaskStatement(event.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Workflow context</label>
        <textarea
          className="min-h-24 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
          placeholder="Describe the workcell, adjacent workflow, handoffs, and zone boundaries."
          value={workflowContext}
          onChange={(event) => setWorkflowContext(event.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Operating constraints</label>
          <textarea
            className="min-h-24 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder="Hours, access windows, floor conditions, safety rules."
            value={operatingConstraints}
            onChange={(event) => setOperatingConstraints(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Privacy and security constraints
          </label>
          <textarea
            className="min-h-24 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder="Restricted zones, camera limits, redactions."
            value={privacySecurityConstraints}
            onChange={(event) => setPrivacySecurityConstraints(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Known blockers</label>
          <textarea
            className="min-h-24 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder="Known blockers, safety concerns, or scope gaps."
            value={knownBlockers}
            onChange={(event) => setKnownBlockers(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Target robot team or embodiment
          </label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            placeholder="Optional"
            value={targetRobotTeam}
            onChange={(event) => setTargetRobotTeam(event.target.value)}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Requested lanes</p>
        <div className="space-y-3">
          {requestedLaneOptions.map((lane) => (
            <label
              key={lane.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 px-4 py-3"
            >
              <input
                type="checkbox"
                checked={selectedLanes.includes(lane.value)}
                onChange={() => toggleLane(lane.value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-zinc-900">{lane.label}</span>
                <span className="block text-sm text-zinc-500">{lane.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Budget range</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {budgetRanges.map((budget) => (
            <button
              key={budget}
              type="button"
              onClick={() => setSelectedBudget(budget)}
              className={`rounded-xl border px-3 py-3 text-sm ${
                selectedBudget === budget
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              {budget}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Anything else we should know?</label>
        <textarea
          className="min-h-24 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm"
          placeholder="Add anything important for review."
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
        {status === "loading" ? "Submitting..." : "Submit site intake"}
        <ArrowRight className="ml-2 h-4 w-4" />
      </button>
    </form>
  );
}
