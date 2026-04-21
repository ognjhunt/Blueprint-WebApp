import { getConfiguredEnvValue } from "../config/env";

export type DeepResearchToolChoiceMode = "auto" | "any" | "none" | "validated";

export interface DeepResearchMcpServerConfig {
  type: "mcp_server";
  name: string;
  url: string;
  headers?: Record<string, string>;
  allowed_tools?: {
    mode?: DeepResearchToolChoiceMode;
    tools?: string[];
  };
}

export interface BuildDeepResearchToolsInput {
  fileSearchStoreNames?: string[];
  mcpServers?: DeepResearchMcpServerConfig[];
  includeGoogleSearch?: boolean;
  includeUrlContext?: boolean;
  includeCodeExecution?: boolean;
}

function normalizeFileSearchStoreNames(fileSearchStoreNames?: string[]) {
  return (fileSearchStoreNames || [])
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeAllowedTools(
  allowedTools?: DeepResearchMcpServerConfig["allowed_tools"],
) {
  if (!allowedTools) {
    return undefined;
  }

  const normalizedTools = (allowedTools.tools || [])
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    mode: allowedTools.mode,
    tools: normalizedTools.length > 0 ? normalizedTools : undefined,
  };
}

function coerceMcpServerConfig(
  rawValue: unknown,
  sourceLabel: string,
): DeepResearchMcpServerConfig {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    throw new Error(`${sourceLabel} must contain objects.`);
  }

  const raw = rawValue as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const url = typeof raw.url === "string" ? raw.url.trim() : "";

  if (!name) {
    throw new Error(`${sourceLabel} is missing a non-empty "name".`);
  }
  if (!url) {
    throw new Error(`${sourceLabel} is missing a non-empty "url".`);
  }

  try {
    new URL(url);
  } catch {
    throw new Error(`${sourceLabel} has an invalid MCP URL: ${url}`);
  }

  let headers: Record<string, string> | undefined;
  if (raw.headers !== undefined) {
    if (!raw.headers || typeof raw.headers !== "object" || Array.isArray(raw.headers)) {
      throw new Error(`${sourceLabel} has invalid "headers"; expected an object.`);
    }

    headers = Object.fromEntries(
      Object.entries(raw.headers).map(([key, value]) => [key, String(value)]),
    );
  }

  let allowedTools: DeepResearchMcpServerConfig["allowed_tools"] | undefined;
  if (raw.allowed_tools !== undefined) {
    if (
      !raw.allowed_tools
      || typeof raw.allowed_tools !== "object"
      || Array.isArray(raw.allowed_tools)
    ) {
      throw new Error(
        `${sourceLabel} has invalid "allowed_tools"; expected an object.`,
      );
    }

    const rawAllowedTools = raw.allowed_tools as Record<string, unknown>;
    const mode =
      typeof rawAllowedTools.mode === "string"
        ? rawAllowedTools.mode.trim() as DeepResearchToolChoiceMode
        : undefined;
    const tools = Array.isArray(rawAllowedTools.tools)
      ? rawAllowedTools.tools
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean)
      : undefined;

    allowedTools = {
      mode,
      tools: tools?.length ? tools : undefined,
    };
  }

  return {
    type: "mcp_server",
    name,
    url,
    headers,
    allowed_tools: normalizeAllowedTools(allowedTools),
  };
}

export function resolveDeepResearchMcpServers(input?: {
  explicitServers?: unknown[];
  envKeys?: string[];
}) {
  const explicitServers = Array.isArray(input?.explicitServers)
    ? input.explicitServers
    : undefined;
  if (explicitServers && explicitServers.length > 0) {
    return explicitServers.map((entry, index) =>
      coerceMcpServerConfig(entry, `Deep Research MCP server ${index + 1}`),
    );
  }

  const configured = getConfiguredEnvValue(
    ...(input?.envKeys || ["BLUEPRINT_DEEP_RESEARCH_MCP_SERVERS_JSON"]),
  );
  if (!configured) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(configured);
  } catch (error) {
    throw new Error(
      `BLUEPRINT_DEEP_RESEARCH_MCP_SERVERS_JSON must be valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      "BLUEPRINT_DEEP_RESEARCH_MCP_SERVERS_JSON must be a JSON array of MCP server configs.",
    );
  }

  return parsed.map((entry, index) =>
    coerceMcpServerConfig(entry, `Deep Research MCP server ${index + 1}`),
  );
}

export function buildDeepResearchTools(input: BuildDeepResearchToolsInput = {}) {
  const normalizedStoreNames = normalizeFileSearchStoreNames(
    input.fileSearchStoreNames,
  );
  const tools: Array<Record<string, unknown>> = [];

  if (input.includeGoogleSearch ?? true) {
    tools.push({
      type: "google_search",
    });
  }

  if (input.includeUrlContext ?? true) {
    tools.push({
      type: "url_context",
    });
  }

  if (input.includeCodeExecution ?? true) {
    tools.push({
      type: "code_execution",
    });
  }

  if (normalizedStoreNames.length > 0) {
    tools.push({
      type: "file_search",
      file_search_store_names: normalizedStoreNames,
    });
  }

  for (const server of input.mcpServers || []) {
    tools.push(server as unknown as Record<string, unknown>);
  }

  return tools.length > 0 ? tools : undefined;
}

export function resolveDeepResearchFileSearchStoreNames(input?: {
  explicitStoreNames?: string[];
  envKeys?: string[];
}) {
  const explicit = (input?.explicitStoreNames || [])
    .map((value) => value.trim())
    .filter(Boolean);
  if (explicit.length > 0) {
    return explicit;
  }

  const configured = getConfiguredEnvValue(
    ...(input?.envKeys || ["BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE"]),
  );
  if (!configured) {
    return undefined;
  }

  const values = configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}
