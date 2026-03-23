type ClientEnvKey =
  | "VITE_GOOGLE_MAPS_API_KEY"
  | "VITE_GOOGLE_GENAI_API_KEY"
  | "VITE_GOOGLE_API_KEY"
  | "VITE_INTERNAL_SCENE_ACCESS_CODE"
  | "VITE_GOOGLE_CLIENT_ID"
  | "VITE_GOOGLE_APP_ID"
  | "VITE_PUBLIC_APP_URL"
  | "VITE_CAPTURE_APP_PLACEHOLDER_URL";

const cache = new Map<ClientEnvKey, string | null>();

type RequiredClientEnvOptions = {
  feature?: string;
  nonProductionFallback?: string;
};

export class MissingClientEnvError extends Error {
  readonly key: ClientEnvKey;
  readonly feature?: string;

  constructor(key: ClientEnvKey, feature?: string) {
    super(
      feature
        ? `${feature} requires ${key} to be configured.`
        : `${key} must be configured.`,
    );
    this.name = "MissingClientEnvError";
    this.key = key;
    this.feature = feature;
  }
}

function getClientMode(): string {
  return (import.meta.env.MODE || "development").trim() || "development";
}

function readClientEnv(key: ClientEnvKey): string | null {
  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }

  const value = (
    import.meta as unknown as { env?: Record<string, string | undefined> }
  )?.env?.[key];
  const normalized = typeof value === "string" && value.trim() ? value.trim() : null;
  cache.set(key, normalized);
  return normalized;
}

function getRequiredClientEnv(
  key: ClientEnvKey,
  options: RequiredClientEnvOptions = {},
): string {
  const value = readClientEnv(key);
  if (value) {
    return value;
  }

  if (options.nonProductionFallback && getClientMode() !== "production") {
    return options.nonProductionFallback;
  }

  throw new MissingClientEnvError(key, options.feature);
}

function getOptionalClientEnv(key: ClientEnvKey): string | null {
  return readClientEnv(key);
}

export function getGoogleMapsApiKey(): string | null {
  return getOptionalClientEnv("VITE_GOOGLE_MAPS_API_KEY");
}

export function getGoogleGenerativeAiKey(): string | null {
  return getOptionalClientEnv("VITE_GOOGLE_GENAI_API_KEY");
}

export function getGoogleApiKey(): string {
  return getRequiredClientEnv("VITE_GOOGLE_API_KEY", {
    feature: "Google Drive upload",
  });
}

export function getInternalSceneAccessCode(): string | null {
  return getOptionalClientEnv("VITE_INTERNAL_SCENE_ACCESS_CODE");
}

export function getGoogleClientId(): string {
  return getRequiredClientEnv("VITE_GOOGLE_CLIENT_ID", {
    feature: "Google Drive upload",
  });
}

export function getGoogleAppId(): string {
  return getRequiredClientEnv("VITE_GOOGLE_APP_ID", {
    feature: "Google Drive upload",
  });
}

export function getPublicAppUrl(): string {
  const configured = getOptionalClientEnv("VITE_PUBLIC_APP_URL");
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "http://localhost:5173";
}

export function getCaptureAppPlaceholderUrl(): string {
  const configured = getOptionalClientEnv("VITE_CAPTURE_APP_PLACEHOLDER_URL");
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return `${getPublicAppUrl()}/capture-app`;
}

export function resetClientEnvCacheForTests() {
  cache.clear();
}
