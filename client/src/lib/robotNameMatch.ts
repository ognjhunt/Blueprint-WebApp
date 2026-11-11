/**
 * One way to tell whether two records name the same robot.
 *
 * The answer, the simulation result and the job card each match a robot from
 * the spec catalog against a row written elsewhere (the Pipeline's scene
 * table, a stored card). They must agree on what "the same robot" means, so the
 * rule lives here: the same maker and the same model name, ignoring case,
 * punctuation and spacing.
 */

export interface RobotName {
  manufacturer: string;
  name: string;
}

/** Lower case, with every run of punctuation or spacing as one space. */
export function normalizeRobotText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** True when both records name the same maker and the same model. */
export function sameRobot(a: RobotName, b: RobotName): boolean {
  const maker = normalizeRobotText(a.manufacturer);
  const name = normalizeRobotText(a.name);
  return maker.length > 0 && name.length > 0
    && maker === normalizeRobotText(b.manufacturer) && name === normalizeRobotText(b.name);
}
