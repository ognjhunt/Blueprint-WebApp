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
    "How approved technology and delivery partners contribute to a site job, review evidence and agree a measured pilot.",
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
        "Blueprint runs each evaluation itself: your policy runs in a simplified simulation of the task, informed by the site's footage, against the job's pass criteria. You supply access to the policy, or the integration needed to run it.",
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
        "Passed: your system can be part of the approach Blueprint recommends for that job, together with deployment companies that support it.",
        "Not passed or inconclusive: Blueprint does not recommend your system for that job, and the result says why.",
        "Review required or blocked: a rights, privacy or compatibility issue has to be resolved before the run counts.",
        "A simulated pass is a bounded estimate, not proof of physical performance or safety.",
      ],
    },
    {
      title: "Recommended pilot",
      body:
        "Blueprint helps the site compare suitable delivery proposals with their evidence and limitations. The customer chooses a delivery partner; selection alone does not create an agreement.",
      items: [
        "Booking is free during the beta, and Blueprint takes no cut of the pilot.",
        "Before a pilot starts, the site and the delivery partner it chooses agree dates, scope, price, support and acceptance criteria directly.",
        "The delivery partner, which may be you or your integrator, installs and operates the robot; the site approves the safety plan.",
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
