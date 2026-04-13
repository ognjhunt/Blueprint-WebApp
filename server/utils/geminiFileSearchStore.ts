import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { requireConfiguredEnvValue } from "../config/env";
import { slugifyCityName } from "./cityLaunchProfiles";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_CITY_LAUNCH_FILE_SEARCH_DISPLAY_NAME = "blueprint-city-launch";

const DEFAULT_CITY_LAUNCH_DOC_PATHS = [
  "PLATFORM_CONTEXT.md",
  "WORLD_MODEL_STRATEGY_CONTEXT.md",
  "AUTONOMOUS_ORG.md",
  "DEPLOYMENT.md",
  "docs/city-launch-deep-research-harness-2026-04-11.md",
  "docs/generic-autonomous-city-launcher-2026-04-12.md",
  "ops/paperclip/playbooks/city-launch-template.md",
  "ops/paperclip/playbooks/capturer-supply-playbook.md",
  "ops/paperclip/playbooks/robot-team-demand-playbook.md",
  "ops/paperclip/playbooks/capturer-trust-packet-stage-gate-standard.md",
  "ops/paperclip/playbooks/field-ops-first-assignment-site-facing-trust-gate.md",
  "ops/paperclip/programs/city-launch-agent-program.md",
  "ops/paperclip/programs/city-demand-agent-program.md",
  "ops/paperclip/programs/city-launch-activation-program.md",
  "ops/paperclip/blueprint-company/tasks/city-launch-activation/TASK.md",
  "docs/robot-team-proof-motion-analytics-requirements-2026-04-10.md",
];

type FileSearchCustomMetadata =
  | { key: string; stringValue: string }
  | { key: string; numericValue: number }
  | { key: string; stringListValue: { values: string[] } };

type FileSearchStoreRecord = {
  name: string;
  displayName?: string;
};

type FileSearchDocumentRecord = {
  name: string;
  displayName?: string;
  customMetadata?: FileSearchCustomMetadata[];
  state?: string;
  mimeType?: string;
};

type FileSearchOperation = {
  name: string;
  done?: boolean;
  error?: {
    message?: string;
  };
  response?: unknown;
};

type FileSearchListStoresResponse = {
  fileSearchStores?: FileSearchStoreRecord[];
  nextPageToken?: string;
};

type FileSearchListDocumentsResponse = {
  documents?: FileSearchDocumentRecord[];
  nextPageToken?: string;
};

type BuildCityLaunchFileSearchStoreOptions = {
  city?: string | null;
  storeName?: string | null;
  displayName?: string | null;
  replaceExistingDocuments?: boolean;
  dryRun?: boolean;
  extraPaths?: string[];
};

type UploadDocumentResult = {
  repoRelativePath: string;
  absolutePath: string;
  mimeType: string;
  displayName: string;
  replacedDocumentNames: string[];
  operationName?: string;
};

export type BuildCityLaunchFileSearchStoreResult = {
  storeName: string | null;
  displayName: string;
  city: string | null;
  citySlug: string | null;
  createdStore: boolean;
  dryRun: boolean;
  uploadedDocuments: UploadDocumentResult[];
  resolvedPaths: string[];
};

function getGeminiApiKey() {
  return requireConfiguredEnvValue(
    ["GOOGLE_GENAI_API_KEY", "GEMINI_API_KEY"],
    "Gemini File Search builder",
  );
}

function buildGeminiUrl(pathname: string, query?: Record<string, string | number | boolean | null | undefined>) {
  const url = new URL(pathname, GEMINI_API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function geminiJsonRequest<T>(input: {
  pathname: string;
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
}) {
  const response = await fetch(buildGeminiUrl(input.pathname, input.query), {
    method: input.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": getGeminiApiKey(),
      ...(input.headers || {}),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) as T & { error?: { message?: string } } : {} as T;

  if (!response.ok) {
    const message =
      (payload as T & { error?: { message?: string } }).error?.message
      || `${input.method || "GET"} ${input.pathname} failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

async function fileExists(absolutePath: string) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export async function resolveCuratedCityLaunchDocPaths(input?: {
  city?: string | null;
  extraPaths?: string[];
}) {
  const candidatePaths = [...DEFAULT_CITY_LAUNCH_DOC_PATHS, ...(input?.extraPaths || [])];
  const city = input?.city?.trim();

  if (city) {
    const citySlug = slugifyCityName(city);
    candidatePaths.push(
      `ops/paperclip/playbooks/city-launch-${citySlug}.md`,
      `ops/paperclip/playbooks/city-demand-${citySlug}.md`,
      `docs/city-launch-system-${citySlug}.md`,
      `ops/paperclip/playbooks/city-capture-target-ledger-${citySlug}.md`,
      `ops/paperclip/playbooks/city-launch-${citySlug}-deep-research.md`,
    );
  }

  const deduped = unique(candidatePaths);
  const existingPaths: string[] = [];

  for (const relativePath of deduped) {
    const absolutePath = path.join(REPO_ROOT, relativePath);
    if (await fileExists(absolutePath)) {
      existingPaths.push(relativePath);
    }
  }

  return existingPaths;
}

function guessMimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".md":
      return "text/markdown";
    case ".txt":
      return "text/plain";
    case ".json":
      return "application/json";
    case ".pdf":
      return "application/pdf";
    case ".csv":
      return "text/csv";
    case ".yaml":
    case ".yml":
      return "application/x-yaml";
    default:
      return "text/plain";
  }
}

function toDisplayName(relativePath: string) {
  return relativePath.replaceAll("/", " / ");
}

function buildDocumentMetadata(input: {
  repoRelativePath: string;
  citySlug?: string | null;
}) {
  const tags = ["blueprint", "city-launch"];
  if (input.citySlug) {
    tags.push(input.citySlug);
  }

  return [
    {
      key: "repo_path",
      stringValue: input.repoRelativePath,
    },
    {
      key: "doc_scope",
      stringValue: "city_launch",
    },
    {
      key: "tags",
      stringListValue: {
        values: tags,
      },
    },
  ] satisfies FileSearchCustomMetadata[];
}

function getStringMetadataValue(
  metadata: FileSearchCustomMetadata[] | undefined,
  key: string,
) {
  const match = metadata?.find((entry) => entry.key === key);
  if (!match || !("stringValue" in match)) {
    return null;
  }
  return match.stringValue;
}

async function listAllFileSearchStores() {
  const stores: FileSearchStoreRecord[] = [];
  let pageToken: string | undefined;

  do {
    const response = await geminiJsonRequest<FileSearchListStoresResponse>({
      pathname: "/v1beta/fileSearchStores",
      query: {
        pageSize: 20,
        pageToken,
      },
    });
    stores.push(...(response.fileSearchStores || []));
    pageToken = response.nextPageToken || undefined;
  } while (pageToken);

  return stores;
}

async function getFileSearchStore(storeName: string) {
  return geminiJsonRequest<FileSearchStoreRecord>({
    pathname: `/v1beta/${storeName}`,
  });
}

async function createFileSearchStore(displayName: string) {
  return geminiJsonRequest<FileSearchStoreRecord>({
    pathname: "/v1beta/fileSearchStores",
    method: "POST",
    body: {
      displayName,
    },
  });
}

async function ensureFileSearchStore(input: {
  storeName?: string | null;
  displayName: string;
}) {
  if (input.storeName?.trim()) {
    const store = await getFileSearchStore(input.storeName.trim());
    return {
      store,
      created: false,
    };
  }

  const stores = await listAllFileSearchStores();
  const existing = [...stores]
    .reverse()
    .find((store) => store.displayName === input.displayName);

  if (existing) {
    return {
      store: existing,
      created: false,
    };
  }

  const created = await createFileSearchStore(input.displayName);
  return {
    store: created,
    created: true,
  };
}

async function listAllDocuments(storeName: string) {
  const documents: FileSearchDocumentRecord[] = [];
  let pageToken: string | undefined;

  do {
    const response = await geminiJsonRequest<FileSearchListDocumentsResponse>({
      pathname: `/v1beta/${storeName}/documents`,
      query: {
        pageSize: 20,
        pageToken,
      },
    });
    documents.push(...(response.documents || []));
    pageToken = response.nextPageToken || undefined;
  } while (pageToken);

  return documents;
}

async function deleteDocument(name: string) {
  await geminiJsonRequest<Record<string, never>>({
    pathname: `/v1beta/${name}`,
    method: "DELETE",
    query: {
      force: true,
    },
  });
}

async function startFileSearchStoreUpload(input: {
  storeName: string;
  absolutePath: string;
  displayName: string;
  customMetadata: FileSearchCustomMetadata[];
  mimeType: string;
}) {
  const stats = await fs.stat(input.absolutePath);
  const response = await fetch(
    buildGeminiUrl(`/upload/v1beta/${input.storeName}:uploadToFileSearchStore`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": getGeminiApiKey(),
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(stats.size),
        "X-Goog-Upload-Header-Content-Type": input.mimeType,
      },
      body: JSON.stringify({
        displayName: input.displayName,
        customMetadata: input.customMetadata,
        mimeType: input.mimeType,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Failed to start File Search upload for ${input.absolutePath}: ${text.slice(0, 300)}`,
    );
  }

  const uploadUrl = response.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error(`File Search upload URL missing for ${input.absolutePath}.`);
  }

  return uploadUrl;
}

async function finalizeFileSearchStoreUpload(input: {
  uploadUrl: string;
  absolutePath: string;
}) {
  const bytes = await fs.readFile(input.absolutePath);
  const response = await fetch(input.uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) as FileSearchOperation : {} as FileSearchOperation;

  if (!response.ok) {
    throw new Error(
      `File Search upload finalize failed for ${input.absolutePath}: ${text.slice(0, 300)}`,
    );
  }

  return payload;
}

async function getFileSearchOperation(operationName: string) {
  return geminiJsonRequest<FileSearchOperation>({
    pathname: `/v1beta/${operationName}`,
  });
}

async function pollOperation(operationName: string, intervalMs = 2_000, timeoutMs = 2 * 60 * 1000) {
  const startedAt = Date.now();

  while (true) {
    const operation = await getFileSearchOperation(operationName);
    if (operation.done) {
      if (operation.error?.message) {
        throw new Error(operation.error.message);
      }
      return operation;
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for File Search operation ${operationName}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function uploadDocumentToStore(input: {
  storeName: string;
  repoRelativePath: string;
  citySlug?: string | null;
}) {
  const absolutePath = path.join(REPO_ROOT, input.repoRelativePath);
  const mimeType = guessMimeType(absolutePath);
  const displayName = toDisplayName(input.repoRelativePath);
  const customMetadata = buildDocumentMetadata({
    repoRelativePath: input.repoRelativePath,
    citySlug: input.citySlug,
  });

  const uploadUrl = await startFileSearchStoreUpload({
    storeName: input.storeName,
    absolutePath,
    displayName,
    customMetadata,
    mimeType,
  });

  const operation = await finalizeFileSearchStoreUpload({
    uploadUrl,
    absolutePath,
  });

  if (operation.name) {
    await pollOperation(operation.name);
  }

  return {
    repoRelativePath: input.repoRelativePath,
    absolutePath,
    mimeType,
    displayName,
    replacedDocumentNames: [],
    operationName: operation.name,
  } satisfies UploadDocumentResult;
}

export async function buildCityLaunchFileSearchStore(
  options: BuildCityLaunchFileSearchStoreOptions = {},
) {
  const city = options.city?.trim() || null;
  const citySlug = city ? slugifyCityName(city) : null;
  const displayName = options.displayName?.trim() || DEFAULT_CITY_LAUNCH_FILE_SEARCH_DISPLAY_NAME;
  const resolvedPaths = await resolveCuratedCityLaunchDocPaths({
    city,
    extraPaths: options.extraPaths,
  });

  const result: BuildCityLaunchFileSearchStoreResult = {
    storeName: options.storeName?.trim() || null,
    displayName,
    city,
    citySlug,
    createdStore: false,
    dryRun: Boolean(options.dryRun),
    uploadedDocuments: [],
    resolvedPaths,
  };

  if (options.dryRun) {
    return result;
  }

  const ensured = await ensureFileSearchStore({
    storeName: options.storeName,
    displayName,
  });
  const storeName = ensured.store.name;
  result.storeName = storeName;
  result.createdStore = ensured.created;

  const replaceExistingDocuments = options.replaceExistingDocuments !== false;
  const existingDocuments = replaceExistingDocuments
    ? await listAllDocuments(storeName)
    : [];

  const existingDocumentsByRepoPath = new Map<string, FileSearchDocumentRecord[]>();
  for (const document of existingDocuments) {
    const repoPath = getStringMetadataValue(document.customMetadata, "repo_path");
    if (!repoPath) {
      continue;
    }
    const bucket = existingDocumentsByRepoPath.get(repoPath) || [];
    bucket.push(document);
    existingDocumentsByRepoPath.set(repoPath, bucket);
  }

  for (const repoRelativePath of resolvedPaths) {
    const replacedDocumentNames: string[] = [];
    if (replaceExistingDocuments) {
      const existingForPath = existingDocumentsByRepoPath.get(repoRelativePath) || [];
      for (const document of existingForPath) {
        await deleteDocument(document.name);
        replacedDocumentNames.push(document.name);
      }
    }

    const upload = await uploadDocumentToStore({
      storeName,
      repoRelativePath,
      citySlug,
    });
    result.uploadedDocuments.push({
      ...upload,
      replacedDocumentNames: [...upload.replacedDocumentNames, ...replacedDocumentNames],
    });
  }

  return result;
}

export {
  DEFAULT_CITY_LAUNCH_DOC_PATHS,
  DEFAULT_CITY_LAUNCH_FILE_SEARCH_DISPLAY_NAME,
};
