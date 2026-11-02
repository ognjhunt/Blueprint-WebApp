# Robot team beta guide

This follows the public guide at
[/beta/buyer-guide](https://tryblueprint.io/beta/buyer-guide)
(`client/src/lib/betaCohortGuides.ts`). One difference is at the end. The beta
is free.

## Joining

- Robot teams apply at
  [/contact/robot-team](https://tryblueprint.io/contact/robot-team) to give
  Blueprint access to a policy or an integration. Blueprint reviews each
  application. An application stays pending until a person approves it.
- There is no entry fee, balance, top-up or checkout.
- Approved teams see anonymized job cards. A site authorizes its card when it
  starts a job, and can edit or hide the card later.

## How Blueprint runs your policy

- Blueprint runs every evaluation itself. Teams do not run their own
  evaluations of a site's job.
- Blueprint runs your policy within the scope that we agree. The scope names
  the job, the policy and the execution limits.
- Your policy runs in a simplified simulation of the task, informed by the
  site's footage, against the job's pass criteria. You supply access to the
  policy, or the integration needed to run it.
- Before the run, confirm the robot and gripper, the observation and action
  interfaces, and any adapter work.
- Use Blueprint's simulated DROID Franka (`openpi_droid_https.v1`), or declare
  your own robot with `blueprint.robot_embodiment.v1` for the
  `blueprint_policy_https.v1` interface.
- You can declare fixed arms, bimanual systems, mobile manipulators, wheeled
  humanoids and legged humanoids. Robot form alone does not decide admission.
  The Pipeline checks the model, controls, scene and task before execution. It
  reports a specific incompatibility when a setup cannot run.
- Serve your policy at one HTTPS URL that accepts a bearer token. Your weights
  stay on your system.
- Register the URL as a policy-endpoint checkpoint. Then attach the token with
  `POST /api/agent-team/checkpoints/<checkpointId>/credentials`. The token
  lasts 30 days. Post it again to renew it.
- Private checkpoints are refused. Containers are not admitted for team
  evaluations. Do not paste secrets or raw weights into intake.
- You never receive the site's recording. Your policy gets images rendered from
  the reconstructed scene.

## Results

| State | What it means |
|---|---|
| Passed | The site sees a bounded estimate that your system works on that job. |
| Not passed, or inconclusive | The result says why. |
| Review required, or blocked | A rights, privacy or compatibility issue must be resolved before the run counts. |

A simulated pass is a bounded estimate. It is not proof of physical
performance or safety.

## Physical pilot

- When an approach works in simulation, Blueprint works alongside a deployment
  company on the real site.
- Blueprint is free during the beta and takes no cut of the pilot.
- Before a pilot starts, the site and the deployment company agree dates,
  scope, price, support and acceptance criteria directly.
- The deployment company installs and operates the robot. It can be you or
  your integrator. The site approves the safety plan.

## Support

Email **support@tryblueprint.io** with your team, the job link and the status
text you see. Escalate at once for exposure of private content, an access
problem, or a result that you think is wrong.

## Difference from the public copy

The public guide and the robot-team page (`client/src/pages/Contact.tsx`) say
that each evaluation is 200 hidden episodes. The beta screening, where
Blueprint runs the candidates for a site, plans at most 10 episodes for each
candidate. It stays inside the site's $15 screening budget and a default $4
for each candidate (Pipeline `src/blueprint_pipeline/beta_policy_screening_plan.py`
and `beta_policy_screening_capabilities.py`). The 200-episode figure belongs
to the earlier evaluations that teams requested
(`client/src/components/workspace/PolicyInterfaceGuide.tsx`,
`server/utils/pilotRecommendationEvidence.ts`). The public copy still says 200.
