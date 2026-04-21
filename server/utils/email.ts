import nodemailer from "nodemailer";
import { logger } from "../logger";

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  fromEmail?: string;
  fromName?: string;
  sendGridCategories?: string[];
  sendGridCustomArgs?: Record<string, string>;
  attachments?: nodemailer.SendMailOptions["attachments"];
}

let cachedTransporter: nodemailer.Transporter | null = null;

export type CityLaunchSenderVerificationStatus =
  | "verified"
  | "unverified"
  | "unknown"
  | "unset";

export type CityLaunchSenderStatus = {
  fromEmail: string | null;
  fromName: string;
  replyTo: string | null;
  source: "blueprint_city_launch" | "sendgrid_default" | null;
  verificationStatus: CityLaunchSenderVerificationStatus;
};

export type CityLaunchSenderOperationalState = {
  capability: "ready" | "warning" | "blocked";
  transport: ReturnType<typeof getEmailTransportStatus>;
  sender: CityLaunchSenderStatus;
  blockers: string[];
  warnings: string[];
};

function getSendGridConfig() {
  const apiKey = process.env.SENDGRID_API_KEY?.trim() || "";
  const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim() || "";
  const fromName = process.env.SENDGRID_FROM_NAME?.trim() || "Blueprint";

  return {
    enabled: Boolean(apiKey || fromEmail),
    configured: Boolean(apiKey && fromEmail),
    apiKey,
    fromEmail,
    fromName,
  };
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    logger.warn("SMTP environment variables are not fully configured.");
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user,
      pass,
    },
  });

  return cachedTransporter;
}

export function getEmailTransportStatus() {
  const sendGrid = getSendGridConfig();
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return {
    enabled: sendGrid.enabled || Boolean(host || port || user || pass),
    configured: sendGrid.configured || Boolean(host && port && user && pass),
    provider: sendGrid.configured ? "sendgrid" : host && port && user && pass ? "smtp" : null,
  };
}

export function getCityLaunchSenderStatus(): CityLaunchSenderStatus {
  const configuredCityFromEmail = process.env.BLUEPRINT_CITY_LAUNCH_FROM_EMAIL?.trim() || "";
  const sendGridDefaultFromEmail = process.env.SENDGRID_FROM_EMAIL?.trim() || "";
  const fromEmail = configuredCityFromEmail || sendGridDefaultFromEmail || null;
  const fromName =
    process.env.BLUEPRINT_CITY_LAUNCH_FROM_NAME?.trim()
    || process.env.SENDGRID_FROM_NAME?.trim()
    || "Blueprint City Launch";
  const replyTo =
    process.env.BLUEPRINT_CITY_LAUNCH_REPLY_TO?.trim()
    || process.env.BLUEPRINT_FOUNDER_EMAIL?.trim()
    || fromEmail;
  const verificationState = (process.env.BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION?.trim() || "")
    .toLowerCase();

  let verificationStatus: CityLaunchSenderVerificationStatus = "unset";
  if (verificationState === "verified") {
    verificationStatus = "verified";
  } else if (verificationState === "unverified") {
    verificationStatus = "unverified";
  } else if (fromEmail) {
    verificationStatus = "unknown";
  }

  return {
    fromEmail,
    fromName,
    replyTo: replyTo || null,
    source: configuredCityFromEmail
      ? "blueprint_city_launch"
      : sendGridDefaultFromEmail
        ? "sendgrid_default"
        : null,
    verificationStatus,
  };
}

export function getCityLaunchSenderOperationalState(): CityLaunchSenderOperationalState {
  const transport = getEmailTransportStatus();
  const sender = getCityLaunchSenderStatus();
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!transport.configured) {
    blockers.push("Email transport is not configured for real city-launch sends.");
  }

  if (!sender.fromEmail) {
    blockers.push(
      "City-launch sender email is not configured. Set BLUEPRINT_CITY_LAUNCH_FROM_EMAIL or SENDGRID_FROM_EMAIL.",
    );
  }

  if (sender.verificationStatus === "unverified") {
    blockers.push(
      `City-launch sender ${sender.fromEmail || "unknown"} is explicitly marked unverified in BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION.`,
    );
  } else if (sender.verificationStatus !== "verified") {
    warnings.push(
      "Sender verification cannot be proven programmatically from env state. Confirm the configured city-launch sender/domain is verified in the active mail provider before claiming outward launchability.",
    );
  }

  return {
    capability: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    transport,
    sender,
    blockers,
    warnings,
  };
}

async function sendViaSendGrid({
  to,
  subject,
  text,
  html,
  replyTo,
  fromEmail,
  fromName,
  sendGridCategories,
  sendGridCustomArgs,
  attachments,
}: SendEmailOptions) {
  const config = getSendGridConfig();
  if (!config.configured) {
    return { sent: false };
  }

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: {
          email: fromEmail || config.fromEmail,
          name: fromName || config.fromName,
        },
        reply_to: replyTo ? { email: replyTo } : undefined,
        subject,
        categories: sendGridCategories?.filter(Boolean) || undefined,
        custom_args:
          sendGridCustomArgs && Object.keys(sendGridCustomArgs).length > 0
            ? sendGridCustomArgs
            : undefined,
        content: [
          { type: "text/plain", value: text },
          ...(html ? [{ type: "text/html", value: html }] : []),
        ],
        attachments:
          attachments?.map((attachment) => ({
            content:
              typeof attachment.content === "string"
                ? attachment.content
                : Buffer.isBuffer(attachment.content)
                  ? attachment.content.toString("base64")
                  : "",
            filename: attachment.filename,
            type: attachment.contentType,
            disposition: attachment.contentDisposition ?? "attachment",
            content_id: attachment.cid,
          })) || undefined,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SendGrid returned ${response.status}: ${body}`);
    }

    logger.info({ to, subject, replyTo }, "Email dispatched via SendGrid");
    return { sent: true };
  } catch (error) {
    logger.error({ error, to, subject, replyTo }, "Failed to send email via SendGrid");
    return { sent: false, error };
  }
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
  fromEmail,
  fromName,
  sendGridCategories,
  sendGridCustomArgs,
  attachments,
}: SendEmailOptions) {
  const sendGridResult = await sendViaSendGrid({
    to,
    subject,
    text,
    html,
    replyTo,
    fromEmail,
    fromName,
    sendGridCategories,
    sendGridCustomArgs,
    attachments,
  });
  if (sendGridResult.sent) {
    return sendGridResult;
  }

  const transporter = getTransporter();

  if (!transporter) {
    logger.info({ to, subject, text, replyTo }, "Email transport not configured; logging message");
    return { sent: false };
  }

  try {
    const smtpFrom = process.env.SMTP_FROM?.trim() || fromEmail || "";
    await transporter.sendMail({
      from: smtpFrom
        ? fromName
          ? `${fromName} <${smtpFrom}>`
          : smtpFrom
        : undefined,
      to,
      subject,
      text,
      html,
      replyTo,
      attachments,
    });

    logger.info({ to, subject, replyTo }, "Email dispatched");
    return { sent: true };
  } catch (error) {
    logger.error({ error, to, subject, replyTo }, "Failed to send email");
    return { sent: false, error };
  }
}
