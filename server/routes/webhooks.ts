import express, { Request, Response } from "express";

import { attachRequestMeta, logger } from "../logger";

const router = express.Router();
const parallelWebhookSecret = process.env.PARALLEL_WEBHOOK_SECRET;

router.post("/parallel", (req: Request, res: Response) => {
  const signatureHeader =
    (req.headers["x-parallel-signature"] as string | undefined) ||
    (req.headers["parallel-signature"] as string | undefined) ||
    (req.headers["parallel-webhook-secret"] as string | undefined);

  if (
    parallelWebhookSecret &&
    signatureHeader &&
    signatureHeader !== parallelWebhookSecret
  ) {
    logger.warn(
      attachRequestMeta({
        route: "parallel-webhook",
        reason: "signature_mismatch",
      }),
      "Parallel webhook signature mismatch",
    );
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  const eventPayload = (req.body ?? {}) as Record<string, any>;
  const eventType =
    eventPayload.type ||
    eventPayload.event ||
    eventPayload?.data?.type ||
    "unknown";
  const runId =
    eventPayload.run_id ||
    eventPayload.id ||
    eventPayload?.data?.run_id ||
    eventPayload?.data?.id ||
    null;
  const status =
    eventPayload.status ||
    eventPayload?.data?.status ||
    eventPayload?.result?.status ||
    null;

  logger.info(
    attachRequestMeta({
      route: "parallel-webhook",
      eventType,
      runId,
      status,
    }),
    "Parallel webhook event received",
  );

  if ((logger as any).level === "debug" || process.env.LOG_LEVEL === "debug") {
    logger.info(
      attachRequestMeta({
        route: "parallel-webhook",
        eventType,
        runId,
        status,
        payload: eventPayload,
      }),
      "Parallel webhook payload",
    );
  }

  res.status(200).json({ received: true });
});

export default router;
