const truthyValues = new Set(["1", "true", "yes", "on"]);

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

function requireCheck(ok, message) {
  if (!ok) {
    failures.push(message);
  }
}

function warnCheck(ok, message) {
  if (!ok) {
    warnings.push(message);
  }
}

const firebaseAdminReady = Boolean(
  envValue("FIREBASE_SERVICE_ACCOUNT_JSON", "GOOGLE_APPLICATION_CREDENTIALS")
  || envValue("K_SERVICE", "FUNCTION_TARGET", "GOOGLE_CLOUD_PROJECT"),
);

requireCheck(
  firebaseAdminReady,
  "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS, or run on Cloud Run/Functions with an attached service account.",
);

requireCheck(Boolean(envValue("OPENCLAW_BASE_URL")), "OPENCLAW_BASE_URL is required for alpha launch.");
requireCheck(Boolean(envValue("OPENCLAW_AUTH_TOKEN")), "OPENCLAW_AUTH_TOKEN is required for alpha launch.");
requireCheck(
  Boolean(envValue("OPENCLAW_DEFAULT_MODEL")),
  "OPENCLAW_DEFAULT_MODEL should be set explicitly for alpha launch.",
);

requireCheck(Boolean(envValue("STRIPE_SECRET_KEY")), "STRIPE_SECRET_KEY is required for checkout.");
requireCheck(
  Boolean(envValue("STRIPE_CONNECT_ACCOUNT_ID")),
  "STRIPE_CONNECT_ACCOUNT_ID is required for creator payout and onboarding flows.",
);
requireCheck(
  Boolean(envValue("STRIPE_WEBHOOK_SECRET")),
  "STRIPE_WEBHOOK_SECRET is required for webhook validation.",
);
requireCheck(
  Boolean(envValue("CHECKOUT_ALLOWED_ORIGINS")),
  "CHECKOUT_ALLOWED_ORIGINS is required for alpha checkout launch.",
);

const automationFlags = {
  BLUEPRINT_WAITLIST_AUTOMATION_ENABLED: isTruthy(process.env.BLUEPRINT_WAITLIST_AUTOMATION_ENABLED),
  BLUEPRINT_INBOUND_AUTOMATION_ENABLED: isTruthy(process.env.BLUEPRINT_INBOUND_AUTOMATION_ENABLED),
  BLUEPRINT_SUPPORT_TRIAGE_ENABLED: isTruthy(process.env.BLUEPRINT_SUPPORT_TRIAGE_ENABLED),
  BLUEPRINT_PAYOUT_TRIAGE_ENABLED: isTruthy(process.env.BLUEPRINT_PAYOUT_TRIAGE_ENABLED),
  BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED: isTruthy(process.env.BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED),
};

for (const [key, enabled] of Object.entries(automationFlags)) {
  requireCheck(enabled, `${key} must be enabled for the autonomous alpha launch configuration.`);
}

const googleAuthReady = Boolean(envValue("GOOGLE_CLIENT_EMAIL") && envValue("GOOGLE_PRIVATE_KEY"));
requireCheck(googleAuthReady, "GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY are required for post-signup automation.");
requireCheck(Boolean(envValue("GOOGLE_CALENDAR_ID")), "GOOGLE_CALENDAR_ID is required for post-signup calendar automation.");
requireCheck(
  Boolean(envValue("POST_SIGNUP_SPREADSHEET_ID", "SPREADSHEET_ID")),
  "POST_SIGNUP_SPREADSHEET_ID or SPREADSHEET_ID is required for post-signup sheet updates.",
);
requireCheck(Boolean(envValue("SLACK_WEBHOOK_URL")), "SLACK_WEBHOOK_URL is required for autonomous post-signup notifications.");

const smtpEnabled = Boolean(
  envValue("SMTP_HOST") || envValue("SMTP_PORT") || envValue("SMTP_USER") || envValue("SMTP_PASS"),
);
requireCheck(
  !smtpEnabled || Boolean(envValue("SMTP_HOST") && envValue("SMTP_PORT") && envValue("SMTP_USER") && envValue("SMTP_PASS")),
  "SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS must all be set when SMTP delivery is enabled.",
);
requireCheck(smtpEnabled, "SMTP delivery must be configured for autonomous post-signup email.");

warnCheck(Boolean(envValue("REDIS_URL")), "REDIS_URL is recommended for live hosted-session state.");
if (envValue("RATE_LIMIT_REDIS_URL")) {
  warnCheck(Boolean(envValue("REDIS_URL")), "RATE_LIMIT_REDIS_URL is set without REDIS_URL; confirm the split Redis setup is intentional.");
}

console.log("Alpha launch preflight");
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
