/**
 * What a delivered simulation package really holds, said to the site in the same facts a deployment company reads
 * (outreach audit, 2026-11-27: 7 of the 9 packages built were the room only, and the site's page said "ready" alone).
 *
 * From the stored package (`website_company_simulation.v1`): `object_included` when the Pipeline sent it, else whether
 * the package's files hold the object part, which the Pipeline writes at the package's top level as `object.*`
 * (its `website_company_simulation.py`: "the parts (scene/room.*, scene/room_collision.*, object.*)"); and whether
 * `success_rule.json` is in it. A flag, never a gate: the job stays posted and nothing is asked of the site.
 */
export interface SimulationContents {
  /** The job's object is in the simulation. */
  objectIncluded: boolean;
  /** The simulation carries the success rule (`success_rule.json`). */
  successRuleIncluded: boolean;
}

const OBJECT_PART = /^object\.[A-Za-z0-9]+$/;
export const SUCCESS_RULE_FILE = "success_rule.json";

export function simulationContentsOf(pkg: { object_included?: boolean; files: readonly string[] }): SimulationContents {
  return {
    objectIncluded: typeof pkg.object_included === "boolean" ? pkg.object_included : pkg.files.some(name => OBJECT_PART.test(name)),
    successRuleIncluded: pkg.files.includes(SUCCESS_RULE_FILE),
  };
}

/** A strict reader of the status route's field: anything else is "not known", and the page says only "ready". */
export function readSimulationContents(value: unknown): SimulationContents | null {
  if (!value || typeof value !== "object") return null;
  const { objectIncluded, successRuleIncluded } = value as Record<string, unknown>;
  return typeof objectIncluded === "boolean" && typeof successRuleIncluded === "boolean" ? { objectIncluded, successRuleIncluded } : null;
}

/** Under "The simulation of your site is ready." for the room without the job's object (the company's SIMULATION_WITHOUT_OBJECT). */
export const SIMULATION_ROOM_ONLY = "It shows your room without the job's object in it, so it does not check what counts as done.";
/** The same, when the package does carry a success rule of its own. */
export const SIMULATION_ROOM_ONLY_WITH_RULE = "It shows your room without the job's object in it.";
/** The object is in it, but the package has no success rule. */
export const SIMULATION_NO_RULE = "It does not check what counts as done.";

/** The line under "ready" for what the package holds, or null for a full package. */
export function simulationContentsLine(contents: SimulationContents | null | undefined): string | null {
  if (!contents) return null;
  if (!contents.objectIncluded) return contents.successRuleIncluded ? SIMULATION_ROOM_ONLY_WITH_RULE : SIMULATION_ROOM_ONLY;
  return contents.successRuleIncluded ? null : SIMULATION_NO_RULE;
}

/** The site's own success rule, said as its own words when the simulation does not check it. */
export const youSaidDoneMeans = (rule: string) => `You said done means: ${rule.trim().replace(/[.!?]+$/, "")}.`;
