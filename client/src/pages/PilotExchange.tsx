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
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Lock,
  Search,
  Sparkles,
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
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(80%_80%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-policy-exchange"
          width={44}
          height={44}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 44V.5H44" fill="none" />
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
  if (typeof window === "undefined") {
    return {};
  }
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
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const [first, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: first,
    lastName: rest.join(" ") || "Unknown",
  };
}

function inferCompanyFromEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const domain = trimmed.split("@")[1] || "";
  return domain;
}

function readPolicyLibrary(): SavedPolicyPackage[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(POLICY_LIBRARY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as SavedPolicyPackage[];
  } catch {
    return [];
  }
}

function formatThresholdDelta(successRate: number, threshold: number): {
  label: string;
  className: string;
} {
  const delta = Math.round(successRate - threshold);
  const label = `${delta >= 0 ? "+" : ""}${delta}%`;
  return {
    label,
    className: delta >= 0 ? "text-emerald-700" : "text-rose-600",
  };
}

function getIntegrationBadgeClass(status: EvalLeaderboardEntry["integrationCheckStatus"]): string {
  if (status === "Passed") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (status === "Partial") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

function getSafetyBadgeClass(status: EvalLeaderboardEntry["safetySatStatus"]): string {
  if (status === "Ready") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (status === "In Progress") {
    return "bg-sky-50 text-sky-700 ring-sky-200";
  }
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

function readAccessFlag(storageKey: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(storageKey) === "true";
}

export default function PilotExchange() {
  const [activeTab, setActiveTab] = useState<ExchangeTab>("briefs");

  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] =
    useState<FilterValue<PilotLocationType>>("all");
  const [embodimentFilter, setEmbodimentFilter] =
    useState<FilterValue<RobotEmbodiment>>("all");
  const [timelineFilter, setTimelineFilter] =
    useState<FilterValue<DeploymentTimeline>>("all");
  const [privacyFilter, setPrivacyFilter] =
    useState<FilterValue<PrivacyMode>>("all");

  const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);

  const [policyLibrary, setPolicyLibrary] = useState<SavedPolicyPackage[]>(() =>
    readPolicyLibrary(),
  );
  const [evalRunForm, setEvalRunForm] = useState<EvalRunFormState>(
    defaultEvalRunFormState,
  );

  const [policyStatus, setPolicyStatus] = useState<SubmissionStatus>("idle");
  const [policyMessage, setPolicyMessage] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<AccessPlan | null>(null);

  const [evaluationAccessUnlocked, setEvaluationAccessUnlocked] =
    useState<boolean>(() => readAccessFlag(EVAL_ACCESS_STORAGE_KEY));
  const [subscriptionAccessUnlocked, setSubscriptionAccessUnlocked] =
    useState<boolean>(() => readAccessFlag(SUBSCRIPTION_ACCESS_STORAGE_KEY));
  const [trainingAccessUnlocked, setTrainingAccessUnlocked] =
    useState<boolean>(() => readAccessFlag(TRAINING_ACCESS_STORAGE_KEY));

  useEffect(() => {
    analyticsEvents.pilotExchangeView();

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const access = params.get("access");

    if (checkout === "success" && access === "evaluation") {
      window.localStorage.setItem(EVAL_ACCESS_STORAGE_KEY, "true");
      setEvaluationAccessUnlocked(true);
      setCheckoutMessage("Evaluation access unlocked. You can now submit policy evaluations.");
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
      setCheckoutError("Checkout was canceled. Complete purchase to run evaluations.");
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
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        POLICY_LIBRARY_STORAGE_KEY,
        JSON.stringify(policyLibrary),
      );
    } catch {
      // Ignore storage failures.
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
    if (!evalRunForm.briefId) {
      return null;
    }
    return locationBriefs.find((brief) => brief.id === evalRunForm.briefId) ?? null;
  }, [evalRunForm.briefId]);

  const selectedEvalLeaderboard = useMemo(() => {
    if (!evalRunForm.briefId) {
      return [] as EvalLeaderboardEntry[];
    }

    return leaderboardByBriefId.get(evalRunForm.briefId) ?? [];
  }, [evalRunForm.briefId, leaderboardByBriefId]);

  const selectedEvalPolicy = useMemo<SavedPolicyPackage | null>(() => {
    if (!evalRunForm.policyId) {
      return null;
    }
    return policyLibrary.find((policy) => policy.id === evalRunForm.policyId) ?? null;
  }, [evalRunForm.policyId, policyLibrary]);

  useEffect(() => {
    if (!evalRunForm.contactEmail.trim()) {
      return;
    }
    if (evalRunForm.contactCompany.trim()) {
      return;
    }

    const inferred = inferCompanyFromEmail(evalRunForm.contactEmail);
    if (!inferred) {
      return;
    }

    setEvalRunForm((prev) => {
      if (prev.contactCompany.trim()) {
        return prev;
      }
      return { ...prev, contactCompany: inferred };
    });
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
        const nextPolicyId = hasSavedPolicies
          ? prev.policyId || policyLibrary[0]?.id || ""
          : "";

        return {
          ...defaultEvalRunFormState,
          briefId: nextBriefId || "",
          policyId: nextPolicyId,
          addNewPolicy: !hasSavedPolicies,
          contactName: prev.contactName,
          contactEmail: prev.contactEmail,
          contactCompany:
            prev.contactCompany || inferCompanyFromEmail(prev.contactEmail),
        };
      });

      setIsPolicyDialogOpen(true);
    },
    [evaluationAccessUnlocked, policyLibrary],
  );

  const emitFilterEvent = useCallback((type: string, value: string) => {
    analyticsEvents.pilotExchangeFilterApply(type, value || "all");
  }, []);

  const filteredLocationBriefs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return locationBriefs.filter((brief) => {
      const matchesQuery =
        query.length === 0 ||
        brief.operatorAlias.toLowerCase().includes(query) ||
        brief.region.toLowerCase().includes(query) ||
        brief.objective.toLowerCase().includes(query) ||
        brief.evaluationGoal.toLowerCase().includes(query) ||
        brief.primaryTasks.join(" ").toLowerCase().includes(query) ||
        brief.integrationSurface.join(" ").toLowerCase().includes(query);
      const matchesLocation =
        locationFilter === "all" || brief.locationType === locationFilter;
      const matchesEmbodiment =
        embodimentFilter === "all" || brief.robotEmbodiment === embodimentFilter;
      const matchesTimeline =
        timelineFilter === "all" || brief.timeline === timelineFilter;
      const matchesPrivacy =
        privacyFilter === "all" || brief.privacyMode === privacyFilter;

      return (
        matchesQuery &&
        matchesLocation &&
        matchesEmbodiment &&
        matchesTimeline &&
        matchesPrivacy
      );
    });
  }, [embodimentFilter, locationFilter, privacyFilter, searchQuery, timelineFilter]);

  const filteredPolicySubmissions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return policySubmissions.filter((submission) => {
      const matchesQuery =
        query.length === 0 ||
        submission.teamAlias.toLowerCase().includes(query) ||
        submission.summary.toLowerCase().includes(query) ||
        submission.readiness.toLowerCase().includes(query);
      const matchesLocation =
        locationFilter === "all" || submission.locationType === locationFilter;
      const matchesEmbodiment =
        embodimentFilter === "all" ||
        submission.robotEmbodiment === embodimentFilter;
      const matchesTimeline =
        timelineFilter === "all" || submission.timeline === timelineFilter;
      const matchesPrivacy =
        privacyFilter === "all" || submission.privacyMode === privacyFilter;

      return (
        matchesQuery &&
        matchesLocation &&
        matchesEmbodiment &&
        matchesTimeline &&
        matchesPrivacy
      );
    });
  }, [embodimentFilter, locationFilter, privacyFilter, searchQuery, timelineFilter]);

  const submitInboundRequest = useCallback(
    async (args: {
      form: BaseLeadFormState;
      helpWith: HelpWithOption;
      details: Record<string, unknown>;
    }) => {
      const payload: InboundRequestPayload = {
        requestId: generateRequestId(),
        firstName: args.form.firstName.trim(),
        lastName: args.form.lastName.trim(),
        company: args.form.company.trim(),
        roleTitle: args.form.roleTitle.trim(),
        email: args.form.email.trim().toLowerCase(),
        budgetBucket: args.form.budgetBucket,
        helpWith: [args.helpWith],
        details: JSON.stringify(args.details),
        context: {
          sourcePageUrl:
            typeof window !== "undefined" ? window.location.href : "/pilot-exchange",
          referrer:
            typeof document !== "undefined" ? document.referrer || undefined : undefined,
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
      if (!response.ok || !body.ok) {
        throw new Error(body.message || "Unable to submit request");
      }
    },
    [],
  );

  const startCheckout = async (plan: AccessPlan) => {
    try {
      setCheckoutLoadingPlan(plan);
      setCheckoutError("");
      setCheckoutMessage("");

      const pricing =
        plan === "evaluation"
          ? {
              sku: "exchange-pro-eval",
              title: "Pilot Exchange Pro Site Evaluation",
              description:
                "Unlock policy evaluation submissions and standard scorecards for one site cycle.",
              price: 4900,
              successPath: "/pilot-exchange?checkout=success&access=evaluation",
            }
          : plan === "subscription"
            ? {
                sku: "exchange-team-subscription",
                title: "Pilot Exchange Robotics Team Subscription (30-day)",
                description:
                  "Recurring access for robotics teams running ongoing qualification cycles.",
                price: 1200,
                successPath: "/pilot-exchange?checkout=success&access=subscription",
              }
            : {
                sku: "exchange-training-subscription",
                title: "Pilot Exchange Training Subscription (30-day)",
                description:
                  "Enable policy training on calibrated site twins with monthly renewal.",
                price: 2400,
                successPath: "/pilot-exchange?checkout=success&access=training",
              };

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          sessionType: "marketplace",
          successPath: pricing.successPath,
          cancelPath: "/pilot-exchange?checkout=cancel",
          marketplaceItem: {
            sku: pricing.sku,
            title: pricing.title,
            description: pricing.description,
            price: pricing.price,
            quantity: 1,
            itemType: "dataset",
          },
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "Unable to start checkout.");
      }

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
      setPolicyMessage("Evaluation access is locked until purchase is complete.");
      setIsAccessDialogOpen(true);
      return;
    }

    if (!selectedEvalBrief) {
      setPolicyStatus("error");
      setPolicyMessage("Select a digital twin to run against.");
      return;
    }

    if (!evalRunForm.interfaceContract.trim()) {
      setPolicyStatus("error");
      setPolicyMessage("Document the interface contract used in this evaluation.");
      return;
    }

    if (!evalRunForm.fallbackStrategy.trim()) {
      setPolicyStatus("error");
      setPolicyMessage("Define your fallback strategy before submitting.");
      return;
    }

    if (!evalRunForm.assumedOperatingEnvelope.trim()) {
      setPolicyStatus("error");
      setPolicyMessage("Declare the assumed operating envelope.");
      return;
    }

    if (!evalRunForm.contactName.trim()) {
      setPolicyStatus("error");
      setPolicyMessage("Your name is required.");
      return;
    }

    if (!evalRunForm.contactEmail.trim()) {
      setPolicyStatus("error");
      setPolicyMessage("Work email is required.");
      return;
    }

    const resolvedCompany =
      evalRunForm.contactCompany.trim() || inferCompanyFromEmail(evalRunForm.contactEmail);
    if (!resolvedCompany) {
      setPolicyStatus("error");
      setPolicyMessage("Company is required (or use a work email domain).");
      return;
    }

    let resolvedPolicy: SavedPolicyPackage | null = null;

    if (evalRunForm.addNewPolicy) {
      if (!evalRunForm.newPolicyName.trim() || !evalRunForm.newPolicyUri.trim()) {
        setPolicyStatus("error");
        setPolicyMessage("Add a robot policy package name and a URL/endpoint.");
        return;
      }

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

    if (!resolvedPolicy) {
      setPolicyStatus("error");
      setPolicyMessage("Select a robot policy package (or add a new one).");
      return;
    }

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
          accessTier: trainingAccessUnlocked
            ? "training-subscription"
            : subscriptionAccessUnlocked
              ? "team-subscription"
              : "pro-evaluation",
          brief: {
            id: selectedEvalBrief.id,
            operatorAlias: selectedEvalBrief.operatorAlias,
            locationType: selectedEvalBrief.locationType,
            robotEmbodiment: selectedEvalBrief.robotEmbodiment,
            timeline: selectedEvalBrief.timeline,
            privacyMode: selectedEvalBrief.privacyMode,
            qualifyingSuccessRateThreshold:
              selectedEvalBrief.qualifyingSuccessRateThreshold,
          },
          policy: resolvedPolicy,
          interfaceContract: evalRunForm.interfaceContract.trim(),
          fallbackStrategy: evalRunForm.fallbackStrategy.trim(),
          assumedOperatingEnvelope: evalRunForm.assumedOperatingEnvelope.trim(),
          trainingAccessRequested: trainingAccessUnlocked,
          winCondition: `success_rate >= ${selectedEvalBrief.qualifyingSuccessRateThreshold}%`,
          artifacts: "gated",
        },
      });

      analyticsEvents.pilotExchangeSubmitPolicy("success");
      setPolicyStatus("success");
      setPolicyMessage(
        `Eval queued. We'll email your scorecard and whether you met the ${selectedEvalBrief.qualifyingSuccessRateThreshold}% threshold.`,
      );

      setEvalRunForm((prev) => ({
        ...defaultEvalRunFormState,
        briefId: prev.briefId,
        policyId: resolvedPolicy?.id || "",
        addNewPolicy: false,
        contactName: prev.contactName,
        contactEmail: prev.contactEmail,
        contactCompany: resolvedCompany,
      }));

      setTimeout(() => {
        setIsPolicyDialogOpen(false);
        setPolicyStatus("idle");
        setPolicyMessage("");
      }, 900);
    } catch (error) {
      analyticsEvents.pilotExchangeSubmitPolicy("error");
      setPolicyStatus("error");
      setPolicyMessage(
        error instanceof Error ? error.message : "Unable to queue evaluation run.",
      );
    }
  };

  return (
    <>
      <SEO
        title="Pilot Exchange Marketplace"
        description="Robotics-team marketplace for paid policy evaluation, scorecards, and training on calibrated site twins before on-site pilots."
        canonical="/pilot-exchange"
      />
      <div className="relative min-h-screen overflow-hidden bg-white text-zinc-900 selection:bg-emerald-100 selection:text-emerald-900">
        <DotPattern />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-br from-emerald-100/60 via-cyan-50/60 to-transparent" />

        <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          <section className="mb-12 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                Robotics Teams Only
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
                Pilot Exchange Marketplace
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-zinc-600">
                For robotics teams: upload robot policy packages, run paid evaluations on
                calibrated site twins, and receive scorecards before live pilot spend.
              </p>
              <p className="max-w-2xl text-sm text-zinc-500">
                New to this concept? Read the beginner guide at
                <a href="/pilot-exchange-guide" className="ml-1 font-semibold text-emerald-700 hover:text-emerald-800">
                  Pilot Exchange Guide
                </a>
                .
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={() => openEvalDialog()}
                  className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
                >
                  {evaluationAccessUnlocked ? "Run Eval" : "Unlock Evaluation Access"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsAccessDialogOpen(true)}
                  className="rounded-full border-zinc-300 px-6 py-2.5 text-sm font-semibold text-zinc-800"
                >
                  View Pricing
                </Button>
              </div>

              {checkoutMessage ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {checkoutMessage}
                </p>
              ) : null}

              {checkoutError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {checkoutError}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Access Status
              </h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm font-semibold text-zinc-900">Robotics Team Subscription</p>
                  <p className="mt-1 text-xs text-zinc-600">$1,200 / month (evaluation access)</p>
                  <p className="mt-2 text-xs font-semibold text-zinc-700">
                    {subscriptionAccessUnlocked ? "Active" : "Not active"}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm font-semibold text-zinc-900">Pro Site Evaluation</p>
                  <p className="mt-1 text-xs text-zinc-600">$4,900 per site cycle + scorecard</p>
                  <p className="mt-2 text-xs font-semibold text-zinc-700">
                    {evaluationAccessUnlocked ? "Unlocked" : "Locked"}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm font-semibold text-zinc-900">Training Subscription</p>
                  <p className="mt-1 text-xs text-zinc-600">$2,400 / month (training rights + eval access)</p>
                  <p className="mt-2 text-xs font-semibold text-zinc-700">
                    {trainingAccessUnlocked ? "Active" : "Not active"}
                  </p>
                </div>
              </div>
              <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                <Lock className="h-3.5 w-3.5" />
                Eval submission is barred until purchase
              </div>
            </div>
          </section>

          <section className="mb-12 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">Simple Commercial Model</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Sites are scanned for free by default and Blueprint owns the shared exchange twin.
                  Robotics teams pay for evaluation access, subscription, and training usage.
                </p>
              </div>
              <a
                href="/pilot-exchange-guide"
                className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Learn ownership details
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-900">1) Free Site Scan</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Default shared-twin onboarding is free for locations.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-900">2) Team Subscription</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Monthly plan for robotics teams running ongoing eval cycles.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-900">3) Pro Site Evaluation</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Paid per site cycle with standard scorecard output.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-900">4) Training + Optional Buyout</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Teams can pay for training access; sites can pay for private twin buyout.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-16 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">Exchange Marketplace</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Browse anonymized location briefs and policy submissions for active evaluation cycles.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                <Filter className="h-3.5 w-3.5" />
                Access-controlled evaluations
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_repeat(4,minmax(0,1fr))]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    emitFilterEvent("search", event.target.value || "all");
                  }}
                  className="pl-9"
                  placeholder="Search briefs, teams, tasks, regions..."
                  aria-label="Search listings"
                />
              </div>

              <select
                aria-label="Location type filter"
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700"
                value={locationFilter}
                onChange={(event) => {
                  const value = event.target.value as FilterValue<PilotLocationType>;
                  setLocationFilter(value);
                  emitFilterEvent("location_type", value);
                }}
              >
                <option value="all">All location types</option>
                {pilotLocationTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                aria-label="Embodiment filter"
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700"
                value={embodimentFilter}
                onChange={(event) => {
                  const value = event.target.value as FilterValue<RobotEmbodiment>;
                  setEmbodimentFilter(value);
                  emitFilterEvent("robot_embodiment", value);
                }}
              >
                <option value="all">All embodiments</option>
                {pilotEmbodiments.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                aria-label="Timeline filter"
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700"
                value={timelineFilter}
                onChange={(event) => {
                  const value = event.target.value as FilterValue<DeploymentTimeline>;
                  setTimelineFilter(value);
                  emitFilterEvent("timeline", value);
                }}
              >
                <option value="all">All timelines</option>
                {pilotTimelines.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                aria-label="Privacy filter"
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700"
                value={privacyFilter}
                onChange={(event) => {
                  const value = event.target.value as FilterValue<PrivacyMode>;
                  setPrivacyFilter(value);
                  emitFilterEvent("privacy_mode", value);
                }}
              >
                <option value="all">All privacy modes</option>
                {pilotPrivacyModes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as ExchangeTab)}
              className="mt-6"
            >
              <TabsList className="grid w-full grid-cols-2 bg-zinc-100">
                <TabsTrigger value="briefs">Location Briefs</TabsTrigger>
                <TabsTrigger value="policies">Policy Submissions</TabsTrigger>
              </TabsList>

              <TabsContent value="briefs" className="mt-5 space-y-4">
                {filteredLocationBriefs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
                    No location briefs match the current filters.
                  </div>
                ) : (
                  filteredLocationBriefs.map((brief) => {
                    const leaderboard = leaderboardByBriefId.get(brief.id) ?? [];
                    const threshold = brief.qualifyingSuccessRateThreshold;
                    const leaderboardPreview = leaderboard.slice(0, 3);

                    return (
                      <article
                        key={brief.id}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-zinc-900">
                              {brief.operatorAlias}
                            </h3>
                            <p className="text-sm text-zinc-600">{brief.objective}</p>
                            <p className="text-sm text-zinc-500">{brief.evaluationGoal}</p>
                            <p className="text-xs text-zinc-500">
                              Primary tasks: {brief.primaryTasks.join(" · ")}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                              {brief.locationType}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                              {brief.robotEmbodiment}
                            </span>
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                              {brief.timeline}
                            </span>
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                              Win ≥ {brief.qualifyingSuccessRateThreshold}% success
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                              {brief.privacyMode === "Anonymized" ? (
                                <EyeOff className="h-3.5 w-3.5 text-zinc-500" />
                              ) : (
                                <Eye className="h-3.5 w-3.5 text-zinc-500" />
                              )}
                              {brief.privacyMode}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                          <span>
                            {brief.region} · {brief.footprintSqFt.toLocaleString()} sq ft · {brief.openSlots} vendor slots
                          </span>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800"
                            onClick={() => {
                              openEvalDialog(brief.id);
                            }}
                          >
                            {evaluationAccessUnlocked ? "Run eval against this twin" : "Unlock access to run eval"}
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        {leaderboardPreview.length > 0 ? (
                          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-semibold text-zinc-900">
                                Leaderboard (anonymous)
                              </p>
                              <p className="text-xs text-zinc-500">
                                {leaderboard.length.toLocaleString()} submitted runs
                              </p>
                            </div>
                            <div className="mt-3 space-y-2">
                              {leaderboardPreview.map((entry) => {
                                const delta = formatThresholdDelta(
                                  entry.successRate,
                                  threshold,
                                );

                                return (
                                  <div
                                    key={entry.id}
                                    className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="text-xs font-semibold text-zinc-500">
                                          #{entry.rank}
                                        </span>
                                        <span className="font-semibold text-zinc-900">
                                          {entry.entrant}
                                        </span>
                                        <span className="text-xs text-zinc-500">
                                          {entry.benchmarkRuns.toLocaleString()} runs
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="text-sm font-semibold text-zinc-900">
                                          {entry.successRate}% success
                                        </span>
                                        <span className={`text-xs font-semibold ${delta.className}`}>
                                          {delta.label}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                      <span className="rounded-full bg-white px-2.5 py-1 text-zinc-700 ring-1 ring-zinc-200">
                                        Interventions: {entry.interventionRatePer100.toFixed(1)} / 100 tasks
                                      </span>
                                      <span className={`rounded-full px-2.5 py-1 ring-1 ${getIntegrationBadgeClass(entry.integrationCheckStatus)}`}>
                                        Integration: {entry.integrationCheckStatus}
                                      </span>
                                      <span className={`rounded-full px-2.5 py-1 ring-1 ${getSafetyBadgeClass(entry.safetySatStatus)}`}>
                                        Safety/SAT: {entry.safetySatStatus}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="policies" className="mt-5 space-y-4">
                {filteredPolicySubmissions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
                    No policy submissions match the current filters.
                  </div>
                ) : (
                  filteredPolicySubmissions.map((submission) => (
                    <article
                      key={submission.id}
                      className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-zinc-900">
                            {submission.teamAlias}
                          </h3>
                          <p className="text-sm text-zinc-600">{submission.summary}</p>
                          <p className="text-xs text-zinc-500">
                            {submission.benchmarkRuns.toLocaleString()} benchmark runs
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                            {submission.locationType}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                            {submission.robotEmbodiment}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                            {submission.timeline}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                            {submission.successRate}% success
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                        <span>Readiness: {submission.readiness}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200">
                          <Lock className="h-3.5 w-3.5" />
                          Full artifacts gated
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-zinc-900 p-8 text-white">
            <h2 className="text-2xl font-bold">Ready to run paid evaluations?</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-300">
              Purchase access, submit your policy package, and get standardized scorecards.
              Add the training subscription to run training directly on calibrated site twins.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => openEvalDialog()}
                className="rounded-full bg-white text-zinc-900 hover:bg-zinc-200"
              >
                {evaluationAccessUnlocked ? "Run Eval" : "Unlock Evaluation Access"}
              </Button>
              <Button
                onClick={() => setIsAccessDialogOpen(true)}
                variant="outline"
                className="rounded-full border-zinc-500 text-white hover:bg-zinc-800"
              >
                See Pricing & Purchase
              </Button>
              <a
                href="/pilot-exchange-guide"
                className="inline-flex items-center justify-center rounded-full border border-zinc-500 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Beginner Guide
              </a>
            </div>
          </section>
        </div>
      </div>

      <Dialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Unlock Exchange Access</DialogTitle>
            <DialogDescription>
              Evaluation submissions are purchase-gated. Choose a plan to continue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-900">Robotics Team Subscription</p>
              <p className="mt-1 text-sm text-zinc-600">$1,200 / month (30-day renewable)</p>
              <p className="mt-1 text-xs text-zinc-500">
                Best for teams running frequent evaluations across multiple site twins.
              </p>
              <Button
                className="mt-3 w-full"
                disabled={checkoutLoadingPlan !== null}
                onClick={() => startCheckout("subscription")}
              >
                {checkoutLoadingPlan === "subscription"
                  ? "Starting checkout..."
                  : "Start Team Subscription"}
              </Button>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-900">Pro Site Evaluation</p>
              <p className="mt-1 text-sm text-zinc-600">$4,900 per site cycle</p>
              <p className="mt-1 text-xs text-zinc-500">
                Includes standardized scorecard, threshold benchmark, and anonymous leaderboard placement.
              </p>
              <Button
                className="mt-3 w-full"
                disabled={checkoutLoadingPlan !== null}
                onClick={() => startCheckout("evaluation")}
              >
                {checkoutLoadingPlan === "evaluation" ? "Starting checkout..." : "Purchase Pro Evaluation"}
              </Button>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-900">Training Subscription</p>
              <p className="mt-1 text-sm text-zinc-600">$2,400 / month (30-day renewable)</p>
              <p className="mt-1 text-xs text-zinc-500">
                Adds training rights on site twins and includes subscription + evaluation access.
              </p>
              <Button
                className="mt-3 w-full"
                disabled={checkoutLoadingPlan !== null}
                onClick={() => startCheckout("training")}
              >
                {checkoutLoadingPlan === "training" ? "Starting checkout..." : "Start Training Subscription"}
              </Button>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              <p className="font-semibold">Ownership policy (simple)</p>
              <p className="mt-1">
                Site scans are free by default and listed under Blueprint-owned shared twins. Sites can
                purchase a private twin buyout for stricter ownership/use restrictions.
              </p>
            </div>

            {checkoutError ? (
              <p className="text-sm text-rose-700">{checkoutError}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPolicyDialogOpen} onOpenChange={setIsPolicyDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Run Eval</DialogTitle>
            <DialogDescription>
              Pick a digital twin, attach a robot policy package, and submit your qualification context.
            </DialogDescription>
          </DialogHeader>

          {!evaluationAccessUnlocked ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Evaluation access is locked until purchase is complete.
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleEvalRunSubmit}>
            <div className="space-y-2">
              <Label htmlFor="eval-brief">Digital twin</Label>
              <select
                id="eval-brief"
                value={evalRunForm.briefId}
                onChange={(event) =>
                  setEvalRunForm((prev) => ({
                    ...prev,
                    briefId: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700"
              >
                <option value="">Select a site twin...</option>
                {locationBriefs.map((brief) => (
                  <option key={brief.id} value={brief.id}>
                    {brief.locationType} · {brief.robotEmbodiment} · {brief.timeline} · {brief.operatorAlias}
                  </option>
                ))}
              </select>
            </div>

            {selectedEvalBrief ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <p className="text-sm font-semibold text-emerald-900">
                  Win threshold: ≥ {selectedEvalBrief.qualifyingSuccessRateThreshold}% success
                </p>
                <p className="mt-1 text-sm text-emerald-800/80">
                  Passing this threshold starts partner discussions. Detailed artifacts remain gated.
                </p>
              </div>
            ) : null}

            {selectedEvalBrief ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-zinc-900">Leaderboard (anonymous)</p>
                  <p className="text-xs text-zinc-500">
                    {selectedEvalLeaderboard.length.toLocaleString()} submitted runs
                  </p>
                </div>
                {selectedEvalLeaderboard.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-600">No public runs yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selectedEvalLeaderboard.slice(0, 4).map((entry) => {
                      const delta = formatThresholdDelta(
                        entry.successRate,
                        selectedEvalBrief.qualifyingSuccessRateThreshold,
                      );

                      return (
                        <div
                          key={entry.id}
                          className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-xs font-semibold text-zinc-500">#{entry.rank}</span>
                              <span className="font-semibold text-zinc-900">{entry.entrant}</span>
                              <span className="text-xs text-zinc-500">{entry.benchmarkRuns.toLocaleString()} runs</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-zinc-900">{entry.successRate}% success</span>
                              <span className={`text-xs font-semibold ${delta.className}`}>{delta.label}</span>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-white px-2.5 py-1 text-zinc-700 ring-1 ring-zinc-200">
                              Interventions: {entry.interventionRatePer100.toFixed(1)} / 100 tasks
                            </span>
                            <span className={`rounded-full px-2.5 py-1 ring-1 ${getIntegrationBadgeClass(entry.integrationCheckStatus)}`}>
                              Integration: {entry.integrationCheckStatus}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 ring-1 ${getSafetyBadgeClass(entry.safetySatStatus)}`}>
                              Safety/SAT: {entry.safetySatStatus}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="eval-policy">Robot policy package</Label>
              <p className="text-xs text-zinc-500">
                Provide an executable package (Docker image, checkpoint endpoint, or hosted API).
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <select
                  id="eval-policy"
                  value={evalRunForm.policyId}
                  disabled={evalRunForm.addNewPolicy || policyLibrary.length === 0}
                  onChange={(event) =>
                    setEvalRunForm((prev) => ({
                      ...prev,
                      policyId: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 disabled:opacity-60"
                >
                  <option value="">
                    {policyLibrary.length === 0 ? "No saved packages yet" : "Select a saved package..."}
                  </option>
                  {policyLibrary.map((policy) => (
                    <option key={policy.id} value={policy.id}>
                      {policy.name} ({policy.kind})
                    </option>
                  ))}
                </select>

                <label className="inline-flex select-none items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={evalRunForm.addNewPolicy}
                    onChange={(event) =>
                      setEvalRunForm((prev) => ({
                        ...prev,
                        addNewPolicy: event.target.checked,
                      }))
                    }
                  />
                  Add new
                </label>
              </div>
            </div>

            {evalRunForm.addNewPolicy ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-policy-name">Robot policy package name</Label>
                    <Input
                      id="new-policy-name"
                      value={evalRunForm.newPolicyName}
                      onChange={(event) =>
                        setEvalRunForm((prev) => ({
                          ...prev,
                          newPolicyName: event.target.value,
                        }))
                      }
                      placeholder="e.g., humanoid-aisle-reset-v2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-policy-kind">Package type</Label>
                    <select
                      id="new-policy-kind"
                      value={evalRunForm.newPolicyKind}
                      onChange={(event) =>
                        setEvalRunForm((prev) => ({
                          ...prev,
                          newPolicyKind: event.target.value as PolicyPackageKind,
                        }))
                      }
                      className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700"
                    >
                      <option value="Docker image">Docker image</option>
                      <option value="Checkpoint URL">Checkpoint URL</option>
                      <option value="API endpoint">API endpoint</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="new-policy-uri">URL / endpoint</Label>
                  <Input
                    id="new-policy-uri"
                    value={evalRunForm.newPolicyUri}
                    onChange={(event) =>
                      setEvalRunForm((prev) => ({
                        ...prev,
                        newPolicyUri: event.target.value,
                      }))
                    }
                    placeholder="docker://ghcr.io/org/policy:tag or https://..."
                  />
                </div>
              </div>
            ) : selectedEvalPolicy ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <p className="text-sm font-semibold text-zinc-900">{selectedEvalPolicy.name}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {selectedEvalPolicy.kind}: {selectedEvalPolicy.uri}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="eval-interface-contract">Interface Contract</Label>
              <Textarea
                id="eval-interface-contract"
                value={evalRunForm.interfaceContract}
                onChange={(event) =>
                  setEvalRunForm((prev) => ({
                    ...prev,
                    interfaceContract: event.target.value,
                  }))
                }
                placeholder="APIs/topics/events used (WMS, ERP, doors, elevators, PLC, etc.)"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eval-fallback-strategy">Fallback Strategy</Label>
              <Textarea
                id="eval-fallback-strategy"
                value={evalRunForm.fallbackStrategy}
                onChange={(event) =>
                  setEvalRunForm((prev) => ({
                    ...prev,
                    fallbackStrategy: event.target.value,
                  }))
                }
                placeholder="How your system handles blocked paths, failed grasps, or missing items"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eval-operating-envelope">Assumed Operating Envelope</Label>
              <Textarea
                id="eval-operating-envelope"
                value={evalRunForm.assumedOperatingEnvelope}
                onChange={(event) =>
                  setEvalRunForm((prev) => ({
                    ...prev,
                    assumedOperatingEnvelope: event.target.value,
                  }))
                }
                placeholder="Hours, traffic assumptions, task exclusions, and environmental limits"
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="eval-email">Work email</Label>
                <Input
                  id="eval-email"
                  type="email"
                  value={evalRunForm.contactEmail}
                  onChange={(event) =>
                    setEvalRunForm((prev) => ({
                      ...prev,
                      contactEmail: event.target.value,
                    }))
                  }
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eval-name">Full name</Label>
                <Input
                  id="eval-name"
                  value={evalRunForm.contactName}
                  onChange={(event) =>
                    setEvalRunForm((prev) => ({
                      ...prev,
                      contactName: event.target.value,
                    }))
                  }
                  placeholder="Jane Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eval-company">Company (optional)</Label>
              <Input
                id="eval-company"
                value={evalRunForm.contactCompany}
                onChange={(event) =>
                  setEvalRunForm((prev) => ({
                    ...prev,
                    contactCompany: event.target.value,
                  }))
                }
                placeholder="Auto-filled from email domain"
              />
            </div>

            {policyMessage ? (
              <p
                className={`text-sm ${
                  policyStatus === "success" ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {policyMessage}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={policyStatus === "loading" || !evaluationAccessUnlocked}
              className="w-full"
            >
              {policyStatus === "loading" ? "Running..." : "Run eval"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
