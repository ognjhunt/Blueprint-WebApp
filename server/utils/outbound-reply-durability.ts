import { getConfiguredEnvValue, isTruthyEnvValue } from "../config/env";
import { getCityLaunchSenderOperationalState } from "./email";
import { getHumanReplyGmailDurabilityStatus } from "./human-reply-gmail";
import {
  APPROVED_HUMAN_REPLY_EMAIL,
  DISALLOWED_HUMAN_REPLY_EMAIL,
} from "./human-reply-routing";

export type OutboundReplyDurabilityStatus = {
  ok: boolean;
  status: "ready" | "blocked";
  generatedAt: string;
  blockers: string[];
  warnings: string[];
  missingEnv: string[];
  sender: ReturnType<typeof getCityLaunchSenderOperationalState> & {
    productionProven: boolean;
  };
  humanReply: {
    ingestTokenConfigured: boolean;
    approvedIdentityConfigured: boolean;
    approvedIdentity: string;
    approvedIdentityMatchesDefault: boolean;
    watcherEnabled: boolean;
    gmail: Awaited<ReturnType<typeof getHumanReplyGmailDurabilityStatus>>;
  };
  proofCommands: string[];
};

function configured(key: string) {
  return Boolean(getConfiguredEnvValue(key));
}

function addMissing(target: string[], ...keys: string[]) {
  for (const key of keys) {
    if (!target.includes(key)) {
      target.push(key);
    }
  }
}

function envValue(key: string) {
  return getConfiguredEnvValue(key) || "";
}

export async function buildOutboundReplyDurabilityStatus(): Promise<OutboundReplyDurabilityStatus> {
  const sender = getCityLaunchSenderOperationalState();
  const gmail = await getHumanReplyGmailDurabilityStatus();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const missingEnv: string[] = [];

  blockers.push(...sender.blockers);
  warnings.push(...sender.warnings);

  if (sender.sender.verificationStatus !== "verified") {
    blockers.push(
      "City-launch sender/domain verification is not production-proven. Confirm the active mail provider and set BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified.",
    );
    addMissing(missingEnv, "BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified");
  }

  if (!sender.transport.configured) {
    addMissing(
      missingEnv,
      "SENDGRID_API_KEY or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS",
      "SENDGRID_FROM_EMAIL or BLUEPRINT_CITY_LAUNCH_FROM_EMAIL",
    );
  } else if (!sender.sender.fromEmail) {
    addMissing(missingEnv, "SENDGRID_FROM_EMAIL or BLUEPRINT_CITY_LAUNCH_FROM_EMAIL");
  }

  const ingestTokenConfigured = configured("BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN");
  if (!ingestTokenConfigured) {
    blockers.push(
      "Human-reply ingest token is not configured, so internal blocker dispatch/reply intake cannot be treated as production durable.",
    );
    addMissing(missingEnv, "BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN");
  }

  const approvedIdentityConfigured = configured("BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL");
  const approvedIdentity = envValue("BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL")
    || APPROVED_HUMAN_REPLY_EMAIL;
  const approvedIdentityMatchesDefault =
    approvedIdentity.toLowerCase() === APPROVED_HUMAN_REPLY_EMAIL.toLowerCase();
  if (!approvedIdentityConfigured) {
    blockers.push(
      `Human-reply approved identity is relying on code default. Set BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=${APPROVED_HUMAN_REPLY_EMAIL} in the live env so production routing is explicit.`,
    );
    addMissing(missingEnv, `BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=${APPROVED_HUMAN_REPLY_EMAIL}`);
  } else if (!approvedIdentityMatchesDefault) {
    blockers.push(
      `Human-reply approved identity must be ${APPROVED_HUMAN_REPLY_EMAIL}; current value is ${approvedIdentity}.`,
    );
    addMissing(missingEnv, `BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=${APPROVED_HUMAN_REPLY_EMAIL}`);
  }
  if (approvedIdentity.toLowerCase() === DISALLOWED_HUMAN_REPLY_EMAIL.toLowerCase()) {
    blockers.push(`${DISALLOWED_HUMAN_REPLY_EMAIL} is disallowed for org-facing reply routing.`);
  }

  const watcherEnabled = isTruthyEnvValue(process.env.BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED);
  if (!watcherEnabled) {
    blockers.push("Gmail human-reply watcher is not enabled for the production scheduler.");
    addMissing(missingEnv, "BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED=1");
  }

  if (!gmail.production_ready) {
    blockers.push(
      gmail.reason
      || "Gmail human-reply OAuth is not production-ready for durable reply resume.",
    );
    if (gmail.risk === "missing_config") {
      addMissing(
        missingEnv,
        "BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID",
        "BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET",
        "BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN",
      );
    }
    if (gmail.oauth_publishing_status !== "production") {
      addMissing(missingEnv, "BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS=production");
    }
  }

  return {
    ok: blockers.length === 0,
    status: blockers.length === 0 ? "ready" : "blocked",
    generatedAt: new Date().toISOString(),
    blockers,
    warnings,
    missingEnv,
    sender: {
      ...sender,
      productionProven:
        sender.capability === "ready"
        && sender.sender.verificationStatus === "verified",
    },
    humanReply: {
      ingestTokenConfigured,
      approvedIdentityConfigured,
      approvedIdentity,
      approvedIdentityMatchesDefault,
      watcherEnabled,
      gmail,
    },
    proofCommands: [
      "npm run human-replies:audit-durability",
      "npm run human-replies:send-test-blocker",
      "Reply to the tagged test email from ohstnhunt@gmail.com",
      "npm run human-replies:prove-production -- --require-processed-reply",
    ],
  };
}
