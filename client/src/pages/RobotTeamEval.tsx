import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import {
  robotPolicyComparisonUseCases,
  robotPolicyEvaluationBoundary,
  robotPolicyResearchSignals,
} from "@/data/robotPolicyEvaluationClaims";
import { siteWorldCards } from "@/data/siteWorlds";
import { withCsrfHeader } from "@/lib/csrf";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import {
  buildRobotTeamSubmissionInput,
  normalizeRobotTeamTestSubmission,
  ROBOT_TEAM_HARDWARE_INTEGRATION_OPTIONS,
  ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS,
  type RobotTeamTestSubmission,
  type RobotTeamTestSubmissionEpisodeCount,
  type RobotTeamTestSubmissionHardwareIntegrationMode,
  type RobotTeamTestSubmissionModalityId,
  type RobotTeamTestSubmissionSiteIpProtectionLevel,
  type RobotTeamTestSubmissionValidationMode,
} from "@/lib/robotTeamTestSubmission";
import type { CreateHostedSessionRequest } from "@/types/hostedSession";

type FieldState = Record<
  RobotTeamTestSubmissionModalityId,
  Record<string, string>
>;

const accessModes = ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.filter(
  (definition) => Boolean(definition.id),
);

const shortAccessLabels: Record<RobotTeamTestSubmissionModalityId, string> = {
  policy_api_endpoint: "API",
  docker_container: "Docker",
  model_checkpoint: "Checkpoint",
  recorded_action_trace: "Trace",
  high_level_skill_trace: "Skill trace",
  teleop_demo: "Teleop",
  sim_controller_plugin: "Sim plugin",
};

const sitePackages = [
  { id: "siteworld-f5fd54898cfb", label: "Warehouse tote transfer" },
  { id: siteWorldCards[1]?.id || "retail-backroom", label: "Retail backroom pick" },
  { id: siteWorldCards[2]?.id || "lab-bench", label: "Lab bench handoff" },
];

const steps = [
  ["1", "Pick task"],
  ["2", "Add policies"],
  ["3", "Tell us robot"],
  ["4", "Choose episodes"],
  ["5", "Protect IP"],
];

const privateHardwareRows = [
  {
    title: "Blueprint-hosted private asset",
    body:
      "Share a private Robot Embodiment Pack under NDA when you want Blueprint to compose the robot into a private hosted run.",
  },
  {
    title: "Customer-hosted sealed capsule",
    body:
      "Keep your robot model, simulator, controller, and policy runtime inside your environment while returning normalized owner proof.",
  },
  {
    title: "Physical robot evidence bridge",
    body:
      "Return camera refs, action logs, robot state, timestamps, outcomes, checksums, and operator attestation by scenario ID.",
  },
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

const hostedSessionRequestGatedMessage =
  "Hosted session access is request-gated for this package. Submit an intake request so Blueprint can confirm runtime access, rights, pricing, and proof boundaries before opening a session.";

function hostedSessionErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Runtime path is request-gated.";
  const normalized = message.toLowerCase();
  if (
    normalized.includes("runtime path is request-gated") ||
    normalized.includes("reachable runtime handle") ||
    normalized.includes("missing authenticated user") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    return hostedSessionRequestGatedMessage;
  }
  return message;
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
      `hardwareIntegration=${params.submission?.hardwareIntegrationMode || "customer_hosted_sealed_eval_capsule"}`,
      `siteIpProtection=${params.submission?.siteIpProtectionLevel || "sealed_eval_capsule"}`,
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
  const [hardwareIntegrationMode, setHardwareIntegrationMode] =
    useState<RobotTeamTestSubmissionHardwareIntegrationMode>(
      "customer_hosted_sealed_eval_capsule",
    );
  const [siteIpProtectionLevel, setSiteIpProtectionLevel] =
    useState<RobotTeamTestSubmissionSiteIpProtectionLevel>("sealed_eval_capsule");
  const [robotEmbodimentPackRef, setRobotEmbodimentPackRef] = useState("");
  const [customerHostedConnectorRef, setCustomerHostedConnectorRef] =
    useState("");
  const [observationSchemaRef, setObservationSchemaRef] = useState("");
  const [actionSchemaRef, setActionSchemaRef] = useState("");
  const [controlFrequency, setControlFrequency] = useState("");
  const [robotEmbodiment, setRobotEmbodiment] = useState("");
  const [gripper, setGripper] = useState("");
  const [cameraSetup, setCameraSetup] = useState("");
  const [intrinsicsExtrinsicsRef, setIntrinsicsExtrinsicsRef] = useState("");
  const [taskInstruction, setTaskInstruction] = useState("");
  const [startStateConstraints, setStartStateConstraints] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [customEpisodeCount, setCustomEpisodeCount] = useState("");
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
        customEpisodeCount,
        validationMode,
        hardwareIntegrationMode,
        siteIpProtectionLevel,
        robotEmbodimentPackRef,
        customerHostedConnectorRef,
        observationSchemaRef,
        actionSchemaRef,
        controlFrequency,
        robotEmbodiment,
        gripper,
        cameraSetup,
        intrinsicsExtrinsicsRef,
        sitePackageTarget: site.siteName,
        taskInstruction,
        startStateConstraints,
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
    cameraSetup,
    controlFrequency,
    customEpisodeCount,
    episodeCount,
    fieldValues,
    gripper,
    hardwareIntegrationMode,
    intrinsicsExtrinsicsRef,
    observationSchemaRef,
    policyLabels,
    robot,
    robotEmbodiment,
    scenario,
    site,
    startStateConstraints,
    successCriteria,
    siteIpProtectionLevel,
    task,
    taskInstruction,
    validationMode,
    robotEmbodimentPackRef,
    customerHostedConnectorRef,
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
        customEpisodeCount,
        validationMode,
        hardwareIntegrationMode,
        siteIpProtectionLevel,
        robotEmbodimentPackRef,
        customerHostedConnectorRef,
        observationSchemaRef,
        actionSchemaRef,
        controlFrequency,
        robotEmbodiment,
        gripper,
        cameraSetup,
        intrinsicsExtrinsicsRef,
        sitePackageTarget: site.siteName,
        taskInstruction,
        startStateConstraints,
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
        "comparative_policy_eval",
        "failure_taxonomy",
        "ood_uncertainty_flags",
        "site_ops_comparison_packet",
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
          "Virtual WAM/VLA outputs rank policies and diagnose failures; they do not prove safety validation, deployment approval, universal correlation, real-world accuracy, or real-world success.",
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
      setStatusMessage(hostedSessionErrorMessage(error));
    }
  };

  return (
    <>
      <SEO
        title="Policy Evaluation Run for Robot Teams | Blueprint"
        description="Create a capture-backed Policy Evaluation Run to compare your own checkpoints, other teams, or vendor policies on the same site/task envelope."
        canonical="/for-robot-teams"
        image={`https://tryblueprint.io${wamPolicyEvalAssets.siteTask}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Policy Evaluation Run for Robot Teams",
          description:
            "Create a capture-backed Policy Evaluation Run with a policy API, Docker container, model checkpoint, trace, or sealed customer-hosted connector.",
          url: "https://tryblueprint.io/for-robot-teams",
        }}
      />

      <main className="bg-white text-slate-950">
        <section className="border-b border-slate-200">
          <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-12 md:grid-cols-[0.78fr_1.22fr] md:items-center md:px-8 md:py-16">
            <div>
              <h1 className="max-w-[11ch] text-5xl font-semibold leading-[0.95] tracking-normal sm:text-6xl">
                Compare policies on one site task.
              </h1>
              <p className="mt-5 max-w-md text-lg leading-8 text-slate-600">
                Rank your own checkpoints, another internal team, or a vendor
                policy inside the same captured task envelope. The output guides
                field-time decisions without claiming real-world accuracy.
              </p>
              <a
                href="#robot-team-submission"
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Start
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            <img
              src={wamPolicyEvalAssets.siteTask}
              alt="Realistic humanoid robot loading a dishwasher in a captured site task"
              className="aspect-[16/9] w-full rounded-lg border border-slate-200 object-cover"
            />
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-[88rem] gap-3 px-5 py-6 sm:grid-cols-5 md:px-8">
            {steps.map(([number, label]) => (
              <div key={label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white">
                  {number}
                </span>
                <span className="text-sm font-semibold">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-5 py-10 md:grid-cols-[0.38fr_0.62fr] md:px-8">
            <div>
              <h2 className="text-3xl font-semibold leading-tight">
                Private robots without handing over either side's IP.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Customer-hosted connectors receive a sealed, least-privilege
                eval packet: task IDs, scenario run IDs, redacted scene anchors,
                schemas, thresholds, and the evidence contract. Raw captures,
                full scene assets, the full scoring harness, hidden failure labels,
                and sealed audit seeds stay withheld by default.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {privateHardwareRows.map((row) => (
                <article key={row.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  <h3 className="mt-4 text-sm font-semibold text-slate-950">{row.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{row.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-5 py-10 md:grid-cols-[0.36fr_0.64fr] md:px-8">
            <div>
              <h2 className="text-3xl font-semibold leading-tight">
                Why comparison matters.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Site ops needs a fair way to compare what gets robot time:
                your latest checkpoint, another team's runner, a vendor
                submission, or a baseline trace. Blueprint keeps the site,
                task, robot, episodes, thresholds, and missing-proof labels
                constant.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {robotPolicyComparisonUseCases.map((item) => (
                <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-4">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  <h3 className="mt-4 text-sm font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-4 px-5 py-8 md:grid-cols-[0.34fr_0.66fr] md:px-8">
            <div>
              <h2 className="text-3xl font-semibold leading-tight">
                Research signal, not a guarantee.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                The public claim is that policy-evaluation worlds are becoming
                useful ranking and diagnosis tools. It is not that Blueprint
                can promise a percentage-point real-world outcome.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {robotPolicyResearchSignals.map((signal) => (
                <a
                  key={signal.label}
                  href={signal.href}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-5 hover:bg-white"
                >
                  <h3 className="text-xl font-semibold">{signal.label}</h3>
                  <p className="mt-3 text-sm font-semibold text-blue-700">{signal.stat}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{signal.body}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section
          id="robot-team-submission"
          className="mx-auto grid max-w-[88rem] gap-8 px-5 py-10 md:grid-cols-[minmax(0,0.72fr)_minmax(20rem,0.28fr)] md:px-8"
        >
          <form
            className="rounded-lg border border-slate-200 bg-white p-5 md:p-6"
            onSubmit={createHostedSession}
          >
            <h2 className="text-3xl font-semibold">Four steps.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Add the minimum now. We will recommend subscription scope,
              quick-look scope, or a single-site comparison based on your task,
              policy cadence, and site-operator decision path.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                1 Pick a site/task
                <select
                  value={siteWorldId}
                  onChange={(event) => setSiteWorldId(event.target.value)}
                  className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal"
                >
                  {sitePackages.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                2 Add policies
                <input
                  value={policyLabels}
                  onChange={(event) => setPolicyLabels(event.target.value)}
                  className="min-h-12 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                  placeholder="Policy A, Policy B"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                3 Tell us the robot
                <input
                  value={robotEmbodiment}
                  onChange={(event) => setRobotEmbodiment(event.target.value)}
                  className="min-h-12 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                  placeholder="Figure 03 humanoid"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                4 Choose episodes
                <select
                  value={episodeCount}
                  onChange={(event) =>
                    setEpisodeCount(
                      event.target.value as RobotTeamTestSubmissionEpisodeCount,
                    )
                  }
                  className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal"
                >
                  <option value="100">100 episodes</option>
                  <option value="500">500 episodes</option>
                  <option value="custom">Custom</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold md:col-span-2">
                5 Protect hardware and site IP
                <select
                  value={hardwareIntegrationMode}
                  onChange={(event) => {
                    const nextMode = event.target
                      .value as RobotTeamTestSubmissionHardwareIntegrationMode;
                    setHardwareIntegrationMode(nextMode);
                    if (nextMode === "reference_public_robot") {
                      setSiteIpProtectionLevel("blueprint_hosted");
                    } else if (nextMode === "private_asset_hosted_by_blueprint") {
                      setSiteIpProtectionLevel("blueprint_hosted");
                    } else if (nextMode === "physical_robot_evidence_bridge") {
                      setSiteIpProtectionLevel("redacted_anchor_packet");
                    } else if (nextMode === "customer_hosted_sealed_eval_capsule") {
                      setSiteIpProtectionLevel("sealed_eval_capsule");
                    }
                  }}
                  className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal"
                >
                  {ROBOT_TEAM_HARDWARE_INTEGRATION_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-normal leading-5 text-slate-500">
                  Customer-hosted connectors receive a sealed, least-privilege packet;
                  raw captures, full scenes, scoring harnesses, and sealed audit seeds
                  stay withheld by default.
                </span>
              </label>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold">Policy access</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {accessModes.map((mode) => (
                  <label
                    key={mode.id}
                    className={`cursor-pointer rounded-lg border px-3 py-3 text-sm font-semibold ${
                      accessMode === mode.id
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-950 hover:bg-slate-50"
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
                    {shortAccessLabels[mode.id]}
                  </label>
                ))}
              </div>
            </div>

            <details className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-950">
                Advanced details
              </summary>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {episodeCount === "custom" ? (
                  <label className="grid gap-2 text-sm font-semibold">
                    Custom episode count
                    <input
                      value={customEpisodeCount}
                      onChange={(event) => setCustomEpisodeCount(event.target.value)}
                      className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                      placeholder="750"
                    />
                  </label>
                ) : null}

                <label className="grid gap-2 text-sm font-semibold">
                  Validation mode
                  <select
                    value={validationMode}
                    onChange={(event) =>
                      setValidationMode(
                        event.target.value as RobotTeamTestSubmissionValidationMode,
                      )
                    }
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal"
                  >
                    <option value="comparative_policy_eval">
                      Comparative policy eval
                    </option>
                    <option value="virtual_preflight">Virtual preflight</option>
                    <option value="real_rollout_validated">
                      Real-rollout validated
                    </option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Site IP protection
                  <select
                    value={siteIpProtectionLevel}
                    onChange={(event) =>
                      setSiteIpProtectionLevel(
                        event.target
                          .value as RobotTeamTestSubmissionSiteIpProtectionLevel,
                      )
                    }
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal"
                  >
                    <option value="blueprint_hosted">Blueprint-hosted harness</option>
                    <option value="sealed_eval_capsule">Sealed eval capsule</option>
                    <option value="redacted_anchor_packet">Redacted anchor packet</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Robot embodiment pack ref
                  <input
                    value={robotEmbodimentPackRef}
                    onChange={(event) => setRobotEmbodimentPackRef(event.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                    placeholder="s3://team/private/robot-embodiment-pack.json"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Customer-hosted connector ref
                  <input
                    value={customerHostedConnectorRef}
                    onChange={(event) =>
                      setCustomerHostedConnectorRef(event.target.value)
                    }
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                    placeholder="gs://team/blueprint/connector-contract.json"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Observation schema
                  <input
                    value={observationSchemaRef}
                    onChange={(event) => setObservationSchemaRef(event.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                    placeholder="gs://team/schemas/observation.json"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Action schema
                  <input
                    value={actionSchemaRef}
                    onChange={(event) => setActionSchemaRef(event.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                    placeholder="gs://team/schemas/action.json"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Control frequency
                  <input
                    value={controlFrequency}
                    onChange={(event) => setControlFrequency(event.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                    placeholder="20 Hz"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Gripper / EOAT
                  <input
                    value={gripper}
                    onChange={(event) => setGripper(event.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                    placeholder="two-finger gripper"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Cameras
                  <input
                    value={cameraSetup}
                    onChange={(event) => setCameraSetup(event.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                    placeholder="front RGB-D, wrist camera"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Intrinsics / extrinsics
                  <input
                    value={intrinsicsExtrinsicsRef}
                    onChange={(event) => setIntrinsicsExtrinsicsRef(event.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                    placeholder="gs://team/calibration/cameras.yaml"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Task instruction
                  <input
                    value={taskInstruction}
                    onChange={(event) => setTaskInstruction(event.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                    placeholder="pick tote from shelf"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Start-state constraints
                  <input
                    value={startStateConstraints}
                    onChange={(event) => setStartStateConstraints(event.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                    placeholder="tote starts on lower shelf"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold md:col-span-2">
                  Success criteria
                  <input
                    value={successCriteria}
                    onChange={(event) => setSuccessCriteria(event.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                    placeholder="object placed in target zone; no collision; timeout under 120s"
                  />
                </label>

                <div className="md:col-span-2">
                  <h4 className="text-sm font-semibold">
                    {selectedAccessMode.label} details
                  </h4>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    {selectedAccessMode.fields.map((field) => (
                      <label key={field.key} className="grid gap-2 text-sm font-semibold">
                        {selectedAccessMode.label} {field.label}
                        <input
                          value={fieldValues[accessMode][field.key] || ""}
                          onChange={(event) =>
                            updateAccessField(field.key, event.target.value)
                          }
                          className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                          placeholder={field.placeholder}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </details>

            {statusMessage ? (
              <div
                className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
                role="status"
              >
                {statusMessage}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "submitting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Send request
              </button>
              <a
                href={intakeHref({
                  submission: lastSubmission || submissionPreview,
                  selectedMode: accessMode,
                })}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-950 hover:bg-slate-50"
              >
                Contact instead
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </form>

          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-2xl font-semibold">Preview</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Same task. Same robot. Same episode count.
              </p>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Commercial path</dt>
                  <dd className="text-right font-semibold">
                    Subscription or quick-look
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
                      "Policy A"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Episodes</dt>
                  <dd className="text-right font-semibold">
                    {episodeCount === "custom" ? customEpisodeCount || "Custom" : episodeCount}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Hardware/IP</dt>
                  <dd className="text-right font-semibold">
                    {submissionPreview?.privateHardwareIntegration.integrationLabel ||
                      "Sealed eval capsule"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-slate-200 p-5">
              <h2 className="text-2xl font-semibold">Boundary</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {robotPolicyEvaluationBoundary} Customer-hosted runs do not
                receive raw Blueprint site scenes or the full scoring harness by
                default.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </>
  );
}
