import { readFile } from "node:fs/promises";
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { importRobotTeamDirectory, prepareDirectoryImport } from "../../server/robot-team-intelligence/import";

async function main() {
  const value = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
  const file = value("--input");
  if (!file) throw Error("robot_directory_import_input_required");
  const input = JSON.parse(await readFile(file, "utf8")), prepared = prepareDirectoryImport(input);
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ mode: "preview", sourceSha256: prepared.sourceSha256, count: prepared.records.length,
      sourceChecksAdvanced: false, teams: prepared.records.map(r => ({ teamId: r.teamId, name: r.name, originalCheckedAt: r.source.original_checked_at })) }));
    return;
  }
  const authority = value("--authority-ref");
  if (!dbAdmin || !authority) throw Error("robot_directory_import_existing_binding_and_authority_required");
  console.log(JSON.stringify(await importRobotTeamDirectory(dbAdmin, input, authority)));
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "robot_directory_import_failed"); process.exitCode = 1; });
