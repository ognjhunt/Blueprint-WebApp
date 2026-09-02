import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { streamTaskEvaluationResultArtifact } from "../utils/taskEvaluationResultArtifactProxy";
import { verifyTaskEvaluationResultDownloadTicket } from "../utils/taskEvaluationResultDownloadTicket";
import { parseVerifiedTaskEvaluationRunPublication } from "../utils/taskEvaluationRunContract";
import { publicationFromResultRecord } from "../utils/taskEvaluationRunPublicationStorage";

const router = Router();

router.get("/:recordId/:artifactId", async (req, res) => {
  const { recordId, artifactId } = req.params;
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(recordId)
    || !/^[0-9a-f]{32}$/.test(artifactId)
    || !verifyTaskEvaluationResultDownloadTicket(
      recordId,
      artifactId,
      req.query.expires,
      req.query.signature,
    )
  ) return res.status(404).json({ error: "Result download is unavailable" });
  if (!db) return res.status(503).json({ error: "Task Evaluation Result store is unavailable" });
  let snapshot;
  try {
    snapshot = await db.collection("captureTaskEvaluationRuns").doc(recordId).get();
  } catch {
    return res.status(503).json({ error: "Task Evaluation Result store is unavailable" });
  }
  if (!snapshot.exists) return res.status(404).json({ error: "Result download is unavailable" });
  const record = snapshot.data() as Record<string, unknown>;
  const verified = parseVerifiedTaskEvaluationRunPublication(
    publicationFromResultRecord(record),
  );
  if (
    !verified.ok
    || (
      verified.publication.schema_version !== "task_evaluation_run_publication.v2"
      && verified.publication.schema_version !== "task_evaluation_run_publication.v3"
    )
  ) {
    return res.status(404).json({ error: "Result download is unavailable" });
  }
  const delivery = verified.publication.result_delivery;
  const admitted = delivery.status === "ready"
    && delivery.artifacts.some((artifact) => artifact.artifact_id === artifactId);
  if (!admitted) return res.status(404).json({ error: "Result download is unavailable" });
  await streamTaskEvaluationResultArtifact({
    runId: verified.publication.run_id,
    artifactId,
    req,
    res,
  });
});

export default router;
