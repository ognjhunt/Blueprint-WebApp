import { getConfiguredEnvValue } from "../config/env";

export function buildDeepResearchTools(fileSearchStoreNames?: string[]) {
  const normalizedStoreNames = (fileSearchStoreNames || [])
    .map((value) => value.trim())
    .filter(Boolean);

  if (normalizedStoreNames.length === 0) {
    return undefined;
  }

  return [
    {
      type: "file_search",
      file_search_store_names: normalizedStoreNames,
    },
  ];
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
