# Blueprint-WebApp Agent Guide

This guide applies to everyone working here, human or agent (Claude, Codex,
Hermes). `CLAUDE.md` is a pointer to it.

## Mission

A site films one recurring job once. Blueprint turns the video into a **job
packet** that any robot deployment company can evaluate without visiting,
sends it to deployment companies Blueprint has approved, and tells the site
who will take the job and on what evidence. The site is the user and pays
nothing. The deployment company is the customer. Deployment companies will
pay; how is not decided, and no price is stated anywhere. Each introduction is recorded as a billable event. Nothing is charged and no price is stated until the owner sets one.

The packet holds the site's own sentence for the job and its constraints, the
video with the site's rights recorded, the first look on paper (which kinds of
robot most likely fit, from published specifications and a cited track
record), the simulation of the site with the job's object in it and the
success rule. Blueprint no longer runs robot software in the simulation: the
owner dropped the early trial of openly available robot software on
2026-11-14. A scripted run only checks our own simulation.

The site's answer is the responses of deployment companies: who will take the
job, who will not, and why. Until responses exist the site sees the first look
and the simulation of its site, and is told plainly where the job stands: not
yet sent, sent and waiting, or no response yet. Nothing promises a response
that has not been given. A job starts as a private draft if the site has yet
to film or upload. The job reaches companies once its description and playable,
sound-free video are available, with the first look and simulation added as
they are ready. No deployment company is required to test in the simulation. When
several are interested the site decides which of them to meet. After an introduction both sides are asked, at 14, 45 and 90 days, what happened; the answer is recorded on the job.

Sharing is the service. A site that sends a job agrees once, in the statement
it accepts (recording statement `2026-11-12.v4` or later), that Blueprint
shares the job with the deployment companies it has approved: the site's
description, its video without its sound, the simulation built from it and the
success rule; the first look stays with the site (2026-11-25). There is no share button, no
share setting and no pause. A job under an older statement is not shown to any
company until its site accepts the current one. A site's name, street address
and contact details are never shared without asking the site first. A
withdrawal removes the job from every company's view at once. A copy a company
already saved cannot be taken back; the company is asked to delete it.

No person at Blueprint stands between a site's video and an introduction. When a job is ready it is shown to every approved deployment company, and each is emailed about it unless it turned job emails off. People act only where their own decision is the point: a site sends, confirms, asks for an introduction and can withdraw; a company applies and answers; Blueprint approves a company once. The site asks for an introduction with one press for each company it wants to meet; Blueprint then gives each side the other's name and contact details by email. Nothing else shares them. The website works this way: a job goes to the
approved companies on its own, the site presses Introduce us, and the follow-up
questions are sent.

Owner direction, 2026-11-23: approval in minutes, not days. Blueprint still
approves a company once, now by a published rule checked automatically
(`server/utils/companyCheck.ts`): a new deployment company is approved at once
when its work email is at its website's domain and that website shows it
deploys robots (a model reads the page; plain code checks the domain, the
model's quote on the page and a daily cap). The owner decides, with one press,
every application the rule does not settle, with the check's reasons in front
of them. A technology partner is never approved by the rule.

This repo is the site side: start a job with an email and a video, see the
first look, the simulation of your site, where the job stands and the
responses. A person who works at the site films the job on their own phone
through this repo; no capture app, outside capturers or Blueprint filming
visits ("How Capture Works" in `PLATFORM_CONTEXT.md`).

Owner direction, 2026-11-12. It replaces the direction of 2026-11-11.

Shared doctrine: `PLATFORM_CONTEXT.md` (read its preamble). The shared block is
generated from `BlueprintCapturePipeline/doctrine/`; never edit inside it here.

Words to use with sites and companies: "deployment company" (not vendor,
integrator or OEM), "job packet", "first look", "simulation of your site",
"responses". Say **job** to customers; keep **task** for the
technical robot action and its contract.

## The Only Hard Stops

Fail closed only for:

- **Privacy:** the site's consent is respected, including its withdrawal.
  Faces are blurred in the frames sent to World Labs only for a job started
  under an earlier Privacy Policy. Footage of a job started under the current
  policy is not blurred. People in captures are not otherwise screened or
  blurred.
- **Rights:** capture permissions, revocation, and licenses.
- **Money:** spending stays inside its budget: one cap per job, $40 for
  everything a job spends across every provider and every retry (owner decision
  2026-11-19; `contracts/pipeline/website-job-spend-cap.v1.json`, mirrored from
  the Pipeline's `config/website_job_spend_cap.v1.json`), and the account's
  monthly limit on top. Nothing raises a job's cap; at the cap the job ships
  what it has, flagged. Internal budgets are Blueprint's controls, never a step
  for the site.

Everything else keeps going. If something is missing, ambiguous or
unverified, flag it where the person can see it and continue the same job;
ask at most one question at a time, inside that job. Fixing a failure means
fixing its cause; do not add a gate, approval step, review stage or readiness
check unless it protects privacy, rights or money. Delete checks that protect
none of the three.

Contacting a company that Blueprint has not approved is outreach and needs the owner's word first. Ask the owner first before sending email
by hand to outside people, charging money, or deleting retained data. `docs/architecture/command-safety-matrix.md` lists
commands with live side effects.

## Two Truths

- Don't make things up: no invented figures, customers, results or readiness.
  Public figures carry their source (`client/src/data/deploymentMarket.ts`).
- Simulation results are bounded estimates; they never certify physical
  performance or safety.

## Stack

Firebase, Firestore, Render, Redis, Resend, Notion and Paperclip. Don't add a
new primary service without the owner's OK.

## Repo Map

- `client/src/pages/`, `client/src/components/`, `client/src/lib/`: the site
- `server/`: backend routes and integrations
- `scripts/`: checks, smoke tests, launch tooling
- `e2e/`: Playwright coverage

## Commands

```bash
npm install
npm run dev
npm run check            # typecheck
npx vitest run <paths>   # tests for what you changed
npm run test:e2e         # Playwright
npm run build
```
