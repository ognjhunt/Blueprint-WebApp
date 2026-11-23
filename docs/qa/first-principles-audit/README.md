# First-principles audit, 2026-11-22

An audit of Blueprint-WebApp and BlueprintCapturePipeline against one line:
"Post a job for robots. Film one repetitive job and find out who wants to
deploy robots for it." It changed nothing in either repository. Fixes ship in
later pull requests the owner approves.

Start with `summary.md`. The fixes have since shipped: `what-shipped.md` lists every pull request, what was
left and what still needs the owner.

| File | What it is |
|---|---|
| `summary.md` | One page: the five things in the way, the three biggest deletions, the three missing pieces, demo readiness |
| `findings.md` | 141 findings, one row each, with evidence (`findings.json` has every field) |
| `journeys.md` | The five journeys step by step, today and as proposed, with step counts |
| `delete-list.md` | Everything that can go: why, cost today, what depends on it, how to remove it safely |
| `build-list.md` | The missing pieces, ranked by effect against effort |
| `pipeline-timing.md` | Time, cost and failure per stage; the slowest link |
| `demo-script.md` | The five-minute investor walkthrough, fallbacks, pre-flight list, fact sheet |
| `plan.md` | Three waves of small pull requests, with checks and where the owner's OK is needed |
| `owner-questions.md` | 28 decisions only the owner can make, each with a recommendation |
| `what-shipped.md` | Added 2026-11-23: every fix pull request after the audit, what was not done and why, and what still needs the owner |
| `ledger-actions.md` | What happened to each of the 254 delete, merge and simplify verdicts |
| `requirements-ledger.md` | "Do we really need it?" for 429 steps, fields, rules, stages and timers |
| `inventory.md` | The map: every route, screen, email, API route, timer, stage, unit and flag |
| `evidence/` | Production counts (counts and timestamps only) with the scripts that read them; baseline test results |
| `screenshots/` | Each journey at 1280 px and 390 px |
| `raw/` | Each agent's full report, its findings, the merged candidates and the checking verdicts |

## How it was done

Twelve agents worked read-only: two mapped the repositories, five walked the
journeys, five hunted by dimension. Four more then tried to refute every P0
and P1 finding. One more looked for what was missed. The owner asked, as the
audit started, to question every requirement; each agent kept a ledger with
"delete" as the default answer.

Rules kept: no paid compute or provider call; no real site's video, name,
address, contact or description read; production read for counts and
timestamps only; nothing written to production; no email sent; no company
contacted.

## What was not covered

- Real phones. The camera and upload path was walked in a desktop browser with a phone's settings. Accessibility of the start form was not tested.
- Sign-in, password reset, the site claim page and account settings.
- Emails as rendered. They were read in the code, never sent.
- The Terms of Service, line by line against the product. The Privacy Policy was compared more closely.
- Several jobs at the same time. Only one real job ran in November.
- The frame-extraction function, which lives in a third repository that was not checked out.
- Values set only in the Render dashboard or on the host, and the Firestore and Storage rules actually deployed.
- Whether the one approved company record and the job records are outside parties or Blueprint's own trials. That would need a personal field.
- 59 of the 91 P2 findings were not checked a second time. One P1 (A-05, large videos) could not be settled.
- The completeness check's own report is `raw/critic.md`.
- Pipeline timings rest on three jobs.
