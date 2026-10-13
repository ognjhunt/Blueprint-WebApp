export const PRODUCTION_DEFAULT_ORIGINS = ["https://tryblueprint.io", "https://www.tryblueprint.io"] as const;
export const DEVELOPMENT_DEFAULT_ORIGINS = [
  "http://localhost:5000",
  "http://localhost:3000",
  ...PRODUCTION_DEFAULT_ORIGINS,
] as const;

/**
 * CORS allowlist. An explicit ALLOWED_ORIGINS wins. Without it, production
 * allows only the public hostnames; localhost is a development default only.
 */
export function resolveAllowedOrigins(configured: string | undefined | null, nodeEnv: string | undefined): string[] {
  const explicit = String(configured || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (explicit.length) return explicit;
  return nodeEnv === "production" ? [...PRODUCTION_DEFAULT_ORIGINS] : [...DEVELOPMENT_DEFAULT_ORIGINS];
}
