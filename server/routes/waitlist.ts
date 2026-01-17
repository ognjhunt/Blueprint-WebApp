import { Request, Response } from "express";
import { sendEmail } from "../utils/email";
import { isValidEmailAddress } from "../utils/validation";

export default async function waitlistHandler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, locationType } = req.body ?? {};

  if (!email || !locationType) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const emailValue = typeof email === "string" ? email.trim() : "";
  if (!emailValue || !isValidEmailAddress(emailValue)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const to = process.env.WAITLIST_TO ?? "ops@tryblueprint.io";
  const subject = "New on-site capture waitlist submission";
  const text = `Email: ${emailValue}\nLocation type: ${locationType}`;

  const { sent } = await sendEmail({ to, subject, text });

  return res.status(sent ? 200 : 202).json({ success: true, sent });
}
