/**
 * Load the researched prospects into the registry.
 *
 * Writes through `mergeCapability`, so the same grade precedence applies as
 * everywhere else: a seeded `published` figure will never overwrite something a
 * team told us or something Blueprint measured. Re-running is therefore safe
 * and idempotent — it tops up what is missing and leaves better evidence alone.
 *
 *   npx tsx scripts/seed-robot-teams.ts            # write
 *   npx tsx scripts/seed-robot-teams.ts --dry-run  # print what it would write
 *
 * Everything lands as `status: "prospect"`. These companies have not agreed to
 * anything, and nothing here may be described to a site as a relationship.
 */
import admin, { dbAdmin as db } from "../client/src/lib/firebaseAdmin";
import { robotTeamSeed, type SeededFigure } from "../server/data/robotTeamSeed";
import {
  cycleSecondsToBand,
  payloadKgToBand,
  poundsToKg,
  shiftVolumeToBand,
  successRateToBand,
} from "../server/utils/capabilityFigures";
import { mergeCapability } from "../server/utils/robotTeamRegistry";
import {
  ROBOT_TEAMS_COLLECTION,
  type RobotCapabilityField,
  type RobotTeamRecord,
} from "../server/types/robot-team-registry";

/**
 * Convert a raw published figure into the band the matcher compares.
 *
 * A figure that will not convert is dropped rather than approximated. The whole
 * point of recording "Payload: 20 kg" verbatim is that the band is derived, so
 * a conversion that cannot be made honestly is a missing field, not a guess.
 */
function deriveBand(figure: SeededFigure): string | number | null {
  if (!figure.unit) return figure.value;
  const numeric = typeof figure.value === "number" ? figure.value : Number(figure.value);
  switch (figure.unit) {
    case "kg":
      return payloadKgToBand(numeric);
    case "lb":
      return payloadKgToBand(poundsToKg(numeric));
    case "seconds":
      return cycleSecondsToBand(numeric);
    case "percent":
      return successRateToBand(numeric);
    case "cycles":
      return shiftVolumeToBand(numeric);
    case "metres":
      // Stored as a number, not banded: reach and path width are compared
      // numerically when they are compared at all.
      return Number.isFinite(numeric) ? numeric : null;
    default:
      return null;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!dryRun && !db) {
    console.error("Firebase Admin is not configured; run with --dry-run or set credentials.");
    process.exitCode = 1;
    return;
  }

  for (const team of robotTeamSeed) {
    const existing =
      (!dryRun && db
        ? ((await db.collection(ROBOT_TEAMS_COLLECTION).doc(team.id).get()).data() as
            | RobotTeamRecord
            | undefined)
        : undefined) ?? {
        id: team.id,
        name: team.name,
        status: "prospect" as const,
        capability: {},
        fieldProvenance: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

    let record: Pick<RobotTeamRecord, "capability" | "fieldProvenance"> = {
      capability: existing.capability,
      fieldProvenance: existing.fieldProvenance,
    };

    const applied: string[] = [];
    const skipped: string[] = [];

    // One field at a time, because each carries its own source and quote.
    for (const figure of team.figures) {
      const value = deriveBand(figure);
      if (value === null || value === undefined || value === "") {
        skipped.push(`${figure.field} (unconvertible: ${figure.value}${figure.unit ?? ""})`);
        continue;
      }
      const merged = mergeCapability(
        record,
        { [figure.field]: value } as Partial<
          Record<RobotCapabilityField, string | number | null>
        >,
        {
          grade: figure.grade,
          source: `${figure.sourceUrl} — "${figure.quote}"`,
        },
      );
      record = { capability: merged.capability, fieldProvenance: merged.fieldProvenance };
      if (merged.changed.length) applied.push(`${figure.field}=${value}`);
      else skipped.push(`${figure.field} (better evidence already held)`);
    }

    const next: RobotTeamRecord = {
      ...existing,
      id: team.id,
      name: team.name,
      website: team.website,
      // Never anything but prospect from this script. A seeded company has not
      // applied and is not engaged, and a status that said otherwise would be a
      // fabricated relationship.
      status: existing.status === "declined" ? "declined" : "prospect",
      capability: record.capability,
      fieldProvenance: record.fieldProvenance,
      updatedAt: new Date().toISOString(),
    };

    console.log(`\n${team.name} — ${team.product}`);
    console.log(`  applied: ${applied.length ? applied.join(", ") : "nothing new"}`);
    if (skipped.length) console.log(`  skipped: ${skipped.join(", ")}`);

    if (!dryRun && db) {
      await db.collection(ROBOT_TEAMS_COLLECTION).doc(team.id).set(next, { merge: true });
    }
  }

  console.log(
    `\n${dryRun ? "Dry run" : "Seeded"}: ${robotTeamSeed.length} prospects. ` +
      "None carry deploymentGeography, so none can match as confirmed — by design.",
  );
  if (!dryRun) await admin.app().delete().catch(() => undefined);
}

void main();
