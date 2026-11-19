/**
 * The error the job-evidence routes answer with. The site's planning details and Blueprint's options review that this
 * module once projected were removed on 2026-11-19: a stored `job_marketplace` field is left as it is and never read.
 */
export class JobMarketplaceError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}
