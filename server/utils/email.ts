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

export type SendEmailResult = {
  sent: boolean;
  provider: "sendgrid" | "smtp" | null;
  messageId: string | null;
  error?: unknown;
};

let cachedTransporter: nodemailer.Transporter | null = null;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function redactEmails(value: string) {
  return value.replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
}

function emailDomain(value?: string) {
  if (!value) {
    return null;
  }
  const match = value.match(EMAIL_PATTERN)?.[0];
  const domain = match?.split("@").pop()?.trim().toLowerCase();
  return domain || null;
}

function serializeEmailError(error: unknown) {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  return {
    name: errorObj.name,
    message: redactEmails(errorObj.message).slice(0, 500),
  };
}

function buildEmailLogContext({
  event,
  provider,
  to,
  subject,
  text,
  html,
  replyTo,
  attachments,
  sendGridCategories,
  sendGridCustomArgs,
}: SendEmailOptions & { event: string; provider: "sendgrid" | "smtp" | "none" }) {
  return {
    event,
    provider,
    recipientDomain: emailDomain(to),
    replyToDomain: emailDomain(replyTo),
    subjectLength: subject.length,
    textLength: text.length,
    htmlLength: html?.length ?? 0,
    hasText: text.length > 0,
    hasHtml: Boolean(html),
    attachmentCount: attachments?.length ?? 0,
    sendGridCategoryCount: sendGridCategories?.length ?? 0,
    sendGridCustomArgKeys: Object.keys(sendGridCustomArgs ?? {}).sort(),
  };
}

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
    logger.warn(
      { event: "email_smtp_config_unavailable", provider: "smtp" },
      "SMTP environment variables are not fully configured.",
    );
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
}: SendEmailOptions): Promise<SendEmailResult> {
  const config = getSendGridConfig();
  if (!config.configured) {
    return { sent: false, provider: null, messageId: null };
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

    logger.info(
      buildEmailLogContext({
        event: "email_dispatched",
        provider: "sendgrid",
        to,
        subject,
        text,
        html,
        replyTo,
        attachments,
        sendGridCategories,
        sendGridCustomArgs,
      }),
      "Email dispatched via SendGrid",
    );
    return {
      sent: true,
      provider: "sendgrid",
      messageId: response.headers.get("x-message-id"),
    };
  } catch (error) {
    logger.error(
      {
        ...buildEmailLogContext({
          event: "email_dispatch_failed",
          provider: "sendgrid",
          to,
          subject,
          text,
          html,
          replyTo,
          attachments,
          sendGridCategories,
          sendGridCustomArgs,
        }),
        err: serializeEmailError(error),
      },
      "Failed to send email via SendGrid",
    );
    return { sent: false, provider: "sendgrid", messageId: null, error };
  }
}

/** The longest a production redirect may be armed for. */
const MAX_TEST_REDIRECT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

type RedirectWindow =
  | { armed: true; expiresAt: string }
  | { armed: false; reason: string };

/**
 * Decide whether a production redirect is armed, and say why when it is not.
 *
 * Production is where the redirect is both most useful and most dangerous: it
 * is the only place the real pipeline runs, and it is the only place a forgotten
 * redirect silently swallows a real buyer's mail. So arming it there takes a
 * second variable that carries its own deadline.
 *
 * A deadline is a stronger guard than a second boolean would be. A flag depends
 * on someone remembering to unset it, and forgetting is the entire failure mode.
 * A window closes whether or not anyone remembers, and the 14-day ceiling stops
 * the obvious way around it — a date far enough out to be a flag again.
 */
function productionRedirectWindow(now: number): RedirectWindow {
  const raw = process.env.BLUEPRINT_EMAIL_TEST_REDIRECT_UNTIL?.trim();
  if (!raw) {
    return { armed: false, reason: "BLUEPRINT_EMAIL_TEST_REDIRECT_UNTIL is not set" };
  }

  const expiresAt = Date.parse(raw);
  if (Number.isNaN(expiresAt)) {
    return {
      armed: false,
      reason: `BLUEPRINT_EMAIL_TEST_REDIRECT_UNTIL is not a parseable timestamp (${raw})`,
    };
  }

  if (expiresAt <= now) {
    return {
      armed: false,
      reason: `the redirect window closed at ${new Date(expiresAt).toISOString()}`,
    };
  }

  if (expiresAt - now > MAX_TEST_REDIRECT_WINDOW_MS) {
    return {
      armed: false,
      reason: `the redirect window ends ${new Date(expiresAt).toISOString()}, more than 14 days out`,
    };
  }

  return { armed: true, expiresAt: new Date(expiresAt).toISOString() };
}

/**
 * Send everything to one inbox instead of to real people.
 *
 * For exercising a live pipeline end to end without mailing the leads in it.
 * `BLUEPRINT_EMAIL_TEST_REDIRECT=you@example.com` routes every outbound message
 * to that address, whatever the pipeline addressed it to, and stamps the
 * intended recipient into the subject so a full run is still legible in one
 * inbox.
 *
 * Deliberately a redirect rather than a suppression list: a filter that blocks
 * known-internal addresses still sends to everybody it does not recognise,
 * which is the wrong default when the thing being tested is who gets mail.
 *
 * Outside production the target address is enough. In production it must also
 * be armed with an expiry — see `productionRedirectWindow`. An unarmed redirect
 * does not hold mail back; it lets it through to its real recipients and says
 * so loudly, because sending is the system's job and the redirect is the
 * exception. Every send that is redirected in production logs at `warn`, so the
 * one condition under which real recipients are not being reached is visible in
 * a log scan rather than inferable only from an absence.
 */
export function resolveTestRedirect(to: string): { to: string; redirectedFrom?: string } {
  const target = process.env.BLUEPRINT_EMAIL_TEST_REDIRECT?.trim();
  if (!target) return { to };

  const isProduction = process.env.NODE_ENV === "production";
  let redirectWindow: RedirectWindow | null = null;

  if (isProduction) {
    redirectWindow = productionRedirectWindow(Date.now());
    if (!redirectWindow.armed) {
      logger.error(
        { event: "email_test_redirect_not_armed", reason: redirectWindow.reason },
        "BLUEPRINT_EMAIL_TEST_REDIRECT is set in production but not armed; mail is going to its real recipients",
      );
      return { to };
    }
  }

  if (target === to) return { to };

  const context = {
    event: "email_test_redirected",
    originalDomain: to.split("@").pop() ?? null,
  };

  if (redirectWindow?.armed) {
    logger.warn(
      { ...context, redirectExpiresAt: redirectWindow.expiresAt },
      "Outbound production email redirected to the test inbox",
    );
  } else {
    logger.info(context, "Outbound email redirected to the test inbox");
  }

  return { to: target, redirectedFrom: to };
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const redirect = resolveTestRedirect(options.to);
  const {
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
  } = redirect.redirectedFrom
    ? {
        ...options,
        to: redirect.to,
        // The intended recipient belongs where a tester will see it, not only
        // in a log line they would have to go looking for.
        subject: `[test → ${redirect.redirectedFrom}] ${options.subject}`,
      }
    : options;

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
    logger.info(
      buildEmailLogContext({
        event: "email_transport_unconfigured",
        provider: "none",
        to,
        subject,
        text,
        html,
        replyTo,
        attachments,
        sendGridCategories,
        sendGridCustomArgs,
      }),
      "Email transport not configured; message not sent",
    );
    return { sent: false, provider: null, messageId: null };
  }

  try {
    // Gmail, and most authenticated relays, reject or silently rewrite a From
    // that is not the authenticated mailbox. Falling back to the SMTP user is
    // both what those servers will accept and better than the alternative here,
    // which is a message with no From header at all.
    const smtpFrom =
      process.env.SMTP_FROM?.trim()
      || fromEmail
      || process.env.SMTP_USER?.trim()
      || "";
    const info = await transporter.sendMail({
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

    logger.info(
      buildEmailLogContext({
        event: "email_dispatched",
        provider: "smtp",
        to,
        subject,
        text,
        html,
        replyTo,
        attachments,
        sendGridCategories,
        sendGridCustomArgs,
      }),
      "Email dispatched",
    );
    return {
      sent: true,
      provider: "smtp",
      messageId: typeof info.messageId === "string" && info.messageId.trim()
        ? info.messageId.trim()
        : null,
    };
  } catch (error) {
    logger.error(
      {
        ...buildEmailLogContext({
          event: "email_dispatch_failed",
          provider: "smtp",
          to,
          subject,
          text,
          html,
          replyTo,
          attachments,
          sendGridCategories,
          sendGridCustomArgs,
        }),
        err: serializeEmailError(error),
      },
      "Failed to send email",
    );
    return { sent: false, provider: "smtp", messageId: null, error };
  }
}
