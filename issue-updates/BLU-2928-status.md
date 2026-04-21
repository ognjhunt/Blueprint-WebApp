Issue: BLU-2928 Own approved Sacramento capturers through onboarding and repeat-ready
Status: Blocked
Date: 2026-04-18

Actions Taken:
- Re-read the bound issue payload, the capturer-success instructions, and the Sacramento launch bundle before touching any other scope.
- Pulled the issue comments for BLU-2928 and confirmed the only recent note is launch-routing context, not a live capturer approval or capture artifact.
- Re-read the Sacramento target ledger and launch system artifacts; both still describe the city-launch frame and launch thresholds rather than a live approved-capturer lifecycle record.
- Re-checked the issue snapshot and heartbeat context and confirmed the issue is owned by capturer-success-agent but has no approved capturer, first capture, or QA-backed transition recorded.

Proof:
- There is no live approved-capturer signal in the issue context for this run.
- There is no first-capture or QA-backed lifecycle transition to advance.
- The current evidence supports keeping the lane blocked rather than inventing progress.

Next Steps:
- Keep the issue blocked until a real approved capturer or first capture lands in the live path.
- Recheck the Sacramento intake and field-assignment lanes when a new capturer approval or capture artifact appears.
- Do not invent a lifecycle transition without evidence.
