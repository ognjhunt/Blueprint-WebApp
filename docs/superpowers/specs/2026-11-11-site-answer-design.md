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
3. **Proof in simulation**, when the simulation of its site has run: its pick
   checked in the scene measured from the video, and the public control policies
   ranked on its job, with a cited statement of how far that ranking can be
   trusted.
4. **A deployment company**: one button shares an anonymised job card, with the
   answer and the proof, with deployment companies Blueprint has approved.

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
  if it fails at the optimistic end, and is otherwise unknown.
- **Verdicts**: any failed check rules a robot out, with that check as the
  reason; all passed is "fits on paper"; otherwise "may fit". When the
  Pipeline's table from the measured scene is present, its verdict replaces the
  video-tier one for that model.
- **Evidence** comes from `server/data/deploymentEvidence.v1.json`: 32 rows,
  each a verbatim quote with its URL, title and publisher, graded `production`,
  `pilot` or `offered`, at model or maker level. An independent pass re-opened
  every source on 2026-11-11.
- **Ranking** is a fixed rule with no person and no model in it: verdict, then
  evidence level for this kind of job, then a source that names the model, then
  the least machine the job needs, then margin up to a fifth of the robot's
  rating, then the smaller robot.
- **Confidence** is a word, with its reasons and what would raise it. "Good"
  needs numbers that are not estimates and documented production use.

The fit check covers jobs where one solid object is picked up and put down.
Whether the simulation can score a job never decides whether the fit check
runs.

## How the proof is made

`client/src/lib/simulationProof.ts` is a pure projection of data the job page
already loads: the evaluation summary from the job workflow, the Pipeline's
robot table and the answer's pick.

- **Policies are named in plain words** (`client/src/data/simulationPolicies.ts`):
  the policy's common name and its maker, never a checkpoint string.
- **A winner is named only when the result separates the policies.** When no
  policy completed the job, the page says the simulation could not rank them
  and shows what the scene check found. It is never called an estimate.
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
`POST /api/site-task-brief/:token/introduction-request` records the request,
turns the job card on through the existing listing function with its consent
statement, and rings the owner once. It contacts no outside company. At intake,
sharing is an unticked box.

## Emails

One new email, `answer_ready`, is sent once when the answer first settles. The
notices that belonged to robot-team-run evaluations are suppressed; Blueprint
runs evaluations itself.

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
