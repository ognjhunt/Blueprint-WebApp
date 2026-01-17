import { Request, Response } from "express";
import { HTTP_STATUS } from "../constants/http-status";
import { sendEmail } from "../utils/email";
import {
  buildIdempotencyKey,
  fetchIdempotencyResponse,
  storeIdempotencyResponse,
} from "../utils/idempotency";
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

  const { key: idempotencyKey, ttlMs: idempotencyTtlMs } = buildIdempotencyKey({
    scope: "waitlist",
    email: emailValue,
    payload: {
      email: emailValue,
      locationType,
    },
  });

  const cachedResponse = await fetchIdempotencyResponse(idempotencyKey);
  if (cachedResponse) {
    return res.status(cachedResponse.status).json(cachedResponse.body);
  }

  const to = process.env.WAITLIST_TO ?? "ops@tryblueprint.io";
  const subject = "New on-site capture waitlist submission";
  const text = `Email: ${emailValue}\nLocation type: ${locationType}`;

  const { sent } = await sendEmail({ to, subject, text });

  return res.status(HTTP_STATUS.ACCEPTED).json({ success: true, sent });
  const responseStatus = sent ? 200 : 202;
  const responseBody = { success: true, sent };

  await storeIdempotencyResponse({
    key: idempotencyKey,
    response: { status: responseStatus, body: responseBody },
    ttlMs: idempotencyTtlMs,
  });

  return res.status(responseStatus).json(responseBody);
}
