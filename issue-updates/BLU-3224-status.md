Issue: BLU-3224 Own approved Sacramento capturers through onboarding and repeat-ready
Status: Blocked
Date: 2026-04-17

Actions Taken:
- Re-read the bound issue payload, the capturer-success instructions, and the Sacramento launch bundle before touching any other scope.
- Pulled the heartbeat context for BLU-3224 and confirmed there are no comments, no wake comment, and no live capturer-signal attached to the issue.
- Checked the Sacramento capture target ledger and activation payload; both still describe the city launch target frame rather than a live approved-capturer lifecycle record.
- Compared this run against the existing Sacramento capturer-success status note pattern so the update stays consistent with prior lifecycle reporting.

Proof:
- There is no approved capturer, first capture, or QA-backed transition recorded in the issue context for this run.
- The current evidence supports keeping the lane blocked rather than inventing a lifecycle transition.

Next Steps:
- Keep the issue blocked until a real approved capturer or first capture lands in the live path.
- Recheck the Sacramento intake and field-assignment lanes when a new capturer approval or capture artifact appears.
- Do not invent a lifecycle transition without evidence.
