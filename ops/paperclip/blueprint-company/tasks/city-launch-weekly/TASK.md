---
name: City Launch Weekly
project: blueprint-executive-ops
assignee: city-launch-agent
recurring: true
---

Run the weekly city launch planning loop.

Each run must:

- pick one city whose guide is missing or stale and publish exactly one city launch guide for that city
- base the guide on current Blueprint research, not generic city assumptions
- score city readiness and log the blockers clearly
- create cross-agent work items for web, analytics, intake, ops, and field readiness only when they represent real next work
- leave one durable artifact every run: a city playbook file when repo writes are available, otherwise a Paperclip issue document
- leave one proof-bearing closeout comment before marking the issue done with exactly these lines:
  Selected city: <City, ST>
  Artifact: <repo path or issue-document:key>
  Evidence: <why this city was chosen now>
  Other cities touched: none
- recommend sequencing, but leave final launch decisions to humans

Do not:

- declare a city live
- approve spend
- authorize public campaigns
