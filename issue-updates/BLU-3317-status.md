Issue: BLU-3317 Unblock Restore FIREHOSE_API_TOKEN in the shared Paperclip env or provide an approved fallback Firehose source, then rerun Analytics Weekly
Status: Blocked
Date: 2026-04-20

Actions Taken:
- Re-read the bound issue heartbeat context for BLU-3317 only.
- Verified the live issue record still points at the same Firehose blocker and has no approved fallback source in repo truth.
- Confirmed repo truth still requires `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` for Firehose reads.

Outcome:
- Analytics Weekly remains blocked because the Firehose access path is still missing.
- No report artifact was generated because publishing now would overstate the available source truth.

Next Steps:
- Restore `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` in the shared Paperclip env, or approve an explicit fallback Firehose source.
- Rerun Analytics Weekly only after the source path is restored so the report can publish truthfully.
