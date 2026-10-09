import { randomUUID } from "node:crypto";
import { communicationsBriefSchema, communicationsDigest } from "./communications-contract";
import { COMMUNICATIONS_ROOT } from "./communications-store";
import { readResearchContactPage, type ContactPageReader } from "./communications-contact-fetch";

/** Fresh retrieval is evidence, not a license to change an assertion's date.
 * The existing reviewed-research intake alone can replace the blocked brief. */
export async function runCommunicationsFactRefresh(db: FirebaseFirestore.Firestore,
  readPage: ContactPageReader = readResearchContactPage, now = () => Date.now(), limit = 5) {
  const root = db.doc(COMMUNICATIONS_ROOT);
  const pending = await root.collection("refreshRequests").where("state", "in", ["pending", "running"]).limit(limit).get();
  for (const row of pending.docs) {
    const claim = randomUUID();
    const request = await db.runTransaction(async tx => {
      const value = (await tx.get(row.ref)).data();
      // Only a draft job's stale-fact request (CommunicationsStore.requestRefresh) is this worker's.
      // Intake contact gaps and research-owner refreshes carry no job; their owners claim them.
      // Job request IDs are hex job IDs, which sort before every `intake_` ID, so none waits behind them.
      if (!value || !value.job || typeof value.job !== "object") return null;
      if (!["pending", "running"].includes(value.state) || (value.leaseUntil || 0) > now()) return null;
      tx.update(row.ref, { state: "running", claim, leaseUntil: now() + 120_000, attempts: (value.attempts || 0) + 1 });
      return value;
    });
    if (!request) continue;
    const evidence: Array<Record<string, unknown>> = [];
    let reason: string | null = null;
    try {
      const brief = communicationsBriefSchema.parse((await root.collection("briefs").doc(request.job.briefId).get()).data());
      if (communicationsDigest(brief) !== request.job.briefDigest) throw new Error("research_brief_changed");
      const deadline = now() + 60_000;
      // One retained response per source, at most 16 facts and 128 KiB/page.
      const pages = new Map<string, Awaited<ReturnType<ContactPageReader>>>();
      for (const fact of brief.facts) {
        if (!pages.has(fact.sourceUrl)) pages.set(fact.sourceUrl, await readPage(fact.sourceUrl, fact.sourceUrl, deadline));
        const page = pages.get(fact.sourceUrl)!;
        const body = Buffer.from(page.bodyBase64, "base64");
        const digest = communicationsDigest({ ...page });
        // Bodies live separately to keep the request below Firestore's 1 MiB limit.
        await root.collection("refreshEvidence").doc(digest).set({ ...page, digest });
        evidence.push({ factId: fact.id, sourceUrl: fact.sourceUrl, evidenceDigest: digest,
          sourceCheckedAt: page.checkedAt, originalSourceCheckedAt: fact.sourceCheckedAt,
          assessment: body.toString("utf8").includes(fact.claim) ? "literal_match_requires_review" : "claim_not_verified",
          evidenceRef: `${COMMUNICATIONS_ROOT}/refreshEvidence/${digest}` });
      }
    } catch (error) {
      reason = error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : "source_refresh_unavailable";
    }
    await db.runTransaction(async tx => {
      const current = (await tx.get(row.ref)).data();
      if (current?.claim !== claim) return;
      // A fresh page cannot prove that an old deployment claim remains current.
      // Every completed request has inspectable evidence or an explicit unresolved reason.
      tx.update(row.ref, { state: "unresolved", reason: reason || "fresh_evidence_requires_research_qa",
        evidence, completedAt: now(), leaseUntil: 0, sendsAuthorized: false });
    });
  }
}
