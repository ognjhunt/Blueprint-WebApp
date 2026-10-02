import { readFile } from "node:fs/promises";
import { retainSpendSnapshot } from "../../server/utils/spend-evidence-publication";

// Company-owned retained-byte ingress. Not a provider collector or scheduler.
// Usage: npx tsx scripts/autonomy/retain-spend-evidence.ts snapshot.json provenance.json
const [snapshotFile, provenanceFile] = process.argv.slice(2);
if (!snapshotFile || !provenanceFile) throw new Error("snapshot_and_provenance_files_required");
const result = await retainSpendSnapshot(await readFile(snapshotFile), JSON.parse(await readFile(provenanceFile, "utf8")));
console.log(JSON.stringify(result));
