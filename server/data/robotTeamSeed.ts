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
  {
    id: "team-universal-robots",
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
        field: "payloadCapacity",
        value: 20,
        unit: "kg",
        grade: "published",
        sourceUrl: "https://www.universal-robots.com/products/ur20-robot/",
        quote: "Payload: 20 kg (44.1 lbs)",
      },
      {
        field: "reachM",
        value: 1.75,
        unit: "metres",
        grade: "published",
        sourceUrl: "https://www.universal-robots.com/products/ur20-robot/",
        quote: "Reach: 1750 mm (68.9 in)",
      },
      {
        // "Collaborative" is a product category, not a safety rating against a
        // named standard, and a cobot still needs a site risk assessment. So
        // this is a reading, not a figure — graded accordingly, which keeps it
        // out of any match a site operator sees.
        field: "humanProximity",
        value: "shared",
        grade: "inferred",
        sourceUrl: "https://www.universal-robots.com/products/ur20-robot/",
        quote: "UR20 Collaborative Robot Arm | Universal Robots",
      },
    ],
  },
  {
    id: "team-franka-robotics",
    name: "Franka Robotics",
    product: "Franka Research 3",
    website: "https://franka.de/products",
    figures: [
      {
        field: "embodiment",
        value: "stationary_arm",
        grade: "published",
        sourceUrl: "https://franka.de/products",
        quote: "torque sensors integrated at each joint",
      },
      {
        field: "payloadCapacity",
        value: 3,
        unit: "kg",
        grade: "published",
        sourceUrl: "https://franka.de/products",
        quote: "Payload: 3 kg",
      },
      {
        field: "reachM",
        value: 0.855,
        unit: "metres",
        grade: "published",
        sourceUrl: "https://franka.de/products",
        quote: "Reach: 855 mm",
      },
    ],
  },
  {
    id: "team-agility-robotics",
    name: "Agility Robotics",
    product: "Digit",
    website: "https://www.agilityrobotics.com/products/digit",
    figures: [
      {
        field: "embodiment",
        value: "humanoid",
        grade: "published",
        sourceUrl: "https://www.agilityrobotics.com/products/digit",
        quote: "Designed to excel in spaces where people already work",
      },
      {
        field: "payloadCapacity",
        value: 35,
        unit: "lb",
        grade: "published",
        sourceUrl: "https://www.agilityrobotics.com/products/digit",
        quote: "35 pound carrying capacity",
      },
      {
        // Marketing language about where it works, not a proximity rating.
        field: "humanProximity",
        value: "shared",
        grade: "inferred",
        sourceUrl: "https://www.agilityrobotics.com/products/digit",
        quote: "Designed to excel in spaces where people already work",
      },
    ],
  },
  {
    id: "team-boston-dynamics",
    name: "Boston Dynamics",
    product: "Stretch",
    website: "https://bostondynamics.com/products/stretch/",
    figures: [
      {
        field: "embodiment",
        value: "mobile_manipulator",
        grade: "published",
        sourceUrl: "https://bostondynamics.com/products/stretch/",
        quote: "Stretch - Mobile Warehouse Robots",
      },
      {
        field: "payloadCapacity",
        value: 50,
        unit: "lb",
        grade: "published",
        sourceUrl: "https://bostondynamics.com/products/stretch/",
        quote:
          "Stretch can handle a wide range of package types and sizes, from standard brown to highly graphical, up to 50 pounds.",
      },
      {
        // Truck unloading and case handling read as depalletizing, but the page
        // does not use the word, so this is a reading rather than a figure.
        field: "taskFamily",
        value: "palletizing",
        grade: "inferred",
        sourceUrl: "https://bostondynamics.com/products/stretch/",
        quote:
          "Stretch can handle a wide range of package types and sizes, from standard brown to highly graphical, up to 50 pounds.",
      },
      // dutyCycle is deliberately absent. The page says Stretch can "move
      // hundreds of cases an hour", and "hundreds" is not a figure any band can
      // be derived from without inventing precision the source does not have.
    ],
  },
];
