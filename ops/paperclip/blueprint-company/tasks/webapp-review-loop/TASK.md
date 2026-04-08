---
name: WebApp Review Loop
project: blueprint-webapp
assignee: webapp-review
recurring: true
---

Review `Blueprint-WebApp` issues in review, stale, blocked, or automation-created states.

Each run must:

- verify whether implementation issues should move to done, back to todo, or to a blocker state
- close, reopen, cancel, or reprioritize actual Paperclip issues based on repo evidence
- create or refine the most useful next task for the implementation specialist when follow-up work is needed
- keep the queue concrete and traceable instead of leaving review findings in prose only
- end with `blueprint-resolve-work-item` using the current `issueId` and a proof-bearing closeout comment when review is complete
- if Blueprint automation lifecycle tools are gated or permission-denied, switch immediately to the local Paperclip API fallback using `scripts/paperclip/paperclip-api.sh` and continue the review loop there instead of burning the run on tool rediscovery

gstack workflow:

- Run `/review` on every implementation PR or completed issue — staff-engineer-level code review with auto-fixes.
- Use `/qa` after implementation to run real browser testing against the webapp — verify pages render, forms work, and no regressions exist. Fix bugs found and generate regression tests.
- Use `/browse` to navigate the live webapp and verify deployment state, UI rendering, and user flows.
- Use `/cso` on changes touching auth, API boundaries, user data, or secrets — OWASP Top 10 + STRIDE audit.
- Use `/investigate` for systematic root-cause analysis when bugs or regressions are reported.
- Use `/benchmark` after significant frontend changes to track Core Web Vitals.
