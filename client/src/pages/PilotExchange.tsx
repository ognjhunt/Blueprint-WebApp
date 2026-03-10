import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { SEO } from "@/components/SEO";
import { analyticsEvents } from "@/components/Analytics";
import { withCsrfHeader } from "@/lib/csrf";
import {
  evalLeaderboardEntries,
  locationBriefs,
  pilotEmbodiments,
  pilotLocationTypes,
  pilotPrivacyModes,
  pilotTimelines,
  policySubmissions,
} from "@/data/pilotExchange";
import { getPricingContactInterest, simplePricingOptions } from "@/data/simplePricing";
import type {
  InboundRequestPayload,
  SubmitInboundRequestResponse,
} from "@/types/inbound-request";
import type { BudgetBucket, HelpWithOption } from "@/types/inbound-request";
import type {
  DeploymentTimeline,
  EvalLeaderboardEntry,
  LocationBrief,
  PilotLocationType,
  PrivacyMode,
  RobotEmbodiment,
} from "@/types/pilot-exchange";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  CircleDashed,
  Eye,
  EyeOff,
  Filter,
  Lock,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type FilterValue<T extends string> = "all" | T;
type SubmissionStatus = "idle" | "loading" | "success" | "error";
type ExchangeTab = "briefs" | "policies";

interface BaseLeadFormState {
  firstName: string;
  lastName: string;
  company: string;
  roleTitle: string;
  email: string;
  budgetBucket: BudgetBucket;
}

type PolicyPackageKind = "Docker image" | "Checkpoint URL" | "API endpoint";

interface SavedPolicyPackage {
  id: string;
  name: string;
  kind: PolicyPackageKind;
  uri: string;
  robotEmbodiment?: RobotEmbodiment;
}

interface EvalRunFormState {
  briefId: string;
  policyId: string;
  addNewPolicy: boolean;
  newPolicyName: string;
  newPolicyKind: PolicyPackageKind;
  newPolicyUri: string;
  interfaceContract: string;
  fallbackStrategy: string;
  assumedOperatingEnvelope: string;
  contactName: string;
  contactEmail: string;
  contactCompany: string;
  budgetBucket: BudgetBucket;
}

const POLICY_LIBRARY_STORAGE_KEY = "bp_pilot_exchange_policy_library_v3";

const deploymentGapHighlights = [
  {
    id: "highlight-01",
    title: "The site details matter",
    detail:
      "A team can look strong in the lab and still struggle once the real site shows up.",
  },
  {
    id: "highlight-02",
    title: "The brief is already scoped",
    detail:
      "These opportunities start with a site and workflow that have already been reviewed.",
  },
  {
    id: "highlight-03",
    title: "Clear scorecards save time",
    detail:
      "A simple scorecard catches mismatch before months of pilot cost and disruption.",
  },
];

const exchangeClientSegments = [
  {
    id: "segment-01",
    label: "Best fit",
    title: "Robot teams reviewing a qualified site",
    detail: "Teams that want a cleaner read before they commit to travel, integration work, or a pilot.",
  },
  {
    id: "segment-02",
    label: "Second fit",
    title: "Operators opening the right brief",
    detail: "Sites that want the right teams reviewing a scoped workflow instead of random inbound interest.",
  },
  {
    id: "segment-03",
    label: "Channel",
    title: "Integrators and advisors",
    detail: "Integrators who need a simple pre-pilot check before they commit more engineering work.",
  },
];

const adaptationModes = [
  {
    id: "mode-01",
    title: "Mode 1: Review only",
    detail:
      "Start by reviewing the qualified site and deciding whether it is worth a deeper check.",
  },
  {
    id: "mode-02",
    title: "Mode 2: Site-specific data",
    detail:
      "If the site is close, Blueprint can generate the site-specific data needed for another pass.",
  },
  {
    id: "mode-03",
    title: "Mode 3: Managed tuning",
    detail:
      "For supported stacks, Blueprint can do the tuning work after qualification and offline checks.",
  },
];

const defaultEvalRunFormState: EvalRunFormState = {
  briefId: "",
  policyId: "",
  addNewPolicy: true,
  newPolicyName: "",
  newPolicyKind: "Docker image",
  newPolicyUri: "",
  interfaceContract: "",
  fallbackStrategy: "",
  assumedOperatingEnvelope: "",
  contactName: "",
  contactEmail: "",
  contactCompany: "",
  budgetBucket: "Undecided/Unsure",
};

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200/60 [mask-image:radial-gradient(80%_80%_at_top_right,black,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-policy-exchange"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern-policy-exchange)" />
    </svg>
  );
}

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function getUTMParams() {
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

function parseContactName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const [first, ...rest] = trimmed.split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") || "Unknown" };
}

function inferCompanyFromEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  return trimmed.split("@")[1] || "";
}

function readPolicyLibrary(): SavedPolicyPackage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(POLICY_LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedPolicyPackage[];
  } catch {
    return [];
  }
}

function formatThresholdDelta(successRate: number, threshold: number) {
  const delta = Math.round(successRate - threshold);
  return {
    label: `${delta >= 0 ? "+" : ""}${delta}%`,
    isPositive: delta >= 0,
  };
}

function StatusIcon({ status }: { status: string }) {
  if (status === "Passed" || status === "Ready") {
    return <CheckCircle2 className="h-4 w-4 text-zinc-900" />;
  }
  if (status === "Partial" || status === "In Progress" || status === "Conditional") {
    return <CircleDashed className="h-4 w-4 text-zinc-500" />;
  }
  return <XCircle className="h-4 w-4 text-zinc-400" />;
}

export default function PilotExchange() {
  const [activeTab, setActiveTab] = useState<ExchangeTab>("briefs");

  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<FilterValue<PilotLocationType>>("all");
  const [embodimentFilter, setEmbodimentFilter] = useState<FilterValue<RobotEmbodiment>>("all");
  const [timelineFilter, setTimelineFilter] = useState<FilterValue<DeploymentTimeline>>("all");
  const [privacyFilter, setPrivacyFilter] = useState<FilterValue<PrivacyMode>>("all");
  const [showFilters, setShowFilters] = useState(false);

  const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false);

  const [policyLibrary, setPolicyLibrary] = useState<SavedPolicyPackage[]>(() => readPolicyLibrary());
  const [evalRunForm, setEvalRunForm] = useState<EvalRunFormState>(defaultEvalRunFormState);

  const [policyStatus, setPolicyStatus] = useState<SubmissionStatus>("idle");
  const [policyMessage, setPolicyMessage] = useState("");

  useEffect(() => {
    analyticsEvents.pilotExchangeView();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(POLICY_LIBRARY_STORAGE_KEY, JSON.stringify(policyLibrary));
    } catch {
      // Ignore
    }
  }, [policyLibrary]);

  const leaderboardByBriefId = useMemo(() => {
    const grouped = new Map<string, EvalLeaderboardEntry[]>();
    for (const entry of evalLeaderboardEntries) {
      const current = grouped.get(entry.briefId) ?? [];
      current.push(entry);
      grouped.set(entry.briefId, current);
    }
    for (const entries of grouped.values()) {
      entries.sort((a, b) => a.rank - b.rank);
    }
    return grouped;
  }, []);

  const selectedEvalBrief = useMemo<LocationBrief | null>(() => {
    if (!evalRunForm.briefId) return null;
    return locationBriefs.find((brief) => brief.id === evalRunForm.briefId) ?? null;
  }, [evalRunForm.briefId]);

  const selectedEvalLeaderboard = useMemo(() => {
    if (!evalRunForm.briefId) return [] as EvalLeaderboardEntry[];
    return leaderboardByBriefId.get(evalRunForm.briefId) ?? [];
  }, [evalRunForm.briefId, leaderboardByBriefId]);

  const selectedEvalPolicy = useMemo<SavedPolicyPackage | null>(() => {
    if (!evalRunForm.policyId) return null;
    return policyLibrary.find((policy) => policy.id === evalRunForm.policyId) ?? null;
  }, [evalRunForm.policyId, policyLibrary]);

  useEffect(() => {
    if (!evalRunForm.contactEmail.trim() || evalRunForm.contactCompany.trim()) return;
    const inferred = inferCompanyFromEmail(evalRunForm.contactEmail);
    if (!inferred) return;
    setEvalRunForm((prev) => prev.contactCompany.trim() ? prev : { ...prev, contactCompany: inferred });
  }, [evalRunForm.contactCompany, evalRunForm.contactEmail]);

  const openEvalDialog = useCallback(
    (briefId?: string) => {
      analyticsEvents.pilotExchangeOpenPolicyForm();
      setPolicyStatus("idle");
      setPolicyMessage("");

      setEvalRunForm((prev) => {
        const hasSavedPolicies = policyLibrary.length > 0;
        const nextBriefId = typeof briefId === "string" ? briefId : prev.briefId;
        const nextPolicyId = hasSavedPolicies ? prev.policyId || policyLibrary[0]?.id || "" : "";
        return {
          ...defaultEvalRunFormState,
          briefId: nextBriefId || "",
          policyId: nextPolicyId,
          addNewPolicy: !hasSavedPolicies,
          contactName: prev.contactName,
          contactEmail: prev.contactEmail,
          contactCompany: prev.contactCompany || inferCompanyFromEmail(prev.contactEmail),
        };
      });
      setIsPolicyDialogOpen(true);
    },
    [policyLibrary]
  );

  const emitFilterEvent = useCallback((type: string, value: string) => {
    analyticsEvents.pilotExchangeFilterApply(type, value || "all");
  }, []);

  const filteredLocationBriefs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return locationBriefs.filter((brief) => {
      const matchesQuery = !query || brief.operatorAlias.toLowerCase().includes(query) || brief.objective.toLowerCase().includes(query);
      const matchesLocation = locationFilter === "all" || brief.locationType === locationFilter;
      const matchesEmbodiment = embodimentFilter === "all" || brief.robotEmbodiment === embodimentFilter;
      const matchesTimeline = timelineFilter === "all" || brief.timeline === timelineFilter;
      const matchesPrivacy = privacyFilter === "all" || brief.privacyMode === privacyFilter;
      return matchesQuery && matchesLocation && matchesEmbodiment && matchesTimeline && matchesPrivacy;
    });
  }, [embodimentFilter, locationFilter, privacyFilter, searchQuery, timelineFilter]);

  const filteredPolicySubmissions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return policySubmissions.filter((submission) => {
      const matchesQuery = !query || submission.teamAlias.toLowerCase().includes(query) || submission.summary.toLowerCase().includes(query);
      const matchesLocation = locationFilter === "all" || submission.locationType === locationFilter;
      const matchesEmbodiment = embodimentFilter === "all" || submission.robotEmbodiment === embodimentFilter;
      const matchesTimeline = timelineFilter === "all" || submission.timeline === timelineFilter;
      const matchesPrivacy = privacyFilter === "all" || submission.privacyMode === privacyFilter;
      return matchesQuery && matchesLocation && matchesEmbodiment && matchesTimeline && matchesPrivacy;
    });
  }, [embodimentFilter, locationFilter, privacyFilter, searchQuery, timelineFilter]);

  const submitInboundRequest = useCallback(
    async (args: { form: BaseLeadFormState; helpWith: HelpWithOption; details: Record<string, unknown> }) => {
      const payload: InboundRequestPayload = {
        requestId: generateRequestId(),
        ...args.form,
        helpWith: [args.helpWith],
        details: JSON.stringify(args.details),
        context: {
          sourcePageUrl: typeof window !== "undefined" ? window.location.href : "/qualified-opportunities",
          referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
          utm: getUTMParams(),
          timezoneOffset: new Date().getTimezoneOffset(),
          locale: typeof navigator !== "undefined" ? navigator.language : undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        },
      };

      const response = await fetch("/api/inbound-request", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as SubmitInboundRequestResponse;
      if (!response.ok || !body.ok) throw new Error(body.message || "Unable to submit request");
    },
    []
  );

  const handleEvalRunSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEvalBrief) return setPolicyStatus("error"), setPolicyMessage("Select a qualified site.");
    if (!evalRunForm.interfaceContract.trim()) return setPolicyStatus("error"), setPolicyMessage("Document the interface contract.");
    if (!evalRunForm.fallbackStrategy.trim()) return setPolicyStatus("error"), setPolicyMessage("Define your fallback strategy.");
    if (!evalRunForm.assumedOperatingEnvelope.trim()) return setPolicyStatus("error"), setPolicyMessage("Declare the assumed envelope.");
    if (!evalRunForm.contactName.trim() || !evalRunForm.contactEmail.trim()) return setPolicyStatus("error"), setPolicyMessage("Contact details are required.");

    const resolvedCompany = evalRunForm.contactCompany.trim() || inferCompanyFromEmail(evalRunForm.contactEmail);
    let resolvedPolicy: SavedPolicyPackage | null = null;

    if (evalRunForm.addNewPolicy) {
      if (!evalRunForm.newPolicyName.trim() || !evalRunForm.newPolicyUri.trim()) return setPolicyStatus("error"), setPolicyMessage("Provide policy details.");
      const newPolicy: SavedPolicyPackage = {
        id: `policy-${generateRequestId()}`,
        name: evalRunForm.newPolicyName.trim(),
        kind: evalRunForm.newPolicyKind,
        uri: evalRunForm.newPolicyUri.trim(),
        robotEmbodiment: selectedEvalBrief.robotEmbodiment,
      };
      setPolicyLibrary((prev) => [newPolicy, ...prev].slice(0, 25));
      resolvedPolicy = newPolicy;
    } else {
      resolvedPolicy = selectedEvalPolicy;
    }

    if (!resolvedPolicy) return setPolicyStatus("error"), setPolicyMessage("Select or create a policy.");

    setPolicyStatus("loading");
    setPolicyMessage("");

    const parsedName = parseContactName(evalRunForm.contactName);
    const leadForm: BaseLeadFormState = {
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      company: resolvedCompany,
      roleTitle: "Robotics Engineer",
      email: evalRunForm.contactEmail,
      budgetBucket: evalRunForm.budgetBucket,
    };

    try {
      await submitInboundRequest({
        form: leadForm,
        helpWith: "pilot-exchange-policy-submission",
        details: {
          submissionType: "eval-run",
          briefId: selectedEvalBrief.id,
          policy: resolvedPolicy,
          interfaceContract: evalRunForm.interfaceContract.trim(),
          fallbackStrategy: evalRunForm.fallbackStrategy.trim(),
          assumedOperatingEnvelope: evalRunForm.assumedOperatingEnvelope.trim(),
        },
      });

      analyticsEvents.pilotExchangeSubmitPolicy("success");
      setPolicyStatus("success");
      setPolicyMessage("Evaluation queued successfully. We will email your scorecard.");

      setEvalRunForm((prev) => ({
        ...defaultEvalRunFormState,
        briefId: prev.briefId,
        policyId: resolvedPolicy?.id || "",
        addNewPolicy: false,
        contactName: prev.contactName,
        contactEmail: prev.contactEmail,
        contactCompany: resolvedCompany,
      }));

      setTimeout(() => { setIsPolicyDialogOpen(false); setPolicyStatus("idle"); setPolicyMessage(""); }, 1500);
    } catch (error) {
      analyticsEvents.pilotExchangeSubmitPolicy("error");
      setPolicyStatus("error");
      setPolicyMessage(error instanceof Error ? error.message : "Unable to queue evaluation run.");
    }
  };

  return (
    <>
      <SEO
        title="Qualified Opportunities | Blueprint"
        description="Qualified site briefs that robot teams can review, evaluate, and respond to after site qualification."
        canonical="/qualified-opportunities"
      />
      <div className="relative min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-200 selection:text-zinc-900">
        <DotPattern />

        {/* Access Banner */}
        <div className="border-b border-zinc-200 bg-zinc-50 py-3 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-zinc-700">
              <Lock className="h-4 w-4" />
              <span>These sites and workflows have already been scoped by Blueprint.</span>
            </div>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
            >
              See Pricing
            </a>
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          {/* Hero */}
          <section className="mb-16 max-w-3xl">
            <div className="mb-3 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              After site qualification
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-950 mb-6">
              Qualified opportunities for robot teams.
            </h1>
            <p className="text-lg text-zinc-600 mb-8 leading-relaxed">
              These are sites and workflows Blueprint has already scoped. Robot teams can review
              the brief, run a check, and respond with less guesswork.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button
                onClick={() => openEvalDialog()}
                className="bg-zinc-900 text-white hover:bg-zinc-800 px-6 py-5 text-sm font-medium"
              >
                Check a qualified site
              </Button>
              <a href="#pricing" className="text-sm font-medium text-zinc-900 hover:text-zinc-700 underline underline-offset-4 decoration-zinc-300">
                See pricing
              </a>
              <a href="/qualified-opportunities-guide" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-4 decoration-zinc-300">
                See how qualification works
              </a>
            </div>
          </section>

          <section id="pricing" className="mb-16 rounded-[2rem] border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Simple pricing</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950">Pay for the job you need.</h2>
              <p className="mt-3 text-base leading-7 text-zinc-600">
                This page starts after qualification. Robot teams pay for access to better
                opportunities and only buy deeper work when the site is real.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Before this page</p>
                <p className="mt-2 text-2xl font-bold text-emerald-950">Readiness Pack</p>
                <p className="mt-2 text-sm text-emerald-900">Site operators buy qualification first. This page opens only after a site has been scoped and reviewed.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Robot teams</p>
                <p className="mt-2 text-2xl font-bold text-zinc-950">Pay for the next layer</p>
                <p className="mt-2 text-sm text-zinc-600">Start with the brief, then buy technical evaluation or deployment prep only when justified.</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-200 bg-white">
              {simplePricingOptions.map((option, index) => (
                <div
                  key={option.id}
                  className={`grid gap-5 p-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-start ${
                    index < simplePricingOptions.length - 1 ? "border-b border-zinc-200" : ""
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{option.step}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="text-2xl font-bold text-zinc-950">{option.name}</h2>
                      <span className="text-sm text-zinc-500">({option.internalName})</span>
                    </div>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">{option.summary}</p>
                    <ul className="mt-4 space-y-2">
                      {option.includes.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-zinc-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-900" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                    <p className="text-sm font-medium text-zinc-500">Price</p>
                    <p className="mt-2 text-3xl font-bold text-zinc-950">{option.price}</p>
                    <p className="mt-1 text-sm text-zinc-500">{option.unit}</p>
                    {option.id === "qualified-opportunity" ? (
                      <Button onClick={() => openEvalDialog()} className="mt-5 w-full bg-zinc-900 text-white hover:bg-zinc-800">
                        Review this site
                      </Button>
                    ) : (
                      <a
                        href={`/contact?interest=${getPricingContactInterest(option.id)}&source=qualified-opportunities`}
                        className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
                      >
                        Talk to sales
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Enterprise only</p>
              <h3 className="mt-2 text-xl font-bold text-zinc-950">Private site terms are custom.</h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                If a site needs private access, exclusivity, licensing changes, or longer managed work, that becomes a separate enterprise deal. It is not part of the standard exchange path.
              </p>
              <a
                href="/contact?interest=deeper-evaluation&source=qualified-opportunities"
                className="mt-5 inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
              >
                Discuss private terms
              </a>
            </div>
          </section>

          {/* Simple How-it-Works */}
          <section className="mb-16">
            <h2 className="text-xl font-bold text-zinc-900 mb-6 border-b border-zinc-200 pb-2">How this page works</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <span className="block text-zinc-400 font-mono text-sm mb-2">01</span>
                <h3 className="font-semibold text-zinc-900 mb-1">Review a qualified site</h3>
                <p className="text-sm text-zinc-600">Start with a site and workflow Blueprint has already scoped.</p>
              </div>
              <div>
                <span className="block text-zinc-400 font-mono text-sm mb-2">02</span>
                <h3 className="font-semibold text-zinc-900 mb-1">Share your robot package</h3>
                <p className="text-sm text-zinc-600">Provide the package you want checked on that site.</p>
              </div>
              <div>
                <span className="block text-zinc-400 font-mono text-sm mb-2">03</span>
                <h3 className="font-semibold text-zinc-900 mb-1">Run the check</h3>
                <p className="text-sm text-zinc-600">Blueprint runs the agreed tasks, edge cases, and pass rules.</p>
              </div>
              <div>
                <span className="block text-zinc-400 font-mono text-sm mb-2">04</span>
                <h3 className="font-semibold text-zinc-900 mb-1">Get the Scorecard</h3>
                <p className="text-sm text-zinc-600">Receive a clear scorecard and next-step recommendation.</p>
              </div>
            </div>
          </section>

          <section className="mb-16">
            <h2 className="text-xl font-bold text-zinc-900 mb-6 border-b border-zinc-200 pb-2">Why teams use qualified briefs</h2>
            <p className="text-sm text-zinc-600 mb-6">
              The point is simple: teams waste less time when the site has already been scoped and the workflow is already clear.
            </p>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {deploymentGapHighlights.map((item) => (
                <div key={item.id} className="border border-zinc-200 rounded-xl p-5 bg-white">
                  <h3 className="font-semibold text-zinc-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-zinc-600">{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {adaptationModes.map((mode) => (
                <div
                  key={mode.id}
                  className={
                    mode.id === "mode-02"
                      ? "border-2 border-zinc-900 rounded-xl p-5 bg-white"
                      : "border border-zinc-200 rounded-xl p-5 bg-white"
                  }
                >
                  <h3 className="font-semibold text-zinc-900 mb-2">{mode.title}</h3>
                  <p className="text-sm text-zinc-600">{mode.detail}</p>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {exchangeClientSegments.map((segment) => (
                <div key={segment.id} className="border border-zinc-200 rounded-xl p-5 bg-zinc-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">{segment.label}</p>
                  <h3 className="font-semibold text-zinc-900 mb-2">{segment.title}</h3>
                  <p className="text-sm text-zinc-600">{segment.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Exchange Explorer */}
          <section id="qualified-opportunities">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">Qualified opportunities</h2>
                <p className="text-sm text-zinc-600 mt-1">Review qualified sites and team results.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="bg-white text-zinc-800 border-zinc-300 md:w-auto w-full"
              >
                <Filter className="w-4 h-4 mr-2" />
                {showFilters ? "Hide filters" : "Filter results"}
              </Button>
            </div>

            {/* Filter Bar */}
            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 mb-6 bg-zinc-50 border border-zinc-200 rounded-lg">
                <div className="relative col-span-1 lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    placeholder="Search by site, region, or task..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white border-zinc-300 focus-visible:ring-zinc-900"
                  />
                </div>
                <select className="border border-zinc-300 rounded-md text-sm px-3 py-2 bg-white" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value as any)}>
                  <option value="all">All site types</option>
                  {pilotLocationTypes.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <select className="border border-zinc-300 rounded-md text-sm px-3 py-2 bg-white" value={embodimentFilter} onChange={(e) => setEmbodimentFilter(e.target.value as any)}>
                  <option value="all">All robot types</option>
                  {pilotEmbodiments.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <select className="border border-zinc-300 rounded-md text-sm px-3 py-2 bg-white" value={timelineFilter} onChange={(e) => setTimelineFilter(e.target.value as any)}>
                  <option value="all">All timelines</option>
                  {pilotTimelines.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as ExchangeTab)} className="mt-2">
              <TabsList className="bg-transparent border-b border-zinc-200 w-full justify-start rounded-none p-0 h-auto gap-6">
                <TabsTrigger 
                  value="briefs" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 text-sm font-medium text-zinc-500 data-[state=active]:text-zinc-900"
                >
                  Qualified sites
                </TabsTrigger>
                <TabsTrigger 
                  value="policies" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 text-sm font-medium text-zinc-500 data-[state=active]:text-zinc-900"
                >
                  Team results
                </TabsTrigger>
              </TabsList>

              <TabsContent value="briefs" className="mt-6 space-y-4">
                {filteredLocationBriefs.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-300 rounded-lg">No qualified sites match your criteria.</div>
                ) : (
                  filteredLocationBriefs.map((brief) => {
                    const leaderboard = leaderboardByBriefId.get(brief.id) ?? [];
                    return (
                      <div key={brief.id} className="group border border-zinc-200 rounded-xl bg-white overflow-hidden hover:border-zinc-300 transition-colors">
                        <div className="p-6 sm:p-8 grid md:grid-cols-[1fr_300px] gap-8">
                          {/* Left Details */}
                          <div>
                            <div className="mb-5 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                              <img
                                src={brief.thumbnailUrl}
                                alt={brief.thumbnailAlt}
                                loading="lazy"
                                className="h-40 w-full object-cover"
                              />
                            </div>
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-xl font-bold text-zinc-900">{brief.operatorAlias}</h3>
                              {brief.privacyMode === "Anonymized" && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-medium">
                                  <EyeOff className="w-3 h-3" /> Anonymized
                                </span>
                              )}
                            </div>
                            <p className="text-zinc-700 mb-4">{brief.objective}</p>
                            
                            <div className="flex flex-wrap gap-2 mb-6">
                              <span className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 text-zinc-600 bg-zinc-50">
                                {brief.locationType}
                              </span>
                              <span className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 text-zinc-600 bg-zinc-50">
                                {brief.robotEmbodiment}
                              </span>
                              <span className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 text-zinc-600 bg-zinc-50">
                                {brief.timeline}
                              </span>
                              <span className="text-xs px-2.5 py-1 rounded-md border-zinc-900 border text-zinc-900 bg-zinc-50 font-medium">
                                Threshold: ≥ {brief.qualifyingSuccessRateThreshold}%
                              </span>
                            </div>

                            <div className="text-sm text-zinc-600 space-y-1">
                              <p><span className="font-medium text-zinc-900">Primary tasks:</span> {brief.primaryTasks.join(", ")}</p>
                              <p><span className="font-medium text-zinc-900">Region:</span> {brief.region} ({brief.footprintSqFt.toLocaleString()} sq ft)</p>
                            </div>
                          </div>

                          {/* Right Action & Leaderboard Summary */}
                          <div className="flex flex-col justify-between bg-zinc-50 p-5 rounded-lg border border-zinc-100">
                            <div>
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-sm font-semibold text-zinc-900">Top teams</span>
                                <span className="text-xs text-zinc-500">{leaderboard.length} total</span>
                              </div>
                              {leaderboard.length > 0 ? (
                                <ul className="space-y-3">
                                  {leaderboard.slice(0, 3).map((entry) => {
                                    const delta = formatThresholdDelta(entry.successRate, brief.qualifyingSuccessRateThreshold);
                                    return (
                                      <li key={entry.id} className="flex justify-between items-center text-sm border-b border-zinc-200/50 pb-2 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-zinc-400 font-mono text-xs">#{entry.rank}</span>
                                          <span className="font-medium text-zinc-800">{entry.entrant}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-zinc-900">{entry.successRate}%</span>
                                          <span className={`text-xs ${delta.isPositive ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                                            ({delta.label})
                                          </span>
                                        </div>
                                      </li>
                                    )
                                  })}
                                </ul>
                              ) : (
                                <p className="text-sm text-zinc-500 italic">No public evaluations yet.</p>
                              )}
                            </div>

                            <Button
                              onClick={() => openEvalDialog(brief.id)}
                              className="w-full mt-6 bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-100"
                            >
                              Check this site
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="policies" className="mt-6 space-y-4">
                {filteredPolicySubmissions.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-300 rounded-lg">No team results match your criteria.</div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {filteredPolicySubmissions.map((sub) => (
                      <div key={sub.id} className="border border-zinc-200 rounded-xl p-6 bg-white flex flex-col justify-between">
                        <div className="mb-4 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                          <img
                            src={sub.thumbnailUrl}
                            alt={sub.thumbnailAlt}
                            loading="lazy"
                            className="h-36 w-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-zinc-900">{sub.teamAlias}</h3>
                            <span className="font-mono font-semibold text-zinc-900 bg-zinc-100 px-2 py-1 rounded text-sm">
                              {sub.successRate}%
                            </span>
                          </div>
                          <p className="text-sm text-zinc-600 mb-4">{sub.summary}</p>
                          <div className="flex flex-wrap gap-2 mb-4 text-xs text-zinc-500">
                            <span className="px-2 py-1 rounded bg-zinc-50 border border-zinc-200">{sub.locationType}</span>
                            <span className="px-2 py-1 rounded bg-zinc-50 border border-zinc-200">{sub.robotEmbodiment}</span>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-zinc-100 flex justify-between items-center text-sm">
                          <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                            <StatusIcon status={sub.readiness} />
                            Readiness: {sub.readiness}
                          </span>
                          <span className="text-zinc-400 flex items-center gap-1 text-xs">
                            <Lock className="w-3 h-3" /> Artifacts Gated
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </section>
        </main>
      </div>

      {/* Eval Submission Modal */}
      <Dialog open={isPolicyDialogOpen} onOpenChange={setIsPolicyDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-0">
          <div className="p-6 sm:p-8 border-b border-zinc-100 bg-zinc-50 sticky top-0 z-10">
            <DialogTitle className="text-xl font-bold">Check a qualified site</DialogTitle>
            <DialogDescription className="mt-1">Select a qualified site and provide your robot package for the next check.</DialogDescription>
          </div>

          <form onSubmit={handleEvalRunSubmit} className="p-6 sm:p-8 space-y-8">
            {/* Step 1: Environment */}
            <section>
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-xs">1</span>
                Qualified site
              </h3>
              <select
                required
                value={evalRunForm.briefId}
                onChange={(e) => setEvalRunForm((p) => ({ ...p, briefId: e.target.value }))}
                className="w-full h-11 px-3 border border-zinc-300 rounded-md bg-white text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
              >
                <option value="">Select a qualified site...</option>
                {locationBriefs.map((brief) => (
                  <option key={brief.id} value={brief.id}>
                    {brief.operatorAlias} — {brief.robotEmbodiment}
                  </option>
                ))}
              </select>
              {selectedEvalBrief && (
                <div className="mt-3 p-4 border border-zinc-200 bg-zinc-50 rounded-lg flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-zinc-700 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Required Pass Threshold: ≥ {selectedEvalBrief.qualifyingSuccessRateThreshold}%</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Scoring above this threshold signals readiness for pilot discussions.</p>
                  </div>
                </div>
              )}
            </section>

            {/* Step 2: Policy */}
            <section>
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-xs">2</span>
                Robot package
              </h3>
              
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="policyMode" checked={!evalRunForm.addNewPolicy} onChange={() => setEvalRunForm(p => ({ ...p, addNewPolicy: false }))} disabled={policyLibrary.length === 0} />
                  Existing Package
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="policyMode" checked={evalRunForm.addNewPolicy} onChange={() => setEvalRunForm(p => ({ ...p, addNewPolicy: true }))} />
                  Add New Package
                </label>
              </div>

              {evalRunForm.addNewPolicy ? (
                <div className="grid gap-4 sm:grid-cols-2 bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-500 font-semibold uppercase">Name</Label>
                    <Input placeholder="e.g., aisle-reset-v2" value={evalRunForm.newPolicyName} onChange={(e) => setEvalRunForm(p => ({ ...p, newPolicyName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-500 font-semibold uppercase">Type</Label>
                    <select value={evalRunForm.newPolicyKind} onChange={(e) => setEvalRunForm(p => ({ ...p, newPolicyKind: e.target.value as PolicyPackageKind }))} className="w-full h-10 px-3 border border-zinc-300 rounded-md bg-white text-sm">
                      <option value="Docker image">Docker Image</option>
                      <option value="Checkpoint URL">Checkpoint URL</option>
                      <option value="API endpoint">API Endpoint</option>
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs text-zinc-500 font-semibold uppercase">URI / Endpoint</Label>
                    <Input placeholder="docker://ghcr.io/org/policy:tag" value={evalRunForm.newPolicyUri} onChange={(e) => setEvalRunForm(p => ({ ...p, newPolicyUri: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <select value={evalRunForm.policyId} onChange={(e) => setEvalRunForm(p => ({ ...p, policyId: e.target.value }))} className="w-full h-11 px-3 border border-zinc-300 rounded-md bg-white">
                  {policyLibrary.map((policy) => (
                    <option key={policy.id} value={policy.id}>{policy.name} ({policy.kind})</option>
                  ))}
                </select>
              )}
            </section>

            {/* Step 3: Context Details */}
            <section>
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-xs">3</span>
                Technical details
              </h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-zinc-700 font-medium mb-1.5 block">Interface Contract</Label>
                  <Textarea required placeholder="Describe APIs, topics, or events used..." rows={2} value={evalRunForm.interfaceContract} onChange={(e) => setEvalRunForm(p => ({ ...p, interfaceContract: e.target.value }))} className="resize-none" />
                </div>
                <div>
                  <Label className="text-zinc-700 font-medium mb-1.5 block">Fallback Strategy</Label>
                  <Textarea required placeholder="How your system handles blocks or failures..." rows={2} value={evalRunForm.fallbackStrategy} onChange={(e) => setEvalRunForm(p => ({ ...p, fallbackStrategy: e.target.value }))} className="resize-none" />
                </div>
                <div>
                  <Label className="text-zinc-700 font-medium mb-1.5 block">Assumed Operating Envelope</Label>
                  <Textarea required placeholder="Hours, traffic assumptions, speed limits..." rows={2} value={evalRunForm.assumedOperatingEnvelope} onChange={(e) => setEvalRunForm(p => ({ ...p, assumedOperatingEnvelope: e.target.value }))} className="resize-none" />
                </div>
              </div>
            </section>

            {/* Step 4: Contact */}
            <section>
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-xs">4</span>
                Your Details
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input required placeholder="Jane Doe" value={evalRunForm.contactName} onChange={(e) => setEvalRunForm(p => ({ ...p, contactName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Work Email</Label>
                  <Input required type="email" placeholder="jane@robotics.com" value={evalRunForm.contactEmail} onChange={(e) => setEvalRunForm(p => ({ ...p, contactEmail: e.target.value }))} />
                </div>
              </div>
            </section>

            {/* Submit */}
            <div className="pt-4 border-t border-zinc-200">
              {policyMessage && (
                <div className={`p-3 mb-4 text-sm rounded-md ${policyStatus === 'success' ? 'bg-zinc-100 text-zinc-900 border border-zinc-200' : 'bg-white border border-zinc-300 text-zinc-900'}`}>
                  {policyMessage}
                </div>
              )}
              <Button type="submit" disabled={policyStatus === "loading"} className="w-full bg-zinc-900 text-white hover:bg-zinc-800 h-12 text-base font-semibold">
                {policyStatus === "loading" ? "Submitting check..." : "Submit check"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
