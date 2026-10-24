import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { directoryDigest, ROOT, ROBOT_TEAM_TOOLS } from "../../server/robot-team-intelligence/directory";
import { ROBOT_TEAM_AGENT_MODEL, ROBOT_TEAM_INSTRUCTIONS, type RobotTeamAgentRole } from "../../server/robot-team-intelligence/instructions";
import { RobotAgentsClient } from "../../server/robot-team-intelligence/native";
import { projectAgentEvidence } from "../../server/agents/private-evidence";
import { RobotAgentHttpError } from "../../server/robot-team-intelligence/native";

const apply = process.argv.includes("--apply");
const projectIndex = process.argv.indexOf("--project");
const project = projectIndex >= 0 ? process.argv[projectIndex + 1] : process.env.OPENAI_PROJECT_ID;
const roles: RobotTeamAgentRole[] = ["discovery", "refresh"];
const definition = (role: RobotTeamAgentRole) => ({ name: role === "discovery" ? "Blueprint Robot Team Discovery" : "Blueprint Robot Team Refresh",
  model: ROBOT_TEAM_AGENT_MODEL, instructions: ROBOT_TEAM_INSTRUCTIONS[role], reasoning: { summary: "auto" },
  multi_agent: { enabled: false }, tools: [{ type: "web_search" }, ...ROBOT_TEAM_TOOLS] });

async function main() {
if (!apply) {
  console.log(JSON.stringify({ mode: "preview", root: ROOT, agents: Object.fromEntries(roles.map(role => [role, definition(role)])),
    cadence: { discovery: "weekly", refresh: "weekly", review: "monthly", timezone: "America/Chicago", proposedHour: 9, proposedWeeklyDay: "Monday" },
    activation: "paused; own retained directory/spending authority and worker flag are required; no existing agent or schedule is changed",
    semantic: { model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small", defaultEnabled: false,
      settingsRef: "blueprintResearchLearning/default/historySearchSettings/current" } }, null, 2));
} else {
  if (!dbAdmin || !process.env.OPENAI_API_KEY || !project || !/^proj_[A-Za-z0-9]+$/.test(project)) throw Error("existing_robot_setup_runtime_binding_required");
  const root = dbAdmin.doc(ROOT), client = new RobotAgentsClient({ apiKey: process.env.OPENAI_API_KEY, projectId: project });
  if ((await root.get()).data()?.enabled) throw Error("robot_setup_active_control_preserved");
  const ids: Partial<Record<RobotTeamAgentRole, string>> = {};
  for (const role of roles) {
    const configuration = definition(role), digest = directoryDigest(configuration), ref = root.collection("definitions").doc(role);
    let record = (await ref.get()).data();
    if (record && record.digest !== digest) throw Error("robot_setup_existing_definition_preserved");
    if (!record) {
      await dbAdmin.runTransaction(async tx => {
        const old = await tx.get(ref);
        if (old.exists) return;
        tx.set(ref, { role, digest, configuration, projectId: project, createClaimed: true, createdAt: new Date().toISOString(), state: "create_pending" });
      });
      record = (await ref.get()).data()!;
      // Only the transaction's original owner may submit this create. A second
      // process observes the same metadata; it cannot silently duplicate agents.
      const candidates = (await client.list("/agents?order=asc")).filter(agent => agent.metadata?.blueprint_robot_definition === digest && agent.metadata?.blueprint_robot_role === role);
      if (candidates.length > 1) throw Error("robot_setup_definition_ambiguous");
      if (candidates.length) record.agentId = candidates[0].id;
      else {
        // Keep the claimed request durable before any provider mutation.
        const claimed = await dbAdmin.runTransaction(async tx => {
          const current = await tx.get(ref);
          if (current.data()?.postSubmitted) return false;
          tx.set(ref, { postSubmitted: true }, { merge: true }); return true;
        });
        if (claimed) {
          try {
            const created = await client.json("/agents", { method: "POST", body: JSON.stringify({ ...configuration,
              metadata: { blueprint_robot_role: role, blueprint_robot_definition: digest } }) });
            record.agentId = created.id;
          } catch (error) {
            const id = `robot-setup-${digest}`, snapshot = { projectId: project, role, digest, configuration,
              failure: error instanceof RobotAgentHttpError ? error.evidence : { code: "robot_setup_create_ack_unknown" } };
            const projected = await projectAgentEvidence({ snapshot }, { collection: "agentCheckpoints", id });
            await dbAdmin.doc(`agentCheckpoints/${id}`).set(projected);
            await ref.set({ diagnosticRef: `agentCheckpoints/${id}`, state: "create_unresolved" }, { merge: true });
            throw Error("robot_setup_create_requires_get_reconciliation");
          }
        }
      }
    } else if (!record.agentId) {
      const candidates = (await client.list("/agents?order=asc")).filter(agent => agent.metadata?.blueprint_robot_definition === digest && agent.metadata?.blueprint_robot_role === role);
      if (candidates.length !== 1) throw Error("robot_setup_create_requires_get_reconciliation");
      record.agentId = candidates[0].id;
    }
    if (typeof record.agentId !== "string" || !record.agentId.startsWith("agent_")) throw Error("robot_setup_create_requires_get_reconciliation");
    const readback = await client.json(`/agents/${encodeURIComponent(record.agentId)}`);
    if (readback.metadata?.blueprint_robot_definition !== digest || readback.model !== configuration.model || readback.instructions !== configuration.instructions) throw Error("robot_setup_definition_readback_changed");
    await ref.set({ agentId: record.agentId, state: "ready", readbackVerifiedAt: new Date().toISOString() }, { merge: true });
    ids[role] = record.agentId;
  }
  await dbAdmin.runTransaction(async tx => {
    const saved = await tx.get(root);
    if (saved.exists) {
      if (saved.data()?.enabled || saved.data()?.agents && directoryDigest(saved.data()!.agents) !== directoryDigest(ids)) throw Error("robot_setup_existing_control_preserved");
      return;
    }
    // No invented permission, budget, expiry or active worker setting.
    tx.set(root, { schemaVersion: 1, enabled: false, projectId: project, agents: ids, timezone: "America/Chicago", hour: 9,
      weeklyDay: 1, firstDate: new Date().toISOString().slice(0, 10), semanticEnabled: false, mcpReadTools: {} });
  });
  console.log(JSON.stringify({ mode: "prepared", agents: ids, root: ROOT, enabled: false,
    next: "Add optional owner MCPs to these saved agents; retain own directory/budget authority, then enable this lane. Existing research/comms untouched." }));
}
}
void main().catch(error => { console.error(error instanceof RobotAgentHttpError ? error.message : String(error?.message ?? "robot_setup_failed")); process.exitCode = 1; });
