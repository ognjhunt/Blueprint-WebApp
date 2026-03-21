import { z } from "zod";

const PLACEHOLDER_VALUES = new Set(["PLACEHOLDER", "DUMMY"]);

const isPlaceholderValue = (value: string | undefined) =>
  Boolean(value && PLACEHOLDER_VALUES.has(value.trim().toUpperCase()));

const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"]);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    STRIPE_SECRET_KEY: z.string().trim().min(1).optional(),
    STRIPE_CONNECT_ACCOUNT_ID: z.string().trim().min(1).optional(),
    STRIPE_PUBLIC_BASE_URL: z.string().trim().url().optional(),
    STRIPE_ONBOARDING_REFRESH_URL: z.string().trim().url().optional(),
    STRIPE_ONBOARDING_RETURN_URL: z.string().trim().url().optional(),
    RATE_LIMIT_REDIS_URL: z.string().trim().optional(),
    REDIS_URL: z.string().trim().optional(),
    ALLOWED_ORIGINS: z.string().trim().optional(),
    API_BODY_LIMIT: z.string().trim().optional(),
    PIPELINE_SYNC_TOKEN: z.string().trim().min(1).optional(),
    BLUEPRINT_SESSION_UI_TOKEN_SECRET: z.string().trim().optional(),
    BLUEPRINT_PRESENTATION_DEMO_UI_BASE_URL: z.string().trim().url().optional(),
    BLUEPRINT_PRESENTATION_DEMO_UI_BASE_URL_TEMPLATE: z.string().trim().optional(),
    BLUEPRINT_PRESENTATION_DEMO_STOP_URL_TEMPLATE: z.string().trim().optional(),
    BLUEPRINT_PRESENTATION_DEMO_TTL_SECONDS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_PRESENTATION_DEMO_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_HOSTED_DEMO_RUNTIME_BASE_URL: z.string().trim().url().optional(),
    BLUEPRINT_HOSTED_DEMO_RUNTIME_WEBSOCKET_BASE_URL: z.string().trim().url().optional(),
    WORLDLABS_API_KEY: z.string().trim().optional(),
    WORLDLABS_API_BASE_URL: z.string().trim().url().optional(),
    WORLDLABS_DEFAULT_MODEL: z.string().trim().optional(),
  })
  .passthrough();

export type Env = z.infer<typeof envSchema>;

export class MissingEnvironmentVariableError extends Error {
  readonly keys: string[];

  constructor(keys: string[], context?: string) {
    const joinedKeys = keys.join(" or ");
    super(
      context
        ? `${context} requires ${joinedKeys} to be configured.`
        : `${joinedKeys} must be configured.`,
    );
    this.name = "MissingEnvironmentVariableError";
    this.keys = keys;
  }
}

export function getConfiguredEnvValue(...keys: string[]): string | null {
  for (const key of keys) {
    const rawValue = process.env[key];
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value || isPlaceholderValue(value)) {
      continue;
    }
    return value;
  }

  return null;
}

export function isTruthyEnvValue(value: string | undefined | null): boolean {
  return TRUTHY_VALUES.has(String(value || "").trim().toLowerCase());
}

export function isEnvFlagEnabled(...keys: string[]): boolean {
  return keys.some((key) => isTruthyEnvValue(process.env[key]));
}

export function requireConfiguredEnvValue(
  keys: string[],
  context?: string,
): string {
  const value = getConfiguredEnvValue(...keys);
  if (value) {
    return value;
  }

  throw new MissingEnvironmentVariableError(keys, context);
}

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "env";
      return `- ${path}: ${issue.message}`;
    })
    .join("\n");

  throw new Error(`Environment validation failed:\n${issues}`);
}
