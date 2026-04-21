Issue: BLU-3309 Unblock Restore FIREHOSE_API_TOKEN in the shared Paperclip env or provide an approved fallback Firehose source, then rerun Analytics Weekly
Status: Blocked
Date: 2026-04-20

Actions Taken:
- Re-read the bound issue heartbeat context and kept the run scoped to BLU-3309 only.
- Checked out the issue for the current run so the blocker could be recorded cleanly.
- Confirmed the live shell environment still exposes `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` as empty.
- Re-checked repo truth and confirmed Firehose reads still require the live `FIREHOSE_API_TOKEN`/`FIREHOSE_BASE_URL` path, with no approved fallback Firehose source defined in repo truth.

Outcome:
- Analytics Weekly remains blocked because the Firehose access path is still missing.
- No report artifact was generated because doing so would overstate the available source truth.

Next Steps:
- Restore `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` in the shared Paperclip env, or approve an explicit fallback Firehose source.
- Rerun Analytics Weekly only after the source path is restored so the report can publish truthfully.
