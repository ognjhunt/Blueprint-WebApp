import { vi } from "vitest";
import { hypothesisPublicationSource } from "../../agents/communications-research";
import { resolveHypothesisContact } from "../../agents/communications-contact-resolution";
import { COMMUNICATIONS_ROOT } from "../../agents/communications-store";
import { communicationsDigest, type CommunicationsBrief, type CommunicationsOutput } from "../../agents/communications-contract";
import type { ContactPage } from "../../agents/communications-contact-fetch";
import { RESEARCH_WORK_ITEMS } from "../../agents/communications-intake";
import { communicationsNow, memoryFirestore } from "./communications";
import { publishedResearchFixture } from "./published-research";

// Invented operators, *.example hosts and synthetic evidence only. No network, model or mailbox.
export const QUESTION = "Which parts of sorting returned parcels at Synthetic sorting site still need people, and what has kept them from being automated?";
export const ADDRESS = "sortingops@hypothesis-operator.example";
const htmlPage = (url: string, body: string, checkedAt: string): ContactPage => ({ requestedUrl: url, finalUrl: url, redirects: [], checkedAt,
  status: 200, contentType: "text/html; charset=utf-8", bodyBase64: Buffer.from(body).toString("base64") });

/** A published day with one verified row and one outreach-ready hypothesis, an in-memory store and a
 * synthetic operator site to read contacts from. Invented operators and *.example hosts only. */
export function hypothesisSetup(options: Parameters<typeof publishedResearchFixture>[0] = {}) {
  const f = publishedResearchFixture({ publicContact: true, outreachReady: "published", retainedTier: true, ...options });
  const db = memoryFirestore();
  let time = communicationsNow;
  let contactBody = `<p>Synthetic hypothesis operator operations team for sorting returned parcels: ${ADDRESS}</p>`;
  const readContactPage = vi.fn(async (url: string) => {
    const host = new URL(url).hostname;
    if (host !== "hypothesis-operator.example") throw new Error("contact_fetch_page_unavailable");
    return htmlPage(url, new URL(url).pathname === "/contact" ? contactBody
      : `<p>Synthetic hypothesis operator</p><a href="https://hypothesis-operator.example/contact">Contact</a>`, new Date(time).toISOString());
  });
  const deps = { db, readResearch: vi.fn(async (_date: string) => f.snapshot), isSuppressed: vi.fn(async (_email: string) => false),
    now: () => time, readContactPage };
  const records = (name: string) => [...db.records.entries()].filter(([key]) => key.startsWith(`${COMMUNICATIONS_ROOT}/${name}/`)).map(([, value]) => value);
  const workItem = () => db.doc(`${RESEARCH_WORK_ITEMS}/${f.snapshot.row.date}`).set({ date: f.snapshot.row.date,
    run_key: f.snapshot.row.run_key, packet_digest: f.snapshot.row.packet_digest, stage: "completed" });
  const hypothesisIntake = () => records("intake").find(item => item.candidateKey === f.hypothesis.candidate_key);
  const resolution = async () => {
    const { source, personEvidence } = hypothesisPublicationSource(f.snapshot, f.hypothesis.candidate_key, time);
    const proof = await resolveHypothesisContact(source, `research-${communicationsDigest({ sheetsId: source.sheetsId, sheetsProspectId: source.sheetsProspectId })}`,
      readContactPage, () => time, personEvidence);
    // The contact worker's own claim: a running request with its lease, for this hypothesis.
    const row = f.snapshot.row;
    await db.doc(`${COMMUNICATIONS_ROOT}/refreshRequests/synthetic-request`).set({ date: row.date, runKey: row.run_key,
      candidateKey: f.hypothesis.candidate_key, packetDigest: row.packet_digest, rawArtifactDigest: row.raw_output_digest, label: "hypothesis",
      kind: "public_contact_resolution", state: "running", lease: { owner: "synthetic-owner", until: time + 180000 } });
    return { proof, requestId: "synthetic-request", leaseOwner: "synthetic-owner" };
  };
  return { ...f, db, deps, records, workItem, hypothesisIntake, resolution, setContactBody: (body: string) => { contactBody = body; },
    advance: (ms: number) => { time += ms; } };
}
export const prospects = (f: ReturnType<typeof hypothesisSetup>) => [...f.db.records.entries()]
  .filter(([key]) => key.startsWith("outboundProspects/") && key.split("/").length === 2).map(([key, value]) => ({ id: key.split("/")[1], ...value }));

/** A draft that passes blueprint.outreach.v2 for an admitted hypothesis brief: inbox addressing,
 * one proven fact as the opening, the published question verbatim and nothing else asked. */
export function hypothesisDraft(brief: CommunicationsBrief): CommunicationsOutput {
  const recipient = brief.contact.recipient!, question = brief.qualification!.openQuestions[0], fact = brief.facts[1] ?? brief.facts[0];
  const greeting = recipient.kind === "inbox" ? `Hello, I'm hoping this reaches ${recipient.addressee}.` : `Hi ${recipient.name.split(" ")[0]},`;
  const contract = { version: "blueprint.outreach.v2" as const, senderIdentity: "I'm building Blueprint.",
    opening: { kind: "cold" as const, noVerifiedConnectionReason: "No verified relationship is recorded.",
      publicDetail: { claim: `Your public page says: "${fact.claim}".`, source: fact.sourceUrl, sourceClaim: fact.claim },
      relevance: "I'm trying to learn how that work is done today." },
    questions: [{ question, checks: [brief.qualification!.openChecks.includes("site_link") ? "site_link" as const
      : brief.qualification!.openChecks.includes("manual_workflow") ? "manual_workflow" as const : "existing_automation" as const] }],
    recipientChoice: "Whether to answer is entirely up to you." };
  const body = [greeting, contract.senderIdentity, contract.opening.publicDetail.claim, contract.opening.relevance, question,
    contract.recipientChoice, "Nijel"].join("\n\n");
  return { disposition: "draft", subject: `About ${brief.boundedJob}`, body, reason: "Synthetic hypothesis draft: one published question, inbox addressing",
    usedFactIds: [fact.id], refreshFactIds: [], outreachContract: contract, requiresHumanReview: true };
}
