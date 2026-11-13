import fs from "node:fs";
import path from "node:path";

const truthyValues = new Set(["1", "true", "yes", "on"]);

function usage() {
  console.error(
    [
      "Usage:",
      "  npm run alpha:env",
      "  npm run alpha:env -- <env-file>",
      "  npm run alpha:env -- --require-ready",
      "",
      "Examples:",
      "  npm run alpha:env",
      "  npm run alpha:env -- render.required.env.example",
      "  npm run alpha:env -- .env.render.local",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  let envFile = null;
  let requireReady = false;

  for (const arg of argv) {
    if (arg === "--require-ready") {
      requireReady = true;
      continue;
    }

    if (!arg.startsWith("-") && !envFile) {
      envFile = path.resolve(process.cwd(), arg);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { envFile, requireReady };
}

function stripWrappingQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const entries = [];

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(`Invalid env line ${index + 1}: ${line}`);
    }

    const key = line.slice(0, eqIndex).trim();
    const value = stripWrappingQuotes(line.slice(eqIndex + 1));

    if (!key) {
      throw new Error(`Missing env key on line ${index + 1}`);
    }

    entries.push({ key, value });
  }

  return entries;
}

function loadEnvFileIntoProcess(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`);
  }

  const entries = parseEnvFile(filePath);
  for (const { key, value } of entries) {
    process.env[key] = value;
  }
  return entries.length;
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

/**
 * An Anthropic key counts only when ANTHROPIC_BASE_URL is unset or names
 * Anthropic's own host: the website's adapter treats any other host as not
 * configured and sends nothing (server/agents/provider-config.ts).
 */
function anthropicKeyUsable() {
  if (!envValue("ANTHROPIC_API_KEY")) return false;
  const baseUrl = envValue("ANTHROPIC_BASE_URL");
  if (!baseUrl) return true;
  try {
    const parsed = new URL(baseUrl);
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "api.anthropic.com";
  } catch {
    return false;
  }
}

/**
 * An OpenAI key counts only when OPENAI_BASE_URL is unset or names OpenAI's
 * own host: the website builds no OpenAI client otherwise and sends nothing
 * (server/utils/openaiApiHost.ts). Only the reason is reported, never a value.
 */
function openAiBaseUrlNamesAnotherHost() {
  const baseUrl = envValue("OPENAI_BASE_URL");
  if (!baseUrl) return false;
  try {
    const parsed = new URL(baseUrl);
    return !(parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "api.openai.com");
  } catch {
    return true;
  }
}

function openAiKeyUsable() {
  return Boolean(envValue("OPENAI_API_KEY")) && !openAiBaseUrlNamesAnotherHost();
}

const REMOVED_PROVIDER_IDS = new Set(["deepseek_chat", "zai_glm", "openrouter"]);

/**
 * Settings of the removed providers (DeepSeek, Z.ai, OpenRouter) that are
 * still set, by NAME only: their keys, base URLs and other settings, and any
 * provider setting (global, fallback, shadow, per lane) whose value names a
 * removed provider. The website treats each as not set.
 */
function listRemovedProviderSettingNames(env = process.env) {
  const names = Object.keys(env).filter((key) => String(env[key] || "").trim() && (
    /^(DEEPSEEK|ZAI|OPENROUTER)_/.test(key)
    || key === "BLUEPRINT_OPENROUTER_VIDEO_MODEL"
    || (/^BLUEPRINT_[A-Z0-9_]+_PROVIDERS?$/.test(key)
      && String(env[key]).split(",").some((entry) => REMOVED_PROVIDER_IDS.has(entry.trim())))
  ));
  return names.sort();
}

function isTruthy(value) {
  return truthyValues.has(String(value || "").trim().toLowerCase());
}

function hasAny(...keys) {
  return keys.some((key) => Boolean(envValue(key)));
}

function getEmailTransportStatus() {
  return Boolean(envValue("RESEND_API_KEY") && envValue("RESEND_FROM_EMAIL"));
}

const checks = [
  {
    label: "Firebase Admin",
    ok: hasAny("FIREBASE_SERVICE_ACCOUNT_JSON", "GOOGLE_APPLICATION_CREDENTIALS"),
    required: ["FIREBASE_SERVICE_ACCOUNT_JSON | GOOGLE_APPLICATION_CREDENTIALS"],
  },
  {
    label: "Structured runtime provider",
    ok: openAiKeyUsable() || hasAny("ACP_HARNESS_URL") || anthropicKeyUsable(),
    required: ["OPENAI_API_KEY (only while OPENAI_BASE_URL is unset or https://api.openai.com/v1) | ANTHROPIC_API_KEY (only while ANTHROPIC_BASE_URL is unset or https://api.anthropic.com) | ACP_HARNESS_URL"],
  },
  {
    label: "Stripe checkout + payout wiring",
    ok:
      Boolean(envValue("STRIPE_SECRET_KEY"))
      && Boolean(envValue("STRIPE_CONNECT_ACCOUNT_ID"))
      && Boolean(envValue("STRIPE_WEBHOOK_SECRET"))
      && Boolean(envValue("CHECKOUT_ALLOWED_ORIGINS")),
    required: [
      "STRIPE_SECRET_KEY",
      "STRIPE_CONNECT_ACCOUNT_ID",
      "STRIPE_WEBHOOK_SECRET",
      "CHECKOUT_ALLOWED_ORIGINS",
    ],
  },
  {
    // Free beta: autonomous lanes default OFF (=0) and are switched on one at a
    // time by the founder. The audit only requires an explicit decision, so an
    // unset lane cannot be silently enabled by BLUEPRINT_ALL_AUTOMATION_ENABLED.
    label: "Autonomous lane switches set explicitly (0 or 1)",
    ok: [
      "BLUEPRINT_WAITLIST_AUTOMATION_ENABLED",
      "BLUEPRINT_INBOUND_AUTOMATION_ENABLED",
      "BLUEPRINT_SUPPORT_TRIAGE_ENABLED",
      "BLUEPRINT_PAYOUT_TRIAGE_ENABLED",
      "BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED",
      "BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED",
      "BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED",
      "BLUEPRINT_CREATIVE_FACTORY_ENABLED",
      "BLUEPRINT_BUYER_LIFECYCLE_ENABLED",
    ].every((key) => String(process.env[key] ?? "").trim().length > 0),
    required: [
      "BLUEPRINT_WAITLIST_AUTOMATION_ENABLED=0|1",
      "BLUEPRINT_INBOUND_AUTOMATION_ENABLED=0|1",
      "BLUEPRINT_SUPPORT_TRIAGE_ENABLED=0|1",
      "BLUEPRINT_PAYOUT_TRIAGE_ENABLED=0|1",
      "BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED=0|1",
      "BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED=0|1",
      "BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED=0|1",
      "BLUEPRINT_CREATIVE_FACTORY_ENABLED=0|1",
      "BLUEPRINT_BUYER_LIFECYCLE_ENABLED=0|1",
    ],
  },
  {
    label: "Post-signup Google auth",
    ok:
      hasAny(
        "GOOGLE_CLIENT_EMAIL",
        "GOOGLE_PRIVATE_KEY",
        "FIREBASE_SERVICE_ACCOUNT_JSON",
        "GOOGLE_APPLICATION_CREDENTIALS",
      )
      && Boolean(envValue("GOOGLE_CALENDAR_ID"))
      && Boolean(envValue("POST_SIGNUP_SPREADSHEET_ID", "SPREADSHEET_ID")),
    required: [
      "GOOGLE_CALENDAR_ID",
      "POST_SIGNUP_SPREADSHEET_ID | SPREADSHEET_ID",
      "(GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY) | FIREBASE_SERVICE_ACCOUNT_JSON | GOOGLE_APPLICATION_CREDENTIALS",
    ],
  },
  {
    label: "Slack notifications",
    ok: Boolean(envValue("SLACK_WEBHOOK_URL")),
    required: ["SLACK_WEBHOOK_URL"],
  },
  {
    label: "Email delivery",
    ok: getEmailTransportStatus(),
    required: [
      "RESEND_API_KEY + RESEND_FROM_EMAIL",
    ],
  },
  {
    label: "Research outbound prerequisites",
    ok:
      Boolean(envValue("FIREHOSE_API_TOKEN"))
      && Boolean(envValue("FIREHOSE_BASE_URL"))
      && Boolean(envValue("BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS")),
    required: [
      "FIREHOSE_API_TOKEN",
      "FIREHOSE_BASE_URL",
      "BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS",
    ],
  },
];

const recommendedChecks = [
  {
    // Anonymous intake and uploads cost money. The durable daily caps have safe
    // code defaults; App Check is the part that needs a human rollout
    // (docs/runbooks/beta-monitoring.md), so it is tracked here until enforced.
    label: "App Check enforced on anonymous intake and uploads",
    ok: envValue("BLUEPRINT_APP_CHECK_MODE").toLowerCase() === "enforce"
      && Boolean(envValue("VITE_FIREBASE_APPCHECK_SITE_KEY")),
    required: ["BLUEPRINT_APP_CHECK_MODE=enforce", "VITE_FIREBASE_APPCHECK_SITE_KEY"],
  },
  {
    label: "Redis live session state",
    ok: Boolean(envValue("REDIS_URL")),
    required: ["REDIS_URL"],
  },
  {
    label: "Web voice concierge",
    ok: Boolean(envValue("ELEVENLABS_API_KEY")) && Boolean(envValue("ELEVENLABS_VOICE_ID")),
    required: ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"],
  },
  {
    label: "PSTN voice intake",
    ok:
      Boolean(envValue("TWILIO_ACCOUNT_SID"))
      && Boolean(envValue("TWILIO_AUTH_TOKEN"))
      && Boolean(envValue("TWILIO_PHONE_NUMBER")),
    required: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
  },
];

function configuredProviderKeys() {
  return [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "ACP_HARNESS_URL",
    "ELEVENLABS_API_KEY",
    "TWILIO_ACCOUNT_SID",
    "HIGGSFIELD_API_KEY",
  ].filter((key) => Boolean(envValue(key)));
}

function buildNeedsHumanChecks() {
  const needsHuman = [];
  const senderEmail = envValue("BLUEPRINT_CITY_LAUNCH_FROM_EMAIL", "RESEND_FROM_EMAIL");
  const senderVerification = envValue("BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION").toLowerCase();
  if (senderEmail && senderVerification !== "verified") {
    needsHuman.push({
      label: "City-launch sender verification",
      detail:
        "Sender env is present, but local env cannot prove provider-side domain/sender verification. Confirm in the mail provider and set BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified.",
    });
  }

  // Settings of providers the website no longer uses (DeepSeek, Z.ai,
  // OpenRouter), by name only: the website treats each as not set, so they
  // belong deleted from the hosting settings. A base URL that sends a kept
  // provider's calls to another host is listed with them.
  const leftOverKeys = listRemovedProviderSettingNames();
  const anthropicBaseUrl = envValue("ANTHROPIC_BASE_URL");
  if (anthropicBaseUrl) {
    let ownHost = false;
    try {
      const parsed = new URL(anthropicBaseUrl);
      ownHost = parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "api.anthropic.com";
    } catch {
      ownHost = false;
    }
    if (!ownHost) leftOverKeys.push("ANTHROPIC_BASE_URL");
  }
  if (openAiBaseUrlNamesAnotherHost()) leftOverKeys.push("OPENAI_BASE_URL");
  if (leftOverKeys.length > 0) {
    needsHuman.push({
      label: "Settings of removed providers",
      detail:
        `Settings for providers that are no longer used, or that send a kept provider's calls to another host, are still set (${leftOverKeys.join(", ")}). The website treats each as not set and sends nothing on them; delete them from the hosting settings.`,
    });
  }
  if (envValue("OPENAI_API_KEY") && openAiBaseUrlNamesAnotherHost()) {
    needsHuman.push({
      label: "OpenAI not configured",
      detail: "OPENAI_BASE_URL names a host other than OpenAI's own (openai_base_url_names_another_host): no OpenAI client is built and nothing is sent.",
    });
  }

  const providerKeys = configuredProviderKeys();
  if (providerKeys.length > 0) {
    needsHuman.push({
      label: "Provider billing/OAuth/live-call verification",
      detail:
        `Configured provider env detected (${providerKeys.join(", ")}). This local audit does not call paid providers; verify account, billing, OAuth, and quota state in the owning provider before claiming Operational Launch Ready.`,
    });
  }

  return needsHuman;
}

function renderChecklistRows(rows) {
  if (rows.length === 0) {
    console.log("- none");
    return;
  }
  for (const row of rows) {
    console.log(`- ${row.label}`);
    if (row.required?.length) {
      console.log(`  Env: ${row.required.join(", ")}`);
    }
    if (row.detail) {
      console.log(`  Detail: ${row.detail}`);
    }
  }
}

function main() {
  const { envFile, requireReady } = parseArgs(process.argv.slice(2));

  if (envFile) {
    const loadedCount = loadEnvFileIntoProcess(envFile);
    console.log(`Loaded ${loadedCount} env vars from ${envFile}`);
    console.log("");
  }

  const requiredReady = checks.filter((check) => check.ok);
  const blockedByEnv = checks.filter((check) => !check.ok);
  const recommendedMissing = recommendedChecks.filter((check) => !check.ok);
  const needsHuman = buildNeedsHumanChecks();

  console.log("Autonomous alpha env audit");
  console.log("Operator provider readiness report");
  console.log("");
  console.log("Scope: local env/config inspection only. This report does not configure providers, call paid APIs, deploy, send, or mutate live systems.");
  console.log("");
  console.log("Required-ready");
  renderChecklistRows(requiredReady);
  console.log("");
  console.log("Blocked-by-env");
  renderChecklistRows(blockedByEnv);
  console.log("");
  console.log("Recommended-missing");
  renderChecklistRows(recommendedMissing);
  console.log("");
  console.log("Needs-human");
  renderChecklistRows(needsHuman);

  if (requireReady && blockedByEnv.length > 0) {
    console.log("");
    console.log("Hard gate: failing because required runtime readiness is blocked by local env.");
    process.exit(1);
  }

  process.exit(0);
}

try {
  main();
} catch (error) {
  usage();
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
