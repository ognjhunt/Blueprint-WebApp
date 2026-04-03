import fs from "node:fs";
import path from "node:path";

const truthyValues = new Set(["1", "true", "yes", "on"]);

function usage() {
  console.error(
    [
      "Usage:",
      "  npm run alpha:env",
      "  npm run alpha:env -- <env-file>",
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

  for (const arg of argv) {
    if (!arg.startsWith("-") && !envFile) {
      envFile = path.resolve(process.cwd(), arg);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { envFile };
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
    ok: hasAny("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "ACP_HARNESS_URL"),
    required: ["OPENAI_API_KEY | ANTHROPIC_API_KEY | ACP_HARNESS_URL"],
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
  {
    label: "Creative factory prerequisites",
    ok:
      hasAny("GOOGLE_GENAI_API_KEY", "GEMINI_API_KEY")
      && Boolean(envValue("RUNWAY_API_KEY")),
    required: ["GOOGLE_GENAI_API_KEY | GEMINI_API_KEY", "RUNWAY_API_KEY"],
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

function main() {
  const { envFile } = parseArgs(process.argv.slice(2));

  if (envFile) {
    const loadedCount = loadEnvFileIntoProcess(envFile);
    console.log(`Loaded ${loadedCount} env vars from ${envFile}`);
    console.log("");
  }

console.log("Autonomous alpha env audit");
console.log("");
console.log("Required");
for (const check of checks) {
  console.log(`- [${check.ok ? "x" : " "}] ${check.label}`);
  if (!check.ok) {
    console.log(`  Missing: ${check.required.join(", ")}`);
  }
}

console.log("");
console.log("Recommended");
for (const check of recommendedChecks) {
  console.log(`- [${check.ok ? "x" : " "}] ${check.label}`);
  if (!check.ok) {
    console.log(`  Missing: ${check.required.join(", ")}`);
  }
}

const missingRequired = checks.filter((check) => !check.ok).length;
process.exit(missingRequired === 0 ? 0 : 1);
}

try {
  main();
} catch (error) {
  usage();
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
