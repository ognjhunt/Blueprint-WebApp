import type {
  BuyerType,
  CommercialRequestPath,
  InboundRequestPayload,
  ProofPathPreference,
  RealSiteRobotEvalFitInput,
  RequestedLane,
} from "@/types/inbound-request";

export type ContactRequestPath =
  | "data-package"
  | "world-model"
  | "hosted-review"
  | "new-capture"
  | "site-question";

export type ContactRequestPrefill = {
  buyerType: BuyerType;
  requestPath: ContactRequestPath;
  commercialRequestPath: CommercialRequestPath;
  source: string;
  primaryNeed: string;
  query: string;
  siteName: string;
  siteWorldId: string;
  siteLocation: string;
  address: string;
  city: string;
  targetSiteType: string;
  workflow: string;
  taskStatement: string;
  targetRobotTeam: string;
  scenario: string;
  requestedOutputs: string;
  episodeCount: string;
  validationMode: string;
  message: string;
  proofPathPreference: ProofPathPreference | "";
  realSiteRobotEvalFit: RealSiteRobotEvalFitInput | null;
};

export type ContactRequestUrlInput = Partial<ContactRequestPrefill> & {
  location?: string;
  siteClass?: string;
};

export type AgentInboundRequestDraftInput = ContactRequestUrlInput & {
  sourcePageUrl?: string;
};

export type AgentInboundRequestDraft = Partial<InboundRequestPayload> & {
  context: Partial<InboundRequestPayload["context"]>;
};

export const CONTACT_REQUEST_PATH_OPTIONS: Array<{
  value: ContactRequestPath;
  label: string;
  description: string;
  cta: string;
  buyerType: BuyerType;
  commercialRequestPath: CommercialRequestPath;
}> = [
  {
    value: "hosted-review",
    label: "Robot Team Subscription",
    description:
      "Scope the $15k/month evaluation plan or a standalone quick-look eval.",
    cta: "Start evaluation scope",
    buyerType: "robot_team",
    commercialRequestPath: "hosted_evaluation",
  },
  {
    value: "data-package",
    label: "Policy Improvement Run",
    description: "Use failures to plan the next policy update.",
    cta: "Improve policy",
    buyerType: "robot_team",
    commercialRequestPath: "world_model",
  },
  {
    value: "new-capture",
    label: "New site capture",
    description: "Name a new place or task.",
    cta: "Request this location",
    buyerType: "robot_team",
    commercialRequestPath: "capture_access",
  },
  {
    value: "site-question",
    label: "Site Supply Review",
    description: "Start a $5,000/site supply review or scope separate yearly monitoring.",
    cta: "Start site review",
    buyerType: "site_operator",
    commercialRequestPath: "site_claim",
  },
];

const DEFAULT_PREFILL: ContactRequestPrefill = {
  buyerType: "robot_team",
  requestPath: "hosted-review",
  commercialRequestPath: "hosted_evaluation",
  source: "",
  primaryNeed: "",
  query: "",
  siteName: "",
  siteWorldId: "",
  siteLocation: "",
  address: "",
  city: "",
  targetSiteType: "",
  workflow: "",
  taskStatement: "",
  targetRobotTeam: "",
  scenario: "",
  requestedOutputs: "",
  episodeCount: "",
  validationMode: "",
  message: "",
  proofPathPreference: "",
  realSiteRobotEvalFit: null,
};

function clean(value: unknown): string {
  return String(value || "").trim();
}

function getParam(params: URLSearchParams, names: string[]): string {
  for (const name of names) {
    const value = clean(params.get(name));
    if (value) return value;
  }
  return "";
}

function paramsFrom(input: string | URLSearchParams): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  const raw = input.startsWith("?") ? input.slice(1) : input;
  return new URLSearchParams(raw);
}

export function normalizeContactRequestPath(
  value?: string | null,
  fallback: ContactRequestPath = "hosted-review",
): ContactRequestPath {
  const normalized = clean(value)
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");

  if (
    normalized === "world-model" ||
    normalized === "world-model-package" ||
    normalized === "post-training-data-package" ||
    normalized === "policy-improvement-run" ||
    normalized === "policy-lift" ||
    normalized === "data-package" ||
    normalized === "package-access" ||
    normalized === "data-licensing"
  ) {
    return "data-package";
  }

  if (
    normalized === "hosted-review" ||
    normalized === "hosted-evaluation" ||
    normalized === "policy-evaluation-run" ||
    normalized === "hosted-session" ||
    normalized === "evaluation-package"
  ) {
    return "hosted-review";
  }

  if (
    normalized === "new-capture" ||
    normalized === "request-capture" ||
    normalized === "capture-access" ||
    normalized === "custom-capture"
  ) {
    return "new-capture";
  }

  if (
    normalized === "site-question" ||
    normalized === "site-operator" ||
    normalized === "site-claim" ||
    normalized === "operator-access" ||
    normalized === "operator-question"
  ) {
    return "site-question";
  }

  return fallback;
}

export function commercialPathToContactRequestPath(
  value?: CommercialRequestPath | null,
): ContactRequestPath {
  if (value === "hosted_evaluation") return "hosted-review";
  if (value === "capture_access") return "new-capture";
  if (value === "site_claim") return "site-question";
  return "data-package";
}

export function requestPathToCommercialRequestPath(
  value: ContactRequestPath,
): CommercialRequestPath {
  return (
    CONTACT_REQUEST_PATH_OPTIONS.find((option) => option.value === value)
      ?.commercialRequestPath || "world_model"
  );
}

export function requestPathToBuyerType(value: ContactRequestPath): BuyerType {
  return (
    CONTACT_REQUEST_PATH_OPTIONS.find((option) => option.value === value)
      ?.buyerType || "robot_team"
  );
}

export function interestForRequestPath(value: ContactRequestPath): string {
  if (value === "hosted-review") return "policy-evaluation-run";
  if (value === "new-capture") return "capture-access";
  if (value === "site-question") return "site-review";
  return "policy-improvement-run";
}

export function publicPathForRequestPath(value: ContactRequestPath): string {
  if (value === "hosted-review") return "policy-evaluation-run";
  return value === "data-package" ? "policy-improvement-run" : value;
}

export function defaultProofPathPreferenceForRequestPath(
  value: ContactRequestPath,
): ProofPathPreference {
  return value === "hosted-review" || value === "new-capture"
    ? "exact_site_required"
    : "need_guidance";
}

function parseBuyerType(value: string, requestPath: ContactRequestPath): BuyerType {
  if (value === "site_operator") return "site_operator";
  if (value === "robot_team") return "robot_team";
  return requestPathToBuyerType(requestPath);
}

function parseProofPathPreference(value: string): ProofPathPreference | "" {
  return value === "exact_site_required" ||
    value === "adjacent_site_acceptable" ||
    value === "need_guidance"
    ? value
    : "";
}

function hasRobotFitText(value?: RealSiteRobotEvalFitInput | null): value is RealSiteRobotEvalFitInput {
  if (!value) return false;
  return [
    value.siteCardInput?.siteType,
    value.siteCardInput?.knownGeometryAssets,
    value.siteCardInput?.visualConditions,
    value.siteCardInput?.dynamicConditions,
    value.siteCardInput?.safetyConstraints,
    value.siteCardInput?.robotRelevantMetadata,
    value.taskCardInput?.task,
    value.taskCardInput?.startState,
    value.taskCardInput?.successDefinition,
    value.taskCardInput?.failureDefinition,
    value.taskCardInput?.requiredMetrics,
    value.scenarioCardInput?.normalScenario,
    value.scenarioCardInput?.variation,
    value.scenarioCardInput?.edgeCase,
    value.scenarioCardInput?.knownRisk,
    value.evalCardInput?.robotOrPolicyTested,
    value.evalCardInput?.preferredReviewPath,
    value.evalCardInput?.resultsValidationExpectations,
    value.evalCardInput?.predictedVsActualHistory,
  ].some((entry) => clean(entry));
}

function buildRobotFitFromParams(params: URLSearchParams): RealSiteRobotEvalFitInput | null {
  const fit: RealSiteRobotEvalFitInput = {
    siteCardInput: {
      siteType: getParam(params, ["siteType", "targetSiteType", "siteClass"]),
      knownGeometryAssets: getParam(params, ["knownGeometryAssets", "geometryAssets"]),
      visualConditions: getParam(params, ["visualConditions"]),
      dynamicConditions: getParam(params, ["dynamicConditions"]),
      safetyConstraints: getParam(params, ["safetyConstraints", "safetyThreshold"]),
      robotRelevantMetadata: getParam(params, ["robotRelevantMetadata", "objectTaskZones"]),
    },
    taskCardInput: {
      task: getParam(params, ["taskCardTask", "taskStatement", "workflow", "robotTask", "task"]),
      startState: getParam(params, ["startState"]),
      successDefinition: getParam(params, ["successDefinition"]),
      failureDefinition: getParam(params, ["failureDefinition"]),
      requiredMetrics: getParam(params, ["requiredMetrics", "metricThresholds"]),
    },
    scenarioCardInput: {
      normalScenario: getParam(params, ["normalScenario", "scenario"]),
      variation: getParam(params, ["variation", "scenarioVariation"]),
      edgeCase: getParam(params, ["edgeCase"]),
      knownRisk: getParam(params, ["knownRisk"]),
    },
    evalCardInput: {
      robotOrPolicyTested: getParam(params, [
        "robotOrPolicy",
        "robotOrPolicyTested",
        "targetRobotTeam",
        "robot",
        "robotTeam",
      ]),
      preferredReviewPath: getParam(params, ["preferredReviewPath", "reviewPath"]),
      resultsValidationExpectations: getParam(params, [
        "validationExpectations",
        "resultsValidationExpectations",
        "requiredEvidence",
      ]),
      predictedVsActualHistory: getParam(params, [
        "predictedVsActualHistory",
        "pilotHistory",
        "pilotOutcomes",
      ]),
    },
  };

  return hasRobotFitText(fit) ? fit : null;
}

function mergeRobotFit(
  input: ContactRequestUrlInput,
  requestPath: ContactRequestPath,
): RealSiteRobotEvalFitInput | null {
  const base = input.realSiteRobotEvalFit || {};
  const taskStatement = inferredTaskStatement(input, requestPath);
  const fit: RealSiteRobotEvalFitInput = {
    siteCardInput: {
      ...base.siteCardInput,
      siteType: clean(base.siteCardInput?.siteType || input.targetSiteType || input.siteClass),
    },
    taskCardInput: {
      ...base.taskCardInput,
      task: clean(base.taskCardInput?.task || taskStatement),
    },
    scenarioCardInput: {
      ...base.scenarioCardInput,
    },
    evalCardInput: {
      ...base.evalCardInput,
      robotOrPolicyTested: clean(
        base.evalCardInput?.robotOrPolicyTested || input.targetRobotTeam,
      ),
    },
  };

  return hasRobotFitText(fit) ? fit : null;
}

function setFitParam(params: URLSearchParams, key: string, value: unknown) {
  const cleaned = clean(value);
  if (cleaned) params.set(key, cleaned);
}

function appendRobotFitParams(params: URLSearchParams, fit?: RealSiteRobotEvalFitInput | null) {
  if (!hasRobotFitText(fit)) return;

  setFitParam(params, "siteType", fit.siteCardInput?.siteType);
  setFitParam(params, "knownGeometryAssets", fit.siteCardInput?.knownGeometryAssets);
  setFitParam(params, "visualConditions", fit.siteCardInput?.visualConditions);
  setFitParam(params, "dynamicConditions", fit.siteCardInput?.dynamicConditions);
  setFitParam(params, "safetyConstraints", fit.siteCardInput?.safetyConstraints);
  setFitParam(params, "robotRelevantMetadata", fit.siteCardInput?.robotRelevantMetadata);
  setFitParam(params, "startState", fit.taskCardInput?.startState);
  setFitParam(params, "successDefinition", fit.taskCardInput?.successDefinition);
  setFitParam(params, "failureDefinition", fit.taskCardInput?.failureDefinition);
  setFitParam(params, "requiredMetrics", fit.taskCardInput?.requiredMetrics);
  setFitParam(params, "normalScenario", fit.scenarioCardInput?.normalScenario);
  setFitParam(params, "variation", fit.scenarioCardInput?.variation);
  setFitParam(params, "edgeCase", fit.scenarioCardInput?.edgeCase);
  setFitParam(params, "knownRisk", fit.scenarioCardInput?.knownRisk);
  setFitParam(params, "robotOrPolicy", fit.evalCardInput?.robotOrPolicyTested);
  setFitParam(params, "preferredReviewPath", fit.evalCardInput?.preferredReviewPath);
  setFitParam(params, "validationExpectations", fit.evalCardInput?.resultsValidationExpectations);
  setFitParam(params, "predictedVsActualHistory", fit.evalCardInput?.predictedVsActualHistory);
}

export function parseContactRequestPrefill(
  input: string | URLSearchParams,
  routePath = "/contact",
): ContactRequestPrefill {
  const params = paramsFrom(input);
  const persona = getParam(params, ["persona"]);
  const buyerTypeParam = getParam(params, ["buyerType"]);
  const pathParam = getParam(params, ["requestPath", "path"]);
  const commercialPathParam = getParam(params, ["commercialRequestPath"]);
  const interestParam = getParam(params, ["interest"]);
  const requestPath = routePath === "/contact/site-operator" ||
    persona === "site-operator" ||
    buyerTypeParam === "site_operator"
      ? "site-question"
      : pathParam
        ? normalizeContactRequestPath(pathParam)
        : commercialPathParam
          ? commercialPathToContactRequestPath(commercialPathParam as CommercialRequestPath)
          : interestParam
            ? normalizeContactRequestPath(interestParam)
          : "hosted-review";
  const buyerType = parseBuyerType(buyerTypeParam, requestPath);
  const address = getParam(params, ["address", "siteLocation"]);
  const city = getParam(params, ["city"]);
  const siteLocation = getParam(params, ["siteLocation", "location", "address", "city"]);
  const workflow = getParam(params, ["workflow", "robotTask", "task", "category"]);
  const taskStatement = getParam(params, ["taskStatement", "workflow", "robotTask", "task"]);
  const targetSiteType = getParam(params, [
    "targetSiteType",
    "siteType",
    "siteClass",
    "category",
  ]);
  const message = getParam(params, ["message", "details", "note"]);
  const realSiteRobotEvalFit = buildRobotFitFromParams(params);
  const query = getParam(params, ["query", "q", "need", "location", "address"]);
  const siteName = getParam(params, ["siteName", "site", "place"]);
  const primaryNeed = [
    query,
    siteName,
    siteLocation,
    targetSiteType,
    workflow,
    taskStatement,
    message,
  ].find(Boolean) || "";

  return {
    ...DEFAULT_PREFILL,
    buyerType,
    requestPath,
    commercialRequestPath: requestPathToCommercialRequestPath(requestPath),
    source: getParam(params, ["source"]),
    primaryNeed,
    query,
    siteName,
    siteWorldId: getParam(params, ["siteWorldId"]),
    siteLocation,
    address,
    city,
    targetSiteType,
    workflow,
    taskStatement,
    targetRobotTeam: getParam(params, ["targetRobotTeam", "robot", "robotTeam"]),
    scenario: getParam(params, ["scenario"]),
    requestedOutputs: getParam(params, ["requestedOutputs", "outputs"]),
    episodeCount: getParam(params, ["episodeCount", "episodes"]),
    validationMode: getParam(params, ["validationMode", "validation"]),
    message,
    proofPathPreference: parseProofPathPreference(
      getParam(params, ["proofPathPreference"]),
    ),
    realSiteRobotEvalFit,
  };
}

function inferredTaskStatement(input: ContactRequestUrlInput, requestPath: ContactRequestPath) {
  const explicit = clean(input.taskStatement);
  if (explicit) return explicit;

  const workflow = clean(input.workflow);
  const primaryNeed = clean(input.primaryNeed || input.query);
  const siteClass = clean(input.targetSiteType || input.siteClass);

  if (workflow && primaryNeed) {
    return `${workflow} for ${primaryNeed}`;
  }
  if (workflow) return workflow;
  if (requestPath === "hosted-review" && primaryNeed) {
    return `Request a Policy Evaluation Run for ${primaryNeed}.`;
  }
  if (requestPath === "new-capture" && primaryNeed) {
    return `Request an exact-site capture path for an eval-card dataset around ${primaryNeed}.`;
  }
  if ((requestPath === "data-package" || requestPath === "world-model") && primaryNeed) {
    return `Request a Policy Improvement Run for ${primaryNeed}.`;
  }
  if (primaryNeed) return `Request a Policy Evaluation Run for ${primaryNeed}.`;
  if (siteClass) return `Request a Policy Evaluation Run for ${siteClass}.`;
  return "";
}

export function buildContactRequestUrl(input: ContactRequestUrlInput = {}): string {
  const requestPath = normalizeContactRequestPath(input.requestPath);
  const buyerType = input.buyerType || requestPathToBuyerType(requestPath);
  const params = new URLSearchParams({
    persona: buyerType === "site_operator" ? "site-operator" : "robot-team",
    buyerType,
    interest: interestForRequestPath(requestPath),
    path: publicPathForRequestPath(requestPath),
    source: clean(input.source) || "agent-request",
  });
  const siteLocation = clean(input.siteLocation || input.location || input.address || input.city);
  const taskStatement = inferredTaskStatement(input, requestPath);
  const targetSiteType = clean(input.targetSiteType || input.siteClass);
  const query = clean(input.query || input.primaryNeed || siteLocation || input.siteName);
  const realSiteRobotEvalFit = mergeRobotFit(input, requestPath);

  if (query) params.set("query", query);
  if (input.siteWorldId) params.set("siteWorldId", clean(input.siteWorldId));
  if (input.siteName) params.set("siteName", clean(input.siteName));
  if (siteLocation) {
    params.set("location", siteLocation);
    params.set("siteLocation", siteLocation);
  }
  if (input.address) params.set("address", clean(input.address));
  if (input.city) params.set("city", clean(input.city));
  if (targetSiteType) params.set("targetSiteType", targetSiteType);
  if (input.workflow) params.set("workflow", clean(input.workflow));
  if (taskStatement) params.set("taskStatement", taskStatement);
  if (input.targetRobotTeam) params.set("targetRobotTeam", clean(input.targetRobotTeam));
  if (input.scenario) params.set("scenario", clean(input.scenario));
  const requestedOutputs = clean(input.requestedOutputs) ||
    (requestPath === "hosted-review" ? "Policy Evaluation Run" : "");
  if (requestedOutputs) params.set("requestedOutputs", requestedOutputs);
  if (input.episodeCount) params.set("episodeCount", clean(input.episodeCount));
  if (input.validationMode) params.set("validationMode", clean(input.validationMode));
  if (input.message) params.set("message", clean(input.message));
  appendRobotFitParams(params, realSiteRobotEvalFit);
  params.set(
    "proofPathPreference",
    input.proofPathPreference || defaultProofPathPreferenceForRequestPath(requestPath),
  );

  const route = buyerType === "site_operator" ? "/contact/site-operator" : "/contact/robot-team";
  return `${route}?${params.toString()}`;
}

export function buildAgentInboundRequestDraft(
  input: AgentInboundRequestDraftInput = {},
): AgentInboundRequestDraft {
  const requestPath = normalizeContactRequestPath(input.requestPath);
  const buyerType = input.buyerType || requestPathToBuyerType(requestPath);
  const requestedLane: RequestedLane =
    buyerType === "site_operator"
      ? "qualification"
      : requestPath === "data-package"
        ? "data_licensing"
        : "deeper_evaluation";
  const siteLocation = clean(input.siteLocation || input.location || input.address || input.city);
  const taskStatement = inferredTaskStatement(input, requestPath);
  const proofPathPreference =
    input.proofPathPreference || defaultProofPathPreferenceForRequestPath(requestPath);
  const realSiteRobotEvalFit = mergeRobotFit(input, requestPath);

  return {
    buyerType,
    commercialRequestPath: requestPathToCommercialRequestPath(requestPath),
    requestedLanes: [requestedLane],
    siteName: clean(input.siteName),
    siteLocation,
    taskStatement,
    targetSiteType: clean(input.targetSiteType || input.siteClass) || undefined,
    proofPathPreference,
    targetRobotTeam: clean(input.targetRobotTeam) || undefined,
    workflowContext: clean(input.workflow) || undefined,
    realSiteRobotEvalFit,
    details: clean(input.message) || undefined,
    context: {
      sourcePageUrl: input.sourcePageUrl || buildContactRequestUrl(input),
      buyerChannelSourceRaw: clean(input.source) || "agent-request",
      utm: {},
    },
  };
}
