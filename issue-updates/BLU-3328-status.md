Issue: BLU-3328 Unblock Restore FIREHOSE_API_TOKEN in the shared Paperclip env or provide an approved fallback Firehose source, then rerun Analytics Weekly
Status: Blocked
Date: 2026-04-20

Actions Taken:
- Re-read the bound issue heartbeat context and kept the run scoped to BLU-3328 only.
- Re-checked repo truth and confirmed `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` are still modeled as the Firehose runtime inputs, but the worker requires both before Firehose reads can run.
- Re-checked the shared env example and confirmed both Firehose values are still blank there.

Outcome:
- Analytics Weekly remains blocked because the Firehose access path is still missing.
- No report artifact was generated because doing so would overstate the available source truth.

Next Steps:
- Restore `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` in the shared Paperclip env, or approve an explicit fallback Firehose source.
- Rerun Analytics Weekly only after the source path is restored so the report can publish truthfully.
