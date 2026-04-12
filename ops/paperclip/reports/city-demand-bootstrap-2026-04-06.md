# City Demand Agent Bootstrap — Inspection Report

> Historical bootstrap snapshot only. Superseded by `city-demand-bootstrap-2026-04-12.md`, which reflects the generic city launcher and the move from planning-only city packets to routed city execution bundles.

**Date:** 2026-04-06
**Author:** blueprint-chief-of-staff (BLU-112)
**Status:** Complete

---

## 1. Instruction Files Audit

All city-demand-agent instruction files are present and readable:

| File | Lines | Status |
|---|---|---|
| AGENTS.md | 43 | OK — complete scope, delegation contract, closure rules |
| Soul.md | 23 | OK — identity, judgment criteria, traps defined |
| Heartbeat.md | 21 | OK — every-run, weekly, midweek cadence defined |
| Tools.md | 38 | OK — sources, actions, handoff partners, trust model defined |

No missing sibling files detected. The agent can satisfy its own runbook literally.

---

## 2. Demand-Side Material Inventory

### Playbooks (core inputs)
- `robot-team-demand-playbook.md` (17.8KB) — Complete. Generic 8-stage funnel, ICP definitions, message hierarchy, human-gate guardrails.
- `city-demand-austin-tx.md` (10.5KB) — Complete. Last refreshed 2026-03-30, phase=planning, confidence=medium.
- `city-demand-san-francisco-ca.md` (11.0KB) — Complete. Last refreshed 2026-03-30, phase=planning, confidence=medium.
- `site-operator-access-and-commercialization-playbook.md` (5.9KB) — Present, consumed by agent.
- `city-buyer-handoff-escalation-rubric-austin-san-francisco.md` (8.4KB) — Present, handles handoff.
- `hosted-review-artifact-handoff-checklist.md` (7.8KB) — Present.

### Programs
- `city-demand-agent-program.md` — Complete. Defines required city plan structure, readiness dimensions, outputs.
- `demand-intel-agent-program.md` — Complete. Feeds research into city demand.
- `robot-team-growth-agent-program.md` — Present. Feeds shared playbook updates.

### Research Outputs Consumed
- `demand_intel_weekly_2026-03-30.md` — Complete weekly digest covering warehouse robotics, humanoid deployments, construction robotics, and demand signals.
- `market-intel-weekly-digest-2026-04-03.md` — Present at repo root.
- `market-intel-digest-2026-04-04.md` — Present at repo root.

---

## 3. Readiness Score Assessment

Based on the city-demand-agent-program.md required dimensions (1-5 scale):

### Austin, TX
| Dimension | Score | Assessment |
|---|---|---|
| Likely robot-team density | 3 | Texas Robotics + university links exist but sparse |
| Exact-site proof fit | 3 | Industrial/logistics sites plausible but unbuilt |
| Access & commercialization | 2 | Relationship-driven, no structured commercial layer |
| Instrumentation readiness | 2 | Analytics coverage still incomplete per playbooks |
| Operational follow-through | 2 | Human-gated, ops readiness low per city plans |
| Strategic importance | 4 | Strong testbed for relationship-driven model |
| **Overall** | **~2.7** | **Planning-stage, needs proof infrastructure** |

### San Francisco, CA
| Dimension | Score | Assessment |
|---|---|---|
| Likely robot-team density | 4 | BARA community, high Bay Area robotics density |
| Exact-site proof fit | 3 | Diverse facility types, proof still needs infrastructure |
| Access & commercialization | 3 | Stronger commercialization surfaces (BARA matchmaking) |
| Instrumentation readiness | 2 | Same gap as Austin |
| Operational follow-through | 2 | Human approval gates, readiness low per playbook notes |
| Strategic importance | 5 | Highest-density market for technically sophisticated buyers |
| **Overall** | **~3.2** | **Stronger demand, same infrastructure gaps** |

---

## 4. Concrete Buyer-Demand Questions That Must Be Answered

These are the first questions that must have answers before any city-level demand claim becomes credible:

### Austin-Specific
1. **Which exact sites in Austin-area industrial parks have been captured or are capturable within 48 hours?** Without a real proof pack tied to an Austin facility, demand conversations stay abstract.
2. **Does Texas Robotics have a specific event, meeting, or membership roster where Blueprint can initiate 3-5 qualified conversations?** "Relationship-driven" is not a plan without named touchpoints.
3. **What is the smallest proof-motion that would let a Texas Robotics member evaluate Blueprint without a city-wide awareness campaign?**
4. **Are there 2-3 named industrial automation or warehouse teams in or near Austin that match the primary ICP?** If not, Austin's demand plan is a hypothesis, not a pipeline.

### San Francisco-Specific
5. **Which BARA events or matchmaking sessions in the next 90 days could host a Blueprint proof review?** BARA is the clearest channel signal but needs concrete event mapping.
6. **Do we have an SF-area exact-site proof pack that a technical buyer can credibly review remotely?** San Francisco buyers are more technically sophisticated and will notice gaps in proof quality.
7. **Are there 3-5 named robot autonomy or deployment teams in SF/Bay Area that match the primary ICP and are reachable through existing channels?**
8. **Can a hosted review be instrumented end-to-end (capturer intake → proof pack → hosted session → buyer follow-up) before widening outreach?** Both city plans note this as a blocker.

### Cross-City
9. **Has any buyer actually converted from a city-specific demand motion, or are both plans still at the planning-hypothesis stage?** Neither city plan shows a conversion signal yet.
10. **Which dependency is the real blocker: capturer supply, analytics instrumentation, proof-pack assembly, or human approval gates?** The city plans list all four as concerns; the real bottleneck needs to be identified.
11. **Does the site-operator lane change the demand math for either city?** The playbook exists but city plans treat it as optional/inferred rather than operational.

---

## 5. Actionable Gaps & Recommendations

### Immediate (blocks credible demand claims)
- **No captured Austin or SF sites with complete proof packs.** Both city plans are planning-only with medium confidence. Before any demand claim, at least one proof pack per city must exist.
- **No conversion evidence from any city-specific motion.** Both plans should explicitly state this as the top uncertainty.

### Near-term (unlocks actionable demand)
- **BARA event calendar mapping for SF** — concrete events, not just "robotics communities exist"
- **Texas Robotics connection mapping for Austin** — named touchpoints, not generic channel references
- **Hosted review instrumentation end-to-end test** — the playbook mentions readiness gaps; a smoke test would clarify what actually works

### Structural (enables scaling)
- **Capturer pipeline to specific cities** — the capturer supply playbook exists but city-specific capturer recruiting is still a hypothesis
- **Analytics measurement for city demand** — the agent's own Tools.md notes that analytics coverage is incomplete

---

## 6. Conclusion

The city-demand-agent instruction files are fully readable and in-context. The playbooks, programs, and research feed exist and are structurally complete.

However, neither city demand plan (Austin TX or San Francisco CA) has moved beyond planning-hypothesis stage. The agent has all the scaffolding it needs to operate, but the foundational evidence — captured sites, proof packs, buyer conversations, conversion signals — is not yet available.

The most productive work for this agent right now is not refreshing city scorecards (which will stay at 2.7 and 3.2 without new evidence), but identifying the concrete steps to generate:
- Proof packs tied to Austin and SF facilities
- Named buyer contacts in each city's strongest channel
- End-to-end instrumentation of the demand funnel from signal to proof review to follow-up
