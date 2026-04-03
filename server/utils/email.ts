import nodemailer from "nodemailer";
import { logger } from "../logger";

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  sendGridCategories?: string[];
  sendGridCustomArgs?: Record<string, string>;
  attachments?: nodemailer.SendMailOptions["attachments"];
}

let cachedTransporter: nodemailer.Transporter | null = null;

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

async function sendViaSendGrid({
  to,
  subject,
  text,
  html,
  replyTo,
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
          email: config.fromEmail,
          name: config.fromName,
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
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "Blueprint <ohstnhunt@gmail.com>",
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
