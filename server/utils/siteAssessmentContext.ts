import { createHash } from 'node:crypto';
import { assessmentCustomerStatementRefs } from './siteCustomerStatements';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
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
  // Preserve identities of existing jobs without newly admitted email evidence.
  return digest({ schema: 'site_assessment_context.v1', request, owner,
    ...(customerStatements.length ? { customerStatements } : {}) });
}
export function advisoryJobId(requestId: string, sourceKey: string, contextDigest: string): string {
  return `advisory-${digest({ schema: 'site_assessment_job.v1', requestId, sourceKey, contextDigest })}`;
}

/** A durable customer job cannot silently adopt another recording, context or worker claim. */
export function assertAdvisoryJobBinding(job: Record<string, any> | undefined, expected: {
  jobId: string; requestId: string; sourceKey: string; contextDigest: string; runId: string; claimId: string;
}): void {
  if (!job || job.schema_version !== 'site_assessment_job.v1' || job.request_id !== expected.requestId
    || job.state !== 'running' || job.source_key !== expected.sourceKey || job.context_digest !== expected.contextDigest
    || job.run_id !== expected.runId || job.claim_id !== expected.claimId
    || advisoryJobId(expected.requestId, expected.sourceKey, expected.contextDigest) !== expected.jobId) {
    throw new Error('site_assessment_advisory_binding_changed');
  }
}
