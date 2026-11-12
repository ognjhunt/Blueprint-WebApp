# Blueprint-WebApp Claude Guide

Read [`AGENTS.md`](AGENTS.md); it applies to every agent.

In short: email and video in. Blueprint turns the video into a job packet that
approved deployment companies can evaluate without a visit and shares it with
them: sharing is the service, agreed once when the site sends the job, with no
share button, no share setting and no pause. The site sees their responses: who will
take the job, who will not, and why. Until responses exist the site sees the
first look on paper, the simulation of its site and where the job stands. Our
own early trial of openly available robot software is supporting evidence,
never the answer. A site's name, street address and contact details are never
shared without asking the site first. The site asks for an introduction with
one press, at most three per job; Blueprint then gives each side the other's
name and contact details by email. No person at Blueprint stands between a
site's video and an introduction. The website change for this is in build. The
site pays nothing. Deployment companies will pay; how is not decided, and no
price is stated anywhere. Each introduction is recorded as a billable event. The only hard stops are
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
