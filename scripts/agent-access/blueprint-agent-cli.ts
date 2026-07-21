#!/usr/bin/env tsx
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  BlueprintAgentApiClient,
  BlueprintAgentApiError,
  normalizeBlueprintApiBaseUrl,
  type AgentClientEnv,
  type AgentCommerceInput,
  type AgentDryRunCheckoutInput,
  type AgentLiveCheckoutInput,
  type BatchSessionInput,
  type CreateSessionInput,
  type ExplorerRenderInput,
  type FetchLike,
  type ResetSessionInput,
  type SearchSiteWorldsInput,
  type StepSessionInput,
} from "./agent-api-client";
import {
  buildAgentRequestLocationDraft,
  type AgentRequestLocationDraftInput,
} from "./request-location-draft";
import {
  planAgentJourney,
  type AgentJourneyPlanInput,
} from "./agent-journey-planner";

type AgentCliCommand =
  | "help"
  | "doctor"
  | "setup-auth"
  | "plan"
  | "discover"
  | "ask"
  | "catalog:list"
  | "catalog:search"
  | "site-world:search"
  | "request:location"
  | "commerce:quote"
  | "commerce:checkout"
  | "commerce:checkout-live"
  | "commerce:live-order:get"
  | "commerce:order:get"
  | "commerce:entitlement:get"
  | "commerce:entitlement-readiness"
  | "world:get"
  | "readiness"
  | "session:create"
  | "session:get"
  | "session:reset"
  | "session:step"
  | "session:batch"
  | "session:control"
  | "explorer-render"
  | "export";

type AgentCliFormat = "json" | "ndjson" | "text";

export type ParsedAgentCliArgs = {
  command: AgentCliCommand;
  sessionId?: string;
  siteWorldId?: string;
  options: Record<string, unknown>;
  format: AgentCliFormat;
};

export type RunAgentCliOptions = {
  env?: AgentClientEnv;
  fetchImpl?: FetchLike;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
};

export const AGENT_CLI_EXIT_CODES = {
  ok: 0,
  unexpected: 1,
  usage: 2,
  setup: 3,
  api: 4,
} as const;

class AgentCliUsageError extends Error {
  readonly exitCode = AGENT_CLI_EXIT_CODES.usage;
  readonly code = "usage_error";

  constructor(message: string) {
    super(message);
    this.name = "AgentCliUsageError";
  }
}

function toCamelCase(value: string) {
  return value.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function parseScalar(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function isAgentCliFormat(value: unknown): value is AgentCliFormat {
  return value === "json" || value === "ndjson" || value === "text";
}

function normalizeFormat(value: unknown): AgentCliFormat {
  if (value === undefined || value === null || value === "") return "json";
  if (isAgentCliFormat(value)) return value;
  throw new AgentCliUsageError(`Unsupported --format ${String(value)}. Use json, ndjson, or text.`);
}

function compactArgs(args: Array<string | undefined>) {
  return args.filter((arg): arg is string => Boolean(arg));
}

function extractGlobalCliOptions(argv: string[]) {
  const args: string[] = [];
  let format: AgentCliFormat = "json";
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--format") {
      if (argv[index + 1] === undefined) {
        throw new AgentCliUsageError("Missing --format value. Use json, ndjson, or text.");
      }
      format = normalizeFormat(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith("--format=")) {
      format = normalizeFormat(arg.slice("--format=".length));
      continue;
    }
    args.push(arg);
  }

  return { args, format, help };
}

function parseFlags(args: string[]) {
  const options: Record<string, unknown> = {};
  const positionals: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s).filter((part) => part !== undefined);
    const key = toCamelCase(rawKey);
    const next = args[index + 1];
    if (inlineValue !== undefined) {
      options[key] = parseScalar(inlineValue);
    } else if (next && !next.startsWith("--")) {
      options[key] = parseScalar(next);
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return { options, positionals };
}

function parseJsonOption(value: unknown, fallback: unknown) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new AgentCliUsageError(`Invalid JSON option: ${value}`);
  }
}

function requireString(options: Record<string, unknown>, key: string) {
  const value = String(options[key] || "").trim();
  if (!value) {
    throw new AgentCliUsageError(`Missing required --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  return value;
}

export function parseAgentCliArgs(argv: string[]): ParsedAgentCliArgs {
  const global = extractGlobalCliOptions(argv);
  const helpTopic = global.args.filter((arg) => !arg.startsWith("--")).join(" ").trim();
  if (global.help) {
    return { command: "help", options: { topic: helpTopic }, format: global.format };
  }

  const [primary = "discover", secondaryOrId, ...rest] = global.args;
  if (primary === "help") {
    return {
      command: "help",
      options: { topic: compactArgs([secondaryOrId, ...rest]).join(" ").trim() },
      format: global.format,
    };
  }

  if (primary === "doctor") {
    const hasCheck = Boolean(secondaryOrId && !secondaryOrId.startsWith("--"));
    const check = hasCheck ? String(secondaryOrId) : "setup";
    const checkArgs = hasCheck ? rest : compactArgs([secondaryOrId, ...rest]);
    if (check !== "setup" && check !== "setup-auth" && check !== "auth") {
      throw new AgentCliUsageError(`Unknown Blueprint agent doctor check: ${check}`);
    }
    const { options } = parseFlags(checkArgs);
    return {
      command: "doctor",
      options: { ...options, check: check === "auth" ? "setup-auth" : check },
      format: global.format,
    };
  }

  if (primary === "setup-auth") {
    const { options } = parseFlags(compactArgs([secondaryOrId, ...rest]));
    return { command: "setup-auth", options: { ...options, check: "setup-auth" }, format: global.format };
  }

  if (primary === "plan") {
    const { options } = parseFlags(compactArgs([secondaryOrId, ...rest]));
    return {
      command: "plan",
      options: { ...options, limit: Number(options.limit || 5) },
      format: global.format,
    };
  }

  const scopedArgs =
    primary === "catalog" || primary === "world" || primary === "site-world" || primary === "siteworld" || primary === "session" || primary === "commerce"
      ? rest
      : secondaryOrId
        ? [secondaryOrId, ...rest]
        : rest;
  const { options, positionals } = parseFlags(scopedArgs);
  const format = global.format;

  if (primary === "catalog" && secondaryOrId === "list") {
    return { command: "catalog:list", options: { limit: Number(options.limit || 24) }, format };
  }
  if (primary === "catalog" && secondaryOrId === "search") {
    return { command: "catalog:search", options: { ...options, limit: Number(options.limit || 10) }, format };
  }
  if ((primary === "site-world" || primary === "siteworld") && secondaryOrId === "search") {
    return { command: "site-world:search", options: { ...options, limit: Number(options.limit || 10) }, format };
  }
  if (
    (primary === "request" && (secondaryOrId === "location" || secondaryOrId === "location-draft")) ||
    primary === "request-location" ||
    primary === "location-draft"
  ) {
    const requestArgs = primary === "request" ? rest : compactArgs([secondaryOrId, ...rest]);
    const parsedRequest = parseFlags(requestArgs);
    return { command: "request:location", options: parsedRequest.options, format };
  }
  if (primary === "world" && secondaryOrId === "get") {
    return {
      command: "world:get",
      siteWorldId: String(positionals[0] || options.siteWorldId || "").trim(),
      options,
      format,
    };
  }
  if (primary === "session") {
    if (secondaryOrId === "create") return { command: "session:create", options, format };
    if (secondaryOrId === "get") return { command: "session:get", sessionId: String(positionals[0] || options.sessionId || "").trim(), options, format };
    if (secondaryOrId === "reset") return { command: "session:reset", sessionId: String(positionals[0] || options.sessionId || "").trim(), options, format };
    if (secondaryOrId === "step") return { command: "session:step", sessionId: String(positionals[0] || options.sessionId || "").trim(), options, format };
    if (secondaryOrId === "batch" || secondaryOrId === "run-batch") {
      return {
        command: "session:batch",
        sessionId: String(positionals[0] || options.sessionId || "").trim(),
        options: { ...options, numEpisodes: Number(options.numEpisodes || 1) },
        format,
      };
    }
    if (secondaryOrId === "control") return { command: "session:control", sessionId: String(positionals[0] || options.sessionId || "").trim(), options, format };
  }
  if (primary === "ask") {
    return { command: "ask", options: { ...options, q: options.q ?? positionals.join(" ") }, format };
  }
  if (primary === "commerce") {
    if (secondaryOrId === "quote") return { command: "commerce:quote", options, format };
    if (secondaryOrId === "checkout" || secondaryOrId === "dry-run-checkout") {
      const mode = String(options.mode || "dry_run");
      if (secondaryOrId === "checkout" && mode === "live") {
        return { command: "commerce:checkout-live", options: { ...options, mode: "live" }, format };
      }
      if (mode !== "dry_run") {
        throw new AgentCliUsageError(`Unsupported commerce checkout --mode ${mode}. Use dry_run or live.`);
      }
      return { command: "commerce:checkout", options: { ...options, mode: "dry_run" }, format };
    }
    if (secondaryOrId === "live-checkout" || secondaryOrId === "checkout-live") {
      return { command: "commerce:checkout-live", options: { ...options, mode: "live" }, format };
    }
    if (secondaryOrId === "live-order" || secondaryOrId === "live-order:get") {
      return { command: "commerce:live-order:get", options, sessionId: String(positionals[0] || options.orderId || "").trim(), format };
    }
    if (secondaryOrId === "order" || secondaryOrId === "order:get") {
      return { command: "commerce:order:get", options, sessionId: String(positionals[0] || options.orderId || "").trim(), format };
    }
    if (secondaryOrId === "entitlement" || secondaryOrId === "entitlement:get") {
      return { command: "commerce:entitlement:get", options, sessionId: String(positionals[0] || options.entitlementId || "").trim(), format };
    }
    if (secondaryOrId === "entitlement-readiness" || secondaryOrId === "entitlement:readiness") {
      return { command: "commerce:entitlement-readiness", options, format };
    }
  }
  if (primary === "readiness") {
    return { command: "readiness", siteWorldId: String(options.siteWorldId || positionals[0] || "").trim(), options, format };
  }
  if (primary === "explorer-render") {
    return { command: "explorer-render", sessionId: String(positionals[0] || options.sessionId || "").trim(), options, format };
  }
  if (primary === "export") {
    return { command: "export", sessionId: String(positionals[0] || options.sessionId || "").trim(), options, format };
  }
  if (primary === "discover") {
    return { command: "discover", options, format };
  }
  throw new AgentCliUsageError(`Unknown Blueprint agent command: ${argv.join(" ")}`);
}

function createSessionInput(options: Record<string, unknown>): CreateSessionInput {
  return {
    siteWorldId: requireString(options, "siteWorldId"),
    entitlementId: typeof options.entitlementId === "string" ? options.entitlementId : undefined,
    orderId: typeof options.orderId === "string" ? options.orderId : undefined,
    commerceMode: options.commerceMode === "dry_run" ? "dry_run" : undefined,
    robotProfileId: requireString(options, "robotProfileId"),
    taskId: requireString(options, "taskId"),
    scenarioId: requireString(options, "scenarioId"),
    startStateId: requireString(options, "startStateId"),
    sessionMode: options.sessionMode === "presentation_demo" ? "presentation_demo" : "runtime_only",
    runtimeUi: options.runtimeUi === "neoverse_gradio" ? "neoverse_gradio" : undefined,
    requestedBackend: typeof options.requestedBackend === "string" ? options.requestedBackend : undefined,
    requestedOutputs: typeof options.requestedOutputs === "string"
      ? options.requestedOutputs.split(",").map((item) => item.trim()).filter(Boolean)
      : undefined,
    exportModes: typeof options.exportModes === "string"
      ? options.exportModes.split(",").map((item) => item.trim()).filter(Boolean)
      : undefined,
    runtimeSessionConfig: parseJsonOption(options.runtimeSessionConfig, undefined) as Record<string, unknown> | undefined,
    policy: parseJsonOption(options.policy, undefined) as Record<string, unknown> | undefined,
    notes: typeof options.notes === "string" ? options.notes : undefined,
  };
}

function resetInput(options: Record<string, unknown>): ResetSessionInput {
  return {
    taskId: typeof options.taskId === "string" ? options.taskId : undefined,
    scenarioId: typeof options.scenarioId === "string" ? options.scenarioId : undefined,
    startStateId: typeof options.startStateId === "string" ? options.startStateId : undefined,
    seed: typeof options.seed === "number" ? options.seed : undefined,
  };
}

function stepInput(options: Record<string, unknown>): StepSessionInput {
  return {
    episodeId: typeof options.episodeId === "string" ? options.episodeId : undefined,
    action: parseJsonOption(options.action, undefined) as unknown[] | undefined,
    autoPolicy: typeof options.autoPolicy === "boolean" ? options.autoPolicy : undefined,
  };
}

function batchInput(options: Record<string, unknown>): BatchSessionInput {
  return {
    numEpisodes: typeof options.numEpisodes === "number" ? options.numEpisodes : undefined,
    taskId: typeof options.taskId === "string" ? options.taskId : undefined,
    scenarioId: typeof options.scenarioId === "string" ? options.scenarioId : undefined,
    startStateId: typeof options.startStateId === "string" ? options.startStateId : undefined,
    seed: typeof options.seed === "number" ? options.seed : undefined,
    maxSteps: typeof options.maxSteps === "number" ? options.maxSteps : undefined,
  };
}

function explorerInput(options: Record<string, unknown>): ExplorerRenderInput {
  return {
    cameraId: typeof options.cameraId === "string" ? options.cameraId : undefined,
    pose: parseJsonOption(options.pose, undefined) as ExplorerRenderInput["pose"],
    viewportWidth: typeof options.viewportWidth === "number" ? options.viewportWidth : undefined,
    viewportHeight: typeof options.viewportHeight === "number" ? options.viewportHeight : undefined,
    refineMode: typeof options.refineMode === "string" ? options.refineMode : undefined,
  };
}

function siteWorldSearchInput(options: Record<string, unknown>): SearchSiteWorldsInput {
  return {
    q: typeof options.q === "string" ? options.q : undefined,
    limit: typeof options.limit === "number" ? options.limit : undefined,
    category: typeof options.category === "string" ? options.category : undefined,
    industry: typeof options.industry === "string" ? options.industry : undefined,
    city: typeof options.city === "string" ? options.city : undefined,
    state: typeof options.state === "string" ? options.state : undefined,
    siteType: typeof options.siteType === "string" ? options.siteType : undefined,
    taskLane: typeof options.taskLane === "string" ? options.taskLane : undefined,
    objectTags: typeof options.objectTags === "string"
      ? options.objectTags.split(",").map((item) => item.trim()).filter(Boolean)
      : undefined,
    robot: typeof options.robot === "string" ? options.robot : undefined,
    availability: typeof options.availability === "string" ? options.availability : undefined,
    readiness: typeof options.readiness === "string" ? options.readiness : undefined,
    sort: typeof options.sort === "string" ? options.sort : undefined,
  };
}

function normalizeCommerceProduct(value: unknown) {
  const normalized = String(value || "hosted_session_rental").trim().replace(/-/g, "_");
  return normalized || "hosted_session_rental";
}

function commerceInput(options: Record<string, unknown>): AgentCommerceInput {
  return {
    siteWorldId: requireString(options, "siteWorldId"),
    product: normalizeCommerceProduct(options.product),
    sessionHours: typeof options.sessionHours === "number" ? options.sessionHours : undefined,
  };
}

function checkoutInput(options: Record<string, unknown>): AgentDryRunCheckoutInput {
  return {
    ...commerceInput(options),
    mode: "dry_run",
    buyer: parseJsonOption(options.buyer, undefined) as AgentDryRunCheckoutInput["buyer"],
  };
}

function liveCheckoutInput(options: Record<string, unknown>): AgentLiveCheckoutInput {
  return {
    ...commerceInput(options),
    mode: "live",
    budgetCents: typeof options.budgetCents === "number" ? options.budgetCents : undefined,
    successPath: typeof options.successPath === "string" ? options.successPath : undefined,
    cancelPath: typeof options.cancelPath === "string" ? options.cancelPath : undefined,
    buyer: parseJsonOption(options.buyer, undefined) as AgentLiveCheckoutInput["buyer"],
  };
}

function entitlementReadinessInput(options: Record<string, unknown>) {
  return {
    siteWorldId: requireString(options, "siteWorldId"),
    entitlementId: requireString(options, "entitlementId"),
    buyerUserId: typeof options.buyerUserId === "string" ? options.buyerUserId : undefined,
    product: typeof options.product === "string" ? normalizeCommerceProduct(options.product) : undefined,
  };
}

function envValue(env: AgentClientEnv | undefined, key: string) {
  return env?.[key] ?? process.env[key];
}

function buildHelpPayload(topic: unknown) {
  const selectedTopic = String(topic || "").trim() || "overview";
  return {
    name: "blueprint-agent-cli",
    topic: selectedTopic,
    summary:
      "Headless Blueprint access for robot-team agents: discovery, site-world search, dry-run commerce proof, hosted-session setup, rollout, render, and export.",
    usage: "npm run agent:cli -- <command> [options] [--format json|ndjson|text]",
    globalOptions: [
      { flag: "--format json", description: "Default machine-readable JSON payload." },
      { flag: "--format ndjson", description: "One JSON event per line for harness log streams." },
      { flag: "--format text", description: "Short human terminal output." },
      { flag: "--help, -h", description: "Print this help payload without calling Blueprint APIs." },
    ],
    setupChecks: [
      { command: "doctor", description: "Local no-network setup check for base URL, credentialless public flow, auth env, output formats, and safe dry-run defaults." },
      { command: "setup-auth", description: "Focused auth setup check. Add --require-auth when a protected robot-team/admin bearer token is mandatory." },
    ],
    commands: [
      { command: "help", description: "Print machine-readable CLI usage, setup, exit-code, and truth-boundary guidance." },
      { command: "doctor", description: "Run the local setup doctor without calling Blueprint APIs." },
      { command: "setup-auth", description: "Check optional protected-flow bearer auth setup; --require-auth makes missing auth fail." },
      { command: "plan", description: "Plan the next safe robot-team action for a query: exact match, request candidate, dry-run commerce, entitlement readiness, or demo/protected session path." },
      { command: "discover", description: "Fetch public site-content and agent-access manifests." },
      { command: "ask", description: "Ask a grounded question about Blueprint and get citation-backed answers with machine next-actions." },
      { command: "catalog list", description: "List public site-world catalog entries." },
      { command: "catalog search", description: "Search public site-worlds by query and filters." },
      { command: "site-world search", description: "First-class site-world search alias for robot-team agents." },
      { command: "request location", description: "Build a local intake-only new-site-scan draft and contact URL. Does not submit or write." },
      { command: "world get <siteWorldId>", description: "Fetch one public site-world detail payload." },
      { command: "commerce quote", description: "Return a dry-run quote. Does not call Stripe." },
      { command: "commerce checkout", description: "Create dry-run order, receipt, and entitlement proof by default. Add --mode live --budget-cents <n> to create a REAL Stripe Checkout Session for pipeline-backed site worlds." },
      { command: "commerce live-order <orderId>", description: "Poll a live order's payment and entitlement-provisioning status." },
      { command: "commerce order <orderId>", description: "Read a dry-run commerce order." },
      { command: "commerce entitlement <entitlementId>", description: "Read a dry-run entitlement." },
      { command: "commerce entitlement-readiness", description: "Check dry-run entitlement linkage for hosted-session launch." },
      { command: "readiness", description: "Read launch-readiness for a site world." },
      { command: "session create|get|reset|step|batch|control", description: "Operate eligible hosted sessions through existing APIs." },
      { command: "explorer-render", description: "Render an explorer frame for an existing session." },
      { command: "export", description: "Export dataset/session artifacts through the existing session API." },
    ],
    environment: {
      BLUEPRINT_API_BASE_URL: "Optional. Defaults to http://localhost:5000.",
      BLUEPRINT_AGENT_AUTH_TOKEN: "Optional for public discovery and dry-run commerce; required for hosted-session and other protected robot-team/admin flows.",
      BLUEPRINT_FIREBASE_ID_TOKEN: "Fallback bearer token env var for protected flows.",
    },
    examples: [
      "npm run agent:cli -- help --format json",
      "npm run agent:cli -- doctor --format json",
      "npm run agent:cli -- setup-auth --require-auth --format ndjson",
      "npm run agent:cli -- plan --q \"Whole Foods near Durham\" --want hosted-review",
      "npm run agent:cli -- discover --format ndjson",
      "npm run agent:cli -- site-world search --q \"Whole Foods near Durham\" --limit 5",
      "npm run agent:cli -- ask --q \"How do I buy a hosted session with a budget?\"",
      "npm run agent:cli -- request location --location \"Whole Foods near Durham\" --site-class grocery --workflow \"shelf restocking\"",
      "npm run agent:cli -- commerce checkout --site-world-id <pipeline-site-world-id> --product hosted-session-rental --mode dry_run",
      "npm run agent:cli -- commerce checkout --site-world-id <pipeline-site-world-id> --product hosted-session-rental --mode live --budget-cents 20000",
      "npm run agent:cli -- commerce live-order <live-order-id>",
    ],
    exitCodes: AGENT_CLI_EXIT_CODES,
    truthBoundaries: [
      "Public discovery, public search, ask, and dry-run commerce never grant package access, live payment, rights clearance, provider execution, or hosted-session fulfillment proof.",
      "commerce checkout --mode live creates a real Stripe Checkout Session for pipeline-backed site worlds; payment completes at the returned URL and webhook fulfillment provisions the entitlement.",
      "Hosted-session creation requires existing Firebase robot_team/admin bearer auth plus a matching provisioned entitlement.",
      "Existing protected session operations require session ownership, admin access, or an active per-session share grant.",
    ],
  };
}

function buildDoctorPayload(parsed: ParsedAgentCliArgs, env: AgentClientEnv | undefined) {
  const baseUrlRaw = envValue(env, "BLUEPRINT_API_BASE_URL");
  const baseUrl = normalizeBlueprintApiBaseUrl(baseUrlRaw);
  const token = String(envValue(env, "BLUEPRINT_AGENT_AUTH_TOKEN") || envValue(env, "BLUEPRINT_FIREBASE_ID_TOKEN") || "").trim();
  const requireAuth = parsed.options.requireAuth === true;
  const authOnly = parsed.command === "setup-auth" || parsed.options.check === "setup-auth";
  const checks: Array<{
    id: string;
    ok: boolean;
    level: "pass" | "warning" | "fail";
    message: string;
    value?: string | boolean;
  }> = [];

  try {
    const url = new URL(baseUrl);
    checks.push({
      id: "api_base_url",
      ok: true,
      level: baseUrlRaw ? "pass" : "warning",
      message: baseUrlRaw
        ? "BLUEPRINT_API_BASE_URL is configured and parseable."
        : "BLUEPRINT_API_BASE_URL is not set; the CLI will default to the local dev server.",
      value: url.toString().replace(/\/$/, ""),
    });
  } catch {
    checks.push({
      id: "api_base_url",
      ok: false,
      level: "fail",
      message: "BLUEPRINT_API_BASE_URL must be an absolute http(s) URL.",
      value: baseUrl,
    });
  }

  checks.push({
    id: "credentialless_public_flow",
    ok: true,
    level: "pass",
    message: "Public discovery, catalog search, ask, and dry-run commerce can run without credentials.",
    value: true,
  });

  checks.push({
    id: "protected_bearer_auth",
    ok: Boolean(token) || !requireAuth,
    level: token ? "pass" : requireAuth ? "fail" : "warning",
    message: token
      ? "Protected-flow bearer auth env is present."
      : requireAuth
        ? "Protected-flow bearer auth is required but BLUEPRINT_AGENT_AUTH_TOKEN or BLUEPRINT_FIREBASE_ID_TOKEN is missing."
        : "Protected-flow bearer auth is not set; hosted-session calls will fail until a token is provided.",
    value: Boolean(token),
  });

  if (!authOnly) {
    checks.push(
      {
        id: "output_formats",
        ok: true,
        level: "pass",
        message: "The CLI supports --format json, --format ndjson, and --format text.",
        value: true,
      },
      {
        id: "safe_commerce_default",
        ok: true,
        level: "pass",
        message: "Agent commerce checkout defaults to dry_run and does not call live Stripe unless --mode live is passed explicitly.",
        value: "dry_run",
      },
    );
  }

  const ok = checks.every((check) => check.ok);
  return {
    command: parsed.command,
    check: authOnly ? "setup-auth" : "setup",
    ok,
    exitCode: ok ? AGENT_CLI_EXIT_CODES.ok : AGENT_CLI_EXIT_CODES.setup,
    checks,
    nextCommands: authOnly
      ? [
          "export BLUEPRINT_AGENT_AUTH_TOKEN=<firebase-id-token>",
          "npm run agent:cli -- setup-auth --require-auth --format json",
        ]
      : [
          "npm run agent:cli -- help --format json",
          "npm run agent:cli -- discover --format ndjson",
          "npm run agent:cli -- site-world search --q \"warehouse tote\" --limit 5",
        ],
    truthBoundary:
      "Doctor and setup-auth are local setup checks only. They do not call Stripe, providers, Firebase writes, Paperclip mutation, payment, payout, or hosted-session fulfillment paths.",
  };
}

async function execute(parsed: ParsedAgentCliArgs, client: BlueprintAgentApiClient, env?: AgentClientEnv) {
  switch (parsed.command) {
    case "help":
      return buildHelpPayload(parsed.options.topic);
    case "doctor":
    case "setup-auth":
      return buildDoctorPayload(parsed, env);
    case "plan":
      return planAgentJourney(parsed.options as AgentJourneyPlanInput, client, env);
    case "discover":
      {
        const [siteContent, agentAccess] = await Promise.all([
          client.discover(),
          client.agentAccess(),
        ]);
        return {
          ...(siteContent as Record<string, unknown>),
          agentAccess,
        };
      }
    case "catalog:list":
      return client.listCatalog(Number(parsed.options.limit || 24));
    case "catalog:search":
    case "site-world:search":
      return client.searchSiteWorlds(siteWorldSearchInput(parsed.options));
    case "request:location":
      return buildAgentRequestLocationDraft(parsed.options as AgentRequestLocationDraftInput);
    case "ask":
      return client.ask({
        q: requireString(parsed.options, "q"),
        limit: typeof parsed.options.limit === "number" ? parsed.options.limit : undefined,
      });
    case "commerce:quote":
      return client.quoteCommerce(commerceInput(parsed.options));
    case "commerce:checkout":
      return client.createDryRunCheckout(checkoutInput(parsed.options));
    case "commerce:checkout-live":
      return client.createLiveCheckout(liveCheckoutInput(parsed.options));
    case "commerce:live-order:get":
      return client.getLiveOrder(parsed.sessionId || requireString(parsed.options, "orderId"));
    case "commerce:order:get":
      return client.getCommerceOrder(parsed.sessionId || requireString(parsed.options, "orderId"));
    case "commerce:entitlement:get":
      return client.getCommerceEntitlement(parsed.sessionId || requireString(parsed.options, "entitlementId"));
    case "commerce:entitlement-readiness":
      return client.entitlementReadiness(entitlementReadinessInput(parsed.options));
    case "world:get":
      return client.getSiteWorld(parsed.siteWorldId || requireString(parsed.options, "siteWorldId"));
    case "readiness":
      return client.readiness(parsed.siteWorldId || requireString(parsed.options, "siteWorldId"));
    case "session:create":
      return client.createSession(createSessionInput(parsed.options));
    case "session:get":
      return client.getSession(parsed.sessionId || requireString(parsed.options, "sessionId"));
    case "session:reset":
      return client.resetSession(parsed.sessionId || requireString(parsed.options, "sessionId"), resetInput(parsed.options));
    case "session:step":
      return client.stepSession(parsed.sessionId || requireString(parsed.options, "sessionId"), stepInput(parsed.options));
    case "session:batch":
      return client.runBatch(parsed.sessionId || requireString(parsed.options, "sessionId"), batchInput(parsed.options));
    case "session:control":
      return client.controlSession(parsed.sessionId || requireString(parsed.options, "sessionId"), parseJsonOption(parsed.options.control, {}) as Record<string, unknown>);
    case "explorer-render":
      return client.renderExplorer(parsed.sessionId || requireString(parsed.options, "sessionId"), explorerInput(parsed.options));
    case "export":
      return client.exportSession(parsed.sessionId || requireString(parsed.options, "sessionId"), parseJsonOption(parsed.options.body, {}) as Record<string, unknown>);
    default:
      parsed.command satisfies never;
      throw new Error("Unhandled command");
  }
}

function toTextOutput(command: AgentCliCommand, payload: unknown) {
  if (command === "help" && payload && typeof payload === "object") {
    const help = payload as ReturnType<typeof buildHelpPayload>;
    return [
      `${help.name}: ${help.summary}`,
      "",
      `Usage: ${help.usage}`,
      "",
      "Setup:",
      ...help.setupChecks.map((check) => `  ${check.command} - ${check.description}`),
      "",
      "Commands:",
      ...help.commands.map((commandHelp) => `  ${commandHelp.command} - ${commandHelp.description}`),
      "",
      `Exit codes: ok=${AGENT_CLI_EXIT_CODES.ok}, usage=${AGENT_CLI_EXIT_CODES.usage}, setup=${AGENT_CLI_EXIT_CODES.setup}, api=${AGENT_CLI_EXIT_CODES.api}, unexpected=${AGENT_CLI_EXIT_CODES.unexpected}`,
    ].join("\n");
  }
  if ((command === "doctor" || command === "setup-auth") && payload && typeof payload === "object") {
    const doctor = payload as ReturnType<typeof buildDoctorPayload>;
    const lines = [
      `${command}: ${doctor.ok ? "ok" : "failed"} (exit ${doctor.exitCode})`,
      ...doctor.checks.map((check) => `  ${check.level}: ${check.id} - ${check.message}`),
    ];
    return lines.join("\n");
  }
  if (command === "plan" && payload && typeof payload === "object") {
    const plan = payload as {
      nextAction?: { kind?: unknown; siteWorldId?: unknown; command?: unknown };
      blockers?: unknown[];
    };
    const action = plan.nextAction || {};
    const blockerCount = Array.isArray(plan.blockers) ? plan.blockers.length : 0;
    return [
      `plan: ${String(action.kind || "unknown")}${action.siteWorldId ? ` for ${String(action.siteWorldId)}` : ""}`,
      `blockers: ${blockerCount}`,
      action.command ? `next: ${String(action.command)}` : "",
    ].filter(Boolean).join("\n");
  }
  if (command === "request:location" && payload && typeof payload === "object") {
    const draft = payload as ReturnType<typeof buildAgentRequestLocationDraft>;
    const missing = draft.missingRequiredFields.length
      ? draft.missingRequiredFields.join(", ")
      : "none";
    return [
      `request location: ${draft.contactUrl}`,
      `missing required fields: ${missing}`,
      draft.truthBoundaries[0],
    ].join("\n");
  }
  if (payload && typeof payload === "object" && "sessionId" in payload) {
    return `${command}: ${(payload as { sessionId: string }).sessionId}`;
  }
  if (payload && typeof payload === "object" && "count" in payload) {
    return `${command}: ${(payload as { count: number }).count} item(s)`;
  }
  return `${command}: ok`;
}

function toNdjsonOutput(command: AgentCliCommand, payload: unknown) {
  const ok = payload && typeof payload === "object" && "ok" in payload
    ? Boolean((payload as { ok: unknown }).ok)
    : true;
  return JSON.stringify({
    type: "result",
    command,
    ok,
    exitCode: payload && typeof payload === "object" && "exitCode" in payload
      ? (payload as { exitCode: unknown }).exitCode
      : AGENT_CLI_EXIT_CODES.ok,
    payload,
  });
}

function toMachineOutput(format: AgentCliFormat, command: AgentCliCommand, payload: unknown) {
  if (format === "text") return toTextOutput(command, payload);
  if (format === "ndjson") return toNdjsonOutput(command, payload);
  return JSON.stringify(payload, null, 2);
}

function buildErrorPayload(error: unknown) {
  if (error instanceof BlueprintAgentApiError) {
    return {
      ok: false,
      error: error.message,
      code: error.code || "api_error",
      status: error.status,
      exitCode: AGENT_CLI_EXIT_CODES.api,
      payload: error.payload,
    };
  }
  if (error instanceof AgentCliUsageError) {
    return {
      ok: false,
      error: error.message,
      code: error.code,
      exitCode: error.exitCode,
    };
  }
  if (error instanceof TypeError) {
    return {
      ok: false,
      error: error.message,
      code: "api_request_failed",
      exitCode: AGENT_CLI_EXIT_CODES.api,
    };
  }
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    code: "unexpected_error",
    exitCode: AGENT_CLI_EXIT_CODES.unexpected,
  };
}

function safeRequestedFormat(argv: string[]): AgentCliFormat {
  try {
    return extractGlobalCliOptions(argv).format;
  } catch {
    return "json";
  }
}

export function getAgentCliExitCode(error: unknown) {
  return Number(buildErrorPayload(error).exitCode || AGENT_CLI_EXIT_CODES.unexpected);
}

function writeCliError(error: unknown, format: AgentCliFormat, stderr: (line: string) => void) {
  const payload = buildErrorPayload(error);
  if (format === "text") {
    stderr(`${payload.code}: ${payload.error}`);
    return;
  }
  if (format === "ndjson") {
    stderr(JSON.stringify({ type: "error", ...payload }));
    return;
  }
  stderr(JSON.stringify(payload, null, 2));
}

export async function runAgentCli(argv = process.argv.slice(2), options: RunAgentCliOptions = {}) {
  const stdout = options.stdout || ((line: string) => process.stdout.write(`${line}\n`));
  const stderr = options.stderr || ((line: string) => process.stderr.write(`${line}\n`));
  let parsed: ParsedAgentCliArgs | null = null;

  try {
    parsed = parseAgentCliArgs(argv);
    const client = new BlueprintAgentApiClient({
      env: options.env,
      fetchImpl: options.fetchImpl,
    });
    const payload = await execute(parsed, client, options.env);
    stdout(toMachineOutput(parsed.format, parsed.command, payload));
    return payload;
  } catch (error) {
    writeCliError(error, parsed?.format || safeRequestedFormat(argv), stderr);
    throw error;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runAgentCli()
    .then((payload) => {
      process.exitCode = payload && typeof payload === "object" && "exitCode" in payload
        ? Number((payload as { exitCode: unknown }).exitCode || AGENT_CLI_EXIT_CODES.ok)
        : AGENT_CLI_EXIT_CODES.ok;
    })
    .catch((error) => {
      process.exitCode = getAgentCliExitCode(error);
    });
}
