#!/usr/bin/env -S npx tsx
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { consumerBindingSchema, consumerSelectionSchema, openResearchLearningSession } from "../../server/research-learning/consumer";
import type { DiscoveryQuery } from "../../server/research-learning/retrieval";

/** Portable operator/host command. Existing Admin credentials only. No writes
 * to Firestore, Sheets, Notion, Gmail, storage, leases, controls or pointers. */
async function main() {
  const flags = new Map<string, string>();
  const args = process.argv.slice(2);
  if (args.length !== 6) throw new Error("Usage: tsx scripts/research-learning/read-consumer.ts --binding HOST_SCOPE.json --request SELECTION.json --output NEW_EXPORT.json");
  for (let at = 0; at < args.length; at += 2) {
    if (!["--binding", "--request", "--output"].includes(args[at]) || flags.has(args[at]) || !args[at + 1]) throw new Error("learning_consumer_cli_arguments_invalid");
    flags.set(args[at], args[at + 1]);
  }
  if (!dbAdmin) throw new Error("learning_existing_admin_binding_unavailable");
  const binding = consumerBindingSchema.parse(JSON.parse(readFileSync(flags.get("--binding")!, "utf8")));
  const input = z.object({ selection: consumerSelectionSchema, queries: z.array(z.unknown()).max(20).default([]),
    history: z.array(z.object({ prospectId: z.string(), pageSize: z.number().int().min(1).max(25) }).strict()).max(10).default([]),
    siteHistory: z.array(z.object({ crmId: z.string(), pageSize: z.number().int().min(1).max(25) }).strict()).max(10).default([]),
    researchDetails: z.array(z.object({ prospectId: z.string(), pageSize: z.number().int().min(1).max(25) }).strict()).max(10).default([]),
    details: z.array(z.array(z.string()).max(5)).max(20).default([]) }).strict().parse(JSON.parse(readFileSync(flags.get("--request")!, "utf8")));
  const session = await openResearchLearningSession(dbAdmin, binding, input.selection);
  const artifact = { version: "blueprint.research-learning-consumer-export.v1", handoff: session.handoff,
    discoveryPages: input.queries.map(query => session.search(query as DiscoveryQuery)),
    detailReads: input.details.map(values => session.details(values)),
    historyPages: input.history.map(value => session.history(value.prospectId, { pageSize: value.pageSize, cursor: null })),
    siteHistoryPages: input.siteHistory.map(value => session.siteHistory(value.crmId, { pageSize: value.pageSize, cursor: null })),
    nativeResearchPages: input.researchDetails.map(value => session.researchDetails(value.prospectId, { pageSize: value.pageSize, cursor: null })),
    effects: { sourceWrites: 0, pointerWrites: 0, mailboxReads: 0, sends: 0, modelCalls: 0, storageTransfers: 0 },
    canonicalStorage: "Blueprint Firestore records and user-owned GitHub contracts; this portable JSON export has no Library or session dependency" };
  const output = resolve(flags.get("--output")!);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(artifact, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ output, contextHash: session.handoff.contextHash, role: binding.role,
    crmRows: session.handoff.priorResearch.crmRows.length, nativeProspects: session.handoff.priorContactAndOutcomes.prospects.length,
    cachedDirectoryEntries: session.handoff.discovery.firstPage.totalIndexed, classificationEnabled: false, effects: artifact.effects }));
}
main().catch(() => { console.error("learning_consumer_read_failed; inspect scope, existing binding and source contract without logging credentials or raw source data"); process.exitCode = 1; });
