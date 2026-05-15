# Paperclip Ops Agent Guide

This directory owns Blueprint's Paperclip company package, plugin, agent kits, playbooks, reports, and control-plane runbooks.

Read root [`AGENTS.md`](../../AGENTS.md), [`AUTONOMOUS_ORG.md`](../../AUTONOMOUS_ORG.md), [`ops/paperclip/README.md`](./README.md), and [`docs/architecture/command-safety-matrix.md`](../../docs/architecture/command-safety-matrix.md) before changing or running Paperclip workflows.

Agent discovery: use this file for `ops/paperclip/**` details, but root `AGENTS.md`, `AUTONOMOUS_ORG.md`, and `docs/architecture/source-of-truth-map.md` govern source-of-truth boundaries.

Local conventions:

- Paperclip is the execution and ownership record. Notion is the workspace/review/visibility surface.
- Agent kit changes must preserve the employee-style contract in `ops/paperclip/blueprint-company/agents/README.md`.
- Human blockers must use `ops/paperclip/programs/human-blocker-packet-standard.md` and the reply handling contract when truly human-gated.
- Do not use `hlfabhunt@gmail.com` for org-facing drafts, sends, or escalations.
- Treat `ops/paperclip/plugins/blueprint-automation/src/worker.ts` as high-risk because it can affect many live routines and issue paths.
- Treat `ops/paperclip/external/**` as reference material, not Blueprint architecture authority.

Verification:

```bash
scripts/paperclip/validate-agent-kits.sh
npm run paperclip:sweep:run-failures -- --markdown
```

Run bootstrap, repair, reconcile, public-url, webhook, or smoke scripts only when the task explicitly authorizes control-plane mutation.
