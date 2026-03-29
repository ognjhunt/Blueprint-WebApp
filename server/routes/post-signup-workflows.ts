import { Request, Response } from "express";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { HTTP_STATUS } from "../constants/http-status";
import { attachRequestMeta, logger } from "../logger";
import { runPostSignupSchedulingTask } from "../agents";
import {
  executePostSignupDirectActions,
  resolvePostSignupExecutionContext,
} from "../utils/post-signup-actions";

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
  mappingDate?: string | null;
  mappingTime?: string | null;
  demoDate?: string | null;
  demoTime?: string | null;
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
    const executionContext = await resolvePostSignupExecutionContext({
      blueprintId,
      userId,
      companyName,
      address,
      companyUrl: requestBody.companyUrl,
      contactName: requestBody.contactName,
      contactEmail: requestBody.contactEmail,
      contactPhone: requestBody.contactPhone,
      locationType: requestBody.locationType,
      squareFootage: requestBody.squareFootage ?? null,
      onboardingGoal: requestBody.onboardingGoal,
      audienceType: requestBody.audienceType,
      mappingDate: requestBody.mappingDate ?? null,
      mappingTime: requestBody.mappingTime ?? null,
      demoDate: requestBody.demoDate ?? null,
      demoTime: requestBody.demoTime ?? null,
    });
    const schedulingResult = await runPostSignupSchedulingTask({
      blueprintId,
      userId,
      companyName,
      address,
      companyUrl: requestBody.companyUrl,
      contactName: requestBody.contactName,
      contactEmail: requestBody.contactEmail,
      contactPhone: requestBody.contactPhone,
      locationType: requestBody.locationType,
      squareFootage: requestBody.squareFootage ?? null,
      onboardingGoal: requestBody.onboardingGoal,
      audienceType: requestBody.audienceType,
      mappingDate: executionContext.booking?.date || null,
      mappingTime: executionContext.booking?.time || null,
      demoDate: executionContext.booking?.demoScheduleDate || null,
      demoTime: executionContext.booking?.demoScheduleTime || null,
    });
    const executionResult = await executePostSignupDirectActions({
      input: {
        blueprintId,
        userId,
        companyName,
        address,
        companyUrl: requestBody.companyUrl,
        contactName: requestBody.contactName,
        contactEmail: requestBody.contactEmail,
        contactPhone: requestBody.contactPhone,
        locationType: requestBody.locationType,
        squareFootage: requestBody.squareFootage ?? null,
        onboardingGoal: requestBody.onboardingGoal,
        audienceType: requestBody.audienceType,
        mappingDate: executionContext.booking?.date || null,
        mappingTime: executionContext.booking?.time || null,
        demoDate: executionContext.booking?.demoScheduleDate || null,
        demoTime: executionContext.booking?.demoScheduleTime || null,
      },
      scheduling: schedulingResult,
      context: executionContext,
    });

    await blueprintRef.set(
      {
        postSignupWorkflowStatus: {
          lastRunAt: timestamp,
          triggeredBy: userId || null,
          skipped: false,
          status: executionResult.status,
          reason:
            executionResult.blockingReasonCodes[0] ||
            schedulingResult.block_reason_code ||
            null,
          confidence: schedulingResult.confidence,
          requiresHumanReview:
            executionResult.requiresHumanReview ||
            schedulingResult.requires_human_review ||
            executionResult.status !== "completed",
          automationStatus: schedulingResult.automation_status,
          blockReasonCode: schedulingResult.block_reason_code,
          retryable: schedulingResult.retryable || executionResult.retryable,
          blockingReasonCodes: executionResult.blockingReasonCodes,
          nextAction: schedulingResult.next_action,
          scheduleSummary: schedulingResult.schedule_summary,
          contactLookupPlan: schedulingResult.contact_lookup_plan,
          confirmations: schedulingResult.confirmations,
          actionPlan: schedulingResult.action_plan,
          actions: executionResult.actionResults,
          resolvedContact: executionContext.resolvedContact,
          bookingContext: executionContext.booking,
        },
      },
      { merge: true },
    );

    logger.info(requestMeta, "Post-signup workflows completed");

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      blueprintId,
      skipped: false,
      status: executionResult.status,
      blockingReasonCodes: executionResult.blockingReasonCodes,
      retryable: schedulingResult.retryable || executionResult.retryable,
      result: schedulingResult,
      actions: executionResult.actionResults,
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
