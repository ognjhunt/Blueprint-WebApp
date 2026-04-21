Issue: BLU-3250 Unblock Restore FIREHOSE_API_TOKEN in the shared Paperclip env or provide an approved fallback Firehose source, then rerun Analytics Weekly
Status: Blocked
Date: 2026-04-18

Actions Taken:
- Re-read the bound issue heartbeat context and kept the run scoped to BLU-3250 only.
- Verified the local shell still does not expose `FIREHOSE_API_TOKEN`.
- Verified repo truth still requires `FIREHOSE_API_TOKEN` plus `FIREHOSE_BASE_URL` before `fetchFirehoseSignals()` can run.
- Verified the shared runtime example still leaves both Firehose variables empty.

Outcome:
- Analytics Weekly remains blocked because the Firehose access path is still missing.
- No truthful rerun was possible from this host without inventing source truth.
- The issue should remain explicitly blocked until the source path is restored or an approved fallback is added.

Next Steps:
- Restore `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` in the shared Paperclip env, or approve a fallback Firehose source.
- Rerun Analytics Weekly only after the source path is restored so the report can publish truthfully.
