import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { SEO } from "@/components/SEO";
import { analyticsEvents } from "@/components/Analytics";
import { withCsrfHeader } from "@/lib/csrf";
import {
  activationArtifacts,
  activationSignals,
  captureNetworkStats,
  confidenceBands,
  evalLeaderboardEntries,
  failureAttribution,
  locationBriefs,
  pilotEmbodiments,
  pilotExchangeFaq,
  pilotLocationTypes,
  pilotPrivacyModes,
  pilotTimelines,
  policySubmissions,
  readinessFunnel,
  readinessGates,
  scoreSummaries,
  workflowValidationChecks,
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
  ReadinessGate,
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  Filter,
  Info,
  Lock,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
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
  budgetBucket: BudgetBucket | "";
}

interface LocationBriefFormState extends BaseLeadFormState {
  locationType: PilotLocationType | "";
  robotEmbodiment: RobotEmbodiment | "";
  timeline: DeploymentTimeline | "";
  privacyMode: PrivacyMode | "";
  region: string;
  objective: string;
  evaluationGoal: string;
  primaryTasks: string;
  integrationSurface: string;
  safetyConstraints: string;
  excludedTasks: string;
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

interface DataLicenseFormState extends BaseLeadFormState {
  locationType: PilotLocationType | "";
  robotEmbodiment: RobotEmbodiment | "";
  timeline: DeploymentTimeline | "";
  privacyMode: PrivacyMode | "";
  licensingGoal: string;
  dataNeeds: string;
  complianceNotes: string;
}

const budgetOptions: BudgetBucket[] = [
  "<$50K",
  "$50K-$300K",
  "$300K-$1M",
  ">$1M",
  "Undecided/Unsure",
];

const defaultBaseFormState: BaseLeadFormState = {
  firstName: "",
  lastName: "",
  company: "",
  roleTitle: "",
  email: "",
  budgetBucket: "",
};

const defaultBriefFormState: LocationBriefFormState = {
  ...defaultBaseFormState,
  locationType: "",
  robotEmbodiment: "",
  timeline: "",
  privacyMode: "",
  region: "",
  objective: "",
  evaluationGoal: "",
  primaryTasks: "",
  integrationSurface: "",
  safetyConstraints: "",
  excludedTasks: "",
};

const POLICY_LIBRARY_STORAGE_KEY = "bp_pilot_exchange_policy_library_v2";

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

const defaultDataLicenseFormState: DataLicenseFormState = {
  ...defaultBaseFormState,
  locationType: "",
  robotEmbodiment: "",
  timeline: "",
  privacyMode: "",
  licensingGoal: "",
  dataNeeds: "",
  complianceNotes: "",
};

const readinessChartConfig = {
  teams: {
    label: "Teams",
    color: "hsl(160 84% 39%)",
  },
} satisfies ChartConfig;

const confidenceChartConfig = {
  low: {
    label: "Low",
    color: "hsl(355 78% 56%)",
  },
  median: {
    label: "Median",
    color: "hsl(210 92% 47%)",
  },
  high: {
    label: "High",
    color: "hsl(160 84% 39%)",
  },
} satisfies ChartConfig;

const failureChartConfig = {
  percent: {
    label: "Share",
    color: "hsl(214 32% 40%)",
  },
} satisfies ChartConfig;

const failureColors = [
  "#7dd3fc",
  "#34d399",
  "#fbbf24",
  "#f97316",
  "#f87171",
];

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(80%_80%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-pilot-exchange"
          width={44}
          height={44}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 44V.5H44" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern-pilot-exchange)" />
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

function validateBaseFields(form: BaseLeadFormState): string | null {
  if (!form.firstName.trim()) return "First name is required.";
  if (!form.lastName.trim()) return "Last name is required.";
  if (!form.company.trim()) return "Company is required.";
  if (!form.roleTitle.trim()) return "Role title is required.";
  if (!form.email.trim()) return "Work email is required.";
  if (!form.budgetBucket) return "Budget range is required.";
  return null;
}

function parseListInput(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

export default function PilotExchange() {
  const [activeTab, setActiveTab] = useState<ExchangeTab>("briefs");
  const [selectedGateId, setSelectedGateId] = useState<string>(readinessGates[0]?.id ?? "");

  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] =
    useState<FilterValue<PilotLocationType>>("all");
  const [embodimentFilter, setEmbodimentFilter] =
    useState<FilterValue<RobotEmbodiment>>("all");
  const [timelineFilter, setTimelineFilter] =
    useState<FilterValue<DeploymentTimeline>>("all");
  const [privacyFilter, setPrivacyFilter] =
    useState<FilterValue<PrivacyMode>>("all");

  const [isBriefDialogOpen, setIsBriefDialogOpen] = useState(false);
  const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false);
  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);

  const [briefForm, setBriefForm] = useState<LocationBriefFormState>(
    defaultBriefFormState,
  );
  const [dataLicenseForm, setDataLicenseForm] = useState<DataLicenseFormState>(
    defaultDataLicenseFormState,
  );

  const [policyLibrary, setPolicyLibrary] = useState<SavedPolicyPackage[]>(() =>
    readPolicyLibrary(),
  );
  const [evalRunForm, setEvalRunForm] = useState<EvalRunFormState>(
    defaultEvalRunFormState,
  );

  const [briefStatus, setBriefStatus] = useState<SubmissionStatus>("idle");
  const [policyStatus, setPolicyStatus] = useState<SubmissionStatus>("idle");
  const [dataStatus, setDataStatus] = useState<SubmissionStatus>("idle");
  const [briefMessage, setBriefMessage] = useState("");
  const [policyMessage, setPolicyMessage] = useState("");
  const [dataMessage, setDataMessage] = useState("");

  useEffect(() => {
    analyticsEvents.pilotExchangeView();
    analyticsEvents.pilotExchangeChartView("readiness-funnel");
    analyticsEvents.pilotExchangeChartView("confidence-bands");
    analyticsEvents.pilotExchangeChartView("failure-attribution");
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
      // Ignore storage failures (private browsing, quota, etc).
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

  const selectedGate = useMemo<ReadinessGate | null>(() => {
    if (!selectedGateId) {
      return null;
    }
    return readinessGates.find((gate) => gate.id === selectedGateId) ?? null;
  }, [selectedGateId]);

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

  const hasPolicyInput = useMemo(() => {
    if (evalRunForm.addNewPolicy) {
      return Boolean(evalRunForm.newPolicyName.trim() && evalRunForm.newPolicyUri.trim());
    }
    return Boolean(selectedEvalPolicy);
  }, [evalRunForm.addNewPolicy, evalRunForm.newPolicyName, evalRunForm.newPolicyUri, selectedEvalPolicy]);

  const qualificationChecklist = useMemo(
    () => [
      {
        id: "q-01",
        label: "Selected site twin",
        done: Boolean(selectedEvalBrief),
      },
      {
        id: "q-02",
        label: "Attached robot policy package",
        done: hasPolicyInput,
      },
      {
        id: "q-03",
        label: "Documented interface contract",
        done: Boolean(evalRunForm.interfaceContract.trim()),
      },
      {
        id: "q-04",
        label: "Defined fallback strategy",
        done: Boolean(evalRunForm.fallbackStrategy.trim()),
      },
      {
        id: "q-05",
        label: "Declared operating envelope",
        done: Boolean(evalRunForm.assumedOperatingEnvelope.trim()),
      },
    ],
    [
      evalRunForm.assumedOperatingEnvelope,
      evalRunForm.fallbackStrategy,
      evalRunForm.interfaceContract,
      hasPolicyInput,
      selectedEvalBrief,
    ],
  );

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
    [policyLibrary],
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
        budgetBucket: args.form.budgetBucket as BudgetBucket,
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

  const handleBriefSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const baseError = validateBaseFields(briefForm);
    if (baseError) {
      setBriefStatus("error");
      setBriefMessage(baseError);
      return;
    }

    const parsedPrimaryTasks = parseListInput(briefForm.primaryTasks);
    const parsedIntegrationSurface = parseListInput(briefForm.integrationSurface);
    const parsedSafetyConstraints = parseListInput(briefForm.safetyConstraints);

    if (
      !briefForm.locationType ||
      !briefForm.robotEmbodiment ||
      !briefForm.timeline ||
      !briefForm.privacyMode ||
      !briefForm.region.trim() ||
      !briefForm.objective.trim() ||
      !briefForm.evaluationGoal.trim() ||
      parsedPrimaryTasks.length === 0 ||
      parsedIntegrationSurface.length === 0 ||
      parsedSafetyConstraints.length === 0
    ) {
      setBriefStatus("error");
      setBriefMessage("Complete all required location brief fields before submitting.");
      return;
    }

    setBriefStatus("loading");
    setBriefMessage("");

    try {
      await submitInboundRequest({
        form: briefForm,
        helpWith: "pilot-exchange-location-brief",
        details: {
          submissionType: "location-brief",
          locationType: briefForm.locationType,
          robotEmbodiment: briefForm.robotEmbodiment,
          timeline: briefForm.timeline,
          privacyMode: briefForm.privacyMode,
          region: briefForm.region.trim(),
          objective: briefForm.objective.trim(),
          evaluationGoal: briefForm.evaluationGoal.trim(),
          primaryTasks: parsedPrimaryTasks,
          integrationSurface: parsedIntegrationSurface,
          safetyConstraints: parsedSafetyConstraints,
          excludedTasks: briefForm.excludedTasks.trim(),
        },
      });

      analyticsEvents.pilotExchangeSubmitBrief("success");
      setBriefStatus("success");
      setBriefMessage(
        "Deployment brief submitted. We will follow up with a qualification kickoff checklist.",
      );
      setBriefForm(defaultBriefFormState);
      setTimeout(() => {
        setIsBriefDialogOpen(false);
        setBriefStatus("idle");
        setBriefMessage("");
      }, 900);
    } catch (error) {
      analyticsEvents.pilotExchangeSubmitBrief("error");
      setBriefStatus("error");
      setBriefMessage(
        error instanceof Error ? error.message : "Unable to submit location brief.",
      );
    }
  };

  const handleEvalRunSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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

    const nameError = !evalRunForm.contactName.trim()
      ? "Your name is required."
      : null;
    if (nameError) {
      setPolicyStatus("error");
      setPolicyMessage(nameError);
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
      roleTitle: "",
      email: evalRunForm.contactEmail,
      budgetBucket: evalRunForm.budgetBucket,
    };

    try {
      await submitInboundRequest({
        form: leadForm,
        helpWith: "pilot-exchange-policy-submission",
        details: {
          submissionType: "eval-run",
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
          qualificationChecklist,
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

  const handleDataLicenseSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const baseError = validateBaseFields(dataLicenseForm);
    if (baseError) {
      setDataStatus("error");
      setDataMessage(baseError);
      return;
    }

    if (
      !dataLicenseForm.locationType ||
      !dataLicenseForm.robotEmbodiment ||
      !dataLicenseForm.timeline ||
      !dataLicenseForm.privacyMode ||
      !dataLicenseForm.licensingGoal.trim() ||
      !dataLicenseForm.dataNeeds.trim()
    ) {
      setDataStatus("error");
      setDataMessage("Complete all data licensing fields before submitting.");
      return;
    }

    setDataStatus("loading");
    setDataMessage("");

    try {
      await submitInboundRequest({
        form: dataLicenseForm,
        helpWith: "pilot-exchange-data-licensing",
        details: {
          submissionType: "data-licensing-request",
          locationType: dataLicenseForm.locationType,
          robotEmbodiment: dataLicenseForm.robotEmbodiment,
          timeline: dataLicenseForm.timeline,
          privacyMode: dataLicenseForm.privacyMode,
          licensingGoal: dataLicenseForm.licensingGoal.trim(),
          dataNeeds: dataLicenseForm.dataNeeds.trim(),
          complianceNotes: dataLicenseForm.complianceNotes.trim(),
        },
      });

      analyticsEvents.pilotExchangeSubmitDataLicenseRequest("success");
      setDataStatus("success");
      setDataMessage("Data licensing request submitted. We will contact you within 24 hours.");
      setDataLicenseForm(defaultDataLicenseFormState);
      setTimeout(() => {
        setIsDataDialogOpen(false);
        setDataStatus("idle");
        setDataMessage("");
      }, 900);
    } catch (error) {
      analyticsEvents.pilotExchangeSubmitDataLicenseRequest("error");
      setDataStatus("error");
      setDataMessage(
        error instanceof Error ? error.message : "Unable to submit data licensing request.",
      );
    }
  };

  return (
    <>
      <SEO
        title="Pilot Exchange"
        description="Pre-deployment qualification marketplace where location operators and robot teams compare policy performance in calibrated digital twins before controlled pilot ramp."
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
                Pre-Deployment Qualification Exchange
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
                Pilot Exchange
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-zinc-600">
                Pilot Exchange helps location operators and robot teams pre-qualify deployments
                before they commit to expensive live pilots. We use calibrated digital twins,
                standardized eval harnesses, and explicit safety/SAT gates to reduce risk.
              </p>
              <p className="max-w-2xl text-sm text-zinc-500">
                This process improves decision quality. It does not guarantee production success,
                and every qualified program still runs a controlled on-site ramp.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  <Info className="h-3.5 w-3.5" />
                  Illustrative demo data
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                  Pre-qualification only, not a production guarantee
                </span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={() => {
                    analyticsEvents.pilotExchangeOpenBriefForm();
                    setIsBriefDialogOpen(true);
                  }}
                  className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
                >
                  Post Deployment Brief
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    openEvalDialog();
                  }}
                  className="rounded-full border-zinc-300 px-6 py-2.5 text-sm font-semibold text-zinc-800"
                >
                  Run Eval
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Public Score Summary
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                  <Info className="h-3 w-3" />
                  Illustrative demo data
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {scoreSummaries.slice(0, 3).map((score) => (
                  <div
                    key={score.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        #{score.rank} {score.entrant}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {score.locationType} · {score.robotEmbodiment}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-700">
                        {score.successRate}% success
                      </p>
                      <p className="text-xs text-zinc-500">
                        {score.transferConfidence}% transfer confidence
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                <Lock className="h-3.5 w-3.5" />
                Detailed logs/videos/configs remain gated
              </div>
            </div>
          </section>

          <section className="mb-14 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
              <h2 className="text-lg font-semibold text-emerald-900">What this is</h2>
              <ul className="mt-3 space-y-2 text-sm text-emerald-900/85">
                <li>Structured pre-deployment qualification for operators and robot teams.</li>
                <li>Calibrated simulation workflow plus standardized benchmark harnesses.</li>
                <li>A decision tool to reduce pilot risk before on-site spend.</li>
              </ul>
            </article>
            <article className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6">
              <h2 className="text-lg font-semibold text-rose-900">What this is not</h2>
              <ul className="mt-3 space-y-2 text-sm text-rose-900/85">
                <li>Not a guarantee that a policy will succeed in production on day one.</li>
                <li>Not a replacement for SAT, safety sign-off, and controlled ramp.</li>
                <li>Not a one-time scan-and-done workflow; twins require upkeep and calibration.</li>
              </ul>
            </article>
          </section>

          <section className="mb-16 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">7-Stage Readiness Flow</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  SimReady assets improve fidelity, but every program still needs calibration,
                  integration checks, and on-site ramp before deployment decisions.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                <Info className="h-3.5 w-3.5" />
                Illustrative demo data
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {readinessGates.map((gate, index) => {
                const isActive = gate.id === selectedGateId;
                return (
                  <button
                    key={gate.id}
                    type="button"
                    onClick={() => {
                      setSelectedGateId(gate.id);
                      analyticsEvents.pilotExchangeSelectReadinessGate(gate.title);
                    }}
                    className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                      isActive
                        ? "border-emerald-300 bg-emerald-50/60"
                        : "border-zinc-200 bg-zinc-50/70 hover:bg-white"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-500">0{index + 1}</span>
                      {isActive ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      ) : (
                        <Circle className="h-4 w-4 text-zinc-400" />
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-900">{gate.title}</h3>
                    <p className="mt-1 text-xs text-zinc-600">{gate.description}</p>
                  </button>
                );
              })}
            </div>

            {selectedGate ? (
              <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-900">{selectedGate.title}</p>
                <p className="mt-1 text-sm text-zinc-700">{selectedGate.whyItMatters}</p>
              </div>
            ) : null}
          </section>

          <section className="mb-16 grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-4 flex items-center gap-2 text-zinc-900">
                <Radar className="h-5 w-5" />
                <h2 className="text-xl font-bold">Real-to-Sim Activation</h2>
              </div>
              <p className="text-sm text-zinc-600">
                A small on-site evidence pack is used to tune dynamics, sensing, and timing before
                teams are compared. This is the step that makes SimReady scenes decision-useful.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Input Signals
                  </p>
                  <div className="mt-2 space-y-2">
                    {activationSignals.map((signal) => (
                      <div key={signal.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <p className="text-sm font-semibold text-zinc-900">{signal.label}</p>
                        <p className="mt-1 text-xs text-zinc-600">{signal.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Output Artifacts
                  </p>
                  <div className="mt-2 space-y-2">
                    {activationArtifacts.map((artifact) => (
                      <div key={artifact.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                        <p className="text-sm font-semibold text-zinc-900">{artifact.label}</p>
                        <p className="mt-1 text-xs text-zinc-600">{artifact.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-4 flex items-center gap-2 text-zinc-900">
                <AlertTriangle className="h-5 w-5" />
                <h2 className="text-xl font-bold">Workflow + Integration Validation</h2>
              </div>
              <p className="text-sm text-zinc-600">
                The hardest failures are usually in systems integration and exception handling,
                not geometry alone. Pilot Exchange evaluates these pathways before live rollout.
              </p>
              <div className="mt-4 space-y-3">
                {workflowValidationChecks.map((item) => (
                  <div key={item.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                      {item.checks.map((check) => (
                        <li key={check}>• {check}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="mb-16 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">Qualification Analytics</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  These charts support pre-qualification decisions and are not production
                  guarantees.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                <Info className="h-3.5 w-3.5" />
                Illustrative demo data
              </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <article className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                <p className="text-sm font-semibold text-zinc-900">Readiness Funnel</p>
                <p className="mt-1 text-xs text-zinc-500">Teams progressing through 7 gates</p>
                <ChartContainer config={readinessChartConfig} className="mt-3 h-[300px] w-full aspect-auto">
                  <BarChart data={readinessFunnel} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="stage" width={110} tick={{ fontSize: 10 }} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="teams" fill="var(--color-teams)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </article>

              <article className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                <p className="text-sm font-semibold text-zinc-900">Confidence Bands</p>
                <p className="mt-1 text-xs text-zinc-500">Low / median / high expected task success</p>
                <ChartContainer config={confidenceChartConfig} className="mt-3 h-[300px] w-full aspect-auto">
                  <LineChart data={confidenceBands} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="task" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={80} />
                    <YAxis domain={[0, 100]} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="low" stroke="var(--color-low)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="median" stroke="var(--color-median)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="high" stroke="var(--color-high)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </article>

              <article className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                <p className="text-sm font-semibold text-zinc-900">Failure Attribution</p>
                <p className="mt-1 text-xs text-zinc-500">Where pre-deployment risk tends to appear</p>
                <ChartContainer config={failureChartConfig} className="mt-3 h-[300px] w-full aspect-auto">
                  <BarChart data={failureAttribution} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
                    <YAxis domain={[0, 35]} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="percent" radius={[4, 4, 0, 0]}>
                      {failureAttribution.map((entry, index) => (
                        <Cell key={entry.id} fill={failureColors[index % failureColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </article>
            </div>

            <p className="mt-4 text-xs text-zinc-500">
              These charts are intended for pre-qualification and triage. Final deployment
              readiness is confirmed through SAT and controlled on-site ramp.
            </p>
          </section>

          <section className="mb-16 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">Marketplace Workspace</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Browse anonymized deployment briefs and policy submissions after understanding
                  the qualification process.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                <Filter className="h-3.5 w-3.5" />
                Seeded catalog for v2 demo
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
                            Run eval against this twin
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
                                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-zinc-600 ring-1 ring-zinc-200">
                                        <Lock className="h-3.5 w-3.5" />
                                        Gated details
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="mt-3 text-xs text-zinc-500">
                              Metrics support pre-qualification. Final deployment readiness still
                              requires SAT and a controlled on-site ramp.
                            </p>
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

          <section className="mb-16 rounded-3xl border border-zinc-200 bg-gradient-to-r from-zinc-50 to-white p-6 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">
                  Optional Post-Qualification Output: Data Licensing
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  After qualification gates are met, Blueprint can generate targeted synthetic
                  episodes for adaptation and fine-tuning.
                </p>
              </div>
              <Button
                variant="outline"
                className="rounded-full border-zinc-300 text-zinc-800"
                onClick={() => setIsDataDialogOpen(true)}
              >
                Request Data Licensing
              </Button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <p className="text-sm font-semibold text-zinc-900">Targeted Scenarios</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Generate episodes for validated task scopes, not generic scene dumps.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <p className="text-sm font-semibold text-zinc-900">Controlled Access</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Respect operator privacy constraints with tiered release controls.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <p className="text-sm font-semibold text-zinc-900">Ops-Ready Metadata</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Include simulator configs and qualification notes for faster handoff.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-16 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">Capture Network</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  A paid capture workforce uses smart glasses to record real indoor spaces.
                  Blueprint reconstructs these captures into simulation-ready twins used for
                  pre-deployment qualification.
                </p>
              </div>
              <div className="hidden rounded-xl bg-emerald-50 p-2 text-emerald-700 sm:block">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {captureNetworkStats.map((stat) => (
                <div key={stat.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-zinc-900">{stat.value}</p>
                  <p className="mt-1 text-xs text-zinc-600">{stat.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-16 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-zinc-900">Pilot Exchange FAQ</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Plain-language answers on what is evaluated before a real-world deployment.
            </p>
            <Accordion
              type="single"
              collapsible
              className="mt-4"
              onValueChange={(value) => {
                if (value) {
                  analyticsEvents.pilotExchangeOpenFaq(value);
                }
              }}
            >
              {pilotExchangeFaq.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left text-sm font-semibold text-zinc-900">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-zinc-600">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-zinc-900 p-8 text-white">
            <h2 className="text-2xl font-bold">Ready to join Pilot Exchange?</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-300">
              Operators can post deployment briefs. Robot teams can submit policies for
              standardized evaluation. Data licensing is optional after qualification.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => {
                  analyticsEvents.pilotExchangeOpenBriefForm();
                  setIsBriefDialogOpen(true);
                }}
                className="rounded-full bg-white text-zinc-900 hover:bg-zinc-200"
              >
                Post Deployment Brief
              </Button>
              <Button
                onClick={() => {
                  openEvalDialog();
                }}
                variant="outline"
                className="rounded-full border-zinc-500 text-white hover:bg-zinc-800"
              >
                Run Eval
              </Button>
              <Button
                onClick={() => setIsDataDialogOpen(true)}
                variant="outline"
                className="rounded-full border-zinc-500 text-white hover:bg-zinc-800"
              >
                Request Data Licensing
              </Button>
            </div>
          </section>
        </div>
      </div>

      <Dialog open={isBriefDialogOpen} onOpenChange={setIsBriefDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Post Deployment Brief</DialogTitle>
            <DialogDescription>
              Share the tasks, integrations, and safety constraints needed for a decision-grade
              qualification run.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleBriefSubmit}>
            <BaseLeadFields
              form={briefForm}
              onChange={(key, value) => setBriefForm((prev) => ({ ...prev, [key]: value }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Location Type"
                value={briefForm.locationType}
                onChange={(value) =>
                  setBriefForm((prev) => ({ ...prev, locationType: value as PilotLocationType }))
                }
                options={pilotLocationTypes}
              />
              <SelectField
                label="Robot Embodiment"
                value={briefForm.robotEmbodiment}
                onChange={(value) =>
                  setBriefForm((prev) => ({ ...prev, robotEmbodiment: value as RobotEmbodiment }))
                }
                options={pilotEmbodiments}
              />
              <SelectField
                label="Target Timeline"
                value={briefForm.timeline}
                onChange={(value) =>
                  setBriefForm((prev) => ({ ...prev, timeline: value as DeploymentTimeline }))
                }
                options={pilotTimelines}
              />
              <SelectField
                label="Privacy Mode"
                value={briefForm.privacyMode}
                onChange={(value) =>
                  setBriefForm((prev) => ({ ...prev, privacyMode: value as PrivacyMode }))
                }
                options={pilotPrivacyModes}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brief-region">Region</Label>
              <Input
                id="brief-region"
                value={briefForm.region}
                onChange={(event) =>
                  setBriefForm((prev) => ({ ...prev, region: event.target.value }))
                }
                placeholder="US Midwest"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brief-objective">Deployment Objective</Label>
              <Textarea
                id="brief-objective"
                value={briefForm.objective}
                onChange={(event) =>
                  setBriefForm((prev) => ({ ...prev, objective: event.target.value }))
                }
                placeholder="What workflow should the robot solve?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brief-eval-goal">Evaluation Goal</Label>
              <Textarea
                id="brief-eval-goal"
                value={briefForm.evaluationGoal}
                onChange={(event) =>
                  setBriefForm((prev) => ({ ...prev, evaluationGoal: event.target.value }))
                }
                placeholder="How should candidates be compared?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brief-primary-tasks">Primary Tasks (required)</Label>
              <Textarea
                id="brief-primary-tasks"
                value={briefForm.primaryTasks}
                onChange={(event) =>
                  setBriefForm((prev) => ({ ...prev, primaryTasks: event.target.value }))
                }
                placeholder="One per line (e.g. aisle recovery, shelf facing, cart handoff)"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brief-integration-surface">Integration Surface (required)</Label>
              <Textarea
                id="brief-integration-surface"
                value={briefForm.integrationSurface}
                onChange={(event) =>
                  setBriefForm((prev) => ({ ...prev, integrationSurface: event.target.value }))
                }
                placeholder="WMS endpoints, PLC interfaces, door/elevator services"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brief-safety-constraints">Safety Constraints (required)</Label>
              <Textarea
                id="brief-safety-constraints"
                value={briefForm.safetyConstraints}
                onChange={(event) =>
                  setBriefForm((prev) => ({ ...prev, safetyConstraints: event.target.value }))
                }
                placeholder="Speed caps, no-go zones, right-of-way rules"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brief-excluded-tasks">Excluded Tasks (optional)</Label>
              <Textarea
                id="brief-excluded-tasks"
                value={briefForm.excludedTasks}
                onChange={(event) =>
                  setBriefForm((prev) => ({ ...prev, excludedTasks: event.target.value }))
                }
                placeholder="Tasks that should not be part of this qualification cycle"
                rows={2}
              />
            </div>

            {briefMessage ? (
              <p
                className={`text-sm ${
                  briefStatus === "success" ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {briefMessage}
              </p>
            ) : null}

            <Button type="submit" disabled={briefStatus === "loading"} className="w-full">
              {briefStatus === "loading" ? "Submitting..." : "Submit Deployment Brief"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPolicyDialogOpen} onOpenChange={setIsPolicyDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Run Eval</DialogTitle>
            <DialogDescription>
              Pick a digital twin, attach a robot policy package, and submit your qualification
              context. We email the scorecard and threshold outcome.
            </DialogDescription>
          </DialogHeader>
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
                    {brief.locationType} · {brief.robotEmbodiment} · {brief.timeline} ·{" "}
                    {brief.operatorAlias}
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
                  SimReady assets improve fidelity, but calibrated real-to-sim activation and
                  controlled ramp are still required before deployment.
                </p>
              </div>
            ) : null}

            {selectedEvalBrief ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-zinc-900">
                    Leaderboard (anonymous)
                  </p>
                  <p className="text-xs text-zinc-500">
                    {selectedEvalLeaderboard.length.toLocaleString()} submitted runs
                  </p>
                </div>

                {selectedEvalLeaderboard.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-600">
                    No public runs yet. Be the first to benchmark against this twin.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selectedEvalLeaderboard.map((entry) => {
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
                )}

                <p className="mt-3 text-xs text-zinc-500">
                  Results are anonymous for field comparison. Detailed logs/videos/configs remain gated.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="eval-policy">Robot policy package</Label>
              <p className="text-xs text-zinc-500">
                Provide an executable package (Docker, checkpoint endpoint, or hosted API) used
                for standardized eval harness execution.
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
                    {policyLibrary.length === 0
                      ? "No saved packages yet"
                      : "Select a saved package..."}
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
                <p className="text-sm font-semibold text-zinc-900">
                  {selectedEvalPolicy.name}
                </p>
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

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-900">Qualification checklist</p>
              <div className="mt-2 space-y-2">
                {qualificationChecklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    ) : (
                      <Circle className="h-4 w-4 text-zinc-400" />
                    )}
                    <span className={item.done ? "text-zinc-800" : "text-zinc-500"}>{item.label}</span>
                  </div>
                ))}
              </div>
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

            <Button type="submit" disabled={policyStatus === "loading"} className="w-full">
              {policyStatus === "loading" ? "Running..." : "Run eval"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDataDialogOpen} onOpenChange={setIsDataDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Data Licensing</DialogTitle>
            <DialogDescription>
              Tell us what synthetic or replayed data you need after qualification.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleDataLicenseSubmit}>
            <BaseLeadFields
              form={dataLicenseForm}
              onChange={(key, value) =>
                setDataLicenseForm((prev) => ({ ...prev, [key]: value }))
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Location Type"
                value={dataLicenseForm.locationType}
                onChange={(value) =>
                  setDataLicenseForm((prev) => ({
                    ...prev,
                    locationType: value as PilotLocationType,
                  }))
                }
                options={pilotLocationTypes}
              />
              <SelectField
                label="Robot Embodiment"
                value={dataLicenseForm.robotEmbodiment}
                onChange={(value) =>
                  setDataLicenseForm((prev) => ({
                    ...prev,
                    robotEmbodiment: value as RobotEmbodiment,
                  }))
                }
                options={pilotEmbodiments}
              />
              <SelectField
                label="Preferred Timeline"
                value={dataLicenseForm.timeline}
                onChange={(value) =>
                  setDataLicenseForm((prev) => ({
                    ...prev,
                    timeline: value as DeploymentTimeline,
                  }))
                }
                options={pilotTimelines}
              />
              <SelectField
                label="Privacy Mode"
                value={dataLicenseForm.privacyMode}
                onChange={(value) =>
                  setDataLicenseForm((prev) => ({
                    ...prev,
                    privacyMode: value as PrivacyMode,
                  }))
                }
                options={pilotPrivacyModes}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data-goal">Licensing Goal</Label>
              <Input
                id="data-goal"
                value={dataLicenseForm.licensingGoal}
                onChange={(event) =>
                  setDataLicenseForm((prev) => ({
                    ...prev,
                    licensingGoal: event.target.value,
                  }))
                }
                placeholder="Fine-tune adaptation, edge-case replay, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data-needs">Data Requirements</Label>
              <Textarea
                id="data-needs"
                value={dataLicenseForm.dataNeeds}
                onChange={(event) =>
                  setDataLicenseForm((prev) => ({ ...prev, dataNeeds: event.target.value }))
                }
                placeholder="Task counts, sensor modalities, labeling requirements."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data-compliance">Compliance Notes (optional)</Label>
              <Textarea
                id="data-compliance"
                value={dataLicenseForm.complianceNotes}
                onChange={(event) =>
                  setDataLicenseForm((prev) => ({
                    ...prev,
                    complianceNotes: event.target.value,
                  }))
                }
                placeholder="Any legal/privacy or data retention constraints."
                rows={3}
              />
            </div>

            {dataMessage ? (
              <p
                className={`text-sm ${
                  dataStatus === "success" ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {dataMessage}
              </p>
            ) : null}

            <Button type="submit" disabled={dataStatus === "loading"} className="w-full">
              {dataStatus === "loading" ? "Submitting..." : "Request Data Licensing"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BaseLeadFields({
  form,
  onChange,
}: {
  form: BaseLeadFormState;
  onChange: (key: keyof BaseLeadFormState, value: string) => void;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first-name">First Name</Label>
          <Input
            id="first-name"
            value={form.firstName}
            onChange={(event) => onChange("firstName", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last-name">Last Name</Label>
          <Input
            id="last-name"
            value={form.lastName}
            onChange={(event) => onChange("lastName", event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company-name">Company</Label>
          <Input
            id="company-name"
            value={form.company}
            onChange={(event) => onChange("company", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role-title">Role Title</Label>
          <Input
            id="role-title"
            value={form.roleTitle}
            onChange={(event) => onChange("roleTitle", event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="work-email">Work Email</Label>
          <Input
            id="work-email"
            type="email"
            value={form.email}
            onChange={(event) => onChange("email", event.target.value)}
          />
        </div>
        <SelectField
          label="Budget Range"
          value={form.budgetBucket}
          onChange={(value) => onChange("budgetBucket", value)}
          options={budgetOptions}
        />
      </div>
    </>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  const id = `${label.toLowerCase().replace(/\s+/g, "-")}-select`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
