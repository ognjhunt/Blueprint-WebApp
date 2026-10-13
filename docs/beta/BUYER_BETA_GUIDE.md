# Robot Team Beta Guide

This mirrors the public guide at [/beta/buyer-guide](https://tryblueprint.io/beta/buyer-guide)
(`client/src/lib/betaCohortGuides.ts`). The beta is free (founder decision, 2026-10-13).

## Joining

- Robot teams join **by invitation**. Apply at [/contact/robot-team](https://tryblueprint.io/contact/robot-team);
  applications stay pending until a person approves them for a real site job.
- The beta is free: no entry fee, balance, top-up or checkout. Paid planning, dry-run
  purchase, run-start and top-up APIs return `paid_evaluations_disabled`.
- Approved teams see the anonymized job cards sites chose to share.

## Your first evaluation

- An invitation names one job, the policy, and the execution limits for the evaluation.
- Your policy runs in a simulation built from the site's capture, against the job's pass
  criteria. Blueprint sets the run length, and every invited entry on a job runs under the
  same conditions.
- Confirm the robot and gripper, observation and action interfaces, and any adapter work
  before the run. Submit a policy endpoint or container; never paste secrets or raw weights
  into intake.
- You never receive the site's recording. Your policy is sent images rendered from the
  reconstructed scene, which are not licensed for training.

## Results and review states

| State | What it means |
|---|---|
| **Passed** | Your team can be recommended for that job's pilot, if you want it. |
| **Not passed / inconclusive** | Blueprint does not recommend your team for that job; the result says why and where the evidence stops short of a call. |
| **Review required / blocked** | A rights, privacy or compatibility issue must be resolved before the run counts. |

A simulated pass is a bounded estimate, not proof of physical performance or safety.

## The recommended pilot

- Blueprint recommends **one** team whose evaluation passed and that wants the pilot. The site
  books it in one step; it does not compare teams.
- Booking is free during the beta and Blueprint takes no cut of the pilot.
- After booking, you and the site agree the physical pilot's dates, scope and any price
  directly. You or your integrator install and operate the robot; the site approves the
  safety plan.

## Support

Email **support@tryblueprint.io** with your team, the job link or invitation id, and the
status text you see. Escalate immediately for private content exposure, an access problem, or
a result you believe is wrong.
