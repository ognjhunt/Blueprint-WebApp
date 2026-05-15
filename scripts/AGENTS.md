# Scripts Agent Guide

This directory contains local checks, build helpers, launch gates, city-launch runners, GTM runners, human-reply tools, graphify refresh, Render helpers, and Paperclip host tooling.

Read [`docs/architecture/command-safety-matrix.md`](../docs/architecture/command-safety-matrix.md) before running anything outside simple local checks.

Agent discovery: use this file for `scripts/**` details, but root `AGENTS.md` and the command safety matrix govern side-effect decisions.

Local conventions:

- Prefer read-only/audit commands before repair, apply, send, deploy, or sync commands.
- Treat `scripts/city-launch/`, `scripts/gtm/`, `scripts/human-replies/`, `scripts/render/`, and `scripts/paperclip/` as side-effect capable.
- Do not run commands that send email, mutate provider state, deploy, import env, wake live Paperclip routines, or write Notion/Firebase/Stripe state unless the task explicitly asks for it.
- Use dry-run flags when available and keep output artifacts under existing report/output paths.
- If code files changed, run `bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz` before closeout.

Safe defaults:

```bash
npm run check
npm run audit:assets
npm run gtm:hosted-review:audit
npm run city-launch:preflight -- --city "Durham, NC"
```
