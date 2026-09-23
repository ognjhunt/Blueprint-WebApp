/**
 * doctor.sh's Firestore check: read at most one inboundRequests document
 * through the repo's Firebase Admin helper and print only how many came back.
 *
 *   npx tsx scripts/cloud/firestore-probe.ts   # -> "firestore-probe count=1"
 *
 * Exit 0 on a successful read, 2 without credentials, 1 on any other error.
 */
import { importFirebaseAdmin, reexecWithEnvProxy } from "./runtime";

reexecWithEnvProxy();

try {
  const { dbAdmin } = await importFirebaseAdmin();
  if (!dbAdmin) {
    console.log("firestore-probe error=no-credentials");
    process.exit(2);
  }
  const snapshot = await dbAdmin.collection("inboundRequests").limit(1).get();
  console.log(`firestore-probe count=${snapshot.size}`);
  process.exit(0);
} catch (error) {
  const code = (error as { code?: unknown }).code;
  const message = error instanceof Error ? error.message.split("\n")[0].slice(0, 160) : String(error);
  console.log(`firestore-probe error=${code ?? "unknown"} ${message}`);
  process.exit(1);
}
