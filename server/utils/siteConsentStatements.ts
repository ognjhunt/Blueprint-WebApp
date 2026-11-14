import { resolvePrivacyVersion } from "../agents/provider-privacy";

/**
 * The trial statements on the site start form that name a provider and a model
 * (version 2026-09-24.v1, worded in `SiteCaptureStart.tsx`), keyed by the field
 * the accepted statement is stored under on the request, with the model id the
 * statement names. A grant lists in `site_consents` exactly the statements the
 * site accepted. The start form accepts at most one of the two (the intake
 * refuses both together), so a real grant's `site_consents` is `[]`, the Claude
 * entry alone or the Sol entry alone. The issuing checks read the statement
 * version from here. A new statement version needs its own entry here.
 */
export const SITE_CONSENT_STATEMENTS = {
  claude_authoring_consent: { statement_version: "2026-09-24.v1", provider: "anthropic", model: "claude-opus-5-5" },
  sol_agents_api_consent: { statement_version: "2026-09-24.v1", provider: "openai", model: "gpt-6.1-sol" },
} as const;

/** The trial statements this job's site accepted on its start form; empty for a site that accepted neither. */
export function websiteSiteConsents(record: Record<string, any>) {
  return (Object.entries(SITE_CONSENT_STATEMENTS) as Array<[keyof typeof SITE_CONSENT_STATEMENTS,
    (typeof SITE_CONSENT_STATEMENTS)[keyof typeof SITE_CONSENT_STATEMENTS]]>)
    .filter(([field, statement]) => record.request?.[field]?.granted === true
      && record.request[field].statement_version === statement.statement_version)
    .map(([, statement]) => ({ statement_version: statement.statement_version, provider: statement.provider, model: statement.model }));
}

/**
 * The Privacy Policy version the job was submitted under: the `privacy_version_at_submission` the intake wrote once
 * when it created the job (`server/routes/inbound-request.ts`), the field the runtime gate reads. None when it is
 * absent, malformed or a version this service does not know, which the Pipeline reads as an older job. Every job
 * stored before the field existed has none.
 */
export function websiteJobPrivacyPolicyVersion(record: Record<string, any>): string | null {
  const recorded = record.privacy_version_at_submission;
  return typeof recorded === "string" && resolvePrivacyVersion(recorded) === recorded ? recorded : null;
}
