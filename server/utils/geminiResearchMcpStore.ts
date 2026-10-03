import { createHash } from "node:crypto";
import { dbAdmin, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import type { WorkStore } from "./blueprintWorkOAuth";
import type { ResearchArtifacts, ResearchEvidence } from "./geminiResearchMcp";
import { withTaskEvaluationLaunchStoreTimeout } from "./taskEvaluationLaunchStore";

// Separate company-owned research state; existing run/OAuth grants do not
// imply research spending or private-report access.
export const GEMINI_RESEARCH_COLLECTION = "blueprintResearchMcp";
export const geminiResearchStore: WorkStore = {
  async get(key) {
    if (!dbAdmin) throw new Error("research_company_store_unavailable");
    const doc = await withTaskEvaluationLaunchStoreTimeout(dbAdmin.collection(GEMINI_RESEARCH_COLLECTION).doc(key).get());
    return doc.exists ? doc.data() : undefined;
  },
  async set(key, value) {
    if (!dbAdmin) throw new Error("research_company_store_unavailable");
    await withTaskEvaluationLaunchStoreTimeout(dbAdmin.collection(GEMINI_RESEARCH_COLLECTION).doc(key).set(value));
  },
  async transaction(action) {
    if (!dbAdmin) throw new Error("research_company_store_unavailable");
    const collection = dbAdmin.collection(GEMINI_RESEARCH_COLLECTION);
    return withTaskEvaluationLaunchStoreTimeout(dbAdmin.runTransaction(async transaction => action({
      async get(key) { const row = await transaction.get(collection.doc(key)); return row.exists ? row.data() : undefined; },
      set(key, value) { transaction.set(collection.doc(key), value); },
      delete(key) { transaction.delete(collection.doc(key)); },
    })));
  },
};
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const bucketName = "blueprint-8c1ca.appspot.com";
function evidenceFile(receipt: ResearchEvidence) {
  if (!storageAdmin) throw new Error("research_private_evidence_store_unavailable");
  const object = `operations/research/gemini/${receipt.sha256}.json`;
  if (!/^[a-f0-9]{64}$/.test(receipt.sha256) || receipt.artifactRef !== `gs://${bucketName}/${object}`)
    throw new Error("research_evidence_binding_invalid");
  return storageAdmin.bucket(bucketName).file(object, { generation: receipt.generation });
}
export const geminiResearchArtifacts: ResearchArtifacts = {
  async retain(value) {
    if (!storageAdmin) throw new Error("research_private_evidence_store_unavailable");
    const bytes = Buffer.from(JSON.stringify(value)), digest = sha(bytes);
    const object = `operations/research/gemini/${digest}.json`;
    const file = storageAdmin.bucket(bucketName).file(object);
    try { await file.save(bytes, { resumable: false, contentType: "application/json", preconditionOpts: { ifGenerationMatch: 0 } }); }
    catch (error: any) { if (Number(error.code) !== 412) throw error; }
    const [metadata] = await file.getMetadata();
    const receipt = { artifactRef: `gs://${bucketName}/${object}`, sha256: digest, bytes: bytes.length, generation: String(metadata.generation) };
    const [retained] = await evidenceFile(receipt).download();
    if (sha(retained) !== digest || retained.length !== bytes.length) throw new Error("research_evidence_readback_failed");
    return receipt;
  },
  async read(receipt) {
    const [bytes] = await evidenceFile(receipt).download();
    if (sha(bytes) !== receipt.sha256 || bytes.length !== receipt.bytes) throw new Error("research_evidence_readback_failed");
    return JSON.parse(bytes.toString("utf8"));
  },
};
