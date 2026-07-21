export type BetaCohortGuideSection = {
  title: string;
  body: string;
  items: string[];
};

export type BetaCohortGuide = {
  persona: "capturer" | "buyer";
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

export const capturerBetaGuide: BetaCohortGuide = {
  persona: "capturer",
  title: "Capturer Beta Guide",
  path: "/beta/capturer-guide",
  eyebrow: "External Beta Cohort",
  summary:
    "What capturers should expect before the first walkthrough, during capture, after upload, and when a submission is blocked or needs support.",
  heroImage: "/redesign/pov/route-scan.jpg",
  heroAlt: "Capturer walking an indoor facility route",
  primaryAction: {
    label: "Apply for capturer access",
    href: "/signup/capturer",
  },
  sections: [
    {
      title: "Cohort scope",
      body:
        "The beta is a bounded cohort, not an open gig marketplace. Capture work stays limited by launch scope, device readiness, site permission, privacy posture, and cohort capacity.",
      items: [
        "Best-fit sites are industrial, logistics, warehouse, retail backroom, lab, and facility-task spaces where lawful access is clear.",
        "Open capture can be submitted for review, but operator-approved or assigned capture has stronger downstream value.",
        "Do not record private homes, employee-only areas, payment terminals, restricted rooms, private records, or people whenever avoidable.",
      ],
    },
    {
      title: "First-run walkthrough",
      body:
        "The first capture should prove that the route, device, permissions, and upload path work before anyone treats the account as ready for higher-value assignments.",
      items: [
        "Confirm site permission and restricted zones before pressing record.",
        "Walk slowly, pause at transitions, keep the route stable, and capture floor/task context instead of cinematic footage.",
        "Upload from a strong network and keep the app open until the bundle shows upload progress or background handoff.",
      ],
    },
    {
      title: "Review states",
      body:
        "Every upload is reviewed before it can support buyer access, payout eligibility, package delivery, or downstream policy evaluation.",
      items: [
        "Review required means Blueprint has the bundle but has not accepted its rights, privacy, quality, or package fit.",
        "Blocked means something must be fixed before downstream use, such as unclear permission, private content, missing route context, or upload failure.",
        "Degraded means the bundle may still be useful, but a missing signal, weak media, or review limitation will be visible to buyers.",
      ],
    },
    {
      title: "Payout expectations",
      body:
        "Payouts are not automatic in the beta. Eligibility depends on assignment terms, accepted capture evidence, provider readiness, and any required identity or tax review.",
      items: [
        "Do not assume open capture creates a paid assignment.",
        "Quoted or approved payout status must be visible in the assignment or account state before you rely on it.",
        "If payout setup is unavailable for your cohort, the app should treat wallet/payout status as review-only.",
      ],
    },
    {
      title: "Support escalation",
      body:
        "Use one support path so upload, access, privacy, and payout issues stay attached to the same account and capture record.",
      items: [
        `Email ${betaSupportEmail} with your account email, capture id or assignment id, site city, and a short description.`,
        "Escalate immediately for privacy exposure, restricted-area capture, injury/safety issues, payment confusion, or a stalled upload over 24 hours.",
        "Do not retry a sensitive or restricted capture until support confirms the safe next step.",
      ],
    },
  ],
  escalation: [
    "Privacy or restricted-area issue: stop sharing the media and contact support immediately.",
    "Upload blocked more than 24 hours: send the capture id, device model, app version, and network context.",
    "Payout or account issue: include the assignment id and the exact status shown in the app.",
  ],
};

export const buyerBetaGuide: BetaCohortGuide = {
  persona: "buyer",
  title: "Buyer Beta Guide",
  path: "/beta/buyer-guide",
  eyebrow: "Robot Team Beta Cohort",
  summary:
    "What robot teams should expect when requesting a Task Evaluation Run, receiving a package, reading degraded states, or escalating support.",
  heroImage: "/redesign/pov/machine-tending.jpg",
  heroAlt: "Industrial machine-tending task area",
  primaryAction: {
    label: "Request robot-team access",
    href: "/contact/robot-team",
  },
  sections: [
    {
      title: "Cohort scope",
      body:
        "The buyer beta is for request-scoped Task Evaluation Runs, Post-Training Data Package review, and hosted access around captured real-site evidence.",
      items: [
        "Best-fit requests name the robot family, target site type, task, policy/checkpoint family, success criteria, and review timeline.",
        "Blueprint may use captured real sites, generated support assets, and sim-backed comparison artifacts, but proof boundaries stay attached.",
        "A beta request is not a deployment approval, safety certification, or promise that a policy will work on physical hardware.",
      ],
    },
    {
      title: "First request path",
      body:
        "A request starts with scope review before package delivery or hosted-session access. Missing rights, site context, or policy details can pause the run.",
      items: [
        "Submit the site/task/policy context and any confidentiality or export limits up front.",
        "Blueprint confirms available capture/package evidence before promising a delivery path.",
        "If the request needs new capture, the capturer and site-operator path may add review time.",
      ],
    },
    {
      title: "Timelines",
      body:
        "The beta should use clear status semantics instead of treating every delay as silence.",
      items: [
        "Scoping review targets one business day when the request is complete.",
        "Package or hosted-review preparation targets two to three business days after required evidence is accepted.",
        "Recapture, privacy review, provider/runtime issues, or missing buyer context can move the request into blocked or review-required state.",
      ],
    },
    {
      title: "Degraded and blocked states",
      body:
        "Buyer-facing status is part of the product. If an artifact is not ready, the response should say which layer is missing.",
      items: [
        "Blocked means Blueprint cannot deliver or expose the requested artifact until a specific issue is resolved.",
        "Review required means human verification is still needed for rights, privacy, capture quality, export scope, or buyer fit.",
        "Degraded means an artifact can be reviewed with limitations, such as missing calibration, partial media, or advisory-only simulation support.",
      ],
    },
    {
      title: "Support escalation",
      body:
        "Use one support path for delivery, entitlement, privacy, and runtime questions so the request id and artifact state remain tied together.",
      items: [
        `Email ${betaSupportEmail} with the request id, company, target task, expected delivery, and the status text you see.`,
        "Escalate immediately for access revocation, private content exposure, missing paid deliverables, or an incorrect entitlement.",
        "Do not rely on downloaded artifacts beyond the stated rights sheet, order form, or hosted-session scope.",
      ],
    },
  ],
  escalation: [
    "Delivery blocker: include request id, package id, and the missing artifact.",
    "Rights/privacy concern: stop sharing the artifact and contact support immediately.",
    "Runtime/session issue: include browser, timestamp, session id, and the exact error state.",
  ],
};

export const betaCohortGuides = [capturerBetaGuide, buyerBetaGuide] as const;
