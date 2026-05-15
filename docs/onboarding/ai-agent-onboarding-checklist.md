# AI Agent Onboarding Checklist

Status: Supporting checklist for `docs/onboarding/ai-agent-onboarding-runbook.md`.
Owner: `blueprint-cto`.
Review cadence: Monthly.

## 1. Read Before Acting

- Read `AGENTS.md`, then the nearest nested `AGENTS.md` for the directory you will touch.
- Read `README.md`, `PLATFORM_CONTEXT.md`, `WORLD_MODEL_STRATEGY_CONTEXT.md`, `AUTONOMOUS_ORG.md`, and `DEPLOYMENT.md`.
- Read `docs/architecture/source-of-truth-map.md`, `docs/architecture/command-safety-matrix.md`, and `docs/architecture/ai-onboarding-map.md`.
- Confirm whether the task is repo-only, Notion-visible, Paperclip-owned, or live-system-dependent.

## 2. Establish Current State

- Run `git status --short` before repo edits.
- Inspect relevant untracked or dirty files before editing.
- Confirm which source owns the truth: repo, Paperclip, Notion, Firebase/Firestore, Stripe, Render, Redis, GitHub, payroll/PEO, or a provider console.
- Identify any legal, HR, payroll, benefits, rights/privacy, or source-needed gaps before writing definitive language.

## 3. Mutate Safely

- Read the command safety matrix before running live, send, provider, payment, payroll, deploy, Notion, Firebase, Render, Stripe, or Paperclip commands.
- Use supported Notion connector/API paths only; do not scrape Notion HTML, private Notion APIs, or browser cookies.
- Preserve unrelated repo changes and preserve Notion child pages/databases.
- Keep Blueprint capture-first and world-model-product-first; do not turn qualification, readiness, or generated artifacts into primary proof.

## 4. Validate And Close Out

- Verify with the narrowest relevant command.
- For onboarding or agent-kit changes, run `scripts/paperclip/validate-agent-kits.sh` when relevant.
- Run the unfinished-marker scan over `docs/company`, `docs/onboarding`, `README.md`, and `docs/architecture`.
- Close out with changed paths, validation result, evidence paths, remaining blockers, owner for follow-up, and any source-needed gaps.
