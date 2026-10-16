# Recording a robot team's supply agreement

Owner: the founder, or an operator with the admin or ops role. Launch blocker:
P0-7 in the [2026-10-14 beta launch audit](../launch-readiness/2026-10-14-beta-launch-audit.md)
(link L4).

A robot team counts as supply only after it has agreed to three things:

1. **Supported interface:** it will run a policy on the interface the website
   accepts for its declared robot. Record the exact interface and, for the
   team's own robot, its embodiment declaration.
2. **Free evaluation:** it accepts a free evaluation on a real site job.
3. **Pilot if it passes:** it will take the physical pilot if that evaluation
   passes.

Until all three are on record, the team stays `prospect`, `applied` or
`self_registered`. The code enforces this:

- The registry makes a team `engaged` only when the third agreement is
  recorded (`server/utils/robotTeamSupply.ts`).
- A stored `engaged` with no agreement behind it is read back as the earlier
  status.
- The recommendation route refuses a team without an agreement, with code
  `team_supply_agreement_missing`. A passing evaluation is not enough.
- A site's workspace counts only teams that agreed (`potentialMatches`).

## What "supported" means today

Owner direction of 2026-10-15, implemented in
[PR #1049](https://github.com/ognjhunt/Blueprint-WebApp/pull/1049), permits a
team's own declared robot of any form. There are two policy interfaces:

- **Blueprint's DROID Franka:** `openpi_droid_https.v1`, the DROID
  observation/action interface for a Franka with a Robotiq 2F-85 gripper.
  Existing supply agreements recorded as
  `droid_franka_panda_robotiq_2f85_v1` remain valid for that preset.
- **The team's own robot:** `blueprint_policy_https.v1`, with a complete
  `blueprint.robot_embodiment.v1` declaration. This can describe fixed arms,
  bimanual systems, mobile manipulators, wheeled humanoids, legged humanoids,
  and other forms. The form label is not an exclusion gate.

The team serves its policy from its own HTTPS policy server. For its own robot,
it supplies the model URL and digest, base, joints, controls, cameras, and other
fields required by the declaration. The current schema is
[`client/src/types/robotEmbodiment.ts`](../../client/src/types/robotEmbodiment.ts),
and workspace robot settings collect that declaration.

A recorded agreement proves the team's willingness, not compatibility with
every job. Before execution, the Pipeline checks the exact model, interface,
scene, and task and names an incompatibility when it cannot admit the setup.
Rigid-object pick/place and articulated open/close remain the scored task
families; a broader robot form does not add a scorer for cloth folding or a
complete delivery workflow. Check the actual job's published offer and bounds.
Do not reject a team merely because its robot is mobile, wheeled, or humanoid,
and do not promise that every model or task can run.

For new agreements, record `interfaceId` explicitly. An own-robot agreement
also requires `robotEmbodiment`. If the team changes its agreed interface or
declared robot, record the corresponding new agreement with its evidence;
do not silently turn an older Franka agreement into one for another robot.

## What to tell a team

Tell them only what is true today:

- **Cost:** the beta is free for everyone. There is no fee, and nothing is
  announced for later. Blueprint takes no cut of the pilot.
- **The evaluation:** a site shows one recurring job. Invited teams evaluate it
  in a simulation built from the site's capture. Blueprint recommends one team
  whose evaluation on that job passed. The site books that pilot in one step.
- **The pilot:** the site and the team agree the physical pilot, its dates and
  its terms directly.
- **What a result means:** a simulated result is a bounded estimate for that job
  and scene. It never certifies physical performance or safety. The physical
  pilot is where performance is measured.
- **Their policy:** the team serves its policy at one HTTPS URL that accepts
  a bearer token, and keeps its weights on its own system. It registers that
  URL as a checkpoint with runtime `policy_endpoint`, then attaches the bearer
  token to the checkpoint (`POST /api/agent-team/checkpoints/<checkpointId>/credentials`;
  the token lasts 30 days and is renewed by posting it again). Private
  checkpoints are refused, and containers are never admitted for team
  evaluations; tell the team before they build anything else. Blueprint sends
  approved camera frames, robot state and the task instruction, and receives
  actions. Frames show the scene, so describe this as controlled observation
  access, not as secrecy. The full protocol is under "How Blueprint calls your
  policy" in the workspace's robot settings
  (`client/src/components/workspace/PolicyInterfaceGuide.tsx`).
- **The run:** a team evaluation is 200 hidden episodes across the job's
  variations, scored by Blueprint's simulator.
- **Dates:** do not promise a date for the first evaluation. The audit lists
  the work still open before a team's own policy can be evaluated end to end
  (P0-5, P0-6). Say evaluations start as the first teams are onboarded, and
  that you will tell them when their first job is ready.

Do not use "match" when describing the offer, and do not ask a team to compare
itself with other teams.

## What to ask for

Ask for all three agreements in writing, in the team's own words. A reply to
this is enough:

> Please confirm, by replying, that your team:
> 1. will serve its policy from its own HTTPS server accepting a bearer token,
>    using either Blueprint's DROID Franka interface or
>    `blueprint_policy_https.v1` with its own `blueprint.robot_embodiment.v1`
>    declaration (name the chosen interface and robot);
> 2. accepts a free evaluation of that policy, in simulation, on a real site's
>    job;
> 3. will take the physical pilot with that site, agreeing dates and terms
>    directly with them, if your evaluation passes the job's pass mark.

A verbal yes on a call is not evidence. Follow it with an email that asks for
the written confirmation.

## What evidence to keep

- **Keep:** the written reply, in the mailbox or note store where it arrived,
  unedited.
- **Record:** a reference to it, never its content. Use
  `gmail-thread:<thread id>` for an email thread, or
  `signed-note:<note id>` for a signed note.
- **No personal addresses:** do not use an email address as the reference
  (`mailto:` is refused).
- **One reference per agreement:** the same thread can back all three if it
  contains all three.
- **Date:** use the day the team agreed, not the day you record it.

The registry stores, for each agreement:

- the date;
- the reference;
- who recorded it, taken from your signed-in account;
- when it was recorded;
- for the interface agreement, the explicit interface ID and, for the team's
  own robot, the complete embodiment declaration.

Every recording and withdrawal is also appended to
`robotTeams/<team id>/supplyAgreementEvents`, so a corrected entry keeps its
history.

## How to record it

All routes are under `/api/admin/robot-teams` and need the admin or ops role.
From a terminal, send your Firebase ID token as `Authorization: Bearer <token>`
with the header `x-blueprint-native-client: blueprint-capture`.

1. **Find the team's registry row.**
   - Record on the row its evaluations run under: the account-bound row, which
     is usually `self_registered`. List those rows with
     `GET /?status=self_registered`.
   - Or read `teamId` from a job's evaluations
     (`GET /jobs/<job id>/evaluations`).
   - An agreement on an intake row linked to that row by pointer also counts.
   - An agreement on an unlinked prospect row does not count. Anything else
     would let a typed public form stand in for a team.
   - If the team has no row yet, invite it through the robot-team access page
     first. Its account creates the row.
2. **Record the agreements.** Send one, two or all three at once:

   ```http
   POST /api/admin/robot-teams/<team id>/supply-agreement
   Content-Type: application/json

   {
     "terms": [
       { "term": "supportedInterface", "interfaceId": "openpi_droid_https.v1", "agreedOn": "2026-10-20", "evidenceRef": "gmail-thread:<thread id>" },
       { "term": "freeEvaluation",     "agreedOn": "2026-10-20", "evidenceRef": "gmail-thread:<thread id>" },
       { "term": "pilotIfPassed",      "agreedOn": "2026-10-21", "evidenceRef": "gmail-thread:<thread id>" }
     ],
     "evidenceHeld": true
   }
   ```

   This example selects Blueprint's DROID preset. For the team's own robot,
   set that term's `interfaceId` to `blueprint_policy_https.v1` and include
   `robotEmbodiment` containing the complete validated declaration; never
   substitute a preset, a form label, or an empty object. The other two terms
   are unchanged. The GET response lists the accepted `supportedInterfaces`
   and shows which interface and robot the recorded agreement covers.

   - `evidenceHeld: true` states that you hold the referenced evidence and that
     it says exactly this.
   - If any entry is malformed, nothing is recorded, and the response lists
     what to fix.
   - The response gives `status`, `willingSupply` and `missingAgreements`.
     `engagedNow: true` means this call made the team supply.
3. **Check it:** `GET /<team id>/supply-agreement` shows each agreement, the
   recorded interface/robot, what is missing and why, and the history. Confirm
   these match the team's written reply and the robot used in the actual run.
   A supply agreement alone never proves a simulated pass or physical ability.

## When a team withdraws

```http
POST /api/admin/robot-teams/<team id>/supply-agreement/withdraw
{ "withdrawnOn": "2026-11-02", "evidenceRef": "gmail-thread:<thread id>", "evidenceHeld": true }
```

- The team stops counting as supply at once and returns to its earlier status.
- Its agreements move to history.
- To count again, it must give all three agreements again.
- A recommendation already shown to a site still names the team. Replace that
  recommendation before the site books.

## Checks

```bash
npx tsc -p tsconfig.full.json --noEmit
node node_modules/vitest/vitest.mjs run server/tests/robot-team-supply.test.ts server/tests/pilot-recommendation-route.test.ts
```
