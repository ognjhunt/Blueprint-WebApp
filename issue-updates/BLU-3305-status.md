Issue: BLU-3305 Unblock Restore FIREHOSE_API_TOKEN in the shared Paperclip env or provide an approved fallback Firehose source, then rerun Analytics Weekly
Status: Blocked
Date: 2026-04-20

Actions Taken:
- Re-read the bound issue heartbeat context and kept the run scoped to BLU-3305 only.
- Confirmed the local Paperclip HTTP endpoint is not reachable from this runtime, so there was no live issue API path to use directly.
- Re-checked repo truth and confirmed Firehose reads still require `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL`, with no approved fallback Firehose source defined in repo truth.
- Confirmed the deterministic analytics writer cannot rerun Analytics Weekly truthfully until Firehose access is restored or a fallback is explicitly approved.

Outcome:
- Analytics Weekly remains blocked because the Firehose access path is still missing.
- No report artifact was generated because doing so would overstate the available source truth.

Next Steps:
- Restore `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` in the shared Paperclip env, or approve an explicit fallback Firehose source.
- Rerun Analytics Weekly only after the source path is restored so the report can publish truthfully.
