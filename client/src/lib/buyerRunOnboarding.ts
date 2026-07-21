export type BuyerRunOnboardingStep = {
  phase: string;
  title: string;
  target: string;
  owner: string;
  body: string;
  href?: string;
};

export type BuyerRunReceiveLink = {
  label: string;
  href: string;
  body: string;
};

export const buyerRunOnboardingTimeline: BuyerRunOnboardingStep[] = [
  {
    phase: "1",
    title: "Request",
    target: "Submit site, task, policy, and confidentiality context",
    owner: "Robot team",
    body:
      "Start with the target site or package, robot family, policies/checkpoints, success criteria, and any privacy, export, or IP limits.",
    href: "/contact/robot-team",
  },
  {
    phase: "2",
    title: "Scope",
    target: "One business day when the request is complete",
    owner: "Blueprint",
    body:
      "Blueprint confirms rights, package availability, entitlement path, requested outputs, and whether the run is a quick-look, subscription, or site-ops comparison.",
    href: "/beta/buyer-guide",
  },
  {
    phase: "3",
    title: "Run",
    target: "Two to three business days after required evidence is accepted",
    owner: "Blueprint + owning systems",
    body:
      "The run is queued only after the required capture/package evidence and policy access path are accepted. Blocked and degraded states stay visible instead of being treated as silence.",
    href: "/app/runs",
  },
  {
    phase: "4",
    title: "Receive",
    target: "Provisioned buyer app or private request-room link",
    owner: "Robot team",
    body:
      "Receive the run record, scorecard or advisory package, hosted-session link when available, and proof-boundary notes that separate local support evidence from owner-system proof.",
    href: "/app/runs",
  },
];
export const buyerRunReceiveLinks: BuyerRunReceiveLink[] = [
  {
    label: "Runs dashboard",
    href: "/app/runs",
    body:
      "Authenticated buyer app route for owned evaluation-run records after Blueprint provisions access.",
  },
  {
    label: "Private request room",
    href: "/requests/:requestId",
    body:
      "Request-scoped review link for evidence, qualification, preview, and status when Blueprint issues a specific request id.",
  },
  {
    label: "Buyer beta guide",
    href: "/beta/buyer-guide",
    body:
      "Tester-facing scope, timeline, degraded-state, blocked-state, and support escalation expectations.",
  },
];
