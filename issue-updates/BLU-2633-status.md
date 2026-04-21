Issue: BLU-2633 Own approved Sacramento capturers through onboarding and repeat-ready
Status: Blocked
Date: 2026-04-18

Actions Taken:
- Re-read Soul.md, Heartbeat.md, Tools.md, and the Sacramento launch bundle before touching any other scope.
- Pulled the bound Paperclip issue record for BLU-2633 and confirmed it is still the Sacramento capturer lifecycle owner task.
- Re-checked the heartbeat context and issue payload and found no approved capturer, first capture, or QA-backed transition recorded in the live path.

Proof:
- The issue still reflects the Sacramento launch frame and completion rules, not a live approved capturer record.
- There is no live capturer signal to advance the lane to onboarded, first capture, first pass, or repeat-ready.
- The evidence supports keeping the lane blocked rather than inventing a lifecycle transition.

Next Steps:
- Keep the issue blocked until a real approved capturer or first capture lands in the live path.
- Recheck the Sacramento intake and field-assignment lanes when a new capturer approval or capture artifact appears.
- Do not invent a lifecycle transition without evidence.
