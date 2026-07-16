/**
 * Environment construction for the isolated local launch smoke
 * (scripts/launch-smoke-local.mjs).
 *
 * The smoke child must never inherit live developer or cloud configuration:
 * no credentials, no automation lanes, no outbound/senders, no payment or
 * provider access. Instead of cloning process.env and deleting known-bad
 * keys, this builds the child environment from an explicit allowlist so a
 * newly added secret can never leak into the smoke lane by default.
 */

// Process/runtime basics that are safe and often required for node + npm to run.
export const LOCAL_SMOKE_INHERITED_ENV_KEYS = Object.freeze([
  "PATH",
  "HOME",
  "SHELL",
  "USER",
  "LOGNAME",
  "HOSTNAME",
  "LANG",
  "LC_ALL",
  "TZ",
  "TMPDIR",
  "TEMP",
  "TMP",
  "CI",
  "NODE",
  "NODE_OPTIONS",
  "npm_config_cache",
]);

// Env keys that must never reach the smoke child even if a caller tries to
// pass them through. Used by the regression test and as a final scrub.
export const LOCAL_SMOKE_FORBIDDEN_ENV_KEYS = Object.freeze([
  "STRIPE_SECRET_KEY",
  "STRIPE_CONNECT_ACCOUNT_ID",
  "STRIPE_WEBHOOK_SECRET",
  "CHECKOUT_ALLOWED_ORIGINS",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLOUD_PROJECT",
  "GCLOUD_PROJECT",
  "K_SERVICE",
  "FUNCTION_TARGET",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "SENDGRID_API_KEY",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "NOTION_API_KEY",
  "NOTION_API_TOKEN",
  "PIPELINE_SYNC_TOKEN",
  "ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN",
  "ROBOT_EVAL_JOB_REQUEST_ROUTE_AUTH_TOKEN",
  "REDIS_URL",
  "RATE_LIMIT_REDIS_URL",
  "FIREHOSE_API_TOKEN",
  "FIREHOSE_BASE_URL",
  "ELEVENLABS_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS",
  "BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS",
]);

// Every automation lane the runtime knows about is pinned off in the smoke.
export const LOCAL_SMOKE_DISABLED_AUTOMATION_FLAGS = Object.freeze({
  BLUEPRINT_ALL_AUTOMATION_ENABLED: "0",
  BLUEPRINT_WAITLIST_AUTOMATION_ENABLED: "0",
  BLUEPRINT_INBOUND_AUTOMATION_ENABLED: "0",
  BLUEPRINT_SUPPORT_TRIAGE_ENABLED: "0",
  BLUEPRINT_PAYOUT_TRIAGE_ENABLED: "0",
  BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED: "0",
  BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED: "0",
  BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED: "0",
  BLUEPRINT_CREATIVE_FACTORY_ENABLED: "0",
  BLUEPRINT_BUYER_LIFECYCLE_ENABLED: "0",
  BLUEPRINT_SLA_WATCHDOG_ENABLED: "0",
  BLUEPRINT_NOTION_SYNC_ENABLED: "0",
  BLUEPRINT_ONBOARDING_ENABLED: "0",
  BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER: "1",
});

export function buildLocalSmokeEnv(processEnv, { port, baseUrl, fieldEncryptionKey }) {
  const env = {};
  for (const key of LOCAL_SMOKE_INHERITED_ENV_KEYS) {
    if (processEnv[key] !== undefined) {
      env[key] = processEnv[key];
    }
  }

  Object.assign(env, LOCAL_SMOKE_DISABLED_AUTOMATION_FLAGS, {
    NODE_ENV: "production",
    PORT: String(port),
    BASE_URL: baseUrl,
    BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP: "1",
    BLUEPRINT_LOCAL_LAUNCH_SMOKE: "1",
    ALPHA_SMOKE_TAG: "local-launch-smoke",
    FIELD_ENCRYPTION_MASTER_KEY: fieldEncryptionKey,
    // Safe non-zero beta limits so /health/ready exercises the real cohort
    // policy instead of failing on zeroed caps inherited from a dev shell.
    BLUEPRINT_BETA_INVITE_CAP: "5",
    BLUEPRINT_BETA_COHORT_DAILY_LIMIT: "2",
    BLUEPRINT_BETA_ENABLED: "true",
    BLUEPRINT_BETA_KILL_SWITCH: "0",
  });

  for (const key of LOCAL_SMOKE_FORBIDDEN_ENV_KEYS) {
    delete env[key];
  }

  return env;
}
