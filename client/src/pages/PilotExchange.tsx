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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Eye,
  EyeOff,
  Filter,
  Lock,
  Search,
  ShieldCheck,
  Unlock,
  XCircle,
} from "lucide-react";

type FilterValue<T extends string> = "all" | T;
type SubmissionStatus = "idle" | "loading" | "success" | "error";
type ExchangeTab = "briefs" | "policies";
type AccessPlan = "evaluation" | "subscription" | "training";

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
const EVAL_ACCESS_STORAGE_KEY = "bp_exchange_eval_access_v1";
const SUBSCRIPTION_ACCESS_STORAGE_KEY = "bp_exchange_subscription_access_v1";
const TRAINING_ACCESS_STORAGE_KEY = "bp_exchange_training_access_v1";

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

function readAccessFlag(storageKey: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(storageKey) === "true";
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
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);

  const [policyLibrary, setPolicyLibrary] = useState<SavedPolicyPackage[]>(() => readPolicyLibrary());
  const [evalRunForm, setEvalRunForm] = useState<EvalRunFormState>(defaultEvalRunFormState);

  const [policyStatus, setPolicyStatus] = useState<SubmissionStatus>("idle");
  const [policyMessage, setPolicyMessage] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<AccessPlan | null>(null);

  const [evaluationAccessUnlocked, setEvaluationAccessUnlocked] = useState<boolean>(() => readAccessFlag(EVAL_ACCESS_STORAGE_KEY));
  const [subscriptionAccessUnlocked, setSubscriptionAccessUnlocked] = useState<boolean>(() => readAccessFlag(SUBSCRIPTION_ACCESS_STORAGE_KEY));
  const [trainingAccessUnlocked, setTrainingAccessUnlocked] = useState<boolean>(() => readAccessFlag(TRAINING_ACCESS_STORAGE_KEY));

  useEffect(() => {
    analyticsEvents.pilotExchangeView();
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const access = params.get("access");

    if (checkout === "success" && access === "evaluation") {
      window.localStorage.setItem(EVAL_ACCESS_STORAGE_KEY, "true");
      setEvaluationAccessUnlocked(true);
      setCheckoutMessage("Evaluation access unlocked. You can now submit policies.");
    }

    if (checkout === "success" && access === "subscription") {
      window.localStorage.setItem(EVAL_ACCESS_STORAGE_KEY, "true");
      window.localStorage.setItem(SUBSCRIPTION_ACCESS_STORAGE_KEY, "true");
      setEvaluationAccessUnlocked(true);
      setSubscriptionAccessUnlocked(true);
      setCheckoutMessage("Team subscription active. Evaluation access is included.");
    }

    if (checkout === "success" && access === "training") {
      window.localStorage.setItem(EVAL_ACCESS_STORAGE_KEY, "true");
      window.localStorage.setItem(SUBSCRIPTION_ACCESS_STORAGE_KEY, "true");
      window.localStorage.setItem(TRAINING_ACCESS_STORAGE_KEY, "true");
      setEvaluationAccessUnlocked(true);
      setSubscriptionAccessUnlocked(true);
      setTrainingAccessUnlocked(true);
      setCheckoutMessage("Training subscription active. Evaluation access is included.");
    }

    if (checkout === "cancel") {
      setCheckoutError("Checkout was canceled. Please complete the purchase to proceed.");
    }

    if (checkout) {
      params.delete("checkout");
      params.delete("access");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
      window.history.replaceState({}, "", nextUrl);
    }
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
      if (!evaluationAccessUnlocked) {
        setIsAccessDialogOpen(true);
        setPolicyMessage("Purchase required before evaluation submissions.");
        return;
      }
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
    [evaluationAccessUnlocked, policyLibrary]
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
          sourcePageUrl: typeof window !== "undefined" ? window.location.href : "/pilot-exchange",
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

  const startCheckout = async (plan: AccessPlan) => {
    try {
      setCheckoutLoadingPlan(plan);
      setCheckoutError("");
      setCheckoutMessage("");

      const pricing = plan === "evaluation"
        ? { sku: "exchange-pro-eval", title: "Pilot Exchange Pro Site Evaluation", price: 4900, successPath: "/pilot-exchange?checkout=success&access=evaluation" }
        : plan === "subscription"
        ? { sku: "exchange-team-subscription", title: "Robotics Team Subscription", price: 1200, successPath: "/pilot-exchange?checkout=success&access=subscription" }
        : { sku: "exchange-training-subscription", title: "Training Subscription", price: 2400, successPath: "/pilot-exchange?checkout=success&access=training" };

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          sessionType: "marketplace",
          successPath: pricing.successPath,
          cancelPath: "/pilot-exchange?checkout=cancel",
          marketplaceItem: { sku: pricing.sku, title: pricing.title, description: "Pilot Exchange Access", price: pricing.price, quantity: 1, itemType: "dataset" },
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Unable to start checkout.");
      if (body?.sessionUrl) {
        window.location.href = body.sessionUrl;
        return;
      }
      throw new Error("Checkout session was created without a redirect URL.");
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to start checkout.");
    } finally {
      setCheckoutLoadingPlan(null);
    }
  };

  const handleEvalRunSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!evaluationAccessUnlocked) {
      setPolicyStatus("error");
      setPolicyMessage("Evaluation access is locked. Please purchase access first.");
      setIsAccessDialogOpen(true);
      return;
    }
    if (!selectedEvalBrief) return setPolicyStatus("error"), setPolicyMessage("Select a digital twin.");
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
        title="Pilot Exchange | Evaluate Robotics Policies"
        description="Marketplace for robotics teams to evaluate policies in high-fidelity digital twins before physical pilot deployments."
        canonical="/pilot-exchange"
      />
      <div className="relative min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-200 selection:text-zinc-900">
        <DotPattern />

        {/* Access Banner */}
        <div className="border-b border-zinc-200 bg-zinc-50 py-3 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-zinc-900 flex items-center gap-1.5">
                {evaluationAccessUnlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                Your Access Status
              </span>
              <div className="hidden sm:flex items-center gap-3 text-zinc-600">
                <span className={evaluationAccessUnlocked ? "text-zinc-900 font-medium" : ""}>Evaluations</span>
                <span>•</span>
                <span className={subscriptionAccessUnlocked ? "text-zinc-900 font-medium" : ""}>Subscriptions</span>
                <span>•</span>
                <span className={trainingAccessUnlocked ? "text-zinc-900 font-medium" : ""}>Training</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAccessDialogOpen(true)}
              className="bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100"
            >
              Manage Billing & Access
            </Button>
          </div>
        </div>

        <main className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          {/* Hero */}
          <section className="mb-16 max-w-3xl">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-950 mb-6">
              Validate your robotics policies in digital reality.
            </h1>
            <p className="text-lg text-zinc-600 mb-8 leading-relaxed">
              Upload your robot policy packages and evaluate them against calibrated digital twins of real-world environments. Get standardized scorecards and prove your system's readiness before spending on live pilots.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button
                onClick={() => openEvalDialog()}
                className="bg-zinc-900 text-white hover:bg-zinc-800 px-6 py-5 text-sm font-medium"
              >
                {evaluationAccessUnlocked ? "Run an Evaluation" : "Unlock Evaluation Access"}
              </Button>
              <a href="/pilot-exchange-guide" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-4 decoration-zinc-300">
                Read the beginner guide
              </a>
            </div>

            {checkoutMessage && <p className="mt-6 text-sm text-zinc-900 bg-zinc-100 border border-zinc-200 py-3 px-4 rounded-md">{checkoutMessage}</p>}
            {checkoutError && <p className="mt-6 text-sm text-zinc-900 bg-zinc-100 border border-zinc-200 py-3 px-4 rounded-md">{checkoutError}</p>}
          </section>

          {/* Simple How-it-Works */}
          <section className="mb-16">
            <h2 className="text-xl font-bold text-zinc-900 mb-6 border-b border-zinc-200 pb-2">How it works</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <span className="block text-zinc-400 font-mono text-sm mb-2">01</span>
                <h3 className="font-semibold text-zinc-900 mb-1">Select an Environment</h3>
                <p className="text-sm text-zinc-600">Browse real-world site twins provided by operators.</p>
              </div>
              <div>
                <span className="block text-zinc-400 font-mono text-sm mb-2">02</span>
                <h3 className="font-semibold text-zinc-900 mb-1">Submit Your Policy</h3>
                <p className="text-sm text-zinc-600">Provide an executable package (Docker, Checkpoint, API).</p>
              </div>
              <div>
                <span className="block text-zinc-400 font-mono text-sm mb-2">03</span>
                <h3 className="font-semibold text-zinc-900 mb-1">Simulated Evaluation</h3>
                <p className="text-sm text-zinc-600">We run standard tasks, interventions, and edge cases.</p>
              </div>
              <div>
                <span className="block text-zinc-400 font-mono text-sm mb-2">04</span>
                <h3 className="font-semibold text-zinc-900 mb-1">Get the Scorecard</h3>
                <p className="text-sm text-zinc-600">Receive actionable readiness metrics and leaderboard ranking.</p>
              </div>
            </div>
          </section>

          {/* Exchange Explorer */}
          <section id="marketplace">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">Exchange Marketplace</h2>
                <p className="text-sm text-zinc-600 mt-1">Explore available environments and active policy submissions.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="bg-white text-zinc-800 border-zinc-300 md:w-auto w-full"
              >
                <Filter className="w-4 h-4 mr-2" />
                {showFilters ? "Hide Filters" : "Filter Results"}
              </Button>
            </div>

            {/* Filter Bar */}
            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 mb-6 bg-zinc-50 border border-zinc-200 rounded-lg">
                <div className="relative col-span-1 lg:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    placeholder="Search by name, region, task..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white border-zinc-300 focus-visible:ring-zinc-900"
                  />
                </div>
                <select className="border border-zinc-300 rounded-md text-sm px-3 py-2 bg-white" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value as any)}>
                  <option value="all">All Locations</option>
                  {pilotLocationTypes.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <select className="border border-zinc-300 rounded-md text-sm px-3 py-2 bg-white" value={embodimentFilter} onChange={(e) => setEmbodimentFilter(e.target.value as any)}>
                  <option value="all">All Robots</option>
                  {pilotEmbodiments.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <select className="border border-zinc-300 rounded-md text-sm px-3 py-2 bg-white" value={timelineFilter} onChange={(e) => setTimelineFilter(e.target.value as any)}>
                  <option value="all">All Timelines</option>
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
                  Digital Twins (Environments)
                </TabsTrigger>
                <TabsTrigger 
                  value="policies" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 text-sm font-medium text-zinc-500 data-[state=active]:text-zinc-900"
                >
                  Policy Submissions
                </TabsTrigger>
              </TabsList>

              <TabsContent value="briefs" className="mt-6 space-y-4">
                {filteredLocationBriefs.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-300 rounded-lg">No environments match your criteria.</div>
                ) : (
                  filteredLocationBriefs.map((brief) => {
                    const leaderboard = leaderboardByBriefId.get(brief.id) ?? [];
                    return (
                      <div key={brief.id} className="group border border-zinc-200 rounded-xl bg-white overflow-hidden hover:border-zinc-300 transition-colors">
                        <div className="p-6 sm:p-8 grid md:grid-cols-[1fr_300px] gap-8">
                          {/* Left Details */}
                          <div>
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
                                <span className="text-sm font-semibold text-zinc-900">Top Submissions</span>
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
                              Run Evaluation Here
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
                  <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-300 rounded-lg">No submissions match your criteria.</div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {filteredPolicySubmissions.map((sub) => (
                      <div key={sub.id} className="border border-zinc-200 rounded-xl p-6 bg-white flex flex-col justify-between">
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

      {/* Access/Pricing Modal */}
      <Dialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-white">
          <div className="p-6 sm:p-8 bg-zinc-900 text-white">
            <DialogTitle className="text-2xl font-bold">Pilot Exchange Access</DialogTitle>
            <DialogDescription className="text-zinc-300 mt-2">
              Choose an access plan to submit evaluation runs, receive standardized scorecards, and unlock training capabilities.
            </DialogDescription>
          </div>
          
          <div className="p-6 sm:p-8 grid md:grid-cols-3 gap-6 bg-zinc-50">
            {/* Card 1 */}
            <div className="bg-white border border-zinc-200 rounded-xl p-6 flex flex-col">
              <h4 className="font-bold text-zinc-900">Pro Site Evaluation</h4>
              <p className="text-2xl font-semibold mt-2 mb-4">$4,900 <span className="text-sm text-zinc-500 font-normal">/ cycle</span></p>
              <ul className="text-sm text-zinc-600 space-y-3 mb-6 flex-grow">
                <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" /> One evaluation submission to a specific site twin</li>
                <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" /> Standardized threshold scorecard</li>
                <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" /> Anonymous leaderboard entry</li>
              </ul>
              <Button disabled={checkoutLoadingPlan !== null} onClick={() => startCheckout("evaluation")} className="w-full bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-50">
                {checkoutLoadingPlan === "evaluation" ? "Processing..." : "Purchase"}
              </Button>
            </div>

            {/* Card 2 */}
            <div className="bg-white border-2 border-zinc-900 rounded-xl p-6 flex flex-col relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">Recommended</span>
              <h4 className="font-bold text-zinc-900">Team Subscription</h4>
              <p className="text-2xl font-semibold mt-2 mb-4">$1,200 <span className="text-sm text-zinc-500 font-normal">/ mo</span></p>
              <ul className="text-sm text-zinc-600 space-y-3 mb-6 flex-grow">
                <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" /> Unlimited ongoing evaluation cycles</li>
                <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" /> Cross-site benchmarking</li>
                <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" /> Private artifacts & reports</li>
              </ul>
              <Button disabled={checkoutLoadingPlan !== null} onClick={() => startCheckout("subscription")} className="w-full bg-zinc-900 text-white hover:bg-zinc-800">
                {checkoutLoadingPlan === "subscription" ? "Processing..." : "Subscribe"}
              </Button>
            </div>

            {/* Card 3 */}
            <div className="bg-white border border-zinc-200 rounded-xl p-6 flex flex-col">
              <h4 className="font-bold text-zinc-900">Training Unlock</h4>
              <p className="text-2xl font-semibold mt-2 mb-4">$2,400 <span className="text-sm text-zinc-500 font-normal">/ mo</span></p>
              <ul className="text-sm text-zinc-600 space-y-3 mb-6 flex-grow">
                <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" /> Everything in Team plan</li>
                <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" /> Training rights on site twins</li>
                <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" /> Managed compute lanes</li>
              </ul>
              <Button disabled={checkoutLoadingPlan !== null} onClick={() => startCheckout("training")} className="w-full bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-50">
                {checkoutLoadingPlan === "training" ? "Processing..." : "Subscribe"}
              </Button>
            </div>
          </div>
          {checkoutError && <div className="p-4 bg-zinc-100 text-zinc-900 text-sm text-center border-t border-zinc-200">{checkoutError}</div>}
        </DialogContent>
      </Dialog>

      {/* Eval Submission Modal */}
      <Dialog open={isPolicyDialogOpen} onOpenChange={setIsPolicyDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-0">
          <div className="p-6 sm:p-8 border-b border-zinc-100 bg-zinc-50 sticky top-0 z-10">
            <DialogTitle className="text-xl font-bold">Run Policy Evaluation</DialogTitle>
            <DialogDescription className="mt-1">Select an environment and provide your policy package for simulated testing.</DialogDescription>
          </div>

          <form onSubmit={handleEvalRunSubmit} className="p-6 sm:p-8 space-y-8">
            {/* Step 1: Environment */}
            <section>
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-xs">1</span>
                Target Environment
              </h3>
              <select
                required
                value={evalRunForm.briefId}
                onChange={(e) => setEvalRunForm((p) => ({ ...p, briefId: e.target.value }))}
                className="w-full h-11 px-3 border border-zinc-300 rounded-md bg-white text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900"
              >
                <option value="">Select a digital twin...</option>
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
                Robot Policy Package
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
                Technical Context
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
                {policyStatus === "loading" ? "Submitting Evaluation..." : "Submit Evaluation"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}