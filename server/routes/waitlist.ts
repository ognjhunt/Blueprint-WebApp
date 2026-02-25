import { Request, Response } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
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

  const action =
    typeof req.body?.action === "string" ? req.body.action : null;

  if (action === "validate-offwaitlist-token") {
    const token =
      typeof req.body?.token === "string" ? req.body.token.trim() : "";

    if (!token) {
      return res.status(400).json({ valid: false, error: "Missing token" });
    }

    if (!db) {
      return res
        .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
        .json({ valid: false, error: "Service temporarily unavailable" });
    }

    const snapshot = await db
      .collection("waitlistTokens")
      .where("token", "==", token)
      .where("status", "==", "unused")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        valid: false,
        error: "This signup link is invalid or has already been used",
      });
    }

    const tokenDoc = snapshot.docs[0];
    const tokenData = tokenDoc.data();

    return res.status(HTTP_STATUS.OK).json({
      valid: true,
      tokenData: {
        id: tokenDoc.id,
        email: tokenData.email ?? "",
        company: tokenData.company ?? "",
        status: tokenData.status ?? "unused",
      },
    });
  }

  if (action === "consume-offwaitlist-token") {
    const tokenId =
      typeof req.body?.tokenId === "string" ? req.body.tokenId.trim() : "";
    const usedBy =
      typeof req.body?.usedBy === "string" ? req.body.usedBy.trim() : "";

    if (!tokenId) {
      return res.status(400).json({ success: false, error: "Missing tokenId" });
    }

    if (!db) {
      return res
        .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
        .json({ success: false, error: "Service temporarily unavailable" });
    }

    const tokenRef = db.collection("waitlistTokens").doc(tokenId);
    const tokenDoc = await tokenRef.get();

    if (!tokenDoc.exists) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, error: "Token not found" });
    }

    const data = tokenDoc.data();
    if (data?.status !== "unused") {
      return res
        .status(HTTP_STATUS.CONFLICT)
        .json({ success: false, error: "Token already consumed" });
    }

    await tokenRef.update({
      status: "used",
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
      usedBy: usedBy || null,
    });

    return res.status(HTTP_STATUS.OK).json({ success: true });
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
  const responseStatus = sent ? HTTP_STATUS.OK : HTTP_STATUS.ACCEPTED;
  const responseBody = { success: true, sent };

  await storeIdempotencyResponse({
    key: idempotencyKey,
    response: { status: responseStatus, body: responseBody },
    ttlMs: idempotencyTtlMs,
  });

  return res.status(responseStatus).json(responseBody);
}
