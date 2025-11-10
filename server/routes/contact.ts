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
    jobTitle,
    country,
    requestType,
    datasetTier,
    datasetNotes,
    sceneCategory,
    sceneInteractions,
    sceneQuantity,
    sceneDeliveryDate,
    isaacVersion,
    useCases,
    robotPlatform,
    requiredSemantics,
    exclusivityNeeds,
    budgetRange,
    deadline,
    message,
    targetPolicies,
    desiredCategories,
    projectType,
    engagementScope,
    deliveryFormat,
    integrationContext,
    interactables,
    emailOptIn,
  } = req.body ?? {};

  if (!name || !email || !company || !jobTitle || !country) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const useCaseList = Array.isArray(useCases)
    ? useCases
    : useCases
    ? [useCases]
    : [];
  const interactionList = Array.isArray(sceneInteractions)
    ? sceneInteractions
    : sceneInteractions
    ? [sceneInteractions]
    : [];
  const policies = Array.isArray(targetPolicies)
    ? targetPolicies
    : targetPolicies
    ? [targetPolicies]
    : [];
  const categories = Array.isArray(desiredCategories)
    ? desiredCategories
    : desiredCategories
    ? [desiredCategories]
    : [];

  const requesterName = String(name);
  const summaryLines = [
    `Name: ${requesterName}`,
    `Email: ${email}`,
    `Company: ${company}`,
    `Job title: ${jobTitle}`,
    `Country: ${country}`,
  ];

  if (requestType) {
    summaryLines.push(
      `Request type: ${requestType === "scene" ? "Specific scene" : "Dataset program"}`,
    );
  }

  if (requestType === "dataset") {
    summaryLines.push(`Dataset tier: ${datasetTier ?? ""}`);
    if (datasetNotes) {
      summaryLines.push(`Dataset notes: ${datasetNotes}`);
    }
  }

  if (requestType === "scene") {
    summaryLines.push(`Scene category: ${sceneCategory ?? ""}`);
    if (interactionList.length > 0) {
      summaryLines.push(`Interactions: ${interactionList.join(", ")}`);
    }
    if (sceneQuantity) {
      summaryLines.push(`Quantity: ${sceneQuantity}`);
    }
    if (sceneDeliveryDate) {
      summaryLines.push(`Delivery date: ${sceneDeliveryDate}`);
    }
    if (isaacVersion) {
      summaryLines.push(`Isaac version: ${isaacVersion}`);
    }
  }

  if (useCaseList.length > 0) {
    summaryLines.push(`Use case: ${useCaseList.join(", ")}`);
  }

  if (robotPlatform) {
    summaryLines.push(`Robot platform: ${robotPlatform}`);
  }

  if (requiredSemantics) {
    summaryLines.push(`Required semantics: ${requiredSemantics}`);
  }

  if (exclusivityNeeds) {
    summaryLines.push(`Exclusivity needs: ${exclusivityNeeds}`);
  }

  if (categories.length > 0) {
    summaryLines.push(`Desired categories: ${categories.join(", ")}`);
  }

  if (policies.length > 0) {
    summaryLines.push(`Target policies: ${policies.join(", ")}`);
  }

  if (projectType) {
    summaryLines.push(`Project type: ${projectType}`);
  }

  if (engagementScope) {
    summaryLines.push(`Engagement scope: ${engagementScope}`);
  }

  if (integrationContext) {
    summaryLines.push(`Integration context: ${integrationContext}`);
  }

  if (interactables) {
    summaryLines.push(`Interactables: ${interactables}`);
  }

  const budgetValue = budgetRange ?? req.body?.budget ?? "";
  if (budgetValue) {
    summaryLines.push(`Budget: ${budgetValue}`);
  }

  if (deadline) {
    summaryLines.push(`Deadline: ${deadline}`);
  }

  if (deliveryFormat) {
    summaryLines.push(`Delivery format: ${deliveryFormat}`);
  }

  if (emailOptIn) {
    summaryLines.push(`Email opt-in: ${emailOptIn}`);
  }

  if (message) {
    summaryLines.push(`Message: ${message}`);
  }

  summaryLines.push("Calendly link: https://calendly.com/blueprintar/30min");

  const to = process.env.CONTACT_TO ?? "ops@tryblueprint.io";
  const subject = `Blueprint request from ${company}`;
  const summary = summaryLines.join("\n");

  const { sent } = await sendEmail({ to, subject, text: summary, replyTo: email });

  if (email) {
    const confirmationSubject = "Thanks for requesting a Blueprint walkthrough";
    const firstName = requesterName.split(" ")[0] || requesterName;
    const confirmationLines = [
      `Hi ${firstName},`,
      "",
      "Thanks for sharing what you’re building. We’ll review the details you submitted and reach out to schedule a 30-minute walkthrough tailored to your use case.",
      "",
      "If you’d like to grab time right away, you can pick a slot here:",
      "https://calendly.com/blueprintar/30min",
      "",
      "Talk soon,",
      "Team Blueprint",
    ];

    await sendEmail({
      to: email,
      subject: confirmationSubject,
      text: confirmationLines.join("\n"),
      replyTo: "hello@tryblueprint.io",
    });
  }

  return res.status(sent ? 200 : 202).json({ success: true, sent });
}