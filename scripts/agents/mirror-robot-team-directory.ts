import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { publicRobotTeam, ROOT } from "../../server/robot-team-intelligence/directory";
import { mirrorRobotTeamToNotion } from "../../server/robot-team-intelligence/notion-mirror";
import { intelligenceControlSchema } from "../../server/robot-team-intelligence/contract";
import { readQueryPages } from "../../server/research-learning/query-pages";

async function main() {
  if (!dbAdmin) throw Error("robot_directory_mirror_existing_binding_required");
  const db = dbAdmin, root = db.doc(ROOT), saved = await root.get(), control = intelligenceControlSchema.parse(saved.data());
  const teams = (await readQueryPages(db.collection("robotTeams"))).filter(d => publicRobotTeam(d.id, d.data()).retained_directory);
  if (!process.argv.includes("--apply")) { console.log(JSON.stringify({ mode: "preview", count: teams.length, mirror: control.notionMirror })); return; }
  const guard = async (tx?: FirebaseFirestore.Transaction) => {
    const current = tx ? await tx.get(root) : await root.get();
    if (JSON.stringify(current.data()) !== JSON.stringify(saved.data()) || !control.notionMirror?.enabled
      || !control.directoryAccess.read || !control.directoryAccess.updatePublicEvidence
      || control.directoryAccess.expiresAt <= new Date().toISOString()) throw Error("robot_directory_mirror_authority_changed");
  };
  const receipts = [];
  for (const team of teams) receipts.push(await mirrorRobotTeamToNotion(db, team.id, control.notionMirror, { guard }));
  console.log(JSON.stringify({ count: receipts.length, receipts }));
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "robot_directory_mirror_failed"); process.exitCode = 1; });
