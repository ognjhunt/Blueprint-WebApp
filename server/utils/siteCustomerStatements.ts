import { communicationsDigest, authorText } from "../agents/communications-contract";

export type SiteCustomerStatementRef = { statement_id: string; digest: string };
export function siteCustomerStatementDigest(statement: Record<string, any>) {
  return communicationsDigest({ messageId: statement.messageId, text: statement.text, receivedAt: statement.receivedAt,
    from: statement.from, source: statement.source, communicationId: statement.communicationId, trust: statement.trust,
    assessmentBinding: statement.assessmentBinding });
}

/** Only the canonical refs admitted after an email read enter assessment context.
 * The ordinary conversation/display history is never sufficient authority. */
export function assessmentCustomerStatementRefs(record: Record<string, any>): SiteCustomerStatementRef[] {
  const refs = record.site_assessment_customer_statements ?? [];
  if (!Array.isArray(refs) || refs.length > 20 || refs.some(ref => !ref || typeof ref !== "object"
    || typeof ref.statement_id !== "string" || typeof ref.digest !== "string"
    || !/^[a-f0-9]{64}$/.test(ref.statement_id) || !/^[a-f0-9]{64}$/.test(ref.digest)
    || Object.keys(ref).some(key => !["statement_id", "digest"].includes(key)))
    || new Set(refs.map(ref => ref.statement_id)).size !== refs.length) throw new Error("site_assessment_customer_statement_binding_invalid");
  return refs;
}

/** Reopen canonical email evidence, not arbitrary customerConversation text.
 * A customer's answer remains an assertion, never a booking/safety grant. */
export async function loadAssessmentCustomerStatements(db: FirebaseFirestore.Firestore, requestId: string,
  record: Record<string, any>, recipient: string) {
  const messages: Array<{ id: string; text: string; source_ref: string }> = [];
  for (const ref of assessmentCustomerStatementRefs(record)) {
    const path = `inboundRequests/${requestId}/customerStatements/${ref.statement_id}`;
    const statement = (await db.doc(path).get()).data();
    const binding = statement?.assessmentBinding;
    const communication = typeof statement?.communicationId === "string" && /^[a-f0-9]{64}$/.test(statement.communicationId)
      ? (await db.doc(`inboundRequests/${requestId}/communications/${statement.communicationId}`).get()).data() : undefined;
    if (!statement || !binding || binding.schema_version !== "site_customer_statement_binding.v1"
      || siteCustomerStatementDigest(statement) !== ref.digest
      || communicationsDigest({ messageId: statement.messageId }) !== ref.statement_id
      || !communication || statement.from !== recipient.trim().toLowerCase() || communication.recipient !== statement.from
      || !communication.sendReceipt || communicationsDigest(communication.sendReceipt) !== binding.send_receipt_digest
      || binding.thread_id !== communication.sendReceipt.threadId
      || binding.anchor_rfc_message_id !== communication.sendReceipt.rfcMessageId
      || statement.source !== `gmail:${binding.thread_id}:${statement.messageId}`
      || typeof statement.text !== "string" || !statement.text.trim() || typeof statement.rawBody !== "string"
      || authorText(statement.rawBody) !== statement.text || !Number.isFinite(Date.parse(statement.receivedAt))
      || statement.trust !== "customer_statement_requires_interpretation_not_commitment") {
      throw new Error("site_assessment_customer_statement_binding_invalid");
    }
    messages.push({ id: `customer:${ref.statement_id}`, text: JSON.stringify({ basis: "owner_stated_unverified",
      statement: statement.text, received_at: statement.receivedAt, commitment_or_safety_authorization: false }), source_ref: path });
  }
  return messages;
}
