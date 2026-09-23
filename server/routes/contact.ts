import { Request, Response } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { HTTP_STATUS } from "../constants/http-status";
import { attachRequestMeta, logger } from "../logger";
import { sendEmail } from "../utils/email";
import { bookingUrl } from "../utils/bookingLink";
import { isValidEmailAddress } from "../utils/validation";
import { brandedEmail, EMAIL_SIGN_OFF, emailGreeting } from "../utils/emailLayout";
import { COMPANY } from "../../client/src/data/company";

function emailDomain(value: string) {
  const domain = value.split("@").pop()?.trim().toLowerCase();
  return domain || null;
}

export default async function contactHandler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    name,
    email,
    company,
    city,
    state,
    companyWebsite,
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

  const requestSource =
    typeof req.body?.requestSource === "string"
      ? req.body.requestSource
      : "marketplace-wishlist";

  // Validate required fields and provide specific error messages
  const missingFields: string[] = [];
  if (!name) missingFields.push("Full Name");
  if (!email) missingFields.push("Work Email");
  if (!company) missingFields.push("Company");

  if (missingFields.length > 0) {
    logger.warn(
      attachRequestMeta({
        event: "contact_submission_rejected",
        requestId: res.locals?.requestId,
        method: req.method,
        path: req.originalUrl || req.path,
        requestSource,
        reason: "missing_required_fields",
        missingFields,
      }),
      "Contact submission rejected",
    );
    return res.status(400).json({
      error: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const emailValue = typeof email === "string" ? email.trim() : "";
  if (!emailValue || !isValidEmailAddress(emailValue)) {
    logger.warn(
      attachRequestMeta({
        event: "contact_submission_rejected",
        requestId: res.locals?.requestId,
        method: req.method,
        path: req.originalUrl || req.path,
        requestSource,
        reason: "invalid_email_format",
      }),
      "Contact submission rejected",
    );
    return res.status(400).json({ error: "Invalid email format" });
  }
  const normalizedCountry =
    typeof country === "string" && country.trim().length > 0
      ? country.trim()
      : "United States";

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
    `Email: ${emailValue}`,
    `Company: ${company}`,
    `Job title: ${jobTitle}`,
    `Country: ${normalizedCountry}`,
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

  summaryLines.push(`Calendly link: ${bookingUrl()}`);

  const to = process.env.CONTACT_TO ?? "ops@tryblueprint.io";
  const subject = `Blueprint request from ${company}`;
  const summary = summaryLines.join("\n");
  const safeRequestType =
    typeof (req.body?.requestType ?? requestType) === "string"
      ? String(req.body?.requestType ?? requestType)
      : null;
  const logContext = attachRequestMeta({
    event: "contact_submission_received",
    requestId: res.locals?.requestId,
    method: req.method,
    path: req.originalUrl || req.path,
    requestSource,
    requestType: safeRequestType,
    emailDomain: emailDomain(emailValue),
    country: normalizedCountry,
    hasMessage: typeof message === "string" && message.trim().length > 0,
    useCaseCount: useCaseList.length,
    interactionCount: interactionList.length,
    targetPolicyCount: policies.length,
    desiredCategoryCount: categories.length,
  });

  const logEntry = {
    requestSource,
    requesterName,
    email,
    company,
    jobTitle,
    country: normalizedCountry,
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
      logger.warn(
        {
          ...logContext,
          event: "contact_submission_firestore_unavailable",
          durableRecord: "marketplaceWishlist",
        },
        "Firebase Admin SDK not initialized. Skipping contact submission logging.",
      );
    } else {
      const recordRef = await db
        .collection("ops")
        .doc("marketplaceWishlist")
        .collection("requests")
        .add(logEntry);
      logger.info(
        {
          ...logContext,
          event: "contact_submission_wishlist_recorded",
          contactLogId: recordRef.id,
        },
        "Contact submission wishlist record persisted",
      );
    }
  } catch (error: any) {
    logger.warn(
      {
        ...logContext,
        event: "contact_submission_firestore_write_failed",
        durableRecord: "marketplaceWishlist",
        err: error,
      },
      "Failed to log contact submission to Firestore",
    );
  }

  if (requestSource === "website-contact-form") {
    if (!db) {
      logger.error(
        {
          ...logContext,
          event: "contact_form_firestore_required_unavailable",
          durableRecord: "contactRequests",
        },
        "Contact form Firestore records unavailable",
      );
      return res
        .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
        .json({ error: "Service temporarily unavailable" });
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    try {
      await db.collection("contactRequests").add({
        name: requesterName,
        email: emailValue,
        company,
        city: typeof city === "string" ? city : "",
        state: typeof state === "string" ? state : "",
        message: typeof message === "string" ? message : "",
        companyWebsite: typeof companyWebsite === "string" ? companyWebsite : "",
        requestSource,
        taskVideoLinks: res.locals.contactTaskMedia?.links || [],
        taskVideos: res.locals.contactTaskMedia?.uploads || [],
        ops_automation: {
          status: "pending",
          queue: "support_triage",
          intent: "support_triage",
          next_action: "triage contact request",
          recommended_path: null,
          confidence: null,
          requires_human_review: null,
          provider: null,
          runtime: null,
          model: null,
          tool_mode: null,
          execution_id: null,
          session_key: null,
          last_error: null,
          last_attempt_at: null,
          processed_at: null,
        },
        human_review_required: null,
        automation_confidence: null,
        createdAt: timestamp,
      });

      res.locals.contactRequestPersisted = true;
      logger.info(
        {
          ...logContext,
          event: "contact_form_records_created",
          contactRequestCreated: true,
        },
        "Contact form durable records created",
      );
    } catch (error) {
      logger.error(
        {
          ...logContext,
          event: "contact_form_firestore_write_failed",
          durableRecord: "contactRequests",
          err: error,
        },
        "Failed to create contact-form Firestore records",
      );
      return res
        .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
        .json({ error: "Unable to process contact request right now" });
    }
  }

  const { sent } = await sendEmail({ to, subject, text: summary, replyTo: email });

  if (email) {
    const confirmationSubject = "We received your message";
    const confirmation = brandedEmail({
      subject: confirmationSubject,
      text: [
        emailGreeting(requesterName),
        "Thanks for getting in touch with Blueprint. We read every message and will reply by email.",
        "How an evaluation works and what it costs:\nhttps://tryblueprint.io/how-it-works",
        EMAIL_SIGN_OFF,
      ].join("\n\n"),
    });

    await sendEmail({
      to: email,
      subject: confirmationSubject,
      text: confirmation.text,
      html: confirmation.html,
      replyTo: COMPANY.emails.hello,
    });
  }

  logger.info(
    {
      ...logContext,
      event: "contact_submission_email_processed",
      sent,
      confirmationAttempted: Boolean(email),
    },
    "Contact submission email processing completed",
  );

  return res.status(HTTP_STATUS.ACCEPTED).json({
    success: true,
    sent,
  });
}
