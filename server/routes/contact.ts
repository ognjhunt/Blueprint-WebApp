import { Request, Response } from "express";
import { sendEmail } from "../utils/email";

export default async function contactHandler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    name,
    email,
    company,
    projectType,
    targetPolicies,
    desiredCategories,
    deadline,
    budget,
    message,
    deliveryFormat,
    isaacVersion,
    interactables,
  } = req.body ?? {};

  if (!name || !email || !company) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const policies = Array.isArray(targetPolicies)
    ? targetPolicies.join(", ")
    : targetPolicies ?? "";
  const categories = Array.isArray(desiredCategories)
    ? desiredCategories.join(", ")
    : desiredCategories ?? "";

  const to = process.env.CONTACT_TO ?? "ops@tryblueprint.io";
  const subject = `Scene request from ${company}`;
  const summary = `Name: ${name}
Email: ${email}
Company: ${company}
Project type: ${projectType ?? ""}
Target policies: ${policies}
Desired categories: ${categories}
Deadline: ${deadline ?? ""}
Budget: ${budget ?? ""}
Delivery format: ${deliveryFormat ?? ""}
Isaac version: ${isaacVersion ?? ""}
Interactables: ${interactables ?? ""}
Message: ${message ?? ""}`;

  const { sent } = await sendEmail({ to, subject, text: summary });

  return res.status(sent ? 200 : 202).json({ success: true, sent });
}
