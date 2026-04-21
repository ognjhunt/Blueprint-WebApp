Issue: BLU-3340 Unblock Restore FIREHOSE_API_TOKEN in the shared Paperclip env or provide an approved fallback Firehose source, then rerun Analytics Weekly
Status: Blocked
Date: 2026-04-21

Actions Taken:
- Re-read the bound issue heartbeat context and kept the run scoped to BLU-3340 only.
- Confirmed the live shell environment exposes `FIREHOSE_API_TOKEN`, `FIREHOSE_BASE_URL`, `SEARCH_API_KEY`, `SEARCH_API_PROVIDER`, and `BLUEPRINT_MARKET_SIGNAL_PROVIDER` as empty.
- Re-checked repo truth and confirmed Firehose is still a gated provider path in `server/utils/marketSignalProviderFirehose.ts`, while the broader market-signal provider layer only falls back to web search when that source is configured.
- Confirmed the analytics weekly blocker remains honest: no report artifact should be written until the missing Firehose path or an approved fallback source is restored.

Outcome:
- Analytics Weekly remains blocked because the Firehose access path is still missing.
- No report artifact was generated because doing so would overstate the available source truth.

Next Steps:
- Restore `FIREHOSE_API_TOKEN` and `FIREHOSE_BASE_URL` in the shared Paperclip env, or approve an explicit fallback Firehose source.
- Rerun Analytics Weekly only after the source path is restored so the report can publish truthfully.
