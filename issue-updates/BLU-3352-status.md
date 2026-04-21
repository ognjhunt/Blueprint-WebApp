Issue: BLU-3352 Unblock Restore FIREHOSE_API_TOKEN in the shared Paperclip env or provide an approved fallback Firehose source, then rerun Analytics Weekly
Status: Blocked
Date: 2026-04-21

Actions Taken:
- Re-read the bound heartbeat context and kept the run scoped to BLU-3352 only.
- Read the live issue record and confirmed it was still backlog before the update.
- Verified the live shell environment still exposes `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` as empty.
- Re-checked repo truth and confirmed `server/utils/marketSignalProviderFirehose.ts` still hard-requires both Firehose vars before market-signal reads can run.
- Added a blocked-status issue comment so the issue history records the exact failure path.

Outcome:
- Analytics Weekly remains blocked because the Firehose access path is still missing.
- No report artifact was generated because doing so would overstate the available source truth.

Next Steps:
- Restore `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` in the shared Paperclip env, or approve an explicit fallback Firehose source.
- Rerun Analytics Weekly only after the source path is restored so the report can publish truthfully.
