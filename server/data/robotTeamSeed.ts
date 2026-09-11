/**
 * Researched robot platforms, as registry prospects.
 *
 * ## What this is, and what it is emphatically not
 *
 * These are real companies that have not agreed to anything. Every record here
 * is `status: "prospect"`, and `CLAUDE.md` is explicit that a third party cited
 * as evidence is never implied to be a Blueprint customer or Blueprint-prepared
 * work. Nothing in this file may be presented to anyone as a relationship.
 *
 * ## Every figure carries its source and its own words
 *
 * Each entry quotes the line it came from and names the page it is on, so a
 * reviewer can check any number in about ten seconds. A figure nobody could
 * source is absent rather than estimated — that is why most fields on most of
 * these teams are missing, and the gaps are the honest part.
 *
 * ## The quotes are what a reviewer checks
 *
 * Each figure was read from the page named in `sourceUrl`. That page is the
 * authority, not this file: a reviewer opening the URL and finding the line is
 * the step that makes a figure usable, and `published` here means only "a named
 * page states this", which is a weaker and more honest claim than "this is
 * true". Anything that needed interpretation to reach a band is graded
 * `inferred`, and inferred figures are stripped before matching.
 *
 * ## Two traps this discipline caught
 *
 * Web-search summaries confidently attributed a 25 kg figure to Agility's Digit.
 * It is not a Digit spec: it is a generic "minimum requirements for light
 * industrial work" list in an Agility blog post about humanoids in general. The
 * same summaries surfaced a 2019 "40 lb (18 kg)" number for a Digit that was
 * "still in testing" and has since been superseded by 35 lb.
 *
 * Both would have entered the registry as plausible, unremarkable, wrong
 * figures, and both were caught only by fetching the page and reading the
 * sentences around the number. That is the entire argument for quoting the
 * line rather than recording the value.
 *
 * ## Research alone cannot produce a confirmed match
 *
 * Read the `deploymentGeography` field on every record: it is not here. No
 * public page says these companies deploy in a given metro on our terms, so we
 * do not know, and `matchRobotTeam` therefore returns `provisional` for all of
 * them — never `matched`, and never a number in an email.
 *
 * That is the design working, not a gap in it. A confirmed match needs a team
 * to tell us (self_reported, through the intake) or Blueprint to measure it
 * (measured, through an evaluation). Reading a spec page is worth a great deal
 * for deciding who to talk to, and it is not worth a claim to a site operator.
 */
import type { CapabilityGrade, RobotCapabilityField } from "../types/robot-team-registry";

export interface SeededFigure {
  field: RobotCapabilityField;
  /** A band value, or a raw figure that `deriveBand` converts. */
  value: string | number;
  /** Set when `value` is a raw figure needing conversion (kg, seconds, percent). */
  unit?: "kg" | "lb" | "seconds" | "percent" | "cycles" | "metres";
  grade: CapabilityGrade;
  sourceUrl: string;
  /** Verbatim, from the page. If it cannot be quoted, it does not belong here. */
  quote: string;
}

export interface SeededRobotTeam {
  id: string;
  name: string;
  product: string;
  website: string;
  figures: SeededFigure[];
}

/**
 * The seed set.
 *
 * Chosen to span embodiments — stationary arm, mobile manipulator, autonomous
 * mobile robot, humanoid — so a match run exercises more than one shape of
 * candidate rather than four variations of the same arm.
 */
export const robotTeamSeed: readonly SeededRobotTeam[] = [
  /* ------------------------------------------------------ stationary arms */
  {
    id: "team-universal-robots-ur5e",
    name: "Universal Robots",
    product: "UR5e",
    website: "https://www.universal-robots.com/",
    figures: [
      {
        field: "embodiment",
        value: "stationary_arm",
        grade: "published",
        sourceUrl:
          "https://www.universal-robots.com/manuals/EN/HTML/SW5_21/Content/prod-usr-man/complianceUR5e/H_g5_sections/appendix_g5/tech_spec_sheet.htm",
        quote: "Degrees of freedom 6 rotating joints",
      },
      {
        field: "payloadCapacity",
        value: 5,
        unit: "kg",
        grade: "published",
        sourceUrl:
          "https://www.universal-robots.com/manuals/EN/HTML/SW5_21/Content/prod-usr-man/complianceUR5e/H_g5_sections/appendix_g5/tech_spec_sheet.htm",
        quote: "Maximum payload 5 kg / 11 lb",
      },
      {
        field: "reachM",
        value: 0.85,
        unit: "metres",
        grade: "published",
        sourceUrl:
          "https://www.universal-robots.com/manuals/EN/HTML/SW5_21/Content/prod-usr-man/complianceUR5e/H_g5_sections/appendix_g5/tech_spec_sheet.htm",
        quote: "Reach 850 mm / 33.5 in",
      },
      {
        // The strongest proximity statement UR make, and it is conditional on a
        // site risk assessment rather than a blanket rating. Inferred, so it is
        // stripped before any match a site operator reads.
        field: "humanProximity",
        value: "shared",
        grade: "inferred",
        sourceUrl:
          "https://www.universal-robots.com/manuals/EN/HTML/SW5_21/Content/prod-usr-man/complianceUR5e/H_g5_sections/safety_g5/intended_use.htm",
        quote:
          "All UR robots are equipped with safety functions, which are purposely designed to enable collaborative applications, where the robot application operates together with a human. The safety function settings must be set to the appropriate values as determined by the robot application risk assessment.",
      },
      // taskFamily is absent. UR retired the per-model UR5e marketing page, and
      // the only live task statement is generic to every UR robot. Importing
      // UR20's application list would be filling a gap the record is silent on.
    ],
  },
  {
    id: "team-universal-robots-ur20",
    name: "Universal Robots",
    product: "UR20",
    website: "https://www.universal-robots.com/products/ur20-robot/",
    figures: [
      {
        field: "embodiment",
        value: "stationary_arm",
        grade: "published",
        sourceUrl: "https://www.universal-robots.com/products/ur20-robot/",
        quote: "UR20 Collaborative Robot Arm | Universal Robots",
      },
      {
        // 20 kg is the rated figure. The 25 kg "extended payload" is worded
        // differently on the product page and in the manual ("with boundary
        // conditions"), so the unambiguous number is the one recorded.
        field: "payloadCapacity",
        value: 20,
        unit: "kg",
        grade: "published",
        sourceUrl: "https://www.universal-robots.com/products/ur20-robot/",
        quote: "Payload 20 kg (44.1 lbs) Extended payload 25 kg (55.1 lbs)",
      },
      {
        field: "reachM",
        value: 1.75,
        unit: "metres",
        grade: "published",
        sourceUrl: "https://www.universal-robots.com/products/ur20-robot/",
        quote: "Reach 1750 mm (68.9 in)",
      },
      {
        field: "taskFamily",
        value: "machine_tending",
        grade: "published",
        sourceUrl: "https://www.universal-robots.com/products/ur20-robot/",
        quote: "UR20 applications Welding Machine tending Material handling Palletizing",
      },
      {
        field: "humanProximity",
        value: "shared",
        grade: "inferred",
        sourceUrl:
          "https://www.universal-robots.com/manuals/EN/HTML/SW5_19/Content/prod-usr-man/complianceUR20/H_g5_sections/safety_g5/intended_use.htm",
        quote:
          "All UR robots are equipped with safety functions, which are purposely designed to enable collaborative applications, where the robot application operates together with a human. The safety function settings must be set to the appropriate values as determined by the robot application risk assessment.",
      },
    ],
  },
  {
    id: "team-franka-robotics",
    name: "Franka Robotics",
    product: "Franka Research 3",
    website: "https://franka.de/franka-research-3",
    figures: [
      {
        field: "embodiment",
        value: "stationary_arm",
        grade: "published",
        sourceUrl: "https://franka.de/franka-research-3",
        quote:
          "The 7 degrees of freedom Arm of Franka Research 3 offers human-like dexterity, enabling motions in tight spaces and around obstacles.",
      },
      {
        field: "payloadCapacity",
        value: 3,
        unit: "kg",
        grade: "published",
        sourceUrl: "https://franka.de/franka-research-3",
        quote: "Payload 3 kg Reach 855 mm",
      },
      {
        field: "reachM",
        value: 0.855,
        unit: "metres",
        grade: "published",
        sourceUrl: "https://franka.de/franka-research-3",
        quote: "Payload 3 kg Reach 855 mm",
      },
      // No humanProximity. The word "collaborative" appears on Franka's page
      // only in "Open and Collaborative Platform", which is about their research
      // community, not about working near people.
      // No taskFamily. It is marketed as a research platform, not for a task.
    ],
  },

  /* ----------------------------------------------------------- humanoids */
  {
    id: "team-agility-robotics",
    name: "Agility Robotics",
    product: "Digit",
    website: "https://www.agilityrobotics.com/solutions",
    figures: [
      {
        field: "embodiment",
        value: "humanoid",
        grade: "published",
        sourceUrl: "https://www.agilityrobotics.com/solutions/digit/spec-sheet",
        quote:
          "technical specifications for Digit, Agility's bipedal robot: dimensions, payload, battery life, sensing capabilities, and more.",
      },
      {
        field: "payloadCapacity",
        value: 35,
        unit: "lb",
        grade: "published",
        sourceUrl: "https://www.agilityrobotics.com/solutions",
        quote:
          "Digit has a 35 pound carrying capacity, 4 hour battery life, and the capability to work continuous shifts.",
      },
      {
        field: "taskFamily",
        value: "palletizing",
        grade: "published",
        sourceUrl:
          "https://www.agilityrobotics.com/content/agility-robotics-announces-new-innovations-for-market-leading-humanoid-robot-digit",
        quote:
          "such as stacking and unstacking of totes, G2P or Unit Sorter, AMR loading and unloading, palletizing and depalletizing, nesting, flowrack and carts, and automated putwall.",
      },
      // No humanProximity, deliberately. Agility describe "a path for Digit and
      // human colleagues to one day work side by side" — future tense, in their
      // own words. Recording a shared-space rating today would contradict the
      // source it would cite.
    ],
  },
  {
    id: "team-boston-dynamics-atlas",
    name: "Boston Dynamics",
    product: "Atlas",
    website: "https://bostondynamics.com/products/atlas/",
    figures: [
      {
        field: "embodiment",
        value: "humanoid",
        grade: "published",
        sourceUrl: "https://bostondynamics.com/products/atlas/",
        quote:
          "Every centimeter of Atlas is meticulously designed, manufactured, and calibrated as the world's first enterprise-grade, industrial humanoid robot.",
      },
      {
        // Three figures are published: 50 kg instant, 30 kg sustained, 20 kg
        // one-handed. Sustained is the one a shift's worth of work runs at, and
        // matching on the peak would put Atlas in front of sites it could not
        // hold up for.
        field: "payloadCapacity",
        value: 30,
        unit: "kg",
        grade: "published",
        sourceUrl: "https://bostondynamics.com/wp-content/uploads/2026/01/atlas-spec-sheet.pdf",
        quote:
          "Weight Capacity: Instant 50 kg (110 lbs) Sustained 30 kg (66 lbs) One-Handed 20 kg (44 lbs)",
      },
      {
        field: "reachM",
        value: 2.3,
        unit: "metres",
        grade: "published",
        sourceUrl: "https://bostondynamics.com/products/atlas/",
        quote: "Reach / 2.3 m (7.5 ft)",
      },
      {
        field: "taskFamily",
        value: "machine_tending",
        grade: "published",
        sourceUrl: "https://bostondynamics.com/products/atlas/",
        quote:
          "We will be engaging with select customers to build Atlas' skills for the next round of applications, including part sequencing, machine tending, order building, and more.",
      },
    ],
  },
  {
    id: "team-figure",
    name: "Figure",
    product: "Figure 03",
    website: "https://www.figure.ai/figure",
    figures: [
      {
        field: "embodiment",
        value: "humanoid",
        grade: "published",
        sourceUrl: "https://www.figure.ai/news/introducing-figure-03",
        quote:
          "Figure 03 represents an unprecedented advancement in taking humanoid robots from experimental prototypes to deployable, scalable products.",
      },
      {
        field: "payloadCapacity",
        value: 20,
        unit: "kg",
        grade: "published",
        sourceUrl: "https://www.figure.ai/figure",
        quote: "Height 5'8\" / Payload 20KG / Weight 61KG / Runtime 5HR / Speed 1.2M/S",
      },
      // No taskFamily. Figure market Figure 03 for household work — laundry,
      // cleaning, dishes — which maps to none of the site-task families, and
      // forcing it into one would invent a fit.
    ],
  },
  {
    id: "team-apptronik",
    name: "Apptronik",
    product: "Apollo",
    website: "https://apptronik.com/apollo/apollo-2",
    figures: [
      {
        field: "embodiment",
        value: "humanoid",
        grade: "published",
        sourceUrl: "https://apptronik.com/apollo/apollo-2",
        quote:
          "A bipedal configuration enables movement through spaces built for people, while a wheeled base offers stability and efficiency for high-throughput environments.",
      },
      {
        // From the 2023 Apollo announcement. Apptronik publish no numeric spec
        // at all for Apollo 2, so this is the newest published payload and it
        // describes the previous generation — which the quote makes plain.
        field: "payloadCapacity",
        value: 55,
        unit: "lb",
        grade: "published",
        sourceUrl: "https://apptronik.com/news-collection/apptronik-unveils-apollo",
        quote:
          "At roughly human size (5 foot 8 inches tall and 160 pounds in weight with the ability to lift 55 pounds), Apollo has a unique force control architecture",
      },
      {
        field: "taskFamily",
        value: "pick_place",
        grade: "published",
        sourceUrl: "https://apptronik.com/solutions/packout",
        quote:
          "Apollo can support warehouse packout operations by placing picked items into cardboard boxes and positioning completed packages onto motorized conveyors for transport to the shipping dock.",
      },
      // No humanProximity. Apptronik say Apollo's control is "similar to a
      // collaborative robot" — a comparison, not a rating.
    ],
  },

  /* -------------------------------------------------- mobile manipulators */
  {
    id: "team-boston-dynamics-stretch",
    name: "Boston Dynamics",
    product: "Stretch",
    website: "https://bostondynamics.com/products/stretch/",
    figures: [
      {
        field: "embodiment",
        value: "mobile_manipulator",
        grade: "published",
        sourceUrl: "https://bostondynamics.com/products/stretch/",
        quote: "Mobility and manipulation for the warehouse",
      },
      {
        field: "payloadCapacity",
        value: 23,
        unit: "kg",
        grade: "published",
        sourceUrl:
          "https://bostondynamics.com/wp-content/uploads/2026/03/Stretch-Brochure-2026-Final-1.pdf",
        quote: "Maximum case weight 50 pounds (23 kg)",
      },
      {
        field: "reachM",
        value: 1.95,
        unit: "metres",
        grade: "published",
        sourceUrl:
          "https://bostondynamics.com/wp-content/uploads/2026/03/Stretch-Brochure-2026-Final-1.pdf",
        quote:
          "Maximum vertical and horizontal reach 10.5 feet (3.2 m) | 6.4 feet (1.95 m)",
      },
      {
        field: "taskFamily",
        value: "palletizing",
        grade: "published",
        sourceUrl: "https://bostondynamics.com/solutions/warehouse-automation/case-picking/",
        quote:
          "Stretch identifies, grasps, and stacks boxes, building palletized orders that are ready to be shipped to your customers.",
      },
    ],
  },
  {
    id: "team-locus-array",
    name: "Locus Robotics",
    product: "Locus Array",
    website: "https://locusrobotics.com/locusone/fleet/locus-array",
    figures: [
      {
        field: "embodiment",
        value: "mobile_manipulator",
        grade: "published",
        sourceUrl: "https://locusrobotics.com/locusone/fleet/locus-array",
        quote:
          "AI-driven mobile manipulation for production-scale fulfillment with fully autonomous picking, intelligent grasping, and unmatched SKU coverage across every vertical.",
      },
      {
        field: "taskFamily",
        value: "pick_place",
        grade: "published",
        sourceUrl: "https://locusrobotics.com/locusone/fleet/locus-array",
        quote: "picking, putaway, induction, drop-off, and slotting without manual intervention",
      },
      // No payload. Locus publish throughput and ROI for Array but no physical
      // load figure, so it stays unknown and Array can never be counted as
      // clearing a payload constraint.
    ],
  },

  /* ------------------------------------------------ autonomous mobile robots */
  {
    id: "team-locus-origin",
    name: "Locus Robotics",
    product: "Locus Origin",
    website: "https://locusrobotics.com/locusone/fleet/locus-origin-collaborative-robot",
    figures: [
      {
        field: "embodiment",
        value: "autonomous_mobile_robot",
        grade: "published",
        sourceUrl:
          "https://locusrobotics.com/locusone/fleet/locus-origin-collaborative-robot",
        quote:
          "Locus Origin is a collaborative mobile robot that enhances productivity by more than 2X.",
      },
      {
        field: "payloadCapacity",
        value: 36,
        unit: "kg",
        grade: "published",
        sourceUrl:
          "https://locusrobotics.com/locusone/fleet/locus-origin-collaborative-robot",
        quote: "Origin Warehouse Cobot Payload Capacity CE Certified to 36 kg. / 80 lbs.",
      },
      {
        field: "taskFamily",
        value: "transport",
        grade: "published",
        sourceUrl:
          "https://locusrobotics.com/locusone/fleet/locus-origin-collaborative-robot",
        quote:
          "letting you complete both picking and putaway/replenishment tasks at the same time, with the same labor force.",
      },
      // No humanProximity. "Collaborative" and "alongside your workers" are
      // Locus's marketing; the only certification word on the page is "CE", and
      // it is attached to the payload figure rather than to a safety rating.
    ],
  },
  {
    id: "team-locus-vector",
    name: "Locus Robotics",
    product: "Locus Vector",
    website: "https://locusrobotics.com/locusone/fleet/locus-vector-material-handling-robot",
    figures: [
      {
        field: "embodiment",
        value: "autonomous_mobile_robot",
        grade: "published",
        sourceUrl:
          "https://locusrobotics.com/wp-content/uploads/2026/04/Locus-Vector-Datasheet-2026.pdf",
        quote:
          "Locus Vector is an autonomous mobile robot (AMR) built to keep heavy payloads moving reliably, safely, and at scale",
      },
      {
        field: "payloadCapacity",
        value: 272,
        unit: "kg",
        grade: "published",
        sourceUrl:
          "https://locusrobotics.com/wp-content/uploads/2026/04/Locus-Vector-Datasheet-2026.pdf",
        quote: "PAYLOAD 600 lbs 272 kg",
      },
      {
        field: "taskFamily",
        value: "transport",
        grade: "published",
        sourceUrl:
          "https://locusrobotics.com/wp-content/uploads/2026/04/Locus-Vector-Datasheet-2026.pdf",
        quote:
          "Cart transport Shelf transport Case and discrete order movement Sortation Conveyor feeding Point-to-point material handling",
      },
    ],
  },
];
