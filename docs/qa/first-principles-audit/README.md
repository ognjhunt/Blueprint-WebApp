# First-principles audit, 2026-11-22

An audit of Blueprint-WebApp and BlueprintCapturePipeline against one line:
"Post a job for robots. Film one repetitive job and find out who wants to
deploy robots for it." It changed nothing in either repository. Fixes ship in
later pull requests the owner approves.

Start with `summary.md`.

| File | What it is |
|---|---|
| `summary.md` | One page: the five things in the way, the three biggest deletions, the three missing pieces, demo readiness |
| `findings.md` | 140 findings, one row each, with evidence (`findings.json` has every field) |
| `journeys.md` | The five journeys step by step, today and as proposed, with step counts |
| `delete-list.md` | Everything that can go: why, cost today, what depends on it, how to remove it safely |
| `build-list.md` | The missing pieces, ranked by effect against effort |
| `pipeline-timing.md` | Time, cost and failure per stage; the slowest link |
| `demo-script.md` | The five-minute investor walkthrough, fallbacks, pre-flight list, fact sheet |
| `plan.md` | Three waves of small pull requests, with checks and where the owner's OK is needed |
| `owner-questions.md` | 27 decisions only the owner can make, each with a recommendation |
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

- Real phones. The camera and upload path was walked in a desktop browser with a phone's settings.
- The frame-extraction function, which lives in a third repository that was not checked out.
- Values set only in the Render dashboard or on the host.
- Whether the one approved company record and the job records are outside parties or Blueprint's own trials. That would need a personal field.
- The 59 P2 findings were not checked a second time.
- Pipeline timings rest on three jobs.
