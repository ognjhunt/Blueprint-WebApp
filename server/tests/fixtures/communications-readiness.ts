import { communicationsDigest } from "../../agents/communications-contract";
import { EVALUATION_READINESS_REF } from "../../agents/communications-readiness";
import { communicationsNow } from "./communications";

/** Synthetic owner-system evidence; no provider, API or production proof. */
export async function publishSyntheticReadiness(db: any, status: "available" | "unavailable" | "unknown", overrides: any = {}) {
  const recordRef = "pipelineCapabilityEvidence/synthetic-evaluation-access";
  const communicationsReadiness = { version: "blueprint.capability-readiness-evidence.v1", capabilityId: "evaluation_access",
    status, sourceSystem: "synthetic-pipeline", proofBasis: "owner_system", claimCeiling: "operational",
    checkedAt: new Date(communicationsNow - 1000).toISOString(), expiresAt: new Date(communicationsNow + 3600000).toISOString(),
    siteId: null, taskId: null, ...overrides };
  const record = { communicationsReadiness, testFixture: true };
  await db.doc(recordRef).set(record);
  await db.doc(EVALUATION_READINESS_REF).set({ version: "blueprint.evaluation-readiness-publication.v1",
    requiredCapabilities: [{ capabilityId: "evaluation_access", recordRef, recordDigest: communicationsDigest(record) }] });
  return { recordRef, record };
}
