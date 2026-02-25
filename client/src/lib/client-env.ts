type ClientEnvKey =
  | "VITE_GOOGLE_MAPS_API_KEY"
  | "VITE_GOOGLE_GENAI_API_KEY"
  | "VITE_GOOGLE_API_KEY"
  | "VITE_INTERNAL_SCENE_ACCESS_CODE"
  | "VITE_GOOGLE_CLIENT_ID"
  | "VITE_GOOGLE_APP_ID"
  | "VITE_PUBLIC_APP_URL";

const cache: Partial<Record<ClientEnvKey, string>> = {};

function getRequiredClientEnv(key: ClientEnvKey): string {
  if (cache[key]) {
    return cache[key] as string;
  }

  const value = (import.meta.env as Record<string, string | undefined>)[key];
  const placeholders: Record<ClientEnvKey, string> = {
    "VITE_GOOGLE_MAPS_API_KEY": "placeholder_maps_key_do_not_use_in_production",
    "VITE_GOOGLE_GENAI_API_KEY": "placeholder_genai_key_do_not_use_in_production",
    "VITE_GOOGLE_API_KEY": "placeholder_google_key_do_not_use_in_production",
    "VITE_INTERNAL_SCENE_ACCESS_CODE": "placeholder_scene_access_code",
    "VITE_GOOGLE_CLIENT_ID":
      "placeholder_google_client_id.apps.googleusercontent.com",
    "VITE_GOOGLE_APP_ID": "000000000000",
    "VITE_PUBLIC_APP_URL": "http://localhost:5173",
  };

  if (!value) {
    const placeholder = placeholders[key];
    console.warn(`Warning: ${key} environment variable is missing. Using placeholder.`);
    cache[key] = placeholder;
    return placeholder;
  }

  cache[key] = value;
  return value;
}

function getOptionalClientEnv(key: ClientEnvKey): string | null {
  if (cache[key]) {
    return cache[key] as string;
  }

  const value = (import.meta.env as Record<string, string | undefined>)[key];
  if (!value) {
    return null;
  }

  cache[key] = value;
  return value;
}

export function getGoogleMapsApiKey(): string | null {
  return getOptionalClientEnv("VITE_GOOGLE_MAPS_API_KEY");
}

export function getGoogleGenerativeAiKey(): string | null {
  return getOptionalClientEnv("VITE_GOOGLE_GENAI_API_KEY");
}

export function getGoogleApiKey(): string {
  return getRequiredClientEnv("VITE_GOOGLE_API_KEY");
}

export function getInternalSceneAccessCode(): string | null {
  return getOptionalClientEnv("VITE_INTERNAL_SCENE_ACCESS_CODE");
}

export function getGoogleClientId(): string {
  return getRequiredClientEnv("VITE_GOOGLE_CLIENT_ID");
}

export function getGoogleAppId(): string {
  return getRequiredClientEnv("VITE_GOOGLE_APP_ID");
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
