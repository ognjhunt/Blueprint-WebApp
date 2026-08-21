import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { InboundRequest, InboundRequestStored } from "../types/inbound-request";
import { decryptInboundRequestForAdmin } from "../utils/field-encryption";
import { projectPilotOpportunityForRobotTeam } from "../utils/pilot-opportunity-projection";

const router = Router();

router.get("/", async (_req, res) => {
  if (!db) return res.status(503).json({ error: "Database not available" });

  const firebaseUser = res.locals.firebaseUser as
    | { uid?: string; email?: string; email_verified?: boolean }
    | undefined;
  const uid = String(firebaseUser?.uid || "").trim();
  if (!uid) return res.status(401).json({ error: "Authentication required" });

  const userSnapshot = await db.collection("users").doc(uid).get();
  if (!userSnapshot.exists) return res.status(403).json({ error: "Robot-team account required" });
  const user = (userSnapshot.data() || {}) as Record<string, unknown>;
  if (String(user.buyerType || "") !== "robot_team") {
    return res.status(403).json({ error: "Robot-team account required" });
  }

  const email = String(firebaseUser?.email || user.email || "").trim().toLowerCase();
  if (!email || firebaseUser?.email_verified !== true) {
    return res.status(403).json({ error: "Verified robot-team email required" });
  }

  const snapshot = await db
    .collection("inboundRequests")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  const projected = await Promise.all(
    snapshot.docs.map(async (document) => {
      try {
        const record = (await decryptInboundRequestForAdmin(
          document.data() as InboundRequestStored,
        )) as unknown as InboundRequest;
        return projectPilotOpportunityForRobotTeam(record, email);
      } catch {
        return null;
      }
    }),
  );

  return res.json({
    ok: true,
    opportunities: projected.filter(Boolean),
    proof_boundary:
      "This private feed includes only permission-matched, gate-passed site opportunities. It does not establish deployment readiness, robot performance, safety approval, or a physical pilot outcome.",
  });
});

export default router;
