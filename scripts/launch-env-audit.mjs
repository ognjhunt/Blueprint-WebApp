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

function isTruthy(value) {
  return truthyValues.has(String(value || "").trim().toLowerCase());
}

function hasAny(...keys) {
  return keys.some((key) => Boolean(envValue(key)));
}

function getEmailTransportStatus() {
  return Boolean(
    (envValue("SENDGRID_API_KEY") && envValue("SENDGRID_FROM_EMAIL"))
    || (envValue("SMTP_HOST") && envValue("SMTP_PORT") && envValue("SMTP_USER") && envValue("SMTP_PASS")),
  );
}

const checks = [
  {
    label: "Firebase Admin",
    ok: hasAny("FIREBASE_SERVICE_ACCOUNT_JSON", "GOOGLE_APPLICATION_CREDENTIALS"),
    required: ["FIREBASE_SERVICE_ACCOUNT_JSON | GOOGLE_APPLICATION_CREDENTIALS"],
  },
  {
    label: "Structured runtime provider",
    ok: hasAny("DEEPSEEK_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "ACP_HARNESS_URL"),
    required: ["DEEPSEEK_API_KEY | OPENAI_API_KEY | ANTHROPIC_API_KEY | ACP_HARNESS_URL"],
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
    label: "Autonomous alpha lane enables",
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
    ].every((key) => isTruthy(process.env[key])),
    required: [
      "BLUEPRINT_WAITLIST_AUTOMATION_ENABLED=1",
      "BLUEPRINT_INBOUND_AUTOMATION_ENABLED=1",
      "BLUEPRINT_SUPPORT_TRIAGE_ENABLED=1",
      "BLUEPRINT_PAYOUT_TRIAGE_ENABLED=1",
      "BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED=1",
      "BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED=1",
      "BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED=1",
      "BLUEPRINT_CREATIVE_FACTORY_ENABLED=1",
      "BLUEPRINT_BUYER_LIFECYCLE_ENABLED=1",
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
      "(SENDGRID_API_KEY + SENDGRID_FROM_EMAIL) | (SMTP_HOST + SMTP_PORT + SMTP_USER + SMTP_PASS)",
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
    "DEEPSEEK_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "ACP_HARNESS_URL",
    "OPENROUTER_API_KEY",
    "ELEVENLABS_API_KEY",
    "TWILIO_ACCOUNT_SID",
    "HIGGSFIELD_API_KEY",
  ].filter((key) => Boolean(envValue(key)));
}

function buildNeedsHumanChecks() {
  const needsHuman = [];
  const senderEmail = envValue("BLUEPRINT_CITY_LAUNCH_FROM_EMAIL", "SENDGRID_FROM_EMAIL");
  const senderVerification = envValue("BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION").toLowerCase();
  if (senderEmail && senderVerification !== "verified") {
    needsHuman.push({
      label: "City-launch sender verification",
      detail:
        "Sender env is present, but local env cannot prove provider-side domain/sender verification. Confirm in the mail provider and set BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified.",
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
