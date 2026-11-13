# Scripts Agent Guide

This directory contains local checks, build helpers, launch gates, human-reply tools and Render helpers.

Read [`docs/architecture/command-safety-matrix.md`](../docs/architecture/command-safety-matrix.md) before running anything outside simple local checks.

Agent discovery: use this file for `scripts/**` details, but root `AGENTS.md` and the command safety matrix govern side-effect decisions.

Local conventions:

- Prefer read-only/audit commands before repair, apply, send, deploy, or sync commands.
- Treat `scripts/human-replies/` and `scripts/render/` as side-effect capable.
- Do not run commands that send email, mutate provider state, deploy, import env, wake live Paperclip routines, or write Notion/Firebase/Stripe state unless the task explicitly asks for it.
- Use dry-run flags when available and keep output artifacts under existing report/output paths.
- Provider portability: migration, export, backup and release helpers keep company-controlled canonical storage, stable
  Blueprint IDs, standard formats, manifests/hashes/provenance and a documented
  replacement-agent recovery route. An optional Library delivery copy must not
  become the production source or sole retained artifact; private transfer to
  an unapproved destination remains blocked while local bytes are preserved.

Safe defaults:

```bash
npm run check
npm run audit:assets
```
