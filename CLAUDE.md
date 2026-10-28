# Blueprint-WebApp Claude Guide

Read [`AGENTS.md`](AGENTS.md); it applies to every agent.

In short: email and video in, Blueprint runs the candidates in a simulation of
the site, the site gets a bounded estimate or "held". The only hard stops are
privacy, rights and money; everything else is flagged and keeps going. Don't
make things up. Never edit inside a shared block of `PLATFORM_CONTEXT.md`.

For public-copy changes, run `npm run check`, `npx vitest run client/tests` and
the affected `e2e/` specs.

## Cloud sessions

- A cloud session starts with `bash scripts/cloud/bootstrap.sh`, then
  `bash scripts/cloud/doctor.sh`. `. ~/.blueprint-cloud/env.sh` gives a shell
  the Pipeline virtualenv, the pinned uv and the operator door URL.
- Procedure and environment values: `docs/runbooks/cloud-scene-runs.md`.
- Host access goes through the Pipeline repo's `scripts/operator_door.py`,
  never SSH.
