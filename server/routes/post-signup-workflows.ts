import { Request, Response } from "express";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { attachRequestMeta, logger } from "../logger";

type PostSignupWorkflowRequest = {
  blueprintId: string;
  userId?: string;
  companyName?: string;
  address?: string;
  companyUrl?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  locationType?: string;
  squareFootage?: number | null;
  onboardingGoal?: string;
  audienceType?: string;
};

export default async function postSignupWorkflowsHandler(
  req: Request,
  res: Response,
) {
  const requestMetaBase = attachRequestMeta({
    requestId: res.locals?.requestId,
    route: "post-signup-workflows",
  });

  const firestore = db;

  if (!firestore) {
    logger.error(
      requestMetaBase,
      "Firestore admin client is not configured for post-signup workflows",
    );

    return res.status(500).json({
      error: "Failed to process post-signup workflows",
      details: "Firestore is not configured",
    });
  }

  const requestBody = req.body as PostSignupWorkflowRequest;
  const { blueprintId, userId, companyName, address } = requestBody;

  if (!blueprintId || !companyName || !address) {
    logger.warn(
      attachRequestMeta({
        ...requestMetaBase,
        blueprintId,
        hasCompanyName: Boolean(companyName),
        hasAddress: Boolean(address),
      }),
      "Post-signup workflow missing required fields",
    );

    return res.status(400).json({
      error: "Missing required fields",
      details: {
        blueprintIdPresent: Boolean(blueprintId),
        companyNamePresent: Boolean(companyName),
        addressPresent: Boolean(address),
      },
    });
  }

  const requestMeta = attachRequestMeta({
    ...requestMetaBase,
    blueprintId,
    userId,
    companyName,
  });

  try {
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const blueprintRef = firestore.collection("blueprints").doc(blueprintId);

    await blueprintRef.set(
      {
        postSignupWorkflowStatus: {
          lastRunAt: timestamp,
          triggeredBy: userId || null,
          skipped: true,
          reason: "ai_provider_disabled",
        },
      },
      { merge: true },
    );

    logger.info(requestMeta, "Post-signup workflows skipped");

    return res.json({
      success: true,
      blueprintId,
      knowledgeSourceCount: 0,
      topQuestionCount: 0,
      storedInstructions: false,
      welcomeMessageCount: 0,
      skipped: true,
    });
  } catch (error: any) {
    logger.error(
      { ...requestMeta, err: error },
      "Post-signup workflows failed",
    );

    return res.status(500).json({
      error: "Failed to process post-signup workflows",
      details: error?.message || "Unknown error",
    });
  }
}
