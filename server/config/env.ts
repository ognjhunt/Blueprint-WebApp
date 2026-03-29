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
    PAPERCLIP_OPS_STRIPE_WEBHOOK_URL: z.string().trim().url().optional(),
    PAPERCLIP_OPS_FIRESTORE_WEBHOOK_URL: z.string().trim().url().optional(),
    PAPERCLIP_OPS_FIRESTORE_RELAY_SECRET: z.string().trim().optional(),
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
    OPENCLAW_BASE_URL: z.string().trim().url().optional(),
    OPENCLAW_AUTH_TOKEN: z.string().trim().optional(),
    OPENCLAW_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    OPENCLAW_WAIT_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    OPENCLAW_AGENT_PATH: z.string().trim().optional(),
    OPENCLAW_AGENT_WAIT_PATH: z.string().trim().optional(),
    OPENCLAW_AGENT_CANCEL_PATH_TEMPLATE: z.string().trim().optional(),
    OPENCLAW_AGENT_ARTIFACTS_PATH_TEMPLATE: z.string().trim().optional(),
    OPENCLAW_DEFAULT_MODEL: z.string().trim().optional(),
    OPENCLAW_WAITLIST_AUTOMATION_MODEL: z.string().trim().optional(),
    OPENCLAW_INBOUND_QUALIFICATION_MODEL: z.string().trim().optional(),
    OPENCLAW_POST_SIGNUP_MODEL: z.string().trim().optional(),
    OPENCLAW_OPERATOR_THREAD_MODEL: z.string().trim().optional(),
    OPENCLAW_SUPPORT_TRIAGE_MODEL: z.string().trim().optional(),
    OPENCLAW_PAYOUT_EXCEPTION_MODEL: z.string().trim().optional(),
    OPENCLAW_PREVIEW_DIAGNOSIS_MODEL: z.string().trim().optional(),
    OPENCLAW_EXTERNAL_HARNESS_MODEL: z.string().trim().optional(),
    OPENAI_API_KEY: z.string().trim().optional(),
    OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    OPENAI_DEFAULT_MODEL: z.string().trim().optional(),
    OPENAI_WAITLIST_AUTOMATION_MODEL: z.string().trim().optional(),
    OPENAI_INBOUND_QUALIFICATION_MODEL: z.string().trim().optional(),
    OPENAI_POST_SIGNUP_MODEL: z.string().trim().optional(),
    OPENAI_OPERATOR_THREAD_MODEL: z.string().trim().optional(),
    ANTHROPIC_API_KEY: z.string().trim().optional(),
    ANTHROPIC_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    ANTHROPIC_DEFAULT_MODEL: z.string().trim().optional(),
    ANTHROPIC_WAITLIST_AUTOMATION_MODEL: z.string().trim().optional(),
    ANTHROPIC_INBOUND_QUALIFICATION_MODEL: z.string().trim().optional(),
    ANTHROPIC_POST_SIGNUP_MODEL: z.string().trim().optional(),
    ANTHROPIC_OPERATOR_THREAD_MODEL: z.string().trim().optional(),
    ACP_HARNESS_URL: z.string().trim().url().optional(),
    ACP_HARNESS_TOKEN: z.string().trim().optional(),
    ACP_DEFAULT_HARNESS: z.string().trim().optional(),
    GOOGLE_CLIENT_EMAIL: z.string().trim().optional(),
    GOOGLE_PRIVATE_KEY: z.string().trim().optional(),
    GOOGLE_CALENDAR_ID: z.string().trim().optional(),
    POST_SIGNUP_SPREADSHEET_ID: z.string().trim().optional(),
    POST_SIGNUP_SHEET_NAME: z.string().trim().optional(),
    BLUEPRINT_WAITLIST_AUTOMATION_ENABLED: z.string().trim().optional(),
    BLUEPRINT_WAITLIST_AUTOMATION_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_WAITLIST_AUTOMATION_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_WAITLIST_AUTOMATION_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_INBOUND_AUTOMATION_ENABLED: z.string().trim().optional(),
    BLUEPRINT_INBOUND_AUTOMATION_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_INBOUND_AUTOMATION_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_INBOUND_AUTOMATION_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_SUPPORT_TRIAGE_ENABLED: z.string().trim().optional(),
    BLUEPRINT_SUPPORT_TRIAGE_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_SUPPORT_TRIAGE_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_SUPPORT_TRIAGE_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_PAYOUT_TRIAGE_ENABLED: z.string().trim().optional(),
    BLUEPRINT_PAYOUT_TRIAGE_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_PAYOUT_TRIAGE_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_PAYOUT_TRIAGE_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED: z.string().trim().optional(),
    BLUEPRINT_PREVIEW_DIAGNOSIS_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_PREVIEW_DIAGNOSIS_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_PREVIEW_DIAGNOSIS_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_ENABLED: z.string().trim().optional(),
    BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_ENABLED: z.string().trim().optional(),
    BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    OPENAI_SUPPORT_TRIAGE_MODEL: z.string().trim().optional(),
    OPENAI_PAYOUT_EXCEPTION_MODEL: z.string().trim().optional(),
    OPENAI_PREVIEW_DIAGNOSIS_MODEL: z.string().trim().optional(),
    ANTHROPIC_SUPPORT_TRIAGE_MODEL: z.string().trim().optional(),
    ANTHROPIC_PAYOUT_EXCEPTION_MODEL: z.string().trim().optional(),
    ANTHROPIC_PREVIEW_DIAGNOSIS_MODEL: z.string().trim().optional(),
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
