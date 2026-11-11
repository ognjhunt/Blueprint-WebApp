# The site's answer: design

Owner direction, 2026-11-11. Two messages on that day set it:

1. Build the simple version: a thin layer over what exists that tells a site
   which robot most likely fits its job.
2. Simulation is core to the answer. Blueprint proves not only which robot but
   also which control policy, as well as current practice allows, and the answer
   then becomes a deployment opportunity for a deployment company. The long-term
   goal is the place where robot jobs and deployment opportunities appear.

This note records what was built and why. The audit that led to it is in the
Pipeline repo: `docs/audits/2026-11-11-first-principles-audit.md`.

## What a site gets

1. It sends an email and a video of one recurring job. Blueprint drafts the job
   description from the video.
2. **Its answer**, minutes after the video is read: the robot that most likely
   fits, a runner-up from another maker, what was ruled out and why, who already
   uses those robots for work like this, how sure Blueprint is, and what the
   video could not tell.
3. **Tested in simulation**, when the simulation of its site has run: the
   picked robot's reach and arm path checked in the scene rebuilt from the
   video, and public control policies compared on its job on a research arm
   (today the Franka research arm, the only robot with several public
   policies), with a cited statement of how far such a comparison can be
   trusted. The simulation checks no cycle time.
4. **A deployment company**: one button shares an anonymised job card, with the
   answer and the simulation result, with deployment companies Blueprint has
   approved.

The answer never waits on brief confirmation, staff sharing or the simulation.

## How the answer is made

`server/utils/siteAnswer.ts` composes it on every status read from documents
that already exist. It is pure and deterministic; if it fails, the status read
returns `answer: null` and carries on.

- **The job's numbers** come from `jobFactsOf` (`server/utils/siteRobotFit.ts`):
  what the site measured or stated first, then the video reader's estimates
  (`walkthrough_job_estimates`). A length estimated from video is widened to
  0.75–1.33 times its value for the checks.
- **Real robots** come from the Pipeline's spec catalog, mirrored byte for byte
  at `contracts/pipeline/robot-spec-catalog.v1.json` (22 models, 13 makers,
  every figure with its source and quote). `npm run
  pipeline:robot-spec-catalog:verify` checks the copy against the sibling repo.
- **Checks** per model: reach (a fixed arm stands between the two spots and
  needs half the span plus the tool and 10 cm), payload (the object plus a
  standard gripper), and cycle time only when the site stated a target. Each
  check passes only if it passes at the pessimistic end of the band, fails only
  if it fails at the optimistic end, and is otherwise unknown. Every check
  sentence names where its number came from (`AnswerCheck.basis`).
- **Each check takes its outcome from the best source for its own quantity**,
  in the order of trust: what the site measured or stated, then the scene
  rebuilt from the video, then the video's estimate. Payload is always this
  check on the best weight; the scene never changes it. Reach is this check
  when the site gave the distance itself. Otherwise, when the Pipeline's table
  from the measured scene has the model (matched by maker and name with
  `sameRobot`, `client/src/lib/robotNameMatch.ts`): "fits" and "fits on its
  figures" pass reach in the scene; "doesn't fit" fails reach only when the
  payload check passes (and, when the row lists what failed, a reach, stance or
  access check is among them); "unknown" with reach still open leaves reach
  unknown; anything else leaves the video's reach check standing.
- **Verdicts** come only from the checks: any failed check rules a robot out,
  with that check's sentence as the reason; all passed is "fits" when the scene
  passed reach with a clear arm path, else "fits on paper"; otherwise "may
  fit". A robot is "checked in the scene" only when the scene decided its reach
  check. The note that the job needs a robot that moves between the spots
  appears only while no arm that stays in one place passed its reach check.
- **Evidence** comes from `server/data/deploymentEvidence.v2.json`
  (`deployment_evidence.v2`): 30 rows, each a verbatim quote with its URL,
  title and publisher. A row applies only to the catalog models it lists
  (`applies_to`, never empty, every id in the catalog and made by the row's
  maker) and says whether its source names that exact model or the robot
  family it belongs to (`names`, `family`); there are no maker-wide rows.
  Levels: `production` (in ongoing use at an end customer, named or reported
  unnamed: 16 rows), `pilot` (a trial at a named end customer: none at
  present) and `offered` (marketed for the job, no end customer: 14 rows). The
  loader (`server/utils/deploymentEvidence.ts`) drops any row that breaks a
  rule, and a test loads the shipped file and expects none dropped. The rows
  were re-graded under these rules on 2026-11-11 by a pass that did not write
  them. The page says whether the source "names this model" or "names this
  robot family".
- **Ranking** is a fixed rule with no person and no model in it: verdict, then
  a comfortable margin (a tenth of the rating to spare on every check that has
  a figure), then evidence level for this kind of job, then a source that names
  the model before one that names its family, then the least machine the job
  needs, then margin up to a fifth of the robot's rating, then the smaller
  robot.
- **Confidence** is a word, with its reasons and what would raise it. "Good"
  needs every check of the pick passed, none on a video estimate, and
  documented production use.

**The kind of job.** The fit check covers jobs where one solid object is
carried from one place to another, and what is done decides it, never what the
object is called. In this order: a job sentence the site typed or confirmed,
by its verbs; else the video reader's own `job_kind` (`pick_and_place`,
`palletizing`, `machine_tending` or `other`, which also gives the job family);
else the verbs in the reader's sentences; else an object and a distance or a
height counts as a carry. A word counts as a verb only where grammar makes it one,
and when the rule is unsure it says nothing, so the reader's `job_kind` or the
numbers decide. A carrying word (pick, place, move, load, take, drop and so on)
counts in any form unless a determiner comes right before it ("the load"); an
other-action word (fold, pour, screw, open, press and so on) counts only as an
-ing form not after a determiner or a carrying word, a base or -s form followed
by an object word ("fold the towels"), a base form opening a sentence with no
carrying word ("Fold towels"), or a past form after "is", "are", "get" and the
like ("towels are folded"), so an object's name ("screws", "paint cans", "the
hydraulic press") never decides. Only other verbs and no carrying verb: the answer
says it can't check robots against the job. Both: it checks the carry and says
what else the job involves, as it does for the reader's `other_actions`. A job
sentence with more than one step adds that the check covers one carry.
Whether the simulation can score a job never decides whether the fit check
runs.

## How the simulation result is made

`client/src/lib/simulationProof.ts` is a pure projection of data the job page
already loads: the evaluation summary from the job workflow, the Pipeline's
robot table and the answer's pick. The page shows it under "Tested in
simulation"; the simulation email repeats its sentences word for word.

- **The pick in the scene**: the Pipeline's table from the scene rebuilt from
  the video, matched to the pick by maker and model (`sameRobot`,
  `client/src/lib/robotNameMatch.ts`). "Fits" says the arm reaches the pick-up
  and put-down points with a clear arm path; "fits on its figures" says its
  path there is not confirmed.
- **Policies are named in plain words** (`client/src/data/simulationPolicies.ts`):
  the policy's common name and its maker, never a checkpoint string, code or
  markup. Scripted rows and rows the selection marks as references are never
  ranked.
- **A comparison from a few tries is a probability, said by one rule.** Each
  policy's success rate, from s successes in n scored tries, is uncertain:
  Beta(s + 1, n − s + 1). The policy with the highest expected rate leads, and
  is compared with the next best only, by the chance that its true rate is
  higher (`probabilityAhead`, integrated numerically). At 97.5% or more
  (`CLEAR`) the page says it "did best" and that a gap this size is unlikely to
  be chance. From 85% (`AHEAD`) it says it "was ahead" and that with this few
  tries the gap could still be chance. Below 85% it says there is no clear
  difference yet and gives each count. One try each, 1 against 0, is 5/6: no
  clear difference; 7 of 10 against 3 of 10 is about 0.96: ahead; 9 of 10
  against 3 of 10 is above 0.99: did best. The counts decide, not the
  Pipeline's own choice, and a policy that never completed the job is never
  ahead.
- **Every sentence has a precondition in the data.** Nothing says a policy ran,
  was tried or completed the job unless tries were scored; a likely range
  appears only beside a row with a success. When no policy completed the job,
  the page says the simulation could not rank them and shows what the scene
  check found; it is never called an estimate. When no policy was scored, or
  the simulation was held (for budget, the scene check or a set-up problem), it
  says what happened to the simulation and never that policies ran. A seeded
  generated-input test checks these rules over thousands of random results.
- **Accuracy is stated with its sources and conditions**
  (`client/src/data/simulationAccuracy.ts`): in one direct published test the
  simulated ranking matched the real one in 8 of 9 comparisons, and simulated
  scores correlate with real ones at about 0.9. Those results needed a clean
  scan with true scale, a calibrated controller and research policies. The page
  says which of those hold for the job in front of the reader.
- **Only one robot has several public policies today**, the Franka research
  arm. For other robots the page says Blueprint has no public policy to run on
  them, and the simulation checks their reach and arm path.

The Pipeline plan for making this proof fast and validated is
`docs/launch-readiness/2026-11-11-simulation-proof-fast-lane-plan.md` in the
Pipeline repo.

## The deployment opportunity

"Find a deployment company for this job" is the site's explicit choice to share.
`POST /api/site-task-brief/:token/introduction-request` requires the version of
the sentence the page showed under the button (`statementVersion`); a request
without it is refused with "Press the button on your job page to ask for this."
and one naming another version is asked to reload. It records the request once
under that sentence, turns the job card on through the existing listing
function under the same statement (a card that is already on keeps its
content; see below), and rings Blueprint's owner once with the job family, the pick and the
runner-up. It contacts no outside company and queues no alert email to them;
approved companies see the card when they browse the job library, and whom to
introduce is the owner's decision.

A card carries the answer (and the library shows its headline) only while the
site's request was recorded under the statement that names the answer AND the
card's current listing consent is that same statement. A card listed, or later
re-saved, under the older card box carries no answer, and no answer is composed
for it. The latest consent the site gave governs: when the card is already on
under the older box and the site presses the button, only the listing's consent
version and its time move to the with-answer statement (the owner's reviewed
card, its revision, thumbnail and go-live time are untouched, and no company is
alerted), so the card then carries the answer until the site re-saves it under
the older box. At intake, sharing is an unticked box.

## Emails

One new email, `answer_ready`, is sent once when the answer first settles. It
says: "If Blueprint runs a simulation of your site, its result appears on the
same page." The notices that belonged to robot-team-run evaluations are
suppressed; Blueprint runs evaluations itself.

When the simulation finishes with a result, its email
(`server/utils/taskLifecycleNotifications.ts`) states the job page's own
comparison sentence and scene notes, from the same projection. Its subject is
"Your simulation result is ready" when some policy completed the job, with how
far a published comparison can be trusted; otherwise "The simulation of your
job has finished", with what the simulation found and no offer of a pilot.

## How to check it

Run these from the repository root. None of them sends email or touches
production; the first two use fakes or local emulators only.

```bash
# 1. The whole journey in one process, with in-memory fakes.
npx vitest run server/tests/site-answer-journey.test.ts

# 2. The same journey in a real browser, against local emulators.
npx -y firebase-tools@13.35.1 emulators:start --only firestore,storage \
  --project demo-blueprint-reliability --config firebase.json   # in another shell
npm run test:answer-journey:browser -- --trace off

# 3. The robot spec catalog copy matches the Pipeline's file. Read-only.
npm run pipeline:robot-spec-catalog:verify
```

1. Proves that an email and a video with no typed task give the site its
   answer, one answer email, a deployment-company request recorded once, and
   that withdrawing permission takes the answer away, using the real server code.
2. Proves the same steps work on the real job page in a browser, with the data
   kept in local Firestore and Storage emulators.
3. Proves every robot figure the answer shows comes from the same catalog the
   Pipeline keeps, byte for byte, so no figure has drifted from its source.

## What it is not

A fit check against published specifications, a cited track record and a
simulation. It is not a test of a robot at the site and certifies neither
performance nor safety.
