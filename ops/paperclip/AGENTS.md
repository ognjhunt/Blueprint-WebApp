# Paperclip Ops Agent Guide

The Paperclip autonomous organisation is retired (see
[`AUTONOMOUS_ORG.md`](../../AUTONOMOUS_ORG.md)). This directory keeps the
company package as stubs at their paths, with every routine paused, plus the
plugin and host tooling. The old kits, tasks, playbooks, programs and skills are
in `docs/archive/2026-11-12-pre-packet/ops/paperclip/`.

- Do not start Paperclip work, wake routines, or run bootstrap, repair,
  reconcile, public-url, webhook or smoke scripts unless the owner asks for it.
- The frame for everything is the shared block of
  [`PLATFORM_CONTEXT.md`](../../PLATFORM_CONTEXT.md).
- Read [`docs/architecture/command-safety-matrix.md`](../../docs/architecture/command-safety-matrix.md)
  before running anything here.
- Treat `ops/paperclip/plugins/blueprint-automation/src/worker.ts` as high-risk.
- Treat `ops/paperclip/external/**` as third-party reference, not authority.

Local checks (no server contact):

```bash
npx vitest run scripts/paperclip
```
