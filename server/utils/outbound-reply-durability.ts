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
  blockerPackets: OutboundReplyDurabilityBlockerPacket[];
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

export type OutboundReplyDurabilityBlockerPacket = {
  blockerId: string;
  title: string;
  owner: string;
  exactAsk: string;
  requiredInputs: string[];
  safeProofCommand: string;
  retryCondition: string;
  disallowedWorkaround: string;
  resumeTarget: string;
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
  const blockerPackets: OutboundReplyDurabilityBlockerPacket[] = [];

  function addBlockerPacket(packet: OutboundReplyDurabilityBlockerPacket) {
    if (!blockerPackets.some((entry) => entry.blockerId === packet.blockerId)) {
      blockerPackets.push(packet);
    }
  }

  const safeAuditCommand = "npm run human-replies:audit-durability -- --allow-not-ready";

  blockers.push(...sender.blockers);
  warnings.push(...sender.warnings);

  if (!sender.transport.configured) {
    addBlockerPacket({
      blockerId: "human-blocker:email-transport-config",
      title: "Email transport is not configured",
      owner: "blueprint-chief-of-staff",
      exactAsk:
        "Configure the production mail transport by providing either SendGrid credentials or SMTP credentials plus an approved Blueprint from address.",
      requiredInputs: [
        "SENDGRID_API_KEY or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS",
        "SENDGRID_FROM_EMAIL or BLUEPRINT_CITY_LAUNCH_FROM_EMAIL",
      ],
      safeProofCommand: safeAuditCommand,
      retryCondition:
        "Rerun the safe audit after the live environment contains a configured mail transport and approved from address.",
      disallowedWorkaround:
        "Do not log emails, use personal Gmail, use hlfabhunt@gmail.com, or mark dispatch durable without a configured provider.",
      resumeTarget: "webapp-codex reruns the durability audit before any live blocker or city-launch send proof.",
    });
  }

  if (!sender.sender.fromEmail) {
    addBlockerPacket({
      blockerId: "human-blocker:city-launch-from-email",
      title: "City-launch sender address is missing",
      owner: "blueprint-chief-of-staff",
      exactAsk:
        "Set the approved outbound sender address for city-launch and human-blocker mail.",
      requiredInputs: ["BLUEPRINT_CITY_LAUNCH_FROM_EMAIL or SENDGRID_FROM_EMAIL"],
      safeProofCommand: safeAuditCommand,
      retryCondition:
        "Rerun the safe audit after the live environment resolves a non-empty sender address.",
      disallowedWorkaround:
        "Do not borrow an unapproved mailbox, infer a sender from reply-to, or use hlfabhunt@gmail.com.",
      resumeTarget: "webapp-codex reruns sender durability checks before live dispatch.",
    });
  }

  if (sender.sender.verificationStatus !== "verified") {
    blockers.push(
      "City-launch sender/domain verification is not production-proven. Confirm the active mail provider and set BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified.",
    );
    addMissing(missingEnv, "BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified");
    addBlockerPacket({
      blockerId: "human-blocker:city-launch-sender-verification",
      title: "City-launch sender/domain verification is not production-proven",
      owner: "blueprint-chief-of-staff",
      exactAsk:
        "Confirm the active provider sender/domain is verified, then set BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified in the live WebApp environment.",
      requiredInputs: [
        "Provider-side sender or domain verification for the active from address",
        "BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified",
      ],
      safeProofCommand: safeAuditCommand,
      retryCondition:
        "Rerun the safe audit after the provider verification is complete and the live env has the verified flag.",
      disallowedWorkaround:
        "Do not treat configured SendGrid/SMTP credentials, Slack updates, dry-run sends, or first-send approvals as sender/domain proof.",
      resumeTarget: "city-launch send and human-blocker send paths may resume only after durability status is ready.",
    });
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
    addBlockerPacket({
      blockerId: "human-blocker:reply-ingest-token",
      title: "Human-reply ingest token is missing",
      owner: "blueprint-chief-of-staff",
      exactAsk:
        "Set BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN in the live WebApp environment and in any Paperclip host path that posts replies to WebApp.",
      requiredInputs: ["BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN"],
      safeProofCommand: safeAuditCommand,
      retryCondition:
        "Rerun the safe audit after the token exists in the live WebApp/Paperclip integration environment.",
      disallowedWorkaround:
        "Do not accept unauthenticated reply ingestion, Notion comments, Slack-only notes, or chat memory as durable reply proof.",
      resumeTarget: "human-reply watcher and internal reply ingest routes can be verified after the token is present.",
    });
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
    addBlockerPacket({
      blockerId: "human-blocker:approved-reply-identity",
      title: "Approved human-reply identity is implicit",
      owner: "blueprint-chief-of-staff",
      exactAsk:
        `Set BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=${APPROVED_HUMAN_REPLY_EMAIL} in the live environment so reply routing is explicit.`,
      requiredInputs: [`BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=${APPROVED_HUMAN_REPLY_EMAIL}`],
      safeProofCommand: safeAuditCommand,
      retryCondition:
        "Rerun the safe audit after the live env explicitly names the approved mailbox.",
      disallowedWorkaround:
        `Do not rely on code defaults, alternate Gmail connectors, Slack mirrors, or ${DISALLOWED_HUMAN_REPLY_EMAIL}.`,
      resumeTarget: "Gmail OAuth and reply watcher checks can be interpreted only after the approved identity is explicit.",
    });
  } else if (!approvedIdentityMatchesDefault) {
    blockers.push(
      `Human-reply approved identity must be ${APPROVED_HUMAN_REPLY_EMAIL}; current value is ${approvedIdentity}.`,
    );
    addMissing(missingEnv, `BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=${APPROVED_HUMAN_REPLY_EMAIL}`);
    addBlockerPacket({
      blockerId: "human-blocker:approved-reply-identity-mismatch",
      title: "Approved human-reply identity is wrong",
      owner: "blueprint-chief-of-staff",
      exactAsk:
        `Replace BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=${approvedIdentity} with ${APPROVED_HUMAN_REPLY_EMAIL}.`,
      requiredInputs: [`BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=${APPROVED_HUMAN_REPLY_EMAIL}`],
      safeProofCommand: safeAuditCommand,
      retryCondition:
        "Rerun the safe audit after the approved identity matches the founder inbox address.",
      disallowedWorkaround:
        `Do not route org-facing replies through ${DISALLOWED_HUMAN_REPLY_EMAIL}, personal inboxes, or unapproved mailbox aliases.`,
      resumeTarget: "human-reply watcher can resume only after the approved identity matches the canonical mailbox.",
    });
  }
  if (approvedIdentity.toLowerCase() === DISALLOWED_HUMAN_REPLY_EMAIL.toLowerCase()) {
    blockers.push(`${DISALLOWED_HUMAN_REPLY_EMAIL} is disallowed for org-facing reply routing.`);
    addBlockerPacket({
      blockerId: "human-blocker:disallowed-reply-identity",
      title: "Disallowed human-reply identity configured",
      owner: "blueprint-chief-of-staff",
      exactAsk:
        `Remove ${DISALLOWED_HUMAN_REPLY_EMAIL} from org-facing routing and set BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=${APPROVED_HUMAN_REPLY_EMAIL}.`,
      requiredInputs: [`BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=${APPROVED_HUMAN_REPLY_EMAIL}`],
      safeProofCommand: safeAuditCommand,
      retryCondition:
        "Rerun the safe audit after no live reply/sender path references the disallowed identity.",
      disallowedWorkaround:
        `Never draft from, send from, reply from, poll, or escalate org-facing blockers through ${DISALLOWED_HUMAN_REPLY_EMAIL}.`,
      resumeTarget: "all human-blocker send and reply watcher paths remain blocked until the disallowed identity is removed.",
    });
  }

  const watcherEnabled = isTruthyEnvValue(process.env.BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED);
  if (!watcherEnabled) {
    blockers.push("Gmail human-reply watcher is not enabled for the production scheduler.");
    addMissing(missingEnv, "BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED=1");
    addBlockerPacket({
      blockerId: "human-blocker:gmail-watcher-scheduler",
      title: "Gmail human-reply watcher is disabled",
      owner: "blueprint-chief-of-staff",
      exactAsk:
        "Set BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED=1 in the production scheduler environment.",
      requiredInputs: ["BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED=1"],
      safeProofCommand: safeAuditCommand,
      retryCondition:
        "Rerun the safe audit after the scheduler env enables the Gmail watcher.",
      disallowedWorkaround:
        "Do not manually read Gmail, depend on Slack-only mirrors, or claim resume durability from outbound dispatch records.",
      resumeTarget: "production reply polling can resume only after the scheduler gate is enabled.",
    });
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
    addBlockerPacket({
      blockerId: `human-blocker:gmail-oauth-${gmail.risk || "not-ready"}`,
      title: "Gmail OAuth is not production-ready for reply resume",
      owner: "blueprint-chief-of-staff",
      exactAsk:
        gmail.risk === "wrong_mailbox"
          ? `Bind the Gmail OAuth refresh token to ${APPROVED_HUMAN_REPLY_EMAIL}, not ${gmail.mailbox_email || "the current mailbox"}.`
          : "Provide production Gmail OAuth credentials for the approved founder inbox and mark the OAuth app production-ready.",
      requiredInputs: [
        "BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID",
        "BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET",
        "BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN for ohstnhunt@gmail.com",
        "BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS=production",
      ],
      safeProofCommand: safeAuditCommand,
      retryCondition:
        "Rerun the safe audit after OAuth credentials resolve the mailbox as ohstnhunt@gmail.com and the publishing status is production.",
      disallowedWorkaround:
        `Do not poll ${DISALLOWED_HUMAN_REPLY_EMAIL}, use browser cookies, scrape Gmail, or treat outbound email delivery as proof that replies can resume agents.`,
      resumeTarget: "run human-replies:poll or prove-production only after the safe audit reports ready.",
    });
  }

  return {
    ok: blockers.length === 0,
    status: blockers.length === 0 ? "ready" : "blocked",
    generatedAt: new Date().toISOString(),
    blockers,
    warnings,
    missingEnv,
    blockerPackets,
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
