import { Router } from "express";
import { createHash } from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authAdmin } from "../../client/src/lib/firebaseAdmin";
import { COMPANY } from "../../client/src/data/company";
import { createRateLimitRedisStore } from "../utils/rate-limit-redis";
import { sendEmail } from "../utils/email";
import { passwordResetEmail } from "../utils/passwordResetEmail";
import { logger } from "../logger";

const router = Router();
const confirmation = { ok: true, message: "If an account exists for this email, you’ll receive a password reset link." };
const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(320) }).strict();
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
const throttled = (_req: unknown, res: any) => res.status(202).json(confirmation);
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false,
  store: createRateLimitRedisStore("rl:password-reset-ip:"), handler: throttled }));
router.use(rateLimit({ windowMs: 60 * 60 * 1000, limit: 3, standardHeaders: false, legacyHeaders: false,
  keyGenerator: req => createHash("sha256").update(String(req.body?.email || "").trim().toLowerCase()).digest("hex"),
  store: createRateLimitRedisStore("rl:password-reset-email:"), handler: throttled }));
router.post("/", async (req, res) => {
  const input = emailSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Enter a valid email address." });
  try {
    if (!authAdmin) throw new Error("password_reset_unavailable");
    const link = await authAdmin.generatePasswordResetLink(input.data.email, {
      url: `${COMPANY.website}/sign-in`, handleCodeInApp: false,
    });
    const result = await sendEmail({ to: input.data.email, ...passwordResetEmail(link),
      fromEmail: COMPANY.emails.hello, fromName: COMPANY.shortName, replyTo: COMPANY.emails.support });
    if (!result.sent) throw new Error("password_reset_delivery_unconfirmed");
  } catch (error) {
    // Neither an account's existence nor its one-time reset credential belongs
    // in the public response or logs. Uncertain sends are never retried here.
    if ((error as {code?: string})?.code !== "auth/user-not-found")
      logger.warn({ event: "password_reset_delivery_unconfirmed" }, "Password reset delivery could not be confirmed");
  }
  return res.status(202).json(confirmation);
});
export default router;
