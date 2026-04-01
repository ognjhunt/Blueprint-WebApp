---
name: Founder Daily Accountability Report
project: blueprint-executive-ops
assignee: blueprint-chief-of-staff
recurring: true
---

Run the daily manager accountability artifact for Blueprint.

Each run must:

- start with `blueprint-manager-state`
- treat the manager-state `dailyAccountability` slice, real Paperclip issue movement, routine misses, and proof-bearing comments as the primary evidence base
- name agents only when they materially moved work, materially missed work, or produced low-value output
- avoid padding the report with agents that only woke up or narrated without changing reality
- create one Knowledge artifact tagged for `Founder OS`
- create no founder-facing Slack digest from this routine
- use the exact title format `Daily Accountability | YYYY-MM-DD | Blueprint`
- use these sections in this exact order:
  - `Materially Active Agents`
  - `Blocked Or Unfinished`
  - `Runs With Weak Proof`
  - `Missing Workflow Support`
- enforce bullet limits:
  - `Materially Active Agents`: max 8
  - all other sections: max 5
- format each bullet as `[Agent] done | missed | proof | assessment | next`
- use `proof: none` when a run changed issue state but left no stronger artifact trail
- use `assessment: low-value` only when the evidence shows narration or churn without real movement

Artifact requirements:

- Knowledge title: `Daily Accountability | YYYY-MM-DD | Blueprint`
- Knowledge `Artifact Type`: `Daily Accountability Report`
- Knowledge `Agent Surface` must include `Founder OS`
- if the accountability report surfaces a missing software support gap that should become work now, create or update the linked Paperclip issue before closing the task
