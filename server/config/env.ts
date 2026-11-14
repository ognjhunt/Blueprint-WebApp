import "./bootstrap-env";
import { z } from "zod";

const PLACEHOLDER_VALUES = new Set(["PLACEHOLDER", "DUMMY"]);

const isPlaceholderValue = (value: string | undefined) =>
  Boolean(value && PLACEHOLDER_VALUES.has(value.trim().toUpperCase()));

const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"]);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    FIELD_ENCRYPTION_MASTER_KEY: z.string().trim().optional(),
    FIELD_ENCRYPTION_KMS_KEY_NAME: z.string().trim().optional(),
    RATE_LIMIT_REDIS_URL: z.string().trim().optional(),
    REDIS_URL: z.string().trim().optional(),
    ALLOWED_ORIGINS: z.string().trim().optional(),
    API_BODY_LIMIT: z.string().trim().optional(),
    PIPELINE_SYNC_TOKEN: z.string().trim().min(1).optional(),
    BLUEPRINT_SESSION_UI_TOKEN_SECRET: z.string().trim().optional(),
    WORLDLABS_API_KEY: z.string().trim().optional(),
    WORLDLABS_API_BASE_URL: z.string().trim().url().optional(),
    WORLDLABS_DEFAULT_MODEL: z.string().trim().optional(),
    OPENCLAW_BASE_URL: z.string().trim().url().optional(),
    OPENCLAW_AUTH_TOKEN: z.string().trim().optional(),
    OPENCLAW_WAIT_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    OPENCLAW_AGENT_PATH: z.string().trim().optional(),
    OPENCLAW_AGENT_WAIT_PATH: z.string().trim().optional(),
    OPENCLAW_DEFAULT_MODEL: z.string().trim().optional(),
    OPENCLAW_OPERATOR_THREAD_MODEL: z.string().trim().optional(),
    OPENAI_API_KEY: z.string().trim().optional(),
    OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    OPENAI_DEFAULT_MODEL: z.string().trim().optional(),
    OPENAI_INBOUND_QUALIFICATION_MODEL: z.string().trim().optional(),
    ANTHROPIC_API_KEY: z.string().trim().optional(),
    ANTHROPIC_AUTH_TOKEN: z.string().trim().optional(),
    ANTHROPIC_BASE_URL: z.string().trim().url().optional(),
    ANTHROPIC_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    ANTHROPIC_DEFAULT_MODEL: z.string().trim().optional(),
    ACP_HARNESS_URL: z.string().trim().url().optional(),
    ACP_DEFAULT_HARNESS: z.string().trim().optional(),
    GOOGLE_CLIENT_EMAIL: z.string().trim().optional(),
    GOOGLE_PRIVATE_KEY: z.string().trim().optional(),
    GOOGLE_CALENDAR_ID: z.string().trim().optional(),
    GEMINI_API_KEY: z.string().trim().optional(),
    GOOGLE_GENAI_API_KEY: z.string().trim().optional(),
    POST_SIGNUP_SPREADSHEET_ID: z.string().trim().optional(),
    RESEND_API_KEY: z.string().trim().optional(),
    RESEND_API_KEY_FILE: z.string().trim().optional(),
    RESEND_FROM_EMAIL: z.string().trim().optional(),
    RESEND_FROM_NAME: z.string().trim().optional(),
    RESEND_WEBHOOK_SECRET: z.string().trim().optional(),
    SLACK_BOT_TOKEN: z.string().trim().optional(),
    BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL: z.string().trim().optional(),
    BLUEPRINT_POLICY_CANARY_NOTIFICATION_EMAIL_ALLOWLIST: z.string().trim().optional(),
    ELEVENLABS_API_KEY: z.string().trim().optional(),
    ELEVENLABS_VOICE_ID: z.string().trim().optional(),
    ELEVENLABS_AGENT_ID: z.string().trim().optional(),
    TWILIO_ACCOUNT_SID: z.string().trim().optional(),
    TWILIO_AUTH_TOKEN: z.string().trim().optional(),
    TWILIO_PHONE_NUMBER: z.string().trim().optional(),
    BLUEPRINT_VOICE_FORWARD_NUMBER: z.string().trim().optional(),
    BLUEPRINT_VOICE_BOOKING_URL: z.string().trim().url().optional(),
    BLUEPRINT_ANALYTICS_INGEST_ENABLED: z.string().trim().optional(),
    BLUEPRINT_ALL_AUTOMATION_ENABLED: z.string().trim().optional(),
    BLUEPRINT_WAITLIST_AUTOMATION_ENABLED: z.string().trim().optional(),
    BLUEPRINT_INBOUND_AUTOMATION_ENABLED: z.string().trim().optional(),
    BLUEPRINT_SUPPORT_TRIAGE_ENABLED: z.string().trim().optional(),
    BLUEPRINT_PAYOUT_TRIAGE_ENABLED: z.string().trim().optional(),
    BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED: z.string().trim().optional(),
    BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED: z.string().trim().optional(),
    BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED: z.string().trim().optional(),
    BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS: z.string().trim().optional(),
    BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS: z.string().trim().optional(),
    BLUEPRINT_AUTONOMOUS_OUTBOUND_CHANNEL: z.string().trim().optional(),
    SEARCH_API_KEY: z.string().trim().optional(),
    SEARCH_API_PROVIDER: z.string().trim().optional(),
    FIREHOSE_API_TOKEN: z.string().trim().optional(),
    FIREHOSE_BASE_URL: z.string().trim().url().optional(),
    BLUEPRINT_CREATIVE_FACTORY_ENABLED: z.string().trim().optional(),
    BLUEPRINT_BUYER_LIFECYCLE_ENABLED: z.string().trim().optional(),
    BLUEPRINT_SLA_WATCHDOG_ENABLED: z.string().trim().optional(),
    BLUEPRINT_NOTION_SYNC_ENABLED: z.string().trim().optional(),
    BLUEPRINT_ONBOARDING_ENABLED: z.string().trim().optional(),
    NOTION_API_KEY: z.string().trim().optional(),
    NOTION_API_TOKEN: z.string().trim().optional(),
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

export function isAutomationLaneEnabled(laneEnvKey: string): boolean {
  const laneValue = process.env[laneEnvKey];
  if (typeof laneValue === "string" && laneValue.trim().length > 0) {
    return isTruthyEnvValue(laneValue);
  }

  return isEnvFlagEnabled("BLUEPRINT_ALL_AUTOMATION_ENABLED");
}

/** Whether the footage reader runs at all. */
export function isSiteVideoEvidenceEnabled(): boolean {
  return isEnvFlagEnabled("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED");
}

/**
 * Whether a model reads the task description into brief proposals at submit.
 *
 * A lane rather than a bare flag, so the all-automation switch carries it. It
 * only proposes; the operator's confirmation is still the attestation.
 */
export function isSiteTaskBriefReadingEnabled(): boolean {
  return isAutomationLaneEnabled("BLUEPRINT_SITE_TASK_BRIEF_READING_ENABLED");
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
  const normalizedEnv = Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [
      key,
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    ]),
  );

  const result = envSchema.safeParse(normalizedEnv);
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
