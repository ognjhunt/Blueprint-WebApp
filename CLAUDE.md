# Blueprint-WebApp Claude Guide

Read [`AGENTS.md`](AGENTS.md); it applies to every agent.

In short: email and video in. Blueprint turns the video into a job packet that
approved deployment companies can evaluate without a visit and, with the
site's permission, sends it to them; the site sees their responses: who will
take the job, who will not, and why. Until responses exist the site sees the
first look on paper, the simulation of its site and where the job stands. Our
own early trial of openly available robot software is supporting evidence,
never the answer. Today a deployment company receives a summary of a job only;
a site's video and simulation stay private until the owner sets a new
permission. The site pays nothing; no price is stated. The only hard stops are
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
