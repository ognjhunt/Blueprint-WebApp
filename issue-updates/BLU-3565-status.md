Issue: BLU-3565 Route unblock path for Route Durham applicants into qualification and approval
Status: Blocked
Date: 2026-04-22

What I checked:
- Re-read the bound heartbeat context and kept the run scoped to BLU-3565 only.
- Read the Durham launch system, Durham execution issue bundle, and the current child issue thread.
- Confirmed there is still no live Durham applicant, invite, or reply signal in the canonical intake path.

Proof:
- The child issue does not yet have a canonical intake record to classify by source bucket, approval state, or missing-trust evidence.
- The Durham bundle still says to keep the lane blocked until a real live signal lands.
- The issue status now matches the blocker state instead of sitting in backlog.

Next step:
- Leave the lane blocked until a real Durham intake signal lands.
- Recheck the issue when intake, growth, or city-launch produces a real applicant or invite record.
- Do not invent qualification progress without an actual live signal.
