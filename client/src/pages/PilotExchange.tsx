import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { SEO } from "@/components/SEO";
import { analyticsEvents } from "@/components/Analytics";
import { withCsrfHeader } from "@/lib/csrf";
import {
  captureNetworkStats,
  locationBriefs,
  pilotEmbodiments,
  pilotLocationTypes,
  pilotPrivacyModes,
  pilotTimelines,
  policySubmissions,
  scoreSummaries,
} from "@/data/pilotExchange";
import type {
  InboundRequestPayload,
  SubmitInboundRequestResponse,
} from "@/types/inbound-request";
import type { BudgetBucket, HelpWithOption } from "@/types/inbound-request";
import type {
  DeploymentTimeline,
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
  ChartNoAxesColumn,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  Filter,
  Lock,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
  Warehouse,
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
}

interface PolicySubmissionFormState extends BaseLeadFormState {
  locationType: PilotLocationType | "";
  robotEmbodiment: RobotEmbodiment | "";
  timeline: DeploymentTimeline | "";
  privacyMode: PrivacyMode | "";
  policyName: string;
  benchmarkEvidence: string;
  deploymentSummary: string;
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

const processSteps = [
  {
    title: "Capture",
    description: "Paid smart-glasses contributors capture real indoor spaces.",
    icon: UserRoundSearch,
  },
  {
    title: "Twin",
    description: "Blueprint reconstructs spatially faithful digital twins.",
    icon: Warehouse,
  },
  {
    title: "Eval Arena",
    description: "Vendors run policies in standardized evaluation arenas.",
    icon: Radar,
  },
  {
    title: "Deployment Decision",
    description: "Operators rank policy candidates before real-world rollout.",
    icon: ChartNoAxesColumn,
  },
  {
    title: "Optional Data Licensing",
    description: "Approved twins generate targeted synthetic data packages.",
    icon: Database,
  },
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
};

const defaultPolicyFormState: PolicySubmissionFormState = {
  ...defaultBaseFormState,
  locationType: "",
  robotEmbodiment: "",
  timeline: "",
  privacyMode: "",
  policyName: "",
  benchmarkEvidence: "",
  deploymentSummary: "",
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

  const [isBriefDialogOpen, setIsBriefDialogOpen] = useState(false);
  const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false);
  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);

  const [briefForm, setBriefForm] = useState<LocationBriefFormState>(
    defaultBriefFormState,
  );
  const [policyForm, setPolicyForm] = useState<PolicySubmissionFormState>(
    defaultPolicyFormState,
  );
  const [dataLicenseForm, setDataLicenseForm] = useState<DataLicenseFormState>(
    defaultDataLicenseFormState,
  );

  const [briefStatus, setBriefStatus] = useState<SubmissionStatus>("idle");
  const [policyStatus, setPolicyStatus] = useState<SubmissionStatus>("idle");
  const [dataStatus, setDataStatus] = useState<SubmissionStatus>("idle");
  const [briefMessage, setBriefMessage] = useState("");
  const [policyMessage, setPolicyMessage] = useState("");
  const [dataMessage, setDataMessage] = useState("");

  useEffect(() => {
    analyticsEvents.pilotExchangeView();
  }, []);

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
        brief.evaluationGoal.toLowerCase().includes(query);
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

    if (
      !briefForm.locationType ||
      !briefForm.robotEmbodiment ||
      !briefForm.timeline ||
      !briefForm.privacyMode ||
      !briefForm.region.trim() ||
      !briefForm.objective.trim() ||
      !briefForm.evaluationGoal.trim()
    ) {
      setBriefStatus("error");
      setBriefMessage("Complete all location brief fields before submitting.");
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
        },
      });

      analyticsEvents.pilotExchangeSubmitBrief("success");
      setBriefStatus("success");
      setBriefMessage("Deployment brief submitted. Our team will follow up shortly.");
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

  const handlePolicySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const baseError = validateBaseFields(policyForm);
    if (baseError) {
      setPolicyStatus("error");
      setPolicyMessage(baseError);
      return;
    }

    if (
      !policyForm.locationType ||
      !policyForm.robotEmbodiment ||
      !policyForm.timeline ||
      !policyForm.privacyMode ||
      !policyForm.policyName.trim() ||
      !policyForm.benchmarkEvidence.trim() ||
      !policyForm.deploymentSummary.trim()
    ) {
      setPolicyStatus("error");
      setPolicyMessage("Complete all policy submission fields before submitting.");
      return;
    }

    setPolicyStatus("loading");
    setPolicyMessage("");

    try {
      await submitInboundRequest({
        form: policyForm,
        helpWith: "pilot-exchange-policy-submission",
        details: {
          submissionType: "policy-submission",
          policyName: policyForm.policyName.trim(),
          locationType: policyForm.locationType,
          robotEmbodiment: policyForm.robotEmbodiment,
          timeline: policyForm.timeline,
          privacyMode: policyForm.privacyMode,
          benchmarkEvidence: policyForm.benchmarkEvidence.trim(),
          deploymentSummary: policyForm.deploymentSummary.trim(),
        },
      });

      analyticsEvents.pilotExchangeSubmitPolicy("success");
      setPolicyStatus("success");
      setPolicyMessage("Policy submission received. We will queue your eval intake.");
      setPolicyForm(defaultPolicyFormState);
      setTimeout(() => {
        setIsPolicyDialogOpen(false);
        setPolicyStatus("idle");
        setPolicyMessage("");
      }, 900);
    } catch (error) {
      analyticsEvents.pilotExchangeSubmitPolicy("error");
      setPolicyStatus("error");
      setPolicyMessage(
        error instanceof Error ? error.message : "Unable to submit policy request.",
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
        description="Eval-first deployment marketplace where location operators compare robot policy performance in digital twins before rollout, with optional data licensing after qualification."
        canonical="/pilot-exchange"
      />
      <div className="relative min-h-screen overflow-hidden bg-white text-zinc-900 selection:bg-emerald-100 selection:text-emerald-900">
        <DotPattern />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-br from-emerald-100/60 via-cyan-50/60 to-transparent" />

        <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          <section className="mb-16 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                Eval-First Marketplace
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
                Pilot Exchange
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-zinc-600">
                Blueprint brokers deployment pilots between location operators and robot
                teams. Build a digital twin, run standardized policy evaluations, and
                choose deployment partners with measurable confidence before on-site risk.
              </p>
              <p className="max-w-2xl text-sm text-zinc-500">
                Research has shown that evaluation in representative digital twins can
                improve deployment qualification decisions versus trial-and-error pilots.
              </p>

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
                    analyticsEvents.pilotExchangeOpenPolicyForm();
                    setIsPolicyDialogOpen(true);
                  }}
                  className="rounded-full border-zinc-300 px-6 py-2.5 text-sm font-semibold text-zinc-800"
                >
                  Submit Policy for Eval
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Public Score Summary
              </h2>
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
                Detailed logs/videos/configs are gated
              </div>
            </div>
          </section>

          <section className="mb-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {processSteps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                    <step.icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-400">0{index + 1}</span>
                </div>
                <h3 className="text-sm font-semibold text-zinc-900">{step.title}</h3>
                <p className="mt-1 text-xs text-zinc-600">{step.description}</p>
              </div>
            ))}
          </section>

          <section className="mb-16 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">Marketplace Workspace</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Browse anonymized location briefs and policy submissions for active
                  deployment qualification cycles.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                <Filter className="h-3.5 w-3.5" />
                Seeded catalog for v1
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
                  placeholder="Search briefs, teams, regions..."
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
                  filteredLocationBriefs.map((brief) => (
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
                            analyticsEvents.pilotExchangeOpenPolicyForm();
                            setIsPolicyDialogOpen(true);
                          }}
                        >
                          Submit against this brief
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  ))
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
                  Data Licensing from Approved Twins
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  After eval qualification, Blueprint can generate targeted synthetic
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
                  Include simulator configs and validation notes for faster handoff.
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
                  Blueprint reconstructs those captures into digital twins and simulation-ready
                  packages for eval-first deployment decisions.
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

          <section className="rounded-3xl border border-zinc-200 bg-zinc-900 p-8 text-white">
            <h2 className="text-2xl font-bold">Ready to join Pilot Exchange?</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-300">
              Operators can post deployment briefs. Robot teams can submit policies for
              standardized evaluation. Data licensing is available once scenarios clear
              qualification.
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
                  analyticsEvents.pilotExchangeOpenPolicyForm();
                  setIsPolicyDialogOpen(true);
                }}
                variant="outline"
                className="rounded-full border-zinc-500 text-white hover:bg-zinc-800"
              >
                Submit Policy for Eval
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
              Share your location profile and evaluation objective. We route matched
              policy teams into your benchmark lane.
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
            <DialogTitle>Submit Policy for Eval</DialogTitle>
            <DialogDescription>
              Share your policy profile and benchmark evidence to enter active location
              qualification cycles.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handlePolicySubmit}>
            <BaseLeadFields
              form={policyForm}
              onChange={(key, value) => setPolicyForm((prev) => ({ ...prev, [key]: value }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Target Location Type"
                value={policyForm.locationType}
                onChange={(value) =>
                  setPolicyForm((prev) => ({ ...prev, locationType: value as PilotLocationType }))
                }
                options={pilotLocationTypes}
              />
              <SelectField
                label="Robot Embodiment"
                value={policyForm.robotEmbodiment}
                onChange={(value) =>
                  setPolicyForm((prev) => ({
                    ...prev,
                    robotEmbodiment: value as RobotEmbodiment,
                  }))
                }
                options={pilotEmbodiments}
              />
              <SelectField
                label="Deployment Timeline"
                value={policyForm.timeline}
                onChange={(value) =>
                  setPolicyForm((prev) => ({ ...prev, timeline: value as DeploymentTimeline }))
                }
                options={pilotTimelines}
              />
              <SelectField
                label="Privacy Preference"
                value={policyForm.privacyMode}
                onChange={(value) =>
                  setPolicyForm((prev) => ({ ...prev, privacyMode: value as PrivacyMode }))
                }
                options={pilotPrivacyModes}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-name">Policy / Stack Name</Label>
              <Input
                id="policy-name"
                value={policyForm.policyName}
                onChange={(event) =>
                  setPolicyForm((prev) => ({ ...prev, policyName: event.target.value }))
                }
                placeholder="Your policy name or release tag"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-benchmark">Benchmark Evidence</Label>
              <Textarea
                id="policy-benchmark"
                value={policyForm.benchmarkEvidence}
                onChange={(event) =>
                  setPolicyForm((prev) => ({
                    ...prev,
                    benchmarkEvidence: event.target.value,
                  }))
                }
                placeholder="Summarize eval runs, score ranges, and failure modes."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-deployment">Deployment Summary</Label>
              <Textarea
                id="policy-deployment"
                value={policyForm.deploymentSummary}
                onChange={(event) =>
                  setPolicyForm((prev) => ({
                    ...prev,
                    deploymentSummary: event.target.value,
                  }))
                }
                placeholder="Describe deployment constraints and readiness assumptions."
                rows={3}
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
              {policyStatus === "loading" ? "Submitting..." : "Submit Policy for Eval"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDataDialogOpen} onOpenChange={setIsDataDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Data Licensing</DialogTitle>
            <DialogDescription>
              Tell us what synthetic or replayed data you need after evaluation
              qualification.
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
