import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { communicationsDigest, verifyCommunicationsHandoff, type CommunicationsBrief } from "./communications-contract";

export type ResearchSnapshotReader = (date: string) => Promise<unknown>;
// The research owner owns the pinned Store, its blobs and scheduler. This reader
// has no control writes and never acquires/replaces the research runner's lease.
export async function readExistingResearchSnapshot(db: FirebaseFirestore.Firestore, date: string) {
  const modulePath = pathToFileURL(resolve("dist/daily-research/release/tools/daily_research/firestore_bridge.mjs"));
  const { Store } = await import(/* @vite-ignore */ modulePath.href);
  return new Store(db).snapshot(date);
}

/** A reviewed work item alone does not prove publication to either canonical hub. */
export function verifyPublishedResearch(snapshot: any, brief: CommunicationsBrief, approval: unknown) {
  const handoff = verifyCommunicationsHandoff(approval, brief);
  const verified = verifyResearchPublication(snapshot, brief.researchOrigin);
  const { row, candidate } = verified;
  if (handoff.sheetsReceipt !== verified.sheetsReceipt || handoff.notionReceipt !== verified.notionReceipt) {
    throw new Error("research_publication_receipt_changed");
  }
  if (brief.researchOrigin.sourceDigest
    && communicationsDigest(researchPublicationSource(snapshot, brief.researchOrigin)) !== brief.researchOrigin.sourceDigest) {
    throw new Error("research_adapter_source_changed");
  }
  for (const fact of brief.facts) {
    if (!candidate.evidence?.some((entry: any) => entry.claim === fact.claim && entry.url === fact.sourceUrl
      && Date.parse(entry.source_checked_at ?? entry.checked_date) === Date.parse(fact.sourceCheckedAt)
      && (entry.claim_kind === "hypothesis" ? fact.evidenceClass === "inference"
        : entry.claim_kind === "vendor_claim" || entry.classification === "vendor" ? fact.evidenceClass === "vendor_reported"
        : entry.claim_kind === "fact" && ["operator", "independent"].includes(entry.classification)
          && ["primary", "corroborated", "operator_stated"].includes(fact.evidenceClass)))) {
      throw new Error("brief_fact_not_in_published_research");
    }
  }
  return { runKey: row.run_key, packetDigest: row.packet_digest,
    sheetsReceipt: verified.sheetsReceipt, notionReceipt: verified.notionReceipt,
    briefDigest: communicationsDigest(brief) };
}

/** Shared read-only publication checks, also used before a brief exists. */
export function verifyResearchPublication(snapshot: any, origin: CommunicationsBrief["researchOrigin"]) {
  const row = snapshot?.row;
  const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  if (snapshot?.schema_version !== "blueprint.research-snapshot.v1" || !row
    || row.date !== origin.date || row.state !== "completed" || !row.session_id || !row.turn_id
    || row.remote_completed_at == null || row.artifact_downloaded !== true
    || row.packet_digest !== origin.packetDigest || row.raw_output_digest !== origin.rawArtifactDigest
    || !snapshot.files?.artifact || snapshot.missing_files?.length) throw new Error("research_publication_context_missing");
  if (hash(Buffer.from(snapshot.files.artifact, "base64")) !== origin.rawArtifactDigest) throw new Error("research_artifact_digest_mismatch");
  if (researchDigest(row.packet) !== origin.packetDigest) throw new Error("research_packet_digest_mismatch");
  const savedReview = JSON.parse(Buffer.from(snapshot.files.review, "base64").toString("utf8"));
  const { packet_digest: savedDigest, ...savedPacket } = savedReview;
  if (savedDigest !== origin.packetDigest || researchDigest(savedPacket) !== origin.packetDigest) throw new Error("research_review_packet_mismatch");
  const evidence = JSON.parse(Buffer.from(snapshot.files.evidence, "base64").toString("utf8"));
  if (researchDigest(evidence) !== row.evidence_digest) throw new Error("research_evidence_digest_mismatch");
  const review = row.review;
  if (review?.packet_digest !== origin.packetDigest || !review.reviewer_reference
    || review.source_support_verified !== true || review.crm_rechecked !== true
    || !review.accepted_keys?.includes(origin.candidateKey)) throw new Error("research_quality_review_missing");
  const selected = row.packet.candidates.filter((item: any) => review.accepted_keys.includes(item.candidate_key));
  if (!row.packet.destinations?.sheet_id || !row.packet.destinations?.notion_parent || typeof review.summary !== "string") throw new Error("research_publication_target_missing");
  const expected: Record<string, unknown> = {
    sheets: { sheet_id: row.packet.destinations.sheet_id, tab: "Prospects", candidates: selected },
    notion: { parent_id: row.packet.destinations.notion_parent, summary: review.summary, candidates: selected },
  };
  for (const destination of ["sheets", "notion"]) {
    const delivery = row.delivery?.[destination];
    const receipt = delivery?.receipt;
    if (delivery?.state !== "acknowledged" || receipt?.readback_verified !== true || !receipt.reference
      || receipt.key !== delivery.key || receipt.payload_digest !== delivery.payload_digest
      || researchDigest(delivery.payload) !== delivery.payload_digest
      || delivery.key !== `${row.run_key}:${destination}`
      || researchDigest(expected[destination]) !== delivery.payload_digest
      || receipt.destination !== destination) throw new Error(`research_${destination}_readback_missing`);
  }
  const candidate = row.packet?.candidates?.find((item: any) => item.candidate_key === origin.candidateKey);
  if (!candidate) throw new Error("research_candidate_missing");
  return { row, candidate, selected,
    sheetsReceipt: row.delivery.sheets.receipt.reference, notionReceipt: row.delivery.notion.receipt.reference,
  };
}

/** Exact producer-owned candidate, QA and publication identity. No research writes. */
export function researchPublicationSource(snapshot: any, origin: CommunicationsBrief["researchOrigin"]) {
  const { row, candidate, selected, sheetsReceipt, notionReceipt } = verifyResearchPublication(snapshot, origin);
  const qa = row.qa;
  const qaBytes = Buffer.from(snapshot.files.qa ?? "", "base64");
  if (qa?.state !== "validated" || qa.turn_status !== "completed" || !qa.turn_id
    || row.review.reviewer_reference !== `agent-turn:${row.session_id}:${qa.turn_id}`
    || createHash("sha256").update(qaBytes).digest("hex") !== qa.artifact_digest
    || row.review.qa_artifact_digest !== qa.artifact_digest
    || researchDigest(qa.decision) !== researchDigest(row.review)) throw new Error("research_adapter_qa_binding_missing");
  const qaResult = JSON.parse(qaBytes.toString("utf8"));
  if (qaResult.schema_version !== "blueprint.research-qa.v1" || qaResult.packet_digest !== origin.packetDigest
    || qaResult.crm_digest !== qa.crm_digest || qaResult.source_support_verified !== true
    || qaResult.summary !== row.review.summary || !Array.isArray(qaResult.accepted_keys)
    || !Array.isArray(qaResult.checks) || !qaResult.accepted_keys.includes(origin.candidateKey)
    || !qaResult.checks.some((check: any) => check.candidate_key === origin.candidateKey
      && check.source_support_verified === true && check.duplicate === false)) throw new Error("research_adapter_qa_binding_missing");
  const delivery = row.delivery.sheets, plan = delivery.plan;
  const rows = plan?.sheet_rows;
  if (!Array.isArray(rows) || rows.length !== selected.length
    || plan.destination !== "sheets" || plan.key !== delivery.key || plan.payload_digest !== delivery.payload_digest
    || plan.marker !== `[${delivery.key};${delivery.payload_digest}]`
    || plan.body_json !== JSON.stringify({ majorDimension: "ROWS", values: rows })
    || plan.request_digest !== createHash("sha256").update(plan.body_json).digest("hex")) throw new Error("research_adapter_sheet_identity_missing");
  const ids = rows.map((entry: any) => entry?.[0]);
  if (ids.some((value: any) => typeof value !== "string" || !/^BP-\d{6}$/.test(value))
    || new Set(ids).size !== ids.length
    || sheetsReceipt !== `sheets:${row.packet.destinations.sheet_id}:Prospects:${ids.join(",")}`) throw new Error("research_adapter_sheet_identity_missing");
  for (let index = 0; index < selected.length; index++) {
    const item = selected[index];
    const task = item.evidence?.find((entry: any) => entry.role === "task");
    const capability = item.evidence?.find((entry: any) => entry.role === "capability");
    if (!task || !capability || !["unqualified", "needs_review"].includes(item.qualification_status)) throw new Error("research_adapter_candidate_invalid");
    const expected = [ids[index], item.organization, "Facility / site", item.site, "", "", "Needs recheck", "",
      item.potential_robot_match, task.url, "Research", "", `${item.proposed_next_action}\n${plan.marker}`, "", item.task,
      capability.url, "Unverified", item.location, row.date];
    if (researchDigest(rows[index]) !== researchDigest(expected)) throw new Error("research_adapter_sheet_identity_missing");
  }
  if (typeof notionReceipt !== "string" || !/^notion:[a-f0-9-]{32,36}$/.test(notionReceipt)) throw new Error("research_adapter_notion_identity_missing");
  return {
    version: "blueprint.communications-research-source.v1" as const,
    runKey: row.run_key, date: origin.date, candidateKey: origin.candidateKey,
    packetDigest: origin.packetDigest, rawArtifactDigest: origin.rawArtifactDigest,
    candidate, researchReview: row.review, qaArtifactDigest: qa.artifact_digest,
    sheetsProspectId: ids[selected.findIndex((item: any) => item.candidate_key === origin.candidateKey)],
    sheetsReceipt, notionReceipt, sheetsPlanDigest: researchDigest(plan),
  };
}

/** Python json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=True).
 * The research packet contract uses integer token counts and string confidence;
 * unexpected non-integer numbers fail closed instead of guessing Python floats.
 */
export function researchDigest(value: unknown): string {
  const encode = (item: any): string => {
    if (typeof item === "number" && !Number.isSafeInteger(item)) throw new Error("research_number_contract_unsupported");
    if (Array.isArray(item)) return `[${item.map(encode).join(",")}]`;
    if (item && typeof item === "object") return `{${Object.keys(item).sort().map((key) => `${encode(key)}:${encode(item[key])}`).join(",")}}`;
    const json = JSON.stringify(item);
    if (json === undefined) throw new Error("research_digest_value_invalid");
    return json.replace(/[\u007f-\uffff]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
  };
  return createHash("sha256").update(encode(value)).digest("hex");
}
