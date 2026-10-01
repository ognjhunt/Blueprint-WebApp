import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { importFirebaseAdmin, reexecWithEnvProxy, WEBAPP_ROOT } from "../cloud/runtime";
import { hash, id, instant, LEARNING_ROOT } from "../../server/research-learning/contract";
import { CRM_SHEET_ID, SOURCE_ROOT, reconcilePriorResearch, type SourceGrant, type SourceRequest } from "../../server/research-learning/prior-research";
import { ResearchSourceStore } from "../../server/research-learning/source-store";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const manifestSchema = z.object({ spreadsheetId: z.literal(CRM_SHEET_ID), complete: z.literal(true),
  range: z.literal("Prospects!A1:Z1000"), headers: z.array(z.string()).max(26),
  rows: z.array(z.object({ crmId: id, rowHash: hash }).strict()).max(100),
  recordedAt: instant, providerReadTimestampAvailable: z.literal(false),
  expectedSourceHashes: z.object({ crm: hash, knowledge: hash }).strict(),
}).strict();

/** Uses only the two read-only methods of the installed, immutable bridge.
 * Does not call refresh, lease, run, publish, Gmail, Notion or a model. */
async function main() {
  reexecWithEnvProxy();
  const args = process.argv.slice(2), flags = new Map<string, string>(); let stage = false;
  while (args.length) {
    const key = args.shift()!;
    if (key === "--stage") { stage = true; continue; }
    if (!["--manifest", "--output", "--as-of", "--expected-snapshot-id"].includes(key) || !args.length || flags.has(key)) throw new Error("learning_reconcile_arguments_invalid");
    flags.set(key, args.shift()!);
  }
  if (!flags.has("--manifest") || (stage && (!flags.has("--expected-snapshot-id") || !flags.has("--as-of")))) throw new Error("learning_reconcile_manifest_or_review_missing");
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(flags.get("--manifest")!, "utf8")));
  const startedAt = new Date().toISOString();
  if (Date.parse(startedAt) - Date.parse(manifest.recordedAt) > 3600000 || manifest.recordedAt > startedAt) throw new Error("learning_independent_read_stale");
  const archive = path.join(WEBAPP_ROOT, "vendor/daily-research/blueprint-research.tar");
  const archiveHash = sha(readFileSync(archive));
  // Pin this reviewed extraction path. A Pipeline release gets its own review.
  if (archiveHash !== "1aa932767fe9ec73c06ece6b5ba1e573027a636a3249363d62df7bf6415a3651") throw new Error("learning_source_binding_pin_changed");
  const bindingDir = path.join(WEBAPP_ROOT, "output/research-learning/source-binding", archiveHash);
  mkdirSync(bindingDir, { recursive: true });
  for (const filename of ["firestore_bridge.mjs", "publisher.mjs"]) {
    writeFileSync(path.join(bindingDir, filename), execFileSync("tar", ["-xOf", archive, `tools/daily_research/${filename}`]), { mode: 0o600 });
  }
  const { dbAdmin } = await importFirebaseAdmin();
  if (!dbAdmin) throw new Error("learning_existing_firestore_binding_unavailable");
  const { Store } = await import(pathToFileURL(path.join(bindingDir, "firestore_bridge.mjs")).href);
  const source = new Store(dbAdmin);
  const readFile = async (name: string) => {
    const bytes = Buffer.from(await source.fileGet(name), "base64");
    return { value: JSON.parse(bytes.toString("utf8")), hash: sha(bytes) };
  };
  const [crm, knowledge, prospects, runs, jobs, briefs, outcomes] = await Promise.all([
    readFile("crm.json"), readFile("knowledge.json"),
    dbAdmin.collection("outboundProspects").select("researchPublicationId", "siteId", "taskId", "caseId").limit(201).get(),
    dbAdmin.doc(SOURCE_ROOT).collection("runs").select("date", "state").limit(101).get(),
    dbAdmin.doc("blueprintCommunications/default").collection("jobs").select("prospectId", "briefId").limit(101).get(),
    dbAdmin.doc("blueprintCommunications/default").collection("briefs").select("briefId", "prospectId").limit(101).get(),
    dbAdmin.doc(LEARNING_ROOT).collection("events").select("eventId", "entities.prospectId").limit(101).get(),
  ]);
  if (prospects.size > 200 || [runs, jobs, briefs, outcomes].some(rows => rows.size > 100)) throw new Error("learning_bounded_source_export_required");
  if (crm.hash !== manifest.expectedSourceHashes.crm || knowledge.hash !== manifest.expectedSourceHashes.knowledge) throw new Error("learning_source_hash_changed");
  const canonical = prospects.docs.filter(doc => manifest.rows.some(row => row.crmId === doc.data().researchPublicationId)).map(doc => {
    const data = doc.data();
    return { crmId: data.researchPublicationId, prospectId: doc.id, siteId: data.siteId ?? null, taskId: data.taskId ?? null, caseId: data.caseId ?? null };
  });
  const now = new Date().toISOString(), asOf = instant.parse(flags.get("--as-of") ?? now);
  const request: SourceRequest = { crmIds: manifest.rows.map(row => row.crmId), capabilityIds: knowledge.value.records.map((record: any) => record.record_id), sections: ["crm", "capabilities", "site_learning"], asOf };
  const grant: SourceGrant = { crmIds: request.crmIds, capabilityIds: request.capabilityIds, sections: request.sections,
    principalId: "shared-learning-reconciler", expiresAt: new Date(Date.parse(now) + 86400000).toISOString() };
  const result = reconcilePriorResearch({ crm: crm.value, crmSourceHash: crm.hash, knowledge: knowledge.value, knowledgeSourceHash: knowledge.hash,
    independentHeaders: manifest.headers, independentRows: manifest.rows, canonical,
    researchRuns: runs.docs.map(doc => ({ date: doc.data().date, state: doc.data().state, recordRef: `${SOURCE_ROOT}/runs/${doc.id}` })) }, grant, request, now);
  const targets = { reads: [`${SOURCE_ROOT}/files/crm.json`, `${SOURCE_ROOT}/files/knowledge.json`, "outboundProspects", `${SOURCE_ROOT}/runs`,
    "blueprintCommunications/default/jobs", "blueprintCommunications/default/briefs", `${LEARNING_ROOT}/events`],
    append: `${LEARNING_ROOT}/sourceSnapshots/${result.snapshot.snapshotId}`, activePointerChanged: false, sheetsWrites: 0, notionWrites: 0, mailboxReads: 0, sends: 0, modelCalls: 0 };
  let staged: "disabled" | "created" | "existing" = "disabled", scopedReadbackId: string | null = null;
  if (stage) {
    if (!result.readyForStagedAppend || flags.get("--expected-snapshot-id") !== result.snapshot.snapshotId) throw new Error("learning_reviewed_snapshot_changed");
    const [crmAgain, knowledgeAgain] = await Promise.all([readFile("crm.json"), readFile("knowledge.json")]);
    if (crmAgain.hash !== crm.hash || knowledgeAgain.hash !== knowledge.hash) throw new Error("learning_source_changed_during_reconciliation");
    const store = new ResearchSourceStore(dbAdmin);
    staged = await store.stage(result, grant, request);
    const readback = await store.read(result.snapshot.snapshotId, grant, request);
    scopedReadbackId = readback.snapshotId;
    if (readback.parentSnapshotId !== result.snapshot.snapshotId) throw new Error("learning_staged_readback_mismatch");
  }
  const report = { ...result, recordedAt: new Date().toISOString(), independentRead: { recordedAt: manifest.recordedAt, providerReadTimestampAvailable: false },
    binding: { archiveHash, source: "existing_pinned_Store.fileGet", credentialBinding: "existing_admin_environment" },
    historyInventory: { nativeProspects: prospects.size, communicationsJobs: jobs.size, communicationsBriefs: briefs.size, normalizedEvents: outcomes.size },
    targets, staged, scopedReadbackId };
  if (flags.has("--output")) writeFileSync(flags.get("--output")!, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify({ version: report.version, counts: result.counts, errors: result.errors, snapshotId: result.snapshot.snapshotId, asOf,
    historyInventory: report.historyInventory, staged, scopedReadbackId, readyForCutover: false, targets }, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
main().catch((error: unknown) => {
  const code = error instanceof Error && /^learning_[a-z_]+$/.test(error.message) ? error.message : "learning_reconcile_input_or_binding_invalid";
  console.error(code); process.exitCode = 1;
});
