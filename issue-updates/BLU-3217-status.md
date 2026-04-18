Issue: BLU-3217 Maintain the Sacramento parallel lawful-access queue
Status: Done
Date: 2026-04-17

Actions Taken:
- Re-read the bound issue heartbeat context and kept the run scoped to BLU-3217 only.
- Updated the Sacramento capture target ledger so the lawful-access queue is explicit and parallel instead of single-threaded.
- Named the current queue set as Northgate Logistics, US Cold Storage - Ambient Module, McClellan Park - Building 775 (Light Industrial), Sacramento Costco - Natomas, and Home Depot - Sacramento (Cal Expo).
- Updated the Sacramento demand plan, launch issue bundle, and activation payload so the same queue state is visible in the canonical city artifacts.
- Added `public_non_controlled_site` to the Sacramento activation payload so the bounded fallback lane is represented instead of implied.

Outcome:
- The Sacramento lawful-access queue now has five named candidates or fallback sites with a current next step on each.
- Buyer-linked exact-site, operator-intro, existing-lawful-access, and public non-controlled fallback paths are all visible in repo truth.
- The issue can close without claiming live outreach or private-interior access that is not yet proven.

Next Steps:
- Keep the named queue current as new buyer-thread, operator-intro, or lawful-access evidence arrives.
- Route any candidate that needs rights, privacy, or commercialization judgment through the human gates before widening.
