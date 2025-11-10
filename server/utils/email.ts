import nodemailer from "nodemailer";
import { logger } from "../logger";

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
}

let cachedTransporter: nodemailer.Transporter | null = null;

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

export async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
  attachments,
}: SendEmailOptions) {
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
