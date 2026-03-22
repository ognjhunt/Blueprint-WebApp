import { Request, Response } from "express";

import { HTTP_STATUS } from "../constants/http-status";
import { attachRequestMeta, logger } from "../logger";
import { runAgentTask } from "../agents";
import {
  validateWaitlistData,
  type WaitlistData,
} from "../utils/validation";
import type {
  WaitlistTriageOutput,
  WaitlistTriageTaskInput,
} from "../agents/tasks/waitlist-triage";

export default async function processWaitlistHandler(
  req: Request,
  res: Response,
) {
  const requestMeta = attachRequestMeta({
    requestId: res.locals?.requestId,
    route: "process-waitlist",
  });

  try {
    const requestData = req.body as WaitlistData;
    const validationErrors = validateWaitlistData(requestData);

    if (validationErrors.length > 0) {
      logger.warn(
        attachRequestMeta({
          ...requestMeta,
          validationErrors: validationErrors.length,
        }),
        "Waitlist submission failed validation",
      );

      return res.status(400).json({
        error: "Validation failed",
        errors: validationErrors,
      });
    }

    const aiInput: WaitlistTriageTaskInput = {
      submission: {
        email: requestData.email,
        email_domain: requestData.email?.split("@")[1] || "",
        market: [requestData.city, requestData.state].filter(Boolean).join(", "),
        location_type: requestData.companyAddress || "",
        role: "capturer",
        device: requestData.companyWebsite || "",
        phone_present: false,
        source: "process_waitlist_route",
        status: "new",
        queue: "capturer_beta_review",
        filter_tags: [],
        company: requestData.company,
        city: requestData.city,
        state: requestData.state,
        offWaitlistUrl: requestData.offWaitlistUrl,
      },
    };

    const result = await runAgentTask<
      WaitlistTriageTaskInput,
      WaitlistTriageOutput
    >({
      kind: "waitlist_triage",
      input: aiInput,
      session_key: `process-waitlist:${requestData.email?.toLowerCase() || "unknown"}`,
      metadata: {
        request_source: "process_waitlist_route",
      },
    });

    if (result.status !== "completed" || !result.output) {
      return res.status(500).json({
        error: "Failed to process waitlist signup",
        details: result.error || "Unknown automation error",
        provider: result.provider,
        runtime: result.runtime,
      });
    }

    logger.info(
      attachRequestMeta({
        ...requestMeta,
        emailDomain: requestData.email?.includes("@")
          ? requestData.email.split("@")[1]
          : undefined,
        companyLength: requestData.company?.length,
        provider: result.provider,
      }),
      "Waitlist submission processed",
    );

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      provider: result.provider,
      runtime: result.runtime,
      model: result.model,
      response: result.output,
    });
  } catch (error: any) {
    const statusCode = error?.status ?? error?.statusCode ?? 500;

    logger.error(
      {
        ...attachRequestMeta({
          ...requestMeta,
          statusCode,
          errorType: error?.constructor?.name,
        }),
        err: error,
      },
      "Failed to process waitlist submission",
    );

    return res.status(500).json({
      error: "Failed to process waitlist signup",
      details: error?.message || "Unknown error",
    });
  }
}
