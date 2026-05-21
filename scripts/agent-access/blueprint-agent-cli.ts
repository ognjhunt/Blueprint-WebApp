#!/usr/bin/env tsx
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  BlueprintAgentApiClient,
  BlueprintAgentApiError,
  type AgentClientEnv,
  type AgentCommerceInput,
  type AgentDryRunCheckoutInput,
  type BatchSessionInput,
  type CreateSessionInput,
  type ExplorerRenderInput,
  type FetchLike,
  type ResetSessionInput,
  type SearchSiteWorldsInput,
  type StepSessionInput,
} from "./agent-api-client";

type AgentCliCommand =
  | "discover"
  | "catalog:list"
  | "catalog:search"
  | "commerce:quote"
  | "commerce:checkout"
  | "commerce:order:get"
  | "commerce:entitlement:get"
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

export type ParsedAgentCliArgs = {
  command: AgentCliCommand;
  sessionId?: string;
  siteWorldId?: string;
  options: Record<string, unknown>;
  format: "json" | "text";
};

export type RunAgentCliOptions = {
  env?: AgentClientEnv;
  fetchImpl?: FetchLike;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
};

function toCamelCase(value: string) {
  return value.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function parseScalar(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
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
    throw new Error(`Invalid JSON option: ${value}`);
  }
}

function requireString(options: Record<string, unknown>, key: string) {
  const value = String(options[key] || "").trim();
  if (!value) {
    throw new Error(`Missing required --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  return value;
}

export function parseAgentCliArgs(argv: string[]): ParsedAgentCliArgs {
  const [primary = "discover", secondaryOrId, ...rest] = argv;
  const scopedArgs =
    primary === "catalog" || primary === "world" || primary === "session" || primary === "commerce"
      ? rest
      : secondaryOrId
        ? [secondaryOrId, ...rest]
        : rest;
  const { options, positionals } = parseFlags(scopedArgs);
  const format = options.format === "text" ? "text" : "json";
  delete options.format;

  if (primary === "catalog" && secondaryOrId === "list") {
    return { command: "catalog:list", options: { limit: Number(options.limit || 24) }, format };
  }
  if (primary === "catalog" && secondaryOrId === "search") {
    return { command: "catalog:search", options: { ...options, limit: Number(options.limit || 10) }, format };
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
  if (primary === "commerce") {
    if (secondaryOrId === "quote") return { command: "commerce:quote", options, format };
    if (secondaryOrId === "checkout" || secondaryOrId === "dry-run-checkout") return { command: "commerce:checkout", options: { ...options, mode: options.mode || "dry_run" }, format };
    if (secondaryOrId === "order" || secondaryOrId === "order:get") {
      return { command: "commerce:order:get", options, sessionId: String(positionals[0] || options.orderId || "").trim(), format };
    }
    if (secondaryOrId === "entitlement" || secondaryOrId === "entitlement:get") {
      return { command: "commerce:entitlement:get", options, sessionId: String(positionals[0] || options.entitlementId || "").trim(), format };
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
  throw new Error(`Unknown Blueprint agent command: ${argv.join(" ")}`);
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

async function execute(parsed: ParsedAgentCliArgs, client: BlueprintAgentApiClient) {
  switch (parsed.command) {
    case "discover":
      return {
        ...(await client.discover() as Record<string, unknown>),
        agentAccess: {
          docs: "/agents",
          openapi: "/agent-access.openapi.json",
          api: "/api/agent-access/openapi.json",
          cli: "scripts/agent-access/blueprint-agent-cli.ts",
          mcp: "scripts/agent-access/blueprint-mcp-server.ts",
        },
      };
    case "catalog:list":
      return client.listCatalog(Number(parsed.options.limit || 24));
    case "catalog:search":
      return client.searchSiteWorlds(siteWorldSearchInput(parsed.options));
    case "commerce:quote":
      return client.quoteCommerce(commerceInput(parsed.options));
    case "commerce:checkout":
      return client.createDryRunCheckout(checkoutInput(parsed.options));
    case "commerce:order:get":
      return client.getCommerceOrder(parsed.sessionId || requireString(parsed.options, "orderId"));
    case "commerce:entitlement:get":
      return client.getCommerceEntitlement(parsed.sessionId || requireString(parsed.options, "entitlementId"));
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
  if (payload && typeof payload === "object" && "sessionId" in payload) {
    return `${command}: ${(payload as { sessionId: string }).sessionId}`;
  }
  if (payload && typeof payload === "object" && "count" in payload) {
    return `${command}: ${(payload as { count: number }).count} item(s)`;
  }
  return `${command}: ok`;
}

export async function runAgentCli(argv = process.argv.slice(2), options: RunAgentCliOptions = {}) {
  const parsed = parseAgentCliArgs(argv);
  const stdout = options.stdout || ((line: string) => process.stdout.write(`${line}\n`));
  const stderr = options.stderr || ((line: string) => process.stderr.write(`${line}\n`));
  const client = new BlueprintAgentApiClient({
    env: options.env,
    fetchImpl: options.fetchImpl,
  });

  try {
    const payload = await execute(parsed, client);
    stdout(parsed.format === "text" ? toTextOutput(parsed.command, payload) : JSON.stringify(payload, null, 2));
    return payload;
  } catch (error) {
    if (error instanceof BlueprintAgentApiError) {
      const payload = {
        error: error.message,
        code: error.code,
        status: error.status,
        payload: error.payload,
      };
      stderr(JSON.stringify(payload, null, 2));
      throw error;
    }
    stderr(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runAgentCli().catch(() => {
    process.exitCode = 1;
  });
}
