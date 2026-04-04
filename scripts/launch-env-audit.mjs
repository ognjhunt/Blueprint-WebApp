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
      "  npm run alpha:env -- .env.example",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  let envFile = null;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      return { help: true, envFile: null };
    }

    if (!arg.startsWith("-") && !envFile) {
      envFile = path.resolve(process.cwd(), arg);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { help: false, envFile };
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

function printChecks(title, checks) {
  console.log(title);
  for (const check of checks) {
    console.log(`- [${check.ok ? "x" : " "}] ${check.label}`);
    if (!check.ok) {
      console.log(`  Missing: ${check.required.join(", ")}`);
    }
  }
}

function main() {
  const { help, envFile } = parseArgs(process.argv.slice(2));

  if (help) {
    usage();
    process.exit(0);
  }

  if (envFile) {
    const loadedCount = loadEnvFileIntoProcess(envFile);
    console.log(`Loaded ${loadedCount} env vars from ${envFile}`);
    console.log("");
  }

  const requiredChecks = [
    {
      label: "Firebase Admin configured",
      ok: hasAny("FIREBASE_SERVICE_ACCOUNT_JSON", "GOOGLE_APPLICATION_CREDENTIALS"),
      required: ["FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS"],
    },
    {
      label: "OpenAI agent runtime configured",
      ok: Boolean(envValue("OPENAI_API_KEY")),
      required: ["OPENAI_API_KEY"],
    },
    {
      label: "Browser analytics configured",
      ok:
        Boolean(envValue("VITE_GA_MEASUREMENT_ID"))
        && Boolean(envValue("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN"))
        && Boolean(envValue("VITE_PUBLIC_POSTHOG_HOST")),
      required: [
        "VITE_GA_MEASUREMENT_ID",
        "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN",
        "VITE_PUBLIC_POSTHOG_HOST",
      ],
    },
    {
      label: "Stripe configured",
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
      label: "Alpha automation flags enabled",
      ok: [
        "BLUEPRINT_WAITLIST_AUTOMATION_ENABLED",
        "BLUEPRINT_INBOUND_AUTOMATION_ENABLED",
        "BLUEPRINT_SUPPORT_TRIAGE_ENABLED",
        "BLUEPRINT_PAYOUT_TRIAGE_ENABLED",
        "BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED",
      ].every((key) => isTruthy(process.env[key])),
      required: [
        "BLUEPRINT_WAITLIST_AUTOMATION_ENABLED=1",
        "BLUEPRINT_INBOUND_AUTOMATION_ENABLED=1",
        "BLUEPRINT_SUPPORT_TRIAGE_ENABLED=1",
        "BLUEPRINT_PAYOUT_TRIAGE_ENABLED=1",
        "BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED=1",
      ],
    },
    {
      label: "Post-signup Google auth configured",
      ok:
        Boolean(
          (envValue("GOOGLE_CLIENT_EMAIL") && envValue("GOOGLE_PRIVATE_KEY"))
          || envValue("FIREBASE_SERVICE_ACCOUNT_JSON", "GOOGLE_APPLICATION_CREDENTIALS"),
        )
        && Boolean(envValue("GOOGLE_CALENDAR_ID")),
      required: [
        "GOOGLE_CALENDAR_ID",
        "(GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY) | FIREBASE_SERVICE_ACCOUNT_JSON | GOOGLE_APPLICATION_CREDENTIALS",
      ],
    },
    {
      label: "Post-signup sheet configured",
      ok: Boolean(envValue("POST_SIGNUP_SPREADSHEET_ID", "SPREADSHEET_ID")),
      required: ["POST_SIGNUP_SPREADSHEET_ID or SPREADSHEET_ID"],
    },
    {
      label: "Slack notifications configured",
      ok: Boolean(envValue("SLACK_WEBHOOK_URL")),
      required: ["SLACK_WEBHOOK_URL"],
    },
    {
      label: "SMTP configured",
      ok:
        Boolean(envValue("SMTP_HOST"))
        && Boolean(envValue("SMTP_PORT"))
        && Boolean(envValue("SMTP_USER"))
        && Boolean(envValue("SMTP_PASS")),
      required: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"],
    },
  ];

  const recommendedChecks = [
    {
      label: "Redis configured",
      ok: Boolean(envValue("REDIS_URL")),
      required: ["REDIS_URL"],
    },
  ];

  console.log("Autonomous alpha env audit");
  console.log("");
  printChecks("Required", requiredChecks);
  console.log("");
  printChecks("Recommended", recommendedChecks);

  const missingRequired = requiredChecks.filter((check) => !check.ok).length;
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
