import { Router } from "express";
import { requireExecutionRole } from "../middleware/requireAdminRole";
import { admitFreeWorkspaceEvaluation } from "../utils/freeEvaluationHandoff";
import { admitBetaPolicyFinalist } from "../utils/betaPolicyFinalist";

const router = Router();
router.use(requireExecutionRole);
router.post("/:requestId/admit", async (req, res) => {
  try {
    const admit = req.body?.finalistId === undefined ? admitFreeWorkspaceEvaluation : admitBetaPolicyFinalist;
    const result = await admit(req.params.requestId, req.body, res.locals.firebaseUser!.uid);
    return res.status(result.created ? 201 : 200).json({ ...result, customerPriceUsd: 0,
      executionStarted: false });
  } catch (error) {
    return res.status(409).json({ code: "free_evaluation_not_admitted",
      error: error instanceof Error ? error.message : "Free evaluation approval could not be verified." });
  }
});
export default router;
