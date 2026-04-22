import { Request, Response } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { HTTP_STATUS } from "../constants/http-status";
import { sendEmail } from "../utils/email";
import {
  buildIdempotencyKey,
  fetchIdempotencyResponse,
  storeIdempotencyResponse,
} from "../utils/idempotency";
import { isValidEmailAddress, isValidPhoneNumber } from "../utils/validation";
import { listCityLaunchActivations, upsertCityLaunchProspect } from "../utils/cityLaunchLedgers";
import { slugifyCityName } from "../utils/cityLaunchProfiles";

function toFilterToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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

  const { email, locationType, role, device, phone, market, company, notes, source } = req.body ?? {};

  if (!email || !locationType) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const emailValue = typeof email === "string" ? email.trim() : "";
  const locationTypeValue = typeof locationType === "string" ? locationType.trim() : "";
  const roleValue = typeof role === "string" ? role.trim() : "";
  const deviceValue = typeof device === "string" ? device.trim() : "";
  const phoneValue = typeof phone === "string" ? phone.trim() : "";
  const marketValue = typeof market === "string" ? market.trim() : "";
  const companyValue = typeof company === "string" ? company.trim() : "";
  const notesValue = typeof notes === "string" ? notes.trim() : "";
  const sourceValue = typeof source === "string" ? source.trim() : "";
  const normalizedEmail = emailValue.toLowerCase();
  const normalizedRole = roleValue.toLowerCase();
  const normalizedDevice = deviceValue.toLowerCase();
  const normalizedMarket = marketValue.toLowerCase();
  const roleIncludesCapturer = normalizedRole.includes("capturer");
  const filterTags = [
    normalizedRole ? `role:${toFilterToken(normalizedRole)}` : null,
    normalizedDevice ? `device:${toFilterToken(normalizedDevice)}` : null,
    normalizedMarket ? `market:${toFilterToken(normalizedMarket)}` : null,
    locationTypeValue ? `location_type:${toFilterToken(locationTypeValue)}` : null,
  ].filter(Boolean);

  if (!emailValue || !isValidEmailAddress(emailValue)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (!locationTypeValue) {
    return res.status(400).json({ error: "Invalid location type" });
  }

  if (phoneValue && !isValidPhoneNumber(phoneValue)) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  const { key: idempotencyKey, ttlMs: idempotencyTtlMs } = buildIdempotencyKey({
    scope: "waitlist",
    email: emailValue,
    payload: {
      email: emailValue,
      locationType: locationTypeValue,
      role: roleValue || null,
      device: deviceValue || null,
      phone: phoneValue || null,
      market: marketValue || null,
      company: companyValue || null,
      notes: notesValue || null,
      source: sourceValue || null,
    },
  });

  const cachedResponse = await fetchIdempotencyResponse(idempotencyKey);
  if (cachedResponse) {
    return res.status(cachedResponse.status).json(cachedResponse.body);
  }

  const to = process.env.WAITLIST_TO ?? "ops@tryblueprint.io";
  const subject =
    roleIncludesCapturer
      ? "New Blueprint Capture private beta request"
      : "New on-site capture waitlist submission";
  const text = [
    `Email: ${emailValue}`,
    `Location type: ${locationTypeValue}`,
    marketValue ? `Market: ${marketValue}` : null,
    roleValue ? `Role: ${roleValue}` : null,
    companyValue ? `Company: ${companyValue}` : null,
    deviceValue ? `Device: ${deviceValue}` : null,
    phoneValue ? `Phone: ${phoneValue}` : null,
    sourceValue ? `Source: ${sourceValue}` : null,
    notesValue ? `Notes: ${notesValue}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  let submissionId: string | null = null;
  let persisted = false;

  if (db) {
    submissionId = idempotencyKey;

    await db.collection("waitlistSubmissions").doc(submissionId).set({
      email: emailValue,
      email_normalized: normalizedEmail,
      email_domain: normalizedEmail.includes("@") ? normalizedEmail.split("@")[1] : "",
      location_type: locationTypeValue,
      market: marketValue || null,
      market_normalized: marketValue ? normalizedMarket : null,
      role: roleValue || null,
      role_normalized: roleValue ? normalizedRole : null,
      company: companyValue || null,
      notes: notesValue || null,
      device: deviceValue || null,
      device_normalized: deviceValue ? normalizedDevice : null,
      phone: phoneValue || null,
      source:
        sourceValue
        || (roleIncludesCapturer ? "capture_app_private_beta" : "website_waitlist"),
      status: "new",
      queue:
        roleIncludesCapturer ? "capturer_beta_review" : "website_waitlist_review",
      intent:
        roleIncludesCapturer ? "capturer_beta_access" : "website_waitlist_access",
      filter_tags: filterTags,
      ops_automation: {
        status: "pending",
        version: "waitlist_v1",
        next_action:
          roleIncludesCapturer
            ? "route_by_market_device_and_role"
            : "manual_waitlist_review",
        recommended_path:
          roleIncludesCapturer ? "capturer_beta_workflow" : "website_waitlist_workflow",
        eligible_for_ai_triage: roleIncludesCapturer,
        last_error: null,
        last_attempt_at: null,
      },
      human_review_required: null,
      automation_confidence: null,
      idempotency_key: idempotencyKey,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    persisted = true;
  }

  const { sent } = await sendEmail({ to, subject, text });

  // City-launch intake routing: if the submission's market matches an active city launch,
  // auto-link the submission as a prospect in the city launch prospect ledger.
  if (db && marketValue) {
    try {
      const activations = await listCityLaunchActivations();
      const matchedActivation = activations.find((activation) => {
        const activationSlug = activation.citySlug;
        const marketSlug = slugifyCityName(marketValue);
        return activationSlug === marketSlug
          || marketValue.toLowerCase().includes(activation.city.toLowerCase().split(",")[0].trim());
      });

      if (matchedActivation && matchedActivation.status !== "planning") {
        await upsertCityLaunchProspect({
          city: matchedActivation.city,
          launchId: matchedActivation.rootIssueId,
          sourceBucket: "waitlist_intake",
          channel: roleIncludesCapturer ? "capture_app_beta" : "website_waitlist",
          name: companyValue || emailValue.split("@")[0] || "Waitlist Applicant",
          email: emailValue,
          status: "identified",
          ownerAgent: "intake-agent",
          notes: `Auto-linked from waitlist submission. Market: ${marketValue}. Role: ${roleValue || "unknown"}. Location type: ${locationTypeValue}. Device: ${deviceValue || "unknown"}.${notesValue ? ` Notes: ${notesValue}.` : ""}`,
          firstContactedAt: null,
          lastContactedAt: null,
          siteAddress: locationTypeValue || null,
          locationSummary: marketValue || null,
          lat: null,
          lng: null,
          siteCategory: locationTypeValue || null,
          workflowFit: roleIncludesCapturer ? "capturer_supply" : "unknown",
          priorityNote: null,
          researchProvenance: null,
        });
      }
    } catch {
      // City-launch intake routing is best-effort and should not block the waitlist response.
    }
  }


  const responseStatus = sent ? HTTP_STATUS.OK : HTTP_STATUS.ACCEPTED;
  const responseBody = { success: true, sent, persisted, submissionId };

  await storeIdempotencyResponse({
    key: idempotencyKey,
    response: { status: responseStatus, body: responseBody },
    ttlMs: idempotencyTtlMs,
  });

  return res.status(responseStatus).json(responseBody);
}
