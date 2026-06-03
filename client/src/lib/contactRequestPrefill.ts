import type {
  BuyerType,
  CommercialRequestPath,
  InboundRequestPayload,
  ProofPathPreference,
  RequestedLane,
} from "@/types/inbound-request";

export type ContactRequestPath =
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
  message: string;
  proofPathPreference: ProofPathPreference | "";
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
    value: "world-model",
    label: "Readiness report",
    description: "Scope a site/task readiness report backed by one site package.",
    cta: "Request readiness evaluation",
    buyerType: "robot_team",
    commercialRequestPath: "world_model",
  },
  {
    value: "hosted-review",
    label: "Hosted evaluation",
    description: "Review one exact-site readiness workflow in a hosted Blueprint path.",
    cta: "Request hosted evaluation",
    buyerType: "robot_team",
    commercialRequestPath: "hosted_evaluation",
  },
  {
    value: "new-capture",
    label: "New capture request",
    description: "Name an unscanned site or workflow for capture review.",
    cta: "Request this location",
    buyerType: "robot_team",
    commercialRequestPath: "capture_access",
  },
  {
    value: "site-question",
    label: "Site/operator access",
    description: "Ask about site controls, access, or participation.",
    cta: "Send request",
    buyerType: "site_operator",
    commercialRequestPath: "site_claim",
  },
];

const DEFAULT_PREFILL: ContactRequestPrefill = {
  buyerType: "robot_team",
  requestPath: "world-model",
  commercialRequestPath: "world_model",
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
  message: "",
  proofPathPreference: "",
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
  fallback: ContactRequestPath = "world-model",
): ContactRequestPath {
  const normalized = clean(value)
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");

  if (
    normalized === "world-model" ||
    normalized === "world-model-package" ||
    normalized === "package-access" ||
    normalized === "data-licensing"
  ) {
    return "world-model";
  }

  if (
    normalized === "hosted-review" ||
    normalized === "hosted-evaluation" ||
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
  return "world-model";
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
  if (value === "hosted-review") return "hosted-evaluation";
  if (value === "new-capture") return "capture-access";
  if (value === "site-question") return "site-review";
  return "world-model";
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
          : "world-model";
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
    message,
    proofPathPreference: parseProofPathPreference(
      getParam(params, ["proofPathPreference"]),
    ),
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
    return `Request hosted evaluation for ${primaryNeed}.`;
  }
  if (requestPath === "new-capture" && primaryNeed) {
    return `Request an exact-site readiness evaluation for ${primaryNeed}.`;
  }
  if (primaryNeed) return `Request a site/task readiness evaluation for ${primaryNeed}.`;
  if (siteClass) return `Request a site/task readiness evaluation for ${siteClass}.`;
  return "";
}

export function buildContactRequestUrl(input: ContactRequestUrlInput = {}): string {
  const requestPath = normalizeContactRequestPath(input.requestPath);
  const buyerType = input.buyerType || requestPathToBuyerType(requestPath);
  const params = new URLSearchParams({
    persona: buyerType === "site_operator" ? "site-operator" : "robot-team",
    buyerType,
    interest: interestForRequestPath(requestPath),
    path: requestPath,
    source: clean(input.source) || "agent-request",
  });
  const siteLocation = clean(input.siteLocation || input.location || input.address || input.city);
  const taskStatement = inferredTaskStatement(input, requestPath);
  const targetSiteType = clean(input.targetSiteType || input.siteClass);
  const query = clean(input.query || input.primaryNeed || siteLocation || input.siteName);

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
  if (input.requestedOutputs) params.set("requestedOutputs", clean(input.requestedOutputs));
  if (input.message) params.set("message", clean(input.message));
  params.set(
    "proofPathPreference",
    input.proofPathPreference || defaultProofPathPreferenceForRequestPath(requestPath),
  );

  return `/contact?${params.toString()}`;
}

export function buildAgentInboundRequestDraft(
  input: AgentInboundRequestDraftInput = {},
): AgentInboundRequestDraft {
  const requestPath = normalizeContactRequestPath(input.requestPath);
  const buyerType = input.buyerType || requestPathToBuyerType(requestPath);
  const requestedLane: RequestedLane =
    buyerType === "site_operator" ? "qualification" : "deeper_evaluation";
  const siteLocation = clean(input.siteLocation || input.location || input.address || input.city);
  const taskStatement = inferredTaskStatement(input, requestPath);
  const proofPathPreference =
    input.proofPathPreference || defaultProofPathPreferenceForRequestPath(requestPath);

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
    details: clean(input.message) || undefined,
    context: {
      sourcePageUrl: input.sourcePageUrl || buildContactRequestUrl(input),
      buyerChannelSourceRaw: clean(input.source) || "agent-request",
      utm: {},
    },
  };
}
