# First-principles audit: shared brief for every audit agent

Audit of `ognjhunt/Blueprint-WebApp` and `ognjhunt/BlueprintCapturePipeline`,
2026-11-22. This file is the working brief each agent reads before it starts.
The owner-facing results are the files one folder up.

## What "working" means

A site films one repetitive job on a phone and posts it for free. Blueprint
turns the video into a job packet: the site's own sentence for the job, the
video with its sound removed, a first look on paper, and a simulation of the
site with the job's object in it plus the success rule. The packet is shared
with deployment companies Blueprint has approved. Each answers Interested,
Not a fit or Need more details (and, once the simulation can be downloaded,
Tested it: can do / cannot yet). The site presses Introduce us for each company
it wants to meet, and Blueprint emails each side the other's name and contact
details. At 14, 45 and 90 days both sides are asked what happened.

The site pays nothing. No price is stated anywhere. Each introduction is
recorded as a billable event. No person at Blueprint stands between a site's
video and an introduction. Blueprint approves each company once. Blueprint no
longer runs robot software in the simulation (early trial dropped 2026-11-14).

Home page line the audit is judged against: "Post a job for robots. Film one
repetitive job and find out who wants to deploy robots for it."

## Method: five steps, in this order

1. Make each requirement less dumb. For every rule, gate, field, wait and
   message: who asked for it (owner direction, doctrine line, guard, or
   nobody) and what breaks without it.
2. Delete the part or process. Try to remove the step entirely. Retired
   systems still carry weight: the early trial, filming visits, the capture
   app, screening campaigns, paid evaluations, the old onboarding checklist.
3. Simplify what is left: fewer screens, fields, states, emails, words, branches.
4. Shorten the cycle time: upload to packet, to first company response, to
   introduction. Find the slowest link and what makes it slow.
5. Automate last, and only what survives 1 to 4.

Every proposal states the user-visible result ("the site sees X sooner", "one
fewer screen") and its risk, and which of privacy, rights or money it touches.

Doctrine: the only hard stops are privacy, rights and money. A gate, approval,
review stage or readiness check that protects none of the three is itself a
finding (dimension `over-gated`).

## Question every requirement (owner instruction, 2026-11-22)

The owner added, while this audit was starting: "question all requirements …
for everything: do we really need the step". Treat every single thing you
touch as guilty until it proves it is needed: every step, screen, field,
button, email, wait, state, rule, check, gate, timer, stage, flag, document
and test. The default answer is DELETE.

- A requirement must trace to a named source: an owner direction with its
  date, a doctrine line, a law or provider term, or one of the three hard
  stops. "The code does it", "a test pins it", "a doc says so" or "it has
  always been there" is the source `nobody`. A requirement from a retired
  direction is also `nobody`.
- Ask in this order: what is this for; who needs it; what exactly breaks for a
  site, a deployment company or the owner if it is gone tomorrow; could the
  thing it protects be had with nothing at all, or as a side effect of a step
  that must exist anyway.
- Do not polish something that should not exist. If you catch yourself
  proposing to simplify, speed up or automate a step, first write down why it
  cannot be deleted.
- Delete too much on paper. If none of your proposed deletions would need to
  be added back, you did not delete enough: say which ones you expect might
  come back and why.
- The core loop needs only this: the site's sentence and video in, the
  site's agreement recorded, a packet a company can judge, the company's
  answer, Introduce us, the two contact emails, the billable event, the
  14/45/90-day question, and withdrawal. Anything else must argue for itself.

Put a section headed exactly `## Requirements ledger` in your report: one
table row per step, screen, field, email, wait, rule, check, stage or timer
you examined, with these columns:

| thing | where (file:line or screen) | who asked for it | what breaks if it is gone | verdict (DELETE / MERGE / SIMPLIFY / KEEP) | if KEEP: the one-sentence reason |

Every KEEP needs its reason. Every DELETE that is not trivially safe becomes
a finding in your findings file.

## Dimensions (tag every finding with one)

| tag | meaning |
|---|---|
| `broken` | does not work: errors, dead ends, wrong state, a test that passes while the product fails |
| `missing` | doctrine or copy promises it and the product does not do it, or a user obviously needs it |
| `vestigial` | half-built, TODOs, flags never on, retired systems still imported or costing money, dead routes, unused data |
| `friction` | avoidable steps, fields, waits, emails, sign-ins, confirmations, repeated questions, unclear next steps |
| `slow` | wall-clock time and where it goes; queueing; deploy-window effects |
| `fragile` | single points of failure, manual nudges, flaky tests, unhandled provider errors, jobs that never time out |
| `unseen` | things the owner cannot observe: job states, costs, billable events, failures |
| `over-gated` | gates, approvals and checks that protect none of privacy, rights or money |
| `untrue` | product copy that promises more than the code does, or unclear wording |
| `business` | billable events, what a future invoice needs, what is missing to start charging (never propose a price) |
| `demo-risk` | anything that could embarrass a live walkthrough |

Severity: `P0` breaks the core loop, is untrue, or risks privacy, rights or
money. `P1` real friction or a gap a customer or investor would hit. `P2`
polish. Effort: `S` under a day, `M` a few days, `L` a week or more.

Words to use: job, deployment company, job packet, first look, simulation of
your site, responses, Introduce us, Find jobs.

## Evidence standard

Every finding cites at least one of: `path/to/file.ts:123` (repo-relative,
prefixed `webapp:` or `pipeline:` when ambiguous), a command you ran with the
relevant lines of its output, a screenshot path, or a measured number with its
source. If you could not verify something, mark it `unverified` and say what
would verify it. No invented metrics, customers, quotes or timings. Say
whether the thing is reachable in production (the live site is at the repo
HEAD commit; the Pipeline's active release is in `door status`).

## Your two output files

Write both into `docs/qa/first-principles-audit/raw/`:

1. `<agent>.md`: the full report, in plain words, with the evidence.
2. `<agent>.findings.json`: the findings in the format below. Validate it:

   ```bash
   python3 /tmp/claude-0/-home-user/e3989091-e008-5b78-a9cb-b7c31a5efdb8/scratchpad/tools/validate_findings.py docs/qa/first-principles-audit/raw/<agent>.findings.json
   ```

   Fix it until the validator prints `OK`.

```json
{
  "agent": "journey-A",
  "summary": "three or four plain sentences",
  "findings": [
    {
      "id": "A-01",
      "title": "short plain title, the problem not the fix",
      "dimension": "friction",
      "severity": "P1",
      "effort": "S",
      "journey_step": "A.2 Starting the job",
      "evidence": ["webapp:client/src/pages/X.tsx:123", "cmd: npx vitest run … -> 1 failed: …", "screenshots/A-03-start-390.png"],
      "today": "what the user experiences today",
      "should": "what they should experience",
      "change": "DELETE",
      "proposal": "the concrete change, scoped as one small PR where possible",
      "user_result": "the site sees X sooner / one fewer screen",
      "risk": "what could go wrong; what depends on the thing changed",
      "hard_stop": "none",
      "verified": "yes",
      "verify_how": "",
      "requirement_source": "who asked for the thing today: owner direction <date>, doctrine line, guard <file>, or nobody",
      "live_in_production": "yes",
      "needs_owner": false
    }
  ],
  "good_things": [{"what": "works well, leave alone", "why": "…", "evidence": "file:line"}],
  "owner_questions": [{"question": "…", "recommendation": "…", "unblocks": "…"}],
  "open_cost_questions": [{"question": "only answerable by spending money", "estimated_cost_usd": "…", "basis": "…"}],
  "not_covered": ["what you did not walk, measure or read, and why"]
}
```

Allowed values: `dimension` as in the table; `severity` P0/P1/P2; `effort`
S/M/L; `change` DELETE/MERGE/SIMPLIFY/BUILD/FIX/AUTOMATE; `hard_stop`
privacy/rights/money/none; `verified` yes/unverified; `live_in_production`
yes/no/unknown; `needs_owner` true/false (true for recorded statements, legal
pages, money, privacy, outreach, or a product decision only the owner makes).

Write for the owner reading on a phone: one idea per sentence, no internal
jargon without a gloss. Be decisive: a recommendation, not a menu. Prefer
subtraction. Note what already works well and should be left alone.
