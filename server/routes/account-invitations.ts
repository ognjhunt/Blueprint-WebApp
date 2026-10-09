import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { AccountInvitationError, redeemAccountInvitation, resolveAccountInvitation } from "../utils/accountInvitations";
import { createRateLimitRedisStore } from "../utils/rate-limit-redis";

const router = Router();
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); res.setHeader("Referrer-Policy", "no-referrer"); next(); });
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, store: createRateLimitRedisStore("rl:account-invitations:") }));
const tokenSchema = z.string().min(1).max(4000);
const redeemSchema = z.object({ invitation: tokenSchema, mode: z.enum(["password", "google"]), acceptedTerms: z.literal(true), password: z.string().max(128).optional() }).strict();
const handleError = (error: unknown, res: any) => {
  if (error instanceof AccountInvitationError) return res.status(error.status).json({ error: error.message, code: error.code });
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Use a valid invitation and account details." });
  return res.status(503).json({ error: "Account invitations are temporarily unavailable. Please try again." });
};
router.post("/inspect", async (req, res) => {
  try { const invitation = await resolveAccountInvitation(tokenSchema.parse(req.body?.invitation)); const { email, name, organization, workspaceType, returnTo } = invitation; return res.json({ email, name, organization, workspaceType, returnTo }); }
  catch (error) { return handleError(error, res); }
});
router.post("/redeem", async (req, res) => {
  try { const input = redeemSchema.parse(req.body); return res.json(await redeemAccountInvitation(input.invitation, input.mode, input.password)); }
  catch (error) { return handleError(error, res); }
});
export default router;
