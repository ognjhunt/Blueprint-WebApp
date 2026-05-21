#!/usr/bin/env tsx
import { Buffer } from "node:buffer";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  BlueprintAgentApiClient,
  BlueprintAgentApiError,
  type AgentClientEnv,
  type CreateSessionInput,
  type FetchLike,
} from "./agent-api-client";

type JsonRpcRequest = {
  jsonrpc?: "2.0";
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

export type BlueprintMcpTool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
};

export type BlueprintMcpCallOptions = {
  env?: AgentClientEnv;
  fetchImpl?: FetchLike;
};

const stringProp = (description: string) => ({ type: "string", description });
const numberProp = (description: string) => ({ type: "number", description });
const integerProp = (description: string) => ({ type: "integer", description });
const objectProp = (description: string) => ({ type: "object", description, additionalProperties: true });

export const BLUEPRINT_MCP_TOOLS: BlueprintMcpTool[] = [
  {
    name: "blueprint.catalog.search",
    description: "List public Blueprint site-world catalog entries. Uses public endpoints unless the base URL itself is private.",
    inputSchema: {
      type: "object",
      properties: {
        limit: integerProp("Maximum catalog entries to return. Defaults to 24."),
      },
      additionalProperties: false,
    },
  },
  {
    name: "blueprint.siteWorld.get",
    description: "Get one public site-world detail record by id.",
    inputSchema: {
      type: "object",
      properties: {
        siteWorldId: stringProp("Site-world id, for example siteworld-f5fd54898cfb."),
      },
      required: ["siteWorldId"],
      additionalProperties: false,
    },
  },
  {
    name: "blueprint.session.create",
    description: "Create a public-demo or protected robot-team hosted session.",
    inputSchema: {
      type: "object",
      properties: {
        siteWorldId: stringProp("Site-world id."),
        robotProfileId: stringProp("Robot profile id from the site-world runtime catalog."),
        taskId: stringProp("Task id from the task catalog."),
        scenarioId: stringProp("Scenario id from the scenario catalog."),
        startStateId: stringProp("Start state id from the start-state catalog."),
        sessionMode: { type: "string", enum: ["runtime_only", "presentation_demo"], default: "runtime_only" },
        requestedBackend: stringProp("Optional runtime backend id."),
        requestedOutputs: { type: "array", items: { type: "string" } },
        runtimeSessionConfig: objectProp("Optional runtime session config."),
        notes: stringProp("Optional operator note."),
      },
      required: ["siteWorldId", "robotProfileId", "taskId", "scenarioId", "startStateId"],
      additionalProperties: false,
    },
  },
  {
    name: "blueprint.session.reset",
    description: "Reset a hosted session to a scenario/start state/seed.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: stringProp("Hosted session id."),
        taskId: stringProp("Optional task id."),
        scenarioId: stringProp("Optional scenario id."),
        startStateId: stringProp("Optional start-state id."),
        seed: integerProp("Optional deterministic seed."),
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
  },
  {
    name: "blueprint.session.step",
    description: "Advance a hosted rollout one step.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: stringProp("Hosted session id."),
        episodeId: stringProp("Optional episode id."),
        action: { type: "array", items: { type: "number" }, description: "Optional action vector." },
        autoPolicy: { type: "boolean", description: "When true or omitted, let runtime choose the next action." },
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
  },
  {
    name: "blueprint.session.runBatch",
    description: "Run a headless hosted-session batch rollout.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: stringProp("Hosted session id."),
        numEpisodes: integerProp("Number of episodes to run."),
        taskId: stringProp("Optional task id."),
        scenarioId: stringProp("Optional scenario id."),
        startStateId: stringProp("Optional start-state id."),
        seed: integerProp("Optional deterministic seed."),
        maxSteps: integerProp("Optional max steps per episode."),
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
  },
  {
    name: "blueprint.session.renderExplorer",
    description: "Render an explorer frame for a camera and pose.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: stringProp("Hosted session id."),
        cameraId: stringProp("Camera id, defaults to head_rgb."),
        pose: {
          type: "object",
          properties: {
            x: numberProp("X position."),
            y: numberProp("Y position."),
            z: numberProp("Z position."),
            yaw: numberProp("Yaw angle."),
            pitch: numberProp("Pitch angle."),
          },
          required: ["x", "y", "z", "yaw", "pitch"],
        },
        viewportWidth: integerProp("Viewport width."),
        viewportHeight: integerProp("Viewport height."),
        refineMode: stringProp("Optional refinement mode."),
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
  },
  {
    name: "blueprint.session.export",
    description: "Export hosted-session dataset artifacts and manifest references.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: stringProp("Hosted session id."),
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
  },
];

function requireArg(args: Record<string, unknown>, key: string) {
  const value = String(args[key] || "").trim();
  if (!value) throw new Error(`Missing required MCP argument: ${key}`);
  return value;
}

export async function callBlueprintMcpTool(name: string, args: Record<string, unknown> = {}, options: BlueprintMcpCallOptions = {}) {
  const client = new BlueprintAgentApiClient({ env: options.env, fetchImpl: options.fetchImpl });
  let payload: unknown;

  switch (name) {
    case "blueprint.catalog.search":
      payload = await client.listCatalog(Number(args.limit || 24));
      break;
    case "blueprint.siteWorld.get":
      payload = await client.getSiteWorld(requireArg(args, "siteWorldId"));
      break;
    case "blueprint.session.create":
      payload = await client.createSession({
        siteWorldId: requireArg(args, "siteWorldId"),
        robotProfileId: requireArg(args, "robotProfileId"),
        taskId: requireArg(args, "taskId"),
        scenarioId: requireArg(args, "scenarioId"),
        startStateId: requireArg(args, "startStateId"),
        sessionMode: args.sessionMode === "presentation_demo" ? "presentation_demo" : "runtime_only",
        requestedBackend: typeof args.requestedBackend === "string" ? args.requestedBackend : undefined,
        requestedOutputs: Array.isArray(args.requestedOutputs) ? args.requestedOutputs.map(String) : undefined,
        runtimeSessionConfig:
          args.runtimeSessionConfig && typeof args.runtimeSessionConfig === "object"
            ? args.runtimeSessionConfig as CreateSessionInput["runtimeSessionConfig"]
            : undefined,
        notes: typeof args.notes === "string" ? args.notes : undefined,
      });
      break;
    case "blueprint.session.reset":
      payload = await client.resetSession(requireArg(args, "sessionId"), {
        taskId: typeof args.taskId === "string" ? args.taskId : undefined,
        scenarioId: typeof args.scenarioId === "string" ? args.scenarioId : undefined,
        startStateId: typeof args.startStateId === "string" ? args.startStateId : undefined,
        seed: typeof args.seed === "number" ? args.seed : undefined,
      });
      break;
    case "blueprint.session.step":
      payload = await client.stepSession(requireArg(args, "sessionId"), {
        episodeId: typeof args.episodeId === "string" ? args.episodeId : undefined,
        action: Array.isArray(args.action) ? args.action : undefined,
        autoPolicy: typeof args.autoPolicy === "boolean" ? args.autoPolicy : undefined,
      });
      break;
    case "blueprint.session.runBatch":
      payload = await client.runBatch(requireArg(args, "sessionId"), {
        numEpisodes: typeof args.numEpisodes === "number" ? args.numEpisodes : undefined,
        taskId: typeof args.taskId === "string" ? args.taskId : undefined,
        scenarioId: typeof args.scenarioId === "string" ? args.scenarioId : undefined,
        startStateId: typeof args.startStateId === "string" ? args.startStateId : undefined,
        seed: typeof args.seed === "number" ? args.seed : undefined,
        maxSteps: typeof args.maxSteps === "number" ? args.maxSteps : undefined,
      });
      break;
    case "blueprint.session.renderExplorer":
      payload = await client.renderExplorer(requireArg(args, "sessionId"), {
        cameraId: typeof args.cameraId === "string" ? args.cameraId : undefined,
        pose: args.pose && typeof args.pose === "object"
          ? args.pose as Parameters<typeof client.renderExplorer>[1]["pose"]
          : undefined,
        viewportWidth: typeof args.viewportWidth === "number" ? args.viewportWidth : undefined,
        viewportHeight: typeof args.viewportHeight === "number" ? args.viewportHeight : undefined,
        refineMode: typeof args.refineMode === "string" ? args.refineMode : undefined,
      });
      break;
    case "blueprint.session.export":
      payload = await client.exportSession(requireArg(args, "sessionId"));
      break;
    default:
      throw new Error(`Unknown Blueprint MCP tool: ${name}`);
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function jsonRpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id: JsonRpcRequest["id"], error: unknown) {
  const apiError = error instanceof BlueprintAgentApiError ? error : null;
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: apiError ? apiError.status : -32000,
      message: error instanceof Error ? error.message : String(error),
      data: apiError?.payload,
    },
  };
}

async function handleMessage(message: JsonRpcRequest) {
  if (message.method === "initialize") {
    return jsonRpcResult(message.id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "blueprint-agent-access", version: "2026-05-20" },
    });
  }
  if (message.method === "tools/list") {
    return jsonRpcResult(message.id, { tools: BLUEPRINT_MCP_TOOLS });
  }
  if (message.method === "tools/call") {
    const params = message.params || {};
    const name = String(params.name || "");
    const args =
      params.arguments && typeof params.arguments === "object"
        ? params.arguments as Record<string, unknown>
        : {};
    return jsonRpcResult(message.id, await callBlueprintMcpTool(name, args));
  }
  if (message.method?.startsWith("notifications/")) {
    return null;
  }
  return jsonRpcError(message.id, new Error(`Unsupported MCP method: ${message.method || "unknown"}`));
}

function writeMessage(message: unknown) {
  const json = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`);
}

function parseBufferedMessages(buffer: Buffer) {
  const messages: JsonRpcRequest[] = [];
  let remaining = buffer;
  while (remaining.length > 0) {
    const headerEnd = remaining.indexOf("\r\n\r\n");
    if (headerEnd < 0) break;
    const header = remaining.subarray(0, headerEnd).toString("utf8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) break;
    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (remaining.length < bodyEnd) break;
    const body = remaining.subarray(bodyStart, bodyEnd).toString("utf8");
    messages.push(JSON.parse(body) as JsonRpcRequest);
    remaining = remaining.subarray(bodyEnd);
  }
  return { messages, remaining };
}

export function startBlueprintMcpServer() {
  let buffer = Buffer.alloc(0);
  process.stdin.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    const parsed = parseBufferedMessages(buffer);
    buffer = parsed.remaining;
    parsed.messages.forEach((message) => {
      void handleMessage(message)
        .then((response) => {
          if (response) writeMessage(response);
        })
        .catch((error) => writeMessage(jsonRpcError(message.id, error)));
    });
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  startBlueprintMcpServer();
}
