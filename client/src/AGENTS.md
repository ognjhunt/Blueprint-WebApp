# Client Agent Guide

This directory owns the React/Vite frontend: the public pages, the site's job
pages, account screens and admin dashboards.

Read root [`AGENTS.md`](../../AGENTS.md) and the shared block of
[`PLATFORM_CONTEXT.md`](../../PLATFORM_CONTEXT.md) before changing product
meaning. `docs/architecture/command-safety-matrix.md` governs command safety.

Public copy:

- Don't make things up. Every sentence is true on the day it ships: no invented
  figures, customers, results, readiness or availability.
- Plain English, short sentences. Say what happens today. Make no promise:
  nothing promises a response, a result, a date or a deployment.
- Say plainly where a job stands: not yet sent, sent and waiting, no response
  yet, or the responses given. A plain "not yet" is better than a confident
  sentence that is not true.
- Use the frame's words: "deployment company" (not vendor, integrator or OEM),
  "job packet", "first look", "simulation of your site", "early trial",
  "responses". Say **job** to customers; keep **task** for the technical robot
  action.
- The early trial is our own trial of openly available robot software. It is
  never the site's answer and never predicts a deployment company's robot.
- No price is stated anywhere. Sites pay nothing.
- Today a deployment company receives a summary of a job only. Nothing may say
  or imply that a company sees a site's video or simulation: no recorded
  permission covers it yet.
- A simulation never certifies physical performance or safety.
- Do not edit Terms, Privacy, their previous versions or any recorded consent
  statement: they record what a person agreed to and change only with a new
  version and the owner.

Local conventions:

- Start route work in `client/src/app/routes.tsx`.
- Do not rename internal contracts (for example `siteWorld`) just to match
  public copy.
- Keep secrets out of client code; use `client/src/lib/client-env.ts` for
  allowed client env access.

Verification:

- Type or shared contract changes: `npm run check`.
- Public copy: `npx vitest run client/tests` and the affected `e2e/` specs.
- Public asset changes: `npm run audit:assets`.
- Route changes: targeted component/browser checks; `npm run test:e2e` when the route behavior needs browser proof.
