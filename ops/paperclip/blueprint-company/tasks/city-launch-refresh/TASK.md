---
name: City Launch Refresh
project: blueprint-executive-ops
assignee: city-launch-agent
recurring: true
---

Run the midweek city launch refresh.

Each run must:

- refresh the current week's city launch guide only when new evidence materially changes posture, blockers, or sequencing
- incorporate new supply-intel, market-intel, city-demand, and capturer-growth findings
- update or create the next set of city-specific execution issues only when a real dependency changed
- leave one durable artifact or explicit no-change reference tied to that same city: update the city playbook when evidence moved, otherwise reference the existing city guide or issue document
- leave one proof-bearing closeout comment before marking the issue done with exactly these lines:
  Selected city: <City, ST>
  Artifact: <repo path or issue-document:key>
  Outcome: updated | no_change
  Evidence delta: <what changed or none>
  Other cities touched: none
- make missing human approvals explicit
