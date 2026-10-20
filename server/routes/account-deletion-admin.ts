import { Router, type Response } from "express";
import { z } from "zod";
import { requireAdminRole } from "../middleware/requireAdminRole";
import { AccountDeletionError, listAccountDeletionRequests, beginAccountDeletionReview } from "../utils/accountDeletion";

const router = Router();
const id = z.string().regex(/^deletion_[a-f0-9]{64}$/);
const fail = (error: unknown, res: Response) => {
  if (error instanceof AccountDeletionError) return res.status(error.status).json({ error: error.message, code: error.code });
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid privacy review request." });
  return res.status(503).json({ error: "Privacy requests are temporarily unavailable. Please try again or email privacy@tryblueprint.io." });
};

// Every handler in this router is operator-only, including when mounted alone.
// The parent supplies revoked-token-aware Firebase authentication and CSRF.
router.use(requireAdminRole);
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!res.locals.firebaseUser?.uid || res.locals.firebaseUser.localRouteProof === true) {
    return res.status(401).json({ error: "Sign in to manage account privacy requests." });
  }
  next();
});
router.get("/", async (req, res) => {
  try {
    const cursor = req.query.cursor === undefined ? undefined : id.parse(req.query.cursor);
    return res.json(await listAccountDeletionRequests(cursor));
  } catch (error) { return fail(error, res); }
});
router.post("/:id/review", async (req, res) => {
  try {
    z.object({}).strict().parse(req.body);
    const user = res.locals.firebaseUser;
    if (!user?.uid || user.localRouteProof === true) {
      throw new AccountDeletionError("Sign in to manage account privacy requests.", 401, "authentication_required");
    }
    return res.json({ request: await beginAccountDeletionReview(id.parse(req.params.id), user.uid) });
  } catch (error) { return fail(error, res); }
});
export default router;
