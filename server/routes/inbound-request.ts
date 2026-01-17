import { Request, Response, Router } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { HTTP_STATUS } from "../constants/http-status";
import { sendEmail } from "../utils/email";
import { notifySlackInboundRequest } from "../utils/slack";
import { logger } from "../logger";
import { isValidEmailAddress } from "../utils/validation";
import { getRateLimitRedisClient } from "../utils/rate-limit-redis";
import { encryptInboundRequestForStorage } from "../utils/field-encryption";
import type {
  InboundRequestPayload,
  InboundRequest,
  RequestPriority,
  RequestStatus,
  BudgetBucket,
  HelpWithOption,
  SubmitInboundRequestResponse,
} from "../types/inbound-request";

const router = Router();

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_EMAIL = 3; // Max 3 submissions per email per window
const RATE_LIMIT_PREFIX = "rl:inbound:";

const rateLimitRedisClient = getRateLimitRedisClient();

const RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if tonumber(current) == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return current
`;

// Valid budget buckets
const VALID_BUDGET_BUCKETS: BudgetBucket[] = [
  "<$50K",
  "$50K-$300K",
  "$300K-$1M",
  ">$1M",
  "Undecided/Unsure",
];

// Valid helpWith options
const VALID_HELP_WITH: HelpWithOption[] = [
  "benchmark-packs",
  "scene-library",
  "dataset-packs",
  "custom-capture",
];

// Known disposable email domains (extend as needed)
const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "tempmail.com",
  "throwaway.email",
  "guerrillamail.com",
  "10minutemail.com",
  "yopmail.com",
];

/**
 * Check rate limit for a given key
 */
async function checkRateLimit(
  key: string,
  maxCount: number
): Promise<{ allowed: boolean; remaining: number }> {
  if (!rateLimitRedisClient) {
    if (process.env.NODE_ENV === "production") {
      logger.warn("Redis rate limit client unavailable; allowing inbound request");
    }
    return { allowed: true, remaining: maxCount };
  }

  try {
    const count = await rateLimitRedisClient.eval(RATE_LIMIT_SCRIPT, {
      keys: [key],
      arguments: [RATE_LIMIT_WINDOW_MS.toString()],
    });
    const current = typeof count === "number" ? count : Number(count);
    const remaining = Math.max(maxCount - current, 0);
    return { allowed: current <= maxCount, remaining };
  } catch (error) {
    logger.warn({ error }, "Redis rate limit check failed; allowing inbound request");
    return { allowed: true, remaining: maxCount };
  }
}

/**
 * Compute priority based on budget and product interests
 */
function computePriority(
  budgetBucket: BudgetBucket,
  helpWith: HelpWithOption[]
): RequestPriority {
  // High priority for large budgets
  if (budgetBucket === ">$1M" || budgetBucket === "$300K-$1M") {
    return "high";
  }

  // High priority for custom capture requests (high-touch service)
  if (helpWith.includes("custom-capture")) {
    return "high";
  }

  // Normal priority for medium budgets
  if (budgetBucket === "$50K-$300K") {
    return "normal";
  }

  // Low priority for small/undecided budgets
  return "low";
}

/**
 * Compute initial owner based on product interests
 */
function computeOwner(
  helpWith: HelpWithOption[]
): { uid: string | null; email: string | null } {
  // Route custom capture and benchmark packs to solutions team
  if (
    helpWith.includes("custom-capture") ||
    helpWith.includes("benchmark-packs")
  ) {
    return {
      uid: null,
      email: process.env.SOLUTIONS_OWNER_EMAIL || "ops@tryblueprint.io",
    };
  }

  // Route scene library and dataset packs to sales/BD
  return {
    uid: null,
    email: process.env.SALES_OWNER_EMAIL || "ops@tryblueprint.io",
  };
}

/**
 * Validate email format and check for disposable domains
 */
function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!isValidEmailAddress(email)) {
    return { valid: false, error: "Invalid email format" };
  }

  const domain = email.split("@")[1]?.toLowerCase();
  if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
    return { valid: false, error: "Please use a work email address" };
  }

  return { valid: true };
}

/**
 * Generate confirmation email HTML
 */
function generateConfirmationEmailHtml(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Thank You for Your Request - Blueprint</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f9fafb;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9fafb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px;text-align:center;">
                <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Blueprint</h1>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding:40px 32px;">
                <h2 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#111827;">Thank you for your request, ${firstName}!</h2>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4b5563;">
                  We've received your request and our team will get back to you within 24 hours to discuss how we can support your project.
                </p>

                <!-- What happens next -->
                <div style="background-color:#f3f4f6;border-radius:8px;padding:24px;margin-bottom:24px;">
                  <h3 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#111827;">What happens next?</h3>
                  <ol style="margin:0;padding-left:20px;color:#4b5563;font-size:14px;line-height:1.8;">
                    <li>Our team reviews your request and product needs</li>
                    <li>We'll reach out to schedule a brief call to understand your requirements</li>
                    <li>You'll receive a customized proposal based on your project scope</li>
                  </ol>
                </div>

                <!-- CTA -->
                <div style="text-align:center;margin-bottom:32px;">
                  <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">Want to get started faster?</p>
                  <a href="https://calendly.com/blueprintar/30min" style="display:inline-block;padding:14px 28px;background-color:#4f46e5;color:#ffffff;font-weight:600;text-decoration:none;border-radius:8px;font-size:14px;">Book a Call Now</a>
                </div>

                <!-- Resources -->
                <div style="border-top:1px solid #e5e7eb;padding-top:24px;">
                  <h3 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#111827;">In the meantime, explore our resources:</h3>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding:8px 0;">
                        <a href="https://tryblueprint.io/evals" style="color:#4f46e5;text-decoration:none;font-size:14px;">Evaluation Services</a>
                        <span style="color:#9ca3af;font-size:14px;"> - Comprehensive benchmark suites</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;">
                        <a href="https://tryblueprint.io/marketplace" style="color:#4f46e5;text-decoration:none;font-size:14px;">Scene Marketplace</a>
                        <span style="color:#9ca3af;font-size:14px;"> - Browse SimReady environments</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;">
                        <a href="https://tryblueprint.io/docs" style="color:#4f46e5;text-decoration:none;font-size:14px;">Documentation</a>
                        <span style="color:#9ca3af;font-size:14px;"> - Technical guides and API docs</span>
                      </td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="text-align:center;">
                      <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
                        <a href="https://www.linkedin.com/company/blueprintsim/" style="color:#6b7280;text-decoration:none;margin:0 8px;">LinkedIn</a>
                        <a href="https://twitter.com/try_blueprint" style="color:#6b7280;text-decoration:none;margin:0 8px;">X</a>
                        <a href="https://www.youtube.com/c/BlueprintAI" style="color:#6b7280;text-decoration:none;margin:0 8px;">YouTube</a>
                      </p>
                      <p style="margin:0;font-size:12px;color:#9ca3af;">
                        Blueprint | 1005 Crete St, Durham, NC 27707
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * POST /api/inbound-request
 * Submit a new inbound request (lead)
 */
router.post("/", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const payload = req.body as InboundRequestPayload;

    // 1. Check honeypot (anti-bot)
    if (payload.honeypot) {
      logger.warn("Honeypot triggered - likely bot submission");
      // Return success to not reveal detection
      return res.status(HTTP_STATUS.ACCEPTED).json({
        ok: true,
        requestId: payload.requestId || "fake-id",
        status: "new",
      } satisfies SubmitInboundRequestResponse);
    }

    // 2. Validate required fields
    const missingFields: string[] = [];
    if (!payload.requestId) missingFields.push("requestId");
    if (!payload.firstName?.trim()) missingFields.push("firstName");
    if (!payload.lastName?.trim()) missingFields.push("lastName");
    if (!payload.company?.trim()) missingFields.push("company");
    if (!payload.email?.trim()) missingFields.push("email");
    if (!payload.budgetBucket) missingFields.push("budgetBucket");
    if (!payload.helpWith || payload.helpWith.length === 0) {
      missingFields.push("helpWith");
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        ok: false,
        requestId: payload.requestId || "",
        status: "new",
        message: `Missing required fields: ${missingFields.join(", ")}`,
      } satisfies SubmitInboundRequestResponse);
    }

    // 3. Validate email
    const emailLower = payload.email.toLowerCase().trim();
    const emailValidation = validateEmail(emailLower);
    if (!emailValidation.valid) {
      return res.status(400).json({
        ok: false,
        requestId: payload.requestId,
        status: "new",
        message: emailValidation.error,
      } satisfies SubmitInboundRequestResponse);
    }

    // 4. Validate enums
    if (!VALID_BUDGET_BUCKETS.includes(payload.budgetBucket)) {
      return res.status(400).json({
        ok: false,
        requestId: payload.requestId,
        status: "new",
        message: "Invalid budget bucket",
      } satisfies SubmitInboundRequestResponse);
    }

    const invalidHelpWith = payload.helpWith.filter(
      (h) => !VALID_HELP_WITH.includes(h)
    );
    if (invalidHelpWith.length > 0) {
      return res.status(400).json({
        ok: false,
        requestId: payload.requestId,
        status: "new",
        message: `Invalid helpWith values: ${invalidHelpWith.join(", ")}`,
      } satisfies SubmitInboundRequestResponse);
    }

    // 5. Check rate limits
    const emailDomain = emailLower.split("@")[1];
    const emailRateLimit = await checkRateLimit(
      `${RATE_LIMIT_PREFIX}email:${emailDomain}`,
      RATE_LIMIT_MAX_EMAIL
    );
    if (!emailRateLimit.allowed) {
      logger.warn({ emailDomain }, "Email domain rate limit exceeded");
      return res.status(429).json({
        ok: false,
        requestId: payload.requestId,
        status: "new",
        message: "Too many requests from this email domain. Please try again later.",
      } satisfies SubmitInboundRequestResponse);
    }

    // 6. Check idempotency - if requestId already exists, return success
    if (!db) {
      logger.error("Firebase Admin SDK not initialized");
      return res.status(500).json({
        ok: false,
        requestId: payload.requestId,
        status: "new",
        message: "Internal server error",
      } satisfies SubmitInboundRequestResponse);
    }

    const existingDoc = await db
      .collection("inboundRequests")
      .doc(payload.requestId)
      .get();

    if (existingDoc.exists) {
      logger.info(
        { requestId: payload.requestId },
        "Duplicate request - returning existing"
      );
      const existingData = existingDoc.data() as InboundRequest;
      return res.status(HTTP_STATUS.OK).json({
        ok: true,
        requestId: payload.requestId,
        status: existingData.status,
      } satisfies SubmitInboundRequestResponse);
    }

    // 7. Compute priority and owner
    const priority = computePriority(payload.budgetBucket, payload.helpWith);
    const owner = computeOwner(payload.helpWith);

    // 8. Build the document
    const now = admin.firestore.FieldValue.serverTimestamp();
    const inboundRequest: Omit<InboundRequest, "createdAt"> & {
      createdAt: FirebaseFirestore.FieldValue;
    } = {
      requestId: payload.requestId,
      createdAt: now,
      status: "new" as RequestStatus,
      priority,
      owner,
      contact: {
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        email: emailLower,
        roleTitle: payload.roleTitle?.trim() || "",
        company: payload.company.trim(),
      },
      request: {
        budgetBucket: payload.budgetBucket,
        helpWith: payload.helpWith,
        details: payload.details?.trim() || null,
      },
      context: {
        sourcePageUrl: payload.context?.sourcePageUrl || "",
        referrer: payload.context?.referrer || null,
        utm: {
          source: payload.context?.utm?.source || null,
          medium: payload.context?.utm?.medium || null,
          campaign: payload.context?.utm?.campaign || null,
          term: payload.context?.utm?.term || null,
          content: payload.context?.utm?.content || null,
        },
        userAgent: payload.context?.userAgent || req.get("user-agent") || null,
        timezoneOffset: payload.context?.timezoneOffset ?? null,
        locale: payload.context?.locale || null,
      },
      enrichment: {
        companyDomain: emailDomain,
        companySize: null,
        geo: null,
        notes: null,
      },
      events: {
        confirmationEmailSentAt: null,
        slackNotifiedAt: null,
        crmSyncedAt: null,
      },
      debug: {
        schemaVersion: 1,
      },
    };

    const encryptedInboundRequest = await encryptInboundRequestForStorage(
      inboundRequest
    );

    // 9. Write to Firestore
    await db
      .collection("inboundRequests")
      .doc(payload.requestId)
      .set(encryptedInboundRequest);

    await db
      .collection("stats")
      .doc("inboundRequests")
      .set(
        {
          total: admin.firestore.FieldValue.increment(1),
          [`byStatus.new`]: admin.firestore.FieldValue.increment(1),
          [`byPriority.${priority}`]: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    logger.info(
      {
        requestId: payload.requestId,
        company: payload.company,
        priority,
        durationMs: Date.now() - startTime,
      },
      "Inbound request created"
    );

    // 10. Trigger async automations (don't block response)
    const automationPromises: Promise<void>[] = [];

    // Slack notification
    automationPromises.push(
      (async () => {
        try {
          const slackResult = await notifySlackInboundRequest({
            requestId: payload.requestId,
            firstName: payload.firstName.trim(),
            lastName: payload.lastName.trim(),
            email: emailLower,
            company: payload.company.trim(),
            roleTitle: payload.roleTitle?.trim() || "",
            budgetBucket: payload.budgetBucket,
            helpWith: payload.helpWith,
            details: payload.details || null,
            priority,
            sourcePageUrl: payload.context?.sourcePageUrl || "",
          });

          if (slackResult.sent) {
            await db
              .collection("inboundRequests")
              .doc(payload.requestId)
              .update({
                "events.slackNotifiedAt":
                  admin.firestore.FieldValue.serverTimestamp(),
              });
          }
        } catch (error) {
          logger.error(
            { error, requestId: payload.requestId },
            "Failed to send Slack notification"
          );
        }
      })()
    );

    // Confirmation email
    automationPromises.push(
      (async () => {
        try {
          const confirmationHtml = generateConfirmationEmailHtml(
            payload.firstName.trim()
          );
          const confirmationText = `Hi ${payload.firstName.trim()},

Thank you for your request! We've received your submission and our team will get back to you within 24 hours to discuss how we can support your project.

What happens next?
1. Our team reviews your request and product needs
2. We'll reach out to schedule a brief call to understand your requirements
3. You'll receive a customized proposal based on your project scope

Want to get started faster? Book a call now: https://calendly.com/blueprintar/30min

In the meantime, explore our resources:
- Evaluation Services: https://tryblueprint.io/evals
- Scene Marketplace: https://tryblueprint.io/marketplace
- Documentation: https://tryblueprint.io/docs

Best,
The Blueprint Team

Blueprint | 1005 Crete St, Durham, NC 27707`;

          const emailResult = await sendEmail({
            to: emailLower,
            subject: "Blueprint - We received your request",
            text: confirmationText,
            html: confirmationHtml,
            replyTo: "ops@tryblueprint.io",
          });

          if (emailResult.sent) {
            await db
              .collection("inboundRequests")
              .doc(payload.requestId)
              .update({
                "events.confirmationEmailSentAt":
                  admin.firestore.FieldValue.serverTimestamp(),
              });
          }
        } catch (error) {
          logger.error(
            { error, requestId: payload.requestId },
            "Failed to send confirmation email"
          );
        }
      })()
    );

    // Internal notification email to ops
    automationPromises.push(
      (async () => {
        try {
          const to = process.env.CONTACT_TO ?? "ops@tryblueprint.io";
          const subject = `[${priority.toUpperCase()}] New request from ${payload.company.trim()}`;
          const text = `New inbound request received:

Name: ${payload.firstName.trim()} ${payload.lastName.trim()}
Email: ${emailLower}
Company: ${payload.company.trim()}
Role: ${payload.roleTitle?.trim() || "Not specified"}
Budget: ${payload.budgetBucket}
Interested in: ${payload.helpWith.join(", ")}
Priority: ${priority}

${payload.details ? `Details:\n${payload.details}\n` : ""}
Source: ${payload.context?.sourcePageUrl || "Unknown"}

View in admin: ${process.env.APP_URL || "https://tryblueprint.io"}/admin/leads/${payload.requestId}
`;

          await sendEmail({
            to,
            subject,
            text,
            replyTo: emailLower,
          });
        } catch (error) {
          logger.error(
            { error, requestId: payload.requestId },
            "Failed to send internal notification email"
          );
        }
      })()
    );

    // Fire and forget automations
    Promise.all(automationPromises).catch((error) => {
      logger.error({ error }, "Error in automation promises");
    });

    // 11. Return success
    return res.status(HTTP_STATUS.CREATED).json({
      ok: true,
      requestId: payload.requestId,
      status: "new",
    } satisfies SubmitInboundRequestResponse);
  } catch (error) {
    logger.error(
      { error, durationMs: Date.now() - startTime },
      "Error processing inbound request"
    );
    return res.status(500).json({
      ok: false,
      requestId: req.body?.requestId || "",
      status: "new",
      message: "An error occurred processing your request. Please try again.",
    } satisfies SubmitInboundRequestResponse);
  }
});

export default router;
