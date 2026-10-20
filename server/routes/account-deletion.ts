import { Router, type Response } from "express";
import { z } from "zod";
import accountDeletionAdminRouter from "./account-deletion-admin";
import { AccountDeletionError, requestAccountDeletion, getAccountDeletionRequest } from "../utils/accountDeletion";

const router = Router();
const submit = z.object({ confirmation: z.literal("DELETE") }).strict();
function accountIdentity(res: Response) {
  const user = res.locals.firebaseUser;
  if (!user?.uid || user.localRouteProof === true) {
    throw new AccountDeletionError("Sign in to manage your account privacy.", 401, "authentication_required");
  }
  return user;
}
const fail = (error: unknown, res: Response) => {
  if (error instanceof AccountDeletionError) return res.status(error.status).json({ error: error.message, code: error.code });
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Confirm with DELETE. Do not include another account's details." });
  return res.status(503).json({ error: "Privacy requests are temporarily unavailable. Please try again or email privacy@tryblueprint.io." });
};

// The composition layer supplies CSRF + revoked-token-aware Firebase auth. No
// workspace-role requirement: even an account with unfinished onboarding can use this.
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!res.locals.firebaseUser?.uid || res.locals.firebaseUser.localRouteProof === true) {
    return res.status(401).json({ error: "Sign in to manage your account privacy." });
  }
  next();
});
router.get("/", async (_req, res) => {
  try { return res.json({ request: await getAccountDeletionRequest(accountIdentity(res).uid) }); }
  catch (error) { return fail(error, res); }
});
router.post("/", async (req, res) => {
  try {
    submit.parse(req.body);
    const result = await requestAccountDeletion(accountIdentity(res));
    return res.status(result.created ? 202 : 200).json(result);
  } catch (error) { return fail(error, res); }
});
router.use("/admin", accountDeletionAdminRouter);
export default router;
