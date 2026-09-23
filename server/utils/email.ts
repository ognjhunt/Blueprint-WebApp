import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Resend, type Attachment, type Tag } from "resend";
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
  attachments?: Attachment[];
}

export type SendEmailResult = {
  sent: boolean;
  provider: "resend" | null;
  messageId: string | null;
  error?: unknown;
};

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
}: SendEmailOptions & { event: string; provider: "resend" | "none" }) {
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
    categoryCount: sendGridCategories?.length ?? 0,
    tagKeys: Object.keys(sendGridCustomArgs ?? {}).sort(),
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
  source: "blueprint_city_launch" | "resend_default" | null;
  verificationStatus: CityLaunchSenderVerificationStatus;
};

export type CityLaunchSenderOperationalState = {
  capability: "ready" | "warning" | "blocked";
  transport: ReturnType<typeof getEmailTransportStatus>;
  sender: CityLaunchSenderStatus;
  blockers: string[];
  warnings: string[];
};

function getResendApiKey() {
  const configured = process.env.RESEND_API_KEY?.trim();
  if (configured) return configured;

  const secretFile = process.env.RESEND_API_KEY_FILE?.trim()
    || (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test"
      ? join(homedir(), ".blueprint-secrets", "resend_api_key")
      : "");
  if (!secretFile) return "";
  try {
    return readFileSync(secretFile, "utf8").trim();
  } catch {
    return "";
  }
}

function getResendConfig() {
  const apiKey = getResendApiKey();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "";
  const fromName = process.env.RESEND_FROM_NAME?.trim() || "Blueprint";

  return {
    enabled: Boolean(apiKey || fromEmail),
    configured: Boolean(apiKey && fromEmail),
    apiKey,
    fromEmail,
    fromName,
  };
}

export function getEmailTransportStatus() {
  const resend = getResendConfig();

  return {
    enabled: resend.enabled,
    configured: resend.configured,
    provider: resend.configured ? "resend" : null,
  };
}

export function getCityLaunchSenderStatus(): CityLaunchSenderStatus {
  const configuredCityFromEmail = process.env.BLUEPRINT_CITY_LAUNCH_FROM_EMAIL?.trim() || "";
  const resendDefaultFromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "";
  const fromEmail = configuredCityFromEmail || resendDefaultFromEmail || null;
  const fromName =
    process.env.BLUEPRINT_CITY_LAUNCH_FROM_NAME?.trim()
    || process.env.RESEND_FROM_NAME?.trim()
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
      : resendDefaultFromEmail
        ? "resend_default"
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
      "City-launch sender email is not configured. Set BLUEPRINT_CITY_LAUNCH_FROM_EMAIL or RESEND_FROM_EMAIL.",
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

function resendTags(categories?: string[], customArgs?: Record<string, string>): Tag[] {
  const values = new Map<string, string>();
  if (categories?.length) values.set("category", categories[0]);
  for (const [name, value] of Object.entries(customArgs ?? {})) values.set(name, value);
  // Resend only accepts ASCII alphanumerics, underscores, and dashes in tags.
  // Do not silently alter correlation IDs: omit invalid tags and log their keys.
  const tags: Tag[] = [];
  for (const [name, value] of values) {
    if (/^[A-Za-z0-9_-]{1,256}$/.test(name) && /^[A-Za-z0-9_-]{1,256}$/.test(value)) {
      tags.push({ name, value });
    } else {
      logger.warn({ event: "email_tag_omitted", tagKey: name }, "Invalid Resend tag omitted");
    }
  }
  return tags;
}

async function sendViaResend({
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
  const config = getResendConfig();
  if (!config.configured) {
    return { sent: false, provider: null, messageId: null };
  }

  try {
    const resend = new Resend(config.apiKey);
    const { data, error } = await resend.emails.send({
      from: `${fromName || config.fromName} <${fromEmail || config.fromEmail}>`,
      to,
      replyTo,
      subject,
      text,
      html,
      attachments,
      tags: resendTags(sendGridCategories, sendGridCustomArgs),
    });
    if (error || !data?.id) {
      throw new Error(`Resend rejected email: ${error?.message || "missing email ID"}`);
    }

    logger.info(
      buildEmailLogContext({
        event: "email_dispatched",
        provider: "resend",
        to,
        subject,
        text,
        html,
        replyTo,
        attachments,
        sendGridCategories,
        sendGridCustomArgs,
      }),
      "Email accepted by Resend",
    );
    return {
      sent: true,
      provider: "resend",
      messageId: data.id,
    };
  } catch (error) {
    logger.error(
      {
        ...buildEmailLogContext({
          event: "email_dispatch_failed",
          provider: "resend",
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
      "Failed to send email via Resend",
    );
    return { sent: false, provider: "resend", messageId: null, error };
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

  if (!getEmailTransportStatus().configured) {
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

  return sendViaResend({
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
}
