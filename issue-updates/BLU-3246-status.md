Issue: BLU-3246 Unblock Notion Work Queue: San Diego capturer prospect list and post package
Status: Done
Date: 2026-04-18

Actions Taken:
- Re-read the bound issue heartbeat context and kept the run scoped to BLU-3246 only.
- Re-read the recent Paperclip issue comments to confirm the current failure mode was the cross-bound 409 path rather than a new Notion content change.
- Updated `server/utils/paperclip.ts` to recover an existing issue when Paperclip rejects a cross-bound update with 409 instead of failing the upsert path.
- Added a regression test in `server/tests/paperclip.test.ts` to cover the cross-bound 409 recovery behavior.
- Added an explicit ownership guard in `server/utils/cityLaunchExecutionHarness.ts` so wake dispatch fails fast when issue ownership metadata is missing.
- Verified the targeted Vitest regression suite and the full TypeScript check both pass.

Outcome:
- Paperclip issue upserts now reuse the existing issue record when the bound-run 409 occurs.
- City-launch wake dispatch now requires explicit ownership metadata instead of silently continuing with a partial issue record.
- The implementation is verified locally and ready for the Paperclip status update.

Next Steps:
- No further repo action is required for this issue unless a later run surfaces a new Paperclip binding edge case.
