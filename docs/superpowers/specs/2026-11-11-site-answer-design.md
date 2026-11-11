# The site's answer: design

Owner direction, 2026-11-11. Two messages on that day set it:

1. Build the simple version: a thin layer over what exists that tells a site
   which robot most likely fits its job.
2. Simulation is core to the answer. Blueprint proves not only which robot but
   also which control policy, as well as current practice allows, and the answer
   then becomes a deployment opportunity for a deployment company. The long-term
   goal is the place where robot jobs and deployment opportunities appear.

A third message the same day corrected the premise, and the page now follows it
(round 3, below): the product evaluates AI options on the site's own job. An
option is a robot together with the camera-driven AI software that controls it
(for example π0.5 on a Franka arm). Each option gets about ten tries in a
simulation of the site, with things varied between tries, and the simulation
result decides which option did best. Scripted motion is never an option; a
scripted row only checks Blueprint's own simulation. The paper check (reach,
strength, track record) decides what is worth entering and is the fallback
when there is no test result.

This note records what was built and why. The audit that led to it is in the
Pipeline repo: `docs/audits/2026-11-11-first-principles-audit.md`.

## What a site gets

1. It sends an email and a video of one recurring job. Blueprint drafts the job
   description from the video.
2. **The paper check**, minutes after the video is read: the robot that most
   likely fits, a runner-up from another maker, what was ruled out and why, who
   already uses those robots for work like this, how sure Blueprint is, and
   what the video could not tell. Until a test result exists, this is the
   answer.
3. **The simulation test**, when it has run: AI options (robot + AI software,
   today on the Franka research arm or the Unitree G1 humanoid) each tried on
   its job in the simulation of its site, ranked, and, by the probability rule
   below, the one that did best or was ahead. This is then the answer; the
   paper check stays one tap away. A cited statement says how far such a test
   can be trusted. The simulation checks no cycle time.
4. **A deployment company**: one button shares an anonymised job card, carrying
   the same headline the site sees, with deployment companies Blueprint has
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
  sentence names where its number came from (`AnswerCheck.basis`). Each check also
  carries the figures its sentence says, as the same strings: `need` (the job's
  side, such as "about 64–93 cm", or a cycle target) and `has` (the robot's
  published reach or rated payload, or how long a cycle takes on paper). A reach
  decided in the scene has no `need`. A seeded test checks that every `need` and
  `has` appears in its sentence.
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
  (`deployment_evidence.v2`): 30 rows, each quoted word for word (any omission
  marked by "…") with its URL, title and publisher. A row applies only to the catalog models it lists
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

**The kind of job.** No word list decides anything about the job.

- The video reader, which watched the job and read the site's description,
  says its kind (`job_kind`). A carrying kind is checked and gives the job
  family. The kind of job is shown only then.
- "Other" is not checked. The reason names what the reader saw and tells the
  site what it can do: edit the job description to say what the robot should
  do. An edit of the description already causes a new reading.
- When the reader does not say, the check runs on the numbers. The first
  unknown says the kind of job could not be told and only a carry was checked,
  which keeps confidence below "good". No kind of job is shown, and the
  pick-and-place track record is used because a carry is what was checked.
- Every answer's standing note, on the page, in the email and on the job card,
  says the check covers whether a robot can pick the object up and put it down.
  The email and the job card carry the full note (`SITE_ANSWER_NOTE`). The page
  and the card's front say it in one line (`SITE_ANSWER_LIMITS`,
  `JOB_CARD_LIMITS`): "Checks picking up and putting down only. Not a test at
  your site; it does not certify performance or safety."
- When the stored coverage review says the video does not cover the scene
  (`capture_coverage.covers_scene === false`), the unknowns say "Your video does not
  show the whole work area." Only that yes or no is read; the review's own words
  about what is missing are never shown.
- What else the job involves comes only from the reader's `other_actions`, a
  closed list declared once in `server/agents/tasks/site-video-evidence.ts`
  (`OTHER_ACTIONS`).
- Whether the simulation can score a job never decides whether the fit check
  runs.

## How the page shows it

The job page is built bare bones (the rules below). Top to bottom: "Your job"
and the job sentence (grey, at most two lines; "We read your job as" when
drafted); the answer screen for its state (below); the one button, "Find a
company to set it up", with the consent line under it; "See details ›" and
"Job settings ›"; the limits line. Reading, can't match, withdrawn and
before-the-video screens are unchanged by round 3.

**The answer screen, by state** (`client/src/components/site/SiteAnswer.tsx`,
`TestHead`; the state is `testResultOf` in `client/src/lib/simulationProof.ts`):

| State | Label | Large | Under it |
|---|---|---|---|
| Winner | "DID BEST ON YOUR JOB" or "WAS AHEAD ON YOUR JOB" | the option, "Franka arm + π0.5" | "AI software by {maker}"; ticks "Did your job in N of M tries", "Ahead of the K other AI robots we tested"; sureness |
| One option, which did the job | "TESTED ON YOUR JOB" | the option | ticks "Did your job in N of M tries", "The only AI robot we could test on your job"; one dot |
| Some finished, no winner | "TESTED ON YOUR JOB" | "No clear winner yet" | "Top: {option}, did your job in N of M tries." |
| None finished | "TESTED ON YOUR JOB" | "None finished yet" | "Closest: {option} {furthest phrase}." (or "N AI robots tried; none finished your job."); the set-up notice when flagged |
| Preparing or running | "TESTING NOW" | "{N} AI robots" | "on your job, in a simulation of your site. We'll email you." |
| No test (held, closed, could not run, not started) | "ON PAPER, THE ROBOT MOST LIKELY TO FIT" ("ON PAPER, THE CLOSEST ROBOT") | the model | "by {maker}"; when known, "The simulation test did not run. {why}" ("did not finish" when stopped part way); the paper ticks and sureness |

- In every test state the paper result is one tap away, a quiet line: "On
  paper, most likely to fit: {maker} {model} ›" (or "On paper, the closest
  robot: …"), opening `#details/why`.
- **Test sureness** comes from the same rule as the label: did best is "Sure"
  (three dots), was ahead "Fairly sure" (two), one option "Not sure yet" (one).
  A set-up flag lowers it one step, with "Our simulation set-up may have
  affected this result." as the reason.
- **Paper ticks** by data: reach (`measure: "distance"`) says "Reaches far
  enough"; reach by working height (`measure: "height"`, a robot that moves)
  says "Reaches high and low enough"; payload "Strong enough"; cycle time "Fast
  enough"; `unknown` says "Can't tell yet if …" with a "?" and never a tick.
  The track record says "Already used for jobs like this" (production), "Tried
  at a customer for jobs like this" (pilot) or "Sold for jobs like this"
  (offered), each "Robots like this …" when the source names only the family.
  Paper sureness: "Not sure yet", "Fairly sure", "Sure", with one plain reason
  naming what the estimated checks rest on (sizes, heights or weight).
- **Body type**: `mobile_manipulator` reads "Arm on a base that moves", true
  for wheeled and legged bases alike (`client/src/data/robotFit.ts`).
- **Consent**: statement `public-task-card-with-answer-v2`, "Shares a summary of
  your job and this answer, without saying who you are, with companies we've
  approved. Your video, address and contacts stay private." "This answer" is
  the screen's answer, which the card carries (below). The route records only
  v2; a choice recorded under v1 still carries the answer on the card.
- **Limits line**, by what the headline is (`client/src/lib/siteAnswer.ts`): a
  test result, "Tested in a simulation, not at your site. Pick-up-and-put-down
  jobs only. It does not certify performance or safety."; while testing, "Being
  tested in a simulation, …"; the paper check, "A paper check, not a test at
  your site. …". The job card says "the site"; the emails use the same lines.
- **Sureness words** come from one map, `SURENESS_WORDS`, read by the page, the
  card and the emails.
- **On-paper line**: "On paper: {model} ›" ("On paper, closest: {model} ›" when
  it only may fit), its own group, left-aligned.
- **Spacing**: one rhythm, written at the top of `bare.css` and checked on a
  phone for every answer state by `e2e/site-answer.spec.ts` ("keeps the
  bare-bones rhythm"). An option's name breaks on purpose: the robot, then "+ its
  AI software", each on its own line.
- **Details** (`#details`, a menu; each item its own screen with "‹ Back"; the
  browser's back button returns to the screen it came from), in this order:
  1. **The simulation test** (`#details/test`), a ranked list: "We ran N AI
     robots on your job, about M tries each, in a simulation of your site.",
     then one row per option in the display order, "{i}. {option} · {maker}"
     with "Finished N of M tries", the likely range beside a row with a
     success, "· Did best" or "· Ahead" on row 1 only for a winner, and, for a
     row that finished none, how far it got; the gap sentence; rows whose
     robot is not confirmed ("on a robot we could not confirm, not
     compared"); "N more AI robots were planned but did not run. Job settings
     › Simulation details says why."; set-up notes as notice lines.
  2. **How far to trust it** (`#details/trust`): short rows with every source
     (`SIMULATION_ACCURACY_ROWS`), and what holds for this job.
  3. **On paper: why this robot** (`#details/why`): each check's `need` and
     `has` (height rows read "needs N · working height H" and link the
     "Working height" spec), the sources, the track record, the scene check,
     and "This is the paper check: it looks at the robot's reach, strength and
     track record, not its AI software."
  4. Other robots; robots that don't fit; what we estimated; what we couldn't
     see.
- **Job settings** (`#settings`): "Send a new video", "Change my job
  description", "Share settings", "Save to my account", "Planning details",
  "Contact Blueprint about this job", "Stop using my video", and the folded
  "Simulation details".
- An older job with a test and no answer shows "Tested in simulation": one line
  (`computerTestLine`), then the ranked list and the trust rows.

## Bare bones

Owner direction, 2026-11-11: "a 10 year old should be able to understand what
everything is / how it works … bare bones", and "this is the type of ui/ux we
should have throughout our whole user flow". Every screen follows these rules.
The shared parts are `client/src/components/bare/Bare.tsx` and `bare.css`.

1. One idea per screen. A screen that answers two questions is two screens.
2. One filled button, the next step. Anything else is a quiet text link, at most
   two.
3. About 70 words or fewer visible on a screen, everything counted.
4. A small label, then the thing in large type.
5. Short lines a child can read aloud and explain. No jargon; ticks and plain
   words instead of sentences.
6. Details live one tap away, on their own screen with "‹ Back", in short
   labelled rows. Nothing true and sourced is deleted; it moves there.
7. Nothing is shown until there is something to say: no empty or "not started"
   blocks.
8. Space: 4 / 8 / 16 / 32 / 48 px; 8 within a group, 32 between groups, 48
   before fine print. Body 17–18 px, the answer 40 px or more, fine print 14 px.
   A centred column at most 560 px wide. Tap targets at least 44 px tall.
9. Every word is true for every input that produces it. A short line false for
   some case gets a second wording for that case. Text comes from constants in
   the repository, never from stored or model-supplied text.
10. Never dropped: a warning that changes the meaning or a step the person must
    take; the consent under its button, in one plain line with the recorded
    statement's meaning (a reworded line is a new statement version); the limits
    in one line; the way to stop. Statements agreed at intake keep their exact
    recorded words.
11. Same parts everywhere: a new screen is assembled from the shared parts, not
    styled from scratch.
12. One `h1` per screen, ordered headings, keyboard reachable, visible focus,
    nothing by colour alone, contrast kept.

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
- **Policies are named in plain words, through a closed list**
  (`client/src/data/simulationPolicies.ts`): the policy's common name and its
  maker, never a checkpoint string, code or markup. A policy not in that list
  is never shown by a name stored with the evaluation; it reads "an unnamed AI
  control policy", with a letter ("(A)", "(B)") in a fixed order
  when there are several. Scripted rows and rows the selection marks as
  references are never ranked.
- **Options, compared across robots** (`optionsOf` in `simulationProof.ts`;
  the owner's 2026-11-11 premise withdrew the earlier same-robot rule). An
  option is a scored learned-policy row whose policy the closed map names, so
  its robot is confirmed: "{robot short name} + {policy}" ("Franka arm +
  π0.5"), with the software's maker. Scripted rows, rows the selection marks
  as references and rows whose robot is not confirmed are never options; the
  last are listed, lettered, as not compared.
- **One display order for every screen**: options that completed the job
  first, by posterior mean success rate (s + 1)/(n + 2); then options that
  finished nothing, by the deepest progress stage reached, then how many tries
  reached it, then the closer median approach; then more scored tries; then id.
  It is an order for display only.
- **"Did best" and "was ahead" come only from the probability rule.** Each
  option's success rate, from s successes in n scored tries, is
  Beta(s + 1, n − s + 1). Row 1 is weighed against every other scored option
  by the chance its true rate is higher (`probabilityAhead`); the smallest of
  those chances decides. At 97.5% or more (`CLEAR`), with at least one success
  and at least two options, it "did best"; from 85% (`AHEAD`) it "was ahead";
  otherwise there is no winner. 7 of 10 against 3 of 10 is about 0.96: ahead;
  9 of 10 against 3 of 10 is above 0.99: did best. An option that never
  completed the job is never ahead. A seeded generated-input test
  (`client/tests/components/simulationOptions.test.tsx`) checks who is an
  option, the order, the winner rule and that the screen and the ranked list
  say the same counts, over 400 random runs.
- The earlier same-robot comparison sentence (`policyComparison`) still
  exists for the simulation email, which has not moved to the options yet.
- **Every sentence has a precondition in the data.** Nothing says a policy ran,
  was tried or completed the job unless tries were scored; a likely range
  appears only beside a row with a success. When no policy completed the job,
  the page says the simulation could not rank them and shows what the scene
  check found; it is never called an estimate. When no policy was scored, or
  the simulation was held (for budget, the scene check or a set-up problem), it
  says what happened to the simulation and never that policies ran. A seeded
  generated-input test checks these rules over thousands of random results.
- **How far each policy got is said as a fact, never as a ranking.**
  Publication `beta_policy_screening_publication.v4` may carry, on a
  learned-policy row, the Pipeline grader's `progress`
  (`policy_episode_progress.v1`): how many graded tries reached each stage of
  a closed, ordered ladder (got its gripper within 2 cm, touched, moved,
  lifted, lifted and carried, put in place, put in place and let go). The
  first stage is there only when every try measured it, and then with the
  median and minimum closest approach of the grasp point to the object,
  `closest_approach_m`. The 2 cm is the grader version's own threshold, kept
  beside that version in `client/src/data/screeningProgressGrader.ts`; "carried"
  names no direction, because the grader checks only the distance moved. A
  row that reached no stage and has that distance says it "did not get its
  gripper within 2 cm of the object; it typically came within about {N} cm of
  it" (the median, whole centimetres, at least 1; metres with one decimal from
  100 cm). In the list below, and on its row, the same reads "{policy} did not
  get its gripper within 2 cm of the object in any of its {g} tries, typically
  coming within about {N} cm of it", or without the distance "did not touch
  the object in any of its {g} tries" ("in its one try" for one); a row that
  reached a stage gives its count, "moved the object in 4 of 10 tries". When
  fewer tries were graded than scored, the figure is never worded as the
  policy's total: "in 4 of the 9 tries we could grade", "in any of the 9 tries
  we could grade", "in the one try we could grade". The WebApp refuses it on v1 to v3 and
  refuses a v4 whose `progress` breaks the ladder or its counts, so the
  Pipeline sends v3 instead; it is never dropped quietly. Each row takes its
  furthest stage, said only in the closed phrases of `simulationProof.ts`.
  When no compared policy completed the job, the could-not-rank sentence gains
  "How far each got: …" with each compared row's count, and the email repeats
  it; when one did, the line is unchanged and only rows that completed nothing
  say how far they got. The order, the winner, "did best" and "ahead" rest on
  completed tries alone, and the job card's one line stays the first sentence.
- **Accuracy is stated with its sources and conditions**
  (`client/src/data/simulationAccuracy.ts`): in one direct published test the
  simulated ranking matched the real one in 8 of 9 comparisons, and simulated
  scores correlate with real ones at about 0.9. Those results needed a clean
  scan with true scale, a calibrated controller and research policies. The page
  says which of those hold for the job in front of the reader.
- **Public policies exist for two research robots today**: the Franka research
  arm and the Unitree G1 humanoid, whose rows the Pipeline marks as development
  references that are shown and never ranked. For any other robot the page
  says Blueprint has no public policy to run on it, and the simulation checks
  its reach and arm path.

The Pipeline plan for making this test fast and validated is
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
content; see below), and rings Blueprint's owner once with the job family, the
pick and the runner-up. It contacts no outside company and queues no alert email to them;
approved companies see the card when they browse the job library, and whom to
introduce is the owner's decision.

What the card carries is the screen's answer
(`server/utils/jobCardAnswer.ts`): when the simulation test has a result or
is running, its headline is the test's ("Did best on the job: Franka arm +
π0.5, doing the job in 10 of 10 tries.", "Tested on the job: none finished
yet.", "Testing now: N AI robots on the job.") and it carries the ranked
options as closed-map names and counts only (`test`), with the paper pick
below; otherwise the paper headline and details as before. No consent
statement changed: the existing statements share "this answer", and this is
the answer the site's screen shows.

A card carries the answer (and the library shows its headline) only while the
site's request was recorded under the statement that names the answer AND the
card's current listing consent is that same statement. A card listed, or later
re-saved, under the older card box carries no answer, and no answer is composed
for it. The latest consent the site gave governs: when the card is already on
under the older box and the site presses the button, only the listing's consent
version moves to the with-answer statement (the owner's reviewed card, its
published date, revision, thumbnail and go-live time are untouched, the
choice's time is the request's own, and no company is alerted), so the card
then carries the answer until the site re-saves it under the older box. At intake, sharing is an unticked box.

## Emails

`answer_ready` is sent once when the answer first settles. Subject "Your job's
paper check is ready"; it opens "We've checked your job on paper. {headline}",
says how sure on paper, then what happens next, in one line true for the job's
simulation test as the page reads it: "Next, we're testing N AI robots on your
job, in a simulation of your site. We'll email you the result.", the page's own
line for why no test runs (then "So this paper check is your answer for now."),
or, with nothing known yet, "If we test AI robots on your job in a simulation of
your site, we'll email you the result." One button, the paper limits line as
fine print.

When the simulation finishes with a result, its email
(`server/utils/taskLifecycleNotifications.ts`) says the headline the page leads
with (`testHeadline`), the line under it (`testSubLine`) and the set-up notice
when flagged. Subject "Your simulation test has a result" when an AI robot
finished the job, otherwise "The simulation test of your job has finished". One
button, the tested limits line as fine print.

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
