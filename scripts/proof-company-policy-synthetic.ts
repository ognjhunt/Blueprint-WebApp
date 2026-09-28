/** Local synthetic bridge; never touches production Firestore or Firebase auth. */
import fs from "node:fs";
import crypto from "node:crypto";
import {createRequire} from "node:module";
import express from "express";

async function main() {
  const configPath = process.argv[2];
  if (!configPath || process.argv[3] !== "synthetic-local-emulator-only") {
    throw new Error("Supply a protected config path and synthetic-local-emulator-only acknowledgement.");
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if ((fs.statSync(configPath).mode & 0o077) !== 0) throw new Error("Config must be owner-only.");
  process.env.NODE_ENV = "development";
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8788";
  process.env.GOOGLE_CLOUD_PROJECT = "demo-blueprint-policy-proof";
  process.env.GCLOUD_PROJECT = "demo-blueprint-policy-proof";
  process.env.BLUEPRINT_LOCAL_WEBAPP_ROUTE_PROOF_AUTH_TOKEN = config.auth_token;
  process.env.FIELD_ENCRYPTION_MASTER_KEY = config.encryption_key;
  delete process.env.FIELD_ENCRYPTION_KMS_KEY_NAME;
  process.env.COMPANY_POLICY_ALLOWED_REGISTRIES = config.registry_host;
  process.env.COMPANY_POLICY_CREDENTIAL_BROKER_TOKEN = config.broker_token;
  process.env.PIPELINE_SYNC_TOKEN = config.pipeline_token;
  process.env.COMPANY_POLICY_CONTAINER_FORWARD_URL = "http://127.0.0.1:8801/api/live-pipeline/company-policy-containers";
  process.env.COMPANY_POLICY_CONTAINER_FORWARD_REQUIRED = "true";
  const require = createRequire(import.meta.url);
  const {dbAdmin: db} = require("../client/src/lib/firebaseAdmin");
  if (!db) throw new Error("Emulator store unavailable");
  const candidates = require("../server/routes/company-policy-candidates").default;
  const credentials = require("../server/routes/internal-company-policy-registry-credentials").default;
  const {processCompanyPolicyCandidateOutbox} = require("../server/utils/companyPolicyCandidateOutboxWorker");
  const runId = "blueprint-synthetic-policy-proof-20260928";
  await db.collection("robotEvalJobRequests").doc(runId).set({
    buyer_user_id: "local-webapp-route-proof", status: "prepared_agent_execution",
    synthetic: true, claim_ceiling: "development_only", evaluationPurpose: "private",
    decision_request: {owner: {user_id: "local-webapp-route-proof"}},
  });
  const app = express();
  app.use(express.json({limit: "1mb", verify: (req: any, _res, bytes) => {req.rawBody = bytes.toString("utf8");}}));
  app.use("/api/task-evaluation-runs", candidates);
  app.use("/api/internal/pipeline", credentials);
  let submissionId = "";
  let leaseId = "";
  app.get("/proof/status", async (_req, res) => {
    const candidate = (await db.collection("companyPolicyCandidateSubmissions").doc(submissionId).get()).data();
    const lease = (await db.collection("companyPolicyRegistryCredentialLeases").doc(leaseId).get()).data();
    res.json({status: candidate?.status, admission_id: lease?.admission_id,
      admission_digest: lease?.admission_digest, lease_id: leaseId,
      ciphertext_deleted: lease?.ciphertext_deleted === true,
      ciphertext_present: Boolean(lease?.encrypted_credential), lease_status: lease?.status,
      launch_authority_granted: candidate?.launch_authority_granted});
  });
  const server = app.listen(8802, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const headers = {Authorization: `Bearer ${config.auth_token}`, "Content-Type": "application/json",
    Cookie: "csrf_token=synthetic-proof", "X-CSRF-Token": "synthetic-proof"};
  const base = `http://127.0.0.1:8802/api/task-evaluation-runs/${runId}`;
  const contextResponse = await fetch(`${base}/policy-candidate-context`, {headers});
  const context = await contextResponse.json() as any;
  if (!contextResponse.ok) throw new Error(`Context failed: ${context.code}`);
  const contract = JSON.parse(fs.readFileSync(`${config.proof_root}/contract.json`, "utf8"));
  contract.company_id = context.company_id;
  delete contract.contract_digest;
  const admitted = await fetch(`${base}/policy-candidates`, {method: "POST", headers,
    body: JSON.stringify({contract, idempotency_key: `synthetic-${crypto.randomUUID()}`})});
  const payload = await admitted.json() as any;
  if (!admitted.ok) throw new Error(`Candidate failed: ${JSON.stringify(payload)}`);
  submissionId = payload.candidate.submission_id;
  const leased = await fetch(`${base}/policy-candidates/${submissionId}/registry-credential`, {method: "PUT", headers,
    body: JSON.stringify({schema_version: "company_policy_registry_credential_lease.v1",
      submission_id: submissionId, contract_digest: payload.candidate.contract_digest,
      image: config.image, registry_username: "oauth2accesstoken",
      registry_secret: fs.readFileSync(`${config.proof_root}/registry_token`, "utf8").trim(),
      expires_in_seconds: 300, idempotency_key: `synthetic-lease-${crypto.randomUUID()}`})});
  const leasePayload = await leased.json() as any;
  if (!leased.ok) throw new Error(`Lease failed: ${JSON.stringify(leasePayload)}`);
  fs.unlinkSync(`${config.proof_root}/registry_token`);
  leaseId = leasePayload.credential_lease.lease_id;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await processCompanyPolicyCandidateOutbox(10);
    if ((await db.collection("companyPolicyCandidateSubmissions").doc(submissionId).get()).data()?.status === "admitted_no_spend") break;
  }
  const stored = (await db.collection("companyPolicyCandidateSubmissions").doc(submissionId).get()).data();
  if (stored.status !== "admitted_no_spend") throw new Error(`Forward failed: ${JSON.stringify(stored.pipeline_handoff)}`);
  const proof = {schema_version: "blueprint_owned_synthetic_webapp_admission_proof.v1",
    firebase_auth: "local_development_route_proof", datastore: "firestore_emulator",
    production_webapp_tested: false, real_observation_used: false,
    run_id: runId, candidate: stored, credential_lease_id: leaseId};
  fs.writeFileSync(`${config.proof_root}/webapp-admission.json`, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({status: stored.status, submission_id: submissionId,
    admission_id: stored.pipeline_handoff.admission_id, credential_lease_id: leaseId}));
}
main().catch((error) => {console.error(error.message); process.exit(1);});
