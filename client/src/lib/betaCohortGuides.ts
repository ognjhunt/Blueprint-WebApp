export type BetaCohortGuideSection = {
  title: string;
  body: string;
  items: string[];
};

export type BetaCohortGuide = {
  persona: "robot-team";
  title: string;
  path: string;
  eyebrow: string;
  summary: string;
  heroImage: string;
  heroAlt: string;
  primaryAction: {
    label: string;
    href: string;
  };
  sections: BetaCohortGuideSection[];
  escalation: string[];
};

export const betaSupportEmail = "support@tryblueprint.io";

/**
 * The one beta guide. The capturer guide was retired with the capturer
 * network (sites film their own job, or Blueprint staff film it); its URL
 * redirects to the site start page.
 */
export const buyerBetaGuide: BetaCohortGuide = {
  persona: "robot-team",
  title: "Robot team beta guide",
  path: "/beta/buyer-guide",
  eyebrow: "Robot team beta",
  summary:
    "How invited robot teams evaluate a site's job in simulation for free, what the result means, and how a passed evaluation becomes a recommended pilot.",
  heroImage: "/redesign/pov/machine-tending.jpg",
  heroAlt: "Industrial machine-tending job area",
  primaryAction: {
    label: "Apply for an invitation",
    href: "/contact/robot-team",
  },
  sections: [
    {
      title: "Cohort scope",
      body:
        "Robot teams join by invitation after we review their application. The beta is free: there is no entry fee, balance, top-up or checkout.",
      items: [
        "Approved teams see the anonymized job cards sites chose to share.",
        "An invitation names one job, the policy, and the execution limits for the evaluation.",
        "You never receive the site's recording; your policy is sent images rendered from the reconstructed scene.",
      ],
    },
    {
      title: "First evaluation",
      body:
        "Each evaluation runs your policy in a simplified simulation of the task, informed by the site's footage, against the job's pass criteria.",
      items: [
        "Confirm the robot and gripper, observation and action interfaces, and any adapter work before the run.",
        "Use Blueprint's simulated DROID Franka (openpi_droid_https.v1), or declare your own robot with blueprint.robot_embodiment.v1 for the blueprint_policy_https.v1 interface.",
        "Fixed arms, bimanual systems, mobile manipulators, wheeled humanoids and legged humanoids can be declared. Robot form alone does not decide admission; the Pipeline checks the model, controls, scene and task before execution and reports a specific incompatibility when a setup cannot run.",
        "Serve your policy at one HTTPS URL that accepts a bearer token. Register it as a policy endpoint checkpoint and attach that token; your weights stay on your system.",
        "Private checkpoints are refused, and containers are not admitted for team evaluations.",
        "Each evaluation is 200 hidden episodes across the job's variations, the same for every invited team on the job.",
      ],
    },
    {
      title: "Results and review states",
      body:
        "A result says whether the evaluation passed the job's criteria, where it failed, and where the evidence stops short of a call.",
      items: [
        "Passed: your team can be recommended for that job's pilot, if you want it.",
        "Not passed or inconclusive: Blueprint does not recommend your team for that job, and the result says why.",
        "Review required or blocked: a rights, privacy or compatibility issue has to be resolved before the run counts.",
        "A simulated pass is a bounded estimate, not proof of physical performance or safety.",
      ],
    },
    {
      title: "Recommended pilot",
      body:
        "Blueprint recommends one team whose evaluation passed and that wants the pilot. The site books it in one step.",
      items: [
        "Booking is free during the beta, and Blueprint takes no cut of the pilot.",
        "After booking, you and the site agree the physical pilot's dates, scope and any price directly.",
        "You or your integrator install and operate the robot; the site approves the safety plan.",
      ],
    },
    {
      title: "Support escalation",
      body:
        "Use one support path so the job, the invitation and the result stay tied together.",
      items: [
        `Email ${betaSupportEmail} with your team, the job link or invitation id, and the status text you see.`,
        "Escalate immediately for private content exposure, an access problem, or a result you believe is wrong.",
      ],
    },
  ],
  escalation: [
    "Evaluation blocked: include the invitation id and the exact error state.",
    "Rights or privacy concern: stop using the material and contact support immediately.",
    "Result question: include the job link and the result you are asking about.",
  ],
};

export const betaCohortGuides = [buyerBetaGuide] as const;
