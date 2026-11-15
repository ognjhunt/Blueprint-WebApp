import { createHash } from 'node:crypto';
import { screenTaskScope } from './siteTaskScope';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
type SiteCustomerStatementRef = { statement_id: string; digest: string };
/** Only the canonical refs admitted after an email read enter assessment context.
 * The ordinary conversation/display history is never sufficient authority. */
function assessmentCustomerStatementRefs(record: Record<string, any>): SiteCustomerStatementRef[] {
  const refs = record.site_assessment_customer_statements ?? [];
  if (!Array.isArray(refs) || refs.length > 20 || refs.some(ref => !ref || typeof ref !== "object"
    || typeof ref.statement_id !== "string" || typeof ref.digest !== "string"
    || !/^[a-f0-9]{64}$/.test(ref.statement_id) || !/^[a-f0-9]{64}$/.test(ref.digest)
    || Object.keys(ref).some(key => !["statement_id", "digest"].includes(key)))
    || new Set(refs.map(ref => ref.statement_id)).size !== refs.length) throw new Error("site_assessment_customer_statement_binding_invalid");
  return refs;
}
/** Relevant request and optional owner context. Timestamps and inferred triage are not new facts. */
export function advisoryContextDigest(record: Record<string, any>, brief: Record<string, any> | null): string {
  const request = Object.fromEntries([
    'buyerType', 'taskDescription', 'whatGoesWrong', 'taskStatement', 'details', 'operatingConstraints',
    'siteTaskSpec', 'siteTaskGates', 'siteLocation', 'siteLocationMetadata', 'capture_region',
  ].map(key => [key, record.request?.[key] ?? null]));
  const owner = brief === null ? null : Object.fromEntries([
    'operatorTaskDetails', 'successCriteria', 'operatorAnswers',
  ].map(key => [key, brief[key] ?? null]));
  const customerStatements = assessmentCustomerStatementRefs(record);
  const inferred = brief ? screenTaskScope({ summary: brief.summary, successDefinition: brief.successCriteria?.successDefinition }) : null;
  // New typed briefs and newly admitted general tasks must not borrow an
  // assessment of another job. Existing recognized legacy context stays stable.
  const taskSemantics = brief && (brief.taskFamily !== undefined || !inferred?.supported)
    ? { summary: brief.summary ?? null, taskFamily: inferred?.kind ?? "general_task" } : null;
  // Preserve identities of existing jobs without newly admitted email evidence.
  return digest({ schema: 'site_assessment_context.v1', request, owner,
    ...(taskSemantics ? { taskSemantics } : {}),
    ...(customerStatements.length ? { customerStatements } : {}) });
}
export function advisoryJobId(requestId: string, sourceKey: string, contextDigest: string): string {
  return `advisory-${digest({ schema: 'site_assessment_job.v1', requestId, sourceKey, contextDigest })}`;
}
