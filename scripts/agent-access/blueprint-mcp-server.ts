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
  type SearchSiteWorldsInput,
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
    description: "Search public Blueprint site-world catalog entries by natural language query, alias, location, robot, task, object, category, readiness, or availability. With only limit, falls back to the legacy catalog list endpoint.",
    inputSchema: {
      type: "object",
      properties: {
        q: stringProp("Natural-language search query, for example whole foods, store, or warehouse tote."),
        limit: integerProp("Maximum catalog entries to return. Defaults to 10 for search or 24 for legacy list."),
        category: stringProp("Optional exact public category filter, for example Retail or Logistics."),
        industry: stringProp("Optional industry text filter."),
        city: stringProp("Optional exact city filter."),
        state: stringProp("Optional two-letter state filter."),
        siteType: stringProp("Optional site type or archetype filter."),
        taskLane: stringProp("Optional task/workflow lane text filter."),
        objectTags: { type: "array", items: { type: "string" }, description: "Optional required object tags such as tote, shelf, pallet, or barcode." },
        robot: stringProp("Optional robot profile or embodiment filter."),
        availability: stringProp("Optional availability/status filter."),
        readiness: stringProp("Optional readiness/status filter."),
        sort: { type: "string", enum: ["relevance", "name", "city", "category", "readiness", "availability"], description: "Sort mode. Defaults to relevance." },
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
    name: "blueprint.siteWorld.launchReadiness",
    description: "Inspect launch readiness for a public-demo or protected robot-team site world.",
    inputSchema: {
      type: "object",
      properties: {
        siteWorldId: stringProp("Site-world id."),
      },
      required: ["siteWorldId"],
      additionalProperties: false,
    },
  },
  {
    name: "blueprint.commerce.quote",
    description: "Create a dry-run quote for a site-world package or hosted-session rental without calling live Stripe.",
    inputSchema: {
      type: "object",
      properties: {
        siteWorldId: stringProp("Site-world id."),
        product: { type: "string", enum: ["site_world_package", "hosted_session_rental"], default: "hosted_session_rental" },
        sessionHours: integerProp("Hosted-session hours for rental quotes."),
      },
      required: ["siteWorldId"],
      additionalProperties: false,
    },
  },
  {
    name: "blueprint.commerce.checkoutDryRun",
    description: "Create a dry-run order and entitlement for agent commerce verification. Does not call live Stripe.",
    inputSchema: {
      type: "object",
      properties: {
        siteWorldId: stringProp("Site-world id."),
        product: { type: "string", enum: ["site_world_package", "hosted_session_rental"], default: "hosted_session_rental" },
        sessionHours: integerProp("Hosted-session hours for rental checkout."),
        buyer: objectProp("Optional dry-run buyer identity with uid/email."),
      },
      required: ["siteWorldId"],
      additionalProperties: false,
    },
  },
  {
    name: "blueprint.commerce.order.get",
    description: "Read one dry-run agent commerce order by id.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: stringProp("Dry-run order id."),
      },
      required: ["orderId"],
      additionalProperties: false,
    },
  },
  {
    name: "blueprint.commerce.entitlement.get",
    description: "Read one dry-run agent commerce entitlement by id.",
    inputSchema: {
      type: "object",
      properties: {
        entitlementId: stringProp("Dry-run entitlement id."),
      },
      required: ["entitlementId"],
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
        entitlementId: stringProp("Optional provisioned entitlement id for protected hosted-session launch."),
        orderId: stringProp("Optional dry-run order id associated with the entitlement."),
        commerceMode: { type: "string", enum: ["dry_run"], description: "Optional dry-run commerce mode marker." },
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
    name: "blueprint.session.control",
    description: "Send a runtime control intent for camera, policy, or playback state.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: stringProp("Hosted session id."),
        control: objectProp("Control payload."),
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

function hasSearchArgs(args: Record<string, unknown>) {
  return [
    "q",
    "category",
    "industry",
    "city",
    "state",
    "siteType",
    "taskLane",
    "objectTags",
    "robot",
    "availability",
    "readiness",
    "sort",
  ].some((key) => args[key] !== undefined && args[key] !== null && String(args[key]).trim() !== "");
}

function searchArgs(args: Record<string, unknown>): SearchSiteWorldsInput {
  return {
    q: typeof args.q === "string" ? args.q : undefined,
    limit: typeof args.limit === "number" ? args.limit : Number(args.limit || 10),
    category: typeof args.category === "string" ? args.category : undefined,
    industry: typeof args.industry === "string" ? args.industry : undefined,
    city: typeof args.city === "string" ? args.city : undefined,
    state: typeof args.state === "string" ? args.state : undefined,
    siteType: typeof args.siteType === "string" ? args.siteType : undefined,
    taskLane: typeof args.taskLane === "string" ? args.taskLane : undefined,
    objectTags: Array.isArray(args.objectTags)
      ? args.objectTags.map(String)
      : typeof args.objectTags === "string"
        ? args.objectTags.split(",").map((item) => item.trim()).filter(Boolean)
        : undefined,
    robot: typeof args.robot === "string" ? args.robot : undefined,
    availability: typeof args.availability === "string" ? args.availability : undefined,
    readiness: typeof args.readiness === "string" ? args.readiness : undefined,
    sort: typeof args.sort === "string" ? args.sort : undefined,
  };
}

export async function callBlueprintMcpTool(name: string, args: Record<string, unknown> = {}, options: BlueprintMcpCallOptions = {}) {
  const client = new BlueprintAgentApiClient({ env: options.env, fetchImpl: options.fetchImpl });
  let payload: unknown;

  switch (name) {
    case "blueprint.catalog.search":
      payload = hasSearchArgs(args)
        ? await client.searchSiteWorlds(searchArgs(args))
        : await client.listCatalog(Number(args.limit || 24));
      break;
    case "blueprint.siteWorld.get":
      payload = await client.getSiteWorld(requireArg(args, "siteWorldId"));
      break;
    case "blueprint.siteWorld.launchReadiness":
      payload = await client.readiness(requireArg(args, "siteWorldId"));
      break;
    case "blueprint.commerce.quote":
      payload = await client.quoteCommerce({
        siteWorldId: requireArg(args, "siteWorldId"),
        product: typeof args.product === "string" ? args.product : "hosted_session_rental",
        sessionHours: typeof args.sessionHours === "number" ? args.sessionHours : undefined,
      });
      break;
    case "blueprint.commerce.checkoutDryRun":
      payload = await client.createDryRunCheckout({
        siteWorldId: requireArg(args, "siteWorldId"),
        product: typeof args.product === "string" ? args.product : "hosted_session_rental",
        sessionHours: typeof args.sessionHours === "number" ? args.sessionHours : undefined,
        mode: "dry_run",
        buyer: args.buyer && typeof args.buyer === "object"
          ? args.buyer as Parameters<typeof client.createDryRunCheckout>[0]["buyer"]
          : undefined,
      });
      break;
    case "blueprint.commerce.order.get":
      payload = await client.getCommerceOrder(requireArg(args, "orderId"));
      break;
    case "blueprint.commerce.entitlement.get":
      payload = await client.getCommerceEntitlement(requireArg(args, "entitlementId"));
      break;
    case "blueprint.session.create":
      payload = await client.createSession({
        siteWorldId: requireArg(args, "siteWorldId"),
        entitlementId: typeof args.entitlementId === "string" ? args.entitlementId : undefined,
        orderId: typeof args.orderId === "string" ? args.orderId : undefined,
        commerceMode: args.commerceMode === "dry_run" ? "dry_run" : undefined,
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
    case "blueprint.session.control":
      payload = await client.controlSession(
        requireArg(args, "sessionId"),
        args.control && typeof args.control === "object" ? args.control as Record<string, unknown> : {},
      );
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
      serverInfo: { name: "blueprint-agent-access", version: "2026-05-21" },
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
