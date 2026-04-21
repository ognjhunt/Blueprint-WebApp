Issue: BLU-3293 Unblock Restore FIREHOSE_API_TOKEN in the shared Paperclip env or provide an approved fallback Firehose source, then rerun Analytics Weekly
Status: Blocked
Date: 2026-04-20

Actions Taken:
- Re-read the bound issue heartbeat context and kept the run scoped to BLU-3293 only.
- Re-checked the shared Paperclip env file on this host and confirmed `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` are still empty.
- Re-checked repo truth and confirmed Firehose reads still depend on `FIREHOSE_API_TOKEN`/`FIREHOSE_BASE_URL`, while the only fallback-like path in repo truth is first-party ingest gated by `BLUEPRINT_ANALYTICS_INGEST_ENABLED`.
- Confirmed there is still no approved fallback Firehose source that would let Analytics Weekly rerun truthfully.

Outcome:
- Analytics Weekly remains blocked because the Firehose access path is still missing.
- No report artifact was generated because doing so would overstate the available source truth.
- The issue should remain blocked until the source path is restored or an approved fallback is documented.

Next Steps:
- Restore `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` in the shared Paperclip env, or approve a fallback Firehose source.
- Rerun Analytics Weekly only after the source path is restored so the report can publish truthfully.
