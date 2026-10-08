import { Router, type Response } from "express";
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { requireAdminRole } from "../middleware/requireAdminRole";
import { draftSiteJobCommunication, loadSiteJobCommunicationsContext, refreshSiteJobReplies, sendReviewedSiteJobCommunication, SiteJobCommunicationsError } from "../agents/communications-site-job";

/** Mount only behind the existing Firebase auth + CSRF admin route boundary. */
const router = Router();
router.use(requireAdminRole);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const draft = z.object({ purpose: z.enum(["question", "recommendation", "coordination"]), instruction: z.string().trim().min(8).max(1200),
  decisionReason: z.string().trim().min(8).max(800), expectedContextDigest: digest, reviewedCustomerContext: z.literal(true),
  threadId: z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/).optional(), inboundMessageId: z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/).optional() }).strict();
const send = z.object({ expectedOutputDigest: digest, expectedContextDigest: digest, reviewedSend: z.literal(true) }).strict();
function failure(res: Response, error: unknown) {
  if (error instanceof SiteJobCommunicationsError) return res.status(error.status).json({ ok: false, error: error.code });
  // Provider/raw customer content and credentials never appear in an API error.
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "job_communications_unavailable";
  return res.status(503).json({ ok: false, error: code });
}
router.get("/jobs/:requestId/communications", async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: "store_unavailable" });
  try {
    const context = await loadSiteJobCommunicationsContext(db, String(req.params.requestId));
    const rows = await db.collection("inboundRequests").doc(String(req.params.requestId)).collection("communications").limit(30).get();
    return res.json({ ok: true, ...context, communications: rows.docs.map(doc => { const row = doc.data(); return { id: doc.id, purpose: row.binding?.purpose,
      state: row.state, output: row.output ?? null, outputHtml: row.outputHtml ?? null, outputDigest: row.outputDigest ?? null, contextDigest: row.contextDigest, sendReceipt: row.sendReceipt ?? null,
      answerReceived: row.answerReceived ?? false, failureCode: row.failureCode ?? null }; }),
      deliveryEnabled: process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED === "true", draftingEnabled: process.env.BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE === "true" });
  } catch (error) { return failure(res, error); }
});
router.post("/jobs/:requestId/communications/draft", async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: "store_unavailable" });
  const input = draft.safeParse(req.body), actor = String(res.locals.firebaseUser?.uid ?? "");
  if (!input.success || !actor) return res.status(400).json({ ok: false, error: "named_operator_and_reviewed_job_context_required" });
  try { return res.json({ ok: true, ...await draftSiteJobCommunication(db, String(req.params.requestId), actor, input.data) }); }
  catch (error) { return failure(res, error); }
});
router.post("/jobs/:requestId/communications/:communicationId/approve-send", async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: "store_unavailable" });
  const input = send.safeParse(req.body), actor = String(res.locals.firebaseUser?.uid ?? "");
  if (!input.success || !actor) return res.status(400).json({ ok: false, error: "named_operator_and_exact_draft_approval_required" });
  try { return res.json({ ok: true, ...await sendReviewedSiteJobCommunication(db, String(req.params.requestId), String(req.params.communicationId), actor, input.data) }); }
  catch (error) { return failure(res, error); }
});
router.post("/jobs/:requestId/communications/:communicationId/replies", async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: "store_unavailable" });
  const actor = String(res.locals.firebaseUser?.uid ?? "");
  if (!actor) return res.status(403).json({ ok: false, error: "named_operator_required" });
  try { return res.json({ ok: true, ...await refreshSiteJobReplies(db, String(req.params.requestId), String(req.params.communicationId), actor) }); }
  catch (error) { return failure(res, error); }
});
export default router;
