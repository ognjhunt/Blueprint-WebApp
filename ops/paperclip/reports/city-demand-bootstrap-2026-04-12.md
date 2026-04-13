# City Demand Agent Bootstrap — Generic City Launcher Update

**Date:** 2026-04-12  
**Status:** Active

---

## 1. What Changed

The city-launch system is no longer limited to compact Austin and San Francisco planning packets.

The WebApp now provides:
- a generic city profile path for any city string
- machine-readable budget policy for `zero_budget`, `low_budget`, and `funded` launch modes
- a launch execution harness that dispatches the Paperclip issue tree
- canonical ledgers for city prospects, buyer targets, first touches, and spend
- a scorecard path that can read those ledgers instead of leaving core city metrics intentionally untracked

## 2. What This Fixes

The old planning-state blocker was:
- city plans existed as documents
- scorecards could not truthfully count key outbound and sourcing steps
- the harness produced artifacts but not the live city work tree

That is now fixed at the repo level.

## 3. What Is Still Not Proven

The generic launcher is structurally ready, but one city still has to prove the full loop with real operating evidence:
- real captures
- real proof packs
- real hosted reviews
- real onboarding
- real ledger entries for prospects, targets, first touches, and spend

Until that exists, multi-city expansion remains a policy violation even though the launcher can technically prepare multiple cities.

## 4. Current Readiness Rule

The city-demand lane should now treat demand work as:

1. **Generic-city supported**
   The system can prepare any city and route the work.

2. **Single-city execution constrained**
   The org should keep one active city until proof thresholds are met.

3. **Proof-led only**
   Demand claims remain invalid until there is at least one proof-ready city asset and one hosted review path tied to that city.

## 5. Next Actions

1. Use the generic launcher for the next city activation instead of making another one-off packet.
2. Record buyer target research in the canonical buyer-target ledger immediately.
3. Record every tailored first touch in the canonical touch ledger.
4. Keep the city scorecard as the source of truth for whether the city is operationally real.

---
*Supersedes the 2026-04-06 planning-stage bootstrap conclusion.*
