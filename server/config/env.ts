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
    STRIPE_SECRET_KEY: z.string().trim().min(1).optional(),
    STRIPE_CONNECT_ACCOUNT_ID: z.string().trim().min(1).optional(),
    FIELD_ENCRYPTION_MASTER_KEY: z.string().trim().optional(),
    FIELD_ENCRYPTION_KMS_KEY_NAME: z.string().trim().optional(),
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
    BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE: z.string().trim().optional(),
    BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE: z.string().trim().optional(),
    BLUEPRINT_DEEP_RESEARCH_AGENT: z.string().trim().optional(),
    BLUEPRINT_CITY_LAUNCH_DEEP_RESEARCH_AGENT: z.string().trim().optional(),
    BLUEPRINT_DEEP_RESEARCH_MCP_SERVERS_JSON: z.string().trim().optional(),
    BLUEPRINT_CITY_LAUNCH_DEEP_RESEARCH_MCP_SERVERS_JSON: z.string().trim().optional(),
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
    OPENROUTER_API_KEY: z.string().trim().optional(),
    OPENROUTER_BASE_URL: z.string().trim().url().optional(),
    META_AD_ACCOUNT_ID: z.string().trim().optional(),
    META_MARKETING_API_ACCESS_TOKEN: z.string().trim().optional(),
    META_MARKETING_API_BASE_URL: z.string().trim().url().optional(),
    META_MARKETING_API_VERSION: z.string().trim().optional(),
    META_PAGE_ID: z.string().trim().optional(),
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
    GEMINI_API_KEY: z.string().trim().optional(),
    GOOGLE_GENAI_API_KEY: z.string().trim().optional(),
    GOOGLE_CREATIVE_IMAGE_MODEL: z.string().trim().optional(),
    GOOGLE_CREATIVE_IMAGE_DEFAULT_ASPECT_RATIO: z.string().trim().optional(),
    POST_SIGNUP_SPREADSHEET_ID: z.string().trim().optional(),
    POST_SIGNUP_SHEET_NAME: z.string().trim().optional(),
    SENDGRID_API_KEY: z.string().trim().optional(),
    SENDGRID_FROM_EMAIL: z.string().trim().optional(),
    SENDGRID_FROM_NAME: z.string().trim().optional(),
    SENDGRID_EVENT_WEBHOOK_SECRET: z.string().trim().optional(),
    SLACK_SIGNING_SECRET: z.string().trim().optional(),
    SLACK_BOT_TOKEN: z.string().trim().optional(),
    BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN: z.string().trim().optional(),
    BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL: z.string().trim().optional(),
    BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID: z.string().trim().optional(),
    BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET: z.string().trim().optional(),
    BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN: z.string().trim().optional(),
    BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS: z.string().trim().optional(),
    BLUEPRINT_HUMAN_REPLY_GMAIL_QUERY: z.string().trim().optional(),
    BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED: z.string().trim().optional(),
    BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_HUMAN_REPLY_SLACK_ALLOW_DMS: z.string().trim().optional(),
    BLUEPRINT_HUMAN_REPLY_SLACK_ALLOWED_CHANNELS: z.string().trim().optional(),
    ELEVENLABS_API_KEY: z.string().trim().optional(),
    ELEVENLABS_VOICE_ID: z.string().trim().optional(),
    ELEVENLABS_TTS_MODEL_ID: z.string().trim().optional(),
    ELEVENLABS_AGENT_ID: z.string().trim().optional(),
    ELEVENLABS_WEBHOOK_SECRET: z.string().trim().optional(),
    TWILIO_ACCOUNT_SID: z.string().trim().optional(),
    TWILIO_AUTH_TOKEN: z.string().trim().optional(),
    TWILIO_PHONE_NUMBER: z.string().trim().optional(),
    BLUEPRINT_VOICE_FORWARD_NUMBER: z.string().trim().optional(),
    BLUEPRINT_VOICE_BOOKING_URL: z.string().trim().url().optional(),
    BLUEPRINT_SUPPORT_EMAIL: z.string().trim().optional(),
    BLUEPRINT_ANALYTICS_INGEST_ENABLED: z.string().trim().optional(),
    RUNWAY_API_KEY: z.string().trim().optional(),
    RUNWAY_BASE_URL: z.string().trim().url().optional(),
    BLUEPRINT_OPENROUTER_VIDEO_MODEL: z.string().trim().optional(),
    BLUEPRINT_RUNWAY_VIDEO_MODEL: z.string().trim().optional(),
    BLUEPRINT_ALL_AUTOMATION_ENABLED: z.string().trim().optional(),
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
    BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED: z.string().trim().optional(),
    BLUEPRINT_EXPERIMENT_AUTOROLLOUT_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_EXPERIMENT_AUTOROLLOUT_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_EXPERIMENT_AUTOROLLOUT_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_EXPERIMENT_AUTOROLLOUT_LOOKBACK_DAYS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_EXPERIMENT_AUTOROLLOUT_MIN_EXPOSURES: z.coerce.number().int().positive().optional(),
    BLUEPRINT_EXPERIMENT_AUTOROLLOUT_MIN_RELATIVE_LIFT: z.coerce.number().positive().optional(),
    BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED: z.string().trim().optional(),
    BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS: z.string().trim().optional(),
    BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS: z.string().trim().optional(),
    BLUEPRINT_AUTONOMOUS_OUTBOUND_CHANNEL: z.string().trim().optional(),
    BLUEPRINT_MARKET_SIGNAL_PROVIDER: z.string().trim().optional(),
    BLUEPRINT_MARKET_SIGNAL_LOOKBACK_DAYS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_MARKET_SIGNAL_LIMIT: z.coerce.number().int().positive().optional(),
    SEARCH_API_KEY: z.string().trim().optional(),
    SEARCH_API_PROVIDER: z.string().trim().optional(),
    FIREHOSE_API_TOKEN: z.string().trim().optional(),
    FIREHOSE_BASE_URL: z.string().trim().url().optional(),
    BLUEPRINT_CREATIVE_FACTORY_ENABLED: z.string().trim().optional(),
    BLUEPRINT_CREATIVE_FACTORY_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_CREATIVE_FACTORY_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_CREATIVE_FACTORY_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_CREATIVE_FACTORY_SKU: z.string().trim().optional(),
    BLUEPRINT_CREATIVE_FACTORY_AUDIENCE: z.string().trim().optional(),
    BLUEPRINT_CREATIVE_FACTORY_SITE_TYPE: z.string().trim().optional(),
    BLUEPRINT_CREATIVE_FACTORY_WORKFLOW: z.string().trim().optional(),
    BLUEPRINT_CREATIVE_FACTORY_CTA: z.string().trim().optional(),
    BLUEPRINT_BUYER_LIFECYCLE_ENABLED: z.string().trim().optional(),
    BLUEPRINT_BUYER_LIFECYCLE_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_BUYER_LIFECYCLE_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_BUYER_LIFECYCLE_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_BUYER_LIFECYCLE_DAYS_SINCE_GRANT: z.coerce.number().int().positive().optional(),
    BLUEPRINT_SLA_WATCHDOG_ENABLED: z.string().trim().optional(),
    BLUEPRINT_SLA_WATCHDOG_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_SLA_WATCHDOG_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_SLA_WATCHDOG_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_NOTION_SYNC_ENABLED: z.string().trim().optional(),
    BLUEPRINT_NOTION_SYNC_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_NOTION_SYNC_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_NOTION_SYNC_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_ONBOARDING_ENABLED: z.string().trim().optional(),
    BLUEPRINT_ONBOARDING_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_ONBOARDING_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_ONBOARDING_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_GRADUATION_EVAL_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_GRADUATION_EVAL_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_GRADUATION_EVAL_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    NOTION_API_KEY: z.string().trim().optional(),
    NOTION_API_TOKEN: z.string().trim().optional(),
    NOTION_CAMPAIGNS_DB_ID: z.string().trim().optional(),
    NOTION_CREATIVE_RUNS_DB_ID: z.string().trim().optional(),
    NOTION_GRADUATION_DB_ID: z.string().trim().optional(),
    NOTION_SLA_DB_ID: z.string().trim().optional(),
    NOTION_TASKS_DB_ID: z.string().trim().optional(),
    NOTION_GROWTH_STUDIO_SHIP_BROADCAST_DB_ID: z.string().trim().optional(),
    NOTION_GROWTH_STUDIO_CAMPAIGN_DRAFTS_DB_ID: z.string().trim().optional(),
    NOTION_GROWTH_STUDIO_CREATIVE_RUNS_DB_ID: z.string().trim().optional(),
    NOTION_GROWTH_STUDIO_INTEGRATION_CHECKS_DB_ID: z.string().trim().optional(),
    NOTION_GROWTH_STUDIO_CONTENT_REVIEWS_DB_ID: z.string().trim().optional(),
    BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_ENABLED: z.string().trim().optional(),
    BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_ENABLED: z.string().trim().optional(),
    BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_GAP_CLOSURE_ENABLED: z.string().trim().optional(),
    BLUEPRINT_GAP_CLOSURE_INTERVAL_MS: z.coerce.number().int().positive().optional(),
    BLUEPRINT_GAP_CLOSURE_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    BLUEPRINT_GAP_CLOSURE_STARTUP_DELAY_MS: z.coerce.number().int().nonnegative().optional(),
    BLUEPRINT_GAP_INTAKE_TOKEN: z.string().trim().optional(),
    BLUEPRINT_GAP_DELEGATION_WEBHOOK_URL: z.string().trim().optional(),
    BLUEPRINT_PHASE2_WAITLIST_ENABLED: z.string().trim().optional(),
    BLUEPRINT_PHASE2_INBOUND_ENABLED: z.string().trim().optional(),
    BLUEPRINT_PHASE2_SUPPORT_ENABLED: z.string().trim().optional(),
    BLUEPRINT_PHASE2_PAYOUT_ENABLED: z.string().trim().optional(),
    BLUEPRINT_PAPERCLIP_HERMES_MODEL: z.string().trim().optional(),
    BLUEPRINT_PAPERCLIP_HERMES_ALLOW_PAID_MODELS: z.string().trim().optional(),
    BLUEPRINT_PAPERCLIP_HERMES_PRIMARY_MODEL: z.string().trim().optional(),
    BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL: z.string().trim().optional(),
    BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODELS: z.string().trim().optional(),
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

export function isAutomationLaneEnabled(laneEnvKey: string): boolean {
  const laneValue = process.env[laneEnvKey];
  if (typeof laneValue === "string" && laneValue.trim().length > 0) {
    return isTruthyEnvValue(laneValue);
  }

  return isEnvFlagEnabled("BLUEPRINT_ALL_AUTOMATION_ENABLED");
}

export function isPhase2LaneEnabled(lane: "waitlist" | "inbound" | "support" | "payout"): boolean {
  const laneKey = `BLUEPRINT_PHASE2_${lane.toUpperCase()}_ENABLED`;
  return isTruthyEnvValue(process.env[laneKey]);
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
