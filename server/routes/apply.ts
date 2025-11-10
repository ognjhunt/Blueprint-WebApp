import { Request, Response } from "express";
import { sendEmail } from "../utils/email";

export default async function applyHandler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, portfolio, notes, role, email, contactEmail } = req.body ?? {};

  if (!name || !portfolio || !role || !email || !contactEmail) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const to = typeof email === "string" && email.length ? email : "apply@tryblueprint.io";
  const subject = `Application for ${role}: ${name}`;
  const text = `Name: ${name}\nApplicant email: ${contactEmail}\nPortfolio: ${portfolio}\nNotes: ${notes ?? ""}`;

  const { sent } = await sendEmail({ to, subject, text });

  return res.status(sent ? 200 : 202).json({ success: true, sent });
}
