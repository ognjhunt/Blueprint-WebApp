import router from "../server/routes/ai-studio";
import { dbAdmin } from "../client/src/lib/firebaseAdmin";

async function main() {
  if (!dbAdmin) {
    throw new Error("dbAdmin is null. Ensure Firebase Admin credentials are configured.");
  }

  // Ensure the route can be imported without crashing (sanity check).
  if (!router) {
    throw new Error("ai-studio router failed to import.");
  }

  const testRef = dbAdmin
    .collection("__adminSmokeTests")
    .doc("aiStudioRouteHealthcheck");

  await testRef.set({
    status: "ok",
    checkedAt: new Date().toISOString(),
    note: "admin-smoke-ai-studio.ts",
  });

  const snapshot = await testRef.get();

  console.log("dbAdmin available:", Boolean(dbAdmin));
  console.log("ai-studio router loaded:", Boolean(router));
  console.log("Firestore write succeeded:", snapshot.exists, snapshot.data());
}

main().catch((error) => {
  console.error("Admin smoke test failed:", error);
  process.exit(1);
});
