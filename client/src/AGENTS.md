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
  "job packet", "first look", "simulation of your site", "responses". Say
  **job** to customers; keep **task** for the technical robot action.
- Blueprint no longer runs robot software in the simulation: the owner dropped
  the early trial on 2026-11-14. Copy never offers one. A scripted run only
  checks our own simulation.
- The site pays nothing. Deployment companies will pay; how is not decided,
  and no price is stated anywhere. Each introduction is recorded as a billable event. Nothing is charged and no price is stated until the owner sets one.
- Sharing is the service. A site that sends a job agrees once, in the statement
  it accepts (recording statement `2026-11-12.v4` or later), that Blueprint
  shares the job with the deployment companies it has approved: the site's
  description, its video without its sound, the simulation built from it when
  one is built, and the success rule; the first look stays with the site
  (2026-11-25). There is no share button,
  no share setting and no pause. A job under an older statement is not shown to
  any company until its site accepts the current one. A site's name, street
  address and contact details are never shared without asking the site first.
- A simulation never certifies physical performance or safety. It is built
  when a deployment company asks for one (owner, 2026-11-28): copy never says a
  job has, or will have, a simulation unless one was asked for.
- A pilot offer's terms are the company's own, given before a site visit. Copy
  says so wherever a figure of a company's is shown: not a quote, and Blueprint
  does not check or guarantee it.
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
