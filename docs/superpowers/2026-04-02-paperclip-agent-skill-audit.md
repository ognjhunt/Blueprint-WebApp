# Paperclip Agent Superpowers Audit

Date: 2026-04-02

Scope:

- audited all Blueprint company agents in `ops/paperclip/blueprint-company/agents`
- checked live Paperclip config in `ops/paperclip/blueprint-company/.paperclip.yaml`
- checked local superpowers availability on this host
- checked adapter support for skill sync

Key constraints:

- `claude_local` and `codex_local` support `paperclipSkillSync`
- `hermes_local` does not support Paperclip skill sync today
- Hermes on this host already has a smaller built-in subset of software-development skills, but most ops/research agents are not code-execution-first roles, so they remain unwired for now

Wired now:

- `blueprint-cto`
- `beta-launch-commander`
- `conversion-agent`
- `webapp-codex`
- `webapp-claude`
- `pipeline-codex`
- `pipeline-claude`
- `capture-codex`
- `capture-claude`

Detailed audit:

| Agent | Adapter | Superpowers decision | Rationale |
| --- | --- | --- | --- |
| `analytics-agent` | `hermes_local` | none | Metrics interpretation and reporting role; current superpowers set is too code-execution-centric for the lane. |
| `beta-launch-commander` | `claude_local` | `writing-plans`, `dispatching-parallel-agents`, `systematic-debugging`, `verification-before-completion` | Release orchestration needs explicit checklists, parallel triage, root-cause handling, and fresh proof before GO/HOLD calls. |
| `blueprint-ceo` | `claude_local` | none | Strategy/governance lane already has stronger domain-specific planning skills; software-development superpowers would add ceremony without leverage. |
| `blueprint-chief-of-staff` | `hermes_local` | none | Managerial routing role, not a coding lane; Hermes subset was intentionally left off to avoid pushing ops work into code-shaped process. |
| `blueprint-cto` | `claude_local` | `writing-plans`, `dispatching-parallel-agents`, `systematic-debugging`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion` | Cross-repo technical oversight benefits from structured plans, multi-lane delegation, disciplined debugging, and explicit review loops. |
| `buyer-solutions-agent` | `hermes_local` | none | Buyer enablement/account-management lane; superpowers software workflow skills do not materially improve the core job. |
| `buyer-success-agent` | `hermes_local` | none | Post-delivery lifecycle lane; not a code-execution role. |
| `capture-claude` | `claude_local` | `writing-plans`, `dispatching-parallel-agents`, `systematic-debugging`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion` | Review/planning engineer for the capture repo. |
| `capture-codex` | `codex_local` | `using-git-worktrees`, `writing-plans`, `dispatching-parallel-agents`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion`, `finishing-a-development-branch` | Primary implementation lane for the capture repo. |
| `capture-qa-agent` | `claude_local` | none | QA/rubric lane is evidence review, not software implementation. |
| `capturer-growth-agent` | `hermes_local` | none | Growth playbook lane; software-development superpowers do not fit the primary work. |
| `capturer-success-agent` | `hermes_local` | none | Capturer lifecycle operations lane; not a coding role. |
| `city-demand-agent` | `hermes_local` | none | Market planning lane; no material gain from software-execution skills. |
| `city-launch-agent` | `hermes_local` | none | Market-launch planning lane; not a coding role. |
| `community-updates-agent` | `hermes_local` | none | Publishing/comms lane; humanizer plus truthful-quality-gate already cover the job better. |
| `conversion-agent` | `claude_local` | `writing-plans`, `systematic-debugging`, `requesting-code-review`, `verification-before-completion` | Experimentation lane changes real product behavior and needs plan/debug/review/proof discipline. |
| `demand-intel-agent` | `hermes_local` | none | Research lane; no software-execution need. |
| `docs-agent` | `claude_local` | none | Cross-repo docs maintenance is accuracy-heavy but not strong enough reason to impose the superpowers software workflow by default. |
| `field-ops-agent` | `claude_local` | none | Scheduling/coordination lane; not a coding role. |
| `finance-support-agent` | `claude_local` | none | Stripe/support workflow lane; browser/Stripe skills matter more than software-development superpowers. |
| `growth-lead` | `hermes_local` | none | Growth orchestration lane; existing domain skills are a better fit than code-process skills. |
| `intake-agent` | `claude_local` | none | Queue classification and drafting lane; not a coding role. |
| `investor-relations-agent` | `hermes_local` | none | Investor comms lane; superpowers software skills do not fit. |
| `market-intel-agent` | `hermes_local` | none | Research lane; not a coding role. |
| `notion-manager-agent` | `hermes_local` | none | Workspace reconciliation lane; Hermes skill-sync gap and non-code primary job mean no wiring for now. |
| `ops-lead` | `hermes_local` | none | Ops routing lane; left intentionally lightweight and domain-specific. |
| `outbound-sales-agent` | `hermes_local` | none | Sales/outreach lane; not a coding role. |
| `pipeline-claude` | `claude_local` | `writing-plans`, `dispatching-parallel-agents`, `systematic-debugging`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion` | Review/planning engineer for the pipeline repo. |
| `pipeline-codex` | `codex_local` | `using-git-worktrees`, `writing-plans`, `dispatching-parallel-agents`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion`, `finishing-a-development-branch` | Primary implementation lane for the pipeline repo. |
| `revenue-ops-pricing-agent` | `hermes_local` | none | Pricing/revenue-ops lane; not a software implementation role. |
| `rights-provenance-agent` | `claude_local` | none | Trust/compliance gate lane is policy/evidence review, not software execution. |
| `robot-team-growth-agent` | `hermes_local` | none | Growth playbook lane; not a coding role. |
| `security-procurement-agent` | `hermes_local` | none | Buyer questionnaire/security-response lane; not a coding role. |
| `site-catalog-agent` | `hermes_local` | none | Listing/catalog lane; not a coding role. |
| `site-operator-partnership-agent` | `hermes_local` | none | Partnership/commercialization lane; not a coding role. |
| `solutions-engineering-agent` | `hermes_local` | none | Technical buyer enablement lane, but still not a repo implementation role; no wiring for now. |
| `supply-intel-agent` | `hermes_local` | none | Research lane; not a coding role. |
| `webapp-claude` | `claude_local` | `writing-plans`, `dispatching-parallel-agents`, `systematic-debugging`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion` | Review/planning engineer for the webapp repo. |
| `webapp-codex` | `codex_local` | `using-git-worktrees`, `writing-plans`, `dispatching-parallel-agents`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion`, `finishing-a-development-branch` | Primary implementation lane for the webapp repo. |

Follow-up opportunities:

- if Hermes gains Paperclip skill-sync support, revisit `blueprint-chief-of-staff`, `notion-manager-agent`, and other technical Hermes lanes
- if Blueprint wants the full superpowers lifecycle in autonomous planning lanes, add curated `brainstorming` separately; it was intentionally excluded because its hard human-approval gate conflicts with continuous issue-driven automation
