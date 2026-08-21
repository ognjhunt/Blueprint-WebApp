export const deploymentPrepSources = {
  process: {
    label: "Agility deployment process",
    href: "https://www.agilityrobotics.com/content/agilitys-humanoid-deployment-process",
  },
  timeline: {
    label: "Agility June 2026 investor presentation",
    href: "https://www.sec.gov/Archives/edgar/data/2074973/000121390026071287/ea029548401ex99-2.htm",
  },
  gxoPilot: {
    label: "GXO proof of concept",
    href: "https://investors.gxo.com/news-releases/news-release-details/gxo-conducting-industry-leading-pilot-human-centric-robot",
  },
  gxoDeployment: {
    label: "GXO commercial deployment",
    href: "https://investors.gxo.com/news-releases/news-release-details/gxo-signs-industry-first-multi-year-agreement-agility-robotics",
  },
} as const;

export const publishedOemTimeline = [
  {
    time: "Months 0–2",
    title: "Define, recreate, test",
    shortTitle: "Deployment homework",
    detail:
      "Choose the task, define the win, recreate site conditions, test robot fit, and collect first KPIs.",
    blueprint: true,
  },
  {
    time: "Months 2–3",
    title: "Integrate onsite",
    shortTitle: "Onsite POC",
    detail:
      "Bring the robot in, connect systems, map the work area, configure the workflow, and adjust to site quirks.",
    blueprint: false,
  },
  {
    time: "Months 4–6",
    title: "Prove operations",
    shortTitle: "Production pilot",
    detail:
      "Measure uptime, throughput, reliability, operational impact, and the business case on real hardware.",
    blueprint: false,
  },
  {
    time: "Month 6+",
    title: "Scale",
    shortTitle: "Commercial deployment",
    detail:
      "Expand robots, shifts, workflows, and facilities when the physical evidence supports it.",
    blueprint: false,
  },
] as const;

export const deploymentPrepSteps = [
  {
    number: "01",
    title: "Capture one workflow",
    detail:
      "The task area, objects, routes, timing, exceptions, systems, and access rules—not the whole building.",
  },
  {
    number: "02",
    title: "Build the testbed",
    detail:
      "A secure, versioned recreation of the job with the same success criteria for every robot team.",
  },
  {
    number: "03",
    title: "Test robot fit",
    detail:
      "Screen geometry and interfaces, then run controlled evaluations where the evidence supports them.",
  },
  {
    number: "04",
    title: "Hand off the homework",
    detail:
      "Give shortlisted teams the gaps, assumptions, acceptance test, and onsite checklist before hardware ships.",
  },
] as const;

export const deploymentPrepInputs = [
  "Phone video or guided scan",
  "Objects, weights, and dimensions",
  "Cycle time, shifts, and exceptions",
  "Layout, traffic, and floor conditions",
  "Systems, security, and access rules",
] as const;

export const deploymentPrepOutputs = [
  "One task definition",
  "One versioned site-task testbed",
  "Robot-fit and interface gaps",
  "Controlled evaluation results",
  "Acceptance test and onsite checklist",
] as const;

export const diyComparisonRows = [
  {
    question: "Explain the job",
    diy: "Repeat the site tour and discovery call for every robot company.",
    blueprint: "Describe the workflow once in a standard task dossier.",
  },
  {
    question: "Recreate the site",
    diy: "Each team rebuilds its own partial model with different assumptions.",
    blueprint: "Use one captured, versioned testbed as the shared reference.",
  },
  {
    question: "Test robot fit",
    diy: "Let every team choose its own test and compare incompatible answers.",
    blueprint: "Run the same acceptance criteria in a controlled environment.",
  },
  {
    question: "Go onsite",
    diy: "Discover basic mismatches after engineers and hardware arrive.",
    blueprint: "Send shortlisted teams onsite with known gaps and a test plan.",
  },
] as const;

export const deploymentPrepBoundaries = [
  {
    title: "Blueprint prepares the deployment",
    body: "We capture the task, build the testbed, screen fit, run bounded evaluations, and package the handoff.",
  },
  {
    title: "The OEM still deploys the robot",
    body: "Onsite integration, safety approval, commissioning, physical validation, service, and uptime remain with the robot provider and site.",
  },
  {
    title: "Simulation is a filter, not a guarantee",
    body: "A virtual result can narrow the trip. Real hardware is still required to settle physical performance and safety claims.",
  },
] as const;

export const deploymentEconomicsNote = {
  title: "Published anchor—not a market price",
  body: "Agility's June 2026 investor model uses an illustrative ~$15,000 one-time deployment cost and ~$25,000 deployment fee per Digit. Agility does not publish how that cost splits between months 0–2 and onsite work, and it does not disclose a typical total site contract value.",
} as const;
