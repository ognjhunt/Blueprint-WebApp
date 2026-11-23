/**
 * The owner hears about a provider outage once: one ops alert per provider and cause when it starts, through the
 * server's existing ops alert (`opsProcessAlerts.ts`), never one per job or per pass. The episode is kept on a small
 * record per provider and cause, so a restart does not repeat it; a reading that the provider answers closes the
 * provider's episodes, and the next outage alerts again.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { sendRateLimitedOpsAlert } from "./opsProcessAlerts";
import { providerOutageAlertText, type ProviderOutage } from "./providerOutage";

export const PROVIDER_OUTAGE_ALERTS_COLLECTION = "providerOutageAlerts";

export async function noteProviderOutage(outage: ProviderOutage): Promise<void> {
  if (!db) return;
  const store = db;
  try {
    const ref = store.collection(PROVIDER_OUTAGE_ALERTS_COLLECTION).doc(`${outage.provider}-${outage.cause}`);
    const opened = await store.runTransaction(async tx => {
      if ((await tx.get(ref)).data()?.open === true) return false;
      tx.set(ref, { provider: outage.provider, cause: outage.cause, open: true, opened_at_ms: Date.now() }, { merge: true });
      return true;
    });
    if (!opened) return;
    const waiting = await store.collection("captureCoverageReviews").where("state", "==", "waiting_provider")
      .where("provider_outage.provider", "==", outage.provider).where("provider_outage.cause", "==", outage.cause).limit(500).get();
    await sendRateLimitedOpsAlert(`provider_outage:${outage.provider}:${outage.cause}`, providerOutageAlertText(outage, Math.max(1, waiting.docs.length)));
  } catch (error) {
    logger.warn({ error, provider: outage.provider, cause: outage.cause }, "Provider outage alert could not be recorded");
  }
}

export async function closeProviderOutageAlerts(provider: string): Promise<void> {
  if (!db) return;
  try {
    const open = await db.collection(PROVIDER_OUTAGE_ALERTS_COLLECTION).where("provider", "==", provider).where("open", "==", true).get();
    for (const row of open.docs) await row.ref.set({ open: false, closed_at_ms: Date.now() }, { merge: true });
  } catch (error) {
    logger.warn({ error, provider }, "Provider outage alert could not be closed");
  }
}
