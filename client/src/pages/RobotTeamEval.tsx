import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { siteWorldCards } from "@/data/siteWorlds";
import { withCsrfHeader } from "@/lib/csrf";
import { humanoidReadinessAssets } from "@/lib/editorialGeneratedAssets";
import {
  buildRobotTeamSubmissionInput,
  normalizeRobotTeamTestSubmission,
  ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS,
  type RobotTeamTestSubmission,
  type RobotTeamTestSubmissionEpisodeCount,
  type RobotTeamTestSubmissionModalityId,
  type RobotTeamTestSubmissionValidationMode,
} from "@/lib/robotTeamTestSubmission";
import type { CreateHostedSessionRequest } from "@/types/hostedSession";

type FieldState = Record<
  RobotTeamTestSubmissionModalityId,
  Record<string, string>
>;

const accessModes = ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.filter(
  (definition) =>
    ["policy_api_endpoint", "docker_container", "model_checkpoint"].includes(
      definition.id,
    ),
);

const sitePackages = [
  { id: "siteworld-f5fd54898cfb", label: "Warehouse tote transfer" },
  { id: siteWorldCards[1]?.id || "retail-backroom", label: "Retail backroom pick" },
  { id: siteWorldCards[2]?.id || "lab-bench", label: "Lab bench handoff" },
];

function createSubmissionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `robot-team-test-${crypto.randomUUID()}`;
  }
  return `robot-team-test-${Date.now()}`;
}

function publicDemoSiteWorldIds() {
  const ids = new Set<string>(["siteworld-f5fd54898cfb"]);
  const envSiteWorldId = String(
    import.meta.env.VITE_HOSTED_DEMO_SITE_WORLD_ID ||
      import.meta.env.BLUEPRINT_HOSTED_DEMO_SITE_WORLD_ID ||
      "",
  ).trim();
  if (envSiteWorldId) ids.add(envSiteWorldId);
  return ids;
}

function isPublicDemoSiteWorldId(siteWorldId: string) {
  return publicDemoSiteWorldIds().has(String(siteWorldId || "").trim());
}

async function getFirebaseIdToken(): Promise<string> {
  if (typeof window === "undefined") return "";

  try {
    const firebase = await import("@/lib/firebase");
    return firebase.auth?.currentUser
      ? await firebase.auth.currentUser.getIdToken()
      : "";
  } catch {
    return "";
  }
}

function initialFieldState(): FieldState {
  return Object.fromEntries(
    ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition) => [
      definition.id,
      Object.fromEntries(definition.fields.map((field) => [field.key, ""])),
    ]),
  ) as FieldState;
}

function selectedSiteWorld(siteWorldId: string) {
  return (
    siteWorldCards.find((site) => site.id === siteWorldId) ||
    siteWorldCards.find((site) => site.id === "siteworld-f5fd54898cfb") ||
    siteWorldCards[0]
  );
}

function splitLabels(value: string) {
  return value
    .split(/[\n,]/)
    .map((label) => label.trim())
    .filter(Boolean);
}

function intakeHref(params: {
  submission: RobotTeamTestSubmission | null;
  selectedMode: RobotTeamTestSubmissionModalityId;
}) {
  const mode = params.submission?.modalities[params.selectedMode];
  const fieldSummary = Object.entries(mode?.fields || {})
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
  const query = new URLSearchParams({
    persona: "robot-team",
    buyerType: "robot_team",
    interest: "policy-evaluation-run",
    path: "policy-evaluation-run",
    source: "robot-team-eval",
    requestedOutputs: "Policy Evaluation Run",
    episodeCount: params.submission?.episodeCount || "100",
    validationMode: params.submission?.validationMode || "comparative_policy_eval",
    message: [
      `policyLabels=${params.submission?.policyLabels.join(", ") || "none entered"}`,
      `accessMode=${params.selectedMode}`,
      fieldSummary,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return `/contact/robot-team?${query.toString()}`;
}

export default function RobotTeamEval() {
  const [, setLocation] = useLocation();
  const [siteWorldId, setSiteWorldId] = useState("siteworld-f5fd54898cfb");
  const [policyLabels, setPolicyLabels] = useState("primary-policy");
  const [episodeCount, setEpisodeCount] =
    useState<RobotTeamTestSubmissionEpisodeCount>("100");
  const [validationMode, setValidationMode] =
    useState<RobotTeamTestSubmissionValidationMode>("comparative_policy_eval");
  const [observationSchemaRef, setObservationSchemaRef] = useState("");
  const [actionSchemaRef, setActionSchemaRef] = useState("");
  const [controlFrequency, setControlFrequency] = useState("");
  const [robotEmbodiment, setRobotEmbodiment] = useState("");
  const [taskInstruction, setTaskInstruction] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [accessMode, setAccessMode] =
    useState<RobotTeamTestSubmissionModalityId>("policy_api_endpoint");
  const [fieldValues, setFieldValues] = useState<FieldState>(() =>
    initialFieldState(),
  );
  const [status, setStatus] = useState<
    "idle" | "submitting" | "created" | "blocked"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [lastSubmission, setLastSubmission] =
    useState<RobotTeamTestSubmission | null>(null);

  const site = useMemo(() => selectedSiteWorld(siteWorldId), [siteWorldId]);
  const robot = site?.robotProfiles[0] || site?.sampleRobotProfile || null;
  const task = site?.taskCatalog[0] || null;
  const scenario = site?.scenarioCatalog[0] || null;
  const startState = site?.startStateCatalog[0] || null;
  const selectedAccessMode =
    accessModes.find((definition) => definition.id === accessMode) ||
    accessModes[0];

  const submissionPreview = useMemo(() => {
    if (!site || !robot || !task || !scenario) return null;
    return normalizeRobotTeamTestSubmission(
      buildRobotTeamSubmissionInput({
        siteWorldId: site.id,
        taskId: task.id,
        scenarioId: scenario.id,
        robotProfileId: robot.id || "",
        policyLabels: splitLabels(policyLabels),
        episodeCount,
        validationMode,
        observationSchemaRef,
        actionSchemaRef,
        controlFrequency,
        robotEmbodiment,
        gripper: "",
        cameraSetup: "",
        intrinsicsExtrinsicsRef: "",
        sitePackageTarget: site.siteName,
        taskInstruction,
        startStateConstraints: "",
        successCriteria,
        modalities: Object.fromEntries(
          ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition) => [
            definition.id,
            {
              selected: definition.id === accessMode,
              fields: fieldValues[definition.id],
            },
          ]),
        ),
      }),
    );
  }, [
    accessMode,
    actionSchemaRef,
    controlFrequency,
    episodeCount,
    fieldValues,
    observationSchemaRef,
    policyLabels,
    robot,
    robotEmbodiment,
    scenario,
    site,
    successCriteria,
    task,
    taskInstruction,
    validationMode,
  ]);

  const updateAccessField = (fieldKey: string, value: string) => {
    setFieldValues((current) => ({
      ...current,
      [accessMode]: {
        ...current[accessMode],
        [fieldKey]: value,
      },
    }));
  };

  const createHostedSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setStatusMessage("");

    if (!site || !robot || !task || !scenario || !startState) {
      setStatus("blocked");
      setStatusMessage("Select a site package with task and robot records.");
      return;
    }

    const submission = normalizeRobotTeamTestSubmission(
      buildRobotTeamSubmissionInput({
        submissionId: createSubmissionId(),
        siteWorldId: site.id,
        taskId: task.id,
        scenarioId: scenario.id,
        robotProfileId: robot.id || "",
        policyLabels: splitLabels(policyLabels),
        episodeCount,
        validationMode,
        observationSchemaRef,
        actionSchemaRef,
        controlFrequency,
        robotEmbodiment,
        gripper: "",
        cameraSetup: "",
        intrinsicsExtrinsicsRef: "",
        sitePackageTarget: site.siteName,
        taskInstruction,
        startStateConstraints: "",
        successCriteria,
        modalities: Object.fromEntries(
          ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.map((definition) => [
            definition.id,
            {
              selected: definition.id === accessMode,
              fields: fieldValues[definition.id],
            },
          ]),
        ),
      }),
    );

    if (!submission) {
      setStatus("blocked");
      setStatusMessage("Add a policy access method before creating a session.");
      return;
    }

    setLastSubmission(submission);
    const requestPayload: CreateHostedSessionRequest = {
      siteWorldId: site.id,
      sessionMode: "runtime_only",
      runtimeUi: null,
      robotProfileId: robot.id || "",
      taskId: task.id,
      scenarioId: scenario.id,
      startStateId: startState.id,
      requestedBackend: site.defaultRuntimeBackend,
      requestedOutputs: [
        "policy_ranking",
        "failure_taxonomy",
        "ood_uncertainty_flags",
        "validation_targets",
      ],
      exportModes: ["raw_bundle", "rlds_dataset"],
      runtimeSessionConfig: {
        canonical_package_uri: site.siteWorldSpecUri || null,
        canonical_package_version: null,
        prompt: null,
        trajectory: null,
        presentation_model: null,
        debug_mode: false,
        unsafe_allow_blocked_site_world: isPublicDemoSiteWorldId(site.id),
      },
      policy: {
        runMode: "robot_team_structured_test_submission",
        robotTeamTestSubmission: submission,
        proofBoundary:
          "Virtual WAM/VLA outputs rank policies; they do not prove safety validation, deployment approval, universal SRCC, or real-world success.",
      },
      notes: `Policy Evaluation Run: ${submission.policyLabels.join(", ")}`,
    };

    try {
      const token = await getFirebaseIdToken();
      const publicDemoRoute = isPublicDemoSiteWorldId(site.id);
      if (!token && !publicDemoRoute) {
        throw new Error("Runtime path is request-gated.");
      }

      const response = await fetch("/api/site-worlds/sessions", {
        method: "POST",
        headers: publicDemoRoute
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
            : payload.error || "Runtime path is request-gated.",
        );
      }
      setStatus("created");
      setStatusMessage("Hosted session created.");
      setLocation(payload.workspaceUrl);
    } catch (error) {
      setStatus("blocked");
      setStatusMessage(
        error instanceof Error ? error.message : "Runtime path is request-gated.",
      );
    }
  };

  return (
    <>
      <SEO
        title="Policy Evaluation Run for Robot Teams | Blueprint"
        description="Create a capture-backed WAM/VLA Policy Evaluation Run with a policy API, container, or model checkpoint."
        canonical="/for-robot-teams"
        image={`https://tryblueprint.io${humanoidReadinessAssets.robotTeamEvalWorkflow}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Policy Evaluation Run for Robot Teams",
          description:
            "Create a capture-backed WAM/VLA Policy Evaluation Run with a policy API, Docker container, or model checkpoint.",
          url: "https://tryblueprint.io/for-robot-teams",
        }}
      />

      <main className="bg-white text-slate-950">
        <section className="border-b border-slate-200">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1fr_0.9fr] md:items-center md:px-8">
            <div>
              <p className="text-sm font-semibold text-amber-700">
                Robot teams
              </p>
              <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight tracking-normal md:text-6xl">
                Evaluate robot policies before field time.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Connect a policy API, container, or model checkpoint. Blueprint
                runs it against a captured site task pack and returns ranking,
                failures, and validation targets.
              </p>
            </div>
            <img
              src={humanoidReadinessAssets.robotTeamEvalWorkflow}
              alt="Humanoid robot in a warehouse evaluation bay"
              className="aspect-[4/3] w-full border border-slate-200 object-cover"
            />
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-7xl gap-4 px-5 py-8 md:grid-cols-3 md:px-8">
            {["Capture-backed task pack", "100 / 500 WAM-eval episodes", "Rank 1-3 policies"].map(
              (item) => (
                <div key={item} className="border border-slate-200 bg-white p-4">
                  <CheckCircle2
                    className="h-5 w-5 text-emerald-600"
                    aria-hidden="true"
                  />
                  <p className="mt-3 text-sm font-semibold">{item}</p>
                </div>
              ),
            )}
          </div>
        </section>

        <section
          id="robot-team-submission"
          className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-[0.9fr_0.55fr] md:px-8"
        >
          <form
            className="border border-slate-200 p-5 md:p-6"
            onSubmit={createHostedSession}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-3xl font-semibold">Evaluation setup</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Keep it simple. Pick the pack, policy access method, and
                  episode count.
                </p>
              </div>
              <a
                href={intakeHref({
                  submission: lastSubmission || submissionPreview,
                  selectedMode: accessMode,
                })}
                className="inline-flex min-h-10 items-center justify-center border border-slate-300 px-3 text-sm font-semibold text-slate-950 hover:bg-slate-50"
              >
                Submit intake request
              </a>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Site package
                <select
                  value={siteWorldId}
                  onChange={(event) => setSiteWorldId(event.target.value)}
                  className="min-h-11 border border-slate-300 bg-white px-3 text-sm font-normal"
                >
                  {sitePackages.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                Policy / checkpoint labels
                <input
                  value={policyLabels}
                  onChange={(event) => setPolicyLabels(event.target.value)}
                  className="min-h-11 border border-slate-300 px-3 text-sm font-normal"
                  placeholder="policy_v1, policy_v2"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                Episode count
                <select
                  value={episodeCount}
                  onChange={(event) =>
                    setEpisodeCount(
                      event.target.value as RobotTeamTestSubmissionEpisodeCount,
                    )
                  }
                  className="min-h-11 border border-slate-300 bg-white px-3 text-sm font-normal"
                >
                  <option value="100">100</option>
                  <option value="500">500</option>
                  <option value="custom">Custom</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                Validation mode
                <select
                  value={validationMode}
                  onChange={(event) =>
                    setValidationMode(
                      event.target.value as RobotTeamTestSubmissionValidationMode,
                    )
                  }
                  className="min-h-11 border border-slate-300 bg-white px-3 text-sm font-normal"
                >
                  <option value="comparative_policy_eval">
                    Comparative policy eval
                  </option>
                  <option value="virtual_preflight">Virtual preflight</option>
                  <option value="real_rollout_validated">
                    Real rollout validated
                  </option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                Observation schema ref
                <input
                  value={observationSchemaRef}
                  onChange={(event) => setObservationSchemaRef(event.target.value)}
                  className="min-h-11 border border-slate-300 px-3 text-sm font-normal"
                  placeholder="gs://team/schemas/observation.json"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                Action schema ref
                <input
                  value={actionSchemaRef}
                  onChange={(event) => setActionSchemaRef(event.target.value)}
                  className="min-h-11 border border-slate-300 px-3 text-sm font-normal"
                  placeholder="gs://team/schemas/action.json"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                Control frequency
                <input
                  value={controlFrequency}
                  onChange={(event) => setControlFrequency(event.target.value)}
                  className="min-h-11 border border-slate-300 px-3 text-sm font-normal"
                  placeholder="20 Hz"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                Robot embodiment
                <input
                  value={robotEmbodiment}
                  onChange={(event) => setRobotEmbodiment(event.target.value)}
                  className="min-h-11 border border-slate-300 px-3 text-sm font-normal"
                  placeholder="mobile manipulator"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold md:col-span-2">
                Task instruction
                <input
                  value={taskInstruction}
                  onChange={(event) => setTaskInstruction(event.target.value)}
                  className="min-h-11 border border-slate-300 px-3 text-sm font-normal"
                  placeholder="pick tote from shelf"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold md:col-span-2">
                Success criteria
                <input
                  value={successCriteria}
                  onChange={(event) => setSuccessCriteria(event.target.value)}
                  className="min-h-11 border border-slate-300 px-3 text-sm font-normal"
                  placeholder="tote placed without safety event"
                />
              </label>
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-semibold">Policy access</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {accessModes.map((mode) => (
                  <label
                    key={mode.id}
                    className={`cursor-pointer border p-4 ${
                      accessMode === mode.id
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-950"
                    }`}
                  >
                    <input
                      type="radio"
                      name="accessMode"
                      value={mode.id}
                      checked={accessMode === mode.id}
                      onChange={() => setAccessMode(mode.id)}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold">{mode.label}</span>
                    <span className="mt-2 block text-xs leading-5 opacity-75">
                      {mode.summary}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {selectedAccessMode.fields.map((field) => (
                <label key={field.key} className="grid gap-2 text-sm font-semibold">
                  {selectedAccessMode.label} {field.label}
                  <input
                    value={fieldValues[accessMode][field.key] || ""}
                    onChange={(event) =>
                      updateAccessField(field.key, event.target.value)
                    }
                    className="min-h-11 border border-slate-300 px-3 text-sm font-normal"
                    placeholder={field.placeholder}
                  />
                </label>
              ))}
            </div>

            {statusMessage ? (
              <div
                className="mt-5 border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
                role="status"
              >
                {statusMessage}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex min-h-12 items-center justify-center gap-2 bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "submitting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Create hosted session
              </button>
              <a
                href={intakeHref({
                  submission: lastSubmission || submissionPreview,
                  selectedMode: accessMode,
                })}
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-slate-300 px-5 text-sm font-semibold text-slate-950 hover:bg-slate-50"
              >
                Submit intake request
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </form>

          <aside className="space-y-4">
            <div className="border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-2xl font-semibold">Run summary</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Site</dt>
                  <dd className="text-right font-semibold">
                    {site?.siteName || "Selected package"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Task</dt>
                  <dd className="text-right font-semibold">
                    {task?.taskText || "Selected task"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Policies</dt>
                  <dd className="text-right font-semibold">
                    {submissionPreview?.policyLabels.join(", ") ||
                      "primary-policy"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Mode</dt>
                  <dd className="text-right font-semibold">
                    {validationMode.replaceAll("_", " ")}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border border-slate-200 p-5">
              <h2 className="text-2xl font-semibold">Boundary</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Virtual WAM/VLA outputs rank policies; they do not prove safety
                validation, deployment approval, universal SRCC, or real-world
                success.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </>
  );
}
