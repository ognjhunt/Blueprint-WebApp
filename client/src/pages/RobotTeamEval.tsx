import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  Code2,
  Container,
  FileJson2,
  Gauge,
  GitBranch,
  Layers3,
  Gamepad2,
  Link2,
  Loader2,
  MonitorPlay,
  PackageCheck,
  Route,
  TerminalSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SEO } from "@/components/SEO";
import {
  getRobotEvalMoatScenarioFamily,
  getRobotEvalMoatSite,
  getRobotEvalMoatTask,
  representativeRobotEvalSites,
  robotEvalDecisionOptions,
  robotEvalMoatWorkflowSteps,
} from "@/data/robotEvalMoat";
import { siteWorldCards } from "@/data/siteWorlds";
import { withCsrfHeader } from "@/lib/csrf";
import { humanoidReadinessAssets } from "@/lib/editorialGeneratedAssets";
import {
  buildRobotTeamSubmissionInput,
  normalizeRobotTeamTestSubmission,
  ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS,
  type RobotTeamTestSubmission,
  type RobotTeamTestSubmissionModalityId,
} from "@/lib/robotTeamTestSubmission";
import type { CreateHostedSessionRequest } from "@/types/hostedSession";

type FieldState = Record<RobotTeamTestSubmissionModalityId, Record<string, string>>;
type EnabledState = Record<RobotTeamTestSubmissionModalityId, boolean>;

const iconByModality: Record<RobotTeamTestSubmissionModalityId, LucideIcon> = {
  policy_api_endpoint: Link2,
  docker_container: Container,
  recorded_action_trace: ClipboardList,
  high_level_skill_trace: Route,
  teleop_demo: Gamepad2,
  sim_controller_plugin: Code2,
};

const fallbackOutputs = [
  "observation_frames",
  "action_trace",
  "success_failure",
  "export_bundle",
];

const visualWorkflowSteps = [
  "Site package",
  "Robot profile",
  "Policy access",
  "Eval report",
];

const compactIntegrationModes = [
  "Site package only",
  "Policy API",
  "Container / private cloud",
  "Action trace",
];

function initialFieldState(): FieldState {
  return Object.fromEntries(
    ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition) => [
      definition.id,
      Object.fromEntries(definition.fields.map((field) => [field.key, ""])),
    ]),
  ) as FieldState;
}

function initialEnabledState(): EnabledState {
  return Object.fromEntries(
    ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition) => [
      definition.id,
      definition.id === "policy_api_endpoint",
    ]),
  ) as EnabledState;
}

function publicDemoSiteWorldIds() {
  const ids = new Set<string>();
  if (import.meta.env.MODE !== "production" || import.meta.env.VITE_ENABLE_DEMO_SITE_WORLDS === "1") {
    ids.add("siteworld-f5fd54898cfb");
  }
  const envSiteWorldId = String(
    import.meta.env.VITE_HOSTED_DEMO_SITE_WORLD_ID
      || import.meta.env.BLUEPRINT_HOSTED_DEMO_SITE_WORLD_ID
      || "",
  ).trim();
  if (envSiteWorldId) {
    ids.add(envSiteWorldId);
  }
  return ids;
}

function isPublicDemoSiteWorldId(siteWorldId: string) {
  return publicDemoSiteWorldIds().has(String(siteWorldId || "").trim());
}

async function getFirebaseIdToken(): Promise<string> {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const firebase = await import("@/lib/firebase");
    return firebase.auth?.currentUser ? await firebase.auth.currentUser.getIdToken() : "";
  } catch {
    return "";
  }
}

function createSubmissionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `robot-team-test-${crypto.randomUUID()}`;
  }
  return `robot-team-test-${Date.now()}`;
}

function selectedSiteDefaultId() {
  const publicDemo = siteWorldCards.find((site) => site.id === "siteworld-f5fd54898cfb");
  return publicDemo?.id || siteWorldCards[0]?.id || "";
}

function buildRequestReviewHref(params: {
  siteName: string;
  siteAddress: string;
  taskText: string;
  robotName: string;
  submission: RobotTeamTestSubmission | null;
}) {
  const selectedModes = params.submission?.selectedModalities.join(", ") || "structured robot-team test";
  const missing = params.submission?.missingEvidenceStatuses.join(", ") || "none recorded yet";
  const structuredRefs = params.submission
    ? params.submission.selectedModalities
        .map((modalityId) => {
          const modality = params.submission?.modalities[modalityId];
          const fields = Object.entries(modality?.fields || {})
            .filter(([, value]) => Boolean(value))
            .map(([key, value]) => `${key}=${value}`);
          return `${modalityId}: ${fields.length ? fields.join("; ") : "no refs entered"}`;
        })
        .join("\n")
    : "no structured refs entered";
  const query = new URLSearchParams({
    persona: "robot-team",
    buyerType: "robot_team",
    interest: "hosted-evaluation",
    path: "hosted-evaluation",
    source: "robot-team-eval",
    siteName: params.siteName,
    siteLocation: params.siteAddress,
    targetRobotTeam: params.robotName,
    taskStatement: `Robot-team structured test submission for ${params.taskText}`,
    requestedOutputs: params.submission?.requestedOutputs.join(", ") || fallbackOutputs.join(", "),
    message: `Selected modalities: ${selectedModes}\nMissing evidence statuses: ${missing}\nStructured refs:\n${structuredRefs}`,
  });
  return `/contact?${query.toString()}`;
}

function uniqueOutputs(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export default function RobotTeamEval() {
  const [, setLocation] = useLocation();
  const initialEvalSite = representativeRobotEvalSites[0];
  const [selectedSiteId, setSelectedSiteId] = useState(selectedSiteDefaultId);
  const [evalSiteId, setEvalSiteId] = useState(initialEvalSite.id);
  const [evalTaskId, setEvalTaskId] = useState(initialEvalSite.tasks[0].id);
  const [evalScenarioFamilyId, setEvalScenarioFamilyId] = useState(
    initialEvalSite.scenarioFamilies[0].id,
  );
  const [enabled, setEnabled] = useState<EnabledState>(() => initialEnabledState());
  const [fieldValues, setFieldValues] = useState<FieldState>(() => initialFieldState());
  const [status, setStatus] = useState<"idle" | "submitting" | "created" | "blocked">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [lastSubmission, setLastSubmission] = useState<RobotTeamTestSubmission | null>(null);

  const selectedSite = useMemo(
    () => siteWorldCards.find((site) => site.id === selectedSiteId) || siteWorldCards[0],
    [selectedSiteId],
  );
  const selectedRobot = selectedSite?.robotProfiles[0] || selectedSite?.sampleRobotProfile || null;
  const selectedTask = selectedSite?.taskCatalog[0] || null;
  const selectedScenario = selectedSite?.scenarioCatalog[0] || null;
  const selectedStartState = selectedSite?.startStateCatalog[0] || null;
  const selectedEvalSite = useMemo(() => getRobotEvalMoatSite(evalSiteId), [evalSiteId]);
  const selectedEvalTask = useMemo(
    () => getRobotEvalMoatTask(selectedEvalSite, evalTaskId),
    [evalTaskId, selectedEvalSite],
  );
  const selectedEvalScenarioFamily = useMemo(
    () => getRobotEvalMoatScenarioFamily(selectedEvalSite, evalScenarioFamilyId),
    [evalScenarioFamilyId, selectedEvalSite],
  );

  const currentSubmission = useMemo(() => {
    if (!selectedSite || !selectedRobot || !selectedTask || !selectedScenario) {
      return null;
    }
    return normalizeRobotTeamTestSubmission(
      buildRobotTeamSubmissionInput({
        siteWorldId: selectedSite.id,
        taskId: selectedTask.id,
        scenarioId: selectedScenario.id,
        robotProfileId: selectedRobot.id || "",
        modalities: Object.fromEntries(
          ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition) => [
            definition.id,
            {
              selected: enabled[definition.id],
              fields: fieldValues[definition.id],
            },
          ]),
        ),
      }),
    );
  }, [enabled, fieldValues, selectedRobot, selectedScenario, selectedSite, selectedTask]);

  const requestReviewHref = buildRequestReviewHref({
    siteName: selectedSite?.siteName || "Blueprint site package",
    siteAddress: selectedSite?.siteAddress || "",
    taskText: selectedEvalTask?.label || selectedTask?.taskText || "selected robot task",
    robotName: selectedRobot?.displayName || "robot profile",
    submission: lastSubmission || currentSubmission,
  });

  const updateEvalSite = (siteId: string) => {
    const nextSite = getRobotEvalMoatSite(siteId);
    setEvalSiteId(nextSite.id);
    setEvalTaskId(nextSite.tasks[0].id);
    setEvalScenarioFamilyId(nextSite.scenarioFamilies[0].id);
    if (siteWorldCards.some((site) => site.id === nextSite.catalogSiteWorldId)) {
      setSelectedSiteId(nextSite.catalogSiteWorldId);
    }
  };

  const updateField = (
    modalityId: RobotTeamTestSubmissionModalityId,
    fieldKey: string,
    value: string,
  ) => {
    setFieldValues((current) => ({
      ...current,
      [modalityId]: {
        ...current[modalityId],
        [fieldKey]: value,
      },
    }));
  };

  const createHostedSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setStatusMessage("");

    if (!selectedSite || !selectedRobot || !selectedTask || !selectedScenario || !selectedStartState) {
      setStatus("blocked");
      setStatusMessage("Select a site package with task, scenario, start-state, and robot-profile records.");
      return;
    }

    const submission = normalizeRobotTeamTestSubmission(
      buildRobotTeamSubmissionInput({
        submissionId: createSubmissionId(),
        siteWorldId: selectedSite.id,
        taskId: selectedTask.id,
        scenarioId: selectedScenario.id,
        robotProfileId: selectedRobot.id || "",
        modalities: Object.fromEntries(
          ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition) => [
            definition.id,
            {
              selected: enabled[definition.id],
              fields: fieldValues[definition.id],
            },
          ]),
        ),
      }),
    );

    if (!submission || submission.selectedModalities.length === 0) {
      setLastSubmission(submission);
      setStatus("blocked");
      setStatusMessage("Select at least one submission modality.");
      return;
    }

    setLastSubmission(submission);
    const requestedOutputs = uniqueOutputs([
      ...fallbackOutputs,
      ...submission.requestedOutputs,
    ]);
    const requestPayload: CreateHostedSessionRequest = {
      siteWorldId: selectedSite.id,
      sessionMode: "runtime_only",
      runtimeUi: null,
      robotProfileId: selectedRobot.id || "",
      taskId: selectedTask.id,
      scenarioId: selectedScenario.id,
      startStateId: selectedStartState.id,
      requestedBackend: selectedSite.defaultRuntimeBackend,
      requestedOutputs,
      exportModes: ["raw_bundle", "rlds_dataset"],
      runtimeSessionConfig: {
        canonical_package_uri: selectedSite.siteWorldSpecUri || null,
        canonical_package_version: null,
        prompt: null,
        trajectory: null,
        presentation_model: null,
        debug_mode: false,
        unsafe_allow_blocked_site_world: isPublicDemoSiteWorldId(selectedSite.id),
      },
      policy: {
        runMode: "robot_team_structured_test_submission",
        robotTeamTestSubmission: submission,
        proofBoundary:
          "Advisory review only. Submitted references are not deployment, safety, robot-run, sim-run, rights, or guaranteed-threshold proof.",
      },
      notes: [
        `Robot-team test submission modalities: ${submission.selectedModalities.join(", ")}`,
        `Representative eval workflow: ${selectedEvalSite.siteName} / ${selectedEvalTask.label} / ${selectedEvalScenarioFamily.label}`,
      ].join("\n"),
    };

    try {
      const token = await getFirebaseIdToken();
      const usePublicDemoRoutes = isPublicDemoSiteWorldId(selectedSite.id);
      if (!token && !usePublicDemoRoutes) {
        throw new Error("Direct session creation needs robot-team access for this protected site package.");
      }
      const response = await fetch("/api/site-worlds/sessions", {
        method: "POST",
        headers: usePublicDemoRoutes
          ? { "Content-Type": "application/json" }
          : {
              ...(await withCsrfHeader({ "Content-Type": "application/json" })),
              Authorization: `Bearer ${token}`,
            },
        body: JSON.stringify(requestPayload),
      });
      const payload = (await response.json()) as {
        workspaceUrl?: string;
        error?: string;
        blockers?: string[];
      };
      if (!response.ok || !payload.workspaceUrl) {
        throw new Error(
          Array.isArray(payload.blockers) && payload.blockers.length > 0
            ? payload.blockers.join(", ")
            : payload.error || "Hosted-session creation is request-gated for this package.",
        );
      }
      setStatus("created");
      setStatusMessage("Hosted session created with the structured robot-team test submission attached.");
      setLocation(payload.workspaceUrl);
    } catch (error) {
      setStatus("blocked");
      setStatusMessage(error instanceof Error ? error.message : "Direct session creation is request-gated.");
    }
  };

  return (
    <>
      <SEO
        title="Robot-Team Test Interface | Blueprint"
        description="Submit policy APIs, containers, action traces, skill traces, teleop demos, and sim-controller plugins against Blueprint real-site robot eval packages."
        canonical="/for-robot-teams"
      />

      <main className="min-h-screen bg-[#f2f0e8] text-slate-950">
        <section className="border-b border-black/10 bg-[#101412] text-white">
          <div className="mx-auto grid max-w-[118rem] gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,0.58fr)_minmax(22rem,0.42fr)] lg:px-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                <Bot className="h-4 w-4" />
                Robot-team eval
              </div>
              <h1 className="mt-6 max-w-[12ch] text-[clamp(3.2rem,7vw,7.5rem)] font-semibold leading-[0.86] tracking-[-0.06em]">
                Robot-team test interface
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70">
                Share a safe policy interface against one capture-backed site
                package. Keep source code and model weights private.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#robot-team-submission"
                  className="inline-flex min-h-12 items-center justify-center rounded-md bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
                >
                  Open submission
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href={requestReviewHref}
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Request review
                </a>
              </div>
            </div>
            <figure className="self-end overflow-hidden rounded-lg border border-white/15 bg-white/8 shadow-[0_28px_90px_rgba(0,0,0,0.22)]">
              <img
                src={humanoidReadinessAssets.robotTeamEvalWorkflow}
                alt="Generated visual of a humanoid robot in a warehouse evaluation bay with site scan overlays and an evaluation dashboard"
                className="aspect-[16/10] w-full object-cover"
              />
            </figure>
          </div>
        </section>

        <section
          aria-labelledby="robot-eval-simple-explainer"
          className="border-b border-black/10 bg-white"
        >
          <div className="mx-auto grid max-w-[118rem] gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(18rem,0.38fr)_minmax(0,0.62fr)] lg:px-10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                How simulation evals work
              </p>
              <h2
                id="robot-eval-simple-explainer"
                className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-slate-950 md:text-4xl"
              >
                Site package + robot profile + policy access = eval report.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
                Robot teams keep source code and model weights private. Blueprint
                only needs the least-sensitive interface that still lets the task
                be scored.
              </p>
              <p className="mt-5 border-l-2 border-amber-500 pl-3 text-xs leading-5 text-slate-500">
                Submitted interfaces are inputs. Stronger claims need run logs,
                owner-system proof, rights review, and agreed thresholds.
              </p>
            </div>

            <div className="flex flex-col justify-center">
              <div className="grid grid-cols-2 gap-2">
                {visualWorkflowSteps.map((step, index) => (
                  <div key={step} className="border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{step}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {compactIntegrationModes.map((mode) => (
                  <span
                    key={mode}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    {mode}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="real-site-robot-eval-workflow"
          className="mx-auto grid max-w-[118rem] gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_25rem] lg:px-10"
        >
          <div className="min-w-0 rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-500">
                  Real-site eval moat MVP
                </p>
                <h2
                  id="real-site-robot-eval-workflow"
                  className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950"
                >
                  Choose site, task, and scenario family
                </h2>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                  The product loop stays artifact-first: representative site
                  package, canonical task ID, scenario family, submitted policy or
                  trace references, advisory report, and a scoped pilot, tune, or
                  hold decision.
                </p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase text-amber-900">
                Advisory sample
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  Representative site
                </span>
                <select
                  aria-label="Representative site"
                  value={selectedEvalSite.id}
                  onChange={(event) => updateEvalSite(event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                >
                  {representativeRobotEvalSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.siteType} - {site.siteName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  Canonical task
                </span>
                <select
                  aria-label="Canonical task"
                  value={selectedEvalTask.id}
                  onChange={(event) => setEvalTaskId(event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                >
                  {selectedEvalSite.tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.label} - {task.canonicalTaskId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  Scenario family
                </span>
                <select
                  aria-label="Scenario family"
                  value={selectedEvalScenarioFamily.id}
                  onChange={(event) => setEvalScenarioFamilyId(event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                >
                  {selectedEvalSite.scenarioFamilies.map((scenarioFamily) => (
                    <option key={scenarioFamily.id} value={scenarioFamily.id}>
                      {scenarioFamily.label} - {scenarioFamily.generatedScenarioCount} variants
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,0.7fr)_minmax(18rem,0.3fr)]">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Layers3 className="h-4 w-4 text-slate-500" />
                  {selectedEvalScenarioFamily.label}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {selectedEvalScenarioFamily.sampleScenario}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedEvalScenarioFamily.variationIds.map((variationId) => (
                    <span
                      key={variationId}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600"
                    >
                      {variationId.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Task success
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">
                  {selectedEvalTask.successDefinition}
                </p>
                <p className="mt-3 text-xs font-semibold uppercase text-slate-500">
                  Required evidence
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedEvalTask.requiredEvidence.map((evidence) => (
                    <span
                      key={evidence}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600"
                    >
                      {evidence.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {robotEvalMoatWorkflowSteps.map((step, index) => (
                <article
                  key={step.id}
                  className="rounded-md border border-slate-200 bg-white p-3"
                >
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-950">{step.label}</h3>
                  <p className="mt-2 break-words text-xs font-semibold text-slate-500">
                    {step.artifact}
                  </p>
                </article>
              ))}
            </div>

          </div>

          <aside className="h-fit rounded-lg border border-black/10 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
                <Gauge className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Advisory eval report</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Representative policy_eval_report.json output for the selected workflow.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {selectedEvalSite.evalReport.map((metric) => (
                <div
                  key={metric.id}
                  className={`rounded-md border p-3 ${
                    metric.status === "blocked"
                      ? "border-amber-200 bg-amber-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">{metric.label}</p>
                    <span className="shrink-0 text-xs font-semibold uppercase text-slate-500">
                      {metric.status}
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{metric.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-950">Decision options</p>
              </div>
              <div className="mt-3 grid gap-2">
                {robotEvalDecisionOptions.map((option) => (
                  <div key={option.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-950">{option.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{option.criteria}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <form
          id="robot-team-submission"
          onSubmit={createHostedSession}
          className="mx-auto grid max-w-[118rem] gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:px-10"
        >
          <div className="min-w-0 space-y-5">
            <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Site package
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                    Choose the real-site package and task context
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    The submission is attached to a siteWorldId, taskId, scenarioId,
                    startStateId, robotProfileId, and requested output list.
                  </p>
                </div>
                <PackageCheck className="hidden h-10 w-10 text-slate-400 md:block" />
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,0.3fr)]">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-800">Package</span>
                  <select
                    value={selectedSite?.id || selectedSiteId}
                    onChange={(event) => setSelectedSiteId(event.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                  >
                    {siteWorldCards.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.siteName} - {site.sampleTask}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Selected robot</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{selectedRobot?.displayName || "Robot profile required"}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{selectedRobot?.actionSpaceSummary || "Action space pending."}</p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              {ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition, index) => {
                const Icon = iconByModality[definition.id];
                const normalized = currentSubmission?.modalities[definition.id];
                const selected = enabled[definition.id];
                return (
                  <article
                    key={definition.id}
                    className={`rounded-lg border bg-white p-5 shadow-sm transition ${
                      selected ? "border-slate-950" : "border-black/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
                          <Icon className="h-5 w-5 text-slate-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Modality {index + 1}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">
                            {definition.label}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{definition.summary}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEnabled((current) => ({
                            ...current,
                            [definition.id]: !current[definition.id],
                          }))
                        }
                        className={`inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 text-xs font-semibold uppercase tracking-[0.12em] ${
                          selected
                            ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-white text-slate-500"
                        }`}
                      >
                        {selected ? "Selected" : "Add"}
                      </button>
                    </div>

                    {selected ? (
                      <div className="mt-5 grid gap-3">
                        {definition.fields.map((field) => (
                          <label key={field.key} className="block">
                            <span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-semibold text-slate-800">
                              <span>{field.label}</span>
                              {field.required ? <span className="text-xs text-slate-400">Required</span> : null}
                            </span>
                            <textarea
                              aria-label={`${definition.label} ${field.label}`}
                              value={fieldValues[definition.id][field.key] || ""}
                              onChange={(event) => updateField(definition.id, field.key, event.target.value)}
                              rows={field.key.toLowerCase().includes("sequence") ? 3 : 2}
                              placeholder={field.placeholder}
                              className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950"
                            />
                            <span className="mt-1.5 block text-xs leading-5 text-slate-500">{field.helper}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                        Add this mode to show the required references.
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
                        {normalized?.reviewStatus.replaceAll("_", " ") || "not selected"}
                      </span>
                      {normalized?.missingEvidenceStatus ? (
                        <span className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-amber-800">
                          {normalized.missingEvidenceStatus}
                        </span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          </div>

          <aside className="h-fit rounded-lg border border-black/10 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
                <TerminalSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Submission summary</p>
                <p className="text-xs text-slate-500">Policy payload preview</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Site</p>
                <p className="mt-1 break-words font-semibold text-slate-950">{selectedSite?.siteName}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Task</p>
                <p className="mt-1 break-words font-semibold text-slate-950">
                  {selectedEvalTask.label}
                </p>
                <p className="mt-1 break-words text-xs font-semibold text-slate-500">
                  {selectedEvalTask.canonicalTaskId}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Scenario family</p>
                <p className="mt-1 break-words font-semibold text-slate-950">
                  {selectedEvalScenarioFamily.label}
                </p>
                <p className="mt-1 break-words text-xs font-semibold text-slate-500">
                  {selectedEvalScenarioFamily.generatedScenarioCount} generated variants
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Selected modalities</p>
                <p className="mt-1 break-words font-semibold text-slate-950">
                  {currentSubmission?.selectedModalities.length
                    ? currentSubmission.selectedModalities.join(", ")
                    : "None selected"}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Missing evidence</p>
                <p className="mt-1 break-words font-semibold text-slate-950">
                  {currentSubmission?.missingEvidenceStatuses.length
                    ? currentSubmission.missingEvidenceStatuses.join(", ")
                    : "No schema gaps from selected modalities"}
                </p>
              </div>
            </div>

            {statusMessage ? (
              <div
                className={`mt-5 rounded-md border p-3 text-sm leading-6 ${
                  status === "created"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-amber-300 bg-amber-50 text-amber-900"
                }`}
              >
                {status === "created" ? <CheckCircle2 className="mb-2 h-4 w-4" /> : <FileJson2 className="mb-2 h-4 w-4" />}
                {statusMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={status === "submitting"}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {status === "submitting" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating
                </>
              ) : (
                <>
                  Create hosted session
                  <MonitorPlay className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
            <a
              href={requestReviewHref}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-950 transition hover:border-slate-950"
            >
              Submit intake request
            </a>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Direct creation uses the existing hosted-session endpoint. Protected
              packages still require robot-team access or entitlement proof.
            </p>
          </aside>
        </form>
      </main>
    </>
  );
}
