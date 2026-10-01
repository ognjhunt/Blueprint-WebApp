import { Router } from "express";
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { resolveExecutionAccessContext } from "../utils/access-control";
import { isEmailSuppressed } from "../utils/email-suppression";
import { reviewedResearchInputSchema, stageReviewedResearch } from "../agents/communications-reviewed-research";
import { admitPublishedResearch } from "../agents/communications-intake";
import { readExistingResearchSnapshot } from "../agents/communications-research";

const router = Router();
/** Same authenticated admin authority as sensitive execution routes. A client
 * profile, approved=true or invented hosted session is never source authority. */
router.post("/research-admissions", async (req, res) => {
  const access = await resolveExecutionAccessContext(res);
  if (!access.isAdmin || !access.uid) return res.status(403).json({ error: "forbidden" });
  if (!dbAdmin) return res.status(503).json({ error: "reviewed_research_store_unavailable" });
  const parsed = reviewedResearchInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "reviewed_research_input_invalid" });
  try {
    const now = Date.now();
    const snapshot = await stageReviewedResearch(dbAdmin, parsed.data, access.uid, now);
    const outcome = await admitPublishedResearch(snapshot, parsed.data.candidate.candidate_key, {
      db: dbAdmin, now: () => Date.now(), readResearch: (date, admissionId) => readExistingResearchSnapshot(dbAdmin!, date, admissionId),
      isSuppressed: email => isEmailSuppressed(email, "growth_campaign"),
    });
    return res.status(200).json({ admissionId: snapshot.row.admission_id, provenanceKind: parsed.data.artifact.kind,
      artifactDigest: snapshot.row.raw_output_digest, sheetsPublished: false, notionPublished: false,
      ...outcome, sent: false, sessionCreated: false });
  } catch (error) {
    const code = error instanceof Error && /^reviewed_research_[a-z_]+$/.test(error.message) ? error.message : "reviewed_research_source_requires_refresh";
    return res.status(409).json({ error: code, sent: false, sessionCreated: false });
  }
});
export default router;
