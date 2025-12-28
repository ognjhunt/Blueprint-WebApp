import { Request, Response } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
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
    recipeSlug,
    recipeTitle,
    recipePacks,
    recipeAssetRoots,
    recipeBrief,
    recipeVariants,
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
    const requestLabel =
      requestType === "scene"
        ? "Specific scene"
        : requestType === "dataset"
          ? "Dataset program"
          : requestType === "recipe"
            ? "Scene recipe"
            : "Reference photo rebuild";
    summaryLines.push(`Request type: ${requestLabel}`);
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

  if (requestType === "recipe") {
    if (recipeSlug) {
      summaryLines.push(`Recipe slug: ${recipeSlug}`);
    }
    if (recipeTitle) {
      summaryLines.push(`Recipe title: ${recipeTitle}`);
    }
    if (recipePacks) {
      summaryLines.push(`SimReady packs: ${recipePacks}`);
    }
    if (recipeAssetRoots) {
      summaryLines.push(`Asset roots: ${recipeAssetRoots}`);
    }
    if (recipeBrief) {
      summaryLines.push(`Layout + semantics: ${recipeBrief}`);
    }
    if (recipeVariants) {
      summaryLines.push(`Variant generator: ${recipeVariants}`);
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

  const requestSource =
    typeof req.body?.requestSource === "string"
      ? req.body.requestSource
      : "marketplace-wishlist";

  const logEntry = {
    requestSource,
    requesterName,
    email,
    company,
    jobTitle,
    country,
    requestType: req.body?.requestType ?? requestType ?? null,
    receivedAtIso: new Date().toISOString(),
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    summaryLines,
    summary,
    payload: req.body ?? {},
    headers: {
      userAgent: req.get("user-agent") ?? null,
      referer: req.get("referer") ?? req.get("referrer") ?? null,
      ip: req.ip ?? null,
    },
  };

  try {
    if (!db) {
      console.warn(
        "Firebase Admin SDK not initialized. Skipping contact submission logging.",
      );
    } else {
      await db
        .collection("ops")
        .doc("marketplaceWishlist")
        .collection("requests")
        .add(logEntry);
    }
  } catch (error: any) {
    console.error("Failed to log contact submission to Firestore:", error);
  }

  const { sent } = await sendEmail({ to, subject, text: summary, replyTo: email });

  if (email) {
    const confirmationSubject = "Thank You for Your Submission!";
    const firstName = requesterName.split(" ")[0] || requesterName;
    const confirmationText = [
      `Hi ${firstName},`,
      "",
      "Thank you for your interest in Blueprint. The team has received your request and will contact you if we determine our products are well-suited to meet your needs.",
      "",
      "In the meantime, please check out the following resources:",
      "- Blog: https://tryblueprint.io/blog",
      "- Technical Guides: https://tryblueprint.io/technical-guides",
      "- Upcoming Events: https://tryblueprint.io/events",
      "",
      "Best,",
      "The Blueprint Team",
      "",
      "Download the 2024 AI Readiness Report: https://tryblueprint.io/resources/reports/ai-readiness-report",
      "LinkedIn: https://www.linkedin.com/company/blueprintsim/",
      "X: https://twitter.com/try_blueprint",
      "YouTube: https://www.youtube.com/c/BlueprintAI",
      "",
      "Blueprint, 1005 Crete St, Durham, NC 27707",
    ].join("\n");

    const confirmationHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Thank You for Your Submission!</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0b0b0b;color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b0b0b;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#141414;border-radius:8px;padding:32px;">
            <tr>
              <td style="text-align:center;padding-bottom:24px;">
                <span style="display:inline-block;color:#f4f4f4;font-size:18px;font-weight:600;letter-spacing:0.05em;">Blueprint Logo</span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <h1 style="margin:0 0 16px;font-size:28px;color:#ffffff;">Thank You for Your Submission!</h1>
                <p style="margin:0 0 16px;font-size:16px;color:#d8d8d8;">Hi ${firstName},</p>
                <p style="margin:0 0 16px;font-size:16px;color:#d8d8d8;">
                  Thank you for your interest in Blueprint. The team has received your request and will contact you if we determine our products are well-suited to meet your needs.
                </p>
                <p style="margin:0 0 16px;font-size:16px;color:#d8d8d8;">In the meantime, please check out the following resources:</p>
                <ul style="margin:0 0 24px;padding-left:20px;color:#78a0ff;">
                  <li style="margin-bottom:8px;"><a href="https://tryblueprint.io/blog" style="color:#78a0ff;text-decoration:none;">Blog</a></li>
                  <li style="margin-bottom:8px;"><a href="https://tryblueprint.io/technical-guides" style="color:#78a0ff;text-decoration:none;">Technical Guides</a></li>
                  <li><a href="https://tryblueprint.io/events" style="color:#78a0ff;text-decoration:none;">Upcoming Events</a></li>
                </ul>
                <p style="margin:0 0 16px;font-size:16px;color:#d8d8d8;">Best,</p>
                <p style="margin:0 0 24px;font-size:16px;color:#d8d8d8;">The Blueprint Team</p>
                <div style="margin-bottom:32px;">
                  <a
                    href="https://tryblueprint.io/resources/reports/ai-readiness-report"
                    style="display:inline-block;padding:12px 24px;background-color:#34d399;color:#0b0b0b;font-weight:600;text-decoration:none;border-radius:4px;"
                  >Download the 2024 AI Readiness Report</a>
                </div>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                  <tr>
                    <td style="padding:0 12px;"><a href="https://www.linkedin.com/company/blueprint/" style="color:#78a0ff;text-decoration:none;">LinkedIn</a></td>
                    <td style="padding:0 12px;"><a href="https://twitter.com/try_blueprint" style="color:#78a0ff;text-decoration:none;">X</a></td>
                    <td style="padding:0 12px;"><a href="https://www.youtube.com/c/BlueprintAI" style="color:#78a0ff;text-decoration:none;">YouTube</a></td>
                  </tr>
                </table>
                <p style="margin:0;font-size:12px;color:#6b7280;">Blueprint, 1005 Crete St, Durham, NC 27707</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    await sendEmail({
      to: email,
      subject: confirmationSubject,
      text: confirmationText,
      html: confirmationHtml,
      replyTo: "ohstnhunt@gmail.com",
    });
  }

  return res.status(sent ? 200 : 202).json({ success: true, sent });
}
