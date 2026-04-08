import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const truthyValues = new Set(["1", "true", "yes", "on"]);

function stripWrappingQuotes(value) {
  const trimmed = String(value || "").trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = stripWrappingQuotes(trimmed.slice(separatorIndex + 1)).replace(/\\n/g, "\n");
  }
}

for (const candidate of [
  process.env.BLUEPRINT_ENV_FILE,
  process.env.PAPERCLIP_ENV_FILE,
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), "../.paperclip-blueprint.env"),
]) {
  loadEnvFile(candidate);
}

function hasCodexLocalProvider() {
  const authPath = process.env.CODEX_AUTH_FILE?.trim() || path.join(os.homedir(), ".codex", "auth.json");
  if (!fs.existsSync(authPath)) return false;
  const probe = spawnSync(process.env.CODEX_LOCAL_COMMAND?.trim() || "codex", ["--version"], {
    stdio: "ignore",
  });
  return probe.status === 0;
}

function envValue(...keys) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function isTruthy(value) {
  return truthyValues.has(String(value || "").trim().toLowerCase());
}

const failures = [];
const warnings = [];
const preflightMode = String(process.env.BLUEPRINT_ALPHA_PREFLIGHT_MODE || "strict").trim().toLowerCase();
const waivedRequirements = preflightMode === "local_test"
  ? new Set(
    String(process.env.BLUEPRINT_ALPHA_PREFLIGHT_WAIVERS || "")
      .split(/[,\n]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )
  : new Set();

function requireCheck(ok, message) {
  if (!ok) {
    failures.push(message);
  }
}

function requireCheckWithWaiver(key, ok, message) {
  if (ok) {
    return;
  }

  const normalizedKey = key.trim().toLowerCase();
  if (waivedRequirements.has(normalizedKey)) {
    warnings.push(`${message} Waived in local_test mode by BLUEPRINT_ALPHA_PREFLIGHT_WAIVERS=${normalizedKey}.`);
    return;
  }

  failures.push(message);
}

function warnCheck(ok, message) {
  if (!ok) {
    warnings.push(message);
  }
}

function anyConfigured(...keys) {
  return keys.some((key) => Boolean(envValue(key)));
}

const firebaseAdminReady = Boolean(
  envValue("FIREBASE_SERVICE_ACCOUNT_JSON", "GOOGLE_APPLICATION_CREDENTIALS")
  || envValue("K_SERVICE", "FUNCTION_TARGET", "GOOGLE_CLOUD_PROJECT"),
);

requireCheck(
  firebaseAdminReady,
  "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS, or run on Cloud Run/Functions with an attached service account.",
);

requireCheck(
  hasCodexLocalProvider() || Boolean(envValue("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "ACP_HARNESS_URL")),
  "One structured automation provider is required for alpha launch. Configure local Codex OAuth or set OPENAI_API_KEY, ANTHROPIC_API_KEY, or ACP_HARNESS_URL.",
);

requireCheckWithWaiver("stripe", Boolean(envValue("STRIPE_SECRET_KEY")), "STRIPE_SECRET_KEY is required for checkout.");
requireCheckWithWaiver(
  "stripe",
  Boolean(envValue("STRIPE_CONNECT_ACCOUNT_ID")),
  "STRIPE_CONNECT_ACCOUNT_ID is required for creator payout and onboarding flows.",
);
requireCheckWithWaiver(
  "stripe",
  Boolean(envValue("STRIPE_WEBHOOK_SECRET")),
  "STRIPE_WEBHOOK_SECRET is required for webhook validation.",
);
requireCheckWithWaiver(
  "stripe",
  Boolean(envValue("CHECKOUT_ALLOWED_ORIGINS")),
  "CHECKOUT_ALLOWED_ORIGINS is required for alpha checkout launch.",
);

const automationFlags = {
  BLUEPRINT_WAITLIST_AUTOMATION_ENABLED: isTruthy(process.env.BLUEPRINT_WAITLIST_AUTOMATION_ENABLED),
  BLUEPRINT_INBOUND_AUTOMATION_ENABLED: isTruthy(process.env.BLUEPRINT_INBOUND_AUTOMATION_ENABLED),
  BLUEPRINT_SUPPORT_TRIAGE_ENABLED: isTruthy(process.env.BLUEPRINT_SUPPORT_TRIAGE_ENABLED),
  BLUEPRINT_PAYOUT_TRIAGE_ENABLED: isTruthy(process.env.BLUEPRINT_PAYOUT_TRIAGE_ENABLED),
  BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED: isTruthy(process.env.BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED),
  BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED: isTruthy(process.env.BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED),
  BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED: isTruthy(process.env.BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED),
  BLUEPRINT_CREATIVE_FACTORY_ENABLED: isTruthy(process.env.BLUEPRINT_CREATIVE_FACTORY_ENABLED),
  BLUEPRINT_BUYER_LIFECYCLE_ENABLED: isTruthy(process.env.BLUEPRINT_BUYER_LIFECYCLE_ENABLED),
};

for (const [key, enabled] of Object.entries(automationFlags)) {
  requireCheck(enabled, `${key} must be enabled for the autonomous alpha launch configuration.`);
}

const googleAuthReady = Boolean(
  (envValue("GOOGLE_CLIENT_EMAIL") && envValue("GOOGLE_PRIVATE_KEY"))
  || envValue("FIREBASE_SERVICE_ACCOUNT_JSON", "GOOGLE_APPLICATION_CREDENTIALS"),
);
requireCheckWithWaiver(
  "post_signup",
  googleAuthReady,
  "Google service account credentials are required for post-signup automation. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY, or reuse FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS.",
);
requireCheckWithWaiver("post_signup", Boolean(envValue("GOOGLE_CALENDAR_ID")), "GOOGLE_CALENDAR_ID is required for post-signup calendar automation.");
requireCheckWithWaiver(
  "post_signup",
  Boolean(envValue("POST_SIGNUP_SPREADSHEET_ID", "SPREADSHEET_ID")),
  "POST_SIGNUP_SPREADSHEET_ID or SPREADSHEET_ID is required for post-signup sheet updates.",
);
requireCheckWithWaiver("post_signup", Boolean(envValue("SLACK_WEBHOOK_URL")), "SLACK_WEBHOOK_URL is required for autonomous post-signup notifications.");

const smtpEnabled = Boolean(
  envValue("SMTP_HOST") || envValue("SMTP_PORT") || envValue("SMTP_USER") || envValue("SMTP_PASS"),
);
requireCheckWithWaiver(
  "post_signup",
  !smtpEnabled || Boolean(envValue("SMTP_HOST") && envValue("SMTP_PORT") && envValue("SMTP_USER") && envValue("SMTP_PASS")),
  "SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS must all be set when SMTP delivery is enabled.",
);
requireCheckWithWaiver(
  "post_signup",
  getEmailTransportStatus(),
  "A configured SendGrid or SMTP transport is required for autonomous post-signup email.",
);

const experimentAutorolloutEnabled = automationFlags.BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED;
if (experimentAutorolloutEnabled) {
  warnCheck(
    isTruthy(process.env.BLUEPRINT_ANALYTICS_INGEST_ENABLED),
    "BLUEPRINT_ANALYTICS_INGEST_ENABLED is recommended so experiment autorollout has a first-party growth event stream to evaluate.",
  );
}

const researchOutboundEnabled = automationFlags.BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED;
if (researchOutboundEnabled) {
  requireCheckWithWaiver("research_outbound", Boolean(envValue("FIREHOSE_API_TOKEN")), "FIREHOSE_API_TOKEN is required when autonomous research outbound is enabled.");
  requireCheckWithWaiver("research_outbound", Boolean(envValue("FIREHOSE_BASE_URL")), "FIREHOSE_BASE_URL is required when autonomous research outbound is enabled.");
  requireCheckWithWaiver(
    "research_outbound",
    Boolean(envValue("BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS")),
    "BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS is required when autonomous research outbound is enabled.",
  );

  const outboundChannel = (envValue("BLUEPRINT_AUTONOMOUS_OUTBOUND_CHANNEL") || "sendgrid").toLowerCase();
  requireCheck(
    outboundChannel === "sendgrid",
    "BLUEPRINT_AUTONOMOUS_OUTBOUND_CHANNEL must be sendgrid when autonomous research outbound is enabled.",
  );

  requireCheckWithWaiver(
    "research_outbound",
    Boolean(envValue("BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS")),
    "BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS is required for autonomous research outbound over SendGrid/SMTP.",
  );
  requireCheckWithWaiver(
    "research_outbound",
    getEmailTransportStatus(),
    "A configured SendGrid or SMTP transport is required for autonomous research outbound over SendGrid/SMTP.",
  );
}

const creativeFactoryEnabled = automationFlags.BLUEPRINT_CREATIVE_FACTORY_ENABLED;
if (creativeFactoryEnabled) {
  requireCheck(
    Boolean(envValue("GOOGLE_GENAI_API_KEY", "GEMINI_API_KEY")),
    "GOOGLE_GENAI_API_KEY or GEMINI_API_KEY is required when the creative factory is enabled.",
  );
  requireCheck(Boolean(envValue("RUNWAY_API_KEY")), "RUNWAY_API_KEY is required when the creative factory is enabled.");
  warnCheck(
    Boolean(envValue("RUNWAY_BASE_URL")),
    "RUNWAY_BASE_URL is unset; the creative factory will fall back to the default Runway API base URL.",
  );
}

const buyerLifecycleEnabled = automationFlags.BLUEPRINT_BUYER_LIFECYCLE_ENABLED;
if (buyerLifecycleEnabled) {
  requireCheck(
    getEmailTransportStatus(),
    "A configured SendGrid or SMTP transport is required when buyer lifecycle automation is enabled.",
  );
  warnCheck(
    Boolean(envValue("BLUEPRINT_VOICE_BOOKING_URL")),
    "BLUEPRINT_VOICE_BOOKING_URL is recommended so buyer lifecycle outreach points back to a live booking flow.",
  );
}

const elevenLabsPartiallyConfigured = anyConfigured(
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "ELEVENLABS_AGENT_ID",
);
if (elevenLabsPartiallyConfigured) {
  requireCheck(
    Boolean(envValue("ELEVENLABS_API_KEY") && envValue("ELEVENLABS_VOICE_ID")),
    "ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID must both be set to make web voice live.",
  );
} else {
  warnCheck(
    false,
    "Web voice is not live. Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to enable the ElevenLabs concierge.",
  );
}

const twilioPartiallyConfigured = anyConfigured(
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "BLUEPRINT_VOICE_FORWARD_NUMBER",
);
if (twilioPartiallyConfigured) {
  requireCheck(Boolean(envValue("TWILIO_ACCOUNT_SID")), "TWILIO_ACCOUNT_SID is required to make PSTN voice live.");
  requireCheck(Boolean(envValue("TWILIO_AUTH_TOKEN")), "TWILIO_AUTH_TOKEN is required to make PSTN voice live.");
  requireCheck(Boolean(envValue("TWILIO_PHONE_NUMBER")), "TWILIO_PHONE_NUMBER is required to make PSTN voice live.");
} else {
  warnCheck(
    false,
    "PSTN voice is not live. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to enable the Twilio-compatible intake routes.",
  );
}

warnCheck(Boolean(envValue("REDIS_URL")), "REDIS_URL is recommended for live hosted-session state.");
if (envValue("RATE_LIMIT_REDIS_URL")) {
  warnCheck(Boolean(envValue("REDIS_URL")), "RATE_LIMIT_REDIS_URL is set without REDIS_URL; confirm the split Redis setup is intentional.");
}

function getEmailTransportStatus() {
  return Boolean(
    (envValue("SENDGRID_API_KEY") && envValue("SENDGRID_FROM_EMAIL"))
    || (envValue("SMTP_HOST") && envValue("SMTP_PORT") && envValue("SMTP_USER") && envValue("SMTP_PASS")),
  );
}

console.log("Alpha launch preflight");
console.log(`Mode: ${preflightMode}`);
console.log("");

if (failures.length === 0) {
  console.log("Required checks passed.");
} else {
  console.error("Required checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
}

if (warnings.length > 0) {
  console.log("");
  console.log("Warnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

process.exit(failures.length === 0 ? 0 : 1);
