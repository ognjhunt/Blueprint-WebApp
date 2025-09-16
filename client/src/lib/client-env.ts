type ClientEnvKey =
  | "VITE_GOOGLE_MAPS_API_KEY"
  | "VITE_GOOGLE_GENAI_API_KEY"
  | "VITE_GOOGLE_API_KEY";

const cache: Partial<Record<ClientEnvKey, string>> = {};

function getRequiredClientEnv(key: ClientEnvKey): string {
  if (cache[key]) {
    return cache[key] as string;
  }

  const value = (import.meta.env as Record<string, string | undefined>)[key];
  if (!value) {
    throw new Error(`Missing ${key} environment variable.`);
  }

  cache[key] = value;
  return value;
}

export function getGoogleMapsApiKey(): string {
  return getRequiredClientEnv("VITE_GOOGLE_MAPS_API_KEY");
}

export function getGoogleGenerativeAiKey(): string {
  return getRequiredClientEnv("VITE_GOOGLE_GENAI_API_KEY");
}

export function getGoogleApiKey(): string {
  return getRequiredClientEnv("VITE_GOOGLE_API_KEY");
}

