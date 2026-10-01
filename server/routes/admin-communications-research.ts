import { Router } from "express";
import { createHash } from "node:crypto";
import { dbAdmin, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { resolveExecutionAccessContext } from "../utils/access-control";
import { isEmailSuppressed } from "../utils/email-suppression";
import { reviewedResearchInputSchema, reviewedResearchPublication, stageReviewedResearch, REVIEWED_RESEARCH_ROOT } from "../agents/communications-reviewed-research";
import { admitPublishedResearch } from "../agents/communications-intake";
import { readExistingResearchSnapshot } from "../agents/communications-research";

const router = Router();
// Blueprint IDs and authenticated reads keep storage-provider paths transport
// details. Source bytes, manifests and record exports remain portable files.
router.get("/research-artifacts/:artifactId/:part?", async (req, res) => {
  const access = await resolveExecutionAccessContext(res);
  if (!access.isAdmin || !access.uid) return res.status(403).json({ error: "forbidden" });
  const { artifactId, part = "source" } = req.params;
  if (!/^[a-f0-9]{64}$/.test(artifactId) || !["source", "manifest"].includes(part)) return res.status(400).json({ error: "research_artifact_id_invalid" });
  if (!storageAdmin) return res.status(503).json({ error: "research_artifact_store_unavailable" });
  try {
    const [bytes] = await storageAdmin.bucket().file(`research/artifacts/sha256/${artifactId}/${part === "source" ? "source" : "manifest.json"}`).download();
    if (part === "source" && createHash("sha256").update(bytes).digest("hex") !== artifactId) return res.status(409).json({ error: "research_artifact_changed" });
    if (part === "manifest") {
      let manifest: any;
      try { manifest = JSON.parse(bytes.toString("utf8")); } catch { return res.status(409).json({ error: "research_artifact_manifest_invalid" }); }
      if (manifest?.schema_version !== "blueprint.research-artifact.v1" || manifest.artifactId !== artifactId
        || manifest.sha256 !== artifactId || !Number.isSafeInteger(manifest.byteLength) || manifest.byteLength < 1) {
        return res.status(409).json({ error: "research_artifact_manifest_invalid" });
      }
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `attachment; filename="blueprint-research-${artifactId}${part === "manifest" ? ".json" : ""}"`);
    return res.type(part === "manifest" ? "application/json" : "application/octet-stream").send(bytes);
  } catch (error: any) {
    return res.status(error?.code === 404 ? 404 : 503).json({ error: "research_artifact_unavailable" });
  }
});
router.get("/research-admissions/:admissionId", async (req, res) => {
  const access = await resolveExecutionAccessContext(res);
  if (!access.isAdmin || !access.uid) return res.status(403).json({ error: "forbidden" });
  if (!/^[a-f0-9]{64}$/.test(req.params.admissionId)) return res.status(400).json({ error: "research_admission_id_invalid" });
  if (!dbAdmin) return res.status(503).json({ error: "reviewed_research_store_unavailable" });
  try {
    const snapshot = await dbAdmin.collection(REVIEWED_RESEARCH_ROOT).doc(req.params.admissionId).get();
    if (!snapshot.exists) return res.status(404).json({ error: "research_admission_missing" });
    const data = snapshot.data(), row = data?.row;
    try {
      // Verify the complete historical record, anchored to the requested ID.
      // Review-time freshness preserves valid archives without claiming current qualification.
      reviewedResearchPublication(data, { admissionId: req.params.admissionId, date: row?.date,
        candidateKey: row?.packet?.candidate?.candidate_key, packetDigest: row?.packet_digest, rawArtifactDigest: row?.raw_output_digest });
    } catch { return res.status(409).json({ error: "reviewed_research_source_changed" }); }
    res.setHeader("Cache-Control", "private, no-store");
    return res.json(data);
  } catch { return res.status(503).json({ error: "reviewed_research_store_unavailable" }); }
});
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
