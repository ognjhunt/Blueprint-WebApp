import { z } from "zod";
import { communicationsDigest } from "./communications-contract";
import { contactFetchUrl } from "./communications-contact-fetch";
import { COMMUNICATIONS_ROOT } from "./communications-store";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
/** Shared with the pinned daily research host. These are evidence requests,
 * never additional inference, disclosure, spending or sending authority. */
export const contactDiscoverySchema = z.object({
  version: z.literal("blueprint.contact-research-discovery.v1"), requestId: digest, sourceDigest: digest,
  run: z.object({ date: z.string().date(), runKey: z.string().min(1), rowBlob: digest,
    rawArtifactDigest: digest, qaArtifactDigest: digest }).strict(),
  sources: z.array(z.object({ url: z.string().url(), callId: z.string().min(1).max(200),
    resultSha256: digest, rawSourceSha256: digest, checkedAt: z.string().datetime({ offset: true }) }).strict()).min(1).max(3),
}).strict();
export type ContactDiscovery = z.infer<typeof contactDiscoverySchema>;
export async function verifyExistingContactDiscovery(db: FirebaseFirestore.Firestore, task: ReturnType<typeof contactResearchTask>, proof: ContactDiscovery) {
  const base = resolve("dist/daily-research/release/tools/daily_research");
  const [{ Store }, { verifyContactResearchDiscovery }] = await Promise.all([
    import(/* @vite-ignore */ pathToFileURL(resolve(base, "firestore_bridge.mjs")).href),
    import(/* @vite-ignore */ pathToFileURL(resolve(base, "contact_research.mjs")).href),
  ]);
  return verifyContactResearchDiscovery(new Store(db), task, proof);
}
export const recoverableContactGap = (reason: string) => /^(?:contact_resolution_(?:missing_or_ambiguous|ambiguous_segment|visibility_unverified|markup_unsupported|markup_limit|body_invalid|total_size_limit)|contact_fetch_(?:size_limit|response_forbidden|page_unavailable|deadline))$/.test(reason);

export function contactResearchTask(source: any, prospectId: string) {
  const publication = { date: source.date, runKey: source.runKey, candidateKey: source.candidate.candidate_key,
    packetDigest: source.packetDigest, rawArtifactDigest: source.rawArtifactDigest, sourceDigest: communicationsDigest(source),
    qaArtifactDigest: source.qaArtifactDigest, researchQaReference: source.researchReview.reviewer_reference,
    sheetsId: source.sheetsId, sheetsProspectId: source.sheetsProspectId, prospectId };
  const sourceDigest = communicationsDigest(source);
  const requestId = communicationsDigest({ publication, sourceDigest });
  return { version: "blueprint.contact-research-request.v1", requestId, sourceDigest, publication,
    organization: source.candidate.organization, organizationUrl: source.candidate.organization_url,
    site: source.candidate.site, location: source.candidate.location, task: source.candidate.task,
    sourceUrls: [...new Set((source.candidate.evidence ?? []).map((x: any) => x.url as string))].slice(0, 16),
    preference: ["relevant_professional_person", "appropriate_team_inbox", "general_business_inbox"],
    // Historical task-binding metadata; neither consumer nor research host uses it as an admission cap.
    maxAgentAttempts: 2, scope: "existing_daily_research_budget_and_tools_no_new_session_or_send" };
}

/** Idempotently hand a bounded gap back to the existing research agent. New
 * daily roots/budget are still admitted by that worker's original policy. */
export async function requestNativeContactResearch(db: FirebaseFirestore.Firestore, source: any,
  prospectId: string, reason: string, now: number) {
  if (!recoverableContactGap(reason)) return false;
  const task = contactResearchTask(source, prospectId), ref = db.doc(COMMUNICATIONS_ROOT).collection("contactResearchRequests").doc(task.requestId);
  return db.runTransaction(async tx => {
    const saved = await tx.get(ref);
    if (saved.exists) {
      if (communicationsDigest(saved.data()?.task) !== communicationsDigest(task)) throw new Error("contact_research_source_changed");
      if (saved.data()?.state === "sources_ready") {
        const attempts = saved.data()?.attempts;
        const attemptsValid = Number.isSafeInteger(attempts) && attempts >= 1;
        tx.set(ref, { state: attemptsValid ? "pending" : "blocked",
          reason: attemptsValid ? "agent_sources_did_not_establish_suitable_contact" : "contact_research_attempt_count_invalid", lastDiscoveryDigest: communicationsDigest(saved.data()?.discovery),
          completedAt: now }, { merge: true });
        return attemptsValid;
      }
      return ["pending", "running", "sources_ready"].includes(saved.data()?.state);
    }
    tx.create(ref, { task, state: "pending", attempts: 0, owner: "blueprint-research-agent",
      reason, requestedAt: now, sent: false, separateSessionAuthorized: false });
    return true;
  });
}

export async function readNativeContactDiscovery(db: FirebaseFirestore.Firestore, source: any,
  prospectId: string, verifyNative = verifyExistingContactDiscovery) {
  const task = contactResearchTask(source, prospectId);
  const record = (await db.doc(COMMUNICATIONS_ROOT).collection("contactResearchRequests").doc(task.requestId).get()).data();
  if (record?.state === "exhausted") throw new Error("contact_agent_research_exhausted");
  if (record?.state === "blocked") throw new Error("contact_agent_research_proof_invalid");
  if (!record || record.state !== "sources_ready") return null;
  if (communicationsDigest(record.task) !== communicationsDigest(task)) throw new Error("contact_research_source_changed");
  const proof = contactDiscoverySchema.parse(record.discovery);
  if (proof.requestId !== task.requestId || proof.sourceDigest !== task.sourceDigest) throw new Error("contact_research_source_changed");
  for (const s of proof.sources) contactFetchUrl(s.url, source.candidate.organization_url);
  await verifyNative(db, task, proof);
  return proof;
}
